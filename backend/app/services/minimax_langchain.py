from typing import Any, AsyncIterator, Iterator, Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.outputs import ChatGeneration, ChatResult

from app.services.minimax_client import MiniMaxClient, MiniMaxMessage


def _convert_message(msg: BaseMessage) -> MiniMaxMessage:
    """LangChain Message -> MiniMaxMessage"""
    if isinstance(msg, SystemMessage):
        return MiniMaxMessage(role="user", content=f"[System] {msg.content}")
    elif isinstance(msg, HumanMessage):
        return MiniMaxMessage(role="user", content=msg.content)
    else:
        return MiniMaxMessage(role="assistant", content=msg.content)


def _prepare_messages(
    messages: list[BaseMessage],
) -> tuple[str, list[MiniMaxMessage]]:
    """从 LangChain 消息列表提取 system prompt 和 minimax 消息"""
    system = ""
    minimax_msgs = []
    for m in messages:
        if isinstance(m, SystemMessage):
            system = m.content
        else:
            minimax_msgs.append(_convert_message(m))
    if not minimax_msgs:
        minimax_msgs = [MiniMaxMessage(role="user", content="Hello")]
    return system, minimax_msgs


class MiniMaxChatModel(BaseChatModel):
    """LangChain 兼容的 MiniMax Chat Model"""

    client: Optional[MiniMaxClient] = None
    model_name: str = "MiniMax-M3"
    temperature: float = 0.7
    max_tokens: int = 4096

    @property
    def _llm_type(self) -> str:
        return "minimax"

    def _get_client(self) -> MiniMaxClient:
        if self.client is None:
            from app.core.config import settings
            self.client = MiniMaxClient(
                api_key=settings.MINIMAX_API_KEY,
                base_url=settings.MINIMAX_BASE_URL,
            )
        return self.client

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(
                    asyncio.run, self._agenerate(messages, stop, **kwargs)
                ).result()
        else:
            result = asyncio.run(self._agenerate(messages, stop, **kwargs))
        return result

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> ChatResult:
        client = self._get_client()
        system, minimax_msgs = _prepare_messages(messages)

        response = await client.chat(
            minimax_msgs,
            system=system,
            model=self.model_name,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
        )

        message = AIMessage(content=response.content)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> Iterator[AIMessageChunk]:
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures

            async def _run():
                chunks = []
                async for chunk in self._astream(messages, stop, **kwargs):
                    chunks.append(chunk)
                return chunks

            with concurrent.futures.ThreadPoolExecutor() as pool:
                chunks = pool.submit(asyncio.run, _run()).result()
            for chunk in chunks:
                yield chunk
        else:
            yield from asyncio.run(self._astream(messages, stop, **kwargs))

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> AsyncIterator[AIMessageChunk]:
        client = self._get_client()
        system, minimax_msgs = _prepare_messages(messages)

        async for chunk in client.chat_stream(
            minimax_msgs,
            system=system,
            model=self.model_name,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
        ):
            yield AIMessageChunk(content=chunk)

    @property
    def _identifying_params(self) -> dict:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }


# 便捷实例
minimax_chat = MiniMaxChatModel()
