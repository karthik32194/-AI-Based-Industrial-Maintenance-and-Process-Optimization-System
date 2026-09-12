"""Phase 5 schema change — 15-channel sensor storage + honest prediction contract

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-12

Clean-up the Phase 4 probability/risk-category columns the backend no longer
produces, and store the full 15-variable representation the ML artifacts use.

sensor_readings:
  + humidity, voltage, current, oil_level, load, motor_temperature,
    gearbox_temperature, sound_level, fan_speed, reactive_power

predictions:
  + failure_risk_score   (Float, nullable)   - continuous risk score (NOT a
                                               calibrated probability).
  + risk_flag            (Boolean, nullable) - score >= threshold.
  + ml_status            (String(20), 'VALID') - VALID | UNAVAILABLE (Step 5
                                               HARD: never silently healthy).
  + ml_error             (String(500))       - reason when UNAVAILABLE.
  + input_humidity..input_reactive_power     - 10 additional input snapshot cols.
  - failure_probability, predicted_failure, risk_level, health_status  (removed)
  model_version now nullable (unavailable records carry no version).
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RAW_CHANNELS: list[str] = [
    "humidity", "voltage", "current", "oil_level", "load", "motor_temperature",
    "gearbox_temperature", "sound_level", "fan_speed", "reactive_power",
]


def _add_raw_sensor_cols() -> None:
    for col in RAW_CHANNELS:
        op.add_column("sensor_readings", sa.Column(col, sa.Float(), nullable=True))


def _add_prediction_input_cols() -> None:
    for col in RAW_CHANNELS:
        op.add_column("predictions", sa.Column(f"input_{col}", sa.Float(), nullable=True))


def upgrade() -> None:
    _add_raw_sensor_cols()

    # predictions: add the honest Phase 4 contract columns.
    op.add_column("predictions", sa.Column("failure_risk_score", sa.Float(), nullable=True))
    op.add_column("predictions", sa.Column("risk_flag", sa.Boolean(), nullable=True))
    op.add_column(
        "predictions",
        sa.Column("ml_status", sa.String(20), nullable=False, server_default="VALID"),
    )
    op.add_column("predictions", sa.Column("ml_error", sa.String(500), nullable=True))
    _add_prediction_input_cols()

    # model_version becomes nullable (UNAVAILABLE records carry no version).
    op.alter_column("predictions", "model_version", existing_type=sa.String(40), nullable=True)

    # Remove the old probability/risk-category columns.
    op.drop_column("predictions", "failure_probability")
    op.drop_column("predictions", "predicted_failure")
    op.drop_column("predictions", "risk_level")
    op.drop_column("predictions", "health_status")


def downgrade() -> None:
    # Re-add the old prediction columns (and their enums).
    op.execute(
        "CREATE TYPE risk_level_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')"
    )
    op.execute(
        "CREATE TYPE health_status_enum AS ENUM "
        "('HEALTHY', 'DEGRADED', 'AT_RISK', 'CRITICAL')"
    )
    op.add_column(
        "predictions",
        sa.Column(
            "failure_probability",
            sa.Float(),
            nullable=False,
            server_default="0.0",
        ),
    )
    op.add_column("predictions", sa.Column("predicted_failure", sa.String(120), nullable=True))
    op.add_column(
        "predictions",
        sa.Column(
            "risk_level",
            sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="risk_level_enum"),
            nullable=False,
            server_default="LOW",
        ),
    )
    op.add_column(
        "predictions",
        sa.Column(
            "health_status",
            sa.Enum("HEALTHY", "DEGRADED", "AT_RISK", "CRITICAL", name="health_status_enum"),
            nullable=False,
            server_default="HEALTHY",
        ),
    )
    op.alter_column("predictions", "model_version", existing_type=sa.String(40), nullable=False)

    # Drop the Phase 5 addition.
    for col in RAW_CHANNELS:
        op.drop_column("predictions", f"input_{col}")
    op.drop_column("predictions", "ml_error")
    op.drop_column("predictions", "ml_status")
    op.drop_column("predictions", "risk_flag")
    op.drop_column("predictions", "failure_risk_score")

    for col in RAW_CHANNELS:
        op.drop_column("sensor_readings", col)

    op.execute("DROP TYPE IF EXISTS risk_level_enum")
    op.execute("DROP TYPE IF EXISTS health_status_enum")