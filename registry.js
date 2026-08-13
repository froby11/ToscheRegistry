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
    statShown: document.getElementById("stat-shown"),
    statUpdated: document.getElementById("stat-updated"),
    statSorting: document.getElementById("stat-sorting"),
    pagination: document.getElementById("pagination"),
    rankOverlay: document.getElementById("rank-overlay"),
    rankPanel: document.getElementById("rank-panel"),
    rankTitle: document.getElementById("rank-title"),
    rankList: document.getElementById("rank-list"),
    rankApply: document.getElementById("rank-apply"),
    rankCancel: document.getElementById("rank-cancel"),
    rankClose: document.getElementById("rank-close"),
  };

  let citizens = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;
  let sortKey = "name"; // "name" | "activity" | "citystate" | "timezone" | "citizenship" | "other"
  let activitySortAsc = false; // activity defaults to highest-first when first activated
  let rankOrder = []; // current active custom rank order (array of role names, highest first), only meaningful when sortKey isn't "name"

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

  function renderCell(list, emptyClass) {
    if (!list.length) return `<span class="no-role${emptyClass ? " " + emptyClass : ""}">&mdash;</span>`;
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

    const headerWrap = document.createElement("div");
    headerWrap.className = "col-header-wrap";

    const wrap = document.createElement("div");
    wrap.className = "col-dropdown";

    const btn = document.createElement("button");
    btn.className = "col-dropdown-btn";
    btn.type = "button";
    btn.innerHTML = `<span>${escapeHtml(COLUMN_LABELS[key])}</span> <span class="caret">&#9662;</span>`;

    const menu = document.createElement("div");
    menu.className = "col-dropdown-menu";
    menu.hidden = true;

    if (options.length === 0) {
      const empty = document.createElement("p");
      empty.className = "dropdown-empty";
      empty.textContent = "No roles in this category.";
      menu.appendChild(empty);
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

    const rankBtn = document.createElement("button");
    rankBtn.type = "button";
    rankBtn.className = "col-rank-btn";
    rankBtn.title = `Rank ${COLUMN_LABELS[key]} for sorting`;
    rankBtn.innerHTML = "&#8645;";
    rankBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRankOverlay(key);
    });

    headerWrap.appendChild(wrap);
    headerWrap.appendChild(rankBtn);
    th.innerHTML = "";
    th.appendChild(headerWrap);
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".col-dropdown-menu").forEach((m) => (m.hidden = true));
  });

  function updateSortButtonStates() {
    // no-op placeholder kept for callers; rank buttons don't need per-column active styling
  }

  // ------------------------------------------------------------------
  // Rank-order sort overlay
  // ------------------------------------------------------------------

  let rankDraftKey = null;
  let rankDraftOrder = [];

  function openRankOverlay(key) {
    rankDraftKey = key;
    const options = optionsForColumn(key);
    // start from the currently-active order for this column if it was the last one ranked,
    // otherwise default to the natural (alphabetical) option order
    rankDraftOrder = sortKey === key && rankOrder.length ? rankOrder.slice() : options.slice();
    // include any options not yet present (new roles since last ranking)
    options.forEach((opt) => {
      if (!rankDraftOrder.includes(opt)) rankDraftOrder.push(opt);
    });
    // drop any stale entries no longer present
    rankDraftOrder = rankDraftOrder.filter((opt) => options.includes(opt));

    els.rankTitle.textContent = `Rank ${COLUMN_LABELS[key]}`;
    renderRankList();
    els.rankOverlay.hidden = false;
  }

  function renderRankList() {
    if (rankDraftOrder.length === 0) {
      els.rankList.innerHTML = `<p class="detail-empty">No values to rank in this column.</p>`;
      return;
    }
    els.rankList.innerHTML = rankDraftOrder
      .map(
        (opt, i) => `
      <li class="rank-item" draggable="true" data-index="${i}">
        <span class="rank-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
        <span class="rank-position">${i + 1}</span>
        <span class="rank-name">${escapeHtml(opt)}</span>
      </li>`
      )
      .join("");

    let dragFromIndex = null;

    els.rankList.querySelectorAll(".rank-item").forEach((li) => {
      li.addEventListener("dragstart", (e) => {
        dragFromIndex = Number(li.dataset.index);
        li.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        els.rankList.querySelectorAll(".rank-item").forEach((el) => el.classList.remove("drag-over"));
      });

      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        li.classList.add("drag-over");
      });

      li.addEventListener("dragleave", () => {
        li.classList.remove("drag-over");
      });

      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const toIndex = Number(li.dataset.index);
        if (dragFromIndex === null || dragFromIndex === toIndex) return;
        const [moved] = rankDraftOrder.splice(dragFromIndex, 1);
        rankDraftOrder.splice(toIndex, 0, moved);
        renderRankList();
      });
    });
  }

  function closeRankOverlay() {
    els.rankOverlay.hidden = true;
    rankDraftKey = null;
  }

  if (els.rankApply) {
    els.rankApply.addEventListener("click", () => {
      if (!rankDraftKey) return;
      sortKey = rankDraftKey;
      rankOrder = rankDraftOrder.slice();
      if (els.statSorting) els.statSorting.textContent = COLUMN_LABELS[sortKey];
      closeRankOverlay();
      applyFilters(false);
    });
  }
  if (els.rankCancel) els.rankCancel.addEventListener("click", closeRankOverlay);
  if (els.rankClose) els.rankClose.addEventListener("click", closeRankOverlay);
  if (els.rankOverlay) {
    els.rankOverlay.addEventListener("click", (e) => {
      if (e.target === els.rankOverlay) closeRankOverlay();
    });
  }

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

  function formatMinutes(minutes) {
    if (!minutes) return "&mdash;";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

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
          <td class="col-filterable">${renderCell(cat.timezone, "no-timezone")}</td>
          <td class="col-filterable">${renderCell(cat.citizenship)}</td>
          <td class="col-filterable">${renderCell(cat.other)}</td>
          <td class="col-activity">${formatMinutes(c.activity_30d_minutes)}</td>
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

  function sortCitizens(list) {
    const sorted = list.slice();
    const roleColumnKeys = ["citystate", "timezone", "citizenship", "other"];

    sorted.sort((a, b) => {
      if (sortKey === "name") {
        return displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase());
      }
      if (sortKey === "activity") {
        const diff = (a.activity_30d_minutes || 0) - (b.activity_30d_minutes || 0);
        return activitySortAsc ? diff : -diff;
      }
      if (roleColumnKeys.includes(sortKey)) {
        const aValues = valuesForCitizenColumn(a, sortKey);
        const bValues = valuesForCitizenColumn(b, sortKey);
        const aRank = Math.min(
          ...aValues.map((v) => (rankOrder.includes(v) ? rankOrder.indexOf(v) : Infinity)),
          Infinity
        );
        const bRank = Math.min(
          ...bValues.map((v) => (rankOrder.includes(v) ? rankOrder.indexOf(v) : Infinity)),
          Infinity
        );
        if (aRank === bRank) return displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase());
        return aRank - bRank;
      }
      return 0;
    });
    return sorted;
  }

  function applyFilters(resetPage) {
    if (resetPage !== false) currentPage = 1;
    const query = (els.search && els.search.value.trim().toLowerCase()) || "";
    const filtered = citizens.filter((c) => {
      const name = displayName(c).toLowerCase();
      return (!query || name.includes(query)) && citizenPassesFilters(c);
    });
    const sorted = sortCitizens(filtered);
    if (els.statShown) els.statShown.textContent = sorted.length;
    renderTable(sorted);
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

  function buildActivityHeader() {
    const th = document.getElementById("th-activity");
    if (!th) return;
    updateActivityHeaderLabel(th);
    th.addEventListener("click", () => {
      if (sortKey === "activity") {
        activitySortAsc = !activitySortAsc;
      } else {
        sortKey = "activity";
        activitySortAsc = false;
      }
      updateActivityHeaderLabel(th);
      if (els.statSorting) els.statSorting.textContent = "Activity (30d)";
      applyFilters(false);
    });
  }

  function updateActivityHeaderLabel(th) {
    const arrow = sortKey === "activity" ? (activitySortAsc ? " &#9650;" : " &#9660;") : "";
    th.innerHTML = `<button type="button" class="col-sort-btn">Activity (30d)${arrow}</button>`;
  }

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
      buildActivityHeader();
      updateSortButtonStates();

      // Pre-apply a filter if arriving from a map region link, e.g. index.html?citystate=Crari
      const params = new URLSearchParams(window.location.search);
      const presetCitystate = params.get("citystate");
      if (presetCitystate && filters.citystate) {
        const match = optionsForColumn("citystate").find(
          (opt) => opt.toLowerCase() === presetCitystate.toLowerCase()
        );
        if (match) {
          filters.citystate.add(match);
          buildColumnHeader("citystate"); // rebuild so the checkbox shows checked
        }
      }

      updateStats();
      applyFilters();
    } catch (err) {
      console.error(err);
      showStatus(`Could not reach the registry API. ${err.message}`, true);
    }
  }

  init();
})();
