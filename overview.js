// Depends on config.js (TOSCHE_CONFIG) and claims-config.js (CLAIM_REGIONS).
(function () {
  "use strict";

  const API_BASE = (window.TOSCHE_CONFIG && TOSCHE_CONFIG.API_BASE || "").replace(/\/$/, "");
  const GUILD_ID = window.TOSCHE_CONFIG && TOSCHE_CONFIG.GUILD_ID;

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

  function renderLeaderboard(container, entries, formatValue) {
    container.innerHTML = entries
      .map(
        (e, i) => `
      <li class="leaderboard-row">
        <span class="leaderboard-rank">${i + 1}</span>
        <span class="leaderboard-city" style="color:${CITY_COLORS[e.label] || "var(--gold)"}">${escapeHtml(e.label)}</span>
        <span class="leaderboard-value">${formatValue(e.value)}</span>
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
      els.status.hidden = true;

      const cities = cityStates();

      const popEntries = cities
        .map((label) => ({ label, value: citizensForCity(citizens, label).length }))
        .sort((a, b) => b.value - a.value);
      renderBarChart(els.popChart, popEntries, (v) => String(v));
      renderLeaderboard(els.popBoard, popEntries, (v) => `${v} citizen${v === 1 ? "" : "s"}`);

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
