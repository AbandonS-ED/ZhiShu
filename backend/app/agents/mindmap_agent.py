"""MindMap Agent — 思维导图 Mermaid 生成

根据知识主题和 variant，生成 Mermaid mindmap 代码：
- variant: concept_map=概念节点图（入门）/ relation_graph=知识点关系图（进阶）
"""

import re
from app.services.llm_factory import get_llm_client
from app.services.anti_hallucination import anti_hallucination
from app.services.json_parser import parse_json_response


class MindMapAgent:
    """思维导图生成 Agent"""

    SYSTEM_PROMPT_CONCEPT_MAP = """你是一个专业的思维导图生成器。根据知识主题，生成**概念节点式**思维导图。

## 输出格式（严格按此格式输出，只返回 JSON）
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

## 生成要求（概念节点图）
- 中心主题要准确概括知识点
- 分支要逻辑清晰，层次分明
- 每个分支下至少 2-3 个子节点
- 总节点数控制在 8-15 个
- 适合初学者入门，建立基本概念框架
- 只返回 JSON，不要其他文字"""

    SYSTEM_PROMPT_RELATION_GRAPH = """你是一个专业的思维导图生成器。根据知识主题，生成**知识点关系式**思维导图。

## 输出格式（严格按此格式输出，只返回 JSON）
{
  "title": "思维导图标题",
  "mermaid_code": "mindmap\\n  root((中心主题))\\n    分支1\\n      子节点1\\n      子节点2\\n    分支2\\n      子节点3",
  "nodes": ["节点1", "节点2", "节点3"],
  "description": "简要说明知识点之间的逻辑推导关系"
}

## Mermaid mindmap 语法规则
- 第一行必须是 `mindmap`
- 根节点用 `((圆括号))` 表示
- 一级分支用 2 个空格缩进
- 二级分支用 4 个空格缩进
- 三级分支用 6 个空格缩进
- 节点文本不要包含特殊字符（冒号、引号、花括号）

## 生成要求（关系图）
- 重点展示知识点之间的逻辑推导关系（前置→后置）
- 分支代表：因果关系、递进关系、对比关系
- 适合进阶学习者，理解知识脉络
- 总节点数控制在 10-18 个
- 只返回 JSON，不要其他文字"""

    FALLBACK_MERMAID = "mindmap\n  root((学习主题))\n    概念1\n      细节A\n      细节B\n    概念2\n      细节C\n      细节D"

    _VARIANT_PROMPTS = {
        "concept_map": SYSTEM_PROMPT_CONCEPT_MAP,
        "relation_graph": SYSTEM_PROMPT_RELATION_GRAPH,
    }

    async def generate(
        self,
        knowledge_point: str,
        student_profile: dict | None = None,
        variant: str = "concept_map",
    ) -> dict:
        """生成思维导图

        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像（可选，用于调整深度）
            variant: concept_map=概念节点图 / relation_graph=关系图

        Returns:
            {title: str, mermaid_code: str, nodes: list, description: str}
        """
        system_prompt = self._VARIANT_PROMPTS.get(variant, self.SYSTEM_PROMPT_CONCEPT_MAP)
        user_prompt = self._build_prompt(knowledge_point, student_profile, variant)

        result = await self._generate_once(user_prompt, system_prompt)

        if self._is_fallback_result(result):
            retry_prompt = user_prompt + "\n【重要】请务必返回有效的 JSON 格式。Mermaid mindmap 必须包含至少 3 个一级分支，每个分支至少 2 个子节点。"
            result = await self._generate_once(retry_prompt, system_prompt)

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
        result["_variant"] = variant
        return result

    async def execute(self, state: dict) -> dict:
        """从 AgentState 解包参数，调用 generate()"""
        kp = state.get("intent_params", {}).get("knowledge_point", "通用知识")
        return await self.generate(
            knowledge_point=kp,
            student_profile=state.get("student_profile"),
            variant=state.get("intent_params", {}).get("variant", "concept_map"),
        )

    async def _generate_once(self, user_prompt: str, system_prompt: str) -> dict:
        response = await get_llm_client().chat(
            messages=[{"role": "user", "content": user_prompt}],
            system=system_prompt,
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
        variant: str = "concept_map",
    ) -> str:
        parts = [f"请为「{knowledge_point}」生成思维导图（variant={variant}）。"]

        if student_profile:
            dims = student_profile.get("dimensions", {})
            knowledge_base = dims.get("knowledge_base", {})
            kb_score = knowledge_base.get("score", 50)
            if kb_score < 50:
                parts.append("\n学生基础较弱，思维导图要简洁清晰，只包含核心概念，层级不超过3层。")
            elif kb_score >= 70:
                parts.append("\n学生基础较好，可以包含更多细节和扩展节点。")

        parts.append("\n请返回 JSON 格式。只返回 JSON。")
        return "\n".join(parts)

    def _validate_mermaid(self, code: str) -> str:
        if not code:
            return "mindmap\n  root((学习主题))\n    概念1\n      细节A\n      细节B\n    概念2\n      细节C\n      细节D"

        code = code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        code = code.strip()
        if not code.startswith("mindmap"):
            code = "mindmap\n" + code

        cleaned_lines = []
        for line in code.split("\n"):
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
