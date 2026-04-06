from datetime import datetime, timedelta

from app.core.email import VerificationCodeStore


def test_generated_code_can_be_verified_once():
    store = VerificationCodeStore()

    code = store.generate_code("user@example.com")

    assert store.verify_code("user@example.com", code) is True
    assert store.verify_code("user@example.com", code) is False


def test_invalid_code_consumes_attempts():
    store = VerificationCodeStore()
    store.generate_code("user@example.com")

    assert store.verify_code("user@example.com", "000000") is False
    assert store.get_remaining_attempts("user@example.com") == 4


def test_resend_wait_uses_request_timestamp():
    store = VerificationCodeStore(resend_cooldown_seconds=60)
    store.record_request("user@example.com")
    store.last_requested_at["user@example.com"] = datetime.now() - timedelta(seconds=30)

    remaining = store.get_resend_wait_seconds("user@example.com")

    assert 0 < remaining <= 30


def test_expired_code_fails_cleanly():
    store = VerificationCodeStore(expiry_minutes=15)
    code = store.generate_code("user@example.com")
    store.codes["user@example.com"]["expires_at"] = datetime.now() - timedelta(seconds=1)

    assert store.verify_code("user@example.com", code) is False
