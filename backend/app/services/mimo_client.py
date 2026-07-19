"""小米 MiMo v2.5 客户端 (OpenAI 兼容格式)

MiMo 使用 OpenAI 兼容 API: /chat/completions
认证方式: api-key 头（非 Authorization: Bearer）
"""

from typing import AsyncGenerator
import httpx
import json
import logging

logger = logging.getLogger(__name__)


class MiMoClient:
    """小米 MiMo v2.5 API 客户端"""

    def __init__(self, api_key: str, base_url: str = "https://token-plan-cn.xiaomimimo.com/v1", model: str = "mimo-v2.5-pro"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._http_client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=120.0)
        return self._http_client

    async def close(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    def _headers(self) -> dict:
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> dict:
        """同步对话，返回 {content: str, model: str, usage: dict}"""
        client = await self._get_client()
        model = model or self.model

        all_messages = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages)

        payload = {
            "model": model,
            "messages": all_messages,
            "max_completion_tokens": max_tokens,
            "temperature": temperature,
        }

        resp = await client.post(
            f"{self.base_url}/chat/completions",
            headers=self._headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices", [])
        if not choices:
            raise ValueError(f"MiMo API 返回空 choices: {data}")
        content = choices[0]["message"]["content"]
        return {
            "content": content,
            "model": data.get("model", model),
            "usage": data.get("usage", {}),
        }

    async def chat_stream(
        self,
        messages: list[dict],
        system: str = "",
        model: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """流式对话，逐块 yield content"""
        client = await self._get_client()
        model = model or self.model

        all_messages = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages)

        payload = {
            "model": model,
            "messages": all_messages,
            "max_completion_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with client.stream(
            "POST",
            f"{self.base_url}/chat/completions",
            headers=self._headers(),
            json=payload,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    choices = chunk.get("choices", [])
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    continue
