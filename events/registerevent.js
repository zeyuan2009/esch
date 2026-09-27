/* ==========================================================================
   REGISTER EVENT MODULE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Session Guard - Verify token before rendering/processing form
  const isAuthorized = await verifySession();
  if (!isAuthorized) return;

  // 2. Hide page loading screen once authenticated and DOM is ready
  hideLoadingScreen();

  // 3. DOM Element References
  const registerEventForm = document.getElementById("registerEventForm");
  const submitBtn = document.getElementById("submitBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // 4. Attach Logout Event Listener
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  // 5. Handle Form Submission
  if (registerEventForm) {
    registerEventForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Clear any previous inline feedback messages
      showFeedback("formFeedback", "", "");

      // Collect form field values
      const eventName = document.getElementById("eventName").value.trim();
      const gameFormat = document.getElementById("gameFormat").value;
      const maxEntrants = parseInt(document.getElementById("maxEntrants").value, 10);
      const registrationFee = parseFloat(document.getElementById("registrationFee").value);
      const remarks = document.getElementById("remarks").value.trim();

      // Derive 'eventType' ('INDIVIDUAL' vs 'TEAM') based on selected game format
      const eventType = (gameFormat === "1v1") ? "INDIVIDUAL" : "TEAM";

      // Build payload matching handleCreateEvent(data) in backend
      const payload = {
        action: "createEvent",
        token: getSessionToken(),
        eventName: eventName,
        eventType: eventType,
        eventFormat: gameFormat,
        maxEntrants: isNaN(maxEntrants) ? 0 : maxEntrants,
        registrationFee: isNaN(registrationFee) ? 0 : registrationFee,
        remarks: remarks
      };

      // Set UI to loading/disabled state
      setSubmittingState(true);

      try {
        // Send request through universal apiRequest wrapper
        const response = await apiRequest(payload);

        if (response && response.status === "success") {
          const newEventId = response.event ? response.event.eventId : "";
          showFeedback("formFeedback", `Event created successfully! ID: ${newEventId}`, "success");
          
          // Optionally reset form
          registerEventForm.reset();

          // Redirect to event view after a brief delay
          setTimeout(() => {
            navigateTo("viewevents.html");
          }, 1500);

        } else {
          throw new Error(response.message || "Failed to register event.");
        }

      } catch (err) {
        console.error("Error creating event:", err);
        showFeedback("formFeedback", `Error: ${err.message}`, "error");
      } finally {
        setSubmittingState(false);
      }
    });
  }

  /**
   * Toggles the submit button state and spinner icon during API requests.
   * @param {boolean} isSubmitting 
   */
  function setSubmittingState(isSubmitting) {
    if (!submitBtn) return;

    if (isSubmitting) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined spin">sync</span> Submitting...`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="material-symbols-outlined">add_circle</span> Register Event`;
    }
  }
});