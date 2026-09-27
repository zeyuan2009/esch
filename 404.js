document.addEventListener("DOMContentLoaded", () => {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const goBackBtn = document.getElementById("goBackBtn");

  // Theme Toggle Handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const html = document.documentElement;
      const currentTheme = html.getAttribute("data-theme") || "dark";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", newTheme);

      const icon = themeToggleBtn.querySelector(".material-symbols-outlined");
      if (icon) {
        icon.textContent = newTheme === "dark" ? "dark_mode" : "light_mode";
      }
    });
  }

  // Go Back Navigation Handler
  if (goBackBtn) {
    goBackBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/index.html";
      }
    });
  }
});