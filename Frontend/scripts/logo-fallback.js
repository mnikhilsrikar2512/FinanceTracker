document.addEventListener("DOMContentLoaded", function() {
  try {
    const logoImg = document.querySelector(".cb-logo img");
    if (!logoImg) {
      const header = document.querySelector(".chatbot-head .panel-title");
      if (header) {
        const span = document.createElement("span");
        span.className = "cb-logo";
        const img = document.createElement("img");
        img.src = "/assets/chatbot-logo.svg";
        img.alt = "Finly logo";
        img.width = 20; img.height = 20;
        img.style.cssText = "vertical-align: middle; margin-right:6px;";
        img.onerror = function() {
          this.style.display = "none";
          const fb = document.createElement("span");
          fb.innerHTML = '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h12a4 4 0 0 1 0 8H6l-4 4V7z"/><circle cx="18" cy="9" r="1" fill="currentColor"/></svg>';
          span.appendChild(fb);
        };
        span.appendChild(img);
        header.parentElement.insertBefore(span, header);
      }
    }
  } catch (e) {
    // ignore
  }
});
