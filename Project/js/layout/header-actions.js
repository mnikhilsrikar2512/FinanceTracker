(() => {
  const templates = {
    default: `
      <button type="button" class="shell-menu-button" data-sidebar-toggle aria-label="Open navigation">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h16M4 17h16"/>
        </svg>
      </button>
      <div class="text-sm text-gray-600 hidden md:block">
        <span id="currentDate" data-header-current-date></span>
      </div>
    `
  };

  const nodes = document.querySelectorAll('[data-header-tools]');
  nodes.forEach((node) => {
    const variant = node.getAttribute('data-header-tools') || 'default';
    node.classList.add('flex', 'items-center', 'gap-2', 'md:gap-4');
    node.innerHTML = templates[variant] || templates.default;
  });

  const dateNodes = document.querySelectorAll('[data-header-current-date]');
  if (dateNodes.length > 0) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateText = new Date().toLocaleDateString('en-US', options);
    dateNodes.forEach((node) => {
      node.textContent = dateText;
    });
  }

})();
