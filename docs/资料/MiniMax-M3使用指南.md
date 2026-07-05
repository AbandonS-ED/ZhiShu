# MiniMax-M3 LLM 使用指南

> **状态**: 开发阶段临时使用，上线前替换为讯飞星火 V4
> **记录时间**: 2026-06-08
>
> **最后核验**: 2026-07-02 — base_url 仍为 `https://api.minimax.chat/v1`（**没有 `i`**，不是 `minimaxi`）；比赛前 1 个环境变量 `LLM_PROVIDER=spark` 切星火 V4

## 概述

MiniMax-M3 使用 **OpenAI 兼容格式** API，可直接用 `httpx` 调用。

## API 信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://api.minimax.chat/v1` |
| Chat Endpoint | `/chat/completions` |
| Model 名称 | `MiniMax-M3` |
| 鉴权方式 | `Authorization: Bearer {api_key}` |

## 快速开始

### 安装

```bash
pip install httpx
```

### 基本用法 (httpx)

```python
import httpx

resp = httpx.post(
    "https://api.minimax.chat/v1/chat/completions",
    headers={
        "Authorization": "Bearer your_api_key",
        "Content-Type": "application/json",
    },
    json={
        "model": "MiniMax-M3",
        "messages": [
            {"role": "user", "content": "用中文说你好"}
        ],
        "max_tokens": 100,
    },
    timeout=30,
)

data = resp.json()
print(data["choices"][0]["message"]["content"])
```

### 流式调用

```python
import httpx
import json

with httpx.stream(
    "POST",
    "https://api.minimax.chat/v1/chat/completions",
    headers={"Authorization": "Bearer your_api_key"},
    json={
        "model": "MiniMax-M3",
        "messages": [{"role": "user", "content": "写一首诗"}],
        "max_tokens": 500,
        "stream": True,
    },
    timeout=60,
) as resp:
    for line in resp.iter_lines():
        if line.startswith("data: "):
            data_str = line[6:]
            if data_str == "[DONE]":
                break
            event = json.loads(data_str)
            token = event["choices"][0]["delta"].get("content", "")
            print(token, end="", flush=True)
```

## 项目中的配置

### .env 文件

```env
MINIMAX_API_KEY=your_api_key_here
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_MODEL=MiniMax-M3
```

### 使用方式

```python
from app.services.minimax_client import minimax_client

# 同步对话
response = await minimax_client.chat(
    messages=[{"role": "user", "content": "Hello"}],
    system="You are a helpful assistant."
)
print(response["content"])

# 流式对话
async for token in minimax_client.chat_stream(
    messages=[{"role": "user", "content": "Hello"}],
):
    print(token, end="")
```

## LangChain 集成

```python
from app.services.minimax_langchain import minimax_chat

from langchain_core.messages import HumanMessage
response = minimax_chat.invoke([HumanMessage(content="Hello")])
print(response.content)
```

## API 返回格式

```json
{
  "id": "0674e14e...",
  "choices": [
    {
      "finish_reason": "length",
      "index": 0,
      "message": {
        "content": "模型回复内容",
        "role": "assistant"
      }
    }
  ],
  "model": "MiniMax-M3",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60
  }
}
```

## 常见问题

1. **Base URL**: 使用 `https://api.minimax.chat/v1`（注意没有 `i`）
2. **超时**: 建议设置 60-120 秒超时
3. **Key 格式**: 以 `sk-` 开头的长字符串

## 迁移到讯飞星火 V4

获取讯飞 API Key 后：

1. 取消 `config.py` 中 `SPARK_*` 配置的注释
2. 注释掉 `MINIMAX_*` 配置
3. 将 `minimax_client.py` / `minimax_langchain.py` 重写为 `spark_client.py` / `spark_langchain.py`
4. 讯飞同样使用 OpenAI 兼容格式，主要改 Base URL 和 Model 名称
