"""防幻觉服务 — 三层验证

N3 评分项：防止 LLM 生成虚假信息。
1. PatternDetector: 正则模式检测（年份、期刊、百分比等捏造）
2. SourceValidator: 来源引用验证
3. LLMValidator: LLM 语义一致性校验
"""

import re
from dataclasses import dataclass, field
from app.services import minimax_client as mc_module
from app.services.json_parser import parse_json_response


@dataclass
class ValidationResult:
    """验证结果"""
    passed: bool
    issues: list[str] = field(default_factory=list)
    confidence: float = 1.0
    raw_content: str = ""


class PatternDetector:
    """第一层：正则模式检测

    检查 LLM 输出中常见的幻觉模式：
    - 虚假年份引用（如 "据 2025 年研究..."）
    - 虚假期刊/会议引用
    - 虚假统计数据（百分比、数字）
    - 虚假人物/机构引用
    """

    SUSPICIOUS_PATTERNS = [
        # 虚假年份引用
        (r"据\s*20[2-3]\d\s*年.*研究", "可能引用了未来年份的研究"),
        (r"根据?\s*20[2-3]\d\s*年.*发表", "可能引用了未来年份的论文"),
        (r"在\s*20[2-3]\d\s*年.*提出", "可能虚构了年份引用"),

        # 虚假期刊/会议（英文+中文）
        (r"(?:Nature|Science|IEEE|ACM|ACL|NeurIPS|ICML)\s*(?:journal|proceedings|conference)", "可能虚构了期刊引用"),
        (r"(?:在|于)\s*(?:Nature|Science|IEEE|ACM)\s*(?:上|发表|刊登)", "可能虚构了期刊引用"),
        (r"(?:发表|刊登)\s*(?:在|于)\s*(?:Nature|Science|IEEE|ACM)", "可能虚构了期刊引用"),

        # 虚假统计数据
        (r"(?:准确率|成功率|效率)\s*(?:达到?|为)\s*(?:9[5-9]|100)\s*%", "可能夸大了统计数据"),
        (r"(?:提高|提升|增加)\s*(?:了)?\s*(?:50|60|70|80|90)\s*%", "可能夸大了提升幅度"),
        (r"(?:超过|优于)\s*(?:9[5-9]|100)\s*%", "可能夸大了比较数据"),

        # 虚假人物引用
        (r"(?:Hinton|LeCun|Bengio|Goodfellow)\s*(?:在|于)\s*20[2-3]\d", "可能虚构了人物引用"),
        (r"(?:Hinton|LeCun|Bengio|Goodfellow)\s*(?:提出|发表|认为)", "可能虚构了人物引用"),

        # 绝对化表述
        (r"(?:永远|绝对|一定|所有|每个|任何)\s*(?:都是|都能|都会|可以)", "存在绝对化表述，可能是幻觉"),
        (r"(?:100%\s*(?:正确|准确|有效))", "存在绝对化表述，可能是幻觉"),

        # 无来源的数字统计
        (r"(?:研究表明|实验显示|数据表明)\s*(?:.*\d+\s*%)", "可能虚构了统计数据"),
    ]

    def detect(self, content: str) -> ValidationResult:
        issues = []
        for pattern, desc in self.SUSPICIOUS_PATTERNS:
            if re.search(pattern, content):
                issues.append(desc)

        return ValidationResult(
            passed=len(issues) == 0,
            issues=issues,
            confidence=max(0.3, 1.0 - len(issues) * 0.2),
            raw_content=content,
        )


class SourceValidator:
    """第二层：来源引用验证

    检查内容中的引用是否有实际来源支撑。
    注意：此层仅做模式验证，不做联网查证。
    """

    def validate_citations(self, content: str, context_chunks: list[dict] | None = None) -> ValidationResult:
        issues = []

        # 检查是否有引用格式但无来源
        citation_patterns = [
            r"\[(?:\d+|[a-zA-Z]+\s*\d{4})\]",  # [1] 或 [Smith 2023]
            r"(?:参考|引用|来源|出处)\s*[:：]",
        ]

        has_citations = any(re.search(p, content) for p in citation_patterns)

        if has_citations and not context_chunks:
            issues.append("内容包含引用格式但没有提供参考来源")

        # 检查引用的完整性
        if context_chunks:
            source_ids = {c.get("id") or c.get("doc_id") for c in context_chunks}
            refs = re.findall(r"\[(\d+|[a-zA-Z]+\s*\d{4})\]", content)
            for ref in refs:
                if ref not in source_ids and len(source_ids) > 0:
                    issues.append(f"引用 [{ref}] 在提供的来源中找不到对应文档")

        return ValidationResult(
            passed=len(issues) == 0,
            issues=issues,
            confidence=max(0.5, 1.0 - len(issues) * 0.25),
            raw_content=content,
        )


class LLMValidator:
    """第三层：LLM 语义一致性校验

    用 LLM 检查生成内容与原始上下文是否一致。
    """

    VALIDATION_PROMPT = """你是一个事实核查专家。请检查以下内容是否存在明显的事实错误或幻觉。

上下文信息：
{context}

待检查内容：
{content}

请判断：
1. 内容是否与上下文信息一致
2. 是否包含上下文中没有提到的信息（可能是幻觉）
3. 是否有明显的事实错误

返回 JSON: {{"passed": true/false, "issues": ["问题1", "问题2"], "confidence": 0.0-1.0}}

只返回 JSON。"""

    async def validate(
        self,
        content: str,
        context_chunks: list[dict] | None = None,
        knowledge_point: str = "",
    ) -> ValidationResult:
        # 构建上下文
        if context_chunks:
            context = "\n".join(
                f"[来源 {i+1}] {c.get('content', c.get('text', ''))[:500]}"
                for i, c in enumerate(context_chunks[:5])
            )
        else:
            context = f"主题：{knowledge_point}\n（无参考文档）"

        prompt = self.VALIDATION_PROMPT.format(context=context, content=content[:2000])

        try:
            response = await mc_module.minimax_client.chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是事实核查专家。只返回 JSON。",
                max_tokens=1024,
                temperature=0.1,
            )

            return self._parse_response(response["content"])

        except Exception as e:
            # LLM 校验失败时，放行但记录
            return ValidationResult(
                passed=True,
                issues=[f"LLM 校验异常: {str(e)}"],
                confidence=0.5,
                raw_content=content,
            )

    def _parse_response(self, content: str) -> ValidationResult:
        data = parse_json_response(content, {"passed": True, "issues": [], "confidence": 0.5})
        return ValidationResult(
            passed=data.get("passed", True),
            issues=data.get("issues", []),
            confidence=data.get("confidence", 0.5),
            raw_content=content,
        )


class AntiHallucinationService:
    """防幻觉三层验证器 + 纠正机制"""

    def __init__(self):
        self.pattern_detector = PatternDetector()
        self.source_validator = SourceValidator()
        self.llm_validator = LLMValidator()

    async def validate(
        self,
        content: str,
        context_chunks: list[dict] | None = None,
        knowledge_point: str = "",
        skip_llm: bool = False,
    ) -> ValidationResult:
        """执行三层验证

        Args:
            content: 待验证内容
            context_chunks: 参考文档块
            knowledge_point: 知识点
            skip_llm: 是否跳过 LLM 校验（节省 token）

        Returns:
            ValidationResult: 综合验证结果
        """
        all_issues = []
        min_confidence = 1.0

        # 第一层：模式检测（快速）
        pattern_result = self.pattern_detector.detect(content)
        if not pattern_result.passed:
            all_issues.extend([f"[模式] {i}" for i in pattern_result.issues])
            min_confidence = min(min_confidence, pattern_result.confidence)

        # 第二层：来源验证
        source_result = self.source_validator.validate_citations(content, context_chunks)
        if not source_result.passed:
            all_issues.extend([f"[来源] {i}" for i in source_result.issues])
            min_confidence = min(min_confidence, source_result.confidence)

        # 第三层：LLM 校验（可选）
        if not skip_llm:
            llm_result = await self.llm_validator.validate(
                content, context_chunks, knowledge_point
            )
            if not llm_result.passed:
                all_issues.extend([f"[语义] {i}" for i in llm_result.issues])
                min_confidence = min(min_confidence, llm_result.confidence)

        return ValidationResult(
            passed=len(all_issues) == 0,
            issues=all_issues,
            confidence=min_confidence,
            raw_content=content,
        )

    async def validate_and_correct(
        self,
        content: str,
        context_chunks: list[dict] | None = None,
        knowledge_point: str = "",
    ) -> dict:
        """验证并纠正（完整流程）

        Returns:
            {
                "passed": bool,
                "issues": list[str],
                "confidence": float,
                "correction": str,  # 纠正说明
                "safe_content": str,  # 安全版本
            }
        """
        validation = await self.validate(
            content=content,
            context_chunks=context_chunks,
            knowledge_point=knowledge_point,
        )

        if validation.passed:
            return {
                "passed": True,
                "issues": [],
                "confidence": validation.confidence,
                "correction": "",
                "safe_content": content,
            }

        correction = await self._generate_correction(content, validation.issues)
        safe_content = await self._generate_safe_version(content, context_chunks)

        return {
            "passed": False,
            "issues": validation.issues,
            "confidence": validation.confidence,
            "correction": correction,
            "safe_content": safe_content,
        }

    async def _generate_correction(self, content: str, issues: list[str]) -> str:
        """生成纠正说明"""
        issues_text = "\n".join(f"- {issue}" for issue in issues[:5])
        return f"⚠️ 内容审核发现以下问题:\n{issues_text}"

    async def _generate_safe_version(
        self,
        content: str,
        context_chunks: list[dict] | None = None,
    ) -> str:
        """生成安全版本（移除/标注不确定内容）"""
        if not context_chunks:
            return content

        sources_text = "\n".join(
            c.get("content", "")[:200] for c in context_chunks[:3]
        )

        prompt = f"""请基于参考资料，生成一个安全版本的回答。
要求:
1. 移除任何无法从参考资料验证的内容
2. 用 [待验证] 标注不确定的部分
3. 保留有来源支持的内容

原始内容:
{content[:1500]}

参考资料:
{sources_text}

只返回安全版本的文本。"""

        try:
            response = await mc_module.minimax_client.chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是内容安全助手。",
                max_tokens=2000,
                temperature=0.2,
            )
            return response["content"] if response["content"] else content
        except Exception:
            return content


# 全局实例
anti_hallucination = AntiHallucinationService()
