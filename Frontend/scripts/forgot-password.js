import { apiRequest } from "./core/api.js";
import { createAuthToast, initAuthTheme } from "./core/auth-page.js";

const requestForm = document.getElementById("forgot-request-form");
const toastRoot = document.getElementById("toast-root");
const toast = createAuthToast(toastRoot);

async function handleRequestCode(event) {
  event.preventDefault();
  const submitButton = requestForm.querySelector('button[type="submit"]');
  const formData = new FormData(requestForm);
  const email = String(formData.get("email") || "").trim();

  submitButton.disabled = true;
  submitButton.textContent = "Sending code...";

  try {
    await apiRequest("/auth/forgot-password", {
      method: "POST",
      body: { email },
      token: null,
    });
    toast("Code sent", "Check your email and continue to step 2.", "success");
    window.setTimeout(() => {
      window.location.href = `./reset-password.html?email=${encodeURIComponent(email)}`;
    }, 550);
  } catch (error) {
    toast("Could not send code", error.message || "Unable to start the reset flow.", "danger");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send verification code";
  }
}

initAuthTheme();
requestForm?.addEventListener("submit", handleRequestCode);
