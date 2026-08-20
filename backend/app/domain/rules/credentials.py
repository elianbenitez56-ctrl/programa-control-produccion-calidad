"""Políticas de credenciales del dominio (contraseñas y PIN)."""

import re


class PasswordPolicy:
    """Política de contraseñas aplicable a usuarios de gestión.

    Requisitos: mínimo 8 caracteres, al menos una mayúscula, una minúscula
    y un dígito.
    """

    MIN_LENGTH = 8

    @classmethod
    def validate(cls, password: str) -> list[str]:
        """Devuelve la lista de reglas incumplidas (vacía si es válida)."""
        failures: list[str] = []
        if len(password) < cls.MIN_LENGTH:
            failures.append("MIN_LENGTH")
        if not re.search(r"[A-Z]", password):
            failures.append("MAYUSCULA")
        if not re.search(r"[a-z]", password):
            failures.append("MINUSCULA")
        if not re.search(r"\d", password):
            failures.append("DIGITO")
        return failures

    @classmethod
    def is_valid(cls, password: str) -> bool:
        return not cls.validate(password)


class PinPolicy:
    """Política de PIN para operarios (4 a 6 dígitos numéricos)."""

    @classmethod
    def is_valid(cls, pin: str) -> bool:
        return bool(re.fullmatch(r"\d{4,6}", pin))

    @classmethod
    def normalize(cls, pin: str) -> str:
        """Normaliza el PIN (sin espacios). Lanza ValueError si no es válido."""
        cleaned = pin.strip()
        if not cls.is_valid(cleaned):
            raise ValueError("PIN_POLITICA_INVALIDA")
        return cleaned
