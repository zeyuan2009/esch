/**
 * Matches & Logistics Controller Logic
 */

let allMatches = [];
let targetMatchIdFromUrl = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof showLoadingScreen === "function") showLoadingScreen();

  const urlParams = new URLSearchParams(window.location.search);
  const targetEventId = urlParams.get("eventId");
  targetMatchIdFromUrl = urlParams.get("matchId");

  if (typeof verifySession === "function") {
    const valid = await verifySession();
    if (!valid) return;
  }

  await loadEventsDropdown(targetEventId);

  if (targetEventId) {
    await loadMatchesForEvent();
  }

  if (typeof hideLoadingScreen === "function") hideLoadingScreen();
});

async function loadEventsDropdown(selectedEventId) {
  const select = document.getElementById("matchesEventSelect");
  if (!select) return;

  try {
    const response = await apiRequest({ action: "getEvents" });
    select.innerHTML = '<option value="">-- Select Event --</option>';

    if (response && response.status === "success" && Array.isArray(response.events)) {
      response.events.forEach((evt) => {
        const id = evt.eventId || evt.id;
        const name = evt.eventName || evt.name || id;

        if (id) {
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = name;
          if (selectedEventId && String(id) === String(selectedEventId)) {
            opt.selected = true;
          }
          select.appendChild(opt);
        }
      });
    }
  } catch (err) {
    console.error("Error loading events dropdown:", err);
  }
}

async function loadMatchesForEvent() {
  const select = document.getElementById("matchesEventSelect");
  const tbody = document.getElementById("matchesTableBody");
  if (!select || !tbody) return;

  const eventId = select.value;
  if (!eventId) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-placeholder">Select an event to view match records.</td></tr>';
    allMatches = [];
    return;
  }

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({ action: "getBracketData", eventId: eventId });

    if (response && response.status === "success" && Array.isArray(response.matches)) {
      allMatches = response.matches;
      populateRoundFilterOptions();
      applyMatchFilters();
    } else {
      allMatches = [];
      tbody.innerHTML = '<tr><td colspan="9" class="table-placeholder">No matches found for this event.</td></tr>';
    }
  } catch (err) {
    console.error("Error fetching matches:", err);
    tbody.innerHTML = '<tr><td colspan="9" class="table-placeholder">Error loading matches list.</td></tr>';
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

function populateRoundFilterOptions() {
  const roundSelect = document.getElementById("roundFilterSelect");
  if (!roundSelect) return;

  const rounds = [...new Set(allMatches.map((m) => m.round || m.roundNumber || 1))].sort((a, b) => a - b);

  roundSelect.innerHTML = '<option value="ALL">All Rounds</option>';
  rounds.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = `Round ${r}`;
    roundSelect.appendChild(opt);
  });
}

function applyMatchFilters() {
  const tbody = document.getElementById("matchesTableBody");
  const roundFilter = document.getElementById("roundFilterSelect")?.value || "ALL";
  const statusFilter = document.getElementById("statusFilterSelect")?.value || "ALL";

  if (!tbody) return;

  const filtered = allMatches.filter((m) => {
    const matchRound = String(m.round || m.roundNumber || 1);
    const matchStatus = m.status || (m.completed ? "COMPLETED" : "PENDING");

    const roundMatch = roundFilter === "ALL" || matchRound === roundFilter;
    const statusMatch = statusFilter === "ALL" || matchStatus === statusFilter;

    return roundMatch && statusMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-placeholder">No matches matching criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((m) => {
    const matchId = m.matchId || m.id;
    const rNum = m.round || m.roundNumber || 1;
    const p1 = m.p1Name || m.player1Name || m.player1 || "TBD";
    const p2 = m.p2Name || m.player2Name || m.player2 || "TBD";
    const s1 = m.score1 ?? m.p1Score ?? "-";
    const s2 = m.score2 ?? m.p2Score ?? "-";
    const status = m.status || (m.completed ? "COMPLETED" : "PENDING");
    const winnerId = m.winnerId || m.winner;
    const p1Id = m.p1Id || m.player1Id;
    const p2Id = m.p2Id || m.player2Id;

    const venue = m.venue || m.room || "-";
    const adjudicator = m.adjudicator || m.referee || "-";

    const isHighlight = targetMatchIdFromUrl && String(matchId) === String(targetMatchIdFromUrl);

    const canScore = status !== 'BYE' && p1 !== 'BYE' && p2 !== 'BYE' && p1 !== 'TBD' && p2 !== 'TBD';

    return `
      <tr class="${isHighlight ? 'highlighted-row' : ''}" id="match-row-${escapeHtml(matchId)}">
        <td data-label="Match ID"><strong>${escapeHtml(matchId)}</strong></td>
        <td data-label="Round">Round ${rNum}</td>
        <td data-label="Participant 1" class="${winnerId && winnerId === p1Id ? 'winner-text' : ''}">${escapeHtml(p1)}</td>
        <td data-label="Participant 2" class="${winnerId && winnerId === p2Id ? 'winner-text' : ''}">${escapeHtml(p2)}</td>
        <td data-label="Score">${status === 'COMPLETED' ? `${s1} -${s2}` : '-'}</td>
        <td data-label="Venue">${escapeHtml(venue)}</td>
        <td data-label="Adjudicator">${escapeHtml(adjudicator)}</td>
        <td data-label="Status"><span class="status-badge ${status.toLowerCase()}">${escapeHtml(status)}</span></td>
        <td data-label="Actions">
          <div class="action-btn-group">
            <button type="button" class="btn btn-secondary btn-sm" title="Edit Logistics & Details" onclick="openMatchDetailsModal('${escapeHtml(matchId)}')">
              <span class="material-symbols-outlined">edit_note</span>
            </button>
            ${canScore ? `
              <button type="button" class="btn btn-primary btn-sm" title="Submit Scores" onclick="openMatchScoreModal('${escapeHtml(matchId)}')">
                <span class="material-symbols-outlined">scoreboard</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (targetMatchIdFromUrl) {
    const targetRow = document.getElementById(`match-row-${targetMatchIdFromUrl}`);
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/**
 * 1. Details Modal Management
 */
function openMatchDetailsModal(matchId) {
  const match = allMatches.find((m) => String(m.matchId || m.id) === String(matchId));
  if (!match) return;

  document.getElementById("detailsMatchId").value = matchId;
  document.getElementById("modalVenue").value = match.venue || match.room || "";
  document.getElementById("modalAdjudicator").value = match.adjudicator || match.referee || "";
  document.getElementById("modalScheduledTime").value = match.scheduledTime || "";
  document.getElementById("modalStationNo").value = match.stationNo || match.tableNo || "";
  document.getElementById("modalRemarks").value = match.remarks || "";
  
  const feedback = document.getElementById("detailsModalFeedback");
  if (feedback) feedback.textContent = "";

  const modal = document.getElementById("matchDetailsModal");
  if (modal) modal.classList.remove("hidden");
}

function closeMatchDetailsModal() {
  const modal = document.getElementById("matchDetailsModal");
  if (modal) modal.classList.add("hidden");
}

async function handleMatchDetailsSubmit(e) {
  e.preventDefault();

  const matchId = document.getElementById("detailsMatchId").value;
  const venue = document.getElementById("modalVenue").value.trim();
  const adjudicator = document.getElementById("modalAdjudicator").value.trim();
  const scheduledTime = document.getElementById("modalScheduledTime").value;
  const stationNo = document.getElementById("modalStationNo").value.trim();
  const remarks = document.getElementById("modalRemarks").value.trim();
  const feedback = document.getElementById("detailsModalFeedback");

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({
      action: "updateMatchDetails",
      token: typeof getSessionToken === "function" ? getSessionToken() : "",
      matchId: matchId,
      venue: venue,
      adjudicator: adjudicator,
      scheduledTime: scheduledTime,
      stationNo: stationNo,
      remarks: remarks
    });

    if (response && response.status === "success") {
      closeMatchDetailsModal();
      if (typeof showToast === "function") showToast("Match details updated!", "success");
      await loadMatchesForEvent();
    } else {
      if (feedback) feedback.textContent = response?.message || "Failed to update details.";
    }
  } catch (err) {
    console.error("Details save error:", err);
    if (feedback) feedback.textContent = "Error saving match details.";
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

/**
 * 2. Score Modal Management
 */
function openMatchScoreModal(matchId) {
  const match = allMatches.find((m) => String(m.matchId || m.id) === String(matchId));
  if (!match) return;

  const modal = document.getElementById("matchScoreModal");
  document.getElementById("modalScoreMatchId").value = matchId;
  document.getElementById("modalP1Name").textContent = match.p1Name || match.player1Name || "Participant 1";
  document.getElementById("modalP2Name").textContent = match.p2Name || match.player2Name || "Participant 2";
  document.getElementById("modalScore1").value = match.score1 ?? match.p1Score ?? 0;
  document.getElementById("modalScore2").value = match.score2 ?? match.p2Score ?? 0;
  
  const feedback = document.getElementById("matchModalFeedback");
  if (feedback) feedback.textContent = "";

  if (modal) modal.classList.remove("hidden");
}

function closeMatchScoreModal() {
  const modal = document.getElementById("matchScoreModal");
  if (modal) modal.classList.add("hidden");
}

async function handleMatchScoreSubmit(e) {
  e.preventDefault();

  const matchId = document.getElementById("modalScoreMatchId").value;
  const score1 = document.getElementById("modalScore1").value;
  const score2 = document.getElementById("modalScore2").value;
  const feedback = document.getElementById("matchModalFeedback");

  if (Number(score1) === Number(score2)) {
    if (feedback) feedback.textContent = "Scores cannot be tied. Please set a winner.";
    return;
  }

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({
      action: "updateMatchScore",
      token: typeof getSessionToken === "function" ? getSessionToken() : "",
      matchId: matchId,
      score1: Number(score1),
      score2: Number(score2)
    });

    if (response && response.status === "success") {
      closeMatchScoreModal();
      if (typeof showToast === "function") showToast("Match score updated & winner advanced!", "success");
      await loadMatchesForEvent();
    } else {
      if (feedback) feedback.textContent = response?.message || "Failed to save score.";
    }
  } catch (err) {
    console.error("Score save error:", err);
    if (feedback) feedback.textContent = "Error saving match score.";
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

function backToBrackets() {
  const select = document.getElementById("matchesEventSelect");
  const eventId = select ? select.value : "";
  window.location.href = `brackets.html${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}