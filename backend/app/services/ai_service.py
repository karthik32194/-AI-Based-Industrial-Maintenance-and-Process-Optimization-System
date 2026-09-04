"""
AI Service — Section 15 / Section 7.6
Combines machine context + ML prediction result + RAG retrieved knowledge
and invokes the LLM to generate explanation + maintenance recommendation.

Core principle (Section 18):
  ML predicts → RAG retrieves → LLM explains/recommends → Human decides.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.exceptions import LLMException, NotFoundException
from app.core.logging import get_logger
from app.models.machine import Machine
from app.models.prediction import Prediction, RiskLevel
from app.models.recommendation import Recommendation, RecommendationPriority
from app.rag.retriever import retrieve_relevant_chunks

logger = get_logger(__name__)

# Lazy OpenAI client
_openai_client = None


def _get_client():
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=settings.openai_api_key)
        except ImportError as exc:
            raise ImportError("openai package required.") from exc
    return _openai_client


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_recommendation(
    machine_id: uuid.UUID,
    db: Session,
    prediction_id: Optional[uuid.UUID] = None,
    additional_context: Optional[str] = None,
) -> Recommendation:
    """
    Full AI recommendation pipeline.

    Steps:
    1. Load machine + prediction context.
    2. Retrieve relevant maintenance knowledge via RAG.
    3. Build grounded LLM prompt.
    4. Call LLM to generate explanation + recommendation.
    5. Persist and return Recommendation.
    """
    # 1. Load context
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")

    prediction: Optional[Prediction] = None
    if prediction_id:
        prediction = db.get(Prediction, prediction_id)
    else:
        prediction = (
            db.query(Prediction)
            .filter(Prediction.machine_id == machine_id)
            .order_by(Prediction.created_at.desc())
            .first()
        )

    # 2. Build RAG query from machine context + prediction
    rag_query = _build_rag_query(machine, prediction)

    # 3. Retrieve knowledge
    try:
        knowledge_chunks = retrieve_relevant_chunks(rag_query, db, top_k=settings.rag_top_k)
    except Exception as exc:
        logger.warning("rag_retrieval_failed_continuing", error=str(exc))
        knowledge_chunks = []

    rag_context = _format_rag_context(knowledge_chunks)
    rag_summary = _summarise_rag_context(knowledge_chunks)

    # 4. Build prompt and call LLM
    machine_context = _build_machine_context(machine, prediction)
    prompt = _build_prompt(machine_context, rag_context, additional_context)

    llm_result = _call_llm(prompt)

    # 5. Map risk → priority
    priority = _map_risk_to_priority(prediction)

    # 6. Persist
    rec = Recommendation(
        machine_id=machine_id,
        prediction_id=prediction.id if prediction else None,
        explanation=llm_result["explanation"],
        recommendation=llm_result["recommendation"],
        rag_context_summary=rag_summary,
        priority=priority,
        llm_model=settings.openai_model,
        prompt_tokens=llm_result.get("prompt_tokens"),
        completion_tokens=llm_result.get("completion_tokens"),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    logger.info(
        "recommendation_generated",
        machine_id=str(machine_id),
        priority=priority,
        rag_chunks=len(knowledge_chunks),
    )
    return rec


# ---------------------------------------------------------------------------
# Prompt construction helpers
# ---------------------------------------------------------------------------

def _build_machine_context(machine: Machine, prediction: Optional[Prediction]) -> str:
    lines = [
        f"Machine ID: {machine.id}",
        f"Machine Name: {machine.machine_name}",
        f"Machine Type: {machine.machine_type}",
        f"Location: {machine.location}",
        f"Status: {machine.status.value}",
    ]
    if prediction:
        lines += [
            "",
            "--- ML Prediction Result ---",
            f"Failure Probability: {prediction.failure_probability:.1%}",
            f"Risk Level: {prediction.risk_level.value}",
            f"Health Score: {prediction.health_score or 'N/A'}",
            f"Predicted Failure Type: {prediction.predicted_failure or 'Unknown'}",
            f"Anomaly Detected: {'Yes' if prediction.anomaly_detected else 'No'}",
            f"Model Version: {prediction.model_version}",
            "",
            "--- Sensor Readings at Prediction Time ---",
            f"Temperature:        {prediction.input_temperature} °C",
            f"Vibration:          {prediction.input_vibration} mm/s",
            f"Pressure:           {prediction.input_pressure} bar",
            f"RPM:                {prediction.input_rpm}",
            f"Power Consumption:  {prediction.input_power_consumption} kW",
        ]
    return "\n".join(lines)


def _build_rag_query(machine: Machine, prediction: Optional[Prediction]) -> str:
    parts = [f"{machine.machine_type} maintenance"]
    if prediction:
        if prediction.predicted_failure:
            parts.append(prediction.predicted_failure)
        if prediction.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL):
            parts.append("urgent repair procedure")
        if prediction.anomaly_detected:
            parts.append("anomaly troubleshooting")
    return " ".join(parts)


def _format_rag_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant maintenance knowledge retrieved."
    sections = []
    for i, chunk in enumerate(chunks, 1):
        score_pct = round(chunk["relevance_score"] * 100, 1)
        sections.append(
            f"[Source {i}: {chunk['document_filename']} | Relevance: {score_pct}%]\n"
            f"{chunk['content']}"
        )
    return "\n\n".join(sections)


def _summarise_rag_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No knowledge retrieved."
    sources = list({c["document_filename"] for c in chunks})
    return f"Retrieved {len(chunks)} chunks from: {', '.join(sources)}"


def _build_prompt(
    machine_context: str,
    rag_context: str,
    additional_context: Optional[str],
) -> str:
    extra = f"\n\nAdditional context: {additional_context}" if additional_context else ""
    return f"""You are an industrial maintenance AI assistant.
Your role is to explain ML prediction results and generate prioritised maintenance recommendations.

STRICT RULES:
- Base your explanation and recommendation ONLY on the machine context and retrieved knowledge below.
- Do NOT invent sensor measurements, procedures, or facts not present in the context.
- Your recommendation must be actionable and specific.
- Always note that the final maintenance decision rests with the human maintenance engineer.

=== MACHINE CONTEXT ===
{machine_context}{extra}

=== RETRIEVED MAINTENANCE KNOWLEDGE ===
{rag_context}

=== TASK ===
1. EXPLANATION: In 2–4 sentences, explain what the ML result means for this machine and why it has been flagged.
2. RECOMMENDATION: Provide a numbered list of prioritised maintenance actions the engineer should take.

Respond in this exact format:
EXPLANATION:
<your explanation here>

RECOMMENDATION:
<your numbered recommendation list here>"""


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15), reraise=True)
def _call_llm(prompt: str) -> dict:
    """Call the OpenAI Chat Completions API and parse the response."""
    if not settings.openai_api_key:
        logger.warning("openai_api_key_missing_returning_placeholder")
        return _placeholder_response()

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert industrial maintenance AI assistant. "
                        "You provide grounded, actionable maintenance guidance based only on provided context."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,    # Lower temperature for factual, consistent outputs
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or ""
        parsed = _parse_llm_response(raw)
        parsed["prompt_tokens"] = response.usage.prompt_tokens if response.usage else None
        parsed["completion_tokens"] = response.usage.completion_tokens if response.usage else None
        return parsed

    except Exception as exc:
        logger.error("llm_call_failed", error=str(exc))
        raise LLMException(f"LLM call failed: {exc}") from exc


def _parse_llm_response(raw: str) -> dict:
    """Extract EXPLANATION and RECOMMENDATION sections from LLM output."""
    explanation = ""
    recommendation = ""

    if "EXPLANATION:" in raw and "RECOMMENDATION:" in raw:
        parts = raw.split("RECOMMENDATION:", 1)
        explanation = parts[0].replace("EXPLANATION:", "").strip()
        recommendation = parts[1].strip()
    else:
        # Fallback: treat full response as recommendation
        recommendation = raw.strip()
        explanation = "See recommendation below."

    return {"explanation": explanation, "recommendation": recommendation}


def _placeholder_response() -> dict:
    """Return a placeholder when no LLM API key is configured."""
    return {
        "explanation": (
            "OpenAI API key not configured. "
            "This is a placeholder explanation. "
            "Configure OPENAI_API_KEY in your .env file to enable AI-generated explanations."
        ),
        "recommendation": (
            "1. Configure OPENAI_API_KEY in the .env file to enable real AI recommendations.\n"
            "2. Review the ML prediction results and sensor readings.\n"
            "3. Consult the maintenance manual for the predicted failure type.\n"
            "4. Schedule an engineer inspection based on the risk level."
        ),
        "prompt_tokens": None,
        "completion_tokens": None,
    }


def _map_risk_to_priority(prediction: Optional[Prediction]) -> RecommendationPriority:
    if prediction is None:
        return RecommendationPriority.MEDIUM
    mapping = {
        RiskLevel.LOW: RecommendationPriority.LOW,
        RiskLevel.MEDIUM: RecommendationPriority.MEDIUM,
        RiskLevel.HIGH: RecommendationPriority.HIGH,
        RiskLevel.CRITICAL: RecommendationPriority.CRITICAL,
    }
    return mapping.get(prediction.risk_level, RecommendationPriority.MEDIUM)
