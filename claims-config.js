// EDIT THIS: the single source of truth for claim names/types, shared by
// claims.html (the map) and claim.html (the per-claim detail page).
//
// type: "citystate" links through to the Citizens registry pre-filtered by
// that City-State. type: "territory" and type: "landmark" don't link to
// citizens since there's no backing data for them yet.
const CLAIM_REGIONS = {
  "region-1-north": { label: "Crari", type: "citystate" },
  "region-2-outpost": { label: "Crari Bank", type: "territory" },
  "region-3-west": { label: "Arkanos", type: "citystate" },
  "region-4-southcenter": { label: "Arkavion", type: "citystate" },
  "region-5-east": { label: "Floodkeep", type: "citystate" },
  "region-6-obelisk": { label: "Pichia", type: "citystate" },
};
