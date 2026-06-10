"""Profile Agent — 对话式学生画像提取

通过多轮对话分析学生的学习特征，输出 6 维结构化 JSON 画像。
"""

import json
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination

# 6 维画像的 JSON Schema（供 LLM 结构化输出）
PROFILE_SCHEMA = """{
  "knowledge_mastery": {
    "机器学习基础": 0-100的整数,
    "深度学习": 0-100的整数,
    "自然语言处理": 0-100的整数,
    "计算机视觉": 0-100的整数,
    "数据预处理": 0-100的整数,
    "模型评估": 0-100的整数
  },
  "learning_style": {
    "visual": 0-100的整数 (视觉型),
    "textual": 0-100的整数 (文本型),
    "auditory": 0-100的整数 (听觉型),
    "kinesthetic": 0-100的整数 (动手型)
  },
  "cognitive_level": {
    "memory": 0-100的整数 (记忆),
    "understand": 0-100的整数 (理解),
    "apply": 0-100的整数 (应用),
    "analyze": 0-100的整数 (分析)
  },
  "interest": {
    "topic_name": 0-100的整数 (对各话题的兴趣度)
  },
  "weak_topics": ["薄弱知识点列表"],
  "learning_pace": {
    "daily_hours": 每日学习时长(小时),
    "preferred_time": "偏好时间段",
    "focus_duration": 专注时长(分钟)
  }
}"""

SYSTEM_PROMPT = f"""你是一个专业的学习画像分析师。你的任务是通过对话了解学生的学习情况，构建个性化的学习画像。

## 你的工作方式
1. 通过提问了解学生的学习背景、兴趣、薄弱点
2. 分析学生的回答，提取 6 个维度的信息
3. 用 JSON 格式输出结构化画像

## 输出格式
你必须返回一个 JSON 对象，包含以下 6 个维度：

{PROFILE_SCHEMA}

## 评分标准
- 0-20: 初学者/很弱
- 20-40: 基础薄弱
- 40-60: 中等水平
- 60-80: 较好
- 80-100: 优秀

## 注意事项
- 每次对话后都要更新画像
- 如果信息不足，用合理默认值填充
- 只返回 JSON，不要有其他文字"""


class ProfileAgent:
    """对话式学生画像提取 Agent"""

    def __init__(self):
        self.system_prompt = SYSTEM_PROMPT

    async def analyze(
        self,
        messages: list[dict],
        current_profile: dict | None = None,
    ) -> dict:
        """分析对话内容，返回 6 维画像 JSON

        Args:
            messages: 对话历史 [{"role": "user", "content": "..."}, ...]
            current_profile: 已有的画像（如有），用于增量更新

        Returns:
            6 维画像字典
        """
        user_prompt = self._build_user_prompt(messages, current_profile)

        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=self.system_prompt,
            max_tokens=2048,
            temperature=0.3,
        )

        content = response["content"]

        profile = self._parse_profile(content)

        validation = await anti_hallucination.validate(
            content=json.dumps(profile, ensure_ascii=False)[:2000],
            knowledge_point=list(profile.get("knowledge_mastery", {}).keys())[0] if profile.get("knowledge_mastery") else "通用知识",
            skip_llm=True,
        )
        profile["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }
        return profile

    def _build_user_prompt(
        self,
        messages: list[dict],
        current_profile: dict | None,
    ) -> str:
        """构建发送给 LLM 的用户 prompt"""
        parts = ["请根据以下对话内容，分析并更新学生的学习画像。"]

        if current_profile:
            parts.append(f"\n当前已有的画像数据：\n{json.dumps(current_profile, ensure_ascii=False, indent=2)}")

        parts.append("\n--- 对话记录 ---")
        for msg in messages:
            role = "学生" if msg["role"] == "user" else "系统"
            parts.append(f"{role}: {msg['content']}")
        parts.append("--- 对话结束 ---")

        parts.append("\n请返回更新后的 6 维画像 JSON。只返回 JSON，不要其他文字。")
        return "\n".join(parts)

    def _parse_profile(self, content: str) -> dict:
        """从 LLM 响应中解析 JSON 画像"""
        from app.services.json_parser import parse_json_response
        result = parse_json_response(content, self._default_profile())
        # 确保所有必需字段存在
        default = self._default_profile()
        for key in default:
            if key not in result:
                result[key] = default[key]
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 analyze()"""
        return await self.analyze(
            messages=state.get("messages", []),
            current_profile=state.get("student_profile"),
        )

    def _default_profile(self) -> dict:
        """返回默认的空画像"""
        return {
            "knowledge_mastery": {
                "机器学习基础": 0,
                "深度学习": 0,
                "自然语言处理": 0,
                "计算机视觉": 0,
                "数据预处理": 0,
                "模型评估": 0,
            },
            "learning_style": {
                "visual": 50,
                "textual": 50,
                "auditory": 50,
                "kinesthetic": 50,
            },
            "cognitive_level": {
                "memory": 50,
                "understand": 50,
                "apply": 50,
                "analyze": 50,
            },
            "interest": {},
            "weak_topics": [],
            "learning_pace": {
                "daily_hours": 2.0,
                "preferred_time": "晚上",
                "focus_duration": 45,
            },
        }


# 全局实例
profile_agent = ProfileAgent()
