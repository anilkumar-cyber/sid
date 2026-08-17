import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import Role
from app.models.feed import Post, PostComment, PostLike, PostMedia, PostReport, PostSave
from app.repositories import feed as repo
from app.utils.storage import generate_thumbnail, save_file, storage_url, validate_upload


def create_post(db: Session, data: dict, files: list[tuple[bytes, str, str]], author_id: uuid.UUID, is_official: bool) -> Post:
    post = Post(**data, author_id=author_id, is_official=is_official)
    db.add(post)
    db.flush()

    for content, mime_type, filename in files:
        is_video = mime_type.startswith("video/")
        try:
            validate_upload(mime_type, len(content), expect_video=is_video)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        key = save_file(content, mime_type, subdir=f"posts/{post.id}")
        thumb = None if is_video else generate_thumbnail(key)
        db.add(PostMedia(post_id=post.id, storage_key=key, thumbnail_key=thumb, media_type="video" if is_video else "photo"))

    db.commit()
    db.refresh(post)
    return post


def post_to_out(db: Session, post: Post, current_user_id: uuid.UUID) -> dict:
    return {
        "id": post.id,
        "author_id": post.author_id,
        "author_name": post.author.full_name if post.author else "",
        "caption": post.caption,
        "visibility": post.visibility,
        "is_official": post.is_official,
        "comments_disabled": post.comments_disabled,
        "like_count": repo.like_count(db, post.id),
        "comment_count": repo.comment_count(db, post.id),
        "liked_by_me": repo.is_liked_by(db, post.id, current_user_id),
        "saved_by_me": repo.is_saved_by(db, post.id, current_user_id),
        "media": [
            {"id": m.id, "url": storage_url(m.storage_key), "thumbnail_url": storage_url(m.thumbnail_key), "media_type": m.media_type}
            for m in post.media
        ],
        "created_at": post.created_at,
    }


def toggle_like(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    existing = db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.user_id == user_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return False
    db.add(PostLike(post_id=post_id, user_id=user_id))
    db.commit()
    return True


def toggle_save(db: Session, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    existing = db.query(PostSave).filter(PostSave.post_id == post_id, PostSave.user_id == user_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return False
    db.add(PostSave(post_id=post_id, user_id=user_id))
    db.commit()
    return True


def add_comment(db: Session, post: Post, author_id: uuid.UUID, body: str) -> PostComment:
    if post.comments_disabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Comments are disabled for this post")
    comment = PostComment(post_id=post.id, author_id=author_id, body=body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete_post(db: Session, post: Post, current_user) -> None:
    if post.author_id != current_user.id and current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only delete your own posts")
    from datetime import datetime, timezone

    post.deleted_at = datetime.now(timezone.utc)
    db.commit()


def report_post(db: Session, post_id: uuid.UUID, reported_by_id: uuid.UUID, reason, details: str | None) -> PostReport:
    report = PostReport(post_id=post_id, reported_by_id=reported_by_id, reason=reason, details=details)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def moderate_remove(db: Session, post: Post) -> None:
    post.is_removed = True
    db.commit()


def moderate_disable_comments(db: Session, post: Post) -> None:
    post.comments_disabled = True
    db.commit()


def review_report(db: Session, report: PostReport, reviewed_by_id: uuid.UUID, dismiss: bool) -> PostReport:
    report.status = "dismissed" if dismiss else "reviewed"
    report.reviewed_by_id = reviewed_by_id
    db.commit()
    db.refresh(report)
    return report
