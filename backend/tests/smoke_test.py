"""端到端冒烟测试 — 6 步演示路径

跑法: cd backend && python -m tests.smoke_test
输出: 每步 PASS/FAIL + 关键数据 + 错误信息
"""

import asyncio
import io
import json
import sys
import time
from typing import Any

import httpx

# Force UTF-8 stdout to survive Windows GBK terminal + emojis in LLM output
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE = "http://localhost:8000/api/v1"
STUDENT_ID = "00000000-0000-0000-0000-000000000001"
TIMEOUT = 120.0

PASS = "[PASS]"
FAIL = "[FAIL]"
INFO = "[INFO]"


class StepFailed(Exception):
    pass


def header(title: str) -> None:
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def ok(msg: str) -> None:
    print(f"  {PASS} {msg}")


def bad(msg: str) -> None:
    print(f"  {FAIL} {msg}")
    raise StepFailed(msg)


def info(msg: str) -> None:
    print(f"  {INFO} {msg}")


async def collect_sse_events(client: httpx.AsyncClient, path: str, payload: dict, hard_cap_events: int = 20000) -> list[dict]:
    """发起 SSE 请求并解析所有事件 (有硬上限避免 LLM 抽风卡死)"""
    events: list[dict] = []
    t0 = time.time()
    async with client.stream(
        "POST",
        f"{BASE}{path}",
        json=payload,
        headers={"Accept": "text/event-stream"},
        timeout=TIMEOUT,
    ) as resp:
        if resp.status_code != 200:
            text = await resp.aread()
            raise RuntimeError(f"HTTP {resp.status_code}: {text.decode('utf-8', errors='replace')[:300]}")

        async for line in resp.aiter_lines():
            if len(events) >= hard_cap_events:
                break
            if time.time() - t0 > TIMEOUT - 5:
                break
            if not line or not line.startswith("data: "):
                continue
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                continue
    return events


async def step1_health(client: httpx.AsyncClient) -> None:
    header("Step 0: Health Check")
    r = await client.get("http://localhost:8000/health", timeout=5)
    if r.status_code == 200 and r.json().get("status") == "healthy":
        ok(f"/health 200, body={r.text[:60]}")
    else:
        bad(f"/health {r.status_code}: {r.text[:200]}")


async def step2_profile_build(client: httpx.AsyncClient) -> dict | None:
    header("Step 1: F1 Profile Build (POST /profile/build)")
    payload = {
        "student_id": STUDENT_ID,
        "messages": [
            {"role": "user", "content": "我是一名计算机专业大三学生,想学 AI 导论"},
            {"role": "assistant", "content": "好的,请问你的数学基础如何?"},
            {"role": "user", "content": "高数线代都学过,概率统计基础一般"},
        ],
    }
    t0 = time.time()
    r = await client.post(f"{BASE}/profile/build", json=payload, timeout=TIMEOUT)
    dur = time.time() - t0

    if r.status_code != 200:
        bad(f"HTTP {r.status_code} in {dur:.1f}s: {r.text[:300]}")
        return None

    data = r.json()
    dims = data.get("dimensions", {})
    km = dims.get("knowledge_mastery", {})
    info(f"completeness={data.get('completeness_score')}%")
    info(f"dimensions keys: {list(dims.keys())}")
    info(f"knowledge_mastery: {km}")
    ok(f"200 in {dur:.1f}s, {len(dims)} dimensions")
    return data


async def step3_chat_stream(client: httpx.AsyncClient) -> None:
    header("Step 2: F4 Chat Stream (POST /chat/stream) - 真逐 token")
    payload = {
        "student_id": STUDENT_ID,
        "message": "什么是反向传播算法?",
    }
    t0 = time.time()
    try:
        events = await collect_sse_events(client, "/chat/stream", payload)
    except Exception as e:
        bad(f"SSE error in {time.time()-t0:.1f}s: {e}")
        return

    dur = time.time() - t0
    types = [e.get("type") for e in events]
    tokens = [e for e in events if e.get("type") == "token"]
    results = [e for e in events if e.get("type") == "result"]
    errors = [e for e in events if e.get("type") == "error"]
    dones = [e for e in events if e.get("type") == "done"]

    info(f"events: {len(events)} total, types={dict((t, types.count(t)) for t in set(types))}")
    info(f"tokens received: {len(tokens)} ({sum(len(t.get('content','')) for t in tokens)} chars)")
    info(f"session: {events[0].get('session_id', '?')[:8] if events and events[0].get('type')=='session' else 'N/A'}")
    if tokens:
        info(f"first 3 tokens: {[t.get('content','')[:30] for t in tokens[:3]]}")
    if errors:
        bad(f"server reported error: {errors[0].get('message', '?')[:200]}")
        return
    if not tokens:
        bad("no token events received (不是真流式!)")
        return
    if not dones:
        bad("no done event (stream didn't close cleanly)")
        return
    ok(f"SSE stream 200 in {dur:.1f}s, {len(tokens)} tokens, {len(results)} result(s)")


async def step4_resource_stream(client: httpx.AsyncClient) -> None:
    header("Step 3: F2 Resource Stream (POST /resource/generate/stream)")
    payload = {
        "student_id": STUDENT_ID,
        "knowledge_point": "卷积神经网络 CNN",
        "resource_type": "all",
    }
    t0 = time.time()
    try:
        events = await collect_sse_events(client, "/resource/generate/stream", payload)
    except Exception as e:
        bad(f"SSE error in {time.time()-t0:.1f}s: {e}")
        return

    dur = time.time() - t0
    tokens = [e for e in events if e.get("type") == "token"]
    results = [e for e in events if e.get("type") == "result"]
    progress = [e for e in events if e.get("type") == "progress"]
    errors = [e for e in events if e.get("type") == "error"]

    info(f"progress events: {len(progress)} ({[p.get('progress') for p in progress]})")
    info(f"token events: {len(tokens)} ({sum(len(t.get('content','')) for t in tokens)} chars)")
    if results:
        rd = results[0].get("data", {}).get("content", {})
        val = rd.get("validation", {})
        info(f"validation: passed={val.get('passed')}, confidence={val.get('confidence')}, issues={len(val.get('issues', []))}")
    if errors:
        bad(f"server error: {errors[0].get('message', '?')[:200]}")
        return
    if not tokens and not progress:
        bad("no progress or token events")
        return
    val_summary = "N/A"
    if results:
        rd = results[0].get("data", {}).get("content", {})
        val = rd.get("validation", {})
        if val:
            val_summary = f"passed={val.get('passed')}, conf={val.get('confidence')}"
    ok(f"SSE stream 200 in {dur:.1f}s, {len(tokens)} tokens, {len(progress)} progress, validation={val_summary}")


async def step5_exercise_stream(client: httpx.AsyncClient) -> None:
    header("Step 4: F2 Exercise Stream (POST /resource/exercises/generate/stream)")
    payload = {
        "student_id": STUDENT_ID,
        "knowledge_point": "梯度下降",
        "count": 3,
        "exercise_type": "all",
    }
    t0 = time.time()
    try:
        events = await collect_sse_events(client, "/resource/exercises/generate/stream", payload)
    except Exception as e:
        bad(f"SSE error in {time.time()-t0:.1f}s: {e}")
        return

    dur = time.time() - t0
    tokens = [e for e in events if e.get("type") == "token"]
    results = [e for e in events if e.get("type") == "result"]
    progress = [e for e in events if e.get("type") == "progress"]

    info(f"token events: {len(tokens)}")
    info(f"progress events: {len(progress)}")
    if results:
        exs = results[0].get("data", {}).get("exercises", [])
        info(f"exercises generated: {len(exs)}")
        for i, ex in enumerate(exs[:3], 1):
            info(f"  {i}. [{ex.get('type', '?')}] {ex.get('question', '')[:50]}")
    if not results:
        bad("no result event (exercises not generated)")
        return
    if not results[0].get("data", {}).get("exercises"):
        bad("result event has 0 exercises (LLM/parse failure)")
        return
    ok(f"SSE stream 200 in {dur:.1f}s, {len(tokens)} tokens, {len(results[0].get('data', {}).get('exercises', []))} exercises")


async def step6_path_stream(client: httpx.AsyncClient) -> None:
    header("Step 5: F3 Path Stream (POST /path/generate/stream)")
    payload = {
        "student_id": STUDENT_ID,
        "course_topics": ["机器学习", "深度学习", "自然语言处理"],
        "total_days": 14,
    }
    t0 = time.time()
    try:
        events = await collect_sse_events(client, "/path/generate/stream", payload)
    except Exception as e:
        bad(f"SSE error in {time.time()-t0:.1f}s: {e}")
        return

    dur = time.time() - t0
    tokens = [e for e in events if e.get("type") == "token"]
    results = [e for e in events if e.get("type") == "result"]
    progress = [e for e in events if e.get("type") == "progress"]

    info(f"token events: {len(tokens)}")
    if results:
        rd = results[0].get("data", {})
        info(f"path_id: {rd.get('path_id', '?')[:8]}")
        info(f"title: {rd.get('title', '?')}")
        info(f"nodes: {len(rd.get('nodes', []))}, edges: {len(rd.get('edges', []))}, days: {rd.get('total_days')}")
    if not results:
        bad("no result event (path not saved)")
        return
    ok(f"SSE stream 200 in {dur:.1f}s, path saved, {len(tokens)} tokens")


async def step7_dashboard(client: httpx.AsyncClient) -> None:
    header("Step 6: Dashboard Stats (GET /dashboard/stats)")
    r = await client.get(f"{BASE}/dashboard/stats", params={"student_id": STUDENT_ID}, timeout=10)
    if r.status_code != 200:
        bad(f"HTTP {r.status_code}: {r.text[:200]}")
        return
    data = r.json()
    info(f"knowledge_points={data.get('knowledge_points')}")
    info(f"learning_hours={data.get('learning_hours')}")
    info(f"accuracy={data.get('accuracy')}")
    info(f"path_progress={data.get('path_progress')}")
    info(f"recent_activities: {len(data.get('recent_activities', []))}")
    info(f"recent_chats: {len(data.get('recent_chats', []))}")
    ok("dashboard 200 with real data")


async def step8_evaluation_record(client: httpx.AsyncClient) -> None:
    header("Step 7: F5 Evaluation Record (POST /evaluation/record)")
    payload = {
        "student_id": STUDENT_ID,
        "action": "view",
        "resource_type": "knowledge",
        "knowledge_point": "卷积神经网络 CNN",
        "duration_seconds": 120,
    }
    r = await client.post(f"{BASE}/evaluation/record", json=payload, timeout=10)
    if r.status_code != 200:
        bad(f"HTTP {r.status_code}: {r.text[:200]}")
        return
    data = r.json()
    ok(f"record saved, id={data.get('record_id', '?')[:8]}")


async def step9_mindmap(client: httpx.AsyncClient) -> None:
    header("Step 8: F2 MindMap (POST /mindmap/generate)")
    payload = {
        "student_id": STUDENT_ID,
        "knowledge_point": "Transformer 架构",
    }
    t0 = time.time()
    r = await client.post(f"{BASE}/mindmap/generate", json=payload, timeout=TIMEOUT)
    dur = time.time() - t0
    if r.status_code != 200:
        bad(f"HTTP {r.status_code} in {dur:.1f}s: {r.text[:300]}")
        return
    data = r.json()
    mindmap = data.get("mindmap", {})
    if not mindmap:
        bad("response body missing 'mindmap' key")
    mm = mindmap.get("mermaid_code", "")
    info(f"title: {mindmap.get('title', '?')}")
    info(f"mermaid_code length: {len(mm)} chars")
    if not mm:
        bad("mermaid_code is empty (LLM/parse failure)")
    info(f"mermaid preview: {mm[:80].replace(chr(10), ' / ')}")
    ok(f"200 in {dur:.1f}s, {len(mm)} chars mermaid")


async def main() -> int:
    print("=" * 70)
    print(f"  智枢 (SmartHub) 端到端冒烟测试 — {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Backend: {BASE}")
    print(f"  Student: {STUDENT_ID}")
    print("=" * 70)

    async with httpx.AsyncClient() as client:
        results: dict[str, bool] = {}
        steps = [
            ("0.health", step1_health),
            ("1.profile_build", step2_profile_build),
            ("2.chat_stream", step3_chat_stream),
            ("3.resource_stream", step4_resource_stream),
            ("4.exercise_stream", step5_exercise_stream),
            ("5.path_stream", step6_path_stream),
            ("6.mindmap", step9_mindmap),
            ("7.dashboard", step7_dashboard),
            ("8.evaluation_record", step8_evaluation_record),
        ]

        for name, fn in steps:
            try:
                await fn(client)
                results[name] = True
            except StepFailed:
                results[name] = False
            except Exception as e:
                print(f"  {FAIL} unexpected: {e}")
                results[name] = False

    print("\n" + "=" * 70)
    print("  总结")
    print("=" * 70)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    for name, ok_flag in results.items():
        marker = PASS if ok_flag else FAIL
        print(f"  {marker} {name}")
    print(f"\n  Total: {passed}/{total} passed")
    print("=" * 70)

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
