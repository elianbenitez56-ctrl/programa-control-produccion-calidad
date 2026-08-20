"""Catálogo de mensajes internacionalizados por código de error.

El backend devuelve el mensaje en el idioma solicitado (`Accept-Language`)
para depuración; la UI traduce el `code` de forma nativa.
"""
from typing import Literal

Locale = Literal["es", "en"]

MESSAGES: dict[str, dict[Locale, str]] = {
    "ERROR_DOMINIO": {"es": "Error de dominio", "en": "Domain error"},
    "REGLA_DE_NEGOCIO": {"es": "Regla de negocio violada", "en": "Business rule violation"},
    "AUTENTICACION_INVALIDA": {
        "es": "Usuario o contraseña incorrectos",
        "en": "Invalid credentials",
    },
    "PERMISO_DENEGADO": {"es": "No tiene permiso para esta acción", "en": "Permission denied"},
    "ENTIDAD_NO_ENCONTRADA": {"es": "El recurso no existe", "en": "Resource not found"},
    "CONFLICTO": {"es": "Conflicto de datos", "en": "Data conflict"},
    "TOKEN_EXPIRADO": {"es": "La sesión expiró. Inicie sesión nuevamente", "en": "Session expired"},
    "CUENTA_BLOQUEADA": {
        "es": "Cuenta bloqueada temporalmente por demasiados intentos",
        "en": "Account temporarily locked",
    },
    "TRANSICION_NO_PERMITIDA": {
        "es": "La operación no es válida en el estado actual",
        "en": "Operation not allowed in current state",
    },
    "USUARIO_INACTIVO": {"es": "El usuario está inactivo o suspendido", "en": "User is inactive"},
    "PIN_INVALIDO": {"es": "PIN incorrecto", "en": "Invalid PIN"},
    "CREDENCIAL_INVALIDA": {"es": "Credencial no válida", "en": "Invalid credential"},
    "KIOSKO_INVALIDO": {"es": "Dispositivo de kiosko no reconocido", "en": "Unknown kiosk device"},
    "TURNO_NO_DISPONIBLE": {
        "es": "No hay turno activo para esta máquina en este momento",
        "en": "No active shift for this machine",
    },
    "PIN_POLITICA_INVALIDA": {
        "es": "El PIN debe contener entre 4 y 6 dígitos",
        "en": "PIN must be 4 to 6 digits",
    },
    "PASSWORD_POLITICA_INVALIDA": {
        "es": "La contraseña no cumple la política de seguridad",
        "en": "Password does not meet security policy",
    },
    "PASSWORD_INCORRECTA": {"es": "La contraseña actual no es correcta", "en": "Current password incorrect"},
    "TOKEN_RESET_INVALIDO": {
        "es": "El enlace de recuperación no es válido o expiró",
        "en": "Reset link invalid or expired",
    },
    "REFRESH_INVALIDO": {
        "es": "El token de refresco no es válido",
        "en": "Invalid refresh token",
    },
    "SESION_NO_ENCONTRADA": {"es": "Sesión no encontrada", "en": "Session not found"},
    "USUARIO_YA_REGISTRADO": {"es": "El nombre de usuario ya existe", "en": "Username already exists"},
    "EMAIL_YA_REGISTRADO": {"es": "El email ya está registrado", "en": "Email already registered"},
    "RATE_LIMIT_EXCEDIDO": {
        "es": "Demasiadas solicitudes. Intente más tarde",
        "en": "Too many requests. Try again later",
    },
    "VALIDACION_ENTRADA": {"es": "Los datos enviados no son válidos", "en": "Invalid input"},
}


def translate(code: str, locale: Locale = "es") -> str:
    """Devuelve el mensaje para un código de error en el idioma dado."""
    if code in MESSAGES and locale in MESSAGES[code]:
        return MESSAGES[code][locale]
    return code or "ERROR_DESCONOCIDO"