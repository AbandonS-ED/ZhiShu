"""Debug single SSE endpoint, prints all events"""
import asyncio
import json
import time
import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx

ENDPOINT = "http://localhost:8000/api/v1/path/generate/stream"
PAYLOAD = {
    "student_id": "00000000-0000-0000-0000-000000000001",
    "course_topics": ["机器学习", "深度学习"],
    "total_days": 7,
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
            print(f"status: {r.status_code}, content-type: {r.headers.get('content-type')}")
            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                e = json.loads(line[6:])
                events.append(e)
                t = e.get("type")
                if t in ("result", "done", "error"):
                    print(f"  [{time.time()-t0:.1f}s] {t}: {json.dumps(e, ensure_ascii=False)[:300]}")
                elif t == "progress":
                    print(f"  [{time.time()-t0:.1f}s] {t}: {e.get('message','')[:60]}")
                elif t == "token":
                    pass  # too many, skip
                else:
                    print(f"  [{time.time()-t0:.1f}s] {t}: {str(e)[:200]}")
                if t == "done":
                    break
        print(f"\nTotal events: {len(events)}")
        print(f"Types: {dict((t, sum(1 for e in events if e.get('type')==t)) for t in set(e.get('type') for e in events))}")
        print(f"Last 3: {[(e.get('type'), str(e)[:100]) for e in events[-3:]]}")


asyncio.run(main())
