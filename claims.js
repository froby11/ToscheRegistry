// Depends on config.js (TOSCHE_CONFIG) and claims-config.js (CLAIM_REGIONS, CLAIM_GEOMETRY).
(function () {
  "use strict";

  const API_BASE = (window.TOSCHE_CONFIG && TOSCHE_CONFIG.API_BASE || "").replace(/\/$/, "");
  const GUILD_ID = window.TOSCHE_CONFIG && TOSCHE_CONFIG.GUILD_ID;

  const tooltip = document.getElementById("map-tooltip");
  const mapImage = document.getElementById("map-image");
  const mapOverlay = document.getElementById("map-overlay");
  const mapClip = document.getElementById("map-clip");
  const mapWrap = document.getElementById("map-wrap");
  const backBtn = document.getElementById("map-back-btn");
  const statsSection = document.getElementById("claim-stats-inline");
  const statsTitle = document.getElementById("claim-stats-title");
  const popContent = document.getElementById("stat-population-content");
  const activityContent = document.getElementById("stat-activity-content");

  let citizens = [];
  let citizensLoaded = false;

  async function loadCitizens() {
    if (!GUILD_ID || GUILD_ID === "YOUR_GUILD_ID_HERE" || !API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/api/citizens?guild_id=${encodeURIComponent(GUILD_ID)}`);
      if (!res.ok) return;
      citizens = await res.json();
      citizensLoaded = true;
    } catch (err) {
      console.error("Could not load citizens for claim stats:", err);
    }
  }

  function citizensForLabel(label) {
    return citizens.filter((c) =>
      (c.roles || []).some((r) => r.name.toLowerCase().includes(label.toLowerCase()))
    );
  }

  function computeStats(label) {
    const members = citizensForLabel(label);
    const activities = members.map((c) => c.activity_30d_minutes || 0).sort((a, b) => a - b);
    const mean = activities.length ? activities.reduce((s, v) => s + v, 0) / activities.length : 0;
    const mid = Math.floor(activities.length / 2);
    const median = activities.length
      ? activities.length % 2 === 0
        ? (activities[mid - 1] + activities[mid]) / 2
        : activities[mid]
      : 0;
    return { population: members.length, mean, median };
  }

  function formatMinutes(minutes) {
    const m = Math.round(minutes);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}m`;
    return `${h}h ${rem}m`;
  }

  // ------------------------------------------------------------------
  // Pan + zoom transform
  // ------------------------------------------------------------------

  let focused = false;
  let baseDx = 0, baseDy = 0, scale = 1;
  let panX = 0, panY = 0;
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let panStartX = 0, panStartY = 0;
  let dragMoved = 0;
  let suppressNextClick = false;

  function applyTransform() {
    const t = `translate(${baseDx + panX}px, ${baseDy + panY}px) scale(${scale})`;
    mapImage.style.transform = t;
    mapOverlay.style.transform = t;
  }

  function focusClaim(id) {
    const info = CLAIM_REGIONS[id];
    const geo = CLAIM_GEOMETRY[id];
    if (!info || !geo) return;

    const rect = mapWrap.getBoundingClientRect();
    const cxPct = (geo.bbox.xMinPct + geo.bbox.xMaxPct) / 2;
    const cyPct = (geo.bbox.yMinPct + geo.bbox.yMaxPct) / 2;
    const spanX = geo.bbox.xMaxPct - geo.bbox.xMinPct;
    const spanY = geo.bbox.yMaxPct - geo.bbox.yMinPct;
    const span = Math.max(spanX, spanY);
    scale = Math.min(6, Math.max(1.6, 80 / span));

    const regionCenterX = (cxPct / 100) * rect.width;
    const regionCenterY = (cyPct / 100) * rect.height;
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;

    // transform-origin is left at default (0 0 / top-left) for both elements, so scaling happens
    // from the top-left corner; translate needs to both re-center AND compensate for that scaling.
    baseDx = containerCenterX - regionCenterX * scale;
    baseDy = containerCenterY - regionCenterY * scale;
    panX = 0;
    panY = 0;

    mapClip.style.clipPath = geo.clipPath;
    applyTransform();

    mapOverlay.style.opacity = "0";
    mapOverlay.style.pointerEvents = "none";

    backBtn.hidden = false;
    statsSection.hidden = false;
    statsTitle.textContent = `${info.label} — Stats`;
    renderStats(info.label);

    focused = true;
    mapWrap.classList.add("focused");
  }

  function resetFocus() {
    scale = 1;
    baseDx = 0;
    baseDy = 0;
    panX = 0;
    panY = 0;
    mapImage.style.transform = "";
    mapOverlay.style.transform = "";
    mapClip.style.clipPath = "";
    mapOverlay.style.opacity = "";
    mapOverlay.style.pointerEvents = "";
    backBtn.hidden = true;
    statsSection.hidden = true;
    focused = false;
    mapWrap.classList.remove("focused");
  }

  function renderStats(label) {
    if (!citizensLoaded) {
      popContent.innerHTML = `<p class="detail-empty">Loading...</p>`;
      activityContent.innerHTML = "";
      return;
    }
    const stats = computeStats(label);

    popContent.innerHTML = `
      <p class="stat-big-number">${stats.population}</p>
      <p class="stat-caption">citizen${stats.population === 1 ? "" : "s"}</p>
    `;

    const maxVal = Math.max(stats.mean, stats.median, 1);
    activityContent.innerHTML = `
      <div class="mini-bar-chart">
        <div class="mini-bar-row">
          <span class="mini-bar-label">Mean</span>
          <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${(stats.mean / maxVal) * 100}%"></div></div>
          <span class="mini-bar-value">${formatMinutes(stats.mean)}</span>
        </div>
        <div class="mini-bar-row">
          <span class="mini-bar-label">Median</span>
          <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${(stats.median / maxVal) * 100}%"></div></div>
          <span class="mini-bar-value">${formatMinutes(stats.median)}</span>
        </div>
      </div>
    `;
  }

  backBtn.addEventListener("click", resetFocus);

  // ------------------------------------------------------------------
  // Drag to pan (works both zoomed-in and at rest)
  // ------------------------------------------------------------------

  mapWrap.addEventListener("mousedown", (e) => {
    if (e.target.closest(".map-back-btn")) return;
    dragging = true;
    dragMoved = 0;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    mapWrap.classList.add("panning");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    dragMoved = Math.max(dragMoved, Math.abs(dx), Math.abs(dy));
    panX = panStartX + dx;
    panY = panStartY + dy;
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (dragging && dragMoved > 5) suppressNextClick = true;
    dragging = false;
    mapWrap.classList.remove("panning");
  });

  // ------------------------------------------------------------------
  // Region hover + click
  // ------------------------------------------------------------------

  document.querySelectorAll(".claim-region").forEach((el) => {
    const id = el.dataset.regionId;
    const info = CLAIM_REGIONS[id];
    if (!info) return;

    el.addEventListener("mouseenter", () => {
      if (focused || !tooltip) return;
      const stats = citizensLoaded ? computeStats(info.label) : null;
      tooltip.innerHTML = stats
        ? `<strong>${info.label}</strong><br>Population: ${stats.population}<br>Balance: &mdash;`
        : `<strong>${info.label}</strong>`;
      tooltip.hidden = false;
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
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
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

  loadCitizens();
})();
