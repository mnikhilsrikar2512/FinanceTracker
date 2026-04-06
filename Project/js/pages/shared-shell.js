(() => {
  async function initSharedPageContext(options = {}) {
    const { badgeId, context = 'auto', personalLabel = 'Personal View', adminLabel = 'Admin View' } = options;

    try {
      const user = await window.FinanceUtils.getCurrentUser();
      if (!user) return null;

      if (badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) {
          const showAdminContext = context === 'admin' || (context === 'auto' && user.role === 'admin');
          badge.textContent = showAdminContext ? adminLabel : personalLabel;
          badge.className = `context-chip ${showAdminContext ? 'context-chip-admin' : 'context-chip-user'}`;
        }
      }

      return user;
    } catch (error) {
      console.error('Shared page context failed:', error);
      return null;
    }
  }

  window.FinancePages = {
    initSharedPageContext
  };
})();
