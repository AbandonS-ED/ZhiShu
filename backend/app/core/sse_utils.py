"""SSE 流式响应工具函数

公共的 SSE 事件生成器，减少各 API 中的重复代码。
"""

import json
from typing import Any, AsyncGenerator


def sse_event(event_type: str, **kwargs) -> str:
    """生成 SSE 事件字符串

    Args:
        event_type: 事件类型 (progress/token/result/done/error/session)
        **kwargs: 事件数据

    Returns:
        SSE 格式字符串
    """
    data = {"type": event_type, **kwargs}
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def sse_progress(progress: float, message: str) -> str:
    """进度事件"""
    return sse_event("progress", progress=progress, message=message)


def sse_token(content: str) -> str:
    """token 事件（逐字输出）"""
    return sse_event("token", content=content)


def sse_result(data: dict[str, Any]) -> str:
    """结果事件"""
    return sse_event("result", data=data)


def sse_done() -> str:
    """完成事件"""
    return sse_event("done")


def sse_error(message: str) -> str:
    """错误事件"""
    return sse_event("error", message=message)


def sse_session(session_id: str) -> str:
    """会话 ID 事件"""
    return sse_event("session", session_id=session_id)


def sse_stream_response(
    generator: AsyncGenerator[str, None],
    media_type: str = "text/event-stream",
):
    """SSE 流式响应包装器

    用法:
        return sse_stream_response(my_event_generator())

    或者直接 yield:
        async def my_generator():
            yield sse_progress(0.1, "开始...")
            yield sse_token("hello")
            yield sse_done()

        return sse_stream_response(my_generator())
    """
    from fastapi.responses import StreamingResponse
    return StreamingResponse(generator, media_type=media_type)
