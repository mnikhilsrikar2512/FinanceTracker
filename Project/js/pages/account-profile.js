(function () {
  const page = document.body?.dataset?.page;
  if (page !== "profile" && page !== "admin-profile") return;

  const isAdminPage = page === "admin-profile";
  const config = {
    feedbackToneClass: isAdminPage
      ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900/40"
      : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/40",
    loadError: isAdminPage
      ? "We could not load your admin profile right now. Please refresh and try again."
      : "We could not load your profile right now. Please refresh and try again.",
    loadToast: isAdminPage ? "Failed to load admin profile" : "Failed to load profile",
    profileUpdated: isAdminPage ? "Admin profile updated successfully." : "Profile updated successfully.",
    passwordUpdated: isAdminPage ? "Admin password updated successfully." : "Password updated successfully.",
    deletePhrase: isAdminPage ? "DELETE ADMIN" : "DELETE",
    deleteConfirmMessage: isAdminPage
      ? "Delete this admin account permanently? This cannot be undone."
      : "Delete your account permanently? This cannot be undone.",
    deletingLabel: isAdminPage ? "Deleting Admin..." : "Deleting Account...",
    deleteButtonIdle: isAdminPage ? "Delete Admin Account" : "Delete My Account",
    deleteSuccessToast: isAdminPage ? "Admin account deleted" : "Account deleted",
    noChangesMessage: "No profile changes to save",
    redirectOnWrongRole: isAdminPage ? "profile.html" : "admin-profile.html"
  };

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  let currentProfile = null;

  function showFeedback(message, tone = "info") {
    const feedback = document.getElementById("profileFeedback");
    const toneMap = {
      success: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/40",
      error: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50",
      info: config.feedbackToneClass
    };
    feedback.className = `${toneMap[tone] || toneMap.info} mb-6 p-4 rounded-lg text-xs font-bold uppercase tracking-wide border`;
    feedback.textContent = message;
    feedback.classList.remove("hidden");
  }

  function populateProfile(user) {
    currentProfile = user;
    document.getElementById("overviewName").textContent = user.name || "Not set";
    document.getElementById("overviewEmail").textContent = user.email || "Not set";
    document.getElementById("overviewStatus").textContent = (user.status || "active").replace(/^./, (char) => char.toUpperCase());
    document.getElementById("overviewCreatedAt").textContent = user.created_at ? FinanceUtils.formatDate(user.created_at) : "Unavailable";
    document.getElementById("profileName").value = user.name || "";
    document.getElementById("profileEmail").value = user.email || "";

    const roleChip = document.getElementById("profileRoleChip");
    if (roleChip) {
      roleChip.textContent = user.role === "admin" ? "Admin Account" : "User Account";
      roleChip.className = user.role === "admin"
        ? "context-chip context-chip-admin"
        : "context-chip context-chip-user";
    }
  }

  async function loadProfile() {
    try {
      const response = await FinanceUtils.fetchWithAuth("/users/me");
      if (!response?.success) throw new Error("Failed to load profile");

      if (isAdminPage && response.data.role !== "admin") {
        window.location.href = config.redirectOnWrongRole;
        return;
      }

      if (!isAdminPage && response.data.role === "admin") {
        window.location.href = config.redirectOnWrongRole;
        return;
      }

      populateProfile(response.data);
    } catch (error) {
      FinanceUtils.showToast(config.loadToast, "error");
      showFeedback(config.loadError, "error");
    }
  }

  async function ensureRoleAccess() {
    if (!isAdminPage) return true;
    return FinanceUtils.checkAdmin();
  }

  document.getElementById("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    FinanceUtils.clearFormErrors(form);
    const name = document.getElementById("profileName").value.trim();
    const emailInput = document.getElementById("profileEmail");
    const email = FinanceUtils.normalizeEmail(emailInput.value);
    emailInput.value = email;

    const validation = FinanceUtils.validateForm(form, {
      profileName: [
        { required: true, message: "Name is required" },
        { minLength: 2, message: "Name is too short" }
      ],
      profileEmail: [
        { required: true, message: "Email is required" },
        { email: true, message: "Please enter a valid email address" }
      ]
    });

    if (!validation.isValid) {
      FinanceUtils.showFormErrors(form, validation.errors);
      return;
    }

    if (currentProfile && currentProfile.name === name && currentProfile.email === email) {
      FinanceUtils.showToast(config.noChangesMessage, "info");
      return;
    }

    const button = document.getElementById("saveProfileBtn");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      const response = await FinanceUtils.fetchWithAuth("/users/me", {
        method: "PUT",
        body: JSON.stringify({ name, email })
      });
      populateProfile(response.data);
      showFeedback(config.profileUpdated, "success");
      FinanceUtils.showToast("Profile updated", "success");
    } catch (error) {
      showFeedback(error.message, "error");
      FinanceUtils.showToast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Save Profile";
    }
  });

  document.getElementById("resetProfileBtn").addEventListener("click", () => {
    if (!currentProfile) return;
    document.getElementById("profileName").value = currentProfile.name || "";
    document.getElementById("profileEmail").value = currentProfile.email || "";
    FinanceUtils.clearFormErrors(document.getElementById("profileForm"));
  });

  document.getElementById("passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    FinanceUtils.clearFormErrors(form);

    const oldPassword = document.getElementById("oldPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword = document.getElementById("confirmNewPassword").value;
    const passwordStrengthError = FinanceUtils.getPasswordStrengthError(newPassword);

    const validation = FinanceUtils.validateForm(form, {
      oldPassword: [{ required: true, message: "Current password is required" }],
      newPassword: [{ required: true, message: "New password is required" }],
      confirmNewPassword: [{ required: true, message: "Please confirm the new password" }]
    });

    if (!validation.isValid) {
      FinanceUtils.showFormErrors(form, validation.errors);
      return;
    }

    if (passwordStrengthError) {
      FinanceUtils.showFormErrors(form, { newPassword: passwordStrengthError });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      FinanceUtils.showFormErrors(form, { confirmNewPassword: "Passwords do not match" });
      return;
    }

    const button = document.getElementById("changePasswordBtn");
    button.disabled = true;
    button.textContent = "Updating...";

    try {
      await FinanceUtils.fetchWithAuth("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      form.reset();
      showFeedback(config.passwordUpdated, "success");
      FinanceUtils.showToast("Password updated", "success");
    } catch (error) {
      showFeedback(error.message, "error");
      FinanceUtils.showToast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Update Password";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    FinanceUtils.logout();
  });

  document.getElementById("deleteConfirmation").addEventListener("input", (event) => {
    document.getElementById("deleteAccountBtn").disabled = event.target.value.trim() !== config.deletePhrase;
  });

  document.getElementById("deleteAccountBtn").addEventListener("click", async () => {
    const confirmationValue = document.getElementById("deleteConfirmation").value.trim();
    if (confirmationValue !== config.deletePhrase) {
      FinanceUtils.showToast(`Type ${config.deletePhrase} to enable deletion`, "error");
      return;
    }

    const confirmed = window.confirm(config.deleteConfirmMessage);
    if (!confirmed) return;

    const button = document.getElementById("deleteAccountBtn");
    button.disabled = true;
    button.textContent = config.deletingLabel;

    try {
      await FinanceUtils.fetchWithAuth("/users/me", { method: "DELETE" });
      localStorage.removeItem("token");
      localStorage.removeItem("finance_user_role");
      sessionStorage.removeItem("finly_auth_notice");
      sessionStorage.removeItem("finly_reset_email");
      sessionStorage.removeItem("finly_reset_notice");
      FinanceUtils.showToast(config.deleteSuccessToast, "success");
      window.location.href = "index.html";
    } catch (error) {
      showFeedback(error.message, "error");
      FinanceUtils.showToast(error.message, "error");
      button.disabled = false;
      button.textContent = config.deleteButtonIdle;
    }
  });

  document.getElementById("profileEmail").addEventListener("blur", (event) => {
    event.target.value = FinanceUtils.normalizeEmail(event.target.value);
  });

  (async () => {
    const allowed = await ensureRoleAccess();
    if (!allowed) return;
    await loadProfile();
  })();
})();
