"""add person_characters alias table

Revision ID: 0002_person_characters
Revises: 0001_baseline
Create Date: 2026-07-27 12:59:44.632872
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0002_person_characters'
down_revision: str | None = '0001_baseline'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('person_characters',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_voice_id', sa.Integer(), nullable=False),
    sa.Column('character_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['project_voice_id'], ['project_voices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('project_voice_id', 'character_id')
    )
    # Preserve any existing single Person->Character link as an alias in that
    # Character's own world context before the old column is dropped.
    op.execute(
        "INSERT INTO person_characters (project_voice_id, character_id, created_at) "
        "SELECT id, character_id, CURRENT_TIMESTAMP FROM project_voices "
        "WHERE character_id IS NOT NULL"
    )
    with op.batch_alter_table('project_voices', schema=None) as batch_op:
        batch_op.drop_column('character_id')


def downgrade() -> None:
    # Forward-only: recovery from a bad upgrade is restoring the pre-migration
    # backup file, never `alembic downgrade` (see docs/dev/ARCHITECTURE.md).
    raise NotImplementedError("yuu-clip migrations are forward-only")
