"""Pydantic 验证器工具（减少 api 文件中重复的 _validate_uuid）"""
import uuid


def _validate_uuid(v: str) -> str:
    try:
        uuid.UUID(v)
        return v
    except (ValueError, AttributeError, TypeError):
        raise ValueError(f"无效的 UUID: {v}")


def _validate_uuid_optional(v: str | None) -> str | None:
    if v is None:
        return v
    try:
        uuid.UUID(v)
        return v
    except (ValueError, AttributeError, TypeError):
        raise ValueError(f"无效的 UUID: {v}")


# Pydantic field_validator 可以直接用这两个函数
# 用法：field_validator("student_id")(_validate_uuid)
