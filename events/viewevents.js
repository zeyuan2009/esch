/**
 * View Events Directory & Management Module
 */

let globalEventsList = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof verifySession === "function") {
    const valid = await verifySession();
    if (!valid) return;
  }

  await loadAllEvents();
});

/**
 * Fetch events list from backend
 */
async function loadAllEvents() {
  try {
    const response = await apiRequest({ action: "getEvents" });

    if (response && response.status === "success") {
      globalEventsList = response.events || [];
      renderEventsTable(globalEventsList);
    } else {
      showError("Failed to fetch events directory.");
    }
  } catch (err) {
    console.error("Get Events Error:", err);
    showError("An unexpected error occurred while loading events.");
  } finally {
    if (typeof hideLoadingScreen === "function") {
      hideLoadingScreen();
    }
  }
}

/**
 * Render standard tabular directory
 */
/**
 * Render standard tabular directory with Delete action
 */
function renderEventsTable(events) {
  const container = document.getElementById("eventsTableContainer");
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No events found matching criteria.</p>`;
    return;
  }

  const rowsHtml = events.map(event => {
    const eventId = event.eventId || event.id || "";
    const eventName = event.eventName || event.name || "Untitled Event";
    const eventType = event.eventType || event.type || "N/A";
    const eventFormat = event.eventFormat || event.format || "N/A";
    const eventStatus = event.status || "Upcoming";

    return `
      <tr>
        <td><strong>${escapeHtml(eventId)}</strong></td>
        <td>${escapeHtml(eventName)}</td>
        <td><span class="badge">${escapeHtml(eventType)}</span></td>
        <td>${escapeHtml(eventFormat)}</td>
        <td>
          <span class="status-pill ${escapeHtml(eventStatus.toLowerCase())}">
            ${escapeHtml(eventStatus)}
          </span>
        </td>
        <td style="text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="editEvent('${escapeHtml(eventId)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEvent('${escapeHtml(eventId)}', '${escapeHtml(eventName)}')">Delete</button>
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
            <th>Event Name</th>
            <th>Type</th>
            <th>Format</th>
            <th>Status</th>
            <th style="text-align: right;">Action</th>
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
 * Handle Event Deletion
 */
async function deleteEvent(eventId, eventName) {
  const confirmed = showConfirm(`Are you sure you want to delete event "${eventName}" (${eventId})? This action cannot be undone.`, "warning");
  if (!confirmed) return;

  try {
    showLoadingScreen();
    const response = await apiRequest({
      action: "deleteEvent",
      token: getSessionToken(),
      eventId: eventId
    });

    if (response && response.status === "success") {
      await loadAllEvents();
    } else {
      alert(response?.message || "Failed to delete event.");
    }
  } catch (err) {
    console.error("Delete Event Error:", err);
    alert("An error occurred while attempting to delete the event.");
  } finally {
    hideLoadingScreen();
  }
}

/**
 * Local live-search filtering
 */
function filterEvents() {
  const query = (document.getElementById("eventSearchInput")?.value || "").toLowerCase().trim();
  if (!query) {
    renderEventsTable(globalEventsList);
    return;
  }

  const filtered = globalEventsList.filter(evt => {
    const name = (evt.eventName || evt.name || "").toLowerCase();
    const id = (evt.eventId || evt.id || "").toLowerCase();
    const type = (evt.eventType || evt.type || "").toLowerCase();
    return name.includes(query) || id.includes(query) || type.includes(query);
  });

  renderEventsTable(filtered);
}

/**
 * Open Modal for creating a new event
 */
function openCreateModal() {
  document.getElementById("eventForm").reset();
  document.getElementById("modalEventId").value = "";
  document.getElementById("modalTitle").textContent = "Create Event";
  document.getElementById("modalFeedback").textContent = "";
  document.getElementById("eventModal").classList.remove("hidden");
}

/**
 * Open Modal pre-populated for editing an existing event
 */
async function editEvent(eventId) {
  showLoadingScreen();
  try {
    const response = await apiRequest({ action: "getEventById", eventId: eventId });
    if (response && response.status === "success" && response.event) {
      const evt = response.event;
      document.getElementById("modalEventId").value = evt.eventId || "";
      document.getElementById("modalEventName").value = evt.eventName || "";
      document.getElementById("modalEventType").value = evt.eventType || "";
      document.getElementById("modalEventFormat").value = evt.eventFormat || "1v1";
      document.getElementById("modalMaxEntrants").value = evt.maxEntrants || 32;
      document.getElementById("modalFee").value = evt.registrationFee || 0;
      document.getElementById("modalRemarks").value = evt.remarks || "";

      document.getElementById("modalTitle").textContent = "Edit Event";
      document.getElementById("modalFeedback").textContent = "";
      document.getElementById("eventModal").classList.remove("hidden");
    } else {
      alert("Unable to fetch event details.");
      console.log("Edit Event Fetch Error:", response);
    }
  } catch (err) {
    console.error("Fetch Event Details Error:", err);
  } finally {
    hideLoadingScreen();
  }
}

/**
 * Close Modal
 */
function closeModal() {
  document.getElementById("eventModal").classList.add("hidden");
}

/**
 * Form Submission Handling for Create & Update Operations
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const feedback = document.getElementById("modalFeedback");
  feedback.textContent = "";
  feedback.className = "feedback-msg";

  const eventId = document.getElementById("modalEventId").value;
  const isEditing = Boolean(eventId);

  const payload = {
    action: isEditing ? "updateEvent" : "createEvent",
    token: getSessionToken(),
    eventId: eventId,
    eventName: document.getElementById("modalEventName").value,
    eventType: document.getElementById("modalEventType").value,
    eventFormat: document.getElementById("modalEventFormat").value,
    maxEntrants: Number(document.getElementById("modalMaxEntrants").value),
    registrationFee: Number(document.getElementById("modalFee").value),
    remarks: document.getElementById("modalRemarks").value
  };

  try {
    showLoadingScreen();
    const response = await apiRequest(payload);

    if (response && response.status === "success") {
      closeModal();
      await loadAllEvents();
    } else {
      feedback.textContent = response.message || "Failed to save event.";
      feedback.classList.add("error");
    }
  } catch (err) {
    console.error("Save Event Error:", err);
    feedback.textContent = "An error occurred while saving.";
    feedback.classList.add("error");
  } finally {
    hideLoadingScreen();
  }
}

/**
 * Error container helper
 */
function showError(message) {
  const container = document.getElementById("eventsTableContainer");
  if (container) {
    container.innerHTML = `<p class="placeholder-text" style="color: var(--error-text);">${escapeHtml(message)}</p>`;
  }
}