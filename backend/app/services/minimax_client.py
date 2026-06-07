"""MiniMax-M3 客户端 (OpenAI 兼容格式)

开发阶段临时使用，上线前替换为讯飞星火 V4。
MiniMax 使用 OpenAI 兼容 API: /v1/chat/completions
"""

from typing import AsyncGenerator
import httpx
import json


class MiniMaxClient:
    """MiniMax-M3 API 客户端 (OpenAI 兼容格式)"""

    def __init__(self, api_key: str, base_url: str = "https://api.minimax.chat/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
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
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        model: str = "MiniMax-M3",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> dict:
        """同步对话，返回 {content: str, model: str, usage: dict}"""
        client = await self._get_client()

        all_messages = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages)

        payload = {
            "model": model,
            "messages": all_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        resp = await client.post(
            f"{self.base_url}/chat/completions",
            json=payload,
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()

        choice = data.get("choices", [{}])[0]
        content = choice.get("message", {}).get("content", "")
        usage = data.get("usage", {})

        return {
            "content": content,
            "model": data.get("model", model),
            "usage": usage,
        }

    async def chat_stream(
        self,
        messages: list[dict],
        system: str = "",
        model: str = "MiniMax-M3",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """流式对话 (SSE)，逐 token 返回"""
        client = await self._get_client()

        all_messages = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages)

        payload = {
            "model": model,
            "messages": all_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with client.stream(
            "POST",
            f"{self.base_url}/chat/completions",
            json=payload,
            headers=self._headers(),
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                try:
                    event = json.loads(data_str)
                    delta = event.get("choices", [{}])[0].get("delta", {})
                    token = delta.get("content", "")
                    if token:
                        yield token
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue


# 全局实例
minimax_client: MiniMaxClient | None = None


def init_minimax_client(api_key: str, base_url: str = "https://api.minimax.chat/v1") -> MiniMaxClient:
    global minimax_client
    minimax_client = MiniMaxClient(api_key=api_key, base_url=base_url)
    return minimax_client
