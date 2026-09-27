/**
 * Dashboard Logic Module
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Session verification guard
  if (typeof verifySession === "function") {
    const valid = await verifySession();
    if (!valid) return;
  }

  await loadDashboardData();
});

/**
 * Fetch and populate dashboard metrics and recent events
 */
async function loadDashboardData() {
  try {
    const response = await apiRequest({ action: "getEvents" });

    if (response && response.status === "success") {
      const eventsList = response.events || [];
      
      // Update Total Events count directly from array length
      const totalEventsEl = document.getElementById("totalEventsCount");
      if (totalEventsEl) {
        totalEventsEl.textContent = eventsList.length;
      }

      // Render recent events (slice to show top 5 on dashboard)
      renderRecentEvents(eventsList.slice(0, 5));
    } else {
      showDashboardError("Failed to fetch dashboard data.");
      console.error("Dashboard Data Fetch Error:", response ? response.message : "Unknown error");
    }
  } catch (err) {
    console.error("Dashboard Load Error:", err);
    showDashboardError("An error occurred while loading dashboard contents.");
  } finally {
    if (typeof hideLoadingScreen === "function") {
      hideLoadingScreen();
    }
  }
}

/**
 * Render structured table for recent events
 */
function renderRecentEvents(events) {
  const container = document.getElementById("recentEventsContainer");
  if (!container) return;

  if (!events || events.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No recent events found.</p>`;
    return;
  }

  const rowsHtml = events.map(event => {
    const eventId = event.eventId || event.id || "";
    const eventName = event.eventName || event.name || "Untitled Event";
    const eventType = event.eventType || event.type || "N/A";
    const eventFormat = event.eventFormat || event.format || "N/A";
    const eventStatus = event.status || "Upcoming";

    return `
      <tr class="clickable-row" onclick="navigateTo('events/viewevents.html?id=${escapeHtml(eventId)}')">
        <td><strong>${escapeHtml(eventId)}</strong></td>
        <td>${escapeHtml(eventName)}</td>
        <td><span class="badge">${escapeHtml(eventType)}</span></td>
        <td>${escapeHtml(eventFormat)}</td>
        <td>
          <span class="status-pill ${escapeHtml(eventStatus.toLowerCase())}">
            ${escapeHtml(eventStatus)}
          </span>
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
 * Fallback UI state on fetch failure
 */
function showDashboardError(message) {
  const container = document.getElementById("recentEventsContainer");
  if (container) {
    container.innerHTML = `<p class="placeholder-text" style="color: var(--error-text);">${escapeHtml(message)}</p>`;
  }
}