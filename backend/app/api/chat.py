from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.post("/stream")
async def stream_chat(student_id: str, message: str):
    async def event_generator():
        yield "data: {\"type\": \"progress\", \"progress\": 0.5}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
