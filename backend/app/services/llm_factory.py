"""LLM 统一工厂 — 根据 LLM_PROVIDER 返回对应客户端

所有客户端实现相同接口:
- chat(messages, system, max_tokens, temperature) → dict
- chat_stream(messages, system, max_tokens, temperature) → AsyncGenerator[str]

切换模型只需改 .env 的 LLM_PROVIDER，无需改任何业务代码。
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# 全局单例
_client = None


def get_llm_client():
    """获取当前 LLM 客户端（单例）"""
    global _client
    if _client is not None:
        return _client

    provider = settings.LLM_PROVIDER.lower()

    if provider == "spark":
        from app.services.spark_client import SparkClient
        _client = SparkClient(
            api_key=settings.SPARK_API_KEY,
            base_url=settings.SPARK_BASE_URL,
        )
        logger.info("LLM provider: spark (%s)", settings.SPARK_BASE_URL)
    elif provider == "mimo":
        from app.services.mimo_client import MiMoClient
        _client = MiMoClient(
            api_key=settings.MIMO_API_KEY,
            base_url=settings.MIMO_BASE_URL,
            model=settings.MIMO_MODEL,
        )
        logger.info("LLM provider: mimo (%s)", settings.MIMO_BASE_URL)
    else:
        # 默认 minimax
        from app.services.minimax_client import MiniMaxClient
        _client = MiniMaxClient(
            api_key=settings.MINIMAX_API_KEY,
            base_url=settings.MINIMAX_BASE_URL,
        )
        logger.info("LLM provider: minimax (%s)", settings.MINIMAX_BASE_URL)

    return _client


def reset_client():
    """重置客户端（用于测试或热切换）"""
    global _client
    _client = None
