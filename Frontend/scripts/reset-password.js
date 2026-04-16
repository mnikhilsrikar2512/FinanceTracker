import { apiRequest } from "./core/api.js";
import { createAuthToast, initAuthTheme } from "./core/auth-page.js";

const form = document.getElementById("reset-password-form");
const toastRoot = document.getElementById("toast-root");
const toast = createAuthToast(toastRoot);

function prefillEmailFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const email = String(params.get("email") || "").trim();
  if (!email) return;
  const emailField = form?.querySelector('[name="email"]');
  if (!emailField) return;
  emailField.value = email;
}

async function handleSubmit(event) {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const newPassword = String(formData.get("new_password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (newPassword !== confirmPassword) {
    toast("Passwords do not match", "Please confirm the same password in both fields.", "danger");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Resetting...";

  try {
    await apiRequest("/auth/reset-password", {
      method: "POST",
      body: {
        email,
        code,
        new_password: newPassword,
      },
      token: null,
    });
    toast("Password updated", "Your password has been reset. Sign in with the new credentials.", "success");
    window.setTimeout(() => {
      window.location.href = "./login.html";
    }, 700);
  } catch (error) {
    toast("Reset failed", error.message || "Unable to verify the code.", "danger");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Reset password";
  }
}

initAuthTheme();
prefillEmailFromQuery();
form?.addEventListener("submit", handleSubmit);
