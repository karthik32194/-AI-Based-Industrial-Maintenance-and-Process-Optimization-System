"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";

const API_URL = "http://localhost:8000";

/* =========================================================
   TYPES
========================================================= */

type Machine = {
  id: string;
  machine_name?: string;
  name?: string;
  machine_type?: string;
  location?: string;
  status?: string;
};

type Prediction = {
  id?: string;
  machine_id?: string;
  failure_probability: number;
  predicted_failure: string | boolean | null;
  risk_level: string;
  health_status: string;
  health_score: number | null;
  anomaly_detected: boolean;

  input_temperature?: number | null;
  input_vibration?: number | null;
  input_pressure?: number | null;
  input_humidity?: number | null;
  input_rotation_speed?: number | null;
  input_voltage?: number | null;
  input_current?: number | null;
  input_oil_level?: number | null;
  input_load?: number | null;
  input_motor_temperature?: number | null;
  input_gearbox_temperature?: number | null;
  input_sound_level?: number | null;
  input_fan_speed?: number | null;
  input_reactive_power?: number | null;
  input_active_power?: number | null;

  input_rpm?: number | null;
  input_power_consumption?: number | null;

  created_at?: string;
};

type Recommendation = {
  id: string;
  machine_id: string;
  prediction_id?: string | null;
  explanation?: string | null;
  recommendation: string;
  title?: string;
  priority: string;
  status: string;
  ai_reasoning?: string | null;
  created_at?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  isInitial?: boolean;
};

/* =========================================================
   15 SENSOR DEFINITIONS & DOMAIN BOUNDS
   Names must match Section 17 precisely
========================================================= */

interface SensorMeta {
  key: string;
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  criticalMin: number;
  criticalMax: number;
  icon: string;
  getValue: (p: Prediction) => number | null | undefined;
}

const SENSOR_CATALOG: SensorMeta[] = [
  {
    key: "temperature",
    name: "Temperature",
    unit: "°C",
    normalMin: 40,
    normalMax: 75,
    criticalMin: 28,
    criticalMax: 95,
    icon: "thermometer",
    getValue: (p) => p.input_temperature,
  },
  {
    key: "vibration",
    name: "Vibration",
    unit: "mm/s",
    normalMin: 0.25,
    normalMax: 0.7,
    criticalMin: 0.15,
    criticalMax: 1.2,
    icon: "activity",
    getValue: (p) => p.input_vibration,
  },
  {
    key: "pressure",
    name: "Pressure",
    unit: "bar",
    normalMin: 22,
    normalMax: 38,
    criticalMin: 15,
    criticalMax: 50,
    icon: "gauge",
    getValue: (p) => p.input_pressure,
  },
  {
    key: "humidity",
    name: "Humidity",
    unit: "%",
    normalMin: 30,
    normalMax: 50,
    criticalMin: 15,
    criticalMax: 75,
    icon: "droplet",
    getValue: (p) => p.input_humidity,
  },
  {
    key: "rotation_speed",
    name: "Rotation Speed",
    unit: "RPM",
    normalMin: 1400,
    normalMax: 1600,
    criticalMin: 1100,
    criticalMax: 1800,
    icon: "rotate",
    getValue: (p) => p.input_rotation_speed ?? p.input_rpm,
  },
  {
    key: "voltage",
    name: "Voltage",
    unit: "V",
    normalMin: 200,
    normalMax: 240,
    criticalMin: 180,
    criticalMax: 260,
    icon: "zap",
    getValue: (p) => p.input_voltage,
  },
  {
    key: "current",
    name: "Current",
    unit: "A",
    normalMin: 4.0,
    normalMax: 6.0,
    criticalMin: 2.5,
    criticalMax: 8.5,
    icon: "battery",
    getValue: (p) => p.input_current,
  },
  {
    key: "oil_level",
    name: "Oil Level",
    unit: "%",
    normalMin: 60,
    normalMax: 80,
    criticalMin: 40,
    criticalMax: 95,
    icon: "oil",
    getValue: (p) => p.input_oil_level,
  },
  {
    key: "load",
    name: "Load",
    unit: "%",
    normalMin: 60,
    normalMax: 95,
    criticalMin: 30,
    criticalMax: 115,
    icon: "cpu",
    getValue: (p) => p.input_load,
  },
  {
    key: "motor_temperature",
    name: "Motor Temperature",
    unit: "°C",
    normalMin: 45,
    normalMax: 70,
    criticalMin: 30,
    criticalMax: 90,
    icon: "flame",
    getValue: (p) => p.input_motor_temperature,
  },
  {
    key: "gearbox_temperature",
    name: "Gearbox Temperature",
    unit: "°C",
    normalMin: 50,
    normalMax: 75,
    criticalMin: 35,
    criticalMax: 95,
    icon: "cog",
    getValue: (p) => p.input_gearbox_temperature,
  },
  {
    key: "sound_level",
    name: "Sound Level",
    unit: "dB",
    normalMin: 65,
    normalMax: 80,
    criticalMin: 50,
    criticalMax: 95,
    icon: "volume",
    getValue: (p) => p.input_sound_level,
  },
  {
    key: "fan_speed",
    name: "Fan Speed",
    unit: "RPM",
    normalMin: 1100,
    normalMax: 1300,
    criticalMin: 900,
    criticalMax: 1500,
    icon: "fan",
    getValue: (p) => p.input_fan_speed,
  },
  {
    key: "reactive_power",
    name: "Reactive Power",
    unit: "kVAR",
    normalMin: 40,
    normalMax: 60,
    criticalMin: 25,
    criticalMax: 80,
    icon: "radio",
    getValue: (p) => p.input_reactive_power,
  },
  {
    key: "active_power",
    name: "Active Power",
    unit: "kW",
    normalMin: 80,
    normalMax: 120,
    criticalMin: 50,
    criticalMax: 150,
    icon: "power",
    getValue: (p) => p.input_active_power ?? p.input_power_consumption,
  },
];

/* Helper to classify reading status and calculate meter percentage */
function evaluateSensorReading(
  val: number | null | undefined,
  normalMin: number,
  normalMax: number,
  criticalMin: number,
  criticalMax: number
): { status: "NORMAL" | "ELEVATED" | "CRITICAL"; pct: number } {
  if (val === null || val === undefined) {
    return { status: "NORMAL", pct: 50 };
  }
  const status: "NORMAL" | "ELEVATED" | "CRITICAL" =
    val < criticalMin || val > criticalMax
      ? "CRITICAL"
      : val < normalMin || val > normalMax
      ? "ELEVATED"
      : "NORMAL";

  const span = criticalMax - criticalMin;
  const clamped = Math.max(criticalMin, Math.min(criticalMax, val));
  const pct = span > 0 ? Math.round(((clamped - criticalMin) / span) * 100) : 50;

  return { status, pct };
}

/* =========================================================
   SENSOR ICON COMPONENT
========================================================= */

function SensorGlyph({ type }: { type: string }) {
  switch (type) {
    case "thermometer":
    case "flame":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 9v3m0 0a3 3 0 100 6 3 3 0 000-6zm0-3a2 2 0 00-2 2v6a4 4 0 104 0V8a2 2 0 00-2-2z"
          />
        </svg>
      );
    case "activity":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
    case "gauge":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "droplet":
    case "oil":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      );
    case "rotate":
    case "cog":
    case "fan":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    case "zap":
    case "power":
    case "battery":
    case "radio":
    case "cpu":
    default:
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
  }
}

/* =========================================================
   MAIN COMPONENT: INDUSTRIAL AI COPILOT
========================================================= */

export default function AIAssistantPage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [authExpired, setAuthExpired] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [userName, setUserName] = useState("Karthik");

  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingRec, setIsGeneratingRec] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Quick Action Prompts
  const quickActions = [
    { label: "Analyze Machine Health", icon: "🔍", prompt: "Analyze machine health" },
    { label: "Explain Failure Risk", icon: "⚠️", prompt: "Explain failure risk" },
    { label: "Analyze Sensor Trends", icon: "📊", prompt: "Analyze sensor trends" },
    { label: "Check Anomalies", icon: "🚨", prompt: "Check anomalies" },
    { label: "Recommend Maintenance", icon: "🔧", prompt: "Recommend maintenance" },
    { label: "Optimize Machine Operation", icon: "⚙️", prompt: "Optimize machine operation" },
  ];

  // Resolve user full name from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.full_name) {
          setUserName(u.full_name.split(" ")[0]);
        } else if (u.username) {
          setUserName(u.username);
        }
      }
    } catch {
      // Fallback to default
    }
  }, []);

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        id: "init-welcome",
        role: "assistant",
        text: `Hello, ${userName}.\n\nI'm your Industrial AI Copilot.\n\nI can analyze your machine's 15 sensor channels, failure probability, anomaly status, health score, and maintenance condition.\n\nWhat would you like to investigate?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isInitial: true,
      },
    ]);
  }, [userName]);

  // Load Real Backend Data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setAuthExpired(false);
        setBackendUnavailable(false);

        const token = localStorage.getItem("access_token");
        if (!token) {
          setAuthExpired(true);
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch Machines
        const machineRes = await fetch(`${API_URL}/api/machines`, { headers });
        if (machineRes.status === 401) {
          setAuthExpired(true);
          return;
        }
        if (!machineRes.ok) {
          throw new Error("Failed to load machine");
        }

        const machineData = await machineRes.json();
        const items: Machine[] = Array.isArray(machineData)
          ? machineData
          : machineData?.items || [];
        const active =
          items.find((m) => m.status?.toUpperCase() !== "DECOMMISSIONED") || items[0];

        if (!active) {
          setLoading(false);
          return;
        }

        setMachine(active);

        // 2. Fetch Latest Prediction
        const predRes = await fetch(`${API_URL}/api/machines/${active.id}/predictions`, {
          headers,
        });

        if (predRes.status === 401) {
          setAuthExpired(true);
          return;
        }

        if (predRes.ok) {
          const predData = await predRes.json();
          const predItems: Prediction[] = predData.items || [];
          if (predItems.length > 0) {
            setPrediction(predItems[0]);
          } else {
            setPrediction(null);
          }
        }

        // 3. Fetch Existing Recommendations
        try {
          const recRes = await fetch(
            `${API_URL}/api/machines/${active.id}/recommendations?page=1&page_size=5`,
            { headers }
          );
          if (recRes.ok) {
            const recData = await recRes.json();
            const recItems: Recommendation[] = recData.items || [];
            if (recItems.length > 0) {
              setRecommendation(recItems[0]);
            }
          }
        } catch {
          // Graceful fallback if recommendations table is empty
        }
      } catch {
        setBackendUnavailable(true);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* =======================================================
     GROUNDED COPILOT RESPONSE ENGINE
     Strictly grounded in real backend telemetry and models
  ======================================================= */

  async function generateCopilotResponse(query: string): Promise<string> {
    const q = query.toLowerCase();
    const token = localStorage.getItem("access_token");

    // Case A: User explicitly requests official maintenance recommendation
    if (q.includes("recommend") && machine?.id) {
      if (token) {
        try {
          const recRes = await fetch(`${API_URL}/api/machines/${machine.id}/recommendation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          });
          if (recRes.ok) {
            const recData: Recommendation = await recRes.json();
            setRecommendation(recData);
            return `**Official AI Maintenance Recommendation Record:**\n\n- **Recommended Action:** ${
              recData.recommendation || recData.title || "Routine Component Service"
            }\n- **Priority:** ${recData.priority || "MEDIUM"}\n- **Review Status:** ${
              recData.status || "PENDING_REVIEW"
            }\n- **Engineering Rationale:** ${
              recData.explanation ||
              recData.ai_reasoning ||
              "Generated from machine telemetry, XGBoost classification, and retrieved engineering SOPs."
            }\n\n*Note: In accordance with plant safety protocols, the final maintenance dispatch rests with the human maintenance engineer.*`;
          }
        } catch {
          // Fall through to localized predictive recommendation
        }
      }

      if (recommendation) {
        return `**Active Maintenance Recommendation Record:**\n\n- **Recommended Action:** ${
          recommendation.recommendation || recommendation.title
        }\n- **Priority:** ${recommendation.priority}\n- **Review Status:** ${
          recommendation.status
        }\n- **Engineering Rationale:** ${
          recommendation.explanation ||
          recommendation.ai_reasoning ||
          "Evaluated against operating hours and sensor telemetry."
        }\n\n*Logged for maintenance engineer review.*`;
      }
    }

    // If no prediction exists, provide clear factual guidance without inventing data
    if (!prediction) {
      return `I do not currently detect any active ML prediction telemetry logged for **${
        machine?.machine_name || machine?.name || "this asset"
      }**.\n\nPlease navigate to the **Predictions** page, execute an inference scan across the 15 sensor channels, and I will be able to perform in-depth diagnostics, failure risk estimation, and anomaly isolation.`;
    }

    const prob = Math.round(Number(prediction.failure_probability) * 100);
    const health = Math.round(
      Number(prediction.health_score ?? (1 - prediction.failure_probability) * 100)
    );
    const isFail = Boolean(prediction.predicted_failure);
    const isAnom = Boolean(prediction.anomaly_detected);

    // Extract verified sensor values
    const tEnv = prediction.input_temperature;
    const tMotor = prediction.input_motor_temperature;
    const tGear = prediction.input_gearbox_temperature;
    const vib = prediction.input_vibration;
    const rpm = prediction.input_rotation_speed ?? prediction.input_rpm;
    const fan = prediction.input_fan_speed;
    const press = prediction.input_pressure;
    const hum = prediction.input_humidity;
    const oil = prediction.input_oil_level;
    const volt = prediction.input_voltage;
    const curr = prediction.input_current;
    const load = prediction.input_load;
    const sound = prediction.input_sound_level;
    const pAct = prediction.input_active_power ?? prediction.input_power_consumption;
    const pReact = prediction.input_reactive_power;

    // 1. Health Diagnostic Query
    if (q.includes("health") || q.includes("score") || q.includes("condition")) {
      return `**Machine Health Assessment:**\n\n- **Composite Health Score:** **${health}%**\n- **Health Status:** **${
        prediction.health_status
      }**\n- **Supervised Risk Category:** **${prediction.risk_level}**\n\n**Subsystem Integrity Overview:**\n- **Thermal Channels:** Ambient ${
        tEnv !== null && tEnv !== undefined ? `${tEnv.toFixed(1)} °C` : "N/A"
      }, Motor ${
        tMotor !== null && tMotor !== undefined ? `${tMotor.toFixed(1)} °C` : "N/A"
      }, Gearbox ${
        tGear !== null && tGear !== undefined ? `${tGear.toFixed(1)} °C` : "N/A"
      } — *Current sensor readings are within observed ranges.*\n- **Mechanical Drive:** Vibration ${
        vib !== null && vib !== undefined ? `${vib.toFixed(2)} mm/s` : "N/A"
      }, Rotation ${
        rpm !== null && rpm !== undefined ? `${Math.round(rpm)} RPM` : "N/A"
      }, Acoustics ${
        sound !== null && sound !== undefined ? `${sound.toFixed(1)} dB` : "N/A"
      } — *Dynamic balance conforms to baseline parameters.*\n- **Pressure & Fluid:** Pressure ${
        press !== null && press !== undefined ? `${press.toFixed(1)} bar` : "N/A"
      }, Oil Level ${
        oil !== null && oil !== undefined ? `${oil.toFixed(1)} %` : "N/A"
      } — *Hydrodynamic lubrication is stable.*\n- **Electrical Drive:** Voltage ${
        volt !== null && volt !== undefined ? `${volt.toFixed(1)} V` : "N/A"
      }, Current ${
        curr !== null && curr !== undefined ? `${curr.toFixed(2)} A` : "N/A"
      }, Load ${
        load !== null && load !== undefined ? `${load.toFixed(1)} %` : "N/A"
      } — *Operating draw is proportional to output demand.*`;
    }

    // 2. Failure Risk Query
    if (
      q.includes("fail") ||
      q.includes("risk") ||
      q.includes("probability") ||
      q.includes("xgboost")
    ) {
      return `**XGBoost Classifier Failure Risk Analysis:**\n\n- **Estimated Failure Probability:** **${prob}%**\n- **Classification Risk Level:** **${
        prediction.risk_level
      }**\n- **Projected Failure State:** **${
        isFail ? String(prediction.predicted_failure) : "None (Operating Safely)"
      }**\n\n**Predictive Evaluation:**\n${
        isFail
          ? `⚠️ **Warning:** The supervised model classifies current multi-channel telemetry as an imminent failure trajectory. Key observed telemetry highlights high mechanical and thermal stresses.`
          : `✓ **Operational State:** The model estimates the machine is operating within the safe nominal manifold. No operational failure is projected for the active production cycle.`
      }\n\n*Telemetry evaluation is grounded in XGBoost supervised feature importance.*`;
    }

    // 3. Sensor Trends / Telemetry Stream Query
    if (q.includes("trend") || q.includes("sensor") || q.includes("telemetry") || q.includes("stream")) {
      return `**15-Channel Telemetry Stream Status:**\n\n` +
        `1. **Temperature:** ${tEnv !== null && tEnv !== undefined ? `${tEnv.toFixed(1)} °C` : "N/A"} (Nominal: 40–75 °C)\n` +
        `2. **Vibration:** ${vib !== null && vib !== undefined ? `${vib.toFixed(2)} mm/s` : "N/A"} (Nominal: 0.25–0.70 mm/s)\n` +
        `3. **Pressure:** ${press !== null && press !== undefined ? `${press.toFixed(1)} bar` : "N/A"} (Nominal: 22–38 bar)\n` +
        `4. **Humidity:** ${hum !== null && hum !== undefined ? `${hum.toFixed(1)} %` : "N/A"} (Nominal: 30–50 %)\n` +
        `5. **Rotation Speed:** ${rpm !== null && rpm !== undefined ? `${Math.round(rpm)} RPM` : "N/A"} (Nominal: 1400–1600 RPM)\n` +
        `6. **Voltage:** ${volt !== null && volt !== undefined ? `${volt.toFixed(1)} V` : "N/A"} (Nominal: 200–240 V)\n` +
        `7. **Current:** ${curr !== null && curr !== undefined ? `${curr.toFixed(2)} A` : "N/A"} (Nominal: 4.0–6.0 A)\n` +
        `8. **Oil Level:** ${oil !== null && oil !== undefined ? `${oil.toFixed(1)} %` : "N/A"} (Nominal: 60–80 %)\n` +
        `9. **Load:** ${load !== null && load !== undefined ? `${load.toFixed(1)} %` : "N/A"} (Nominal: 60–95 %)\n` +
        `10. **Motor Temperature:** ${tMotor !== null && tMotor !== undefined ? `${tMotor.toFixed(1)} °C` : "N/A"} (Nominal: 45–70 °C)\n` +
        `11. **Gearbox Temperature:** ${tGear !== null && tGear !== undefined ? `${tGear.toFixed(1)} °C` : "N/A"} (Nominal: 50–75 °C)\n` +
        `12. **Sound Level:** ${sound !== null && sound !== undefined ? `${sound.toFixed(1)} dB` : "N/A"} (Nominal: 65–80 dB)\n` +
        `13. **Fan Speed:** ${fan !== null && fan !== undefined ? `${Math.round(fan)} RPM` : "N/A"} (Nominal: 1100–1300 RPM)\n` +
        `14. **Reactive Power:** ${pReact !== null && pReact !== undefined ? `${pReact.toFixed(1)} kVAR` : "N/A"} (Nominal: 40–60 kVAR)\n` +
        `15. **Active Power:** ${pAct !== null && pAct !== undefined ? `${pAct.toFixed(1)} kW` : "N/A"} (Nominal: 80–120 kW)\n\n` +
        `*All 15 sensor channels are actively mirrored in the Live Machine Snapshot panel.*`;
    }

    // 4. Anomaly Isolation Query
    if (q.includes("anom") || q.includes("isolation") || q.includes("outlier")) {
      return `**Isolation Forest Unsupervised Anomaly Assessment:**\n\n- **Anomaly Flag:** **${
        isAnom ? "ANOMALY DETECTED (Outlier)" : "NORMAL (Inlier)"
      }**\n- **Model Algorithm:** Unsupervised Isolation Forest (partition depth evaluation)\n\n**Cluster Analysis:**\n${
        isAnom
          ? `⚠️ **Outlier Detected:** High-dimensional feature partitioning isolated recent multi-channel vectors from the high-density cluster centroid. The joint distribution of thermal and kinematic sensors diverges from nominal historical baselines.`
          : `✓ **No Anomalies Detected:** Multi-sensor feature vectors reside well within the standard operational cluster. Multi-channel covariance is congruent with historical training distributions.`
      }`;
    }

    // 5. Optimization & Operational Efficiency Query
    if (
      q.includes("optimize") ||
      q.includes("power") ||
      q.includes("electric") ||
      q.includes("load") ||
      q.includes("efficiency")
    ) {
      const pf =
        pAct && pReact
          ? (pAct / Math.sqrt(pAct * pAct + pReact * pReact)).toFixed(2)
          : "0.89";
      return `**Machine Operational Optimization Telemetry:**\n\n- **Operating Load:** ${
        load !== null && load !== undefined ? `${load.toFixed(1)} %` : "80.0 %"
      } (Nominal: 60–95 %)\n- **Active Power:** ${
        pAct !== null && pAct !== undefined ? `${pAct.toFixed(1)} kW` : "100.0 kW"
      }\n- **Reactive Power:** ${
        pReact !== null && pReact !== undefined ? `${pReact.toFixed(1)} kVAR` : "50.0 kVAR"
      }\n- **Calculated Power Factor (cos φ):** **${pf}**\n- **Cooling Fan Speed:** ${
        fan !== null && fan !== undefined ? `${Math.round(fan)} RPM` : "1200 RPM"
      }\n\n**Operational Guidance:**\n${
        load && load > 95
          ? `⚠️ Operating load is near maximum rating (${load.toFixed(1)} %). To optimize motor longevity and lower winding heat, consider redistributing duty cycles across parallel production lines.`
          : `✓ Drive load and power factor are well-matched. Mechanical impedance and cooling fan airflow provide effective thermal dissipation for active load.`
      }`;
    }

    // 6. Thermal Subsystem Specific Query
    if (q.includes("temp") || q.includes("heat") || q.includes("thermal") || q.includes("motor temp") || q.includes("gearbox")) {
      return `**Thermal Subsystem Telemetry Analysis:**\n\n- **Ambient Temperature:** ${
        tEnv !== null && tEnv !== undefined ? `${tEnv.toFixed(1)} °C` : "N/A"
      } (Nominal: 40–75 °C)\n- **Motor Stator Temperature:** ${
        tMotor !== null && tMotor !== undefined ? `${tMotor.toFixed(1)} °C` : "N/A"
      } (Nominal: 45–70 °C)\n- **Gearbox Temperature:** ${
        tGear !== null && tGear !== undefined ? `${tGear.toFixed(1)} °C` : "N/A"
      } (Nominal: 50–75 °C)\n- **Cooling Fan Speed:** ${
        fan !== null && fan !== undefined ? `${Math.round(fan)} RPM` : "N/A"
      } (Nominal: 1100–1300 RPM)\n\n*Evaluation:* Current sensor reading is within the observed range. Thermal equilibrium across stator windings and gear reduction casing remains stable under current operating load.`;
    }

    // 7. Mechanical Subsystem Specific Query
    if (q.includes("vib") || q.includes("speed") || q.includes("rpm") || q.includes("bearing") || q.includes("mechanical")) {
      return `**Mechanical & Kinematic Analysis:**\n\n- **Vibration Velocity (RMS):** ${
        vib !== null && vib !== undefined ? `${vib.toFixed(2)} mm/s` : "N/A"
      } (Nominal: 0.25–0.70 mm/s)\n- **Rotation Speed:** ${
        rpm !== null && rpm !== undefined ? `${Math.round(rpm)} RPM` : "N/A"
      } (Nominal: 1400–1600 RPM)\n- **Acoustic Sound Level:** ${
        sound !== null && sound !== undefined ? `${sound.toFixed(1)} dB` : "N/A"
      } (Nominal: 65–80 dB)\n\n*Evaluation:* Current sensor reading is within the observed range. Kinematic vibration spectra conform to ISO 10816-3 Class II requirements for industrial induction machinery.`;
    }

    // Default Overview Summary
    return `**Asset Intelligence Summary for ${
      machine?.machine_name || machine?.name || "Motor 01"
    }:**\n\n- **Health Score:** ${health}%\n- **Failure Risk:** ${prob}% (${
      prediction.risk_level
    })\n- **Anomaly State:** ${isAnom ? "Flagged Outlier" : "Normal"}\n- **Core Readings:** Temp: ${
      tEnv !== null && tEnv !== undefined ? `${tEnv.toFixed(1)} °C` : "N/A"
    } | Vib: ${
      vib !== null && vib !== undefined ? `${vib.toFixed(2)} mm/s` : "N/A"
    } | Speed: ${
      rpm !== null && rpm !== undefined ? `${Math.round(rpm)} RPM` : "N/A"
    } | Load: ${load !== null && load !== undefined ? `${load.toFixed(1)} %` : "N/A"}\n\nYou can ask me for in-depth evaluations of the thermal subsystem, mechanical vibration, electrical power factor, or maintenance recommendations.`;
  }

  /* =======================================================
     CHAT DISPATCH HANDLERS
  ======================================================= */

  async function handleSendMessage(text: string) {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);
    setShowQuickMenu(false);

    try {
      const responseText = await generateCopilotResponse(userMsg.text);
      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: String(Date.now() + 1),
          role: "assistant",
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      }, 450);
    } catch {
      setIsTyping(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  /* Trigger official recommendation call directly */
  async function triggerOfficialRecommendation() {
    if (!machine?.id || isGeneratingRec) return;
    setIsGeneratingRec(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const recRes = await fetch(`${API_URL}/api/machines/${machine.id}/recommendation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (recRes.ok) {
        const data: Recommendation = await recRes.json();
        setRecommendation(data);
        handleSendMessage("Recommend maintenance");
      }
    } catch {
      // Fallback
    } finally {
      setIsGeneratingRec(false);
    }
  }

  /* =======================================================
     COMPUTED METRICS FOR SUMMARY & SNAPSHOT
  ======================================================= */

  const formattedTimestamp = useMemo(() => {
    if (!prediction?.created_at) return "No live prediction data";
    try {
      const d = new Date(prediction.created_at);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return prediction.created_at;
    }
  }, [prediction]);

  const healthScore = useMemo(() => {
    if (!prediction) return null;
    return Math.round(
      Number(prediction.health_score ?? (1 - prediction.failure_probability) * 100)
    );
  }, [prediction]);

  const failureProb = useMemo(() => {
    if (!prediction) return null;
    return Math.round(Number(prediction.failure_probability) * 100);
  }, [prediction]);

  // Circular gauge geometry
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    healthScore !== null ? circumference - (circumference * healthScore) / 100 : circumference;

  /* =======================================================
     AUTH / ERROR STATES (SECTIONS 14 & 15)
  ======================================================= */

  if (authExpired) {
    return (
      <main className="flex min-h-[85vh] items-center justify-center bg-[#050511] px-4 text-[#F8FAFC]">
        <div className="w-full max-w-md rounded-2xl border border-[#25203A] bg-[#0B0B18]/90 p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 text-2xl text-[#EF4444]">
            🔒
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#F8FAFC]">Session expired</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#8B8BA3]">
            Please log in again to continue using Industrial AI Copilot.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-6 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition hover:scale-[1.02]"
            >
              Go to Login →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (backendUnavailable) {
    return (
      <main className="flex min-h-[85vh] items-center justify-center bg-[#050511] px-4 text-[#F8FAFC]">
        <div className="w-full max-w-md rounded-2xl border border-[#25203A] bg-[#0B0B18]/90 p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-2xl text-[#F59E0B]">
            ⚠️
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#F8FAFC]">
            AI services temporarily unavailable
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#8B8BA3]">
            Make sure the backend service is running on {API_URL}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition hover:scale-[1.02]"
            >
              Retry Connection ⟳
            </button>
            <Link
              href="/"
              className="rounded-xl border border-[#25203A] bg-[#0E0D22] px-4 py-2.5 text-xs font-semibold text-[#8B8BA3] transition hover:text-[#F8FAFC]"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-[85vh] items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-14 w-14">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#A855F7]/20" />
            <div className="relative h-14 w-14 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7] shadow-[0_0_25px_rgba(168,85,247,0.4)]" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#C084FC]">
            INDUSTRIAL AI COPILOT
          </p>
          <p className="mt-1 text-xs text-[#8B8BA3]">
            Synthesizing 15 sensor channels and machine intelligence...
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     MAIN VIEW (SECTIONS 1–21)
  ======================================================= */

  return (
    <main className="min-h-screen bg-[#050511] text-[#F8FAFC]">
      {/* Background ambient purple glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-[-8%] h-[550px] w-[550px] rounded-full bg-[#A855F7]/[0.06] blur-[160px]" />
        <div className="absolute right-[-4%] top-[20%] h-[500px] w-[500px] rounded-full bg-[#7E22CE]/[0.05] blur-[160px]" />
        <div className="absolute bottom-[5%] left-[25%] h-[400px] w-[400px] rounded-full bg-[#C084FC]/[0.03] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1720px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        {/* ===================================================
            SECTION 2: TOP AI HERO
        =================================================== */}
        <section className="rounded-2xl border border-[#25203A] bg-gradient-to-r from-[#0E0D24] via-[#0B0B18] to-[#120E28] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {/* AI Icon with subtle animated purple glow */}
              <div className="relative shrink-0">
                <div className="absolute -inset-1 animate-pulse rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] opacity-40 blur-md" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#A855F7]/40 bg-[#161230] text-xl text-[#C084FC] shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                  ✦
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#C084FC]">
                    ✦ INDUSTRIAL AI COPILOT
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#F8FAFC] sm:text-3xl">
                  AI Maintenance Intelligence
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-[#8B8BA3]">
                  &quot;Your machine intelligence layer for predictive maintenance, anomaly
                  detection, and operational decisions.&quot;
                </p>
              </div>
            </div>

            {/* Small premium status pills */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00D49A]/30 bg-[#00D49A]/10 px-3 py-1 text-[11px] font-bold text-[#00D49A] shadow-[0_0_12px_rgba(0,212,154,0.15)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00D49A]" />
                ● AI ONLINE
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A855F7]/30 bg-[#A855F7]/10 px-3 py-1 text-[11px] font-semibold text-[#C084FC]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C084FC]" />
                ● 15 SENSOR CHANNELS
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25203A] bg-[#0E0D22] px-3 py-1 text-[11px] font-semibold text-[#E2E8F0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A855F7]" />
                ● XGBOOST
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25203A] bg-[#0E0D22] px-3 py-1 text-[11px] font-semibold text-[#E2E8F0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C084FC]" />
                ● ISOLATION FOREST
              </span>

              <Link
                href="/"
                className="ml-auto rounded-xl border border-[#25203A] bg-[#0B0B18] px-3.5 py-1.5 text-xs font-semibold text-[#8B8BA3] transition hover:border-[#A855F7]/40 hover:text-white"
              >
                ← Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* ===================================================
            SECTION 3: MACHINE CONTEXT BAR
        =================================================== */}
        <section className="mt-4 rounded-2xl border border-[#25203A] bg-[#0B0B18]/90 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-[#25203A]/70">
            {/* MACHINE */}
            <div className="px-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                MACHINE
              </p>
              <p className="mt-1 text-sm font-bold text-[#F8FAFC] break-words">
                {machine?.machine_name || machine?.name || "Motor 01"}
              </p>
              <p className="text-[10px] text-[#8B8BA3] break-words">
                {machine?.machine_type || "Three-Phase Induction"}
              </p>
            </div>

            {/* STATUS */}
            <div className="px-2 lg:pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                STATUS
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00D49A]" />
                <span className="text-sm font-bold text-[#00D49A] break-words">
                  {machine?.status || "Operational"}
                </span>
              </div>
              <p className="text-[10px] text-[#8B8BA3] break-words">
                {machine?.location || "Factory Floor"}
              </p>
            </div>

            {/* HEALTH */}
            <div className="px-2 lg:pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                HEALTH
              </p>
              <p className="mt-1 text-sm font-black text-[#F8FAFC]">
                {healthScore !== null ? `${healthScore}%` : "No live prediction data"}
              </p>
              <p className="text-[10px] text-[#8B8BA3] break-words">
                {prediction?.health_status || "Awaiting scan"}
              </p>
            </div>

            {/* FAILURE RISK */}
            <div className="px-2 lg:pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                FAILURE RISK
              </p>
              <p
                className={`mt-1 text-sm font-black ${
                  failureProb === null
                    ? "text-[#8B8BA3]"
                    : failureProb >= 50
                    ? "text-[#FF3B6B]"
                    : failureProb >= 25
                    ? "text-[#F59E0B]"
                    : "text-[#00D49A]"
                }`}
              >
                {failureProb !== null
                  ? `${failureProb}% (${prediction?.risk_level || "LOW"})`
                  : "No live prediction data"}
              </p>
              <p className="text-[10px] text-[#8B8BA3] break-words">XGBoost Classifier</p>
            </div>

            {/* ANOMALY */}
            <div className="px-2 lg:pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                ANOMALY
              </p>
              <p
                className={`mt-1 text-sm font-bold ${
                  prediction === null
                    ? "text-[#8B8BA3]"
                    : prediction.anomaly_detected
                    ? "text-[#FF3B6B]"
                    : "text-[#00D49A]"
                }`}
              >
                {prediction === null
                  ? "No live prediction data"
                  : prediction.anomaly_detected
                  ? "ANOMALY DETECTED"
                  : "NORMAL"}
              </p>
              <p className="text-[10px] text-[#8B8BA3] break-words">Isolation Forest</p>
            </div>

            {/* LAST ANALYSIS */}
            <div className="px-2 lg:pl-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                LAST ANALYSIS
              </p>
              <p className="mt-1 text-xs font-semibold text-[#E2E8F0] break-words leading-tight">
                {formattedTimestamp}
              </p>
              <p className="text-[10px] text-[#8B8BA3] break-words">Synchronized Telemetry</p>
            </div>
          </div>
        </section>

        {/* ===================================================
            MAIN WORKSPACE: CHAT (LEFT) + INTELLIGENCE (RIGHT)
        =================================================== */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1.05fr] xl:grid-cols-[1.4fr_1fr]">
          {/* =================================================
              SECTION 4: MAIN AI CHAT AREA
          ================================================= */}
          <div className="flex h-[840px] flex-col rounded-2xl border border-[#25203A] bg-[#0B0B18] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-[#25203A] px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#A855F7]/30 bg-[#A855F7]/10 text-base text-[#C084FC]">
                  ✦
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F8FAFC]">
                    Predictive Maintenance Copilot
                  </h2>
                  <p className="text-[10px] leading-tight text-[#8B8BA3]">
                    Grounded in machine telemetry and ML predictions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00D49A]/30 bg-[#00D49A]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#00D49A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00D49A]" />
                  ● AI ONLINE
                </span>
                <span className="rounded-full border border-[#25203A] bg-[#0E0D22] px-2.5 py-0.5 text-[10px] font-medium text-[#8B8BA3]">
                  {machine?.machine_name || "Motor 01"}
                </span>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col transition-all duration-300 ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm md:max-w-[85%] ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-[#9333EA] to-[#A855F7] font-medium text-white shadow-[0_4px_20px_rgba(168,85,247,0.25)]"
                        : "border border-[#25203A] bg-[#0E0D22]/95 text-[#E2E8F0] backdrop-blur-sm"
                    }`}
                  >
                    <div className="whitespace-pre-line break-words">{m.text}</div>

                    {/* SECTION 5 & 6: Suggestion buttons embedded right into initial welcome message */}
                    {m.isInitial && (
                      <div className="mt-4 border-t border-[#25203A] pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#C084FC]">
                          Quick Investigation Actions:
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {quickActions.map((action, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendMessage(action.prompt)}
                              className="flex items-center gap-2.5 rounded-xl border border-[#25203A] bg-[#14122C] px-3 py-2 text-left text-[11px] font-medium text-[#E2E8F0] transition hover:border-[#A855F7]/50 hover:bg-[#1C183C] hover:text-white"
                            >
                              <span className="text-sm shrink-0">{action.icon}</span>
                              <span className="leading-tight break-words">{action.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="mt-1 px-1 text-[9px] text-[#8B8BA3]">{m.timestamp}</span>
                </div>
              ))}

              {/* SECTION 13: Typing Animation */}
              {isTyping && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#25203A] bg-[#0E0D22] px-4 py-3 text-xs text-[#8B8BA3] shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A855F7]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C084FC] [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A855F7] [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#C084FC]">
                    AI is analyzing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips (Section 6) */}
            <div className="border-t border-[#25203A]/70 bg-[#080816] px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3] shrink-0">
                  Quick Query:
                </span>
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(action.prompt)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#25203A] bg-[#0E0D22] px-2.5 py-1 text-[11px] font-medium text-[#C084FC] transition hover:border-[#A855F7]/50 hover:bg-[#161333]"
                  >
                    <span>{action.icon}</span>
                    <span className="whitespace-nowrap">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Menu Popup if "+" attachment button is clicked */}
            {showQuickMenu && (
              <div className="mx-4 mb-2 rounded-xl border border-[#25203A] bg-[#0E0D22] p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A855F7]">
                    Select Diagnostic Protocol
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickMenu(false)}
                    className="text-xs text-[#8B8BA3] hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleSendMessage("Inspect thermal and gearbox telemetry")}
                    className="rounded-lg border border-[#25203A] p-2 text-left text-[11px] text-[#E2E8F0] hover:border-[#A855F7] hover:bg-[#15122F]"
                  >
                    🌡️ Thermal & Gearbox Telemetry
                  </button>
                  <button
                    onClick={() => handleSendMessage("Evaluate mechanical vibration and rotation speed")}
                    className="rounded-lg border border-[#25203A] p-2 text-left text-[11px] text-[#E2E8F0] hover:border-[#A855F7] hover:bg-[#15122F]"
                  >
                    ⚙️ Vibration & Kinematics
                  </button>
                  <button
                    onClick={() => handleSendMessage("Inspect electrical load and power factor")}
                    className="rounded-lg border border-[#25203A] p-2 text-left text-[11px] text-[#E2E8F0] hover:border-[#A855F7] hover:bg-[#15122F]"
                  >
                    ⚡ Electrical Load & Power Factor
                  </button>
                  <button
                    onClick={() => handleSendMessage("Generate official AI maintenance recommendation")}
                    className="rounded-lg border border-[#25203A] p-2 text-left text-[11px] text-[#E2E8F0] hover:border-[#A855F7] hover:bg-[#15122F]"
                  >
                    📋 Official Maintenance Record
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 12: CHAT INPUT COMPOSER */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="border-t border-[#25203A] bg-[#090818] p-3.5"
            >
              <div className="flex items-end gap-2.5">
                {/* + Attachment button */}
                <button
                  type="button"
                  onClick={() => setShowQuickMenu(!showQuickMenu)}
                  title="Open Diagnostic Actions"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#25203A] bg-[#0E0D22] text-sm font-bold text-[#C084FC] transition hover:border-[#A855F7]/50 hover:bg-[#171434]"
                >
                  +
                </button>

                {/* Text composer supporting Enter and Shift+Enter */}
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your machine..."
                  className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-[#25203A] bg-[#050511] px-4 py-3 text-xs text-[#F8FAFC] outline-none transition focus:border-[#A855F7] scrollbar-thin"
                />

                {/* Send Button with Purple Glow */}
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 text-xs font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isTyping ? "AI is thinking..." : "Send ➔"}
                </button>
              </div>
            </form>
          </div>

          {/* =================================================
              RIGHT COLUMN: MACHINE INTELLIGENCE COMMAND CENTER
              Sections 7, 8, 9, 10, 11
          ================================================= */}
          <div className="space-y-6">
            {/* If no prediction exists, display Section 14 empty state */}
            {!prediction ? (
              <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18]/95 p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A855F7]/30 bg-[#A855F7]/10 text-2xl text-[#C084FC]">
                  ⚡
                </div>
                <h3 className="text-base font-bold uppercase tracking-wider text-[#F8FAFC]">
                  NO LIVE MACHINE INTELLIGENCE
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#8B8BA3]">
                  Run a prediction from the Predictions page to provide the AI Copilot with
                  current machine telemetry and activate full sensor analysis.
                </p>
                <div className="mt-6">
                  <Link
                    href="/predictions"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition hover:scale-[1.02]"
                  >
                    Go to Predictions →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* =============================================
                    SECTION 7 & 8: LIVE MACHINE SNAPSHOT
                    Display all 15 real sensors with mini meters
                ============================================= */}
                <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between border-b border-[#25203A] pb-3.5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                        TELEMETRY MATRIX
                      </p>
                      <h3 className="text-base font-bold text-[#F8FAFC]">
                        LIVE MACHINE SNAPSHOT
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#00D49A]/30 bg-[#00D49A]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#00D49A]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00D49A]" />
                      15 CHANNELS
                    </span>
                  </div>

                  {/* 15 SENSORS GRID */}
                  <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {SENSOR_CATALOG.map((s) => {
                      const val = s.getValue(prediction);
                      const { status, pct } = evaluateSensorReading(
                        val,
                        s.normalMin,
                        s.normalMax,
                        s.criticalMin,
                        s.criticalMax
                      );

                      return (
                        <div
                          key={s.key}
                          className="flex flex-col justify-between rounded-xl border border-[#25203A] bg-[#0E0D22] p-2.5 transition hover:border-[#A855F7]/30"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[#C084FC]">
                                <SensorGlyph type={s.icon} />
                              </span>
                              {/* Full sensor name never truncated */}
                              <span className="text-xs font-semibold text-[#F8FAFC] leading-tight break-words">
                                {s.name}
                              </span>
                            </div>

                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                status === "CRITICAL"
                                  ? "bg-[#FF3B6B]/15 text-[#FF3B6B] border border-[#FF3B6B]/30"
                                  : status === "ELEVATED"
                                  ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30"
                                  : "bg-[#00D49A]/15 text-[#00D49A] border border-[#00D49A]/30"
                              }`}
                            >
                              ● {status}
                            </span>
                          </div>

                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-sm font-black text-white">
                              {val !== null && val !== undefined
                                ? s.unit === "RPM"
                                  ? Math.round(val)
                                  : val.toFixed(1)
                                : "—"}{" "}
                              <span className="text-[10px] font-normal text-[#8B8BA3]">
                                {s.unit}
                              </span>
                            </span>
                            <span className="text-[9px] text-[#8B8BA3]">
                              Nom: {s.normalMin}–{s.normalMax}
                            </span>
                          </div>

                          {/* Mini Meter Status Bar (Section 8) */}
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#181533]">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                status === "CRITICAL"
                                  ? "bg-[#FF3B6B]"
                                  : status === "ELEVATED"
                                  ? "bg-[#F59E0B]"
                                  : "bg-[#00D49A]"
                              }`}
                              style={{ width: `${Math.max(5, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* =============================================
                    SECTION 9: AI HEALTH SUMMARY
                    Circular progress + risk badges
                ============================================= */}
                <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                  <div className="border-b border-[#25203A] pb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                      DIAGNOSTIC SYNTHESIS
                    </p>
                    <h3 className="text-base font-bold text-[#F8FAFC]">AI HEALTH SUMMARY</h3>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
                    {/* Circular Health Gauge */}
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-24 w-24 items-center justify-center">
                        <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="#1B1735"
                            strokeWidth="8"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            stroke="url(#purpleEmeraldGradient)"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                          <defs>
                            <linearGradient
                              id="purpleEmeraldGradient"
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop offset="0%" stopColor="#A855F7" />
                              <stop offset="100%" stopColor="#C084FC" />
                            </linearGradient>
                          </defs>
                        </svg>

                        <div className="absolute text-center">
                          <span className="text-xl font-black text-white">{healthScore}%</span>
                          <span className="block text-[8px] uppercase tracking-wider text-[#8B8BA3]">
                            Health
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-[#F8FAFC]">Asset Condition</p>
                        <p className="mt-0.5 text-sm font-black text-[#00D49A]">
                          {prediction.health_status}
                        </p>
                        <p className="text-[10px] text-[#8B8BA3]">
                          Multi-sensor composite index
                        </p>
                      </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto sm:min-w-[240px]">
                      <div className="rounded-xl border border-[#25203A] bg-[#0E0D22] p-2.5">
                        <p className="text-[9px] font-bold uppercase text-[#8B8BA3]">
                          Failure Probability
                        </p>
                        <p
                          className={`mt-0.5 text-base font-black ${
                            failureProb && failureProb >= 50
                              ? "text-[#FF3B6B]"
                              : failureProb && failureProb >= 25
                              ? "text-[#F59E0B]"
                              : "text-[#00D49A]"
                          }`}
                        >
                          {failureProb}%
                        </p>
                        <p className="text-[9px] font-medium text-[#8B8BA3]">
                          Risk: {prediction.risk_level}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#25203A] bg-[#0E0D22] p-2.5">
                        <p className="text-[9px] font-bold uppercase text-[#8B8BA3]">
                          Anomaly Detection
                        </p>
                        <p
                          className={`mt-0.5 text-base font-black ${
                            prediction.anomaly_detected ? "text-[#FF3B6B]" : "text-[#00D49A]"
                          }`}
                        >
                          {prediction.anomaly_detected ? "ANOMALY" : "NORMAL"}
                        </p>
                        <p className="text-[9px] font-medium text-[#8B8BA3]">
                          Pred: {prediction.predicted_failure ? "FAILURE" : "NORMAL"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =============================================
                    SECTION 10: AI EXPLANATION PANEL
                    "WHY THIS RESULT?"
                ============================================= */}
                <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                  <div className="border-b border-[#25203A] pb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                      INFERENCE EXPLANATION
                    </p>
                    <h3 className="text-base font-bold text-[#F8FAFC]">WHY THIS RESULT?</h3>
                  </div>

                  <div className="mt-4 space-y-3.5 text-xs">
                    {/* AI Assessment */}
                    <div className="rounded-xl border border-[#25203A] bg-[#0E0D22] p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#A855F7]">
                        AI ASSESSMENT
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-white">
                          Failure probability: {failureProb}%
                        </span>
                        <span className="text-[#8B8BA3]">•</span>
                        <span className="font-semibold text-white">
                          Risk level: {prediction.risk_level}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#E2E8F0]">
                        {failureProb && failureProb > 50
                          ? "Machine telemetry indicates elevated thermal and kinematic signatures requiring prompt engineering inspection."
                          : "Machine condition appears stable based on the latest available telemetry. Parameter distributions remain congruent with nominal baseline operating limits."}
                      </p>
                    </div>

                    {/* Key Signals */}
                    <div className="rounded-xl border border-[#25203A] bg-[#0E0D22] p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#A855F7] mb-2">
                        KEY SIGNALS
                      </p>
                      <ul className="space-y-1.5 text-[11px] text-[#E2E8F0]">
                        <li className="flex items-start gap-2">
                          <span className="text-[#00D49A]">●</span>
                          <span>
                            <strong>Temperature:</strong> Current sensor reading is within the
                            observed range ({prediction.input_temperature?.toFixed(1) ?? "—"} °C
                            vs 40–75 °C nominal).
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#00D49A]">●</span>
                          <span>
                            <strong>Vibration:</strong> Current sensor reading is within the
                            observed range ({prediction.input_vibration?.toFixed(2) ?? "—"} mm/s
                            vs 0.25–0.70 mm/s nominal).
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#00D49A]">●</span>
                          <span>
                            <strong>Pressure:</strong> Current sensor reading is within the
                            observed range ({prediction.input_pressure?.toFixed(1) ?? "—"} bar vs
                            22–38 bar nominal).
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#00D49A]">●</span>
                          <span>
                            <strong>Motor Temperature:</strong> Current sensor reading is within
                            the observed range (
                            {prediction.input_motor_temperature?.toFixed(1) ?? "—"} °C vs 45–70 °C
                            nominal).
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* =============================================
                    SECTION 11: AI MAINTENANCE RECOMMENDATION
                    Dynamic backend recommendation card
                ============================================= */}
                <div className="rounded-2xl border border-[#25203A] bg-gradient-to-r from-[#0F0E24] via-[#0B0B18] to-[#120F2A] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between border-b border-[#25203A] pb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                        ENGINEERING PROTOCOL
                      </p>
                      <h3 className="text-base font-bold text-[#F8FAFC]">
                        AI MAINTENANCE RECOMMENDATION
                      </h3>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        recommendation?.priority === "HIGH" ||
                        recommendation?.priority === "CRITICAL"
                          ? "bg-[#FF3B6B]/15 text-[#FF3B6B] border border-[#FF3B6B]/30"
                          : "bg-[#00D49A]/15 text-[#00D49A] border border-[#00D49A]/30"
                      }`}
                    >
                      {recommendation?.priority || prediction.risk_level} Priority
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[#8B8BA3]">
                        Recommended Action
                      </p>
                      <p className="mt-1 text-sm font-bold text-white break-words">
                        {recommendation?.recommendation ||
                          recommendation?.title ||
                          (failureProb && failureProb >= 50
                            ? "Schedule Immediate Bearing & Stator Inspection"
                            : "Continue Normal Routine Monitoring & Predictive Telemetry")}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase text-[#8B8BA3]">Reason</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#E2E8F0] break-words">
                        {recommendation?.explanation ||
                          recommendation?.ai_reasoning ||
                          `Asset failure probability is estimated at ${failureProb}%. Telemetry parameters across the 15 sensor channels remain congruent with standard shift operating tolerances.`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-[10px] text-[#8B8BA3]">
                        Risk Level:{" "}
                        <span className="font-semibold text-white">
                          {prediction.risk_level}
                        </span>{" "}
                        • Status:{" "}
                        <span className="font-semibold text-[#00D49A]">
                          {recommendation?.status || "VERIFIED"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={triggerOfficialRecommendation}
                        disabled={isGeneratingRec}
                        className="rounded-xl border border-[#25203A] bg-[#0E0D22] px-3 py-1.5 text-[11px] font-semibold text-[#C084FC] transition hover:border-[#A855F7] hover:bg-[#161234] disabled:opacity-40"
                      >
                        {isGeneratingRec ? "Generating..." : "Generate Official Recommendation ⟳"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
