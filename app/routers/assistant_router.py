from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.response import success_response
from app.models.user import User

router = APIRouter(prefix="/assistant", tags=["Assistant"])


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=600)
    section: str | None = None
    workspace: str | None = None


def _normalize_text(value: str | None) -> str:
    return str(value or "").strip().lower()


def _workspace_for_user(user: User) -> str:
    return "admin" if str(getattr(user, "role", "")) .lower() == "admin" else "user"


def _build_rule_based_reply(message: str, section: str, workspace: str) -> tuple[str, str | None]:
    if any(token in message for token in ("budget", "open budget", "create budget")):
        return ("Open Budgets to create and monitor plans by category.", "budgets")
    if any(token in message for token in ("transaction", "add transaction", "expense", "income")):
        return ("Open Transactions to add entries, filter history, and manage records.", "transactions")
    if any(token in message for token in ("report", "export", "pdf", "csv")):
        return ("Open Reports to review performance and use CSV/PDF export actions.", "reports")
    if any(token in message for token in ("profile", "account", "name", "password")):
        return ("Open Profile to update your account details and preferences.", "profile")
    if workspace == "admin" and any(token in message for token in ("user", "block", "unblock")):
        return ("Open Users to review accounts and perform block/unblock actions.", "users")
    if workspace == "admin" and any(token in message for token in ("category", "categories")):
        return ("Open Categories to add, review, or clean up global finance categories.", "categories")
    current = section or ("dashboard" if workspace == "user" else "admin dashboard")
    return (f"I can help you navigate Finly. Try asking: open budgets, open transactions, export report, or open profile. You are currently on {current}.", None)


@router.post("/chat", response_model=dict)
def chat_with_assistant(payload: AssistantChatRequest, current_user: User = Depends(get_current_user)):
    message = _normalize_text(payload.message)
    section = _normalize_text(payload.section)
    workspace = _normalize_text(payload.workspace) or _workspace_for_user(current_user)
    reply, navigate_to = _build_rule_based_reply(message, section, workspace)
    return success_response(data={
        "reply": reply,
        "navigate_to": navigate_to,
        "workspace": workspace,
    })
