"""推荐服务 — 基于学生画像/评估/对话/题库/路径的个性化 KP 推荐"""

import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.models.learning_record import LearningRecord
from app.models.student_profile import StudentProfile
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.learning_path import LearningPath

logger = logging.getLogger(__name__)

# 冷启动知识大纲（人工智能导论通识课）
COLD_START_KPS = [
    "人工智能概述", "搜索算法", "知识表示", "推理系统",
    "机器学习基础", "监督学习", "无监督学习", "深度学习入门",
    "神经网络基础", "卷积神经网络", "循环神经网络", "自然语言处理",
    "计算机视觉", "强化学习", "人工智能伦理",
]


class RecommendationService:
    """推荐服务：基于多维度数据打分，推荐最需要学习的知识点"""

    async def get_recommendations(
        self,
        db: AsyncSession,
        student_id: str,
        limit: int = 10,
    ) -> list[dict]:
        """返回 Top-N 推荐知识点列表"""
        sid = uuid.UUID(student_id)

        # 1. 冷启动检测
        is_cold = await self._is_cold_start(db, sid)
        if is_cold:
            return self._cold_start_recommendations(limit)

        # 2. 收集候选知识点
        candidates = await self._collect_candidate_kps(db, sid)

        # 3. 逐个计算推荐分
        scored = []
        for kp, kp_data in candidates.items():
            score, reason_type, reason = await self._score_kp(kp, kp_data, db, sid)
            scored.append({
                "knowledge_point": kp,
                "reason": reason,
                "reason_type": reason_type,
                "priority_score": round(score, 3),
            })

        # 4. 排序返回
        scored.sort(key=lambda x: x["priority_score"], reverse=True)
        return scored[:limit]

    async def _is_cold_start(self, db: AsyncSession, sid: uuid.UUID) -> bool:
        """判断是否为冷启动用户（无任何学习数据）"""
        # 检查 learning_records
        r1 = await db.execute(
            select(func.count(LearningRecord.id))
            .where(LearningRecord.student_id == sid)
        )
        if r1.scalar() > 0:
            return False

        # 检查 chat_sessions
        r3 = await db.execute(
            select(func.count(ChatSession.id))
            .where(ChatSession.student_id == sid)
        )
        if r3.scalar() > 0:
            return False

        return True

    async def _collect_candidate_kps(
        self, db: AsyncSession, sid: uuid.UUID
    ) -> dict[str, dict]:
        """从多个数据源收集该学生接触过的知识点"""
        candidates: dict[str, dict] = {}

        # 从 learning_records 收集
        lr_result = await db.execute(
            select(LearningRecord.knowledge_point)
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.knowledge_point.isnot(None),
            )
        )
        for (kp,) in lr_result.all():
            if kp:
                candidates.setdefault(kp, {"sources": []})["sources"].append("record")

        # 从 chat_messages 收集（ILIKE 关键词匹配）
        chat_result = await db.execute(
            select(ChatMessage.content, ChatMessage.created_at)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(ChatSession.student_id == sid)
            .order_by(ChatMessage.created_at.desc())
            .limit(500)
        )
        recent_chat_kps: dict[str, int] = {}
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        for (content, created_at) in chat_result.all():
            if created_at and created_at < thirty_days_ago:
                continue
            if content:
                for kp in candidates.keys():
                    if kp in content:
                        recent_chat_kps[kp] = recent_chat_kps.get(kp, 0) + 1

        for kp, cnt in recent_chat_kps.items():
            if kp in candidates:
                candidates[kp]["chat_mentions"] = cnt

        return candidates

    async def _score_kp(
        self,
        kp: str,
        kp_data: dict,
        db: AsyncSession,
        sid: uuid.UUID,
    ) -> tuple[float, str, str]:
        """计算单个知识点的推荐分 + 生成理由"""
        components = {}

        # A. 画像缺口（知识基础分，越低越需要学）
        profile_result = await db.execute(
            select(StudentProfile)
            .where(StudentProfile.student_id == sid)
            .limit(1)
        )
        profile = profile_result.scalar_one_or_none()
        profile_score = 50.0  # 默认中立
        if profile and profile.dimensions:
            kb = profile.dimensions.get("knowledge_base", {})
            if isinstance(kb, dict):
                profile_score = kb.get("score", 50.0)
            elif isinstance(kb, (int, float)):
                profile_score = float(kb)
        components["profile_gap"] = 0.30 * (1 - profile_score / 100)

        # B. 评估掌握度缺口
        mastery_gap = await self._mastery_gap(db, sid, kp)
        components["mastery_gap"] = 0.25 * mastery_gap

        # C. 对话频率（30天内）
        chat_freq = kp_data.get("chat_mentions", 0)
        components["chat_freq"] = 0.20 * min(chat_freq / 10, 1.0)

        # D. 题库正确率缺口
        accuracy_gap = await self._accuracy_gap(db, sid, kp)
        components["accuracy_gap"] = 0.15 * accuracy_gap

        # E. 路径近期奖励
        path_bonus = await self._path_recency_bonus(db, sid, kp)
        components["path_bonus"] = 0.10 * path_bonus

        total = sum(components.values())

        # 生成理由
        reason_type, reason = self._build_reason(kp, components, mastery_gap, chat_freq, accuracy_gap, profile_score)

        return total, reason_type, reason

    async def _mastery_gap(self, db: AsyncSession, sid: uuid.UUID, kp: str) -> float:
        """该 KP 的平均得分缺口（0-1，越大越需要学）"""
        result = await db.execute(
            select(func.avg(LearningRecord.score))
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.knowledge_point == kp,
                LearningRecord.action == "exercise",
                LearningRecord.score.isnot(None),
            )
        )
        avg = result.scalar()
        if avg is None:
            return 0.8  # 无数据，默认高优先级
        return 1 - (avg / 100)

    async def _accuracy_gap(self, db: AsyncSession, sid: uuid.UUID, kp: str) -> float:
        """该 KP 的答题正确率缺口"""
        result = await db.execute(
            select(func.avg(LearningRecord.score))
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.knowledge_point == kp,
                LearningRecord.action == "exercise",
                LearningRecord.score.isnot(None),
            )
        )
        avg = result.scalar()
        if avg is None:
            return 0.5  # 无数据，中立
        return 1 - (avg / 100)

    async def _path_recency_bonus(self, db: AsyncSession, sid: uuid.UUID, kp: str) -> float:
        """该 KP 是否在最近7天的学习路径中出现"""
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        result = await db.execute(
            select(LearningPath.daily_plan, LearningPath.updated_at)
            .where(LearningPath.student_id == sid)
            .order_by(LearningPath.updated_at.desc())
            .limit(10)
        )
        for daily_plan, updated_at in result.all():
            if updated_at and updated_at >= seven_days_ago:
                if daily_plan:
                    plan_str = str(daily_plan)
                    if kp in plan_str:
                        return 1.0
        return 0.0

    def _build_reason(
        self,
        kp: str,
        components: dict,
        mastery_gap: float,
        chat_freq: int,
        accuracy_gap: float,
        profile_score: float,
    ) -> tuple[Literal["evaluation", "chat", "tiku", "path", "profile"], str]:
        """根据最高权重组件生成理由"""
        max_comp = max(components, key=components.get)

        if components.get("mastery_gap", 0) >= 0.20:
            return "evaluation", f"评估显示掌握度偏低，是当前薄弱项"
        elif components.get("chat_freq", 0) >= 0.10 and chat_freq >= 3:
            return "chat", f"对话中多次讨论该知识点，建议系统学习"
        elif components.get("accuracy_gap", 0) >= 0.15:
            return "tiku", f"练习正确率偏低，建议针对性练习"
        elif components.get("path_bonus", 0) >= 0.10:
            return "path", f"当前学习路径包含该知识点"
        elif profile_score < 40:
            return "profile", f"画像显示知识基础薄弱，建议从基础开始"
        else:
            return "evaluation", f"建议按学习计划推进该知识点"

    def _cold_start_recommendations(self, limit: int) -> list[dict]:
        """冷启动：返回通识课大纲推荐"""
        cold_kps = COLD_START_KPS[:limit]
        reason_types: list[Literal["cold_start"]] = ["cold_start"] * len(cold_kps)
        reasons = [
            f"人工智能导论核心知识点，欢迎开始学习之旅",
        ] * len(cold_kps)
        return [
            {
                "knowledge_point": kp,
                "reason": reasons[i],
                "reason_type": "cold_start",
                "priority_score": round(0.9 - i * 0.04, 3),
            }
            for i, kp in enumerate(cold_kps)
        ]


recommendation_service = RecommendationService()