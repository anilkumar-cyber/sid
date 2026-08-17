from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, MeResponse, RefreshRequest, TokenResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> TokenResponse:
    access_token, refresh_token = auth_service.authenticate(db, form.username, form.password)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login-json", response_model=TokenResponse)
def login_json(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    access_token, refresh_token = auth_service.authenticate(db, body.email, body.password)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    access_token, refresh_token = auth_service.refresh_access_token(db, body.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, db: Session = Depends(get_db)) -> None:
    auth_service.logout(db, body.refresh_token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return auth_service.build_me_response(db, current_user)


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    auth_service.change_password(db, current_user, body.current_password, body.new_password)
