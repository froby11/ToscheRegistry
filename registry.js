(function () {
  "use strict";

  const API_BASE = TOSCHE_CONFIG.API_BASE.replace(/\/$/, "");
  const GUILD_ID = TOSCHE_CONFIG.GUILD_ID;

  const FACTIONS = ["Pichia", "Arkanos", "Crari", "Arkavion", "Floodkeep"];

  function isTimezoneRole(name) {
    return /timezone/i.test(name);
  }

  function isFactionRole(name) {
    return FACTIONS.some((f) => name.toLowerCase().includes(f.toLowerCase()));
  }

  function citizenshipValue(name) {
    const lowered = name.toLowerCase();
    if (lowered.includes("trial citizen")) return "Trial Citizen";
    if (lowered.includes("citizen")) return "Citizen";
    return null;
  }

  function isCitizenshipRole(name) {
    return citizenshipValue(name) !== null;
  }

  function isOtherRole(name) {
    return !isTimezoneRole(name) && !isFactionRole(name) && !isCitizenshipRole(name);
  }

  // Split a citizen's roles into the four registry categories.
  function categorize(rolesArr) {
    const roles = rolesArr || [];
    return {
      citystate: roles.filter((r) => isFactionRole(r.name)),
      timezone: roles.filter((r) => isTimezoneRole(r.name)),
      citizenship: roles.filter((r) => isCitizenshipRole(r.name)),
      other: roles.filter((r) => isOtherRole(r.name)),
    };
  }

  const els = {
    body: document.getElementById("ledger-body"),
    status: document.getElementById("registry-status"),
    search: document.getElementById("search-input"),
    statTotal: document.getElementById("stat-total"),
    statUpdated: document.getElementById("stat-updated"),
    pagination: document.getElementById("pagination"),
  };

  let citizens = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;

  // Per-column filter state: Set of accepted values, or null meaning "everything, no filter yet built"
  const filters = {
    citystate: null,
    timezone: null,
    citizenship: null,
    other: null,
  };

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
    if (citizen.ign) return `https://mc-heads.net/avatar/${encodeURIComponent(citizen.ign)}/64`;
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
    return `<span class="badge" style="background:${bg}4d;color:${fg};border-color:${bg}99">${escapeHtml(
      role.name
    )}</span>`;
  }

  function renderCell(list) {
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

  // ------------------------------------------------------------------
  // Column dropdown filters
  // ------------------------------------------------------------------

  function optionsForColumn(key) {
    const set = new Set();
    citizens.forEach((c) => categorize(c.roles)[key].forEach((r) => set.add(r.name)));
    return Array.from(set).sort();
  }

  function valuesForCitizenColumn(citizen, key) {
    return categorize(citizen.roles)[key].map((r) => r.name);
  }

  const COLUMN_LABELS = {
    citystate: "City-State",
    timezone: "Timezone",
    citizenship: "Citizenship Status",
    other: "Other Roles",
  };

  function buildColumnHeader(key) {
    const th = document.querySelector(`th[data-column="${key}"]`);
    if (!th) return;

    const options = optionsForColumn(key);
    if (filters[key] === null) {
      filters[key] = new Set(); // opt-in: nothing selected = no restriction on this column
    }

    const wrap = document.createElement("div");
    wrap.className = "col-dropdown";

    const btn = document.createElement("button");
    btn.className = "col-dropdown-btn";
    btn.type = "button";
    btn.innerHTML = `${escapeHtml(COLUMN_LABELS[key])} <span class="caret">&#9662;</span>`;

    const menu = document.createElement("div");
    menu.className = "col-dropdown-menu";
    menu.hidden = true;

    if (options.length === 0) {
      menu.innerHTML = `<p class="dropdown-empty">No roles in this category.</p>`;
    } else {
      options.forEach((opt) => {
        const id = `filter-${key}-${opt.replace(/\W+/g, "-")}`;
        const row = document.createElement("label");
        row.className = "dropdown-option";
        row.innerHTML = `
          <input type="checkbox" id="${id}" ${filters[key].has(opt) ? "checked" : ""}>
          <span>${escapeHtml(opt)}</span>
        `;
        row.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) filters[key].add(opt);
          else filters[key].delete(opt);
          applyFilters();
        });
        menu.appendChild(row);
      });
    }

    wrap.addEventListener("click", (e) => e.stopPropagation());

    btn.addEventListener("click", () => {
      document.querySelectorAll(".col-dropdown-menu").forEach((m) => {
        if (m !== menu) m.hidden = true;
      });
      menu.hidden = !menu.hidden;
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    th.innerHTML = "";
    th.appendChild(wrap);
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".col-dropdown-menu").forEach((m) => (m.hidden = true));
  });

  function citizenPassesFilters(citizen) {
    for (const key of Object.keys(filters)) {
      const allowed = filters[key];
      if (!allowed || allowed.size === 0) continue; // nothing selected, no restriction
      const values = valuesForCitizenColumn(citizen, key);
      if (!values.some((v) => allowed.has(v))) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  function renderTable(list) {
    if (!els.body) return;
    if (list.length === 0) {
      els.body.innerHTML = "";
      if (els.pagination) els.pagination.innerHTML = "";
      showStatus("No citizens match your filters.");
      return;
    }
    hideStatus();

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    els.body.innerHTML = pageItems
      .map((c) => {
        const cat = categorize(c.roles);
        return `
        <tr>
          <td class="col-portrait">${portraitCell(c)}</td>
          <td class="col-name">
            <a class="citizen-link" href="citizen.html?id=${encodeURIComponent(c.discord_id)}">
              <span class="citizen-name">${escapeHtml(displayName(c))}</span>
              <span class="citizen-discord">${c.discord_username ? "@" + escapeHtml(c.discord_username) : ""}</span>
            </a>
          </td>
          <td class="col-filterable">${renderCell(cat.citystate)}</td>
          <td class="col-filterable">${renderCell(cat.timezone)}</td>
          <td class="col-filterable">${renderCell(cat.citizenship)}</td>
          <td class="col-filterable">${renderCell(cat.other)}</td>
          <td class="col-address">${c.address ? escapeHtml(c.address) : "&mdash;"}</td>
          <td class="col-recruiter">${c.recruited_by ? escapeHtml(c.recruited_by) : "&mdash;"}</td>
        </tr>`;
      })
      .join("");

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!els.pagination) return;
    if (totalPages <= 1) {
      els.pagination.innerHTML = "";
      return;
    }
    els.pagination.innerHTML = `
      <button id="page-prev" ${currentPage === 1 ? "disabled" : ""}>&larr; Previous</button>
      <button id="page-next" ${currentPage === totalPages ? "disabled" : ""}>Next &rarr;</button>
      <span class="page-indicator">Page ${currentPage} of ${totalPages}</span>
    `;
    const prevBtn = document.getElementById("page-prev");
    const nextBtn = document.getElementById("page-next");
    if (prevBtn) prevBtn.addEventListener("click", () => { currentPage--; applyFilters(false); });
    if (nextBtn) nextBtn.addEventListener("click", () => { currentPage++; applyFilters(false); });
  }

  function applyFilters(resetPage) {
    if (resetPage !== false) currentPage = 1;
    const query = (els.search && els.search.value.trim().toLowerCase()) || "";
    const filtered = citizens.filter((c) => {
      const name = displayName(c).toLowerCase();
      return (!query || name.includes(query)) && citizenPassesFilters(c);
    });
    renderTable(filtered);
  }

  function updateStats() {
    if (els.statTotal) els.statTotal.textContent = citizens.length;
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

      ["citystate", "timezone", "citizenship", "other"].forEach(buildColumnHeader);
      updateStats();
      applyFilters();
    } catch (err) {
      console.error(err);
      showStatus(`Could not reach the registry API. ${err.message}`, true);
    }
  }

  init();
})();
