import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import random
import string
import logging

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@example.com")


def generate_verification_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


class VerificationCodeStore:
    """In-memory store for verification codes (use Redis for production)"""
    
    def __init__(self, expiry_minutes: int = 15):
        self.codes = {}
        self.expiry_minutes = expiry_minutes
    
    def generate_code(self, email: str) -> str:
        code = generate_verification_code()
        expiry = datetime.now() + timedelta(minutes=self.expiry_minutes)
        self.codes[email] = {
            "code": code,
            "expires_at": expiry,
            "attempts": 0
        }
        return code
    
    def verify_code(self, email: str, code: str) -> bool:
        if email not in self.codes:
            return False
        
        stored = self.codes[email]
        
        if datetime.now() > stored["expires_at"]:
            del self.codes[email]
            return False
        
        if stored["attempts"] >= 5:
            del self.codes[email]
            return False
        
        if stored["code"] == code:
            del self.codes[email]
            return True
        
        stored["attempts"] += 1
        return False
    
    def get_remaining_attempts(self, email: str) -> int:
        if email not in self.codes:
            return 5
        return 5 - self.codes[email]["attempts"]


verification_store = VerificationCodeStore()


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(f"Email not configured. Would send to {to_email}: {subject}")
        return False
    
    try:
        msg = MIMEMultipart()
        msg["From"] = FROM_EMAIL
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
        logger.error(f"Failed to send email: {e}")
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
