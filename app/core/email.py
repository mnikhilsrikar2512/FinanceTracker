import os
import re
import smtplib
import subprocess
import json
import shutil
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import UTC, datetime, timedelta
import random
import string
import logging
from pathlib import Path
import tempfile
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.password_reset_code import ResetStoreBase, PasswordResetCode

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = re.sub(r"\s+", "", os.getenv("SMTP_PASSWORD", ""))
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER or "noreply@example.com").strip()
FROM_NAME = os.getenv("FROM_NAME", "Finly Support").strip()
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_BASE_URL = os.getenv("BREVO_BASE_URL", "https://api.brevo.com").rstrip("/")
BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", FROM_EMAIL)
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "Finly Support")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
NODEMAILER_SCRIPT = PROJECT_ROOT / "scripts" / "send_email.js"


def generate_verification_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


class VerificationCodeStore:
    """SQLite-backed verification code store with expiry and retry tracking."""
    
    def __init__(
        self,
        expiry_minutes: int = 15,
        resend_cooldown_seconds: int = 60,
        storage_path: str | Path | None = None,
    ):
        self.expiry_minutes = expiry_minutes
        self.resend_cooldown_seconds = resend_cooldown_seconds
        self.storage_path = Path(
            storage_path
            or os.getenv("PASSWORD_RESET_STORE_PATH")
            or (Path(tempfile.gettempdir()) / "finly_password_resets.sqlite3")
        )
        self._engine = create_engine(
            f"sqlite:///{self.storage_path}",
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
            future=True,
        )
        self._session_factory = sessionmaker(bind=self._engine, autoflush=False, autocommit=False, future=True)
        ResetStoreBase.metadata.create_all(bind=self._engine)

    def _now(self) -> datetime:
        return datetime.now(UTC).replace(tzinfo=None)

    def _get_session(self):
        return self._session_factory()

    def _upsert_record(self, email: str):
        session = self._get_session()
        try:
            record = session.query(PasswordResetCode).filter(PasswordResetCode.email == email).one_or_none()
            if record is None:
                record = PasswordResetCode(email=email)
                session.add(record)
            return session, record
        except Exception:
            session.close()
            raise

    def record_request(self, email: str):
        session, record = self._upsert_record(email)
        try:
            record.requested_at = self._now()
            session.commit()
        finally:
            session.close()

    def clear_request_lock(self, email: str):
        session = self._get_session()
        try:
            record = session.query(PasswordResetCode).filter(PasswordResetCode.email == email).one_or_none()
            if record is not None:
                record.requested_at = None
                session.commit()
        finally:
            session.close()

    def get_resend_wait_seconds(self, email: str) -> int:
        session = self._get_session()
        try:
            record = session.query(PasswordResetCode).filter(PasswordResetCode.email == email).one_or_none()
            if not record or not record.requested_at:
                return 0
            retry_at = record.requested_at + timedelta(seconds=self.resend_cooldown_seconds)
            return max(0, int((retry_at - self._now()).total_seconds()))
        finally:
            session.close()

    def generate_code(self, email: str) -> str:
        code = generate_verification_code()
        session, record = self._upsert_record(email)
        try:
            now = self._now()
            record.code = code
            record.attempts = 0
            record.requested_at = now
            record.expires_at = now + timedelta(minutes=self.expiry_minutes)
            session.commit()
            return code
        finally:
            session.close()

    def verify_code(self, email: str, code: str) -> bool:
        session = self._get_session()
        try:
            record = session.query(PasswordResetCode).filter(PasswordResetCode.email == email).one_or_none()
            if not record:
                return False

            if record.expires_at and self._now() > record.expires_at:
                session.delete(record)
                session.commit()
                return False

            if record.attempts >= 5:
                return False

            if record.code == code:
                session.delete(record)
                session.commit()
                return True

            record.attempts += 1
            session.commit()
            return False
        finally:
            session.close()

    def get_remaining_attempts(self, email: str) -> int:
        session = self._get_session()
        try:
            record = session.query(PasswordResetCode).filter(PasswordResetCode.email == email).one_or_none()
            if not record:
                return 5
            return max(0, 5 - int(record.attempts or 0))
        finally:
            session.close()

    def clear(self, email: str):
        session = self._get_session()
        try:
            record = session.query(PasswordResetCode).filter(PasswordResetCode.email == email).one_or_none()
            if record is not None:
                session.delete(record)
                session.commit()
        finally:
            session.close()

    def clear_all(self):
        session = self._get_session()
        try:
            session.query(PasswordResetCode).delete()
            session.commit()
        finally:
            session.close()


verification_store = VerificationCodeStore()


def should_log_reset_code() -> bool:
    env = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
    return os.getenv("DEBUG_RESET_CODES") == "1" or env in {"development", "dev", "local", "test"}


def is_brevo_configured() -> bool:
    return bool(BREVO_API_KEY)


def is_nodemailer_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD and shutil.which("node") and NODEMAILER_SCRIPT.exists())


def html_to_text(value: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def send_email_via_nodemailer(to_email: str, subject: str, body: str) -> bool:
    if not is_nodemailer_configured():
        return False

    payload = {
        "host": SMTP_HOST,
        "port": SMTP_PORT,
        "user": SMTP_USER,
        "password": SMTP_PASSWORD,
        "fromEmail": FROM_EMAIL,
        "fromName": FROM_NAME,
        "toEmail": to_email,
        "subject": subject,
        "html": body,
        "text": html_to_text(body),
    }

    try:
        result = subprocess.run(
            ["node", str(NODEMAILER_SCRIPT)],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            timeout=20,
            check=False,
        )
        if result.returncode == 0:
            logger.info("Nodemailer email sent to %s", to_email)
            return True

        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        logger.error(
            "Nodemailer delivery failed for %s: %s",
            to_email,
            stderr or stdout or f"exit code {result.returncode}",
        )
        return False
    except Exception as exc:
        logger.error("Nodemailer delivery failed for %s: %s", to_email, exc)
        return False


def send_email_via_brevo(to_email: str, subject: str, body: str) -> bool:
    if not is_brevo_configured():
        return False

    endpoint = f"{BREVO_BASE_URL}/v3/smtp/email"
    payload = {
        "sender": {
            "email": BREVO_FROM_EMAIL,
            "name": BREVO_FROM_NAME,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": html_to_text(body),
        "htmlContent": body,
    }

    try:
        response = httpx.post(
            endpoint,
            headers={
                "accept": "application/json",
                "api-key": BREVO_API_KEY,
                "content-type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )
        response.raise_for_status()
        logger.info("Brevo email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Brevo delivery failed for %s: %s", to_email, exc)
        return False


def send_email(to_email: str, subject: str, body: str) -> bool:
    if is_nodemailer_configured() and send_email_via_nodemailer(to_email, subject, body):
        return True

    if not SMTP_USER or not SMTP_PASSWORD:
        if is_brevo_configured() and send_email_via_brevo(to_email, subject, body):
            return True
        logger.warning("Email not configured. Would send to %s: %s", to_email, subject)
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        
        msg.attach(MIMEText(body, "html"))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Email sent to {to_email}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")
        if is_brevo_configured() and send_email_via_brevo(to_email, subject, body):
            return True
        return False


def send_verification_code(email: str, code: str) -> bool:
    subject = "Password Reset Verification Code"
    body = f"""
    <html>
    <body>
        <h2>Password Reset Request</h2>
        <p>Your verification code is: <strong>{code}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
    </body>
    </html>
    """
    return send_email(email, subject, body)
