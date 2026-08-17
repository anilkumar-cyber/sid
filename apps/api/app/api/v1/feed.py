import json
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.constants import PostVisibility, ReportReason, Role
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.repositories import feed as repo
from app.schemas.feed import CommentCreate, CommentOut, PostOut, ReportCreate, ReportOut
from app.services import feed as service
from app.services.audit import log_action

router = APIRouter(prefix="/feed", tags=["feed"])

MODERATE = require_roles(Role.SUPER_ADMIN, Role.ADMIN)


@router.get("/posts", response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[PostOut]:
    rows = db.execute(repo.feed_query_for_user(db, current_user)).scalars().all()
    return [PostOut.model_validate(service.post_to_out(db, p, current_user.id)) for p in rows]


@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(
    caption: str | None = Form(None),
    visibility: PostVisibility = Form(PostVisibility.ACADEMY),
    branch_id: uuid.UUID | None = Form(None),
    batch_id: uuid.UUID | None = Form(None),
    event_id: uuid.UUID | None = Form(None),
    is_official: bool = Form(False),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> PostOut:
    if is_official and current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN):
        raise HTTPException(403, "Only admins can create official announcements")

    file_tuples = [(await f.read(), f.content_type, f.filename) for f in files] if files else []
    post = service.create_post(
        db,
        {"caption": caption, "visibility": visibility, "branch_id": branch_id, "batch_id": batch_id, "event_id": event_id},
        file_tuples,
        current_user.id,
        is_official,
    )
    log_action(db, current_user.id, "post.created", "post", str(post.id))
    return PostOut.model_validate(service.post_to_out(db, post, current_user.id))


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> None:
    post = repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    service.delete_post(db, post, current_user)
    log_action(db, current_user.id, "post.deleted", "post", str(post_id))


@router.post("/posts/{post_id}/like", response_model=dict)
def like(post_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    liked = service.toggle_like(db, post_id, current_user.id)
    return {"liked": liked}


@router.post("/posts/{post_id}/save", response_model=dict)
def save(post_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    saved = service.toggle_save(db, post_id, current_user.id)
    return {"saved": saved}


@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[CommentOut]:
    rows = repo.list_comments(db, post_id)
    return [CommentOut(id=c.id, post_id=c.post_id, author_id=c.author_id, author_name=c.author.full_name, body=c.body, created_at=c.created_at) for c in rows]


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(post_id: uuid.UUID, body: CommentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> CommentOut:
    post = repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    comment = service.add_comment(db, post, current_user.id, body.body)
    return CommentOut(id=comment.id, post_id=comment.post_id, author_id=comment.author_id, author_name=current_user.full_name, body=comment.body, created_at=comment.created_at)


@router.post("/posts/{post_id}/report", response_model=ReportOut, status_code=201)
def report(post_id: uuid.UUID, body: ReportCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ReportOut:
    report = service.report_post(db, post_id, current_user.id, body.reason, body.details)
    log_action(db, current_user.id, "post.reported", "post", str(post_id), {"reason": body.reason.value})
    return ReportOut.model_validate(report)


@router.get("/reports", response_model=list[ReportOut])
def list_reports(status: str | None = None, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> list[ReportOut]:
    return [ReportOut.model_validate(r) for r in repo.list_reports(db, status)]


@router.post("/posts/{post_id}/moderate/remove", status_code=204)
def moderate_remove(post_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> None:
    post = repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    service.moderate_remove(db, post)
    log_action(db, current_user.id, "post.moderated_remove", "post", str(post_id))


@router.post("/posts/{post_id}/moderate/disable-comments", status_code=204)
def moderate_disable_comments(post_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> None:
    post = repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(404, "Post not found")
    service.moderate_disable_comments(db, post)
    log_action(db, current_user.id, "post.comments_disabled", "post", str(post_id))


@router.post("/reports/{report_id}/review", response_model=ReportOut)
def review_report(report_id: uuid.UUID, dismiss: bool = False, db: Session = Depends(get_db), current_user=Depends(MODERATE)) -> ReportOut:
    report = repo.get_report(db, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    report = service.review_report(db, report, current_user.id, dismiss)
    log_action(db, current_user.id, "post.report_reviewed", "post_report", str(report_id))
    return ReportOut.model_validate(report)
