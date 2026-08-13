// Depends on claims-config.js being loaded first (defines CLAIM_REGIONS).
(function () {
  "use strict";

  const tooltip = document.getElementById("map-tooltip");

  document.querySelectorAll(".claim-region").forEach((el) => {
    const id = el.dataset.regionId;
    const info = CLAIM_REGIONS[id];
    if (!info) return;

    el.addEventListener("mouseenter", () => {
      if (tooltip) {
        tooltip.textContent = info.label;
        tooltip.hidden = false;
      }
    });

    el.addEventListener("mousemove", (e) => {
      if (!tooltip) return;
      const wrap = document.getElementById("map-wrap");
      const rect = wrap.getBoundingClientRect();
      tooltip.style.left = `${e.clientX - rect.left + 14}px`;
      tooltip.style.top = `${e.clientY - rect.top + 14}px`;
    });

    el.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.hidden = true;
    });

    el.addEventListener("click", () => {
      window.location.href = `claim.html?region=${encodeURIComponent(id)}`;
    });

    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", info.label);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.dispatchEvent(new Event("click"));
      }
    });
  });
})();
