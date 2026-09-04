"""Initial schema — all core tables

Revision ID: 0001
Revises:
Create Date: 2026-09-03

Creates tables:
  users, machines, sensor_readings, maintenance_records,
  predictions, anomalies, recommendations,
  knowledge_documents, knowledge_chunks
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("ADMIN", "MAINTENANCE_ENGINEER", "OPERATOR", name="user_role_enum"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ------------------------------------------------------------------
    # machines
    # ------------------------------------------------------------------
    op.create_table(
        "machines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_name", sa.String(120), nullable=False),
        sa.Column("machine_type", sa.String(80), nullable=False),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column(
            "status",
            sa.Enum("OPERATIONAL", "UNDER_MAINTENANCE", "FAULTY", "DECOMMISSIONED",
                    name="machine_status_enum"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("installation_date", sa.Date(), nullable=True),
        sa.Column("model_number", sa.String(80), nullable=True),
        sa.Column("manufacturer", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ------------------------------------------------------------------
    # sensor_readings
    # ------------------------------------------------------------------
    op.create_table(
        "sensor_readings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("vibration", sa.Float(), nullable=True),
        sa.Column("pressure", sa.Float(), nullable=True),
        sa.Column("rpm", sa.Float(), nullable=True),
        sa.Column("power_consumption", sa.Float(), nullable=True),
        sa.Column("source", sa.String(60), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sensor_readings_machine_id", "sensor_readings", ["machine_id"])
    op.create_index("ix_sensor_readings_timestamp", "sensor_readings", ["timestamp"])

    # ------------------------------------------------------------------
    # maintenance_records
    # ------------------------------------------------------------------
    op.create_table(
        "maintenance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("technician_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("technician_name", sa.String(120), nullable=True),
        sa.Column(
            "maintenance_type",
            sa.Enum("PREVENTIVE", "CORRECTIVE", name="maintenance_type_enum"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
                    name="maintenance_status_enum"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("findings", sa.Text(), nullable=True),
        sa.Column("actions_taken", sa.Text(), nullable=True),
        sa.Column("maintenance_date", sa.Date(), nullable=True),
        sa.Column("completed_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_maintenance_records_machine_id", "maintenance_records", ["machine_id"])

    # ------------------------------------------------------------------
    # predictions
    # ------------------------------------------------------------------
    op.create_table(
        "predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("failure_probability", sa.Float(), nullable=False),
        sa.Column("predicted_failure", sa.String(120), nullable=True),
        sa.Column(
            "risk_level",
            sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="risk_level_enum"),
            nullable=False,
        ),
        sa.Column(
            "health_status",
            sa.Enum("HEALTHY", "DEGRADED", "AT_RISK", "CRITICAL", name="health_status_enum"),
            nullable=False,
        ),
        sa.Column("health_score", sa.Float(), nullable=True),
        sa.Column("anomaly_detected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("model_version", sa.String(40), nullable=False),
        sa.Column("input_temperature", sa.Float(), nullable=True),
        sa.Column("input_vibration", sa.Float(), nullable=True),
        sa.Column("input_pressure", sa.Float(), nullable=True),
        sa.Column("input_rpm", sa.Float(), nullable=True),
        sa.Column("input_power_consumption", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_predictions_machine_id", "predictions", ["machine_id"])
    op.create_index("ix_predictions_created_at", "predictions", ["created_at"])

    # ------------------------------------------------------------------
    # anomalies
    # ------------------------------------------------------------------
    op.create_table(
        "anomalies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("anomaly_score", sa.Float(), nullable=False),
        sa.Column("anomaly_type", sa.String(120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("vibration", sa.Float(), nullable=True),
        sa.Column("pressure", sa.Float(), nullable=True),
        sa.Column("rpm", sa.Float(), nullable=True),
        sa.Column("power_consumption", sa.Float(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE",
                    name="anomaly_status_enum"),
            nullable=False,
        ),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_anomalies_machine_id", "anomalies", ["machine_id"])
    op.create_index("ix_anomalies_detected_at", "anomalies", ["detected_at"])

    # ------------------------------------------------------------------
    # recommendations
    # ------------------------------------------------------------------
    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prediction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("rag_context_summary", sa.Text(), nullable=True),
        sa.Column(
            "priority",
            sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="recommendation_priority_enum"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("PENDING", "REVIEWED", "ACTIONED", "DISMISSED",
                    name="recommendation_status_enum"),
            nullable=False,
        ),
        sa.Column("llm_model", sa.String(80), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_recommendations_machine_id", "recommendations", ["machine_id"])
    op.create_index("ix_recommendations_prediction_id", "recommendations", ["prediction_id"])

    # ------------------------------------------------------------------
    # knowledge_documents
    # ------------------------------------------------------------------
    op.create_table(
        "knowledge_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("doc_type", sa.String(80), nullable=True),
        sa.Column("total_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_path", sa.String(512), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ------------------------------------------------------------------
    # knowledge_chunks  (with pgvector embedding column)
    # ------------------------------------------------------------------
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_knowledge_chunks_document_id", "knowledge_chunks", ["document_id"])

    # Add embedding column using raw SQL (pgvector DDL not in standard SA types)
    op.execute("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding "
        "ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )


def downgrade() -> None:
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_documents")
    op.drop_table("recommendations")
    op.drop_table("anomalies")
    op.drop_table("predictions")
    op.drop_table("maintenance_records")
    op.drop_table("sensor_readings")
    op.drop_table("machines")
    op.drop_table("users")

    # Drop enums
    for enum_name in [
        "user_role_enum", "machine_status_enum", "maintenance_type_enum",
        "maintenance_status_enum", "risk_level_enum", "health_status_enum",
        "anomaly_status_enum", "recommendation_priority_enum", "recommendation_status_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
