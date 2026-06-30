"""对话页推荐服务 — 基于画像/评估/对话/题库/路径的多维问题推荐"""

import uuid
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.student_profile import StudentProfile
from app.models.learning_record import LearningRecord
from app.models.exercise import Exercise
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.learning_path import LearningPath

logger = logging.getLogger(__name__)

# 预设 fallback 问题
FALLBACK_QUESTIONS = [
    {"text": "讲解 A* 搜索算法的原理", "tag": "搜索", "tagClass": "tag-info", "reason": "人工智能导论核心算法"},
    {"text": "CNN 卷积神经网络原理", "tag": "CV", "tagClass": "tag-green", "reason": "深度学习基础"},
    {"text": "监督学习 vs 无监督学习", "tag": "ML", "tagClass": "tag-dark", "reason": "机器学习入门"},
    {"text": "出 5 道搜索算法练习题", "tag": "练习", "tagClass": "tag-warm", "reason": "巩固练习"},
]

QUESTION_TEMPLATES = {
    "profile": [
        ("讲解{topic}的核心概念", "薄弱", "tag-warm"),
        ("梳理{topic}的知识框架", "薄弱", "tag-warm"),
    ],
    "evaluation": [
        ("做几道{topic}的练习题巩固", "练习", "tag-warm"),
        ("分析{topic}的常见易错点", "练习", "tag-warm"),
    ],
    "chat": [
        ("继续深入{topic}的应用场景", "进阶", "tag-info"),
        ("{topic}与已学知识的关联", "拓展", "tag-green"),
    ],
    "tiku": [
        ("针对{topic}的易错题专项训练", "易错", "tag-warm"),
        ("总结{topic}的答题技巧", "技巧", "tag-info"),
    ],
    "path": [
        ("按学习计划推进{topic}", "路径", "tag-dark"),
        ("预习{topic}的预备知识", "路径", "tag-dark"),
    ],
}


class ChatRecommendationService:
    """对话页推荐服务"""

    async def get_recommendations(
        self,
        db: AsyncSession,
        student_id: str,
        session_id: str | None = None,
        count: int = 4,
    ) -> list[dict]:
        sid = uuid.UUID(student_id)
        scored = await self._collect_and_score(db, sid, session_id)

        # 去重（相同 text 只保留第一个）
        seen = set()
        deduped = []
        for q in scored:
            if q["text"] not in seen:
                seen.add(q["text"])
                deduped.append(q)

        result = deduped[:count]
        # 不足 count 条时用 fallback 补
        if len(result) < count:
            fallback_tags = {q["text"] for q in result}
            for fb in FALLBACK_QUESTIONS:
                if len(result) >= count:
                    break
                if fb["text"] not in fallback_tags:
                    result.append(fb)
        return result

    async def _collect_and_score(
        self, db: AsyncSession, sid: uuid.UUID, session_id: str | None
    ) -> list[dict]:
        """从 5 个来源收集候选知识点并打分"""
        candidates: dict[str, float] = {}

        # 1. 画像薄弱项 (weight 0.30)
        profile_result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == sid).limit(1)
        )
        profile = profile_result.scalar_one_or_none()
        if profile and profile.dimensions:
            dims = profile.dimensions if isinstance(profile.dimensions, dict) else {}
            weak_topics = dims.get("weak_topics", [])
            if isinstance(weak_topics, list):
                for topic in weak_topics:
                    if isinstance(topic, str):
                        candidates[topic] = max(candidates.get(topic, 0), 0.30)
            # 也看维度分数 < 40 的
            for key, val in dims.items():
                if isinstance(val, dict) and val.get("score", 100) < 40:
                    candidates[key] = max(candidates.get(key, 0), 0.28)

        # 2. 评估掌握度 (weight 0.25) — learning_records 平均分低的 KPs
        lr_result = await db.execute(
            select(
                LearningRecord.knowledge_point,
                func.avg(LearningRecord.score).label("avg_score"),
            )
            .where(
                LearningRecord.student_id == sid,
                LearningRecord.knowledge_point.isnot(None),
                LearningRecord.score.isnot(None),
            )
            .group_by(LearningRecord.knowledge_point)
        )
        for row in lr_result.all():
            kp, avg = row.knowledge_point, row.avg_score
            if kp and avg is not None and avg < 60:
                score = 0.25 * (1 - avg / 100)
                candidates[kp] = max(candidates.get(kp, 0), score)

        # 3. 近期对话上下文 (weight 0.20)
        chat_result = await db.execute(
            select(ChatMessage.content, ChatMessage.created_at)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(ChatSession.student_id == sid)
            .order_by(desc(ChatMessage.created_at))
            .limit(200)
        )
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        chat_kp_count: dict[str, int] = {}
        for content, created_at in chat_result.all():
            if created_at and created_at < thirty_days_ago:
                continue
            if not content:
                continue
            # 匹配 candidates 中已收集的 KPs
            all_kps = list(candidates.keys()) + self._extract_kps_from_text(content)
            for kp in all_kps:
                if kp and kp in content:
                    chat_kp_count[kp] = chat_kp_count.get(kp, 0) + 1
        for kp, cnt in chat_kp_count.items():
            if cnt >= 2:
                candidates[kp] = max(candidates.get(kp, 0), 0.18)

        # 4. 题库正确率缺口 (weight 0.15)
        ex_result = await db.execute(
            select(
                Exercise.knowledge_point,
                func.avg(Exercise.is_correct).label("avg_correct"),
            )
            .where(
                Exercise.student_id == sid,
                Exercise.knowledge_point.isnot(None),
                Exercise.is_correct.isnot(None),
            )
            .group_by(Exercise.knowledge_point)
        )
        for row in ex_result.all():
            kp, avg = row.knowledge_point, row.avg_correct
            if kp and avg is not None and avg < 0.6:
                candidates[kp] = max(candidates.get(kp, 0), 0.15 * (1 - avg))

        # 5. 学习路径当前阶段 (weight 0.10)
        path_result = await db.execute(
            select(LearningPath)
            .where(LearningPath.student_id == sid)
            .order_by(desc(LearningPath.updated_at))
            .limit(5)
        )
        for path in path_result.scalars().all():
            if path.daily_plan:
                plan_str = str(path.daily_plan)
                for kp in list(candidates.keys()):
                    if kp in plan_str:
                        candidates[kp] = max(candidates.get(kp, 0), 0.10)

        # 如果没有候选，返回空
        if not candidates:
            return []

        # 排序并生成问题
        sorted_kps = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
        questions = []
        for kp, score in sorted_kps:
            # 根据最高分来源选择模板
            source = self._determine_source(score, kp, candidates)
            templates = QUESTION_TEMPLATES.get(source, QUESTION_TEMPLATES["profile"])
            for tmpl_text, tag, tag_class in templates:
                text = tmpl_text.replace("{topic}", kp)
                questions.append({
                    "text": text,
                    "tag": tag,
                    "tagClass": tag_class,
                    "reason": f"{kp} — {self._source_label(source)}",
                })
        return questions

    def _determine_source(self, score: float, kp: str, candidates: dict) -> str:
        """根据分数区间判定主要来源"""
        if score >= 0.28:
            return "profile"
        elif score >= 0.20:
            return "evaluation"
        elif score >= 0.15:
            return "tiku"
        elif score >= 0.10:
            return "path"
        return "chat"

    def _source_label(self, source: str) -> str:
        labels = {
            "profile": "画像薄弱项建议加强",
            "evaluation": "评估报告显示掌握不足",
            "chat": "近期对话提及，建议深入",
            "tiku": "练习正确率偏低",
            "path": "学习路径当前阶段",
        }
        return labels.get(source, "个性化推荐")

    def _extract_kps_from_text(self, text: str) -> list[str]:
        """从聊天文本中提取可能的知识点关键词"""
        import re
        # 常见的知识点关键词模式
        patterns = [
            r"(?:讲解|学习|关于|了解|掌握|复习|练习)\s*[：:]\s*([^，。！？\n]{2,30})",
            r"([^，。！？\n]{2,30})(?:的(?:原理|概念|应用|算法|方法|步骤|特点|区别|优缺点))",
        ]
        kps = []
        for p in patterns:
            for m in re.finditer(p, text):
                kp = m.group(1).strip()
                if 2 <= len(kp) <= 30:
                    kps.append(kp)
        return kps


chat_recommendation_service = ChatRecommendationService()
