"""add speaker identity_override column

Revision ID: 0003_speaker_identity_override
Revises: 0002_person_characters
Create Date: 2026-07-27 18:23:22.425116
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0003_speaker_identity_override'
down_revision: str | None = '0002_person_characters'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('speakers', schema=None) as batch_op:
        # server_default backfills every existing row (SQLite requires a default to add
        # a NOT NULL column to a non-empty table); dropped after so future INSERTs rely
        # on the ORM-level Python default like every other such column in this schema.
        batch_op.add_column(sa.Column(
            'identity_override', sa.Boolean(), nullable=False, server_default=sa.false()))
    with op.batch_alter_table('speakers', schema=None) as batch_op:
        batch_op.alter_column('identity_override', server_default=None)


def downgrade() -> None:
    # Forward-only: recovery from a bad upgrade is restoring the pre-migration
    # backup file, never `alembic downgrade` (see docs/dev/ARCHITECTURE.md).
    raise NotImplementedError("yuu-clip migrations are forward-only")
