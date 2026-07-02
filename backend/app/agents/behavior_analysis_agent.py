"""Behavior Analysis Agent — 用 LLM 分析学习行为，智能更新画像维度"""

import json
import logging
import re
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.student_profile import StudentProfile
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.exercise import Exercise
from app.models.learning_record import LearningRecord
from app.services.llm_factory import get_llm_client
from app.core.profile_dimensions import DIM_CN

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个学习行为分析专家。根据学生最近的学习行为数据，分析其能力维度的变化。

# 7个维度
- 理解力 (comprehension): 学习新概念的速度
- 记忆力 (memory): 知识的保持能力
- 应用转化 (application): 将知识应用到实际的能力
- 想象力 (imagination): 创新思维和联想能力
- 专注力 (focus): 持续学习的专注程度
- 知识基础 (knowledge_base): 先修知识掌握程度
- 学习目标 (learning_goal): 学习目的的清晰度

# 输出格式（必须严格遵守）

---ANALYSIS_DATA---
{"updates": [{"dimension": "xxx", "score_change": 5, "reason": "原因说明"}], "summary": "整体分析摘要"}

# 规则
- score_change 范围 -10 到 +10
- 只输出有变化的维度
- reason 用中文简要说明
- summary 用中文总结整体情况
- 不要使用<think>标签"""


class BehaviorAnalysisAgent:
    """学习行为分析 Agent"""

    async def analyze_and_update(
        self,
        db: AsyncSession,
        student_id: str,
        behavior_type: str,  # "chat", "exercise", "resource", "study"
        behavior_data: dict = None,
    ) -> dict:
        """分析学习行为并更新画像"""
        
        # 1. 收集最近的学习行为数据
        recent_data = await self._collect_recent_data(db, student_id, behavior_type)
        
        # 2. 获取当前画像
        profile = await self._get_profile(db, student_id)
        if not profile:
            return {"status": "no_profile", "message": "无画像数据，跳过分析"}
        
        # 3. 调用 LLM 分析
        analysis = await self._analyze_with_llm(
            behavior_type=behavior_type,
            behavior_data=behavior_data or {},
            recent_data=recent_data,
            current_dims=profile.dimensions or {},
        )
        
        # 4. 应用更新
        if analysis.get("updates"):
            updated = await self._apply_updates(db, profile, analysis["updates"])
            return {
                "status": "updated",
                "updates": analysis["updates"],
                "summary": analysis.get("summary", ""),
                "updated_count": updated,
            }
        
        return {
            "status": "no_change",
            "summary": analysis.get("summary", "无显著变化"),
        }

    async def _collect_recent_data(
        self, db: AsyncSession, student_id: str, behavior_type: str
    ) -> dict:
        """收集最近的学习行为数据"""
        data = {
            "recent_chats": [],
            "recent_exercises": [],
            "recent_records": [],
        }
        
        # 最近 5 条对话
        chat_result = await db.execute(
            select(ChatMessage.content, ChatMessage.role, ChatMessage.created_at)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(ChatSession.student_id == student_id)
            .order_by(desc(ChatMessage.created_at))
            .limit(5)
        )
        for row in chat_result.all():
            data["recent_chats"].append({
                "content": row.content[:200] if row.content else "",
                "role": row.role,
                "time": row.created_at.isoformat() if row.created_at else None,
            })
        
        # 最近 5 道练习
        ex_result = await db.execute(
            select(Exercise.question, Exercise.is_correct, Exercise.knowledge_point)
            .where(Exercise.student_id == student_id)
            .order_by(desc(Exercise.created_at))
            .limit(5)
        )
        for row in ex_result.all():
            data["recent_exercises"].append({
                "question": row.question[:100] if row.question else "",
                "correct": row.is_correct,
                "knowledge_point": row.knowledge_point,
            })
        
        # 最近学习记录
        lr_result = await db.execute(
            select(LearningRecord.knowledge_point, LearningRecord.score, LearningRecord.duration_seconds)
            .where(LearningRecord.student_id == student_id)
            .order_by(desc(LearningRecord.created_at))
            .limit(5)
        )
        for row in lr_result.all():
            data["recent_records"].append({
                "knowledge_point": row.knowledge_point,
                "score": row.score,
                "duration": row.duration_seconds,
            })
        
        return data

    async def _get_profile(self, db: AsyncSession, student_id: str):
        """获取学生画像"""
        result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        return result.scalar_one_or_none()

    async def _analyze_with_llm(
        self,
        behavior_type: str,
        behavior_data: dict,
        recent_data: dict,
        current_dims: dict,
    ) -> dict:
        """调用 LLM 分析学习行为"""
        
        # 构建分析提示
        behavior_desc = {
            "chat": "进行了对话学习",
            "exercise": "完成了练习题",
            "resource": "访问了学习资源",
            "study": "进行了学习活动",
            "scheduled": "定时分析",
            "manual": "手动触发分析",
        }.get(behavior_type, "进行了学习活动")
        
        # 格式化当前维度
        dims_text = ""
        for dim_key, dim_val in current_dims.items():
            if isinstance(dim_val, dict):
                score = dim_val.get("score", 50)
                conf = dim_val.get("confidence", 0.5)
                dims_text += f"- {DIM_CN.get(dim_key, dim_key)}: {score}分 (置信度{conf:.0%})\n"
        
        # 格式化最近行为
        recent_text = "最近学习行为:\n"
        if recent_data["recent_chats"]:
            recent_text += "对话:\n"
            for chat in recent_data["recent_chats"][:3]:
                recent_text += f"  - [{chat['role']}] {chat['content'][:50]}...\n"
        if recent_data["recent_exercises"]:
            recent_text += "练习:\n"
            for ex in recent_data["recent_exercises"][:3]:
                status = "✓" if ex["correct"] else "✗"
                recent_text += f"  - {status} {ex['knowledge_point'] or '未知'}\n"
        
        # 行为详情
        behavior_detail = ""
        if behavior_type == "exercise":
            behavior_detail = f"本次练习: 正确率 {behavior_data.get('correct_rate', '未知')}"
        elif behavior_type == "chat":
            behavior_detail = f"本次对话: {behavior_data.get('message', '')[:50]}"
        elif behavior_type == "resource":
            behavior_detail = f"本次资源: 访问了 {behavior_data.get('resource_type', '未知')} 类型资源"
        
        user_prompt = f"""{behavior_desc}

当前画像:
{dims_text}

{recent_text}

{behavior_detail}

请分析这次学习行为对能力维度的影响。"""

        try:
            # 调用 LLM
            if get_llm_client() is None:
                logger.warning("minimax_client not initialized, skipping analysis")
                return {"updates": [], "summary": "LLM未初始化，跳过分析"}
            
            response = await get_llm_client().chat(
                messages=[
                    {"role": "user", "content": user_prompt},
                ],
                system=SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=500,
            )
            
            content = response.get("content", "")
            
            # 解析分析结果
            return self._parse_analysis(content)
            
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            return {"updates": [], "summary": "分析失败，跳过更新"}

    def _parse_analysis(self, content: str) -> dict:
        """解析 LLM 分析结果"""
        try:
            # 过滤 <think> 标签
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            
            # 提取 ---ANALYSIS_DATA--- 后面的 JSON
            if "---ANALYSIS_DATA---" in content:
                json_str = content.split("---ANALYSIS_DATA---")[1].strip()
            else:
                # 尝试直接解析 JSON
                json_match = content.find("{")
                if json_match >= 0:
                    json_str = content[json_match:]
                else:
                    return {"updates": [], "summary": content[:100]}
            
            data = json.loads(json_str)
            summary = re.sub(r'<think>.*?</think>', '', data.get("summary", ""), flags=re.DOTALL).strip()
            return {
                "updates": data.get("updates", []),
                "summary": summary,
            }
        except Exception as e:
            logger.error(f"Failed to parse analysis: {e}, content: {content}")
            return {"updates": [], "summary": "解析失败"}

    async def _apply_updates(
        self, db: AsyncSession, profile: StudentProfile, updates: list
    ) -> int:
        """应用维度更新"""
        dims = profile.dimensions or {}
        updated_count = 0
        
        for update in updates:
            dim_key = update.get("dimension")
            score_change = update.get("score_change", 0)
            reason = update.get("reason", "")
            
            if not dim_key or score_change == 0:
                continue
            
            # 获取当前维度
            dim = dims.get(dim_key, {"score": 50, "confidence": 0.5})
            old_score = dim.get("score", 50)
            
            # 应用变化（限制范围 0-100）
            new_score = max(0, min(100, old_score + score_change))
            
            # 更新置信度
            old_conf = dim.get("confidence", 0.5)
            new_conf = min(1.0, old_conf + 0.02)
            
            dim["score"] = new_score
            dim["confidence"] = new_conf
            dims[dim_key] = dim
            
            updated_count += 1
            logger.info(
                f"[behavior_agent] Updated {dim_key}: {old_score} -> {new_score} "
                f"(change: {score_change:+d}, reason: {reason})"
            )
        
        if updated_count > 0:
            profile.dimensions = dims
            await db.commit()
        
        return updated_count


# 单例
behavior_analysis_agent = BehaviorAnalysisAgent()
