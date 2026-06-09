"""Tests for anti-hallucination module (pattern + source layers, no LLM calls)."""

import pytest
from app.services.anti_hallucination import PatternDetector, SourceValidator, ValidationResult


class TestPatternDetector:
    def setup_method(self):
        self.detector = PatternDetector()

    def test_clean_content_passes(self):
        result = self.detector.detect("这是正常的教学内容，不包含可疑引用。")
        assert result.passed is True
        assert result.issues == []

    def test_future_year_reference(self):
        result = self.detector.detect("据 2025 年的最新研究显示...")
        assert result.passed is False
        assert any("未来年份" in i for i in result.issues)

    def test_future_year_published(self):
        result = self.detector.detect("根据 2026 年发表在 Nature 上的论文")
        assert result.passed is False

    def test_exaggerated_accuracy(self):
        result = self.detector.detect("该模型的准确率达到了 99%")
        assert result.passed is False
        assert any("夸大" in i for i in result.issues)

    def test_exaggerated_improvement(self):
        result = self.detector.detect("使用本方法后，效率提升了 80%")
        assert result.passed is False

    def test_fake_expert_quote(self):
        result = self.detector.detect("Hinton 在 2024 年提出了一种新方法")
        assert result.passed is False

    def test_absolute_statement(self):
        result = self.detector.detect("这种方法任何情况下都能 100% 正确")
        assert result.passed is False

    def test_fabricated_study(self):
        result = self.detector.detect("研究表明 75% 的学生更喜欢这种方法")
        assert result.passed is False

    def test_multiple_issues(self):
        result = self.detector.detect(
            "据 2025 年研究，该方法的准确率达到了 98%，Hinton 认为这证明了其有效性。"
        )
        assert len(result.issues) >= 2
        assert result.confidence < 1.0

    def test_normal_scientific_content(self):
        result = self.detector.detect(
            "反向传播算法通过链式法则计算梯度，是深度学习训练的核心算法。"
        )
        assert result.passed is True

    def test_evaluation_related_content(self):
        result = self.detector.detect(
            "该学生的知识掌握度为 75 分，学习风格偏向视觉型。"
        )
        assert result.passed is True


class TestSourceValidator:
    def setup_method(self):
        self.validator = SourceValidator()

    def test_no_citation_no_source_passes(self):
        result = self.validator.validate_citations("正常内容，没有引用。")
        assert result.passed is True

    def test_citation_without_context(self):
        result = self.validator.validate_citations("根据 [1] 可知...")
        assert result.passed is False
        assert any("引用" in i for i in result.issues)

    def test_citation_with_context(self):
        chunks = [{"id": "1", "content": "参考内容"}]
        result = self.validator.validate_citations("根据 [1] 可知...", chunks)
        assert result.passed is True

    def test_mismatched_citation(self):
        chunks = [{"id": "2", "content": "参考内容"}]
        result = self.validator.validate_citations("根据 [1] 可知...", chunks)
        assert result.passed is False

    def test_chinese_reference_marker(self):
        result = self.validator.validate_citations("参考：一些引用内容")
        assert result.passed is False

    def test_no_citation_with_context(self):
        chunks = [{"id": "1", "content": "参考内容"}]
        result = self.validator.validate_citations("没有引用标记的内容", chunks)
        assert result.passed is True


class TestValidationResult:
    def test_default_values(self):
        r = ValidationResult(passed=True)
        assert r.issues == []
        assert r.confidence == 1.0
        assert r.raw_content == ""

    def test_custom_values(self):
        r = ValidationResult(passed=False, issues=["错误1"], confidence=0.3, raw_content="内容")
        assert r.passed is False
        assert r.issues == ["错误1"]
        assert r.confidence == 0.3
        assert r.raw_content == "内容"
