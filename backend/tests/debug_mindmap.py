"""Debug mindmap"""
import asyncio
import json
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx

PAYLOAD = {
    "student_id": "00000000-0000-0000-0000-000000000001",
    "knowledge_point": "Transformer 架构",
}


async def main():
    async with httpx.AsyncClient(timeout=60.0) as c:
        r = await c.post("http://localhost:8000/api/v1/mindmap/generate", json=PAYLOAD)
        print(f"status: {r.status_code}")
        print(f"body: {r.text}")


asyncio.run(main())
