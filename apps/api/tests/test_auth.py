from app.core.constants import Role


def test_login_success(client, make_user):
    make_user("admin@test.com", Role.ADMIN)
    resp = client.post("/api/v1/auth/login", data={"username": "admin@test.com", "password": "Welcome@123"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


def test_login_wrong_password(client, make_user):
    make_user("admin2@test.com", Role.ADMIN)
    resp = client.post("/api/v1/auth/login", data={"username": "admin2@test.com", "password": "WrongPass1"})
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = client.post("/api/v1/auth/login", data={"username": "nobody@test.com", "password": "Welcome@123"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_returns_profile(client, make_user):
    make_user("me@test.com", Role.TRAINER)
    login = client.post("/api/v1/auth/login", data={"username": "me@test.com", "password": "Welcome@123"})
    token = login.json()["access_token"]
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@test.com"
    assert resp.json()["role"] == "trainer"


def test_refresh_token_rotates(client, make_user):
    make_user("refresh@test.com", Role.STUDENT)
    login = client.post("/api/v1/auth/login", data={"username": "refresh@test.com", "password": "Welcome@123"})
    refresh_token = login.json()["refresh_token"]

    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    new_tokens = resp.json()
    assert new_tokens["access_token"] != login.json()["access_token"]

    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse.status_code == 401


def test_inactive_user_cannot_login(client, db, make_user):
    from app.core.constants import UserStatus

    user = make_user("inactive@test.com", Role.STUDENT)
    user.status = UserStatus.INACTIVE
    db.commit()

    resp = client.post("/api/v1/auth/login", data={"username": "inactive@test.com", "password": "Welcome@123"})
    assert resp.status_code == 403
