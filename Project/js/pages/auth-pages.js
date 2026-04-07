(function () {
  function redirectAuthenticatedUser() {
    const existingToken = localStorage.getItem("token");
    if (!existingToken) return;

    FinanceUtils.getCurrentUser()
      .then((user) => {
        if (user?.role === "admin") window.location.href = "admin.html";
        else if (user) window.location.href = "app.html";
      })
      .catch(() => {});
  }

  function bindFieldBlurValidation(form, validationRules) {
    form.querySelectorAll("input").forEach((input) => {
      input.addEventListener("blur", () => {
        if (input.type === "email") {
          input.value = FinanceUtils.normalizeEmail(input.value);
        }

        const fieldName = input.name;
        if (!validationRules[fieldName]) return;

        const validation = FinanceUtils.validateForm(form, { [fieldName]: validationRules[fieldName] });
        if (!validation.isValid) {
          FinanceUtils.showFormErrors(form, validation.errors);
          return;
        }

        const errorDiv = input.parentNode.querySelector(".error-message");
        if (errorDiv) errorDiv.remove();
        input.classList.remove("border-red-500");
      });
    });
  }

  function initLoginPage() {
    redirectAuthenticatedUser();

    const form = document.getElementById("loginForm");
    const noticeBox = document.getElementById("noticeBox");
    const errorBox = document.getElementById("errorBox");
    const loginBtn = document.getElementById("loginBtn");
    const authNotice = sessionStorage.getItem("finly_auth_notice");

    if (authNotice) {
      noticeBox.innerText = authNotice;
      noticeBox.classList.remove("hidden");
      sessionStorage.removeItem("finly_auth_notice");
    }

    const validationRules = {
      email: [
        { required: true, message: "Email is required" },
        { email: true, message: "Please enter a valid email address" }
      ],
      password: [
        { required: true, message: "Password is required" }
      ]
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      FinanceUtils.clearFormErrors(form);

      const validation = FinanceUtils.validateForm(form, validationRules);
      if (!validation.isValid) {
        FinanceUtils.showFormErrors(form, validation.errors);
        return;
      }

      loginBtn.innerText = "Logging in...";
      loginBtn.disabled = true;
      errorBox.classList.add("hidden");
      noticeBox.classList.add("hidden");

      const emailInput = document.getElementById("email");
      const email = FinanceUtils.normalizeEmail(emailInput.value);
      emailInput.value = email;
      const password = document.getElementById("password").value;

      try {
        const data = await FinanceUtils.fetchPublic("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        localStorage.setItem("token", data.data.access_token);
        const user = data.data?.user || null;
        if (user?.role) {
          localStorage.setItem("finance_user_role", user.role);
        }
        FinanceUtils.showToast("Login successful!", "success");

        setTimeout(() => {
          window.location.href = user?.role === "admin" ? "admin.html" : "app.html";
        }, 350);
      } catch (error) {
        FinanceUtils.showToast(error.message, "error");
        errorBox.innerText = error.message;
        errorBox.classList.remove("hidden");
      } finally {
        loginBtn.innerText = "Sign In";
        loginBtn.disabled = false;
      }
    });

    bindFieldBlurValidation(form, validationRules);
  }

  function initSignupPage() {
    redirectAuthenticatedUser();

    const form = document.getElementById("signupForm");
    const errorBox = document.getElementById("errorBox");
    const signupBtn = document.getElementById("signupBtn");

    const validationRules = {
      name: [
        { required: true, message: "Full name is required" },
        { minLength: 2, message: "Name is too short" }
      ],
      email: [
        { required: true, message: "Email is required" },
        { email: true, message: "Please enter a valid email address" }
      ],
      password: [
        { required: true, message: "Password is required" },
        { minLength: 8, message: "Password must be at least 8 characters" },
        { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: "Password must include uppercase, lowercase, and a number" }
      ],
      confirmPassword: [
        { required: true, message: "Please confirm your password" }
      ]
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      FinanceUtils.clearFormErrors(form);

      const validation = FinanceUtils.validateForm(form, validationRules);
      if (!validation.isValid) {
        FinanceUtils.showFormErrors(form, validation.errors);
        return;
      }

      errorBox.classList.add("hidden");

      const name = document.getElementById("name").value.trim();
      const emailInput = document.getElementById("email");
      const email = FinanceUtils.normalizeEmail(emailInput.value);
      emailInput.value = email;
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (password !== confirmPassword) {
        FinanceUtils.showFormErrors(form, { confirmPassword: "Passwords do not match" });
        FinanceUtils.showToast("Passwords do not match", "error");
        return;
      }

      signupBtn.innerText = "Creating Account...";
      signupBtn.disabled = true;

      try {
        const data = await FinanceUtils.fetchPublic("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ name, email, password })
        });

        FinanceUtils.showToast("Account created successfully!", "success");
        if (data.data?.access_token) {
          localStorage.setItem("token", data.data.access_token);
          localStorage.setItem("finance_user_role", data.data?.user?.role || "user");
        }

        setTimeout(() => {
          window.location.href = "app.html";
        }, 1000);
      } catch (error) {
        errorBox.innerText = error.message;
        errorBox.classList.remove("hidden");
        FinanceUtils.showToast(error.message, "error");
      } finally {
        signupBtn.innerText = "Create Account";
        signupBtn.disabled = false;
      }
    });

    bindFieldBlurValidation(form, validationRules);
  }

  function initForgotPasswordPage() {
    redirectAuthenticatedUser();

    const form = document.getElementById("requestCodeForm");
    const errorBox = document.getElementById("errorBox");
    const requestBtn = document.getElementById("requestCodeBtn");
    const requestEmailInput = document.getElementById("requestEmail");

    const validationRules = {
      requestEmail: [
        { required: true, message: "Email is required" },
        { email: true, message: "Please enter a valid email address" }
      ]
    };

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(FinanceUtils.normalizeEmail(value));
    }

    function updateSubmitState() {
      requestBtn.disabled = !isValidEmail(requestEmailInput.value);
    }

    requestEmailInput.addEventListener("input", updateSubmitState);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      FinanceUtils.clearFormErrors(form);
      errorBox.classList.add("hidden");

      const validation = FinanceUtils.validateForm(form, validationRules);
      if (!validation.isValid) {
        FinanceUtils.showFormErrors(form, validation.errors);
        return;
      }

      const email = FinanceUtils.normalizeEmail(requestEmailInput.value);
      requestEmailInput.value = email;
      requestBtn.innerText = "Sending...";
      requestBtn.disabled = true;

      try {
        const response = await FinanceUtils.fetchPublic("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email })
        });

        sessionStorage.setItem("finly_reset_email", email);
        sessionStorage.setItem("finly_reset_requested_at", String(Date.now()));
        sessionStorage.setItem(
          "finly_reset_notice",
          response.message || "Verification requested. Continue to the next step."
        );
        FinanceUtils.showToast("Verification code requested", "success");
        window.location.href = `reset-password.html?email=${encodeURIComponent(email)}`;
      } catch (error) {
        FinanceUtils.showToast(error.message, "error");
        errorBox.innerText = error.message;
        errorBox.classList.remove("hidden");
      } finally {
        requestBtn.innerText = "Send Verification Code";
        updateSubmitState();
      }
    });

    requestEmailInput.addEventListener("blur", (event) => {
      event.target.value = FinanceUtils.normalizeEmail(event.target.value);
      updateSubmitState();
    });

    updateSubmitState();
  }

  function initResetPasswordPage() {
    redirectAuthenticatedUser();

    const form = document.getElementById("resetPasswordForm");
    const noticeBox = document.getElementById("noticeBox");
    const errorBox = document.getElementById("errorBox");
    const resetBtn = document.getElementById("resetPasswordBtn");
    const resendCodeBtn = document.getElementById("resendCodeBtn");
    const cooldownHint = document.getElementById("cooldownHint");
    const resendHint = document.getElementById("resendHint");
    const emailSummary = document.getElementById("emailSummary");
    const maskedEmailText = document.getElementById("maskedEmailText");
    const params = new URLSearchParams(window.location.search);
    const rememberedEmail = FinanceUtils.normalizeEmail(params.get("email") || sessionStorage.getItem("finly_reset_email") || "");
    const notice = sessionStorage.getItem("finly_reset_notice");
    const resetEmailInput = document.getElementById("resetEmail");
    const verificationCodeInput = document.getElementById("verificationCode");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
    let resendInterval = null;

    if (rememberedEmail) {
      resetEmailInput.value = rememberedEmail;
      emailSummary.classList.remove("hidden");
      maskedEmailText.innerText = maskEmail(rememberedEmail);
    }

    if (notice) {
      noticeBox.innerText = notice;
      noticeBox.classList.remove("hidden");
      sessionStorage.removeItem("finly_reset_notice");
    }

    const validationRules = {
      resetEmail: [
        { required: true, message: "Email is required" },
        { email: true, message: "Please enter a valid email address" }
      ],
      verificationCode: [
        { required: true, message: "Verification code is required" },
        { minLength: 4, message: "Verification code looks too short" }
      ],
      newPassword: [
        { required: true, message: "New password is required" },
        { minLength: 8, message: "Password must be at least 8 characters" },
        { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: "Password must include uppercase, lowercase, and a number" }
      ],
      confirmNewPassword: [
        { required: true, message: "Please confirm your new password" }
      ]
    };

    function maskEmail(email) {
      const normalized = FinanceUtils.normalizeEmail(email);
      const [name, domain] = normalized.split("@");
      if (!name || !domain) return normalized;
      const visibleStart = name.slice(0, 2);
      const visibleEnd = name.length > 4 ? name.slice(-1) : "";
      return `${visibleStart}${"•".repeat(Math.max(2, name.length - visibleStart.length - visibleEnd.length))}${visibleEnd}@${domain}`;
    }

    function getPasswordState(password) {
      return {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /\d/.test(password)
      };
    }

    function updatePasswordChecklist() {
      const state = getPasswordState(newPasswordInput.value);
      document.querySelectorAll("#passwordChecklist [data-rule]").forEach((item) => {
        item.classList.toggle("is-met", Boolean(state[item.dataset.rule]));
      });
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(FinanceUtils.normalizeEmail(value));
    }

    function updateSubmitState() {
      const passwordState = getPasswordState(newPasswordInput.value);
      const passwordsMatch = newPasswordInput.value.length > 0 && newPasswordInput.value === confirmNewPasswordInput.value;

      resetBtn.disabled = !(
        isValidEmail(resetEmailInput.value) &&
        verificationCodeInput.value.trim().length >= 6 &&
        Object.values(passwordState).every(Boolean) &&
        passwordsMatch
      );
    }

    function getCooldownRemainingSeconds() {
      const requestedAt = Number(sessionStorage.getItem("finly_reset_requested_at") || "0");
      if (!requestedAt) return 0;
      const elapsed = Math.floor((Date.now() - requestedAt) / 1000);
      return Math.max(0, 60 - elapsed);
    }

    function renderCooldown() {
      const remaining = getCooldownRemainingSeconds();
      if (remaining > 0) {
        resendCodeBtn.disabled = true;
        cooldownHint.innerText = `Resend available in ${remaining}s`;
      } else {
        resendCodeBtn.disabled = !isValidEmail(resetEmailInput.value);
        cooldownHint.innerText = "You can request another code if the last email has not arrived.";
      }
    }

    function startCooldownTicker() {
      if (resendInterval) window.clearInterval(resendInterval);
      renderCooldown();
      resendInterval = window.setInterval(() => {
        renderCooldown();
        if (getCooldownRemainingSeconds() <= 0) {
          window.clearInterval(resendInterval);
          resendInterval = null;
        }
      }, 1000);
    }

    async function resendCode() {
      const email = FinanceUtils.normalizeEmail(resetEmailInput.value);
      resetEmailInput.value = email;

      if (!isValidEmail(email)) {
        FinanceUtils.showToast("Enter a valid email first", "error");
        return;
      }

      resendCodeBtn.disabled = true;
      resendCodeBtn.innerText = "Sending...";

      try {
        const response = await FinanceUtils.fetchPublic("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email })
        });
        sessionStorage.setItem("finly_reset_email", email);
        sessionStorage.setItem("finly_reset_requested_at", String(Date.now()));
        noticeBox.innerText = response.message || "A new verification code has been requested.";
        noticeBox.classList.remove("hidden");
        errorBox.classList.add("hidden");
        maskedEmailText.innerText = maskEmail(email);
        emailSummary.classList.remove("hidden");
        resendHint.innerText = "A fresh code has been requested. Check inbox and spam if it takes a moment.";
        FinanceUtils.showToast("New verification code requested", "success");
        startCooldownTicker();
      } catch (error) {
        errorBox.innerText = error.message;
        errorBox.classList.remove("hidden");
        FinanceUtils.showToast(error.message, "error");
      } finally {
        resendCodeBtn.innerText = "Resend code";
        renderCooldown();
      }
    }

    function syncEmailSummary(value) {
      const normalized = FinanceUtils.normalizeEmail(value);
      if (isValidEmail(normalized)) {
        maskedEmailText.innerText = maskEmail(normalized);
        emailSummary.classList.remove("hidden");
      } else if (!rememberedEmail) {
        emailSummary.classList.add("hidden");
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      FinanceUtils.clearFormErrors(form);
      errorBox.classList.add("hidden");

      const validation = FinanceUtils.validateForm(form, validationRules);
      if (!validation.isValid) {
        FinanceUtils.showFormErrors(form, validation.errors);
        return;
      }

      const email = FinanceUtils.normalizeEmail(resetEmailInput.value);
      resetEmailInput.value = email;
      const code = verificationCodeInput.value.trim();
      const newPassword = newPasswordInput.value;
      const confirmNewPassword = confirmNewPasswordInput.value;

      if (newPassword !== confirmNewPassword) {
        FinanceUtils.showFormErrors(form, { confirmNewPassword: "Passwords do not match" });
        FinanceUtils.showToast("Passwords do not match", "error");
        return;
      }

      resetBtn.innerText = "Resetting Password...";
      resetBtn.disabled = true;

      try {
        const response = await FinanceUtils.fetchPublic("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ email, code, new_password: newPassword })
        });

        sessionStorage.removeItem("finly_reset_email");
        sessionStorage.removeItem("finly_reset_requested_at");
        sessionStorage.setItem("finly_auth_notice", response.message || "Password reset successful. Please sign in.");
        FinanceUtils.showToast("Password reset successful", "success");
        window.location.href = "login.html?reset=success";
      } catch (error) {
        FinanceUtils.showToast(error.message, "error");
        errorBox.innerText = error.message;
        errorBox.classList.remove("hidden");
      } finally {
        resetBtn.innerText = "Reset Password";
        resetBtn.disabled = false;
      }
    });

    resetEmailInput.addEventListener("input", (event) => {
      syncEmailSummary(event.target.value);
      updateSubmitState();
      renderCooldown();
    });

    resetEmailInput.addEventListener("blur", (event) => {
      event.target.value = FinanceUtils.normalizeEmail(event.target.value);
      syncEmailSummary(event.target.value);
      updateSubmitState();
      renderCooldown();
    });

    verificationCodeInput.addEventListener("input", (event) => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
      updateSubmitState();
    });

    newPasswordInput.addEventListener("input", () => {
      updatePasswordChecklist();
      updateSubmitState();
    });
    confirmNewPasswordInput.addEventListener("input", updateSubmitState);
    resendCodeBtn.addEventListener("click", resendCode);

    updatePasswordChecklist();
    syncEmailSummary(resetEmailInput.value);
    updateSubmitState();
    startCooldownTicker();
  }

  const page = document.body?.dataset?.page;
  if (page === "login") initLoginPage();
  if (page === "signup") initSignupPage();
  if (page === "forgot-password") initForgotPasswordPage();
  if (page === "reset-password") initResetPasswordPage();
})();
