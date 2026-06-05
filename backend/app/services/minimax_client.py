from typing import AsyncGenerator, Optional
from pydantic import BaseModel
import httpx


class MiniMaxMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class MiniMaxResponse(BaseModel):
    content: str
    thinking: str = ""
    model: str = ""
    usage: dict = {}


class MiniMaxClient:
    """MiniMax M3 API 客户端 (Anthropic 兼容格式)"""

    def __init__(self, api_key: str, base_url: str = "https://api.minimaxi.chat/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=60.0)
        return self._http_client

    async def close(self):
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    async def chat(
        self,
        messages: list[MiniMaxMessage],
        system: str = "",
        model: str = "MiniMax-M3",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> MiniMaxResponse:
        """同步对话"""
        client = await self._get_client()

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        messages_data = [m.model_dump() for m in messages]

        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages_data,
        }
        if system:
            payload["system"] = system

        resp = await client.post(
            f"{self.base_url}/messages",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

        content = ""
        thinking = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                content += block.get("text", "")
            elif block.get("type") == "thinking":
                thinking += block.get("thinking", "")

        usage = data.get("usage", {})

        return MiniMaxResponse(
            content=content,
            thinking=thinking,
            model=data.get("model", model),
            usage=usage,
        )

    async def chat_stream(
        self,
        messages: list[MiniMaxMessage],
        system: str = "",
        model: str = "MiniMax-M3",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """流式对话 (SSE)"""
        client = await self._get_client()

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        messages_data = [m.model_dump() for m in messages]

        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages_data,
            "stream": True,
        }
        if system:
            payload["system"] = system

        async with client.stream(
            "POST",
            f"{self.base_url}/messages",
            json=payload,
            headers=headers,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break

                import json
                try:
                    event = json.loads(data_str)
                    event_type = event.get("type", "")

                    if event_type == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield delta.get("text", "")
                except json.JSONDecodeError:
                    continue


# 全局实例（需在配置后初始化）
minimax_client: Optional[MiniMaxClient] = None


def init_minimax_client(api_key: str, base_url: str = "https://api.minimaxi.chat/v1") -> MiniMaxClient:
    global minimax_client
    minimax_client = MiniMaxClient(api_key=api_key, base_url=base_url)
    return minimax_client
