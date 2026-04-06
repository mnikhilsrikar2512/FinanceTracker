/**
 * Common utilities for Finance Tracker
 */

// Global configuration
const DEFAULT_LOCAL_API_BASE = "http://127.0.0.1:8000/api/v1";
const LOGIN_PAGE = "login.html";
const LANDING_PAGE = "index.html";
let currentUserCache = null;
let modalFocusOrigin = null;

function normalizeApiBase(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.replace(/\/+$/, '') : '';
}

function resolveApiBase() {
  const queryParams = new URLSearchParams(window.location.search);
  const fromQuery = normalizeApiBase(queryParams.get('api_base'));
  if (fromQuery) {
    localStorage.setItem('finance_api_base', fromQuery);
    return fromQuery;
  }

  const fromStorage = normalizeApiBase(localStorage.getItem('finance_api_base'));
  if (fromStorage) {
    return fromStorage;
  }

  const fromWindow = normalizeApiBase(window.FINLY_API_BASE);
  if (fromWindow) {
    return fromWindow;
  }

  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return normalizeApiBase(`${window.location.origin}/api/v1`);
  }

  return DEFAULT_LOCAL_API_BASE;
}

function setApiBase(value, options = {}) {
  const { persist = true } = options;
  const normalized = normalizeApiBase(value) || DEFAULT_LOCAL_API_BASE;
  window.API_BASE = normalized;
  if (persist) {
    localStorage.setItem('finance_api_base', normalized);
  }
  return normalized;
}

window.API_BASE = resolveApiBase();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getPasswordStrengthError(value) {
  const password = String(value || '');
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  return '';
}

function extractErrorMessage(payload = {}) {
  if (typeof payload?.detail === 'string' && payload.detail.trim()) {
    const detail = payload.detail.trim();
    const looksLikePath =
      detail.startsWith('/api/') ||
      detail.startsWith('/auth/') ||
      detail.startsWith('/transactions') ||
      detail.startsWith('/users/') ||
      detail.startsWith('/admin/');
    if (!looksLikePath) {
      return detail;
    }
  }
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();

  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    const first = payload.detail[0];
    if (typeof first === 'string') return first.trim();
    if (typeof first?.msg === 'string') return first.msg.trim();
  }

  return '';
}

function toSentenceCase(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function humanizeErrorMessage(message, status = null) {
  const raw = String(message || '').trim();
  if (!raw) {
    if (status === 401) return 'Your session has ended. Please sign in again.';
    if (status === 403) return 'You do not have permission to do that.';
    if (status === 404) return 'We could not find what you were looking for.';
    if (status === 429) return 'Too many attempts in a short time. Please wait a moment and try again.';
    if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
    return 'Something went wrong. Please try again.';
  }

  const normalized = raw.toLowerCase();

  const exactMatches = new Map([
    ['invalid credentials', "We couldn't sign you in with that email and password."],
    ['user is blocked', 'This account is blocked. Please contact support if you think this is a mistake.'],
    ['invalid token', 'Your session is no longer valid. Please sign in again.'],
    ['invalid or expired token', 'Your session has expired. Please sign in again.'],
    ['admin access required', 'This page is only available to admin accounts.'],
    ['email already exists', 'That email is already registered. Try signing in instead.'],
    ['category name already exists', 'A category with that name already exists.'],
    ['category name is required', 'Enter a category name before creating it.'],
    ['invalid category type', 'Choose a valid category type before continuing.'],
    ['category not found', 'The selected category could not be found. Please refresh and try again.'],
    ['user not found', 'We could not find that account. Please refresh and try again.'],
    ['budget not found', 'That budget is no longer available. Please refresh and try again.'],
    ['transaction not found', 'That transaction is no longer available. Please refresh and try again.'],
    ['old password is incorrect', 'Your current password is incorrect.'],
    ['cannot block an admin', "Admin accounts can't be blocked."],
    ['no transaction ids provided', 'Select at least one transaction first.'],
    ['no transactions found', 'No matching transactions were found.'],
    ['invalid ids format. use comma-separated integers.', 'The selected transactions could not be processed. Please refresh and try again.'],
    ['invalid mode. use \'soft\' or \'hard\'', 'Choose a valid delete option and try again.'],
    ['invalid archive_filter. use active, archived, or all.', 'Choose a valid archive filter and try again.'],
    ['you can only update your own transactions', 'You can only edit transactions that belong to your account.'],
    ['you can only delete your own transactions', 'You can only delete transactions that belong to your account.'],
    ['you can only restore your own transactions', 'You can only restore transactions that belong to your account.'],
    ['you can only view your own transactions', 'You can only view transactions that belong to your account.'],
    ['end date must be after start date', 'Choose an end date that comes after the start date.'],
    ['pdf export is unavailable right now', 'PDF export is temporarily unavailable. Please try again in a moment.']
  ]);

  if (exactMatches.has(normalized)) {
    return exactMatches.get(normalized);
  }

  if (normalized.startsWith('too many login attempts')) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  if (normalized.startsWith('too many signup attempts')) {
    return 'Too many sign-up attempts. Please wait a moment and try again.';
  }
  if (normalized.startsWith('too many reset attempts')) {
    return toSentenceCase(raw);
  }
  if (normalized.includes('invalid or expired verification code')) {
    return toSentenceCase(raw).replace('Invalid or expired verification code', 'That verification code is invalid or has expired');
  }
  if (normalized.includes('similar transaction already exists')) {
    return 'A very similar transaction already exists. Try editing the existing one instead.';
  }
  if (normalized.includes('provide reassign_to category id or delete transactions first')) {
    return 'This category is still in use. Reassign those transactions or delete them first.';
  }
  if (normalized.startsWith('failed to load')) {
    return 'We could not load this right now. Please refresh and try again.';
  }
  if (normalized.startsWith('failed to save')) {
    return 'We could not save your changes. Please try again.';
  }
  if (normalized.startsWith('failed to update')) {
    return 'We could not update this right now. Please try again.';
  }
  if (normalized.startsWith('failed to delete')) {
    return 'We could not delete this right now. Please try again.';
  }
  if (normalized.startsWith('failed to archive')) {
    return 'We could not archive this right now. Please try again.';
  }
  if (normalized.startsWith('failed to restore')) {
    return 'We could not restore this right now. Please try again.';
  }
  if (normalized.startsWith('failed to download')) {
    return 'We could not download that file right now. Please try again.';
  }
  if (normalized === 'request failed') {
    return 'We could not complete that request. Please try again.';
  }
  if (normalized.startsWith('http 5')) {
    return 'Something went wrong on our side. Please try again in a moment.';
  }
  if (normalized.startsWith('http 4')) {
    return 'That request could not be completed. Please check your input and try again.';
  }

  return toSentenceCase(raw);
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      success: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`,
      detail: text
    };
  }
}

async function requestJson(url, options = {}, config = {}) {
  const {
    clearAuthOn401 = false,
    redirectOn401 = false,
    fallbackMessage = 'Request failed'
  } = config;

  const response = await fetch(url, options);

  if (response.status === 401 && clearAuthOn401) {
    localStorage.removeItem("token");
    localStorage.removeItem("finance_user_role");
    currentUserCache = null;
    if (redirectOn401) {
      window.location.href = LOGIN_PAGE;
      return null;
    }
  }

  const data = await parseResponseBody(response);
  if (!response.ok) {
    const rawMessage = extractErrorMessage(data) || `${fallbackMessage} (${response.status})`;
    const error = new Error(humanizeErrorMessage(rawMessage, response.status));
    error.status = response.status;
    error.payload = data;
    error.rawMessage = rawMessage;
    throw error;
  }

  return data;
}

/**
 * Fetch with authentication
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} API response
 */
async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  try {
    return await requestJson(`${window.API_BASE}${endpoint}`, { ...options, headers }, {
      clearAuthOn401: true,
      redirectOn401: true,
      fallbackMessage: 'Authenticated request failed'
    });
  } catch (error) {
    console.error(`Fetch error [${endpoint}]:`, error);
    throw error;
  }
}

async function fetchPublic(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    return await requestJson(`${window.API_BASE}${endpoint}`, { ...options, headers }, {
      fallbackMessage: 'Request failed'
    });
  } catch (error) {
    console.error(`Public fetch error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Logout user
 */
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("finance_user_role");
  currentUserCache = null;
  window.location.href = LANDING_PAGE;
}

async function getCurrentUser(forceRefresh = false) {
  if (!forceRefresh && currentUserCache) {
    return currentUserCache;
  }

  const res = await fetchWithAuth('/users/me');
  if (res?.success && res.data) {
    currentUserCache = res.data;
    if (res.data.role) {
      localStorage.setItem('finance_user_role', res.data.role);
    }
    return currentUserCache;
  }

  return null;
}

// Global error handler
window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
  showToast('Something unexpected happened. Please refresh and try again.', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  const status = event.reason?.status || null;
  const message = humanizeErrorMessage(
    event.reason?.message || event.reason?.rawMessage || '',
    status
  );
  showToast(message, 'error');
});

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  // Get or create toast container
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Remove existing toasts (optional, comment out to allow multiple toasts)
  // const existingToasts = container.querySelectorAll('.toast');
  // existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  toast.textContent = humanizeErrorMessage(message);
  container.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Create loading skeleton
 * @param {number} rows - Number of skeleton rows
 * @returns {string} HTML string for skeleton
 */
function createSkeleton(rows = 3) {
  let html = '';
  for (let i = 0; i < rows; i++) {
    html += `
      <div class="animate-pulse">
        <div class="skeleton h-4 rounded w-3/4 mb-2"></div>
        <div class="skeleton h-3 rounded w-1/2"></div>
      </div>
    `;
  }
  return `<div class="space-y-4 p-4">${html}</div>`;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createStateMarkup({
  title = 'Nothing here yet',
  message = '',
  tone = 'neutral',
  compact = false
} = {}) {
  const toneClass = tone === 'error' ? 'state-panel-error' : tone === 'warning' ? 'state-panel-warning' : '';
  return `
    <div class="state-panel ${compact ? 'state-panel-compact' : ''} ${toneClass}">
      <strong>${escapeHTML(title)}</strong>
      ${message ? `<span>${escapeHTML(message)}</span>` : ''}
    </div>
  `;
}

function createTableMessageRow(columns, options = {}) {
  return `<tr><td colspan="${columns}" class="p-0">${createStateMarkup(options)}</td></tr>`;
}

function openModal(target) {
  const modal = typeof target === 'string' ? document.getElementById(target) : target;
  if (!modal) return;

  if (!modalFocusOrigin) {
    modalFocusOrigin = document.activeElement;
  }

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal(target) {
  const modal = typeof target === 'string' ? document.getElementById(target) : target;
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (!document.querySelector('.modal-overlay.active')) {
    document.body.classList.remove('modal-open');
    if (modalFocusOrigin && typeof modalFocusOrigin.focus === 'function') {
      modalFocusOrigin.focus();
    }
    modalFocusOrigin = null;
  }
}

/**
 * Form validation helper
 * @param {HTMLFormElement} form - Form element
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result
 */
function validateForm(form, rules) {
  const errors = {};
  let isValid = true;
  
  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) continue;
    
    const value = field.value.trim();
    
    for (const rule of fieldRules) {
      if (rule.required && !value) {
        errors[fieldName] = rule.message || `${fieldName} is required`;
        isValid = false;
        break;
      }
      
      if (rule.pattern && !rule.pattern.test(value)) {
        errors[fieldName] = rule.message || `Invalid ${fieldName}`;
        isValid = false;
        break;
      }
      
      if (rule.minLength && value.length < rule.minLength) {
        errors[fieldName] = rule.message || `${fieldName} must be at least ${rule.minLength} characters`;
        isValid = false;
        break;
      }
      
      if (rule.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors[fieldName] = rule.message || 'Invalid email address';
        isValid = false;
        break;
      }
      
      if (rule.number && isNaN(parseFloat(value))) {
        errors[fieldName] = rule.message || `${fieldName} must be a number`;
        isValid = false;
        break;
      }
      
      if (rule.positive && parseFloat(value) <= 0) {
        errors[fieldName] = rule.message || `${fieldName} must be positive`;
        isValid = false;
        break;
      }
    }
  }
  
  return { isValid, errors };
}

/**
 * Show form validation errors
 * @param {HTMLFormElement} form - Form element
 * @param {Object} errors - Errors object
 */
function showFormErrors(form, errors) {
  // Clear previous errors
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  form.querySelectorAll('.border-red-500').forEach(el => {
    el.classList.remove('border-red-500');
    el.classList.add('border-gray-300');
  });
  
  // Show new errors
  for (const [fieldName, message] of Object.entries(errors)) {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (!field) continue;
    
    field.classList.remove('border-gray-300');
    field.classList.add('border-red-500');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message text-red-500 text-xs mt-1';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
  }
}

/**
 * Clear form validation errors
 * @param {HTMLFormElement} form - Form element
 */
function clearFormErrors(form) {
  form.querySelectorAll('.error-message').forEach(el => el.remove());
  form.querySelectorAll('.border-red-500').forEach(el => {
    el.classList.remove('border-red-500');
    el.classList.add('border-gray-300');
  });
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: INR)
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date
 * @param {string} dateString - ISO date string
 * @param {string} format - 'short', 'long', 'time'
 * @returns {string} Formatted date
 */
function formatDate(dateString, format = 'short') {
  const date = new Date(dateString);
  
  switch(format) {
    case 'long':
      return date.toLocaleDateString('en-IN', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'time':
      return date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    default:
      return date.toLocaleDateString('en-IN');
  }
}

function formatDateForApi(dateString, endOfDay = false) {
  if (!dateString) return '';
  return `${dateString}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

/**
 * Accessibility: Add ARIA labels and keyboard navigation
 */
function initAccessibility() {
  // Add skip to main content link
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50';
  skipLink.textContent = 'Skip to main content';
  document.body.prepend(skipLink);
  
  // Add main content ID if missing
  if (!document.getElementById('main-content')) {
    const main = document.querySelector('main') || document.querySelector('.flex-1');
    if (main) main.id = 'main-content';
  }
  
  // Add focus styles
  const style = document.createElement('style');
  style.textContent = `
    *:focus {
      outline: 2px solid #2f6fed;
      outline-offset: 2px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
    .focus:not-sr-only:focus {
      position: static;
      width: auto;
      height: auto;
      padding: inherit;
      margin: inherit;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }
  `;
  document.head.appendChild(style);
  
  // Add ARIA labels to common elements
  document.querySelectorAll('button').forEach(button => {
    if (!button.getAttribute('aria-label') && !button.textContent.trim()) {
      button.setAttribute('aria-label', 'Button');
    }
  });
  
  document.querySelectorAll('input:not([type="hidden"])').forEach(input => {
    if (!input.getAttribute('aria-label') && !input.placeholder) {
      const label = input.previousElementSibling?.textContent || input.name;
      input.setAttribute('aria-label', label);
    }
  });
}

function initModalUX() {
  let lastActiveModal = null;

  const getFocusableElements = (container) => {
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    return Array.from(container.querySelectorAll(selectors.join(','))).filter(el => el.offsetParent !== null);
  };

  const getActiveModal = () => {
    return document.querySelector('.modal-overlay.active');
  };

  const closeVisibleModals = () => {
    document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
      closeModal(modal);
    });
    lastActiveModal = null;
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeVisibleModals();
      return;
    }

    if (event.key === 'Tab') {
      const activeModal = getActiveModal();
      if (!activeModal) return;

      const focusable = getFocusableElements(activeModal);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const observer = new MutationObserver(() => {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (!activeModal) {
      lastActiveModal = null;
      return;
    }

    if (activeModal === lastActiveModal) {
      return;
    }

    lastActiveModal = activeModal;
    if (!modalFocusOrigin) {
      modalFocusOrigin = document.activeElement;
    }
    const focusable = getFocusableElements(activeModal);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  });

  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class']
  });
}

// Initialize accessibility on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initAccessibility();
    initModalUX();
  });
} else {
  initAccessibility();
  initModalUX();
}

/**
 * Theme Management
 */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hour = new Date().getHours();
  const isNight = hour >= 19 || hour < 7; // Night is 7 PM to 7 AM

  let theme = 'light';
  if (savedTheme) {
    theme = savedTheme;
  } else if (isNight || systemDark) {
    theme = 'dark';
  }

  setTheme(theme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
  updateThemeToggles(theme);
  window.dispatchEvent(new CustomEvent('finly:themechange', { detail: { theme } }));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const target = current === 'dark' ? 'light' : 'dark';
  setTheme(target);
}

function updateThemeToggles(theme) {
  document.querySelectorAll('.theme-toggle-input').forEach((input) => {
    input.checked = theme === 'dark';
  });
}

// Add theme toggle to header if it doesn't exist
function injectThemeToggle() {
  const headerActions = document.querySelector('.page-header-actions')
    || document.querySelector('[data-header-tools]')?.parentElement
    || document.querySelector('.top-nav > div:last-child');
  if (headerActions && !document.querySelector('.theme-toggle-wrapper')) {
    const container = document.createElement('div');
    container.className = 'theme-toggle-wrapper';
    container.innerHTML = `
      <label class="theme-toggle" title="Toggle light and dark mode">
        <input type="checkbox" class="theme-toggle-input" aria-label="Toggle light and dark mode" onchange="toggleTheme()">
        <span class="theme-toggle-track" aria-hidden="true">
          <span class="theme-toggle-dot"></span>
        </span>
      </label>
    `;
    headerActions.prepend(container);
    updateThemeToggles(document.documentElement.getAttribute('data-theme'));
  }
}

// Auto-init theme
initTheme();
document.addEventListener('DOMContentLoaded', injectThemeToggle);

function refreshFilterFieldStates(root = document) {
  root.querySelectorAll('.filter-surface .apple-input').forEach((field) => {
    const rawValue = typeof field.value === 'string' ? field.value.trim() : String(field.value ?? '');
    let hasValue = rawValue !== '';

    if (field.tagName === 'SELECT') {
      const defaultValue = field.dataset.defaultFilterValue
        ?? field.dataset.defaultValue
        ?? field.querySelector('option')?.value
        ?? '';
      hasValue = rawValue !== '' && rawValue !== defaultValue;
    }

    field.classList.toggle('is-active-filter-control', hasValue);
  });
}

function bindFilterFieldStates(root = document) {
  root.querySelectorAll('.filter-surface .apple-input').forEach((field) => {
    if (field.dataset.filterStateBound === 'true') {
      return;
    }

    const updateState = () => refreshFilterFieldStates(root);
    field.addEventListener('input', updateState);
    field.addEventListener('change', updateState);
    field.dataset.filterStateBound = 'true';
  });

  refreshFilterFieldStates(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bindFilterFieldStates());
} else {
  bindFilterFieldStates();
}

/**
 * Download a file from the API
 * @param {string} endpoint - API endpoint
 * @param {string} filename - Filename to save as
 * @returns {Promise<void>}
 */
async function downloadFile(endpoint, filename) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = LOGIN_PAGE;
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(humanizeErrorMessage(extractErrorMessage(data) || `HTTP ${response.status}`, response.status));
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename || `download_${new Date().getTime()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error(`Download error [${endpoint}]:`, error);
    showToast(error.message || 'We could not download that file right now. Please try again.', 'error');
    throw error;
  }
}

/**
 * Check if user is admin and redirect if not
 * @returns {Promise<boolean>} True if admin
 */
async function checkAdmin() {
  try {
    const user = await getCurrentUser(true);
    if (!user || user.role !== 'admin') {
      showToast('This page is only available to admin accounts.', 'error');
      window.location.href = 'app.html';
      return false;
    }
    return true;
  } catch (err) {
    console.error('Admin check error:', err);
    return false;
  }
}

// Export for use in other scripts
window.FinanceUtils = {
  fetchWithAuth,
  fetchPublic,
  downloadFile,
  getCurrentUser,
  checkAdmin,
  logout,
  showToast,
  createSkeleton,
  createStateMarkup,
  createTableMessageRow,
  validateForm,
  showFormErrors,
  clearFormErrors,
  debounce,
  formatCurrency,
  formatDate,
  formatDateForApi,
  initAccessibility,
  initModalUX,
  toggleTheme,
  setApiBase,
  normalizeEmail,
  getPasswordStrengthError,
  humanizeErrorMessage,
  openModal,
  closeModal,
  escapeHTML,
  refreshFilterFieldStates,
  bindFilterFieldStates
};
