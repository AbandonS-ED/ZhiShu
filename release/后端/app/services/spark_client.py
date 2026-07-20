"""讯飞星火 V4 LLM 客户端

OpenAI 兼容格式调用讯飞星火 V4 API。
上线前从 MiniMax-M3 切换到此客户端。
"""

import httpx
import json
from typing import AsyncGenerator


class SparkClient:
    """讯飞星火 V4 客户端"""

    def __init__(self, api_key: str, base_url: str = "https://spark-api-open.xf-yun.com/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def chat(
        self,
        messages: list[dict],
        model: str = "spark-max",
        system: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> dict:
        """同步聊天

        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            model: 模型名称 (spark-lite/spark-pro/spark-max)
            system: 系统提示词
            max_tokens: 最大 token 数
            temperature: 温度

        Returns:
            {"content": str, "usage": dict}
        """
        client = await self._get_client()

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        if system:
            payload["messages"] = [{"role": "system", "content": system}] + messages

        response = await client.post(
            f"{self.base_url}/chat/completions",
            json=payload,
        )
        response.raise_for_status()

        data = response.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "usage": data.get("usage", {}),
        }

    async def chat_stream(
        self,
        messages: list[dict],
        model: str = "spark-max",
        system: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """流式聊天

        Yields:
            str: 生成的 token
        """
        client = await self._get_client()

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        if system:
            payload["messages"] = [{"role": "system", "content": system}] + messages

        async with client.stream(
            "POST",
            f"{self.base_url}/chat/completions",
            json=payload,
        ) as response:
            response.raise_for_status()

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data["choices"][0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def close(self):
        """关闭客户端"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
