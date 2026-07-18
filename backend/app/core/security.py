"""密码哈希 + JWT 工具"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import hashlib
import hmac
import base64
import json

import bcrypt
from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(student_id: str, token_type: str = "access") -> str:
    secret = settings.JWT_SECRET
    exp_days = 7 if token_type == "access" else 30
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "sub": student_id,
            "type": token_type,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int((datetime.now(timezone.utc) + timedelta(days=exp_days)).timestamp()),
        }).encode()
    ).rstrip(b"=").decode()
    sig_src = f"{header}.{payload}".encode()
    sig = hmac.new(secret.encode(), sig_src, hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


def decode_token(token: str, expected_type: Optional[str] = "access") -> Optional[str]:
    """验证 JWT，返回 student_id（字符串），失败返回 None。

    expected_type: 期望的 token 类型（access / refresh / None）。
    - None: 不检查类型（向后兼容）
    - "access": 默认，仅放行 access token
    - "refresh": 仅放行 refresh token
    """
    secret = settings.JWT_SECRET
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        # 验证签名
        sig_src = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(secret.encode(), sig_src, hashlib.sha256).digest()
        actual_sig = base64.urlsafe_b64decode(sig_b64 + "==")
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        # 解析 payload
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        # 检查过期
        exp = payload.get("exp", 0)
        if datetime.now(timezone.utc).timestamp() > exp:
            return None
        # 检查 token 类型（防 access/refresh 混用）
        if expected_type is not None and payload.get("type") != expected_type:
            return None
        return payload.get("sub")
    except Exception:
        return None


def create_refresh_token(student_id: str) -> str:
    """refresh token（30 天有效）。复用 create_token 结构，带 type=refresh 字段。"""
    return create_token(student_id, token_type="refresh")
