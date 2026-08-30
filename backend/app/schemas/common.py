from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ResponseMeta(BaseModel):
    page: int | None = None
    limit: int | None = None
    total: int | None = None


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str = "Operation successful"
    meta: ResponseMeta | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[Any] = []


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    profile_photo_url: str | None = None
    force_password_change: bool = False


class LoginRequest(BaseModel):
    email_or_phone: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str
