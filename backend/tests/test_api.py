"""后端测试"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root(client):
    response = await client.get("/")
    assert response.status_code == 200
    assert "SmartHub" in response.json()["message"]


@pytest.mark.asyncio
async def test_profile_get(client):
    student_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/profile/{student_id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_resource_list(client):
    student_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/resource/list?student_id={student_id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_exercise_list(client):
    student_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/resource/exercises/{student_id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_path_list(client):
    student_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/path/{student_id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_chat_sessions(client):
    student_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/chat/sessions/{student_id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_dashboard_stats(client):
    response = await client.get("/api/v1/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "knowledge_points" in data


@pytest.mark.asyncio
async def test_evaluation_report(client):
    student_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/evaluation/report/{student_id}")
    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data


@pytest.mark.asyncio
async def test_mindmap_examples(client):
    response = await client.get("/api/v1/mindmap/examples")
    assert response.status_code == 200
