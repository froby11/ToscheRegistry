// Shared across all registry pages. Each page sets window.TOSCHE_PAGE before
// including this file to control which filter set and layout it uses.

(function () {
  "use strict";

  const API_BASE = TOSCHE_CONFIG.API_BASE.replace(/\/$/, "");
  const GUILD_ID = TOSCHE_CONFIG.GUILD_ID;

  const FACTIONS = ["Floodkeep", "Arkanos", "Crari", "Pichia", "Arkavion"];

  function isTimezoneRole(name) {
    return /timezone/i.test(name);
  }

  function isCitizenshipRole(name) {
    const lowered = name.toLowerCase();
    return lowered.includes("trial citizen") || lowered.includes("citizen");
  }

  function isFactionRole(name, faction) {
    return name.toLowerCase().includes(faction.toLowerCase());
  }

  function isOtherRole(name) {
    return (
      !isTimezoneRole(name) &&
      !isCitizenshipRole(name) &&
      !FACTIONS.some((f) => isFactionRole(name, f))
    );
  }

  const els = {
    body: document.getElementById("ledger-body"),
    status: document.getElementById("registry-status"),
    search: document.getElementById("search-input"),
    filterBar: document.getElementById("filter-bar"),
    statTotal: document.getElementById("stat-total"),
    statRanked: document.getElementById("stat-ranked"),
    statUpdated: document.getElementById("stat-updated"),
    overlay: document.getElementById("detail-overlay"),
    content: document.getElementById("detail-content"),
    close: document.getElementById("detail-close"),
  };

  let citizens = [];
  let activeFilter = null; // null = show all

  function showStatus(message, isError) {
    if (!els.status) return;
    els.status.hidden = false;
    els.status.textContent = message;
    els.status.classList.toggle("error", !!isError);
  }

  function hideStatus() {
    if (els.status) els.status.hidden = true;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function portraitUrl(citizen) {
    if (citizen.ign) {
      return `https://mc-heads.net/avatar/${encodeURIComponent(citizen.ign)}/64`;
    }
    return null;
  }

  function displayName(citizen) {
    return citizen.ign || citizen.discord_username || `Unknown (${citizen.discord_id})`;
  }

  function textColorFor(hex) {
    if (!hex) return "#ede6d3";
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#161b22" : "#ede6d3";
  }

  function renderBadge(role) {
    const bg = role.color || "#3a4250";
    const fg = textColorFor(role.color);
    return `<span class="badge" style="background:${bg};color:${fg};border-color:${bg}">${escapeHtml(
      role.name
    )}</span>`;
  }

  function renderBadges(rolesArr, predicate) {
    const list = predicate ? rolesArr.filter((r) => predicate(r.name)) : rolesArr;
    if (!list.length) return `<span class="no-role">&mdash;</span>`;
    return `<div class="badge-row">${list.map(renderBadge).join("")}</div>`;
  }

  function portraitCell(citizen) {
    const url = portraitUrl(citizen);
    if (url) {
      return `<img class="portrait" src="${url}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className:'portrait portrait-placeholder'}))">`;
    }
    return `<div class="portrait portrait-placeholder" title="No IGN on file"></div>`;
  }

  function citizenMatchesFilter(citizen) {
    if (!activeFilter) return true;
    const names = (citizen.roles || []).map((r) => r.name);
    if (activeFilter.type === "faction") return names.some((n) => isFactionRole(n, activeFilter.value));
    if (activeFilter.type === "timezone") return names.some(isTimezoneRole);
    if (activeFilter.type === "citizenship") return names.some(isCitizenshipRole);
    if (activeFilter.type === "other") return names.some(isOtherRole);
    return true;
  }

  function badgePredicateForPage() {
    const page = window.TOSCHE_PAGE;
    if (page === "timezones") return isTimezoneRole;
    if (page === "citizenship") return isCitizenshipRole;
    if (page === "other") return isOtherRole;
    return null; // citizens page shows all roles
  }

  function renderTable(list) {
    if (!els.body) return;
    if (list.length === 0) {
      els.body.innerHTML = "";
      showStatus("No citizens match this view.");
      return;
    }
    hideStatus();
    const predicate = badgePredicateForPage();

    els.body.innerHTML = list
      .map((c) => {
        return `
        <tr tabindex="0" data-discord-id="${c.discord_id}">
          <td class="col-portrait">${portraitCell(c)}</td>
          <td class="col-name">
            <span class="citizen-name">${escapeHtml(displayName(c))}</span>
            <span class="citizen-discord">${escapeHtml(c.discord_username || "")}</span>
          </td>
          <td class="col-station">${renderBadges(c.roles || [], predicate)}</td>
          <td class="col-recruiter">${c.recruited_by ? escapeHtml(c.recruited_by) : "&mdash;"}</td>
        </tr>`;
      })
      .join("");

    els.body.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("click", () => openDetail(row.dataset.discordId));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail(row.dataset.discordId);
        }
      });
    });
  }

  function applyFilters() {
    const query = (els.search && els.search.value.trim().toLowerCase()) || "";
    const filtered = citizens.filter((c) => {
      const name = displayName(c).toLowerCase();
      return (!query || name.includes(query)) && citizenMatchesFilter(c);
    });
    renderTable(filtered);
  }

  function buildFilterBar() {
    if (!els.filterBar) return;
    const page = window.TOSCHE_PAGE;
    let buttons = [];

    if (page === "citizens") {
      buttons = FACTIONS.map((f) => ({ label: f, filter: { type: "faction", value: f } }));
    } else if (page === "timezones") {
      buttons = [{ label: "All timezones", filter: { type: "timezone" } }];
    } else if (page === "citizenship") {
      buttons = [{ label: "All citizenship", filter: { type: "citizenship" } }];
    } else if (page === "other") {
      buttons = [{ label: "All other roles", filter: { type: "other" } }];
    }

    const allBtn = `<button class="filter-btn active" data-index="all">All citizens</button>`;
    const rest = buttons
      .map((b, i) => `<button class="filter-btn" data-index="${i}">${escapeHtml(b.label)}</button>`)
      .join("");
    els.filterBar.innerHTML = allBtn + rest;

    els.filterBar.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        els.filterBar.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const idx = btn.dataset.index;
        activeFilter = idx === "all" ? null : buttons[Number(idx)].filter;
        applyFilters();
      });
    });
  }

  function updateStats() {
    if (els.statTotal) els.statTotal.textContent = citizens.length;
    if (els.statRanked) {
      const ranked = citizens.filter((c) => (c.roles || []).length > 0).length;
      els.statRanked.textContent = ranked;
    }
    if (els.statUpdated) {
      const latest = citizens.reduce((max, c) => {
        if (!c.updated_at) return max;
        return !max || c.updated_at > max ? c.updated_at : max;
      }, null);
      els.statUpdated.textContent = latest ? formatRelative(latest) : "never";
    }
  }

  function formatRelative(isoString) {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffMinutes = Math.round((now - then) / 60000);
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  }

  async function openDetail(discordId) {
    if (!els.overlay) return;
    const citizen = citizens.find((c) => String(c.discord_id) === String(discordId));
    if (!citizen) return;

    els.content.innerHTML = renderDetailSkeleton(citizen);
    els.overlay.hidden = false;
    els.close.focus();

    try {
      const res = await fetch(
        `${API_BASE}/api/citizens/${encodeURIComponent(discordId)}?guild_id=${encodeURIComponent(GUILD_ID)}`
      );
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const full = await res.json();
      renderActivitySection(full.activity || []);
    } catch (err) {
      const section = document.getElementById("activity-section");
      if (section) section.innerHTML = `<p class="detail-empty">Could not load activity history.</p>`;
      console.error(err);
    }
  }

  function renderDetailSkeleton(citizen) {
    const roleList = citizen.roles || [];
    const portrait = portraitUrl(citizen);
    return `
      <div class="detail-header">
        ${
          portrait
            ? `<img class="detail-portrait" src="${portrait}" alt="">`
            : `<div class="detail-portrait portrait-placeholder"></div>`
        }
        <div>
          <h2 id="detail-name">${escapeHtml(displayName(citizen))}</h2>
          <p class="detail-sub">${escapeHtml(citizen.discord_username || "")}${
            citizen.timezone ? " &middot; " + escapeHtml(citizen.timezone) : ""
          }</p>
        </div>
      </div>

      <div class="detail-section">
        <h3>Station</h3>
        ${roleList.length ? renderBadges(roleList) : `<p class="detail-empty">Holds no tracked office.</p>`}
      </div>

      <div class="detail-section">
        <h3>Recruitment</h3>
        ${
          citizen.recruited_by
            ? `<p>Recruited by <strong>${escapeHtml(citizen.recruited_by)}</strong>${
                citizen.recruited_at ? ` on ${escapeHtml(citizen.recruited_at.slice(0, 10))}` : ""
              }</p>`
            : `<p class="detail-empty">No recruiter on record.</p>`
        }
      </div>

      <div class="detail-section" id="activity-section">
        <h3>Activity, last 30 days</h3>
        <p class="detail-empty">Loading&hellip;</p>
      </div>
    `;
  }

  function renderActivitySection(activity) {
    const section = document.getElementById("activity-section");
    if (!section) return;

    if (!activity.length) {
      section.innerHTML = `<h3>Activity, last 30 days</h3><p class="detail-empty">No activity recorded yet.</p>`;
      return;
    }

    const width = 480;
    const height = 140;
    const padding = 12;
    const max = Math.max(...activity.map((a) => a.playtime_minutes || 0), 1);

    const points = activity.map((a, i) => {
      const x = padding + (i / Math.max(activity.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((a.playtime_minutes || 0) / max) * (height - padding * 2);
      return `${x},${y}`;
    });

    section.innerHTML = `
      <h3>Activity, last 30 days</h3>
      <svg id="activity-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline points="${points.join(" ")}" fill="none" stroke="#c9a227" stroke-width="2" />
        ${points
          .map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.5" fill="#c9a227" />`)
          .join("")}
      </svg>
    `;
  }

  function closeDetail() {
    if (els.overlay) els.overlay.hidden = true;
  }

  if (els.close) els.close.addEventListener("click", closeDetail);
  if (els.overlay) {
    els.overlay.addEventListener("click", (e) => {
      if (e.target === els.overlay) closeDetail();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.overlay && !els.overlay.hidden) closeDetail();
  });
  if (els.search) els.search.addEventListener("input", applyFilters);

  async function init() {
    if (!GUILD_ID || GUILD_ID === "YOUR_GUILD_ID_HERE") {
      showStatus("Set GUILD_ID in config.js to load the registry.", true);
      return;
    }

    showStatus("Loading the registry...");

    try {
      const res = await fetch(`${API_BASE}/api/citizens?guild_id=${encodeURIComponent(GUILD_ID)}`);
      if (!res.ok) throw new Error(`Citizens API returned ${res.status}`);
      citizens = await res.json();

      buildFilterBar();
      updateStats();
      applyFilters();
    } catch (err) {
      console.error(err);
      showStatus(`Could not reach the registry API. ${err.message}`, true);
    }
  }

  init();
})();
