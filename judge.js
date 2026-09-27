document.addEventListener("DOMContentLoaded", async () => {
  // 1. Verify session token and role on load
  const isVerified = await verifySession();
  if (!isVerified) return;

  const user = getSessionUser() || {};
  
  // Extract potential user identifiers safely
  const currentUserId = String(user.staffId || user.userId || user.id || '').trim().toLowerCase();
  const currentUserName = String(user.name || user.username || user.staffName || '').trim().toLowerCase();

  // Update header UI with user name
  const userNameElem = document.querySelector(".user-name");
  if (userNameElem) {
    userNameElem.textContent = user.name || user.username || user.staffId || "Adjudicator";
  }

  // 2. Fetch matches on load
  await fetchAssignedMatches();

  // 3. Attach refresh button listener
  document.getElementById("refreshMatchesBtn")?.addEventListener("click", fetchAssignedMatches);

  /**
   * Fetches matches from backend and filters by logged-in staff ID or name
   */
  async function fetchAssignedMatches() {
    const listContainer = document.getElementById("assignedMatchesList");
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined spin">sync</span>
        <p>Fetching assigned matches...</p>
      </div>
    `;

    try {
      const eventsResponse = await apiRequest({ action: "getEvents" });
      
      const eventsList = eventsResponse?.data || eventsResponse?.events || [];

      if (!eventsResponse || eventsResponse.status !== "success" || eventsList.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-outlined">event_busy</span>
            <p>No active tournament events found.</p>
          </div>
        `;
        return;
      }

      let assignedMatches = [];

      for (const event of eventsList) {
        const eventId = event.EventID || event.id || event.eventId;
        const bracketResponse = await apiRequest({ 
          action: "getBracket", 
          eventId: eventId 
        });

        if (bracketResponse && bracketResponse.status === "success" && Array.isArray(bracketResponse.matches)) {
          const matches = bracketResponse.matches.filter(m => {
            const assignedVal = String(m.adjudicator || m.adjudicatorId || m.staffId || '').trim().toLowerCase();
            if (!assignedVal) return false;

            return (
              (currentUserId && assignedVal === currentUserId) ||
              (currentUserName && assignedVal === currentUserName) ||
              (currentUserId && assignedVal.includes(currentUserId)) ||
              (currentUserName && assignedVal.includes(currentUserName))
            );
          });

          matches.forEach(m => {
            m.eventName = event.EventName || event.name || "Tournament Match";
            m.eventId = eventId;
          });

          assignedMatches = assignedMatches.concat(matches);
        }
      }

      renderMatches(assignedMatches);

    } catch (err) {
      console.error("Error loading assigned matches:", err);
      listContainer.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">error</span>
          <p>Failed to load assigned matches. Please tap refresh.</p>
        </div>
      `;
    }
  }

  /**
   * Renders the list of assigned matches
   */
  function renderMatches(matches) {
    const listContainer = document.getElementById("assignedMatchesList");
    if (!listContainer) return;

    if (matches.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">assignment_turned_in</span>
          <p>You have no matches assigned to you at this time.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = matches.map(match => {
      const matchId = match.matchId || match.id;
      const p1Name = escapeHtml(match.p1Name || match.participant1 || match.player1 || "TBD");
      const p2Name = escapeHtml(match.p2Name || match.participant2 || match.player2 || "TBD");
      const score1 = match.score1 !== undefined && match.score1 !== null ? match.score1 : "";
      const score2 = match.score2 !== undefined && match.score2 !== null ? match.score2 : "";
      const isCompleted = match.status === "COMPLETED";

      return `
        <div class="match-card" id="match-card-${matchId}">
          <div class="match-meta">
            <span>${escapeHtml(match.eventName)}</span>
            <span>Round ${escapeHtml(match.round || '1')}</span>
          </div>

          <div class="match-vs">
            <div class="participant-box">${p1Name}</div>
            <div class="vs-badge">VS</div>
            <div class="participant-box">${p2Name}</div>
          </div>

          <form onsubmit="submitMatchScore(event, '${matchId}', '${match.eventId}')">
            <div class="score-input-grid">
              <div class="score-input-group">
                <label>${p1Name} Score</label>
                <input type="number" id="score1-${matchId}" value="${score1}" min="0" required ${isCompleted ? 'disabled' : ''}>
              </div>
              <div class="score-input-group">
                <label>${p2Name} Score</label>
                <input type="number" id="score2-${matchId}" value="${score2}" min="0" required ${isCompleted ? 'disabled' : ''}>
              </div>
            </div>

            ${!isCompleted ? `
              <button type="submit" class="btn btn-primary btn-block" id="btn-submit-${matchId}">
                <span class="material-symbols-outlined">save</span> Save Match Scores
              </button>
            ` : `
              <button type="button" class="btn btn-secondary btn-block" disabled>
                <span class="material-symbols-outlined">check_circle</span> Score Finalized
              </button>
            `}
          </form>
        </div>
      `;
    }).join("");
  }

  /**
   * Handles submitting score updates to backend
   */
  window.submitMatchScore = async function(event, matchId, eventId) {
    event.preventDefault();

    const score1Input = document.getElementById(`score1-${matchId}`);
    const score2Input = document.getElementById(`score2-${matchId}`);
    const submitBtn = document.getElementById(`btn-submit-${matchId}`);

    if (!score1Input || !score2Input) return;

    const score1 = parseInt(score1Input.value, 10);
    const score2 = parseInt(score2Input.value, 10);

    if (isNaN(score1) || isNaN(score2)) {
      showAlert("Please enter valid numeric scores for both participants.", "error");
      return;
    }

    const confirmSave = await showConfirm({
      title: "Submit Match Score",
      message: `Confirm score update: ${score1} - ${score2}?`,
      confirmText: "Submit Score",
      type: "primary"
    });

    if (!confirmSave) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined spin">sync</span> Saving...`;
    }

    try {
      const response = await apiRequest({
        action: "updateMatchScore",
        matchId: matchId,
        eventId: eventId,
        score1: score1,
        score2: score2
      });

      if (response && response.status === "success") {
        showAlert("Match score saved successfully!", "success");
        await fetchAssignedMatches();
      } else {
        throw new Error(response.message || "Failed to submit score.");
      }
    } catch (err) {
      console.error("Score submission error:", err);
      showAlert(err.message || "Unable to save scores.", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span class="material-symbols-outlined">save</span> Save Match Scores`;
      }
    }
  };
});