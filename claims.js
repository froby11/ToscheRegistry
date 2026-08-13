// Depends on claims-config.js being loaded first (defines CLAIM_REGIONS, CLAIM_GEOMETRY).
(function () {
  "use strict";

  const tooltip = document.getElementById("map-tooltip");
  const mapImage = document.getElementById("map-image");
  const mapOverlay = document.getElementById("map-overlay");
  const mapWrap = document.getElementById("map-wrap");
  const backBtn = document.getElementById("map-back-btn");
  const statsSection = document.getElementById("claim-stats-inline");
  const statsTitle = document.getElementById("claim-stats-title");

  let focused = false;

  function focusClaim(id) {
    const info = CLAIM_REGIONS[id];
    const geo = CLAIM_GEOMETRY[id];
    if (!info || !geo) return;

    const cx = (geo.bbox.xMinPct + geo.bbox.xMaxPct) / 2;
    const cy = (geo.bbox.yMinPct + geo.bbox.yMaxPct) / 2;
    const spanX = geo.bbox.xMaxPct - geo.bbox.xMinPct;
    const spanY = geo.bbox.yMaxPct - geo.bbox.yMinPct;
    const span = Math.max(spanX, spanY);
    const scale = Math.min(6, Math.max(1.6, 80 / span));

    mapImage.style.transformOrigin = `${cx}% ${cy}%`;
    mapImage.style.transform = `scale(${scale})`;
    mapImage.style.clipPath = geo.clipPath;

    mapOverlay.style.opacity = "0";
    mapOverlay.style.pointerEvents = "none";

    backBtn.hidden = false;
    statsSection.hidden = false;
    statsTitle.textContent = `${info.label} — Stats`;

    focused = true;
  }

  function resetFocus() {
    mapImage.style.transform = "";
    mapImage.style.clipPath = "";
    mapImage.style.transformOrigin = "";
    mapOverlay.style.opacity = "";
    mapOverlay.style.pointerEvents = "";
    backBtn.hidden = true;
    statsSection.hidden = true;
    focused = false;
  }

  backBtn.addEventListener("click", resetFocus);

  document.querySelectorAll(".claim-region").forEach((el) => {
    const id = el.dataset.regionId;
    const info = CLAIM_REGIONS[id];
    if (!info) return;

    el.addEventListener("mouseenter", () => {
      if (focused) return;
      if (tooltip) {
        tooltip.textContent = info.label;
        tooltip.hidden = false;
      }
    });

    el.addEventListener("mousemove", (e) => {
      if (focused || !tooltip) return;
      const rect = mapWrap.getBoundingClientRect();
      tooltip.style.left = `${e.clientX - rect.left + 14}px`;
      tooltip.style.top = `${e.clientY - rect.top + 14}px`;
    });

    el.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.hidden = true;
    });

    el.addEventListener("click", () => {
      if (tooltip) tooltip.hidden = true;
      focusClaim(id);
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
