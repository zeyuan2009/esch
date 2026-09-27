/**
 * Entrants Directory & Registration Module
 */

let globalEntrantsList = [];
let globalEventsMap = {};

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof verifySession === "function") {
    const valid = await verifySession();
    if (!valid) return;
  }

  await Promise.all([loadEventsDropdown(), loadAllEntrants()]);
});

/**
 * Fetch events list to populate filter and modal dropdowns
 */
async function loadEventsDropdown() {
  try {
    const response = await apiRequest({ action: "getEvents" });
    if (response && response.status === "success") {
      const events = response.events || [];
      const filterSelect = document.getElementById("eventFilterSelect");
      const modalSelect = document.getElementById("modalEventSelect");

      // Reset dropdowns
      filterSelect.innerHTML = `<option value="">All Events</option>`;
      modalSelect.innerHTML = `<option value="">-- Select Event --</option>`;

      events.forEach(evt => {
        const id = evt.eventId || evt.id;
        const name = evt.eventName || evt.name;
        globalEventsMap[id] = name;

        filterSelect.innerHTML += `<option value="${escapeHtml(id)}">${escapeHtml(name)} (${escapeHtml(id)})</option>`;
        modalSelect.innerHTML += `<option value="${escapeHtml(id)}">${escapeHtml(name)} (${escapeHtml(id)})</option>`;
      });
    }
  } catch (err) {
    console.error("Error populating events dropdowns:", err);
  }
}

/**
 * Fetch master entrants list
 */
async function loadAllEntrants() {
  try {
    const response = await apiRequest({ action: "getEntrants" });

    if (response && response.status === "success") {
      globalEntrantsList = response.entrants || [];
      renderEntrantsTable(globalEntrantsList);
    } else {
      showError("Failed to load entrants list.");
      console.error("Failed to fetch entrants list:", response?.message);
    }
  } catch (err) {
    console.error("Get Entrants Error:", err);
    showError("An error occurred while fetching entrants data.");
  } finally {
    if (typeof hideLoadingScreen === "function") {
      hideLoadingScreen();
    }
  }
}

function renderEntrantsTable(entrants) {
  const container = document.getElementById("entrantsTableContainer");
  if (!container) return;

  if (!entrants || entrants.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No entrants found matching criteria.</p>`;
    return;
  }

  const rowsHtml = entrants.map(entrant => {
    const entrantId = entrant.entrantId || "";
    const eventId = entrant.eventId || "";
    const eventName = globalEventsMap[eventId] || eventId || "General";
    
    const fullNameEN = entrant.fullNameEN || entrant.fullName || entrant.name || "";
    const fullNameCN = entrant.fullNameCN ? ` (${entrant.fullNameCN})` : "";
    const displayName = `${fullNameEN}${fullNameCN}`.trim() || "N/A";
    
    const phoneNumber = entrant.phoneNumber || entrant.contact || "-";
    const teamId = entrant.teamId || "SOLO";
    const role = entrant.role || "Participant";
    const receiptUrl = entrant.receiptUrl || "";

    const receiptButton = receiptUrl
      ? `<a href="${escapeHtml(receiptUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="View Receipt">
           <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle;">receipt</span>
         </a>`
      : `<span class="placeholder-text" style="font-size: 0.8rem;">None</span>`;

    return `
      <tr>
        <td><strong>${escapeHtml(entrantId)}</strong></td>
        <td>${escapeHtml(displayName)}</td>
        <td><span class="badge">${escapeHtml(teamId)}</span></td>
        <td>${escapeHtml(eventName)}</td>
        <td>${escapeHtml(role)}</td>
        <td>${escapeHtml(phoneNumber)}</td>
        <td style="text-align: center;">${receiptButton}</td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 0.25rem; justify-content: flex-end;">
            <button class="icon-btn" onclick="editEntrant('${escapeHtml(entrantId)}')" title="Edit Entrant">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="icon-btn" onclick="deleteEntrant('${escapeHtml(entrantId)}', '${escapeHtml(fullNameEN)}')" title="Delete Entrant" style="color: var(--error-text);">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Full Name</th>
            <th>Team</th>
            <th>Event</th>
            <th>Role</th>
            <th>Phone Number</th>
            <th style="text-align: center;">Receipt</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Filter entrants locally by search term and selected event
 */
function filterEntrants() {
  const query = (document.getElementById("entrantSearchInput")?.value || "").toLowerCase().trim();
  const selectedEvent = document.getElementById("eventFilterSelect")?.value || "";

  const filtered = globalEntrantsList.filter(item => {
    const nameEN = (item.fullNameEN || item.fullName || "").toLowerCase();
    const nameCN = (item.fullNameCN || "").toLowerCase();
    const phone = (item.phoneNumber || item.contact || "").toLowerCase();
    const id = (item.entrantId || "").toLowerCase();
    const eventId = item.eventId || "";

    const matchesSearch = nameEN.includes(query) || nameCN.includes(query) || phone.includes(query) || id.includes(query);
    const matchesEvent = !selectedEvent || eventId === selectedEvent;

    return matchesSearch && matchesEvent;
  });

  renderEntrantsTable(filtered);
}

/**
 * Open Modal for registering new participant
 */
function openRegisterModal() {
  document.getElementById("entrantForm").reset();
  document.getElementById("modalEntrantId").value = "";
  document.getElementById("modalTitle").textContent = "Register Entrant";
  document.getElementById("modalFeedback").textContent = "";
  document.getElementById("entrantModal").classList.remove("hidden");
}

/**
 * Open Modal pre-filled with all participant details for editing
 */
function editEntrant(entrantId) {
  const entrant = globalEntrantsList.find(e => e.entrantId === entrantId);
  if (!entrant) {
    showAlert("Entrant details not found.", "error");
    return;
  }

  document.getElementById("modalEntrantId").value = entrant.entrantId || "";
  document.getElementById("modalEventSelect").value = entrant.eventId || "";
  document.getElementById("modalFullNameEN").value = entrant.fullNameEN || "";
  document.getElementById("modalFullNameCN").value = entrant.fullNameCN || "";
  document.getElementById("modalPhoneNumber").value = entrant.phoneNumber || "";
  document.getElementById("modalClass").value = entrant.class || "";
  document.getElementById("modalSchoolId").value = entrant.schoolId || "";
  document.getElementById("modalRole").value = entrant.role || "Solo";
  document.getElementById("modalResult").value = entrant.result || "";
  document.getElementById("modalReceiptUrl").value = entrant.receiptUrl || "";

  document.getElementById("modalTitle").textContent = "Edit Entrant Details";
  document.getElementById("modalFeedback").textContent = "";
  document.getElementById("entrantModal").classList.remove("hidden");
}

/**
 * Modal Close
 */
function closeModal() {
  document.getElementById("entrantModal").classList.add("hidden");
}

/**
 * Form Submission Handling
 */
async function handleEntrantSubmit(e) {
  e.preventDefault();

  const feedback = document.getElementById("modalFeedback");
  feedback.textContent = "";
  feedback.className = "feedback-msg";

  const entrantId = document.getElementById("modalEntrantId").value;
  const isEditing = Boolean(entrantId);

  const payload = {
    action: isEditing ? "updateEntrant" : "registerEntrant",
    token: getSessionToken(),
    entrantId: entrantId,
    eventId: document.getElementById("modalEventSelect").value,
    fullNameEN: document.getElementById("modalFullNameEN").value,
    fullNameCN: document.getElementById("modalFullNameCN").value,
    phoneNumber: document.getElementById("modalPhoneNumber").value,
    class: document.getElementById("modalClass").value,
    schoolId: document.getElementById("modalSchoolId").value,
    role: document.getElementById("modalRole").value,
    result: document.getElementById("modalResult").value,
    receiptUrl: document.getElementById("modalReceiptUrl").value
  };

  try {
    showLoadingScreen();
    const response = await apiRequest(payload);

    if (response && response.status === "success") {
      closeModal();
      showAlert(`Entrant ${isEditing ? "updated" : "registered"} successfully!`, "success");
      await loadAllEntrants();
    } else {
      feedback.textContent = response?.message || "Failed to save entrant.";
      feedback.classList.add("error");
    }
  } catch (err) {
    console.error("Save Entrant Error:", err);
    feedback.textContent = "An error occurred while saving.";
    feedback.classList.add("error");
  } finally {
    hideLoadingScreen();
  }
}

/**
 * Handle Entrant Deletion
 */
async function deleteEntrant(entrantId, fullName) {
  const confirmed = await showConfirm({
    title: "Delete Entrant",
    message: `Are you sure you want to remove "${fullName}" (${entrantId}) from the directory?`,
    confirmText: "Delete",
    cancelText: "Cancel",
    type: "danger"
  });

  if (!confirmed) return;

  try {
    showLoadingScreen();
    const response = await apiRequest({
      action: "deleteEntrant",
      token: getSessionToken(),
      entrantId: entrantId
    });

    if (response && response.status === "success") {
      showAlert("Entrant removed successfully.", "success");
      await loadAllEntrants();
    } else {
      showAlert(response?.message || "Failed to delete entrant.", "error");
    }
  } catch (err) {
    console.error("Delete Entrant Error:", err);
    showAlert("An error occurred while deleting the entrant.", "error");
  } finally {
    hideLoadingScreen();
  }
}

/**
 * Table Error Helper
 */
function showError(message) {
  const container = document.getElementById("entrantsTableContainer");
  if (container) {
    container.innerHTML = `<p class="placeholder-text" style="color: var(--error-text);">${escapeHtml(message)}</p>`;
  }
}