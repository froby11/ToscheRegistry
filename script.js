(function () {
  "use strict";

  const API_BASE = TOSCHE_CONFIG.API_BASE.replace(/\/$/, "");
  const GUILD_ID = TOSCHE_CONFIG.GUILD_ID;

  const els = {
    body: document.getElementById("ledger-body"),
    status: document.getElementById("registry-status"),
    search: document.getElementById("search-input"),
    roleFilter: document.getElementById("role-filter"),
    statTotal: document.getElementById("stat-total"),
    statRanked: document.getElementById("stat-ranked"),
    statUpdated: document.getElementById("stat-updated"),
    overlay: document.getElementById("detail-overlay"),
    panel: document.getElementById("detail-panel"),
    content: document.getElementById("detail-content"),
    close: document.getElementById("detail-close"),
  };

  let citizens = [];
  let roles = [];

  function showStatus(message, isError) {
    els.status.hidden = false;
    els.status.textContent = message;
    els.status.classList.toggle("error", !!isError);
  }

  function hideStatus() {
    els.status.hidden = true;
  }

  function portraitUrl(citizen) {
    if (citizen.ign) {
      return `https://mc-heads.net/avatar/${encodeURIComponent(citizen.ign)}/64`;
    }
    return "https://mc-heads.net/avatar/MHF_Steve/64";
  }

  function parseRoleList(rolesStr) {
    if (!rolesStr) return [];
    return rolesStr.split(",").map((r) => r.trim()).filter(Boolean);
  }

  function badgeClassFor(index) {
    if (index === 0) return "badge rank-crown";
    if (index === 1) return "badge rank-high";
    return "badge";
  }

  function renderBadges(rolesStr) {
    const list = parseRoleList(rolesStr);
    if (list.length === 0) {
      return `<span class="no-station">unranked citizen</span>`;
    }
    return `<div class="badge-row">${list
      .map((r, i) => `<span class="${badgeClassFor(i)}">${escapeHtml(r)}</span>`)
      .join("")}</div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function displayName(citizen) {
    return citizen.ign || citizen.discord_username || `Unknown (${citizen.discord_id})`;
  }

  function renderTable(list) {
    if (list.length === 0) {
      els.body.innerHTML = "";
      showStatus("No citizens match your search.");
      return;
    }
    hideStatus();
    els.body.innerHTML = list
      .map((c) => {
        return `
        <tr tabindex="0" data-discord-id="${c.discord_id}">
          <td class="col-portrait"><img class="portrait" src="${portraitUrl(c)}" alt="" loading="lazy"></td>
          <td class="col-name">
            <span class="citizen-name">${escapeHtml(displayName(c))}</span>
            <span class="citizen-discord">${escapeHtml(c.discord_username || "")}</span>
          </td>
          <td class="col-station">${renderBadges(c.roles)}</td>
          <td class="col-recruiter">${c.recruited_by ? escapeHtml(c.recruited_by) : "&mdash;"}</td>
          <td class="col-seal">&#10022;</td>
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
    const query = els.search.value.trim().toLowerCase();
    const roleFilter = els.roleFilter.value;

    const filtered = citizens.filter((c) => {
      const name = displayName(c).toLowerCase();
      const matchesSearch = !query || name.includes(query);
      const matchesRole = !roleFilter || parseRoleList(c.roles).includes(roleFilter);
      return matchesSearch && matchesRole;
    });

    renderTable(filtered);
  }

  function populateRoleFilter() {
    els.roleFilter.innerHTML =
      `<option value="">All citizens</option>` +
      roles.map((r) => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join("");
  }

  function updateStats() {
    els.statTotal.textContent = citizens.length;
    const ranked = citizens.filter((c) => parseRoleList(c.roles).length > 0).length;
    els.statRanked.textContent = ranked;

    const latest = citizens.reduce((max, c) => {
      if (!c.updated_at) return max;
      return !max || c.updated_at > max ? c.updated_at : max;
    }, null);
    els.statUpdated.textContent = latest ? formatRelative(latest) : "never";
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
    const roleList = parseRoleList(citizen.roles);
    return `
      <div class="detail-header">
        <img class="detail-portrait" src="${portraitUrl(citizen)}" alt="">
        <div>
          <h2 id="detail-name">${escapeHtml(displayName(citizen))}</h2>
          <p class="detail-sub">${escapeHtml(citizen.discord_username || "")}${
            citizen.timezone ? " &middot; " + escapeHtml(citizen.timezone) : ""
          }</p>
        </div>
      </div>

      <div class="detail-section">
        <h3>Station</h3>
        ${roleList.length ? renderBadges(citizen.roles) : `<p class="detail-empty">Holds no tracked office.</p>`}
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

    const linePath = points.join(" ");

    section.innerHTML = `
      <h3>Activity, last 30 days</h3>
      <svg id="activity-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline points="${linePath}" fill="none" stroke="#c9a227" stroke-width="2" />
        ${points
          .map(
            (p) =>
              `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.5" fill="#c9a227" />`
          )
          .join("")}
      </svg>
    `;
  }

  function closeDetail() {
    els.overlay.hidden = true;
  }

  els.close.addEventListener("click", closeDetail);
  els.overlay.addEventListener("click", (e) => {
    if (e.target === els.overlay) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.overlay.hidden) closeDetail();
  });

  els.search.addEventListener("input", applyFilters);
  els.roleFilter.addEventListener("change", applyFilters);

  async function init() {
    if (!GUILD_ID || GUILD_ID === "YOUR_GUILD_ID_HERE") {
      showStatus("Set GUILD_ID in config.js to load the registry.", true);
      return;
    }

    showStatus("Loading the registry...");

    try {
      const [citizensRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE}/api/citizens?guild_id=${encodeURIComponent(GUILD_ID)}`),
        fetch(`${API_BASE}/api/roles?guild_id=${encodeURIComponent(GUILD_ID)}`),
      ]);

      if (!citizensRes.ok) throw new Error(`Citizens API returned ${citizensRes.status}`);
      if (!rolesRes.ok) throw new Error(`Roles API returned ${rolesRes.status}`);

      citizens = await citizensRes.json();
      roles = await rolesRes.json();

      populateRoleFilter();
      updateStats();
      applyFilters();
    } catch (err) {
      console.error(err);
      showStatus(`Could not reach the registry API. ${err.message}`, true);
    }
  }

  init();
})();
