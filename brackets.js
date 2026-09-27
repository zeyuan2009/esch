/**
 * Frontend Bracket Renderer, Prebuilt Skeleton, Drag-and-Drop & Match Logic
 */

let globalMatches = [];
let globalStaffList = [];
let dragSource = null;
let currentTargetSlot = null; // { matchPos, slotNum }

// Strategy switch: Set to true for explicit CSS Grid Row Index assignment, or false for Invisible Blank Spacer Cards
const USE_GRID_ROW_INDEX = true;

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof showLoadingScreen === "function") showLoadingScreen();

  const select = document.getElementById("bracketEventSelect");
  if (select) select.disabled = true;

  if (typeof verifySession === "function") {
    const valid = await verifySession();
    if (!valid) return;
  }

  await loadStaffList();
  await loadEventsDropdown();

  if (select) {
    select.disabled = false;
    select.removeEventListener("change", loadBracket);
    select.addEventListener("change", loadBracket);
  }

  if (typeof hideLoadingScreen === "function") hideLoadingScreen();
});

/**
 * Fetch Staff List for Adjudicator Selection
 */
async function loadStaffList() {
  try {
    const response = await apiRequest({ action: "getStaff" });
    if (response && response.status === "success" && Array.isArray(response.data)) {
      globalStaffList = response.data;
    }
  } catch (err) {
    console.error("Error loading staff list:", err);
  }
}

/**
 * Fetch and Populate Event Options in Dropdown
 */
async function loadEventsDropdown() {
  const select = document.getElementById("bracketEventSelect");
  if (!select) return;

  try {
    const response = await apiRequest({ action: "getEvents" });

    select.innerHTML = '<option value="">-- Select Event --</option>';

    const events = response?.events || response?.data || [];
    if (response && response.status === "success" && Array.isArray(events)) {
      if (events.length === 0) {
        select.innerHTML = '<option value="">-- No Events Found --</option>';
        return;
      }

      events.forEach((evt) => {
        const id = evt.eventId || evt.id;
        const name = evt.eventName || evt.name || id;

        if (id) {
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = name;
          select.appendChild(opt);
        }
      });
    } else {
      if (typeof showToast === "function") showToast("Unable to fetch events list.", "error");
    }
  } catch (error) {
    console.error("Error fetching event dropdown:", error);
    if (typeof showToast === "function") showToast("Failed to connect to backend service.", "error");
  }
}

/**
 * Fetch Bracket Matches or Build Prebuilt Skeleton
 */
async function loadBracket() {
  const select = document.getElementById("bracketEventSelect");
  const canvas = document.getElementById("bracketCanvas");
  const hintBanner = document.getElementById("dragHintBanner");

  if (!select || !canvas) return;
  const eventId = select.value;

  if (!eventId) {
    canvas.innerHTML = '<p class="placeholder-text">Select an event to load or structure its tournament bracket.</p>';
    if (hintBanner) hintBanner.classList.add("hidden");
    globalMatches = [];
    return;
  }

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    // 1. Fetch Event Details for capacity
    let maxEntrants = 8;
    const eventRes = await apiRequest({ action: "getEventById", eventId: eventId });
    if (eventRes && eventRes.status === "success" && eventRes.event) {
      maxEntrants = Number(eventRes.event.maxEntrants || eventRes.event.maxParticipants || 8);
    }

    // 2. Fetch existing bracket matches
    const response = await apiRequest({
      action: "getBracketData",
      eventId: eventId
    });

    if (response && response.status === "success" && Array.isArray(response.matches) && response.matches.length > 0) {
      renderBracket(response.matches);
    } else {
      globalMatches = [];
      renderSkeletonBracket(maxEntrants);
      if (hintBanner) hintBanner.classList.add("hidden");
    }
  } catch (err) {
    console.error("Get Bracket Error:", err);
    canvas.innerHTML = '<p class="placeholder-text">Error loading tournament bracket.</p>';
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

/**
 * Render Prebuilt Empty Skeleton Structure
 */
function renderSkeletonBracket(maxEntrants) {
  const canvas = document.getElementById("bracketCanvas");
  if (!canvas) return;

  canvas.innerHTML = "";

  let bracketSize = 2;
  while (bracketSize < maxEntrants) {
    bracketSize *= 2;
  }

  const totalRounds = Math.log2(bracketSize);

  for (let r = 1; r <= totalRounds; r++) {
    const roundDiv = document.createElement("div");
    roundDiv.className = "bracket-round";

    const titleEl = document.createElement("div");
    titleEl.className = "round-title";
    titleEl.textContent = `Round ${r}`;
    roundDiv.appendChild(titleEl);

    let currentRowTracker = 2;
    const numMatches = bracketSize / Math.pow(2, r);

    for (let p = 1; p <= numMatches; p++) {
      const multiplier = Math.pow(2, r);
      const offset = Math.pow(2, r - 1);
      const targetRowIndex = 1 + (p - 1) * multiplier + offset;

      if (!USE_GRID_ROW_INDEX) {
        while (currentRowTracker < targetRowIndex) {
          const spacer = document.createElement("div");
          spacer.className = "match-card spacer-card";
          spacer.setAttribute("aria-hidden", "true");
          roundDiv.appendChild(spacer);
          currentRowTracker++;
        }
      }

      const matchCard = document.createElement("div");
      matchCard.className = "match-card empty-skeleton";

      if (USE_GRID_ROW_INDEX) {
        matchCard.style.gridRow = `${targetRowIndex}`;
      }

      const headerEl = document.createElement("div");
      headerEl.className = "match-card-header";
      headerEl.innerHTML = `<span class="match-id-badge">Match R${r}-P${p}</span>`;
      matchCard.appendChild(headerEl);

      const isRound1 = r === 1;
      matchCard.appendChild(createEmptySlotElement(1, isRound1, p));
      matchCard.appendChild(createEmptySlotElement(2, isRound1, p));

      roundDiv.appendChild(matchCard);
      currentRowTracker = targetRowIndex + 1;
    }

    canvas.appendChild(roundDiv);
  }

  requestAnimationFrame(() => {
    drawBracketConnectors();
  });

  window.addEventListener("resize", drawBracketConnectors);
}

/**
 * Helper to build empty interactive slot with '+' button
 */
function createEmptySlotElement(slotNum, isRound1, matchPos) {
  const slot = document.createElement("div");
  slot.className = "slot-row empty-slot";

  const nameSpan = document.createElement("span");
  nameSpan.className = "slot-name placeholder-slot";
  nameSpan.textContent = "TBD";
  slot.appendChild(nameSpan);

  if (isRound1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-add-slot";
    btn.title = "Add Participant";
    btn.textContent = "+";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openManualAssignModal(matchPos, slotNum);
    });
    slot.appendChild(btn);
  } else {
    const scoreSpan = document.createElement("span");
    scoreSpan.className = "slot-score";
    scoreSpan.textContent = "-";
    slot.appendChild(scoreSpan);
  }

  return slot;
}

/**
 * Render Generated Tournament Tree Structure
 */
function renderBracket(rawData) {
  const canvas = document.getElementById("bracketCanvas");
  const hintBanner = document.getElementById("dragHintBanner");
  if (!canvas) return;

  canvas.innerHTML = "";

  let normalizedMatches = [];
  let roundsMap = {};

  if (Array.isArray(rawData)) {
    if (rawData.length > 0 && (rawData[0].matches || rawData[0].games)) {
      rawData.forEach((rObj, idx) => {
        const rNum = rObj.round || rObj.roundNumber || idx + 1;
        const matchesInRound = rObj.matches || rObj.games || [];
        roundsMap[rNum] = matchesInRound;
        normalizedMatches.push(...matchesInRound);
      });
    } else {
      normalizedMatches = rawData;
      rawData.forEach((m) => {
        const r = m.round || m.roundNumber || 1;
        if (!roundsMap[r]) roundsMap[r] = [];
        roundsMap[r].push(m);
      });
    }
  }

  globalMatches = normalizedMatches;
  const roundNumbers = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  if (roundNumbers.length === 0 || normalizedMatches.length === 0) {
    canvas.innerHTML = '<p class="placeholder-text">No matches available to display.</p>';
    if (hintBanner) hintBanner.classList.add("hidden");
    return;
  }

  let isRound1Editable = false;

  roundNumbers.forEach((rNum) => {
    const roundMatches = roundsMap[rNum] || [];

    const roundDiv = document.createElement("div");
    roundDiv.className = "bracket-round";

    const titleEl = document.createElement("div");
    titleEl.className = "round-title";
    titleEl.textContent = `Round ${rNum}`;
    roundDiv.appendChild(titleEl);

    let currentRowTracker = 2; // Row 1 is reserved for title

    roundMatches.forEach((match, idx) => {
      const matchId = match.matchId || match.id;
      const status = match.status || (match.completed ? "COMPLETED" : "PENDING");
      const isCompleted = status === "COMPLETED";
      const isBye = status === "BYE";
      const assignedAdj = match.adjudicator || "";
      const pos = match.position || (idx + 1);

      if (rNum === 1 && !isCompleted && !isBye) isRound1Editable = true;

      const multiplier = Math.pow(2, rNum);
      const offset = Math.pow(2, rNum - 1);
      const targetRowIndex = 1 + (pos - 1) * multiplier + offset;

      if (!USE_GRID_ROW_INDEX) {
        while (currentRowTracker < targetRowIndex) {
          const spacer = document.createElement("div");
          spacer.className = "match-card spacer-card";
          spacer.setAttribute("aria-hidden", "true");
          roundDiv.appendChild(spacer);
          currentRowTracker++;
        }
      }

      const matchCard = document.createElement("div");
      matchCard.className = `match-card ${isCompleted ? "completed" : ""} ${isBye ? "bye-card" : ""}`;
      matchCard.dataset.matchId = matchId;

      if (USE_GRID_ROW_INDEX) {
        matchCard.style.gridRow = `${targetRowIndex}`;
      }

      // Header Badge & Formatted Adjudicator Trigger
      const headerEl = document.createElement("div");
      headerEl.className = "match-card-header";
      const shortLabel = match.round && match.position 
        ? `Match R${match.round}-P${match.position}` 
        : matchId;
      
      const adjLabel = assignedAdj ? `Judge: ${escapeHtml(assignedAdj)}` : `+ Assign Judge`;
      
      headerEl.innerHTML = `
        <span class="match-id-badge">${escapeHtml(shortLabel)}</span>
        <button type="button" class="btn-adj-badge ${assignedAdj ? "assigned" : ""}" onclick="event.stopPropagation(); openAssignModal('${matchId}')" title="${assignedAdj ? 'Judge: ' + escapeHtml(assignedAdj) : 'Assign Adjudicator'}">
          <span class="material-symbols-outlined">person</span>
          <span>${adjLabel}</span>
        </button>
      `;
      matchCard.appendChild(headerEl);

      const canDrag = rNum === 1 && !isCompleted && !isBye;
      const slot1 = createSlotElement(match, 1, canDrag);
      const slot2 = createSlotElement(match, 2, canDrag);

      matchCard.appendChild(slot1);
      matchCard.appendChild(slot2);

      roundDiv.appendChild(matchCard);
      currentRowTracker = targetRowIndex + 1;
    });

    canvas.appendChild(roundDiv);
  });

  if (hintBanner) {
    if (isRound1Editable) {
      hintBanner.classList.remove("hidden");
    } else {
      hintBanner.classList.add("hidden");
    }
  }

  requestAnimationFrame(() => {
    drawBracketConnectors();
  });

  window.addEventListener("resize", drawBracketConnectors);
}

/**
 * Draws connecting bracket lines between match cards across rounds
 */
function drawBracketConnectors() {
  const canvas = document.getElementById("bracketCanvas");
  const svg = document.getElementById("bracket-svg-canvas");
  if (!canvas || !svg) return;

  svg.innerHTML = "";

  const viewport = canvas.parentElement;
  
  svg.setAttribute("width", `${canvas.scrollWidth}px`);
  svg.setAttribute("height", `${canvas.scrollHeight}px`);

  const rounds = Array.from(canvas.querySelectorAll(".bracket-round"));
  if (rounds.length < 2) return;

  for (let r = 0; r < rounds.length - 1; r++) {
    const currentRoundCards = Array.from(rounds[r].querySelectorAll(".match-card:not(.spacer-card)"));
    const nextRoundCards = Array.from(rounds[r + 1].querySelectorAll(".match-card:not(.spacer-card)"));

    currentRoundCards.forEach((card, index) => {
      const targetCardIndex = Math.floor(index / 2);
      const targetCard = nextRoundCards[targetCardIndex];
      if (!targetCard) return;

      const viewportRect = viewport.getBoundingClientRect();

      const cardRect = card.getBoundingClientRect();
      const targetRect = targetCard.getBoundingClientRect();

      const startX = cardRect.right - viewportRect.left + viewport.scrollLeft;
      const startY = cardRect.top + cardRect.height / 2 - viewportRect.top + viewport.scrollTop;

      const endX = targetRect.left - viewportRect.left + viewport.scrollLeft;
      const endY = targetRect.top + targetRect.height / 2 - viewportRect.top + viewport.scrollTop;

      const midX = startX + (endX - startX) / 2;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

      path.setAttribute("d", d);
      path.setAttribute("stroke", "var(--border-color)");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");

      svg.appendChild(path);
    });
  }
}

/**
 * Helper to build slot row DOM with fallback property names
 */
function createSlotElement(match, slotNum, canDrag) {
  const slot = document.createElement("div");

  const pId = slotNum === 1 ? (match.p1Id || match.player1Id || match.player1) : (match.p2Id || match.player2Id || match.player2);
  const pName = slotNum === 1 ? (match.p1Name || match.player1Name || match.player1) : (match.p2Name || match.player2Name || match.player2);
  const score = slotNum === 1 ? (match.score1 ?? match.p1Score) : (match.score2 ?? match.p2Score);
  const winnerId = match.winnerId || match.winner;
  const isWinner = winnerId && winnerId === pId && pId !== "";

  const matchStatus = match.status || (match.completed ? "COMPLETED" : "PENDING");

  slot.className = `slot-row ${isWinner ? "winner" : ""} ${canDrag && pId && pId !== "BYE" ? "draggable-slot" : ""}`;

  const nameSpan = document.createElement("span");
  nameSpan.className = "slot-name";
  nameSpan.textContent = pName || (matchStatus === "BYE" ? "BYE" : "TBD");

  const scoreSpan = document.createElement("span");
  scoreSpan.className = "slot-score";
  scoreSpan.textContent = matchStatus === "COMPLETED" ? (score ?? "-") : "-";

  slot.appendChild(nameSpan);
  slot.appendChild(scoreSpan);

  if (canDrag && pId && pId !== "BYE") {
    slot.setAttribute("draggable", "true");
    const matchId = match.matchId || match.id;
    slot.addEventListener("dragstart", (e) => handleDragStart(e, matchId, slotNum));
    slot.addEventListener("dragover", handleDragOver);
    slot.addEventListener("dragleave", handleDragLeave);
    slot.addEventListener("drop", (e) => handleDrop(e, matchId, slotNum));
  }

  return slot;
}

/**
 * Finalize Bracket & Close Registration Handler
 */
async function finalizeBracket() {
  const select = document.getElementById("bracketEventSelect");
  const eventId = select ? select.value : "";
  if (!eventId) {
    if (typeof showAlert === "function") showAlert("Please select an event first.", "error");
    else if (typeof showToast === "function") showToast("Please select an event first.", "error");
    return;
  }

  let confirmed = true;
  if (typeof showConfirm === "function") {
    confirmed = await showConfirm({
      title: "Finalize Registration & Bracket",
      message: "This will lock public registration and fit the bracket tree to the current registered entrants. Continue?",
      confirmText: "Finalize",
      cancelText: "Cancel",
      type: "warning"
    });
  } else {
    confirmed = confirm("This will lock public registration and finalize the bracket tree. Continue?");
  }

  if (!confirmed) return;

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({
      action: "finalizeBracket",
      eventId: eventId,
      token: typeof getSessionToken === "function" ? getSessionToken() : ""
    });

    if (response && response.status === "success") {
      if (typeof showAlert === "function") showAlert("Registration closed and bracket finalized!", "success");
      else if (typeof showToast === "function") showToast("Registration closed and bracket finalized!", "success");

      await loadBracket();
    } else {
      const msg = response?.message || "Failed to finalize bracket.";
      if (typeof showAlert === "function") showAlert(msg, "error");
      else if (typeof showToast === "function") showToast(msg, "error");
    }
  } catch (err) {
    console.error("Finalize Bracket Error:", err);
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

/**
 * Open Adjudicator Assignment Modal
 */
function openAssignModal(matchId) {
  const match = globalMatches.find((m) => (m.matchId || m.id) === matchId);
  if (!match) return;

  const modal = document.getElementById("adjAssignModal");
  const modalMatchId = document.getElementById("adjModalMatchId");
  const select = document.getElementById("adjStaffSelect");

  if (!modal || !select) return;

  modalMatchId.value = matchId;

  const staff = globalStaffList.filter((s) => {
    const role = String(s.Role || s.role || "").toUpperCase();
    return role === "ADJUDICATOR" || role === "STAFF" || role === "ADMIN";
  });

  select.innerHTML = '<option value="">-- Select Adjudicator --</option>';
  staff.forEach((s) => {
    const id = s.StaffID || s.staffId || s.id;
    const name = s.Name || s.name || id;
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${name} (${id})`;
    if (id === match.adjudicator || name === match.adjudicator) opt.selected = true;
    select.appendChild(opt);
  });

  modal.classList.remove("hidden");
}

function closeAssignModal() {
  const modal = document.getElementById("adjAssignModal");
  if (modal) modal.classList.add("hidden");
}

async function confirmAssignAdjudicator() {
  const matchId = document.getElementById("adjModalMatchId").value;
  const select = document.getElementById("adjStaffSelect");
  const adjudicatorId = select ? select.value : "";

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({
      action: "updateMatch",
      token: typeof getSessionToken === "function" ? getSessionToken() : "",
      matchId: matchId,
      adjudicator: adjudicatorId
    });

    if (response && response.status === "success") {
      closeAssignModal();
      if (typeof showAlert === "function") showAlert("Adjudicator assigned!", "success");
      else if (typeof showToast === "function") showToast("Adjudicator assigned!", "success");

      await loadBracket();
    } else {
      const msg = response?.message || "Failed to assign adjudicator.";
      if (typeof showAlert === "function") showAlert(msg, "error");
      else if (typeof showToast === "function") showToast(msg, "error");
    }
  } catch (err) {
    console.error("Assign Adjudicator Error:", err);
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

/**
 * Redirect to matches.html
 */
function redirectToMatches() {
  const select = document.getElementById("bracketEventSelect");
  const eventId = select ? select.value : "";
  if (!eventId) {
    if (typeof showToast === "function") showToast("Please select an event first.", "error");
    return;
  }
  window.location.href = `matches.html?eventId=${encodeURIComponent(eventId)}`;
}

/**
 * Manual Assignment Modal Handler
 */
async function openManualAssignModal(matchPos, slotNum) {
  const select = document.getElementById("bracketEventSelect");
  const eventId = select ? select.value : "";
  if (!eventId) return;

  currentTargetSlot = { matchPos, slotNum };

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({ action: "getEntrants", eventId: eventId });
    const modalSelect = document.getElementById("manualEntrantSelect");
    if (!modalSelect) return;

    modalSelect.innerHTML = '<option value="">-- Select Participant --</option>';

    if (response && response.status === "success" && Array.isArray(response.entrants)) {
      response.entrants.forEach((ent) => {
        const id = ent.entrantId || ent.id;
        const name = ent.fullNameEN || ent.name || id;
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        modalSelect.appendChild(opt);
      });
    }

    const modal = document.getElementById("manualAssignModal");
    if (modal) modal.classList.remove("hidden");
  } catch (err) {
    console.error("Fetch entrants error:", err);
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

function closeManualAssignModal() {
  const modal = document.getElementById("manualAssignModal");
  if (modal) modal.classList.add("hidden");
  currentTargetSlot = null;
}

function confirmManualAssign() {
  const modalSelect = document.getElementById("manualEntrantSelect");
  if (!modalSelect || !modalSelect.value) {
    if (typeof showToast === "function") showToast("Please choose a participant.", "error");
    return;
  }

  if (typeof showToast === "function") {
    showToast("Participant slot queued. Click 'Generate Bracket' to lock in assignments.", "info");
  }
  closeManualAssignModal();
}

/**
 * Trigger Bracket Generation
 */
async function triggerGenerateBracket() {
  const select = document.getElementById("bracketEventSelect");
  if (!select || !select.value) {
    if (typeof showAlert === "function") showAlert("Please select an event first.", "error");
    else if (typeof showToast === "function") showToast("Please select an event first.", "error");
    return;
  }

  const eventId = select.value;

  let confirmed = true;
  if (typeof showConfirm === "function") {
    confirmed = await showConfirm({
      title: "Generate Bracket",
      message: "Generating a new bracket will overwrite existing match data for this event. Continue?",
      confirmText: "Generate",
      cancelText: "Cancel",
      type: "danger"
    });
  } else {
    confirmed = confirm("Generating a new bracket will overwrite existing match data. Continue?");
  }

  if (!confirmed) return;

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({
      action: "generateBracket",
      eventId: eventId,
      token: typeof getSessionToken === "function" ? getSessionToken() : ""
    });

    if (response && response.status === "success") {
      if (typeof showAlert === "function") showAlert("Bracket generated successfully!", "success");
      else if (typeof showToast === "function") showToast("Bracket generated successfully!", "success");

      await loadBracket();
    } else {
      const msg = response?.message || "Failed to generate bracket.";
      if (typeof showAlert === "function") showAlert(msg, "error");
      else if (typeof showToast === "function") showToast(msg, "error");
    }
  } catch (err) {
    console.error("Bracket Generation Error:", err);
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

/**
 * Drag-and-Drop Event Handlers
 */
function handleDragStart(e, matchId, slot) {
  dragSource = { matchId, slot };
  e.dataTransfer.effectAllowed = "move";
  e.stopPropagation();
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

async function handleDrop(e, targetMatchId, targetSlot) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove("drag-over");

  if (!dragSource || (dragSource.matchId === targetMatchId && dragSource.slot === targetSlot)) return;

  try {
    if (typeof showLoadingScreen === "function") showLoadingScreen();

    const response = await apiRequest({
      action: "swapParticipants",
      token: typeof getSessionToken === "function" ? getSessionToken() : "",
      matchId1: dragSource.matchId,
      slot1: dragSource.slot,
      matchId2: targetMatchId,
      slot2: targetSlot
    });

    if (response && response.status === "success") {
      await loadBracket();
    } else {
      const msg = response?.message || "Swap failed.";
      if (typeof showAlert === "function") showAlert(msg, "error");
      else if (typeof showToast === "function") showToast(msg, "error");
    }
  } catch (err) {
    console.error("Swap Error:", err);
  } finally {
    dragSource = null;
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

/**
 * Score Modal Management
 */
function openScoreModal(matchId) {
  const match = globalMatches.find((m) => (m.matchId || m.id) === matchId);
  if (!match) return;

  const p1Name = match.p1Name || match.player1Name || match.player1;
  const p2Name = match.p2Name || match.player2Name || match.player2;

  if (!p1Name || !p2Name || p1Name === "BYE" || p2Name === "BYE") return;

  const modal = document.getElementById("scoreModal");
  const modalMatchId = document.getElementById("modalMatchId");
  const modalP1Name = document.getElementById("modalP1Name");
  const modalP2Name = document.getElementById("modalP2Name");
  const modalScore1 = document.getElementById("modalScore1");
  const modalScore2 = document.getElementById("modalScore2");
  const feedback = document.getElementById("scoreModalFeedback");

  if (!modal) return;

  if (modalMatchId) modalMatchId.value = matchId;
  if (modalP1Name) modalP1Name.textContent = p1Name;
  if (modalP2Name) modalP2Name.textContent = p2Name;
  if (modalScore1) modalScore1.value = match.score1 ?? match.p1Score ?? 0;
  if (modalScore2) modalScore2.value = match.score2 ?? match.p2Score ?? 0;
  if (feedback) feedback.textContent = "";

  modal.classList.remove("hidden");
}

function closeScoreModal() {
  const modal = document.getElementById("scoreModal");
  if (modal) modal.classList.add("hidden");
}

async function handleScoreSubmit(e) {
  e.preventDefault();

  const matchId = document.getElementById("modalMatchId").value;
  const score1 = document.getElementById("modalScore1").value;
  const score2 = document.getElementById("modalScore2").value;
  const feedback = document.getElementById("scoreModalFeedback");

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
      closeScoreModal();
      if (typeof showAlert === "function") showAlert("Match result saved!", "success");
      else if (typeof showToast === "function") showToast("Match result saved!", "success");

      await loadBracket();
    } else {
      if (feedback) feedback.textContent = response?.message || "Error saving score.";
    }
  } catch (err) {
    console.error("Save Match Error:", err);
    if (feedback) feedback.textContent = "Failed to communicate with server.";
  } finally {
    if (typeof hideLoadingScreen === "function") hideLoadingScreen();
  }
}

function enableBracketPan(viewportElement) {
  let isDown = false;
  let startX, startY;
  let scrollLeft, scrollTop;

  viewportElement.addEventListener('mousedown', (e) => {
    if (['BUTTON', 'INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) return;

    isDown = true;
    viewportElement.classList.add('active');
    startX = e.pageX - viewportElement.offsetLeft;
    startY = e.pageY - viewportElement.offsetTop;
    scrollLeft = viewportElement.scrollLeft;
    scrollTop = viewportElement.scrollTop;
  });

  viewportElement.addEventListener('mouseleave', () => {
    isDown = false;
    viewportElement.classList.remove('active');
  });

  viewportElement.addEventListener('mouseup', () => {
    isDown = false;
    viewportElement.classList.remove('active');
  });

  viewportElement.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - viewportElement.offsetLeft;
    const y = e.pageY - viewportElement.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    viewportElement.scrollLeft = scrollLeft - walkX;
    viewportElement.scrollTop = scrollTop - walkY;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.querySelector('.bracket-viewport');
  if (viewport) {
    enableBracketPan(viewport);
  }
});

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}