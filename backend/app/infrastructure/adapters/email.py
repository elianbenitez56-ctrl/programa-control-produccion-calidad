"""Puerto EmailSender en desarrollo: imprime el correo en el log (M1-D2)."""
import structlog

from app.application.ports.auth_ports import EmailSender

logger = structlog.get_logger(__name__)


class LogEmailSender(EmailSender):
    """Simula el envío de correos registrándolos en el log.

    El SMTP real llega con el módulo de Notificaciones.
    """

    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info(
            "email_simulado",
            destino=to,
            asunto=subject,
            cuerpo=body,
        )
