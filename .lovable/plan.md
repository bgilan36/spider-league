## Local Leagues on the Heat Map

### 1. Privacy-first location capture at upload
- New `LocationCaptureStep` component shown during upload (right after image selection), default-ON.
- Copy: *"Only your spider's location is stored — never your home address. Locations are fuzzed to ~1 km."*
- Buttons: **Use my location** (primary) / **Skip**.
- Uses `navigator.geolocation` once, then fuzzes coordinates client-side by a random offset up to ~1 km (±~0.009°) before sending. Sets `location_accuracy_m = 1000` so the data model reflects the fuzz.
- Reverse-geocodes via a new edge function `reverse-geocode` (OpenStreetMap Nominatim — no key needed) to get a `city, region, country` string saved into `location_name`.

### 2. Backfill from the spider detail modal
- `SpiderDetailsModal` gains an "Add location" section for owners of spiders missing `latitude`/`longitude`.
- Same one-tap capture flow, same fuzz + reverse-geocode, same copy.

### 3. City leaderboards + Local Legend badge
- DB: parse `location_name` into a normalized `city_key` (lowercased "city, country") via a generated column, indexed.
- New RPC `get_city_leaderboard(p_city_key, p_limit)` returns the top spiders for a city (weekly, scoped to current PT week).
- New RPC `list_cities_with_spiders()` returns cities with ≥3 mapped spiders (for browse/dropdown).
- New page section `CityLeaderboard` rendered on Leaderboard page (and linkable from heatmap popups).
- Weekly cron `award-local-legends` (Sunday 00:05 PT) assigns the **Local Legend** badge to the #1 spider's owner in each city, scoped to that week. Badge seeded once.

### 4. Heat-map UX
- Clicking a heat cluster (lat/lng round-to-grid) opens a popup with the top-power spider in that area (thumbnail, nickname, owner, power, "View city leaderboard" link).
- If global mapped-spider count `< 10`, the heatmap is replaced with a **"Put your city on the map"** CTA card linking to the upload page.

### Technical details

**Migration**
- `ALTER TABLE spiders ADD COLUMN city_key TEXT GENERATED ALWAYS AS (lower(btrim(location_name))) STORED;` plus an index on `city_key` when not null.
- Seed badge: `Local Legend` (criteria `{type: 'local_legend'}`) — awarded via cron, not the generic checker.
- `get_city_leaderboard(p_city_key text, p_limit int)` — security definer, returns ranked spiders for the current PT week.
- `list_cities_with_spiders()` — returns city_key, display_name, spider_count where count ≥ 3.
- `get_top_spider_in_area(p_lat, p_lng, p_radius_deg)` — returns the highest-power spider in a bounding box for cluster popups.

**Edge functions**
- `reverse-geocode` (verify_jwt=false; rate-limited by IP via simple in-memory map; no secrets needed): calls Nominatim, returns `{city, region, country, location_name}`.
- `award-local-legends` (scheduled): computes weekly #1 per city, inserts `user_badges` rows for new winners, idempotent per (week_start, city_key).

**Frontend**
- `src/lib/fuzzLocation.ts` — `fuzzCoords(lat, lng, radiusMeters)`.
- `src/components/LocationCaptureStep.tsx` — reusable, used in upload + modal.
- `src/components/CityLeaderboard.tsx` — table.
- Update `SpiderUpload.tsx` to invoke the step before insert; save `latitude/longitude/location_name/location_accuracy_m`.
- Update `SpiderDetailsModal.tsx` with backfill section for owner.
- Update `SpiderUploadHeatmap.tsx`: gate by global count; add cluster click handler that hits `get_top_spider_in_area` and opens a leaflet popup.

### Out of scope
- Custom map tiles, offline mode, multi-language reverse geocoding, manual city pinning (we accept browser geolocation only).
- No retroactive city assignment for existing spiders without lat/lng — backfill is user-driven via the modal.
