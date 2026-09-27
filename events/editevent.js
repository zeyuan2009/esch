/* ==========================================================================
   EDIT EVENT MODULE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const isAuthorized = await verifySession();
  if (!isAuthorized) return;

  hideLoadingScreen();

  const editEventForm = document.getElementById("editEventForm");
  const submitBtn = document.getElementById("submitBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const eventIdDisplay = document.getElementById("eventIdDisplay");

  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  // Extract ?id= parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const targetEventId = urlParams.get("id");

  if (!targetEventId) {
    alert("No event ID specified.");
    navigateTo("viewevents.html");
    return;
  }

  if (eventIdDisplay) {
    eventIdDisplay.textContent = `Editing Record: ${targetEventId}`;
  }

  // Load current event data from backend
  await fetchEventDetails(targetEventId);

  async function fetchEventDetails(id) {
    try {
      const response = await apiRequest({
        action: "getEventById",
        eventId: id
      });

      if (response && response.status === "success" && response.event) {
        populateForm(response.event);
      } else {
        throw new Error(response.message || "Event record not found.");
      }
    } catch (err) {
      console.error("Error loading event:", err);
      showFeedback("formFeedback", `Failed to load event details: ${err.message}`, "error");
    }
  }

  function populateForm(event) {
    document.getElementById("eventName").value = event.eventName || "";
    document.getElementById("gameFormat").value = event.eventFormat || "1v1";
    document.getElementById("maxEntrants").value = event.maxEntrants || 64;
    document.getElementById("registrationFee").value = event.registrationFee || 0;
    document.getElementById("remarks").value = event.remarks || "";
  }

  if (editEventForm) {
    editEventForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      showFeedback("formFeedback", "", "");

      const gameFormat = document.getElementById("gameFormat").value;
      const eventType = (gameFormat === "1v1") ? "INDIVIDUAL" : "TEAM";

      const payload = {
        action: "updateEvent",
        token: getSessionToken(),
        eventId: targetEventId,
        eventName: document.getElementById("eventName").value.trim(),
        eventType: eventType,
        eventFormat: gameFormat,
        maxEntrants: parseInt(document.getElementById("maxEntrants").value, 10),
        registrationFee: parseFloat(document.getElementById("registrationFee").value),
        remarks: document.getElementById("remarks").value.trim()
      };

      setSubmittingState(true);

      try {
        const response = await apiRequest(payload);

        if (response && response.status === "success") {
          showFeedback("formFeedback", "Event updated successfully!", "success");
          setTimeout(() => {
            navigateTo("viewevents.html");
          }, 1200);
        } else {
          throw new Error(response.message || "Failed to update event.");
        }
      } catch (err) {
        console.error("Error updating event:", err);
        showFeedback("formFeedback", `Error: ${err.message}`, "error");
      } finally {
        setSubmittingState(false);
      }
    });
  }

  function setSubmittingState(isSubmitting) {
    if (!submitBtn) return;
    if (isSubmitting) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined spin">sync</span> Saving...`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="material-symbols-outlined">save</span> Save Changes`;
    }
  }
});