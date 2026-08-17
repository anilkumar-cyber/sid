import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.constants import PostVisibility
from app.models.feed import Post, PostComment, PostLike, PostReport, PostSave
from app.models.user import User


def feed_query_for_user(db: Session, current_user: User):
    query = select(Post).where(Post.deleted_at.is_(None), Post.is_removed.is_(False))
    visible = [
        Post.visibility == PostVisibility.ACADEMY,
    ]
    if current_user.home_branch_id:
        visible.append((Post.visibility == PostVisibility.BRANCH) & (Post.branch_id == current_user.home_branch_id))
    visible.append(Post.author_id == current_user.id)
    return query.where(or_(*visible)).order_by(Post.created_at.desc())


def get_post(db: Session, post_id: uuid.UUID) -> Post | None:
    return db.get(Post, post_id)


def like_count(db: Session, post_id: uuid.UUID) -> int:
    return db.execute(select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)).scalar_one()


def comment_count(db: Session, post_id: uuid.UUID) -> int:
    return db.execute(select(func.count()).select_from(PostComment).where(PostComment.post_id == post_id, PostComment.deleted_at.is_(None))).scalar_one()


def is_liked_by(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return db.execute(select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id)).scalar_one_or_none() is not None


def is_saved_by(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return db.execute(select(PostSave).where(PostSave.post_id == post_id, PostSave.user_id == user_id)).scalar_one_or_none() is not None


def list_comments(db: Session, post_id: uuid.UUID):
    return db.execute(
        select(PostComment).where(PostComment.post_id == post_id, PostComment.deleted_at.is_(None)).order_by(PostComment.created_at)
    ).scalars().all()


def list_reports(db: Session, status: str | None = None):
    query = select(PostReport)
    if status:
        query = query.where(PostReport.status == status)
    return db.execute(query.order_by(PostReport.created_at.desc())).scalars().all()


def get_report(db: Session, report_id: uuid.UUID) -> PostReport | None:
    return db.get(PostReport, report_id)
