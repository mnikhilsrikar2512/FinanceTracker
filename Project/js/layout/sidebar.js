(() => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  let storedRole = localStorage.getItem('finance_user_role');

  const icons = {
    dashboard: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    transactions: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    categories: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
    analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    budgets: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    logs: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    profile: 'M5.121 17.804A9.004 9.004 0 0112 15a9.004 9.004 0 016.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0zm6 1a9 9 0 11-18 0 9 9 0 0118 0z'
  };

  const userLinks = [
    { href: 'app.html', label: 'Dashboard', icon: icons.dashboard },
    { href: 'transactions.html', label: 'Transactions', icon: icons.transactions },
    { href: 'reports.html', label: 'Reports', icon: icons.analytics },
    { href: 'budgets.html', label: 'Budgets', icon: icons.budgets },
    { href: 'logs.html', label: 'Notifications', icon: icons.logs },
    { href: 'profile.html', label: 'Profile', icon: icons.profile }
  ];

  const adminLinks = [
    { href: 'admin.html', label: 'Dashboard', icon: icons.dashboard },
    { href: 'admin-users.html', label: 'Users', icon: icons.users },
    { href: 'admin-transactions.html', label: 'Transactions', icon: icons.transactions },
    { href: 'categories.html', label: 'Categories', icon: icons.categories },
    { href: 'reports.html', label: 'Reports', icon: icons.analytics },
    { href: 'admin-logs.html', label: 'Logs', icon: icons.logs },
    { href: 'admin-profile.html', label: 'Profile', icon: icons.profile }
  ];

  function linkTemplate(link, isAdmin) {
    const isActive = currentPage === link.href;
    const base = 'sidebar-item';
    const state = isActive ? 'active' : '';
    return `
      <a href="${link.href}" class="${base} ${state}" ${isActive ? 'aria-current="page"' : ''}>
        <div class="w-5 h-5 mr-3">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${link.icon}"/>
          </svg>
        </div>
        <span>${link.label}</span>
      </a>
    `;
  }

  function resolveSidebarType() {
    const explicit = document.body?.dataset.shell;
    if (explicit === 'admin' || explicit === 'user') {
      return explicit;
    }
    if (explicit === 'auto') {
      return storedRole === 'admin' ? 'admin' : 'user';
    }

    const adminNav = document.querySelector('nav[data-sidebar="admin"]');
    if (adminNav) return 'admin';
    return 'user';
  }

  function renderSidebar(type) {
    const nav = document.querySelector('nav.sidebar-nav');
    if (!nav) return;
    const links = type === 'admin' ? adminLinks : userLinks;
    nav.setAttribute('data-sidebar', type);
    nav.innerHTML = links.map((link) => linkTemplate(link, type === 'admin')).join('');

    const logo = document.querySelector('.sidebar-logo');
    if (logo) {
      logo.textContent = type === 'admin' ? 'Finly Admin' : 'Finly';
    }

    document.body.classList.toggle('admin-theme', type === 'admin');
  }

  function ensureMobileOverlay() {
    let overlay = document.getElementById('mobileOverlay');
    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.id = 'mobileOverlay';
      overlay.className = 'mobile-shell-overlay';
      overlay.setAttribute('aria-label', 'Close navigation');
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function setSidebarOpen(isOpen) {
    const sidebar = document.getElementById('sidebar');
    const overlay = ensureMobileOverlay();
    if (!sidebar || !overlay) return;

    document.body.classList.toggle('sidebar-open', isOpen);
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  async function refreshAutoShellFromSession() {
    if (document.body?.dataset.shell !== 'auto') return;
    if (storedRole || !window.FinanceUtils?.fetchWithAuth) return;

    try {
      const res = await window.FinanceUtils.fetchWithAuth('/users/me');
      const role = res?.data?.role;
      if (!role) return;

      storedRole = role;
      localStorage.setItem('finance_user_role', role);
      renderSidebar(role === 'admin' ? 'admin' : 'user');
    } catch (error) {
      console.error('Shell refresh failed:', error);
    }
  }

  function initMobileSidebarUX() {
    const sidebar = document.getElementById('sidebar');
    const overlay = ensureMobileOverlay();
    if (!sidebar || !overlay) return;

    const closeSidebar = () => {
      setSidebarOpen(false);
    };

    const openSidebar = () => setSidebarOpen(true);

    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-sidebar-toggle]');
      if (toggle) {
        openSidebar();
      }
    });

    overlay.addEventListener('click', closeSidebar);

    sidebar.querySelectorAll('a[href]').forEach((link) => {
      link.addEventListener('click', closeSidebar);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1100) {
        closeSidebar();
      }
    });
  }

  renderSidebar(resolveSidebarType());
  initMobileSidebarUX();
  refreshAutoShellFromSession();
})();
