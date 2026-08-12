(function () {
  "use strict";

  const API_BASE = TOSCHE_CONFIG.API_BASE.replace(/\/$/, "");
  const GUILD_ID = TOSCHE_CONFIG.GUILD_ID;

  const els = {
    status: document.getElementById("citizen-status"),
    content: document.getElementById("citizen-content"),
  };

  function showStatus(message, isError) {
    els.status.hidden = false;
    els.status.textContent = message;
    els.status.classList.toggle("error", !!isError);
  }

  function hideStatus() {
    els.status.hidden = true;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function portraitUrl(citizen) {
    if (citizen.ign) return `https://mc-heads.net/renders/body/${encodeURIComponent(citizen.ign)}`;
    return null;
  }

  function headUrl(citizen) {
    if (citizen.ign) return `https://mc-heads.net/avatar/${encodeURIComponent(citizen.ign)}/96`;
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

  function renderActivityChart(activity) {
    if (!activity.length) return `<p class="detail-empty">No activity recorded yet.</p>`;

    const width = 640;
    const height = 160;
    const padding = 16;
    const max = Math.max(...activity.map((a) => a.playtime_minutes || 0), 1);

    const points = activity.map((a, i) => {
      const x = padding + (i / Math.max(activity.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((a.playtime_minutes || 0) / max) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `
      <svg id="activity-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline points="${points.join(" ")}" fill="none" stroke="#c9a227" stroke-width="2" />
        ${points
          .map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="2.5" fill="#c9a227" />`)
          .join("")}
      </svg>
    `;
  }

  function render(citizen) {
    const roles = citizen.roles || [];
    const head = headUrl(citizen);
    const body = portraitUrl(citizen);

    els.content.innerHTML = `
      <div class="citizen-profile">
        <div class="citizen-profile-header">
          ${
            head
              ? `<img class="profile-head" src="${head}" alt="">`
              : `<div class="profile-head portrait-placeholder"></div>`
          }
          <div>
            <h1>${escapeHtml(displayName(citizen))}</h1>
            <p class="detail-sub">${citizen.discord_username ? "@" + escapeHtml(citizen.discord_username) : ""}${
              citizen.timezone ? " &middot; " + escapeHtml(citizen.timezone) : ""
            }</p>
          </div>
        </div>

        ${body ? `<img class="profile-body" src="${body}" alt="">` : ""}

        <div class="detail-section">
          <h3>Station</h3>
          ${roles.length ? `<div class="badge-row">${roles.map(renderBadge).join("")}</div>` : `<p class="detail-empty">Holds no tracked office.</p>`}
        </div>

        <div class="detail-section">
          <h3>Address</h3>
          ${citizen.address ? `<p>${escapeHtml(citizen.address)}</p>` : `<p class="detail-empty">No address on record.</p>`}
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

        <div class="detail-section">
          <h3>Activity, last 30 days</h3>
          ${renderActivityChart(citizen.activity || [])}
        </div>
      </div>
    `;
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const discordId = params.get("id");

    if (!discordId) {
      showStatus("No citizen specified.", true);
      return;
    }
    if (!GUILD_ID || GUILD_ID === "YOUR_GUILD_ID_HERE") {
      showStatus("Set GUILD_ID in config.js to load the registry.", true);
      return;
    }

    showStatus("Loading citizen record...");

    try {
      const res = await fetch(
        `${API_BASE}/api/citizens/${encodeURIComponent(discordId)}?guild_id=${encodeURIComponent(GUILD_ID)}`
      );
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const citizen = await res.json();
      hideStatus();
      render(citizen);
      document.title = `${displayName(citizen)} — The Tosche Registry`;
    } catch (err) {
      console.error(err);
      showStatus(`Could not load this citizen. ${err.message}`, true);
    }
  }

  init();
})();
