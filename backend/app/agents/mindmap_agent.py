"""MindMap Agent — 思维导图 Mermaid 生成

根据知识主题和学生画像，生成 Mermaid mindmap 代码，
用于前端渲染可视化知识结构。
"""

import re
from app.services import minimax_client as mc_module
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response


class MindMapAgent:
    """思维导图生成 Agent"""

    SYSTEM_PROMPT = """你是一个专业的思维导图生成器。根据知识主题，生成 Mermaid mindmap 格式的思维导图代码。

你的输出必须是一个 JSON 对象：
{
  "title": "思维导图标题",
  "mermaid_code": "mindmap\\n  root((中心主题))\\n    分支1\\n      子节点1\\n      子节点2\\n    分支2\\n      子节点3",
  "nodes": ["节点1", "节点2", "节点3"],
  "description": "简要说明这个知识结构的核心要点"
}

## Mermaid mindmap 语法规则
- 第一行必须是 `mindmap`
- 根节点用 `((圆括号))` 表示
- 一级分支用 2 个空格缩进
- 二级分支用 4 个空格缩进
- 三级分支用 6 个空格缩进
- 节点文本不要包含特殊字符（冒号、引号、花括号）

## 生成要求
- 中心主题要准确概括知识点
- 分支要逻辑清晰，层次分明
- 每个分支下至少 2-3 个子节点
- 总节点数控制在 8-15 个
- 根据学生掌握程度调整深度（薄弱点多展开）
- 只返回 JSON，不要其他文字"""

    FALLBACK_MERMAID = "mindmap\n  root((学习主题))\n    概念1\n      细节A\n      细节B\n    概念2\n      细节C\n      细节D"

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
    ) -> dict:
        """生成思维导图

        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选，用于调整深度）

        Returns:
            {title: str, mermaid_code: str, nodes: list, description: str}
        """
        user_prompt = self._build_prompt(knowledge_point, student_profile)

        result = await self._generate_once(user_prompt)

        if self._is_fallback_result(result):
            retry_prompt = user_prompt + "\n【重要】请务必返回有效的 JSON 格式。Mermaid mindmap 必须包含至少 3 个一级分支，每个分支至少 2 个子节点。"
            result = await self._generate_once(retry_prompt)

        validation = await anti_hallucination.validate(
            content=result.get("description", "") + "\n" + " ".join(result.get("nodes", [])),
            knowledge_point=knowledge_point,
            skip_llm=True,
        )
        result["validation"] = {
            "passed": validation.passed,
            "issues": validation.issues,
            "confidence": validation.confidence,
        }

        result["mermaid_code"] = self._validate_mermaid(result.get("mermaid_code", ""))
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.generate(
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
        )

    async def _generate_once(self, user_prompt: str) -> dict:
        response = await mc_module.minimax_client.chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=self.SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.5,
        )
        return self._parse_response(response["content"])

    def _is_fallback_result(self, result: dict) -> bool:
        code = (result.get("mermaid_code") or "").strip()
        if not code:
            return True
        if code == self.FALLBACK_MERMAID:
            return True
        if code.startswith("mindmap") and "学习主题" in code:
            return True
        return False

    def _build_prompt(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成一个思维导图。"]

        if student_profile:
            # 根据学生画像调整思维导图深度
            dims = student_profile.get("dimensions", {})

            # 知识基础影响深度
            knowledge_base = dims.get("knowledge_base", {})
            kb_score = knowledge_base.get("score", 50)
            if kb_score < 50:
                parts.append("\n学生基础较弱，请生成简洁的思维导图，只包含核心概念，层级不超过3层。")
            elif kb_score >= 70:
                parts.append("\n学生基础较好，可以生成详细的思维导图，包含更多细节和扩展。")

            # 理解力影响分支复杂度
            comprehension = dims.get("comprehension", {})
            if comprehension.get("score", 50) < 50:
                parts.append("\n学生理解力一般，思维导图的分支要简洁清晰，避免过于复杂的层级。")

        parts.append("\n请返回 JSON 格式。只返回 JSON。")

        return "\n".join(parts)

    def _validate_mermaid(self, code: str) -> str:
        """验证并清理 Mermaid mindmap 代码

        - 确保以 mindmap 开头
        - 移除非法字符
        - 修复缩进
        """
        if not code:
            return "mindmap\n  root((学习主题))"

        # 移除可能的 markdown code block 包裹
        code = code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        # 确保以 mindmap 开头
        code = code.strip()
        if not code.startswith("mindmap"):
            code = "mindmap\n" + code

        # 移除非法字符（保留基本结构字符）
        cleaned_lines = []
        for line in code.split("\n"):
            # 移除引号、花括号等非法字符
            line = re.sub(r'["\'{}]', '', line)
            cleaned_lines.append(line)

        return "\n".join(cleaned_lines)

    def _parse_response(self, content: str) -> dict:
        return parse_json_response(content, {
            "title": "知识思维导图",
            "mermaid_code": "mindmap\n  root((学习主题))\n    概念1\n      细节A\n      细节B\n    概念2\n      细节C\n      细节D",
            "nodes": [],
            "description": content,
        })


mindmap_agent = MindMapAgent()
