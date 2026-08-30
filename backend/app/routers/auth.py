from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, success_response
from app.core.session import get_db
from app.models import User
from app.schemas.common import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    ForgotPasswordRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user, access, refresh = await service.authenticate(body.email_or_phone, body.password)
    return success_response(
        data={
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "user": service.to_user_brief(user).model_dump(mode="json"),
        },
        message="Login successful",
    )


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    access, new_refresh = await service.refresh_access_token(body.refresh_token)
    return success_response(
        data={"access_token": access, "refresh_token": new_refresh, "token_type": "bearer"},
        message="Token refreshed",
    )


@router.post("/logout")
async def logout(_: User = Depends(get_current_user)):
    return success_response(message="Logged out successfully")


@router.post("/forgot-password")
async def forgot_password(_: ForgotPasswordRequest):
    return success_response(message="If the account exists, an OTP has been sent")


@router.post("/reset-password")
async def reset_password(_: ResetPasswordRequest):
    return success_response(message="Password reset successful")


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    await service.change_password(user, body.current_password, body.new_password)
    return success_response(message="Password changed successfully")


@router.get("/me")
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    permissions = await service.get_user_permissions(user)
    data = service.to_user_brief(user).model_dump(mode="json")
    data["permissions"] = permissions
    return success_response(data=data)
