"""内容安全服务 — 敏感词过滤 + LLM 语义安全检查

过滤违规内容，确保生成的教育资源安全合规。
"""

import re
from dataclasses import dataclass, field
from app.services.llm_factory import get_llm_client
from app.services.json_parser import parse_json_response


@dataclass
class SafetyResult:
    """安全检查结果"""
    passed: bool
    reasons: list[str] = field(default_factory=list)
    safe_content: str = ""


class ContentSafety:
    """内容安全检查器"""

    SENSITIVE_PATTERNS = [
        (r"(?:色情|裸体|性行为|成人内容)", "色情内容"),
        (r"(?:暴力|血腥|虐待|杀害)", "暴力内容"),
        (r"(?:赌博|博彩|彩票)", "赌博内容"),
        (r"(?:毒品|吸毒|贩毒)", "毒品相关"),
        (r"(?:政治敏感|反动|颠覆)", "政治敏感内容"),
        (r"(?:歧视|种族|性别歧视)", "歧视内容"),
        (r"(?:诈骗|传销|非法集资)", "诈骗内容"),
        (r"(?:枪支|炸药|武器)", "危险物品"),
    ]

    def check_sensitive_words(self, content: str) -> SafetyResult:
        """敏感词检测"""
        reasons = []

        for pattern, category in self.SENSITIVE_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                reasons.append(f"包含{category}相关词汇")

        return SafetyResult(
            passed=len(reasons) == 0,
            reasons=reasons,
            safe_content=content,
        )

    async def check_with_llm(self, content: str) -> SafetyResult:
        """LLM 语义安全检查"""
        prompt = f"""你是一个内容安全审核专家。请检查以下内容是否安全合规。

内容:
{content[:2000]}

判断标准:
1. 是否包含色情、暴力、赌博、毒品等违规内容
2. 是否包含政治敏感内容
3. 是否包含歧视性内容
4. 是否适合教育场景

返回 JSON: {{"passed": true/false, "reasons": ["原因1", "原因2"]}}

只返回 JSON。"""

        try:
            response = await get_llm_client().chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是内容安全审核专家。只返回 JSON。",
                max_tokens=1024,
                temperature=0.1,
            )

            data = parse_json_response(response["content"], {"passed": True, "reasons": []})
            return SafetyResult(
                passed=data.get("passed", True),
                reasons=data.get("reasons", []),
                safe_content=content,
            )

        except Exception:
            return SafetyResult(passed=True, safe_content=content)

    async def validate(self, content: str, use_llm: bool = False) -> SafetyResult:
        """综合内容安全检查

        Args:
            content: 待检查内容
            use_llm: 是否使用 LLM 语义检查（更准确但更慢）

        Returns:
            SafetyResult
        """
        word_result = self.check_sensitive_words(content)

        if not word_result.passed:
            return word_result

        if use_llm:
            return await self.check_with_llm(content)

        return SafetyResult(passed=True, safe_content=content)


content_safety = ContentSafety()
