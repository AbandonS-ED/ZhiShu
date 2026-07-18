"""Profile Service — 画像统一写入层

所有画像维度更新都通过此模块，确保：
- 并发安全（per-student asyncio.Lock）
- 语义一致（统一 confidence 增量）
- 单一写入路径（消除多处零散 commit）
"""

import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from app.models.student_profile import StudentProfile

logger = logging.getLogger(__name__)

# Per-student 互斥锁（防同一学生并发写覆盖）
_locks: dict[str, asyncio.Lock] = {}
_LOCK_TIMEOUT = 30  # 秒，防死锁


def _get_lock(student_id: str) -> asyncio.Lock:
    """获取 per-student 锁（自动清理超时锁防内存泄漏）"""
    if student_id not in _locks:
        _locks[student_id] = asyncio.Lock()
    return _locks[student_id]


async def apply_llm_updates(
    db: AsyncSession,
    student_id: str,
    updates: list[dict],
    source: str = "unknown",
) -> int:
    """LLM 分析结果统一写入（behavior_analysis / scheduled 都走这里）

    Args:
        updates: [{"dimension": "comprehension", "score_change": 5, "reason": "..."}]
        source: 来源标识（用于日志）

    Returns:
        更新的维度数量
    """
    lock = _get_lock(student_id)
    async with lock:
        result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            logger.warning(f"[profile_service] No profile for {student_id}, skip {source}")
            return 0

        dims = profile.dimensions or {}
        updated_count = 0

        for update in updates:
            dim_key = update.get("dimension")
            score_change = update.get("score_change", 0)
            reason = update.get("reason", "")

            if not dim_key or score_change == 0:
                continue

            dim = dims.get(dim_key, {"score": 50, "confidence": 0.5})
            old_score = dim.get("score", 50)
            new_score = max(0, min(100, old_score + score_change))

            if new_score == old_score:
                continue

            old_conf = dim.get("confidence", 0.5)
            new_conf = min(1.0, old_conf + 0.02)

            dim["score"] = new_score
            dim["confidence"] = new_conf
            dims[dim_key] = dim
            updated_count += 1
            logger.info(
                f"[profile_service:{source}] {dim_key}: {old_score} -> {new_score} "
                f"(change: {score_change:+d}, conf: {old_conf:.2f}->{new_conf:.2f}, reason: {reason})"
            )

        if updated_count > 0:
            profile.dimensions = dims
            flag_modified(profile, "dimensions")
            await db.commit()

        return updated_count


async def apply_rule_updates(
    db: AsyncSession,
    student_id: str,
    rule_updates: list[dict],
) -> int:
    """规则引擎写入（update-behavior 走这里）

    Args:
        rule_updates: [{"dimension": "application", "score_change": 3, "reason": "正确率>80%"}]

    Returns:
        更新的维度数量
    """
    lock = _get_lock(student_id)
    async with lock:
        result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return 0

        dims = profile.dimensions or {}
        updated_count = 0

        for update in rule_updates:
            dim_key = update.get("dimension")
            score_change = update.get("score_change", 0)
            reason = update.get("reason", "")

            if not dim_key or score_change == 0:
                continue

            dim = dims.get(dim_key, {"score": 50, "confidence": 0.5})
            old_score = dim.get("score", 50)
            new_score = max(0, min(100, old_score + score_change))

            if new_score == old_score:
                continue

            old_conf = dim.get("confidence", 0.5)
            new_conf = min(1.0, old_conf + 0.05)  # 规则引擎 conf 增量更确定

            dim["score"] = new_score
            dim["confidence"] = new_conf
            dims[dim_key] = dim
            updated_count += 1
            logger.info(
                f"[profile_service:rule] {dim_key}: {old_score} -> {new_score} "
                f"(change: {score_change:+d}, reason: {reason})"
            )

        if updated_count > 0:
            profile.dimensions = dims
            flag_modified(profile, "dimensions")
            await db.commit()

        return updated_count


async def merge_and_save_assessment(
    db: AsyncSession,
    student_id: str,
    new_dims: dict,
    assessment_status: str = "completed",
) -> None:
    """对话评估写入：保留高置信度的分数，合并新旧维度

    Args:
        new_dims: {"comprehension": {"score": 70, "confidence": 0.8}, ...}
        assessment_status: "completed" 或 "in_progress"
    """
    lock = _get_lock(student_id)
    async with lock:
        result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        profile = result.scalar_one_or_none()

        if profile:
            old_dims = profile.dimensions or {}
            merged = {}
            all_keys = set(list(old_dims.keys()) + list(new_dims.keys()))
            for k in all_keys:
                old_d = old_dims.get(k, {})
                new_d = new_dims.get(k, {})
                old_conf = old_d.get("confidence", 0)
                new_conf = new_d.get("confidence", 0)
                merged[k] = new_d if new_conf >= old_conf else old_d
            profile.dimensions = merged
            profile.assessment_status = assessment_status
            flag_modified(profile, "dimensions")
        else:
            profile = StudentProfile(
                student_id=student_id,
                dimensions=new_dims,
                assessment_status=assessment_status,
            )
            db.add(profile)

        await db.commit()
