// Depends on config.js (TOSCHE_CONFIG) and claims-config.js (CLAIM_REGIONS).
(function () {
  "use strict";

  const API_BASE = (typeof TOSCHE_CONFIG !== "undefined" && TOSCHE_CONFIG.API_BASE || "").replace(/\/$/, "");
  const GUILD_ID = typeof TOSCHE_CONFIG !== "undefined" ? TOSCHE_CONFIG.GUILD_ID : undefined;

  const els = {
    status: document.getElementById("overview-status"),
    popChart: document.getElementById("population-chart"),
    popBoard: document.getElementById("population-leaderboard"),
    activityChart: document.getElementById("activity-chart"),
    activityBoard: document.getElementById("activity-leaderboard"),
  };

  // Same palette used for each claim's highlight on the map, for visual consistency.
  const CITY_COLORS = {
    Crari: "#c9c15a",
    "Crari Bank": "#c9a227",
    Arkanos: "#d65f5f",
    Arkavion: "#d68a3a",
    Floodkeep: "#52a374",
    Pichia: "#8a63ab",
  };

  function showStatus(message, isError) {
    els.status.hidden = false;
    els.status.textContent = message;
    els.status.classList.toggle("error", !!isError);
  }

  function cityStates() {
    return Object.entries(CLAIM_REGIONS)
      .filter(([, info]) => info.type === "citystate")
      .map(([, info]) => info.label);
  }

  function citizensForCity(citizens, label) {
    return citizens.filter((c) =>
      (c.roles || []).some((r) => r.name.toLowerCase().includes(label.toLowerCase()))
    );
  }

  const CITIZEN_ROLE_ID = "1444736850639196305";
  const TRIAL_CITIZEN_ROLE_ID = "1444759694366212218";

  function citizenshipSplit(members) {
    const citizenCount = members.filter((c) => (c.roles || []).some((r) => String(r.id) === CITIZEN_ROLE_ID)).length;
    const trialCount = members.filter((c) => (c.roles || []).some((r) => String(r.id) === TRIAL_CITIZEN_ROLE_ID)).length;
    return { citizenCount, trialCount };
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderBarChart(container, entries, formatValue) {
    const max = Math.max(...entries.map((e) => e.value), 1);
    container.innerHTML = entries
      .map((e) => {
        const color = CITY_COLORS[e.label] || "var(--gold)";
        const pct = (e.value / max) * 100;
        return `
        <div class="overview-bar-row">
          <span class="overview-bar-label">${escapeHtml(e.label)}</span>
          <div class="overview-bar-track">
            <div class="overview-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="overview-bar-value">${formatValue(e.value)}</span>
        </div>`;
      })
      .join("");
  }

  function renderPopulationBarChart(container, entries) {
    const max = Math.max(...entries.map((e) => e.citizenCount + e.trialCount), 1);
    container.innerHTML =
      `<div class="line-chart-legend">
        <span style="color:#c9a227">Citizen</span>
        <span style="color:#8a92a3">Trial Citizen</span>
      </div>` +
      entries
        .map((e) => {
          const total = e.citizenCount + e.trialCount;
          const citizenPct = (e.citizenCount / max) * 100;
          const trialPct = (e.trialCount / max) * 100;
          return `
        <div class="overview-bar-row">
          <span class="overview-bar-label">${escapeHtml(e.label)}</span>
          <div class="overview-bar-track overview-bar-track-stacked">
            <div class="overview-bar-fill" style="width:${citizenPct}%;background:#c9a227"></div>
            <div class="overview-bar-fill" style="width:${trialPct}%;background:#8a92a3"></div>
          </div>
          <span class="overview-bar-value">${total}</span>
        </div>`;
        })
        .join("");
  }

  function renderLeaderboard(container, entries, formatValue) {
    container.innerHTML = entries
      .map(
        (e, i) => `
      <li class="leaderboard-row">
        <span class="leaderboard-rank">${i + 1}</span>
        <span class="leaderboard-city" style="color:${CITY_COLORS[e.label] || "var(--gold)"}">${escapeHtml(e.label)}</span>
        <span class="leaderboard-value">${formatValue(e.value, e)}</span>
      </li>`
      )
      .join("");
  }

  function formatMinutes(minutes) {
    const m = Math.round(minutes);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}m`;
    return `${h}h ${rem}m`;
  }

  function shortDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(5, 10);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function svgEmptyChart(message, opts) {
    opts = opts || {};
    const width = opts.width || 280;
    const height = opts.height || 150;
    const padding = 28;
    return `
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="line-chart-axis" />
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="line-chart-label">${message}</text>
      </svg>
    `;
  }

  function svgLineChart(series, opts) {
    opts = opts || {};
    const width = opts.width || 280;
    const height = opts.height || 150;
    const padding = 30;

    const allPoints = series.flatMap((s) => s.points);
    if (allPoints.length === 0) return svgEmptyChart("No history yet", { width, height });

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

    const labelIdxs = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1];
    const xLabels = labelIdxs
      .map((i) => {
        const x = padding + (n > 1 ? (i / (n - 1)) * (width - padding * 2) : (width - padding * 2) / 2);
        return `<text x="${x}" y="${height - 8}" text-anchor="middle" class="line-chart-label">${series[0].points[i].xLabel}</text>`;
      })
      .join("");

    const legend =
      series.length > 1
        ? `<div class="line-chart-legend">${series.map((s) => `<span style="color:${s.color}">${s.label}</span>`).join("")}</div>`
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

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error("[overview.js] history fetch failed:", url, err);
      return null;
    }
  }

  const chartMode = { population: "current", wealth: "current", activity: "current" };
  let lastCitizens = [];

  async function renderPopulationHistory() {
    els.popChart.innerHTML = `<p class="detail-empty">Loading history&hellip;</p>`;
    els.popBoard.innerHTML = "";
    const data = await fetchJson(`${API_BASE}/api/population-history?guild_id=${encodeURIComponent(GUILD_ID)}`);
    if (!data) {
      els.popChart.innerHTML = `<p class="detail-empty">Could not load history.</p>`;
      return;
    }
    // Sum citizen+trial counts across every city sharing the same snapshot timestamp
    const totals = {};
    data.forEach((d) => {
      const key = d.recorded_at;
      totals[key] = (totals[key] || 0) + (d.citizen_count || 0) + (d.trial_citizen_count || 0);
    });
    const sortedKeys = Object.keys(totals).sort();
    els.popChart.innerHTML = svgLineChart([
      { label: "Total Population", color: "#c9a227", points: sortedKeys.map((k) => ({ xLabel: shortDate(k), value: totals[k] })) },
    ]);
  }

  async function renderActivityHistory() {
    els.activityChart.innerHTML = `<p class="detail-empty">Loading history&hellip;</p>`;
    els.activityBoard.innerHTML = "";
    const data = await fetchJson(`${API_BASE}/api/activity-history?guild_id=${encodeURIComponent(GUILD_ID)}`);
    if (!data || data.length === 0) {
      els.activityChart.innerHTML = `<p class="detail-empty">No history yet.</p>`;
      return;
    }
    els.activityChart.innerHTML = svgLineChart([
      { label: "Mean", color: "#c9a227", points: data.map((d) => ({ xLabel: shortDate(d.date), value: d.mean || 0 })) },
      { label: "Median", color: "#8a92a3", points: data.map((d) => ({ xLabel: shortDate(d.date), value: d.median || 0 })) },
    ]);
  }

  function renderWealthHistory() {
    const el = document.getElementById("wealth-chart");
    if (el) el.innerHTML = svgEmptyChart("No data source configured yet");
  }

  function renderCurrentView() {
    const cities = cityStates();

    const popEntries = cities
      .map((label) => {
        const members = citizensForCity(lastCitizens, label);
        const { citizenCount, trialCount } = citizenshipSplit(members);
        return { label, citizenCount, trialCount, value: citizenCount + trialCount };
      })
      .sort((a, b) => b.value - a.value);
    renderPopulationBarChart(els.popChart, popEntries);
    renderLeaderboard(els.popBoard, popEntries, (v, e) => `${e.citizenCount} citizen${e.citizenCount === 1 ? "" : "s"}, ${e.trialCount} trial`);

    const activityEntries = cities
      .map((label) => {
        const members = citizensForCity(lastCitizens, label);
        const total = members.reduce((s, c) => s + (c.activity_30d_minutes || 0), 0);
        return { label, value: total };
      })
      .sort((a, b) => b.value - a.value);
    renderBarChart(els.activityChart, activityEntries, formatMinutes);
    renderLeaderboard(els.activityBoard, activityEntries, formatMinutes);
  }

  function refreshChart(key) {
    if (key === "population") {
      if (chartMode.population === "history") renderPopulationHistory();
      else renderCurrentView();
    } else if (key === "activity") {
      if (chartMode.activity === "history") renderActivityHistory();
      else renderCurrentView();
    } else if (key === "wealth") {
      if (chartMode.wealth === "history") renderWealthHistory();
      else {
        const el = document.getElementById("wealth-chart");
        if (el) el.innerHTML = `<p class="detail-empty">No data source configured yet.</p>`;
      }
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

  async function init() {
    if (!GUILD_ID || GUILD_ID === "YOUR_GUILD_ID_HERE" || !API_BASE) {
      showStatus("Set GUILD_ID in config.js to load the overview.", true);
      return;
    }

    showStatus("Loading realm data...");

    try {
      const res = await fetch(`${API_BASE}/api/citizens?guild_id=${encodeURIComponent(GUILD_ID)}`);
      if (!res.ok) throw new Error(`Citizens API returned ${res.status}`);
      const citizens = await res.json();
      lastCitizens = citizens;
      els.status.hidden = true;

      const cities = cityStates();

      const popEntries = cities
        .map((label) => {
          const members = citizensForCity(citizens, label);
          const { citizenCount, trialCount } = citizenshipSplit(members);
          return { label, citizenCount, trialCount, value: citizenCount + trialCount };
        })
        .sort((a, b) => b.value - a.value);
      renderPopulationBarChart(els.popChart, popEntries);
      renderLeaderboard(els.popBoard, popEntries, (v, e) => `${e.citizenCount} citizen${e.citizenCount === 1 ? "" : "s"}, ${e.trialCount} trial`);

      const activityEntries = cities
        .map((label) => {
          const members = citizensForCity(citizens, label);
          const total = members.reduce((s, c) => s + (c.activity_30d_minutes || 0), 0);
          return { label, value: total };
        })
        .sort((a, b) => b.value - a.value);
      renderBarChart(els.activityChart, activityEntries, formatMinutes);
      renderLeaderboard(els.activityBoard, activityEntries, formatMinutes);
    } catch (err) {
      console.error(err);
      showStatus(`Could not reach the registry API. ${err.message}`, true);
    }
  }

  init();
})();
