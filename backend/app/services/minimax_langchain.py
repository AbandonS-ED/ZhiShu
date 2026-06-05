from typing import Any, Iterator, Optional
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

        client = self._get_client()
        system = ""
        minimax_msgs = []

        for m in messages:
            if isinstance(m, SystemMessage):
                system = m.content
            else:
                minimax_msgs.append(_convert_message(m))

        if not minimax_msgs:
            minimax_msgs = [MiniMaxMessage(role="user", content="Hello")]

        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    client.chat(
                        minimax_msgs,
                        system=system,
                        model=self.model_name,
                        max_tokens=self.max_tokens,
                        temperature=self.temperature,
                    ),
                )
                response = future.result()
        else:
            response = asyncio.run(
                client.chat(
                    minimax_msgs,
                    system=system,
                    model=self.model_name,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                )
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

        client = self._get_client()
        system = ""
        minimax_msgs = []

        for m in messages:
            if isinstance(m, SystemMessage):
                system = m.content
            else:
                minimax_msgs.append(_convert_message(m))

        if not minimax_msgs:
            minimax_msgs = [MiniMaxMessage(role="user", content="Hello")]

        async def _stream_gen():
            async for chunk in client.chat_stream(
                minimax_msgs,
                system=system,
                model=self.model_name,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            ):
                yield chunk

        loop = asyncio.new_event_loop()
        try:
            gen = _stream_gen()
            while True:
                try:
                    chunk = loop.run_until_complete(gen.__anext__())
                    yield AIMessageChunk(content=chunk)
                except StopAsyncIteration:
                    break
        finally:
            loop.close()

    @property
    def _identifying_params(self) -> dict:
        return {
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }


# 便捷实例
minimax_chat = MiniMaxChatModel()
