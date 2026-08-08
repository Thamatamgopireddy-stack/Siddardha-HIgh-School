import re
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"

PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?\":{}|<>]).{8,}$"
)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain text password against a hashed password."""
    try:
        if not plain or not hashed:
            return False
        pwd_bytes = plain.encode("utf-8")[:72]
        hash_bytes = hashed.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def hash_password(password: str) -> str:
    """Hash a password safely using native bcrypt with 72-byte truncation."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def validate_password_strength(password: str) -> bool:
    """Validate password meets minimum complexity requirements."""
    return bool(PASSWORD_PATTERN.match(password))


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    """Generate a JWT access token for a user subject."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire, "type": "access"}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Generate a JWT refresh token for a user subject."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload: dict[str, Any] = {"sub": str(subject), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])


__all__ = [
    "JWTError",
    "verify_password",
    "hash_password",
    "validate_password_strength",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
]
