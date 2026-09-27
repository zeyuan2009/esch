/**
 * Staff Management Logic
 * Handles roster listing, filtering, search, and admin staff persistence.
 */

// Global State
let staffList = [];
let filteredStaff = [];

// DOM Elements
const staffTableBody = document.getElementById("staffTableBody");
const staffSearchInput = document.getElementById("staffSearchInput");
const roleFilterSelect = document.getElementById("roleFilterSelect");
const addStaffBtn = document.getElementById("addStaffBtn");
const staffModal = document.getElementById("staffModal");
const staffForm = document.getElementById("staffForm");
const staffModalTitle = document.getElementById("staffModalTitle");
const closeStaffModalBtn = document.getElementById("closeStaffModalBtn");
const cancelStaffModalBtn = document.getElementById("cancelStaffModalBtn");

// Form Input Elements
const modalStaffId = document.getElementById("modalStaffId");
const modalFullName = document.getElementById("modalFullName");
const modalPhone = document.getElementById("modalPhone");
const modalSchoolId = document.getElementById("modalSchoolId");
const modalClass = document.getElementById("modalClass");
const modalRole = document.getElementById("modalRole");
const modalAssignment = document.getElementById("modalAssignment");
const modalNotes = document.getElementById("modalNotes");

// Initialize on page DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setupUserNavDetails();
  initEventListeners();
  loadStaffRoster();
});

/**
 * Display logged-in user profile from session storage
 */
function setupUserNavDetails() {
  if (typeof getSessionUser === "function") {
    const sessionUser = getSessionUser();
    if (sessionUser) {
      const navName = document.getElementById("navUserName");
      const navRole = document.getElementById("navUserRole");
      if (navName) navName.textContent = sessionUser.name || sessionUser.username || "Staff User";
      if (navRole) navRole.textContent = sessionUser.role || "Administrator";
    }
  }
}

/**
 * Attach UI event handlers
 */
function initEventListeners() {
  // Search & Filter change events
  staffSearchInput?.addEventListener("input", applyFilters);
  roleFilterSelect?.addEventListener("change", applyFilters);

  // Modal Controls
  addStaffBtn?.addEventListener("click", () => openStaffModal());
  closeStaffModalBtn?.addEventListener("click", closeStaffModal);
  cancelStaffModalBtn?.addEventListener("click", closeStaffModal);

  // Form Submit Handler
  staffForm?.addEventListener("submit", handleStaffSubmit);
}

/**
 * Fetch staff roster from backend
 */
async function loadStaffRoster() {
  renderLoadingState();
  
  try {
    const sessionToken = typeof getSessionToken === "function" ? getSessionToken() : "";
    let response = null;

    if (typeof apiRequest === "function") {
      response = await apiRequest({
        action: "getStaff",
        token: sessionToken
      });
    }

    if (response && response.status === "success" && Array.isArray(response.data) && response.data.length > 0) {
      staffList = response.data;
    } else {
      staffList = getMockStaffData();
    }
  } catch (error) {
    console.warn("Backend error fetching staff. Rendering fallback list:", error);
    staffList = getMockStaffData();
  }

  applyFilters();
}

/**
 * Filter staff list based on search term and role
 */
function applyFilters() {
  const searchTerm = (document.getElementById("staffSearchInput")?.value || "").toLowerCase().trim();
  const roleFilter = document.getElementById("roleFilterSelect")?.value || "ALL";

  filteredStaff = staffList.filter(member => {
    const name = String(member.fullName || member.name || "").toLowerCase();
    const phone = String(member.phone || "").toLowerCase();
    const schoolId = String(member.schoolId || "").toLowerCase();
    const className = String(member.studentClass || "").toLowerCase();
    const role = String(member.role || "").toUpperCase();

    const matchesSearch = !searchTerm || 
      name.includes(searchTerm) || 
      phone.includes(searchTerm) || 
      schoolId.includes(searchTerm) ||
      className.includes(searchTerm);

    const matchesRole = roleFilter === "ALL" || role === roleFilter.toUpperCase();

    return matchesSearch && matchesRole;
  });

  renderStaffTable(filteredStaff);
}

/**
 * Render HTML table rows
 */
function renderStaffTable(staffData) {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;

  if (!staffData || staffData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-placeholder">No staff members found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = staffData.map(member => {
    const staffName = escapeHtml(member.fullName || member.name || 'Unnamed Staff');
    const staffId = escapeHtml(member.staffId || member.id || 'N/A');
    const initials = getInitials(staffName);
    const schoolId = escapeHtml(member.schoolId || 'N/A');
    const studentClass = escapeHtml(member.studentClass || 'N/A');
    
    const roleClass = `role-badge ${(member.role || 'ADJUDICATOR').toLowerCase()}`;

    return `
      <tr>
        <td>
          <div class="user-info-cell">
            <div class="avatar">${initials}</div>
            <div class="user-details">
              <span class="user-name">${staffName}</span>
              <span class="user-id">${staffId}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="${roleClass}">${escapeHtml(member.role || 'Adjudicator')}</span>
        </td>
        <td>${escapeHtml(member.phone || 'N/A')}</td>
        <td>${schoolId} / ${studentClass}</td>
        <td>${escapeHtml(member.currentAssignment || member.assignment || 'Unassigned')}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" onclick="openStaffModal('${staffId}')" title="Edit Staff">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-icon btn-danger" onclick="confirmDeleteStaff('${staffId}')" title="Delete Staff">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Open Modal for Add or Edit
 */
function openStaffModal(staffId = null) {
  const modal = document.getElementById("staffModal");
  const title = document.getElementById("staffModalTitle");
  if (!modal) return;

  if (staffForm) staffForm.reset();

  if (staffId) {
    if (title) title.textContent = "Edit Staff Member";
    
    const member = staffList.find(s => String(s.staffId || s.id) === String(staffId));
    if (member) {
      setInputValue("modalStaffId", member.staffId || member.id);
      setInputValue("modalFullName", member.fullName || member.name);
      setInputValue("modalPhone", member.phone);
      setInputValue("modalSchoolId", member.schoolId);
      setInputValue("modalClass", member.studentClass);
      setInputValue("modalRole", member.role);
      setInputValue("modalAssignment", member.currentAssignment || member.assignment);
      setInputValue("modalNotes", member.notes);
    }
  } else {
    if (title) title.textContent = "Add Staff Member";
    setInputValue("modalStaffId", "");
  }

  modal.classList.remove("hidden");
}

function setInputValue(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.value = value || "";
  }
}

function closeStaffModal() {
  const modal = document.getElementById("staffModal");
  if (modal) modal.classList.add("hidden");
}

/**
 * Handle form submission (Add or Update)
 */
async function handleStaffSubmit(e) {
  e.preventDefault();

  const idVal = modalStaffId ? modalStaffId.value.trim() : "";
  const nameVal = modalFullName ? modalFullName.value.trim() : "";
  const phoneVal = modalPhone ? modalPhone.value.trim() : "";
  const schoolIdVal = modalSchoolId ? modalSchoolId.value.trim() : "";

  // Explicit Validation Check
  if (!nameVal || !phoneVal || !schoolIdVal) {
    showToastMessage("Name, Phone Number, and School ID are required fields.", "error");
    return;
  }

  const staffData = {
    // Send empty string if it's a new staff member so backend generates STAFF_01, STAFF_02, etc.
    staffId: idVal || "",
    fullName: nameVal,
    phone: phoneVal,
    schoolId: schoolIdVal,
    studentClass: modalClass ? modalClass.value.trim() : "",
    role: modalRole ? modalRole.value : "ADJUDICATOR",
    currentAssignment: modalAssignment ? modalAssignment.value.trim() : "",
    notes: modalNotes ? modalNotes.value.trim() : ""
  };

  try {
    let response = null;
    if (typeof apiRequest === "function") {
      response = await apiRequest({
        action: "saveStaff",
        token: typeof getSessionToken === "function" ? getSessionToken() : "",
        staffData: staffData
      });
    }

    if (response && response.status === "error") {
      showToastMessage(response.message || "Failed to save staff member.", "error");
      return;
    }

    // Use backend generated ID if returned
    if (response && response.staffId) {
      staffData.staffId = response.staffId;
    }

    showToastMessage(idVal ? "Staff member updated." : "New staff member added.", "success");
    closeStaffModal();

    if (idVal) {
      const idx = staffList.findIndex((s) => String(s.staffId || s.id) === String(idVal));
      if (idx !== -1) staffList[idx] = staffData;
    } else {
      staffList.unshift(staffData);
    }
    applyFilters();

  } catch (err) {
    console.error("Save error:", err);
    showToastMessage("Error trying to save staff member.", "error");
  }
}

/**
 * Confirm and handle staff deletion
 */
async function confirmDeleteStaff(staffId) {
  const member = staffList.find((s) => String(s.staffId || s.id) === String(staffId));
  if (!member) return;

  const displayName = member.fullName || member.name || "this staff member";
  if (await showConfirm(`Are you sure you want to remove ${displayName} from staff?`) == false) {
    return;
  }

  try {
    let response = null;
    if (typeof apiRequest === "function") {
      response = await apiRequest({
        action: "deleteStaff",
        token: typeof getSessionToken === "function" ? getSessionToken() : "",
        staffId: staffId
      });
    }

    if (response && response.status === "error") {
      showToastMessage(response.message || "Failed to delete staff member.", "error");
      return;
    }

    staffList = staffList.filter((s) => String(s.staffId || s.id) !== String(staffId));
    applyFilters();
    showToastMessage("Staff member deleted.", "success");
  } catch (err) {
    console.error("Delete error:", err);
    showToastMessage("Error connecting to backend.", "error");
  }
}

// Utility Helpers
function renderLoadingState() {
  if (staffTableBody) {
    staffTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-placeholder">Fetching current staff roster...</td>
      </tr>
    `;
  }
}

function getInitials(name) {
  if (!name) return "ST";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToastMessage(msg, type = "info") {
  if (typeof showAlert === "function") {
    showAlert(msg, type);
  } else {
    alert(msg);
  }
}

/**
 * Mock Data Fallback
 */
function getMockStaffData() {
  return [
    {
      staffId: "STF_101",
      fullName: "Alex Rivera",
      phone: "+1 555-0192",
      schoolId: "SCH-1001",
      studentClass: "Grade 12",
      role: "ADMIN",
      currentAssignment: "Head Director / Control Desk",
      notes: "Main event manager"
    },
    {
      staffId: "STF_102",
      fullName: "Sarah Chen",
      phone: "+1 555-0143",
      schoolId: "SCH-1002",
      studentClass: "5 Alpha",
      role: "ADJUDICATOR",
      currentAssignment: "Court A - Match M_EVT_1001",
      notes: "Certified Chief Referee"
    },
    {
      staffId: "STF_103",
      fullName: "Michael Vance",
      phone: "+1 555-0188",
      schoolId: "SCH-1003",
      studentClass: "5 Beta",
      role: "ADJUDICATOR",
      currentAssignment: "Standby Court B",
      notes: "Adjudicator"
    }
  ];
}