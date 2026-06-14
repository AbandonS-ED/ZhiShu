"""Inspect what /resource/generate/stream actually returns in result data"""
import asyncio
import json
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx

PAYLOAD = {
    "student_id": "00000000-0000-0000-0000-000000000001",
    "knowledge_point": "A* 搜索算法",
    "resource_type": "all",
}


async def main():
    async with httpx.AsyncClient(timeout=120.0) as c:
        events = []
        async with c.stream(
            "POST",
            "http://localhost:8000/api/v1/resource/generate/stream",
            json=PAYLOAD,
            headers={"Accept": "text/event-stream"},
        ) as r:
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                e = json.loads(line[6:])
                if e.get("type") in ("result", "error"):
                    events.append(e)
                if e.get("type") == "done":
                    break

        for e in events:
            print("event type:", e.get("type"))
            print("event data keys:", list(e.get("data", {}).keys()))
            if e.get("data", {}).get("content"):
                content = e["data"]["content"]
                if isinstance(content, dict):
                    print("  content keys:", list(content.keys()))
                    print("  validation:", content.get("validation"))
                    print("  knowledge (first 200):", str(content.get("knowledge", ""))[:200])


asyncio.run(main())
