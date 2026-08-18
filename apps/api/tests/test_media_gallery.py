from datetime import date

from app.core.constants import MediaStatus, MediaType, Role


def login(client, email, password="Welcome@123"):
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_student(db, branch_id, email):
    from app.core.security import hash_password
    from app.models.student import StudentProfile
    from app.models.user import User

    user = User(email=email, full_name="Media Student", hashed_password=hash_password("Welcome@123"), role=Role.STUDENT, home_branch_id=branch_id)
    db.add(user)
    db.flush()
    profile = StudentProfile(user_id=user.id, joining_date=date.today())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def test_auto_tag_performers_tags_all_participants(client, db, make_user, make_branch):
    from app.models.event import Event, EventActivity, EventParticipant
    from app.models.media import Album, MediaAsset

    branch = make_branch("Media Branch A", "MDA")
    admin = make_user("admin_media@test.com", Role.ADMIN, home_branch_id=branch.id)
    s1 = _make_student(db, branch.id, "perf1@test.com")
    s2 = _make_student(db, branch.id, "perf2@test.com")

    event = Event(name="Showcase", event_date=date.today(), branch_id=branch.id)
    db.add(event)
    db.flush()
    activity = EventActivity(event_id=event.id, start_time="18:00:00", title="Finale")
    db.add(activity)
    db.flush()
    db.add_all([
        EventParticipant(activity_id=activity.id, student_id=s1.id, role="performer"),
        EventParticipant(activity_id=activity.id, student_id=s2.id, role="performer"),
    ])
    album = Album(name="Finale Album", activity_id=activity.id, created_by_id=admin.id)
    db.add(album)
    db.flush()
    asset = MediaAsset(
        album_id=album.id, media_type=MediaType.PHOTO, storage_key="k1.jpg", mime_type="image/jpeg", size_bytes=100,
        uploaded_by_id=admin.id, status=MediaStatus.APPROVED,
    )
    db.add(asset)
    db.commit()

    headers = login(client, "admin_media@test.com")
    resp = client.post(f"/api/v1/albums/{album.id}/auto-tag-performers", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["tags_created"] == 2

    # Running it again should not duplicate tags.
    resp2 = client.post(f"/api/v1/albums/{album.id}/auto-tag-performers", headers=headers)
    assert resp2.json()["tags_created"] == 0


def test_student_cannot_see_unpublished_media_in_album(client, db, make_user, make_branch):
    from app.models.media import Album, MediaAsset

    branch = make_branch("Media Branch B", "MDB")
    admin = make_user("admin_priv@test.com", Role.ADMIN, home_branch_id=branch.id)
    _make_student(db, branch.id, "priv_student@test.com")

    album = Album(name="Private Album", created_by_id=admin.id)
    db.add(album)
    db.flush()
    pending = MediaAsset(
        album_id=album.id, media_type=MediaType.PHOTO, storage_key="k2.jpg", mime_type="image/jpeg", size_bytes=100,
        uploaded_by_id=admin.id, status=MediaStatus.PENDING_APPROVAL,
    )
    published = MediaAsset(
        album_id=album.id, media_type=MediaType.PHOTO, storage_key="k3.jpg", mime_type="image/jpeg", size_bytes=100,
        uploaded_by_id=admin.id, status=MediaStatus.PUBLISHED,
    )
    db.add_all([pending, published])
    db.commit()

    headers = login(client, "priv_student@test.com")
    resp = client.get(f"/api/v1/albums/{album.id}/media", headers=headers)
    assert resp.status_code == 200
    statuses = {m["status"] for m in resp.json()}
    assert statuses == {"published"}


def test_only_admin_can_toggle_download_permission(client, db, make_user, make_branch):
    from app.models.media import Album, MediaAsset

    branch = make_branch("Media Branch C", "MDC")
    admin = make_user("admin_dl@test.com", Role.ADMIN, home_branch_id=branch.id)
    make_user("trainer_dl@test.com", Role.TRAINER, home_branch_id=branch.id)

    album = Album(name="DL Album", created_by_id=admin.id)
    db.add(album)
    db.flush()
    asset = MediaAsset(
        album_id=album.id, media_type=MediaType.PHOTO, storage_key="k4.jpg", mime_type="image/jpeg", size_bytes=100,
        uploaded_by_id=admin.id, status=MediaStatus.APPROVED,
    )
    db.add(asset)
    db.commit()

    trainer_headers = login(client, "trainer_dl@test.com")
    resp = client.post(f"/api/v1/media/{asset.id}/downloads", headers=trainer_headers, json={"downloads_enabled": False})
    assert resp.status_code == 403

    admin_headers = login(client, "admin_dl@test.com")
    resp2 = client.post(f"/api/v1/media/{asset.id}/downloads", headers=admin_headers, json={"downloads_enabled": False})
    assert resp2.status_code == 200
    assert resp2.json()["downloads_enabled"] is False
