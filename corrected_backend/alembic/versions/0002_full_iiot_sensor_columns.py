
"""Add the remaining IIoT sensor channels used by the ML dataset."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SENSOR_COLUMNS = [
    "humidity", "rotation_speed", "voltage", "current", "oil_level", "load",
    "motor_temperature", "gearbox_temperature", "sound_level", "fan_speed",
    "reactive_power", "active_power",
]


def upgrade() -> None:
    for column in SENSOR_COLUMNS:
        op.add_column("sensor_readings", sa.Column(column, sa.Float(), nullable=True))
    for column in SENSOR_COLUMNS:
        op.add_column("predictions", sa.Column(f"input_{column}", sa.Float(), nullable=True))
    for column in SENSOR_COLUMNS:
        op.add_column("anomalies", sa.Column(column, sa.Float(), nullable=True))


def downgrade() -> None:
    for column in reversed(SENSOR_COLUMNS):
        op.drop_column("anomalies", column)
    for column in reversed(SENSOR_COLUMNS):
        op.drop_column("predictions", f"input_{column}")
    for column in reversed(SENSOR_COLUMNS):
        op.drop_column("sensor_readings", column)
