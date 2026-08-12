// EDIT THIS: map each traced region to its real name. The keys (region-1, etc.)
// match the SVG polygon ids in claims.html — leave those alone, just change
// the "label" and "type" values here to match reality.
//
// type: "citystate" links through to the Citizens registry pre-filtered by
// that City-State. type: "territory" and type: "landmark" just show a label
// for now since there's no backing data for them yet.
const CLAIM_REGIONS = {
  "region-1-north": { label: "Region 1 (north)", type: "citystate" },
  "region-2-outpost": { label: "Region 2 (small outpost)", type: "landmark" },
  "region-3-west": { label: "Region 3 (west)", type: "citystate" },
  "region-4-southcenter": { label: "Region 4 (south-center)", type: "citystate" },
  "region-5-east": { label: "Region 5 (east)", type: "citystate" },
  "region-6-obelisk": { label: "Region 6 (obelisk pocket)", type: "landmark" },
};

(function () {
  "use strict";

  const tooltip = document.getElementById("map-tooltip");

  document.querySelectorAll(".claim-region").forEach((el) => {
    const id = el.dataset.regionId;
    const info = CLAIM_REGIONS[id];
    if (!info) return;

    el.addEventListener("mouseenter", (e) => {
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
      if (info.type === "citystate") {
        window.location.href = `index.html?citystate=${encodeURIComponent(info.label)}`;
      }
      // territory / landmark: no destination page yet, click does nothing for now
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
