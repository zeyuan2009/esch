/* ==========================================================================
   LOGIN MODULE - v0.2
   ========================================================================== */

showLoadingScreen("Authenticating...");

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Check existing session and auto-route
  await checkExistingSession();

  // 2. Hide loading screen
  hideLoadingScreen();

  // 3. DOM Elements
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const staffIdInput = document.getElementById("staffId");
  const pinInput = document.getElementById("pin");

  // 4. Form Submission Handler
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      showFeedback("loginFeedback", "", "");

      const staffId = staffIdInput.value.trim();
      const pin = pinInput.value.trim();

      if (!staffId || !pin) {
        showFeedback("loginFeedback", "Please fill in both Staff ID and Security PIN.", "error");
        return;
      }

      setSubmittingState(true);

      try {
        const payload = {
          action: "login",
          staffId: staffId,
          pin: pin
        };

        const response = await apiRequest(payload);

        if (response && response.status === "success") {
          // Store verified session token and user info
          localStorage.setItem("session_token", response.token);
          localStorage.setItem("session_staff_id", response.staffId);
          localStorage.setItem("session_staff_name", response.staffName || response.staffId);
          localStorage.setItem("session_staff_role", (response.role || "ADJUDICATOR").toUpperCase());

          showFeedback("loginFeedback", "Authentication successful! Redirecting...", "success");
          
          // Role-based portal redirection
          setTimeout(() => {
            const userRole = (response.role || "ADJUDICATOR").toUpperCase();
            if (userRole === "ADMIN") {
              navigateTo("index.html");
            } else {
              navigateTo("judge.html");
            }
          }, 800);

        } else {
          throw new Error(response.message || "Invalid Staff ID or Security PIN.");
        }

      } catch (err) {
        console.error("Login Error:", err);
        showFeedback("loginFeedback", err.message || "Unable to process login. Please try again.", "error");
        setSubmittingState(false);
      }
    });
  }

  function setSubmittingState(isSubmitting) {
    if (!loginBtn) return;

    if (isSubmitting) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `
        <span class="material-symbols-outlined spin">sync</span>
        <span>Authenticating...</span>
      `;
    } else {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `
        <span class="material-symbols-outlined">login</span>
        <span>Sign In</span>
      `;
    }
  }
});