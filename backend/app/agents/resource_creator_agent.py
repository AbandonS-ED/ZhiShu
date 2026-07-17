"""Resource Creator Agent — 多学科智能资源生成

支持多种学科类型：
- 编程类：代码示例 + 知识讲解 + 练习题
- 数学类：公式推导 + 例题解析 + 练习题
- 理论类：知识梳理 + 重点总结 + 练习题
- 文科类：知识框架 + 要点归纳 + 练习题

输出 JSON 含 knowledge / code / mermaid_code / exercises / message 五个字段。
"""

import logging
from typing import AsyncGenerator

from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)

# 学科分类关键词
PROGRAMMING_KEYWORDS = [
    'python', 'java', 'c++', 'javascript', '编程', '程序', '代码', '算法',
    '数据结构', '开发', '软件', '前端', '后端', '数据库', 'sql', 'html',
    'css', 'react', 'vue', 'node', 'git', 'docker', 'linux', 'api'
]

MATH_KEYWORDS = [
    '数学', '微积分', '线性代数', '概率', '统计', '方程', '函数', '极限',
    '导数', '积分', '矩阵', '向量', '几何', '代数', '数论', '离散数学',
    '高等数学', '数学分析', '复变函数', '实变函数', '泛函分析'
]

SCIENCE_KEYWORDS = [
    '物理', '化学', '生物', '天文', '地理', '科学', '实验', '力学',
    '电磁', '光学', '热学', '量子', '有机', '无机', '分子', '细胞'
]

THEORY_KEYWORDS = [
    '原理', '理论', '概念', '定义', '历史', '哲学', '文学', '艺术',
    '音乐', '美术', '设计', '管理', '经济', '金融', '心理', '教育',
    '社会', '政治', '法律', '伦理', '美学'
]


def detect_subject_type(knowledge_point: str) -> str:
    """检测学科类型"""
    kp_lower = knowledge_point.lower()
    
    # 检查编程类
    for keyword in PROGRAMMING_KEYWORDS:
        if keyword in kp_lower:
            return "programming"
    
    # 检查数学类
    for keyword in MATH_KEYWORDS:
        if keyword in kp_lower:
            return "math"
    
    # 检查科学类
    for keyword in SCIENCE_KEYWORDS:
        if keyword in kp_lower:
            return "science"
    
    # 默认为理论类
    return "theory"


# 编程类系统提示
PROGRAMMING_SYSTEM_PROMPT = """你是一个专业的编程学习资源生成器。根据用户需求生成高质量的编程学习资源。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "知识讲解（Markdown 格式，300-600字）：包含概念定义、核心原理、使用场景、注意事项",
  "code": "代码示例（含关键注释，说明时间/空间复杂度）：完整可运行的示例代码",
  "mermaid_code": "思维导图的 Mermaid mindmap 代码，第一行必须是 mindmap",
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "详细解析",
      "difficulty": 50
    }
  ],
  "message": "给用户的回复消息，简要说明你生成了什么内容"
}

## 质量要求
- knowledge：结构清晰，有层次，适合目标学生水平
- code：可运行，有注释，展示核心实现，代码要实用
- mermaid_code：节点 8-15 个，层次分明，不要包含特殊字符
- exercises：生成 3-5 道混合难度练习题（difficulty 30-80），选择题 4 个选项
- message：友好自然，像老师给学生讲解前的引导语
- 只返回 JSON，不要其他文字"""

# 数学类系统提示
MATH_SYSTEM_PROMPT = """你是一个专业的数学学习资源生成器。根据用户需求生成高质量的数学学习资源。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "知识讲解（Markdown 格式，400-800字）：包含定义、定理、公式推导、几何直觉、典型例题",
  "code": "不需要代码，留空字符串 \"\"",
  "mermaid_code": "思维导图的 Mermaid mindmap 代码，第一行必须是 mindmap",
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "详细解析，包含解题步骤",
      "difficulty": 50
    }
  ],
  "message": "给用户的回复消息，简要说明你生成了什么内容"
}

## 质量要求
- knowledge：公式清晰，推导完整，有几何直觉或实际应用背景
- code：留空字符串，数学不需要代码
- mermaid_code：节点 8-15 个，展示知识结构，不要包含特殊字符
- exercises：生成 3-5 道混合难度练习题（difficulty 30-80），包含计算题和证明题
- message：友好自然，像老师给学生讲解前的引导语
- 只返回 JSON，不要其他文字"""

# 科学类系统提示
SCIENCE_SYSTEM_PROMPT = """你是一个专业的科学学习资源生成器。根据用户需求生成高质量的科学学习资源。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "知识讲解（Markdown 格式，400-800字）：包含概念、原理、实验、应用、前沿发展",
  "code": "不需要代码，留空字符串 \"\"",
  "mermaid_code": "思维导图的 Mermaid mindmap 代码，第一行必须是 mindmap",
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "详细解析",
      "difficulty": 50
    }
  ],
  "message": "给用户的回复消息，简要说明你生成了什么内容"
}

## 质量要求
- knowledge：概念清晰，原理透彻，联系实际应用
- code：留空字符串，科学理论不需要代码
- mermaid_code：节点 8-15 个，展示知识体系，不要包含特殊字符
- exercises：生成 3-5 道混合难度练习题（difficulty 30-80）
- message：友好自然，像老师给学生讲解前的引导语
- 只返回 JSON，不要其他文字"""

# 理论/文科类系统提示
THEORY_SYSTEM_PROMPT = """你是一个专业的学习资源生成器。根据用户需求生成高质量的学习资源。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "知识讲解（Markdown 格式，400-800字）：包含概念定义、核心要点、逻辑框架、实际案例、拓展思考",
  "code": "不需要代码，留空字符串 \"\"",
  "mermaid_code": "思维导图的 Mermaid mindmap 代码，第一行必须是 mindmap",
  "exercises": [
    {
      "type": "choice",
      "question": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "详细解析",
      "difficulty": 50
    }
  ],
  "message": "给用户的回复消息，简要说明你生成了什么内容"
}

## 质量要求
- knowledge：结构清晰，逻辑严密，有案例支撑
- code：留空字符串，理论学科不需要代码
- mermaid_code：节点 8-15 个，展示知识框架，不要包含特殊字符
- exercises：生成 3-5 道混合难度练习题（difficulty 30-80），包含理解题和应用题
- message：友好自然，像老师给学生讲解前的引导语
- 只返回 JSON，不要其他文字"""

MODIFY_SYSTEM_PROMPT = """你是一个学习资源编辑助手。用户对已有的学习资源提出了修改意见，你需要根据意见修改对应部分，保持其他部分不变。

## 修改规则
1. 分析用户的修改请求，判断要修改哪个部分（knowledge / code / mermaid_code / exercises）
2. 只重新生成用户要求修改的部分，其他部分保持原样
3. 如果用户的要求不明确，默认修改 knowledge 部分
4. 修改后更新 message 字段，说明做了什么修改

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "knowledge": "修改后的知识讲解（如果未修改则保持原样）",
  "code": "修改后的代码（如果未修改则保持原样）",
  "mermaid_code": "修改后的思维导图（如果未修改则保持原样）",
  "exercises": [...],
  "message": "说明做了哪些修改"
}

- 只返回 JSON，不要其他文字"""


class ResourceCreatorAgent:
    """多学科智能资源生成 Agent"""

    def _get_system_prompt(self, knowledge_point: str) -> str:
        """根据知识点获取对应的系统提示"""
        subject_type = detect_subject_type(knowledge_point)
        
        if subject_type == "programming":
            return PROGRAMMING_SYSTEM_PROMPT
        elif subject_type == "math":
            return MATH_SYSTEM_PROMPT
        elif subject_type == "science":
            return SCIENCE_SYSTEM_PROMPT
        else:
            return THEORY_SYSTEM_PROMPT

    async def generate(
        self,
        user_message: str,
        conversation_history: list[dict] | None = None,
        student_profile: dict | None = None,
    ) -> dict:
        """根据用户需求生成完整学习资源

        Args:
            user_message: 用户当前消息
            conversation_history: 多轮对话历史
            student_profile: 学生画像（可选）

        Returns:
            {knowledge, code, mermaid_code, exercises, message}
        """
        # 检测学科类型并获取对应的系统提示
        system_prompt = self._get_system_prompt(user_message)
        
        user_prompt = self._build_generate_prompt(user_message, student_profile)
        messages = self._build_messages(conversation_history, user_prompt)

        response = await get_llm_client().chat(
            messages=messages,
            system=system_prompt,
            max_tokens=6144,
            temperature=0.7,
        )

        return self._parse_response(response["content"])

    async def stream_generate(
        self,
        user_message: str,
        conversation_history: list[dict] | None = None,
        student_profile: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        """流式生成学习资源"""
        system_prompt = self._get_system_prompt(user_message)
        user_prompt = self._build_generate_prompt(user_message, student_profile)
        messages = self._build_messages(conversation_history, user_prompt)

        async for chunk in get_llm_client().chat_stream(
            messages=messages,
            system=system_prompt,
            max_tokens=6144,
            temperature=0.7,
        ):
            yield chunk

    async def modify(
        self,
        current_content: dict,
        user_message: str,
        conversation_history: list[dict] | None = None,
    ) -> dict:
        """根据用户反馈修改资源"""
        modify_prompt = f"""当前学习资源：
{current_content}

用户修改请求：{user_message}

请根据用户的修改请求，修改对应部分，保持其他部分不变。"""

        messages = self._build_messages(conversation_history, modify_prompt)

        response = await get_llm_client().chat(
            messages=messages,
            system=MODIFY_SYSTEM_PROMPT,
            max_tokens=6144,
            temperature=0.7,
        )

        return self._parse_response(response["content"])

    def _build_generate_prompt(
        self, user_message: str, student_profile: dict | None
    ) -> str:
        """构建生成提示"""
        prompt = f"请生成关于「{user_message}」的学习资源。"
        
        if student_profile:
            dims = student_profile.get("dimensions", {})
            if dims:
                weak_points = [k for k, v in dims.items() if v < 50]
                if weak_points:
                    prompt += f"\n学生薄弱点：{', '.join(weak_points)}，请适当加强这部分内容。"
        
        return prompt

    def _build_messages(
        self, conversation_history: list[dict] | None, user_prompt: str
    ) -> list[dict]:
        """构建消息列表"""
        messages = []
        
        if conversation_history:
            # 只保留最近5轮对话
            recent_history = conversation_history[-10:]
            messages.extend(recent_history)
        
        messages.append({"role": "user", "content": user_prompt})
        return messages

    def _parse_response(self, content: str) -> dict:
        """解析LLM响应"""
        result = parse_json_response(content, {
            "knowledge": content,
            "code": "",
            "mermaid_code": "",
            "exercises": [],
            "message": "已生成学习资源"
        })
        # 确保所有必需字段存在
        return {
            "knowledge": result.get("knowledge", content),
            "code": result.get("code", ""),
            "mermaid_code": result.get("mermaid_code", ""),
            "exercises": result.get("exercises", []),
            "message": result.get("message", "已生成学习资源")
        }


# 创建全局实例
resource_creator_agent = ResourceCreatorAgent()
