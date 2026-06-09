"""Debug exercise stream"""
import asyncio
import json
import time
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx

ENDPOINT = "http://localhost:8001/api/v1/resource/exercises/generate/stream"
PAYLOAD = {
    "student_id": "00000000-0000-0000-0000-000000000001",
    "knowledge_point": "梯度下降",
    "count": 3,
    "exercise_type": "all",
}


async def main():
    async with httpx.AsyncClient(timeout=120.0) as c:
        events = []
        t0 = time.time()
        async with c.stream(
            "POST",
            ENDPOINT,
            json=PAYLOAD,
            headers={"Accept": "text/event-stream"},
        ) as r:
            print(f"status: {r.status_code}")
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                e = json.loads(line[6:])
                events.append(e)
                t = e.get("type")
                if t in ("result", "done", "error"):
                    print(f"  [{time.time()-t0:.1f}s] {t}: {json.dumps(e, ensure_ascii=False)[:500]}")
                elif t == "progress":
                    print(f"  [{time.time()-t0:.1f}s] {t}: {e.get('message','')[:60]}")
                if t == "done":
                    break
        print(f"\nTotal events: {len(events)}")
        result_events = [e for e in events if e.get("type") == "result"]
        if result_events:
            data = result_events[0].get("data", {})
            print(f"exercises in result: {len(data.get('exercises', []))}")
            for i, ex in enumerate(data.get("exercises", [])[:3], 1):
                print(f"  {i}. [{ex.get('type')}] {ex.get('question','')[:60]}")


asyncio.run(main())
