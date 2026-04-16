import { apiRequest } from "./core/api.js";
import { createAuthToast, initAuthTheme } from "./core/auth-page.js";

const form = document.getElementById("signup-form");
const toastRoot = document.getElementById("toast-root");
const toast = createAuthToast(toastRoot);

async function handleSubmit(event) {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (password !== confirmPassword) {
    toast("Passwords do not match", "Please make sure both password fields are the same.", "danger");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating account...";

  try {
    await apiRequest("/auth/signup", {
      method: "POST",
      body: { name, email, password },
      token: null,
    });
    toast("Account created", "Check your email for a verification code if your backend requires it.", "success");
    window.setTimeout(() => {
      window.location.href = "./login.html";
    }, 700);
  } catch (error) {
    toast("Signup failed", error.message || "Unable to create the account.", "danger");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create account";
  }
}

initAuthTheme();
form?.addEventListener("submit", handleSubmit);
