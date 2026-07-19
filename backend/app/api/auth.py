"""Auth API — 登录 / 注册 / 查询 / 更新用户"""
import uuid
import random
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password, create_token, create_refresh_token
from app.models.student import Student

router = APIRouter()

# 内存验证码存储 {phone: (code, expire_timestamp)}
_verification_codes: dict[str, tuple[str, float]] = {}
CODE_TTL = 300  # 5 分钟有效


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
    phone: str
    code: str
    name: str = ""
    email: Optional[str] = None
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

    @field_validator("phone")
    @classmethod
    def _phone_fmt(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) != 11 or not v.isdigit():
            raise ValueError("请输入 11 位手机号")
        return v

    @field_validator("code")
    @classmethod
    def _code_fmt(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) != 6 or not v.isdigit():
            raise ValueError("验证码为 6 位数字")
        return v

    @field_validator("email")
    @classmethod
    def _email_fmt(cls, v):
        v = (v or "").strip()
        if v and ("@" not in v or "." not in v.split("@")[-1]):
            raise ValueError("邮箱格式不正确")
        return v or None


class UpdateMeRequest(BaseModel):
    name: str = ""
    email: str = ""
    major: str = ""
    grade: str = ""

    @field_validator("name")
    @classmethod
    def _name_len(cls, v: str) -> str:
        v = (v or "").strip()
        if v and len(v) > 100:
            raise ValueError("姓名不能超过 100 字符")
        return v

    @field_validator("email")
    @classmethod
    def _email_fmt(cls, v: str) -> str:
        v = (v or "").strip()
        if v and ("@" not in v or "." not in v.split("@")[-1]):
            raise ValueError("邮箱格式不正确")
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _pwd_len(cls, v: str) -> str:
        if not v or len(v) < 6:
            raise ValueError("新密码至少 6 位")
        return v


class StudentDTO(BaseModel):
    id: str
    student_no: str
    name: str = ""
    phone: str = ""
    email: str = ""
    major: str = ""
    grade: str = ""
    role: str = "student"
    created_at: str = ""
    last_login: str = ""


class AuthResponse(BaseModel):
    token: str
    refresh_token: str
    student: StudentDTO


def _to_dto(s: Student) -> StudentDTO:
    return StudentDTO(
        id=str(s.id),
        student_no=s.student_no or "",
        name=s.name or "",
        phone=s.phone or "",
        email=s.email or "",
        major=s.major or "",
        grade=s.grade or "",
        role=s.role or "student",
        created_at=s.created_at.isoformat() if s.created_at else "",
        last_login=s.last_login.isoformat() if s.last_login else "",
    )


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
    if not student.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用，请联系管理员")

    student.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(student)

    token = create_token(str(student.id))
    refresh = create_refresh_token(str(student.id))
    return AuthResponse(token=token, refresh_token=refresh, student=_to_dto(student))


class SendCodeRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone_fmt(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) != 11 or not v.isdigit():
            raise ValueError("请输入 11 位手机号")
        return v


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str

    @field_validator("phone")
    @classmethod
    def _phone_fmt(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) != 11 or not v.isdigit():
            raise ValueError("请输入 11 位手机号")
        return v

    @field_validator("code")
    @classmethod
    def _code_fmt(cls, v: str) -> str:
        v = (v or "").strip()
        if not v or len(v) != 6 or not v.isdigit():
            raise ValueError("验证码为 6 位数字")
        return v


@router.post("/send-code")
async def send_code(req: SendCodeRequest):
    """发送验证码（模拟：打印到控制台）"""
    code = f"{random.randint(0, 999999):06d}"
    _verification_codes[req.phone] = (code, time.time() + CODE_TTL)
    print(f"\n{'='*40}")
    print(f"  验证码已发送到 {req.phone}")
    print(f"  验证码: {code}")
    print(f"  有效期: 5 分钟")
    print(f"{'='*40}\n")
    return {"message": f"验证码已发送到 {req.phone}，请查看控制台"}


@router.post("/verify-code")
async def verify_code(req: VerifyCodeRequest):
    """验证验证码"""
    stored = _verification_codes.get(req.phone)
    if not stored:
        raise HTTPException(status_code=400, detail="验证码已过期或未发送，请重新获取")
    code, expire_at = stored
    if time.time() > expire_at:
        _verification_codes.pop(req.phone, None)
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    if code != req.code:
        raise HTTPException(status_code=400, detail="验证码错误")
    return {"message": "验证成功"}


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # 校验验证码
    stored = _verification_codes.get(req.phone)
    if not stored:
        raise HTTPException(status_code=400, detail="验证码已过期或未发送，请先获取验证码")
    code, expire_at = stored
    if time.time() > expire_at:
        _verification_codes.pop(req.phone, None)
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    if code != req.code:
        raise HTTPException(status_code=400, detail="验证码错误")

    # 检查学号唯一
    result = await db.execute(
        select(Student).where(Student.student_no == req.student_no)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该学号已注册")

    # 检查手机号唯一
    result = await db.execute(
        select(Student).where(Student.phone == req.phone)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已注册")

    student = Student(
        id=uuid.uuid4(),
        student_no=req.student_no,
        password_hash=hash_password(req.password),
        name=req.name or ("用户" + req.student_no[-4:]),
        phone=req.phone,
        email=req.email or None,
        major=req.major or None,
        role="student",
        is_active=True,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    # 验证通过，删除验证码
    _verification_codes.pop(req.phone, None)

    token = create_token(str(student.id))
    refresh = create_refresh_token(str(student.id))
    return AuthResponse(token=token, refresh_token=refresh, student=_to_dto(student))


@router.get("/me", response_model=StudentDTO)
async def get_me(user: Student = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return _to_dto(user)


@router.put("/me", response_model=StudentDTO)
async def update_me(
    req: UpdateMeRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """更新当前登录用户信息"""
    if req.email:
        result = await db.execute(
            select(Student).where(Student.email == req.email, Student.id != user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该邮箱已被使用")

    if req.name:
        user.name = req.name
    user.email = req.email.strip() or None
    if req.major:
        user.major = req.major
    if req.grade:
        user.grade = req.grade
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return _to_dto(user)


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: Student = Depends(get_current_user),
):
    """修改当前用户密码"""
    if not verify_password(req.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    if req.old_password == req.new_password:
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同")

    user.password_hash = hash_password(req.new_password)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "密码修改成功"}


@router.get("/me/{student_id}", response_model=StudentDTO)
async def me(student_id: str, db: AsyncSession = Depends(get_db), user: Student = Depends(get_current_user)):
    """查询指定用户信息（保留向后兼容）"""
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
    return _to_dto(student)
