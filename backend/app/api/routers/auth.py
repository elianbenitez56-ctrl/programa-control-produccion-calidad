"""Endpoints del Módulo Autenticación (diseño Módulo 1 §4)."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.api.use_cases_factory import AuthUseCases, _http_meta, build_auth_use_cases
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import hash_token
from app.domain.entities.auth import LoginMethod

router = APIRouter(prefix="/auth", tags=["auth"])


def _usecases(request: Request, session: AsyncSession = Depends(get_db)) -> AuthUseCases:
    """Construye los casos de uso y deja la sesión a mano para el commit."""
    request.state.db_session = session
    return build_auth_use_cases(session)


class LoginRequest(BaseModel):
    usuario: str = Field(min_length=4, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class KioskLoginRequest(BaseModel):
    metodo: LoginMethod
    credencial: str = Field(min_length=1, max_length=200)
    kiosko_token: str = Field(min_length=8, max_length=64)
    identificador: str | None = Field(default=None, max_length=64)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ChangePasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=8, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(max_length=150)


class ResetPasswordRequest(BaseModel):
    token: str
    password_nueva: str = Field(min_length=8, max_length=200)


@router.post("/login")
async def login(body: LoginRequest, request: Request, uc: AuthUseCases = Depends(_usecases)):
    ip, dispositivo, request_id = _http_meta(request)
    result = await uc.login_password.execute(
        body.usuario, body.password, ip, dispositivo, request_id
    )
    await _commit(request)
    return {
        "access_token": result.tokens.access_token,
        "refresh_token": result.tokens.refresh_token,
        "token_type": "bearer",
        "usuario": result.usuario,
    }


@router.post("/login/kiosk")
async def login_kiosk(body: KioskLoginRequest, request: Request, uc: AuthUseCases = Depends(_usecases)):
    ip, dispositivo, request_id = _http_meta(request)
    result = await uc.login_kiosko.execute(
        metodo=body.metodo,
        credencial=body.credencial,
        kiosko_token=body.kiosko_token,
        ip=ip,
        dispositivo=dispositivo,
        request_id=request_id,
        identificador=body.identificador,
    )
    await _commit(request)
    return {
        "access_token": result.access_token,
        "refresh_token": result.refresh_token,
        "token_type": "bearer",
        "usuario": result.usuario,
        "sesion_operario": result.sesion_operario,
    }


@router.post("/refresh")
async def refresh(body: RefreshRequest, request: Request, uc: AuthUseCases = Depends(_usecases)):
    ip, dispositivo, request_id = _http_meta(request)
    result = await uc.refresh.execute(body.refresh_token, ip, dispositivo, request_id)
    await _commit(request)
    return {
        "access_token": result.tokens.access_token,
        "refresh_token": result.tokens.refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(body: LogoutRequest, request: Request, current: CurrentUser = Depends(get_current_user),
                 uc: AuthUseCases = Depends(_usecases)):
    ip, dispositivo, request_id = _http_meta(request)
    if body.refresh_token:
        refresh_hash = hash_token(body.refresh_token)
    else:
        refresh_hash = None
    await uc.logout.execute(current.user_id, refresh_hash, ip, dispositivo, request_id)
    await _commit(request)
    return {"ok": True}


@router.get("/me")
async def me(current: CurrentUser = Depends(get_current_user), uc: AuthUseCases = Depends(_usecases)):
    return await uc.get_me.execute(current.user_id)


@router.post("/password/change")
async def password_change(body: ChangePasswordRequest, request: Request,
                          current: CurrentUser = Depends(get_current_user),
                          uc: AuthUseCases = Depends(_usecases)):
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.change_password.execute(current.user_id, body.password_actual, body.password_nueva,
                                     ip, request_id)
    await _commit(request)
    return {"ok": True}


@router.post("/password/forgot")
async def password_forgot(body: ForgotPasswordRequest, request: Request,
                          uc: AuthUseCases = Depends(_usecases)):
    _ip, _dispositivo, request_id = _http_meta(request)
    base_url = get_settings().frontend_url
    await uc.reset_request.execute(body.email, base_url, request_id)
    await _commit(request)
    return {"ok": True}


@router.post("/password/reset")
async def password_reset(body: ResetPasswordRequest, request: Request,
                         uc: AuthUseCases = Depends(_usecases)):
    ip, _dispositivo, request_id = _http_meta(request)
    await uc.reset_password.execute(body.token, body.password_nueva, ip, request_id)
    await _commit(request)
    return {"ok": True}


@router.get("/sessions")
async def list_sessions(current: CurrentUser = Depends(get_current_user),
                        uc: AuthUseCases = Depends(_usecases)):
    return {"sesiones": await uc.list_sessions.execute(current.user_id)}


@router.post("/sessions/{sesion_id}/revoke")
async def revoke_session(sesion_id: str, request: Request,
                         current: CurrentUser = Depends(get_current_user),
                         uc: AuthUseCases = Depends(_usecases)):
    _ip, _dispositivo, request_id = _http_meta(request)
    await uc.revoke_session.execute(current.user_id, sesion_id, request_id)
    await _commit(request)
    return {"ok": True}


async def _commit(request: Request) -> None:
    session = request.state.db_session
    await session.commit()
