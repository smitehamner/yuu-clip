"""add clip dismissed_duplicate_ids column

Revision ID: 0004_dismissed_duplicates
Revises: 0003_speaker_identity_override
Create Date: 2026-07-28 20:54:09.744697
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0004_dismissed_duplicates'
down_revision: str | None = '0003_speaker_identity_override'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Autogenerate also proposed tightening score_visual to NOT NULL (pre-existing
    # drift between this dev DB and the model, unrelated to this column) - left out
    # deliberately; that's a separate change to make on purpose, not a side effect
    # of adding an unrelated column.
    with op.batch_alter_table('clip_candidates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('dismissed_duplicate_ids_json', sa.Text(), nullable=True))


def downgrade() -> None:
    # Forward-only: recovery from a bad upgrade is restoring the pre-migration
    # backup file, never `alembic downgrade` (see docs/dev/ARCHITECTURE.md).
    raise NotImplementedError("yuu-clip migrations are forward-only")
