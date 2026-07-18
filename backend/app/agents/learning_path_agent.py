"""学习路径生成Agent - 根据用户输入，AI自主分析并拆分学习路径"""

import logging
from typing import Dict, Any, Optional
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response

logger = logging.getLogger(__name__)


class LearningPathAgent:
    """学习路径生成Agent - AI根据用户输入自主拆分学习模块"""

    def _parse_response(self, content: str) -> dict:
        """解析LLM响应"""
        return parse_json_response(content, {})

    async def generate_path(
        self,
        target_knowledge: str,
        current_level: str = "beginner",
        student_profile: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """生成学习路径 - AI根据用户输入自主分析拆分"""
        llm = get_llm_client()

        profile_info = ""
        if student_profile:
            dims = student_profile.get("dimensions", {})
            if dims:
                # 确保dims的值是数字类型
                weak = []
                strong = []
                for k, v in dims.items():
                    if isinstance(v, (int, float)):
                        if v < 50:
                            weak.append(k)
                        elif v >= 70:
                            strong.append(k)
                if weak:
                    profile_info += f"学生薄弱点: {', '.join(weak)}\n"
                if strong:
                    profile_info += f"学生优势: {', '.join(strong)}\n"

        level_map = {
            "beginner": "零基础",
            "intermediate": "有一定基础",
            "advanced": "进阶水平"
        }
        level_desc = level_map.get(current_level, current_level)

        system_prompt = """你是一个专业的学习规划师。用户会告诉你一个想学习的主题，你需要：

1. **深入分析**这个主题的本质——它包含哪些核心知识模块？这些模块之间的逻辑关系是什么？
2. **自主拆分**——不要照搬任何教材目录，而是根据这个主题的实际内容，思考一个学习者从零到掌握需要经历哪些步骤
3. **知识点要具体**——每个节点必须是一个可独立学习的具体知识点，不能是"概述"、"基础"、"进阶"这样笼统的词
4. **依赖关系要真实**——哪些知识必须先学才能学后面的？哪些可以并行？
5. **数量灵活**——根据主题的复杂度决定节点数量，简单主题5-8个，复杂主题10-15个

输出格式（JSON）:
{
  "name": "学习路径名称",
  "description": "简要描述这条路径的思路和目标",
  "nodes": [
    {
      "id": "node_1",
      "knowledge_point": "具体知识点名称",
      "category": "所属模块",
      "order": 1,
      "status": "pending",
      "prerequisites": [],
      "description": "一句话说明为什么学这个、学完能做什么"
    }
  ]
}"""

        user_prompt = f"""我想学习：{target_knowledge}

当前水平：{level_desc}
{profile_info}
请根据这个主题的实际内容，自主分析应该分成哪些知识模块来学习，按逻辑顺序排列。不要套用任何模板，要针对这个具体主题思考。"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = await llm.chat(messages, max_tokens=4096, temperature=0.7)
        content = response.get("content", "")

        path_data = self._parse_response(content)

        if "nodes" in path_data and len(path_data["nodes"]) > 0:
            for i, node in enumerate(path_data["nodes"]):
                node["id"] = f"node_{i + 1}"
                node["order"] = i + 1
                node["status"] = "current" if i == 0 else "pending"
                if i == 0:
                    node["prerequisites"] = []
                elif "prerequisites" not in node:
                    node["prerequisites"] = [f"node_{i}"]

            return path_data

        raise ValueError(f"AI未能生成有效的学习路径，原始响应: {content[:500]}")


learning_path_agent = LearningPathAgent()
