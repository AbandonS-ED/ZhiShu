"""Check what mindmap agent actually gets - test via single chat call"""
import asyncio
import io
import json
import sys

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx

# Just call the endpoint and inspect the raw response in detail
async def main():
    async with httpx.AsyncClient(timeout=120.0) as c:
        # First test what the LLM returns for the mindmap prompt (sync chat)
        # We can't easily call the agent directly, so let's just inspect the endpoint result
        r = await c.post(
            "http://localhost:8000/api/v1/mindmap/generate",
            json={"student_id": "00000000-0000-0000-0000-000000000001", "knowledge_point": "A* 算法"},
        )
        data = r.json()
        mm = data.get("mindmap", {})
        print("Title:", mm.get("title"))
        print("Mermaid length:", len(mm.get("mermaid_code", "")))
        print("Nodes:", len(mm.get("nodes", [])))
        print("Description length:", len(mm.get("description", "")))
        print()
        if "fallback" in mm.get("title", "").lower() or len(mm.get("mermaid_code", "")) < 100:
            print("[BUG CONFIRMED] mindmap returned fallback")
        else:
            print("[OK] mindmap generated real content")
        print()
        print("Mermaid preview (first 300):")
        print(mm.get("mermaid_code", "")[:300])
        print()
        print("Description preview (last 500):")
        print(mm.get("description", "")[-500:])


asyncio.run(main())
