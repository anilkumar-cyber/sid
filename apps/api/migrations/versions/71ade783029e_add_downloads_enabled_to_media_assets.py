"""add downloads_enabled to media_assets

Revision ID: 71ade783029e
Revises: 1e78286655a4
Create Date: 2026-08-18 17:16:01.751583

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '71ade783029e'
down_revision: Union[str, None] = '1e78286655a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('media_assets', sa.Column('downloads_enabled', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('media_assets', 'downloads_enabled', server_default=None)


def downgrade() -> None:
    op.drop_column('media_assets', 'downloads_enabled')
