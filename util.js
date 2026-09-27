// ==========================================================================
// CONFIGURATION & CONSTANTS
// ==========================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbzGlWKnGdheo9oZf2Nm2K3FW-AwTr0UmskleFFy3gH4KLXlOha5oq-r2QIgYMbd0Krgnw/exec";

const SYSTEM_CONFIG = {
  brand: {
    name: "Tournament Portal",
    icon: "emoji_events",
    homeUrl: "/index.html"
  },
  sidebarNav: [
    { label: "Dashboard", icon: "dashboard", href: "index.html" },
    { label: "Events", icon: "event", href: "events/viewevents.html" },
    { label: "Entrants", icon: "groups", href: "entrants.html" },
    { label: "Brackets", icon: "account_tree", href: "brackets.html" },
    { label: "Matches", icon: "sports_esports", href: "matches.html" },
    { label: "Staff", icon: "people", href: "staff.html" }
  ]
};

// ==========================================================================
// SESSION MANAGEMENT & AUTHENTICATION GUARD
// ==========================================================================

function isAuthenticated() {
  const token = localStorage.getItem('session_token');
  return token !== null && token.trim() !== '';
}

function getSessionToken() {
  return localStorage.getItem('session_token') || '';
}

function getSessionUser() {
  return {
    id: localStorage.getItem('session_staff_id') || '',
    name: localStorage.getItem('session_staff_name') || 'Staff Member',
    role: localStorage.getItem('session_staff_role') || 'ADJUDICATOR'
  };
}

/**
 * Enforces URL route protection based on the user's role
 */
function enforcePageRoleAccess() {
  const currentPath = window.location.pathname.toLowerCase();
  
  // Skip route guarding on login page
  if (currentPath.includes('login.html')) return;

  const token = localStorage.getItem('session_token');
  const role = (localStorage.getItem('session_staff_role') || '').toUpperCase();

  if (!token) {
    clearSessionAndRedirect();
    return;
  }

  // Only guard once role is present in LocalStorage
  if (role) {
    if (role !== 'ADMIN' && !currentPath.includes('judge.html')) {
      window.location.replace('judge.html');
    } else if (role === 'ADMIN' && currentPath.includes('judge.html')) {
      window.location.replace('index.html');
    }
  }
}

async function verifySession() {
  const token = localStorage.getItem('session_token');

  if (!token || token.trim() === '') {
    clearSessionAndRedirect();
    return false;
  }

  try {
    const response = await apiRequest({
      action: 'verifyToken',
      token: token
    });

    if (response && response.status === 'success') {
      if (response.staffId) localStorage.setItem('session_staff_id', response.staffId);
      if (response.name) localStorage.setItem('session_staff_name', response.name);
      if (response.role) localStorage.setItem('session_staff_role', response.role.toUpperCase());
      enforcePageRoleAccess();
      return true;
    } else {
      clearSessionAndRedirect();
      return false;
    }
  } catch (err) {
    console.error('Session verification error:', err);
    clearSessionAndRedirect();
    return false;
  }
}

async function checkExistingSession() {
  const token = localStorage.getItem('session_token');
  const role = (localStorage.getItem('session_staff_role') || '').toUpperCase();

  if (!token || token.trim() === '') return;

  try {
    const response = await apiRequest({
      action: 'verifyToken',
      token: token
    });

    if (response && response.status === 'success') {
      const activeRole = (response.role || role).toUpperCase();
      if (activeRole === 'ADMIN') {
        window.location.replace('index.html');
      } else {
        window.location.replace('judge.html');
      }
    }
  } catch (err) {
    console.error('Session check error on login:', err);
  }
}

function clearSessionAndRedirect() {
  localStorage.removeItem('session_token');
  localStorage.removeItem('session_staff_id');
  localStorage.removeItem('session_staff_name');
  localStorage.removeItem('session_staff_role');
  redirectToLogin();
}

function redirectToLogin() {
  window.location.replace('/login.html');
}

function logoutUser() {
  clearSessionAndRedirect();
}

// ==========================================================================
// THEME & LAYOUT MANAGEMENT
// ==========================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeBtnText(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeBtnText(newTheme);
}

function updateThemeBtnText(theme) {
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    const isDark = theme === 'dark';
    const iconName = isDark ? 'dark_mode' : 'light_mode';
    const colorwhenhovered = isDark ? '#725fd0' : '#ffc65d';
    toggleBtn.innerHTML = `<span class="material-symbols-outlined" onmouseover="this.style.color='${colorwhenhovered}'" onmouseout="this.style.color=''">${iconName}</span>`;
  }
}

function initLayout() {
  enforcePageRoleAccess();

  // Inject Branding
  document.querySelectorAll("[data-config='brand-name']").forEach(el => {
    el.textContent = SYSTEM_CONFIG.brand.name;
  });

  document.querySelectorAll("[data-config='brand-icon']").forEach(el => {
    el.textContent = SYSTEM_CONFIG.brand.icon;
  });

  // Render Navigation
  const navContainer = document.getElementById("sidebarNavContainer");
  if (navContainer) {
    const currentPath = window.location.pathname.toLowerCase();
    const isSubfolder = currentPath.includes('/events/') || 
                        currentPath.includes('/entrants/') || 
                        currentPath.includes('/brackets/') || 
                        currentPath.includes('/matches/');

    navContainer.innerHTML = SYSTEM_CONFIG.sidebarNav.map(item => {
      const itemPath = item.href.toLowerCase();
      const isActive = currentPath.endsWith(itemPath) || 
                       (itemPath === "index.html" && (currentPath.endsWith("/") || currentPath.endsWith("/index.html")));

      const resolveHref = isSubfolder ? `../${item.href}` : item.href;

      return `
        <a href="${resolveHref}" class="nav-item ${isActive ? 'active' : ''}" onclick="showLoadingScreen()">
          <span class="material-symbols-outlined">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </a>
      `;
    }).join("");
  }

  // Attach Sidebar Handlers
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  function toggleSidebar(forceState) {
    if (!sidebar || !backdrop) return;
    const isOpening = forceState !== undefined ? forceState : !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", isOpening);
    backdrop.classList.toggle("open", isOpening);
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener("click", () => toggleSidebar());
  if (backdrop) backdrop.addEventListener("click", () => toggleSidebar(false));

  // Attach Theme Handler
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // Attach Logout Handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  // Render Staff Identity
  const staffNameEl = document.querySelector(".user-name");
  const staffRoleEl = document.querySelector(".user-role");
  const user = getSessionUser();

  if (staffNameEl && user.name) staffNameEl.textContent = user.name;
  if (staffRoleEl && user.role) staffRoleEl.textContent = user.role;
}

// ==========================================================================
// API & NETWORK UTILITIES
// ==========================================================================

async function apiRequest(payload = {}) {
  try {
    // Automatically inject active session token into all requests unless logging in
    const token = getSessionToken();
    if (token && !payload.token && payload.action !== 'login') {
      payload.token = token;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result && result.status === 'error' && (
      result.message?.includes('Access Denied') || 
      result.message?.includes('Unauthorized') || 
      result.message?.includes('permission') ||
      result.message?.includes('expired')
    )) {
      showAlert(result.message, 'error');
    }

    return result;
  } catch (err) {
    console.error('API Request Error:', err);
    showAlert('A network error occurred. Please try again.', 'error');
    throw err;
  }
}

// ==========================================================================
// UI & FEEDBACK HELPERS
// ==========================================================================

function showFeedback(elementId, msg, type) {
  const feedback = document.getElementById(elementId);
  if (!feedback) return;
  feedback.textContent = msg;
  feedback.className = `feedback-msg ${type}`;
}

function injectLoadingOverlay() {
  if (document.getElementById('contentLoadingOverlay')) return;

  const contentBody = document.querySelector('.content-body');
  if (!contentBody) return;

  const overlay = document.createElement('div');
  overlay.id = 'contentLoadingOverlay';
  overlay.className = 'content-loading-overlay';
  overlay.innerHTML = '<div class="loading-spinner"></div>';

  if (sessionStorage.getItem('page_transitioning') !== 'true') {
    overlay.classList.add('hidden-overlay');
  }

  contentBody.prepend(overlay);
}

function navigateTo(url) {
  sessionStorage.setItem('page_transitioning', 'true');
  showLoadingScreen();
  window.location.href = url;
}

function showLoadingScreen() {
  const overlay = document.getElementById('contentLoadingOverlay');
  if (overlay) overlay.classList.remove('hidden-overlay');
}

function hideLoadingScreen() {
  const overlay = document.getElementById('contentLoadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden-overlay');
    sessionStorage.removeItem('page_transitioning');
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/**
 * Global Custom Toast Notification System
 */
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("globalNotificationContainer")) {
    const container = document.createElement("div");
    container.id = "globalNotificationContainer";
    container.className = "notification-container";
    document.body.appendChild(container);
  }
});

function showAlert(message, type = "info", duration = 4000) {
  let container = document.getElementById("globalNotificationContainer");
  
  if (!container) {
    container = document.createElement("div");
    container.id = "globalNotificationContainer";
    container.className = "notification-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-notification ${type}`;

  const iconMap = {
    success: "check_circle",
    error: "error",
    info: "info"
  };

  const iconName = iconMap[type] || "info";

  toast.innerHTML = `
    <span class="material-symbols-outlined toast-icon">${iconName}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close-btn" onclick="dismissToast(this.parentElement)">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }
}

function dismissToast(toastElement) {
  if (!toastElement || toastElement.classList.contains("hide")) return;

  toastElement.classList.remove("show");
  toastElement.classList.add("hide");

  toastElement.addEventListener("transitionend", () => {
    if (toastElement.parentNode) {
      toastElement.parentNode.removeChild(toastElement);
    }
  });
}

function showConfirm({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger"
}) {
  return new Promise((resolve) => {
    const existingModal = document.getElementById("globalConfirmModal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "globalConfirmModal";
    modal.className = "confirm-backdrop";

    const typeClass = `btn-${type === "danger" ? "danger" : "primary"}`;

    modal.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-header">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="confirm-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="confirm-footer">
          <button id="confirmCancelBtn" class="btn btn-secondary">${escapeHtml(cancelText)}</button>
          <button id="confirmOkBtn" class="btn ${typeClass}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.add("show");
    });

    const cleanup = (result) => {
      modal.classList.remove("show");
      modal.classList.add("hide");
      
      let removed = false;
      const removeModal = () => {
        if (!removed && modal.parentNode) {
          modal.remove();
          removed = true;
        }
      };

      modal.addEventListener("transitionend", removeModal, { once: true });
      setTimeout(removeModal, 300);
      resolve(result);
    };

    document.getElementById("confirmCancelBtn").onclick = () => cleanup(false);
    document.getElementById("confirmOkBtn").onclick = () => cleanup(true);
    
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(false);
    };
  });
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

initTheme();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectLoadingOverlay();
    initLayout();
    hideLoadingScreen();
  });
} else {
  injectLoadingOverlay();
  initLayout();
}