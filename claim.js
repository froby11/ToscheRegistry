// Depends on claims-config.js being loaded first (defines CLAIM_REGIONS).
(function () {
  "use strict";

  const els = {
    status: document.getElementById("claim-status"),
    content: document.getElementById("claim-content"),
  };

  function showStatus(message, isError) {
    els.status.hidden = false;
    els.status.textContent = message;
    els.status.classList.toggle("error", !!isError);
  }

  function render(regionId, info) {
    const imgSrc = `assets/claims/${regionId}.png`;
    const isCitystate = info.type === "citystate";

    els.content.innerHTML = `
      <div class="claim-detail-header">
        <h1>${info.label}</h1>
        <p class="claim-detail-type">${info.type === "citystate" ? "City-State" : info.type === "territory" ? "Territory" : "Landmark"}</p>
      </div>
      <div class="claim-image-wrap">
        <img class="claim-image" src="${imgSrc}" alt="${info.label}">
      </div>
      ${
        isCitystate
          ? `<a class="claim-citizens-link" href="index.html?citystate=${encodeURIComponent(info.label)}">View citizens of ${info.label} &rarr;</a>`
          : ""
      }
    `;
    document.title = `${info.label} — The Tosche Registry`;
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const regionId = params.get("region");

    if (!regionId || !CLAIM_REGIONS[regionId]) {
      showStatus("Unknown claim.", true);
      return;
    }

    render(regionId, CLAIM_REGIONS[regionId]);
  }

  init();
})();
