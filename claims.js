// Depends on config.js (TOSCHE_CONFIG) and claims-config.js (CLAIM_REGIONS, CLAIM_GEOMETRY).
(function () {
  "use strict";

  console.log("[claims.js] VERSION MARKER: officials-fix-2026-08-13-3");
  console.log("[claims.js] typeof TOSCHE_CONFIG at top of script:", typeof TOSCHE_CONFIG);
  try {
    console.log("[claims.js] TOSCHE_CONFIG raw value:", TOSCHE_CONFIG);
  } catch (e) {
    console.log("[claims.js] Accessing TOSCHE_CONFIG threw:", e.message);
  }

  const API_BASE = (typeof TOSCHE_CONFIG !== "undefined" && TOSCHE_CONFIG.API_BASE || "").replace(/\/$/, "");
  const GUILD_ID = typeof TOSCHE_CONFIG !== "undefined" ? TOSCHE_CONFIG.GUILD_ID : undefined;

  const tooltip = document.getElementById("map-tooltip");
  const mapStage = document.getElementById("map-stage");
  const mapOverlay = document.getElementById("map-overlay");
  const mapWrap = document.getElementById("map-wrap");
  const backBtn = document.getElementById("map-back-btn");
  const statsSection = document.getElementById("claim-stats-inline");
  const statsTitle = document.getElementById("claim-stats-title");
  const popContent = document.getElementById("stat-population-content");
  const activityContent = document.getElementById("stat-activity-content");
  const officialsContent = document.getElementById("claim-officials");

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

  const CITIZEN_ROLE_ID = "1444736850639196305";
  const TRIAL_CITIZEN_ROLE_ID = "1444759694366212218";

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

    const fullCitizens = members.filter((c) =>
      (c.roles || []).some((r) => String(r.id) === CITIZEN_ROLE_ID)
    ).length;
    const trialCitizens = members.filter((c) =>
      (c.roles || []).some((r) => String(r.id) === TRIAL_CITIZEN_ROLE_ID)
    ).length;

    return { population: members.length, fullCitizens, trialCitizens, mean, median };
  }

  function formatMinutes(minutes) {
    const m = Math.round(minutes);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}m`;
    return `${h}h ${rem}m`;
  }

  function headUrl(citizen) {
    if (citizen.ign) return `https://mc-heads.net/avatar/${encodeURIComponent(citizen.ign)}/40`;
    return null;
  }

  function renderOfficialCard(o, roleLabel) {
    if (!o) {
      return `
      <div class="official-card official-card-empty">
        <div class="official-head portrait-placeholder"></div>
        <div class="official-info">
          <span class="citizen-name">Not yet assigned</span>
        </div>
        <span class="official-badge">${roleLabel}</span>
      </div>`;
    }
    const head = headUrl(o);
    const name = o.ign || o.discord_username || `Unknown (${o.discord_id})`;
    return `
    <a class="official-card" href="citizen.html?id=${encodeURIComponent(o.discord_id)}">
      ${head ? `<img class="official-head" src="${head}" alt="">` : `<div class="official-head portrait-placeholder"></div>`}
      <div class="official-info">
        <span class="citizen-name">${name}</span>
        <span class="citizen-discord">${o.discord_username ? "@" + o.discord_username : ""}</span>
        <span class="official-activity">Activity (30d): ${o.activity_30d_minutes ? formatMinutes(o.activity_30d_minutes) : "&mdash;"}</span>
      </div>
      <span class="official-badge">${roleLabel}</span>
    </a>`;
  }

  async function renderOfficials(label) {
    console.log("[claims.js] renderOfficials called with label:", label, "officialsContent found:", !!officialsContent);
    if (!officialsContent) return;
    officialsContent.hidden = false;
    officialsContent.innerHTML = `<p class="detail-empty">Loading officials&hellip;</p>`;

    if (!GUILD_ID || GUILD_ID === "YOUR_GUILD_ID_HERE" || !API_BASE) {
      console.warn("[claims.js] renderOfficials aborting — GUILD_ID or API_BASE missing/placeholder", {
        GUILD_ID,
        API_BASE,
      });
      officialsContent.innerHTML = "";
      officialsContent.hidden = true;
      return;
    }

    const url = `${API_BASE}/api/officials?guild_id=${encodeURIComponent(GUILD_ID)}&city_state=${encodeURIComponent(label)}`;
    console.log("[claims.js] fetching officials from:", url);

    try {
      const res = await fetch(url);
      console.log("[claims.js] officials fetch response status:", res.status, res.ok);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const officials = await res.json();
      console.log("[claims.js] officials data received:", officials);

      const lord = officials.find((o) => o.official_role === "lord") || null;
      const mayor = officials.find((o) => o.official_role === "mayor") || null;
      console.log("[claims.js] lord:", lord, "mayor:", mayor);

      officialsContent.innerHTML = renderOfficialCard(lord, "Lord") + renderOfficialCard(mayor, "Mayor");
      console.log("[claims.js] officials HTML set. officialsContent.hidden is now:", officialsContent.hidden);
    } catch (err) {
      console.error("[claims.js] Could not load officials:", err);
      officialsContent.innerHTML = `<p class="detail-empty">Could not load officials.</p>`;
    }
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
    mapStage.style.transform = t;
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

    applyTransform();

    // Highlight only the selected claim's border; fade every other claim's tint out.
    // Nothing is cropped — the whole map stays freely pannable underneath.
    document.querySelectorAll(".claim-region").forEach((el) => {
      el.classList.toggle("selected-claim", el.dataset.regionId === id);
    });
    mapOverlay.classList.add("focus-mode");
    mapOverlay.style.pointerEvents = "none";

    backBtn.hidden = false;
    statsSection.hidden = false;
    statsTitle.textContent = `${info.label} — Stats`;
    currentLabel = info.label;
    chartMode.population = "current";
    chartMode.balance = "current";
    chartMode.activity = "current";
    document.querySelectorAll(".chart-toggle-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.textContent = "History";
    });
    renderStats(info.label);
    renderBalanceChart(info.label);
    if (info.type === "citystate") {
      renderOfficials(info.label);
    } else if (officialsContent) {
      officialsContent.innerHTML = "";
      officialsContent.hidden = true;
    }

    focused = true;
    mapWrap.classList.add("focused");
  }

  function resetFocus() {
    scale = 1;
    baseDx = 0;
    baseDy = 0;
    panX = 0;
    panY = 0;
    mapStage.style.transform = "";
    document.querySelectorAll(".claim-region").forEach((el) => el.classList.remove("selected-claim"));
    mapOverlay.classList.remove("focus-mode");
    mapOverlay.style.pointerEvents = "";
    backBtn.hidden = true;
    statsSection.hidden = true;
    if (officialsContent) {
      officialsContent.hidden = true;
      officialsContent.innerHTML = "";
    }
    focused = false;
    mapWrap.classList.remove("focused");
  }

  function svgBarChart(bars, opts) {
    opts = opts || {};
    const width = opts.width || 260;
    const height = opts.height || 140;
    const padding = 28;
    const maxVal = Math.max(...bars.map((b) => b.value), 1);
    const barW = (width - padding * 2) / bars.length - 16;

    const barsSvg = bars
      .map((b, i) => {
        const x = padding + i * ((width - padding * 2) / bars.length) + 8;
        const barH = (b.value / maxVal) * (height - padding * 2 - 20);
        const y = height - padding - barH;
        const color = b.color || "#c9a227";
        return `
        <text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" class="bar-chart-value">${b.displayValue}</text>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${color}" fill-opacity="0.85"></rect>
        <text x="${x + barW / 2}" y="${height - padding + 16}" text-anchor="middle" class="bar-chart-label">${b.label}</text>
      `;
      })
      .join("");

    return `
      <svg class="bar-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="bar-chart-baseline" />
        ${barsSvg}
      </svg>
    `;
  }

  function svgEmptyChart(message, opts) {
    opts = opts || {};
    const width = opts.width || 260;
    const height = opts.height || 140;
    const padding = 28;
    return `
      <svg class="bar-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="bar-chart-baseline" />
        <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" class="bar-chart-empty-line" />
        <text x="${width / 2}" y="${height / 2 - 12}" text-anchor="middle" class="bar-chart-empty-text">${message}</text>
      </svg>
    `;
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
      ${svgBarChart(
        [
          { label: "Trial Citizen", value: stats.trialCitizens, displayValue: stats.trialCitizens, color: "#8a92a3" },
          { label: "Citizen", value: stats.fullCitizens, displayValue: stats.fullCitizens, color: "#c9a227" },
        ],
        { height: 130 }
      )}
    `;

    activityContent.innerHTML = svgBarChart(
      [
        { label: "Mean", value: stats.mean, displayValue: formatMinutes(stats.mean), color: "#c9a227" },
        { label: "Median", value: stats.median, displayValue: formatMinutes(stats.median), color: "#8a92a3" },
      ],
      { width: 320, height: 150 }
    );
  }

  async function renderBalanceChart(label) {
    const el = document.getElementById("stat-balance-content");
    el.innerHTML = `<p class="detail-empty">Loading...</p>`;
    const data = await fetchJson(
      `${API_BASE}/api/balance-history?guild_id=${encodeURIComponent(GUILD_ID)}&city_state=${encodeURIComponent(label)}`
    );
    if (!data || data.length === 0) {
      el.innerHTML = svgEmptyChart("No data source configured yet", { height: 130 });
      return;
    }
    const latest = data[data.length - 1];
    el.innerHTML = `
      <p class="stat-big-number">${latest.balance}</p>
      <p class="stat-caption">as of ${shortDate(latest.recorded_at)}</p>
    `;
  }

  // ------------------------------------------------------------------
  // Historical line charts
  // ------------------------------------------------------------------

  const chartMode = { population: "current", balance: "current", activity: "current" };
  let currentLabel = null;

  function svgLineChart(series, opts) {
    opts = opts || {};
    const width = opts.width || 300;
    const height = opts.height || 150;
    const padding = 30;

    const allPoints = series.flatMap((s) => s.points);
    if (allPoints.length === 0) {
      return svgEmptyChart("No history yet", { width, height });
    }

    const maxVal = Math.max(...allPoints.map((p) => p.value), 1);
    const n = series[0].points.length;

    const linesSvg = series
      .map((s) => {
        const pts = s.points.map((p, i) => {
          const x = padding + (n > 1 ? (i / (n - 1)) * (width - padding * 2) : (width - padding * 2) / 2);
          const y = height - padding - (p.value / maxVal) * (height - padding * 2 - 10);
          return `${x},${y}`;
        });
        const dots = pts
          .map((pt) => {
            const [x, y] = pt.split(",");
            return `<circle cx="${x}" cy="${y}" r="2.5" fill="${s.color}" />`;
          })
          .join("");
        return `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2" />${dots}`;
      })
      .join("");

    // sparse x-axis labels: first, middle, last
    const labelIdxs = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1];
    const xLabels = labelIdxs
      .map((i) => {
        const x = padding + (n > 1 ? (i / (n - 1)) * (width - padding * 2) : (width - padding * 2) / 2);
        return `<text x="${x}" y="${height - 8}" text-anchor="middle" class="line-chart-label">${series[0].points[i].xLabel}</text>`;
      })
      .join("");

    const legend =
      series.length > 1
        ? `<div class="line-chart-legend">${series
            .map((s) => `<span style="color:${s.color}">${s.label}</span>`)
            .join("")}</div>`
        : "";

    return `
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="line-chart-axis" />
        ${linesSvg}
        ${xLabels}
      </svg>
      ${legend}
    `;
  }

  function shortDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso.slice(5, 10);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error("[claims.js] history fetch failed:", url, err);
      return null;
    }
  }

  async function renderPopulationHistory(label) {
    popContent.innerHTML = `<p class="detail-empty">Loading history&hellip;</p>`;
    const data = await fetchJson(
      `${API_BASE}/api/population-history?guild_id=${encodeURIComponent(GUILD_ID)}&city_state=${encodeURIComponent(label)}`
    );
    if (!data) {
      popContent.innerHTML = `<p class="detail-empty">Could not load history.</p>`;
      return;
    }
    popContent.innerHTML = svgLineChart(
      [
        {
          label: "Trial Citizen",
          color: "#8a92a3",
          points: data.map((d) => ({ xLabel: shortDate(d.recorded_at), value: d.trial_citizen_count || 0 })),
        },
        {
          label: "Citizen",
          color: "#c9a227",
          points: data.map((d) => ({ xLabel: shortDate(d.recorded_at), value: d.citizen_count || 0 })),
        },
      ],
      { height: 150 }
    );
  }

  async function renderBalanceHistory(label) {
    const el = document.getElementById("stat-balance-content");
    el.innerHTML = `<p class="detail-empty">Loading history&hellip;</p>`;
    const data = await fetchJson(
      `${API_BASE}/api/balance-history?guild_id=${encodeURIComponent(GUILD_ID)}&city_state=${encodeURIComponent(label)}`
    );
    if (!data || data.length === 0) {
      el.innerHTML = svgEmptyChart("No data source configured yet", { height: 130 });
      return;
    }
    el.innerHTML = svgLineChart(
      [{ label: "Balance", color: "#c9a227", points: data.map((d) => ({ xLabel: shortDate(d.recorded_at), value: d.balance || 0 })) }],
      { height: 130 }
    );
  }

  async function renderActivityHistory(label) {
    activityContent.innerHTML = `<p class="detail-empty">Loading history&hellip;</p>`;
    const data = await fetchJson(
      `${API_BASE}/api/activity-history?guild_id=${encodeURIComponent(GUILD_ID)}&city_state=${encodeURIComponent(label)}`
    );
    if (!data || data.length === 0) {
      activityContent.innerHTML = `<p class="detail-empty">No history yet.</p>`;
      return;
    }
    activityContent.innerHTML = svgLineChart(
      [
        { label: "Mean", color: "#c9a227", points: data.map((d) => ({ xLabel: shortDate(d.date), value: d.mean || 0 })) },
        { label: "Median", color: "#8a92a3", points: data.map((d) => ({ xLabel: shortDate(d.date), value: d.median || 0 })) },
      ],
      { width: 320, height: 150 }
    );
  }

  function refreshChart(chartKey) {
    if (!currentLabel) return;
    if (chartKey === "population") {
      chartMode.population === "history" ? renderPopulationHistory(currentLabel) : renderStats(currentLabel);
    } else if (chartKey === "balance") {
      chartMode.balance === "history" ? renderBalanceHistory(currentLabel) : renderBalanceChart(currentLabel);
    } else if (chartKey === "activity") {
      chartMode.activity === "history" ? renderActivityHistory(currentLabel) : renderStats(currentLabel);
    }
  }

  document.querySelectorAll(".chart-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.chart;
      chartMode[key] = chartMode[key] === "history" ? "current" : "history";
      btn.classList.toggle("active", chartMode[key] === "history");
      btn.textContent = chartMode[key] === "history" ? "Current" : "History";
      refreshChart(key);
    });
  });

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
    mapStage.classList.add("no-transition");
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
    mapStage.classList.remove("no-transition");
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
      if (citizensLoaded) {
        const stats = computeStats(info.label);
        tooltip.innerHTML = `<strong>${info.label}</strong><br>Population: ${stats.population}<br>Balance: &mdash;`;
      } else {
        tooltip.innerHTML = `<strong>${info.label}</strong><br>Population: loading&hellip;<br>Balance: &mdash;`;
      }
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
      console.log("[claims.js] click fired for region:", id, "label:", info.label);
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (tooltip) tooltip.hidden = true;
      try {
        focusClaim(id);
      } catch (err) {
        console.error("[claims.js] focusClaim threw an error:", err);
      }
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
