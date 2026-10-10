/**
 * StyleBook Google Maps Integration Controller:
 * Uses Dynamic Library Import + AdvancedMarkerElement + InfoWindow when GOOGLE_MAPS_API_KEY is valid,
 * with automatic graceful fallback to interactive cards & Google Maps Directions links.
 */
const StyleBookMap = {
  businesses: [],
  mapInstance: null,
  markers: [],

  async initMapPage() {
    const mapCanvas = document.getElementById("googleMapCanvas");
    if (!mapCanvas) return;

    const citySelect = document.getElementById("mapCityFilter");
    const catSelect = document.getElementById("mapCategoryFilter");
    const searchInput = document.getElementById("mapSearchInput");
    const myLocBtn = document.getElementById("mapMyLocationBtn");

    await this.fetchBusinesses();

    if (citySelect) citySelect.addEventListener("change", () => this.applyFilters());
    if (catSelect) catSelect.addEventListener("change", () => this.applyFilters());
    if (searchInput) searchInput.addEventListener("input", () => this.applyFilters());
    if (myLocBtn) myLocBtn.addEventListener("click", () => this.centerOnUserLocation());

    const apiKey = (window.STYLEBOOK_CONFIG && window.STYLEBOOK_CONFIG.GOOGLE_MAPS_API_KEY) || "";
    if (!apiKey || apiKey === "YOUR_KEY_HERE") {
      this.renderGracefulMapFallback("Configure GOOGLE_MAPS_API_KEY in frontend/js/config.js or click any salon below to open directly in Google Maps.");
      return;
    }

    try {
      await this.loadGoogleMapsBootstrap(apiKey);
      await this.renderInteractiveGoogleMap();
    } catch (err) {
      this.renderGracefulMapFallback("Interactive map preview switched to instant Google Maps launch mode.");
    }
  },

  async fetchBusinesses() {
    try {
      const res = await StyleBookAPI.get("/businesses/nearby");
      this.businesses = res.businesses || [];
      this.renderSidebarDirectory(this.businesses);
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  loadGoogleMapsBootstrap(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.importLibrary) {
        resolve();
        return;
      }
      window.gm_authFailure = () => {
        this.renderGracefulMapFallback("Google Maps API key restricted or billing inactive — using direct Google Maps Directions mode.");
      };
      try {
        ((g) => {
          var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
          b = b[c] || (b[c] = {});
          var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
            u = () =>
              h ||
              (h = new Promise(async (f, n) => {
                await (a = m.createElement("script"));
                e.set("libraries", [...r] + "");
                for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
                e.set("callback", c + ".maps." + q);
                a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
                d[q] = f;
                a.onerror = () => (h = n(Error(p + " could not load.")));
                m.head.append(a);
              }));
          d[l] ? console.warn(p) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
        })({ key: apiKey, v: "weekly" });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  },

  async renderInteractiveGoogleMap(list = this.businesses) {
    const mapCanvas = document.getElementById("googleMapCanvas");
    if (!mapCanvas) return;

    const { Map, InfoWindow } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

    const center = list.length
      ? { lat: list[0].latitude || 28.6315, lng: list[0].longitude || 77.2167 }
      : { lat: 28.6315, lng: 77.2167 };

    this.mapInstance = new Map(mapCanvas, {
      center,
      zoom: 12,
      mapId: "DEMO_MAP_ID",
    });

    const infoWindow = new InfoWindow();
    this.markers = [];

    list.forEach((b, idx) => {
      const pin = new PinElement({
        glyph: `${idx + 1}`,
        background: "#7C3AED",
        borderColor: "#111827",
        glyphColor: "#FFFFFF",
      });

      const marker = new AdvancedMarkerElement({
        map: this.mapInstance,
        position: { lat: b.latitude, lng: b.longitude },
        title: b.name,
        content: pin.element,
      });

      const q = b.queue || { waiting_count: 2, estimated_wait_minutes: 20 };
      const gmapsLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.name + " " + b.address)}`;

      marker.addListener("gmp-click", () => {
        infoWindow.close();
        infoWindow.setContent(`
          <div style="padding:6px;max-width:250px;font-family:Inter,sans-serif;">
            <strong style="font-size:0.95rem;display:block;margin-bottom:4px;">${b.name}</strong>
            <div style="font-size:0.8rem;color:#4B5563;margin-bottom:6px;">${b.address} (${b.distance_km || 1.2} km)</div>
            <div style="background:#111827;color:#fff;padding:6px 8px;border-radius:6px;font-size:0.76rem;margin-bottom:8px;">
              Queue: ${q.waiting_count} waiting • ~${q.estimated_wait_minutes} min wait
            </div>
            <div style="display:flex;gap:6px;">
              <a href="salon-details.html?id=${b.id}" style="background:#7C3AED;color:#fff;padding:5px 10px;border-radius:6px;font-size:0.78rem;text-decoration:none;font-weight:600;">View Salon</a>
              <a href="${gmapsLink}" target="_blank" rel="noopener" style="border:1px solid #CBD5E1;color:#111827;padding:5px 10px;border-radius:6px;font-size:0.78rem;text-decoration:none;font-weight:600;">Open in Google Maps</a>
            </div>
          </div>
        `);
        infoWindow.open(this.mapInstance, marker);
      });

      this.markers.push(marker);
    });
  },

  renderGracefulMapFallback(reasonText) {
    const mapCanvas = document.getElementById("googleMapCanvas");
    if (!mapCanvas) return;
    mapCanvas.innerHTML = `
      <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:linear-gradient(135deg,#111827 0%,#1E1B4B 100%);color:#FFFFFF;border-radius:var(--radius-lg);">
        <i class="fa-solid fa-map-location-dot" style="font-size:3rem;color:#A78BFA;margin-bottom:14px;"></i>
        <h3 style="font-size:1.35rem;margin-bottom:8px;">Interactive Salon & Parlour Locator</h3>
        <p style="font-size:0.9rem;color:rgba(255,255,255,0.78);max-width:460px;margin-bottom:20px;">${reasonText}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
          <a href="https://www.google.com/maps/search/salons+and+beauty+parlours+near+Connaught+Place+New+Delhi" target="_blank" rel="noopener" class="btn btn-primary">
            <i class="fa-solid fa-up-right-from-square"></i> Open in Google Maps
          </a>
          <button type="button" class="btn btn-outline" style="background:rgba(255,255,255,0.1);color:#fff;border-color:rgba(255,255,255,0.25);" onclick="StyleBookMap.centerOnUserLocation()">
            <i class="fa-solid fa-location-crosshairs"></i> Use My Current Location
          </button>
        </div>
      </div>
    `;
  },

  applyFilters() {
    const city = (document.getElementById("mapCityFilter") && document.getElementById("mapCityFilter").value) || "all";
    const cat = (document.getElementById("mapCategoryFilter") && document.getElementById("mapCategoryFilter").value) || "all";
    const q = ((document.getElementById("mapSearchInput") && document.getElementById("mapSearchInput").value) || "").toLowerCase().trim();

    const filtered = this.businesses.filter((b) => {
      if (city !== "all" && b.city.toLowerCase() !== city.toLowerCase()) return false;
      if (cat !== "all") {
        if (cat === "home" && !b.home_service_available && b.category !== "home") return false;
        if (cat !== "home" && b.category !== cat) return false;
      }
      if (q && !b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q) && !b.city.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    this.renderSidebarDirectory(filtered);
    if (this.mapInstance && filtered.length) {
      this.mapInstance.setCenter({ lat: filtered[0].latitude, lng: filtered[0].longitude });
    }
  },

  renderSidebarDirectory(list) {
    const dirEl = document.getElementById("mapDirectoryList");
    if (!dirEl) return;
    if (list.length === 0) {
      dirEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;">No salons found in this area.</div>`;
      return;
    }
    dirEl.innerHTML = list
      .map((b, i) => {
        const q = b.queue || { waiting_count: 2, estimated_wait_minutes: 20 };
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.name + " " + b.address)}`;
        return `
          <div class="card" style="padding:16px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
              <strong>${i + 1}. ${b.name}</strong>
              <span class="rating-box mono-num">★ ${b.rating}</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px;">
              <i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> ${b.address} • <strong class="mono-num">${b.distance_km || 1.2} km</strong>
            </p>
            <div style="background:#111827;color:#fff;padding:8px 12px;border-radius:8px;font-size:0.78rem;display:flex;justify-content:space-between;margin-bottom:10px;">
              <span>Queue: <strong>${q.waiting_count} waiting</strong></span>
              <span class="mono-num">Wait: <strong>~${q.estimated_wait_minutes} min</strong></span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="salon-details.html?id=${b.id}" class="btn btn-primary btn-sm">View Salon</a>
              <a href="booking.html?business_id=${b.id}" class="btn btn-soft btn-sm">Book</a>
              <a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm"><i class="fa-solid fa-diamond-turn-right"></i> Open in Google Maps</a>
            </div>
          </div>
        `;
      })
      .join("");
  },

  updateNearestPlaceBanner(placeName, nearestBiz, distKm) {
    const banner = document.getElementById("nearestPlaceBanner");
    const titleEl = document.getElementById("nearestPlaceBannerTitle");
    const subEl = document.getElementById("nearestPlaceBannerSub");
    const actionsEl = document.getElementById("nearestPlaceBannerActions");
    if (!banner || !titleEl) return;

    banner.style.display = "block";
    titleEl.textContent = placeName || "Central Locality";
    if (subEl) {
      subEl.textContent = nearestBiz
        ? `Nearest Salon: ${nearestBiz.name} (${distKm || nearestBiz.distance_km || 0.8} km away) • Live wait: ~${nearestBiz.queue?.estimated_wait_minutes || 20} min`
        : "Salons mapped in this area";
    }
    if (actionsEl && nearestBiz) {
      actionsEl.innerHTML = `
        <a href="booking.html?business_id=${nearestBiz.id}" class="btn btn-primary btn-sm"><i class="fa-solid fa-calendar-check"></i> Book at ${nearestBiz.name.split(" ")[0]}</a>
      `;
    }
  },

  centerOnUserLocation() {
    if (!navigator.geolocation) {
      window.showToast("Browser location not available. Select your city from the dropdown.", "info");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        window.showToast("Found your current coordinates! Sorting nearest salons.", "success");
        try {
          const locRes = await StyleBookAPI.get(`/location/nearest?lat=${latitude}&lng=${longitude}`);
          if (locRes && locRes.nearest_place) {
            this.updateNearestPlaceBanner(locRes.nearest_place, locRes.nearest_business, locRes.distance_to_nearest_salon_km);
          }
        } catch (e) {}

        const res = await StyleBookAPI.get(`/businesses/nearby?lat=${latitude}&lng=${longitude}`);
        this.businesses = res.businesses || [];
        this.renderSidebarDirectory(this.businesses);
        if (this.mapInstance) {
          this.mapInstance.setCenter({ lat: latitude, lng: longitude });
          this.mapInstance.setZoom(13);
        }
      },
      () => {
        window.showToast("Location permission denied. Using manual city selector.", "info");
      }
    );
  },
};

window.StyleBookMap = StyleBookMap;
document.addEventListener("DOMContentLoaded", () => StyleBookMap.initMapPage());
