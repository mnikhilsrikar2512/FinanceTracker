import { apiRequest, clearSession, writeSession } from "./core/api.js";
import { createAuthToast, initAuthTheme } from "./core/auth-page.js";

const form = document.getElementById("login-form");
const toastRoot = document.getElementById("toast-root");
const toast = createAuthToast(toastRoot);

async function handleSubmit(event) {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const remember = formData.get("remember") === "on";

  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";

  try {
    clearSession();
    const payload = await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
      token: null,
    });
    const session = payload?.data ?? payload;
    const user = session?.user ?? session?.data?.user ?? null;
    const accessToken = session?.access_token ?? session?.accessToken ?? session?.token;
    if (!accessToken || !user) {
      throw new Error("Login response did not include a valid session.");
    }
    writeSession({ accessToken, user, remember });
    toast("Signed in", `Welcome back, ${user.name || user.email}.`, "success");
    window.setTimeout(() => {
      window.location.href = user.role === "admin" ? "./admin.html#dashboard" : "./app.html#dashboard";
    }, 350);
  } catch (error) {
    toast("Sign-in failed", error.message || "Unable to authenticate.", "danger");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enter workspace";
  }
}

initAuthTheme();

form?.addEventListener("submit", handleSubmit);
