"""语义切片器 — 文本切分

策略: 按标题层级切分 + 重叠窗口 + token 限制
"""

import re
from dataclasses import dataclass, field


@dataclass
class TextChunk:
    content: str
    chunk_index: int
    section_title: str = ""
    token_count: int = 0
    metadata: dict = field(default_factory=dict)


class SemanticChunker:
    """基于语义的文本切片器"""

    def __init__(
        self,
        max_tokens: int = 512,
        overlap_tokens: int = 64,
        min_chunk_tokens: int = 50,
    ):
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self.min_chunk_tokens = min_chunk_tokens

    def count_tokens(self, text: str) -> int:
        return len(text) // 2  # 简化估算：中文约 2 字符/token

    def chunk_document(self, pages: list, metadata: dict = None) -> list[TextChunk]:
        all_chunks = []
        chunk_index = 0

        for page in pages:
            page_chunks = self._chunk_page(
                page.text,
                page.page_number,
                page.metadata.get("section_title", ""),
            )
            for chunk in page_chunks:
                chunk.chunk_index = chunk_index
                chunk.metadata.update(metadata or {})
                chunk.metadata["page_number"] = page.page_number
                all_chunks.append(chunk)
                chunk_index += 1

        return all_chunks

    def _chunk_page(self, text: str, page_number: int, default_title: str = "") -> list[TextChunk]:
        sections = self._split_by_headers(text)

        chunks = []
        for section_title, section_text in sections:
            if not section_text.strip():
                continue

            paragraphs = self._split_paragraphs(section_text)

            section_chunks = self._merge_paragraphs(
                paragraphs, section_title or default_title
            )
            chunks.extend(section_chunks)

        return chunks

    def _split_by_headers(self, text: str) -> list[tuple[str, str]]:
        pattern = r"^(#{1,4})\s+(.+)$"
        lines = text.split("\n")

        sections = []
        current_title = ""
        current_lines = []

        for line in lines:
            match = re.match(pattern, line, re.MULTILINE)
            if match:
                if current_lines:
                    sections.append((current_title, "\n".join(current_lines)))
                current_title = match.group(2).strip()
                current_lines = []
            else:
                current_lines.append(line)

        if current_lines:
            sections.append((current_title, "\n".join(current_lines)))

        return sections if sections else [("", text)]

    def _split_paragraphs(self, text: str) -> list[str]:
        paragraphs = re.split(r"\n\s*\n", text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _merge_paragraphs(self, paragraphs: list[str], title: str) -> list[TextChunk]:
        chunks = []
        current_chunk = ""
        current_tokens = 0

        for para in paragraphs:
            para_tokens = self.count_tokens(para)

            if current_tokens + para_tokens > self.max_tokens and current_chunk:
                chunks.append(TextChunk(
                    content=current_chunk.strip(),
                    chunk_index=0,
                    section_title=title,
                    token_count=current_tokens,
                ))

                overlap_text = self._get_overlap(current_chunk)
                current_chunk = overlap_text + "\n\n" + para
                current_tokens = self.count_tokens(current_chunk)
            else:
                current_chunk = current_chunk + "\n\n" + para if current_chunk else para
                current_tokens += para_tokens

        if current_chunk and current_tokens >= self.min_chunk_tokens:
            chunks.append(TextChunk(
                content=current_chunk.strip(),
                chunk_index=0,
                section_title=title,
                token_count=current_tokens,
            ))

        return chunks

    def _get_overlap(self, text: str) -> str:
        if not text:
            return ""

        words = text.split()
        overlap_words = []
        token_count = 0

        for word in reversed(words):
            word_tokens = self.count_tokens(word)
            if token_count + word_tokens > self.overlap_tokens:
                break
            overlap_words.insert(0, word)
            token_count += word_tokens

        return " ".join(overlap_words)


text_chunker = SemanticChunker()
