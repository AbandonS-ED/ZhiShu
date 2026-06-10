"""Auth API — 登录 / 注册 / 查询用户"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password, create_token, create_refresh_token
from app.models.student import Student

router = APIRouter()


class LoginRequest(BaseModel):
    student_no: str
    password: str

    @field_validator("student_no")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 4:
            raise ValueError("学号至少 4 位")
        return v

    @field_validator("password")
    @classmethod
    def _pwd_len(cls, v: str) -> str:
        if not v or len(v) < 6:
            raise ValueError("密码至少 6 位")
        return v


class RegisterRequest(BaseModel):
    student_no: str
    password: str
    name: str = ""
    email: str = ""
    major: str = ""

    @field_validator("student_no")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 4:
            raise ValueError("学号至少 4 位")
        return v

    @field_validator("password")
    @classmethod
    def _pwd_len(cls, v: str) -> str:
        if not v or len(v) < 6:
            raise ValueError("密码至少 6 位")
        return v


class StudentDTO(BaseModel):
    id: str
    student_no: str
    name: str = ""
    email: str = ""
    major: str = ""


class AuthResponse(BaseModel):
    token: str
    refresh_token: str
    student: StudentDTO


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student).where(Student.student_no == req.student_no)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=401, detail="学号或密码错误")
    if not student.password_hash:
        raise HTTPException(status_code=401, detail="该账号未设置密码，请重新注册")
    if not verify_password(req.password, student.password_hash):
        raise HTTPException(status_code=401, detail="学号或密码错误")

    token = create_token(str(student.id))
    refresh = create_refresh_token(str(student.id))
    return AuthResponse(
        token=token,
        refresh_token=refresh,
        student=StudentDTO(
            id=str(student.id),
            student_no=student.student_no or "",
            name=student.name or "",
            email=student.email or "",
            major=student.major or "",
        ),
    )


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student).where(Student.student_no == req.student_no)
    )
    student = result.scalar_one_or_none()
    if student:
        raise HTTPException(status_code=400, detail="该学号已注册")

    student = Student(
        id=uuid.uuid4(),
        student_no=req.student_no,
        password_hash=hash_password(req.password),
        name=req.name or ("用户" + req.student_no[-4:]),
        email=req.email or None,
        major=req.major or None,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    token = create_token(str(student.id))
    refresh = create_refresh_token(str(student.id))
    return AuthResponse(
        token=token,
        refresh_token=refresh,
        student=StudentDTO(
            id=str(student.id),
            student_no=student.student_no or "",
            name=student.name or "",
            email=student.email or "",
            major=student.major or "",
        ),
    )


@router.get("/me/{student_id}", response_model=StudentDTO)
async def me(student_id: str, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """查询当前登录用户信息"""
    if str(user.id) != student_id:
        raise HTTPException(status_code=403, detail="只能查看自己的信息")
    try:
        sid = uuid.UUID(student_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"无效的 student_id: {student_id}")
    result = await db.execute(select(Student).where(Student.id == sid))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    return StudentDTO(
        id=str(student.id),
        student_no=student.student_no or "",
        name=student.name or "",
        email=student.email or "",
        major=student.major or "",
    )
