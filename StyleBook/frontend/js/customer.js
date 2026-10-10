/**
 * StyleBook Customer Controller:
 * Handles Home, Explore, Salon Details, Customer Dashboard, My Bookings, Profile & Reviews
 */
const StyleBookCustomer = {
  savedIds: [],

  async loadSavedIds() {
    if (!StyleBookAPI.getToken()) return;
    try {
      const res = await StyleBookAPI.get("/favorites");
      this.savedIds = (res.favorites || []).map((f) => f.business_id);
    } catch (e) {
      this.savedIds = [];
    }
  },

  async initHomePage() {
    const gridNearby = document.getElementById("homeNearbyGrid");
    if (!gridNearby) return;

    await this.loadSavedIds();

    // Onboarding preference selector
    const prefCards = document.querySelectorAll(".type-card");
    const savedPref = localStorage.getItem("stylebook_pref_type") || "all";
    prefCards.forEach((card) => {
      if (card.dataset.type === savedPref) card.classList.add("active");
      card.addEventListener("click", () => {
        prefCards.forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        const selectedType = card.dataset.type;
        localStorage.setItem("stylebook_pref_type", selectedType);
        this.loadHomeSections(selectedType);
      });
    });

    // Hero search
    const heroSearchForm = document.getElementById("heroSearchForm");
    if (heroSearchForm) {
      heroSearchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = document.getElementById("heroSearchInput").value.trim();
        const city = document.getElementById("heroCitySelect").value;
        window.location.href = `explore.html?search=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`;
      });
    }

    const detectLocBtn = document.getElementById("detectLocationBtn");
    if (detectLocBtn) {
      detectLocBtn.addEventListener("click", () => this.detectBrowserLocation());
    }

    await this.loadHomeSections(savedPref === "all" ? null : savedPref);
  },

  detectBrowserLocation() {
    if (!navigator.geolocation) {
      window.showToast("Geolocation is not supported by your browser. Using manual city filter.", "info");
      return;
    }
    window.showToast("Requesting browser location...", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        localStorage.setItem("stylebook_lat", latitude);
        localStorage.setItem("stylebook_lng", longitude);
        window.showToast("Location detected! Showing closest salons.", "success");
        try {
          const res = await StyleBookAPI.get(`/businesses/nearby?lat=${latitude}&lng=${longitude}`);
          const gridNearby = document.getElementById("homeNearbyGrid");
          if (gridNearby && res.businesses) {
            gridNearby.innerHTML = res.businesses
              .slice(0, 6)
              .map((b) => window.renderSalonCard(b, this.savedIds))
              .join("");
          }
        } catch (err) {
          window.showToast(err.message, "error");
        }
      },
      () => {
        window.showToast("Location permission denied. You can search by city manually.", "info");
      }
    );
  },

  async loadHomeSections(preferredCategory = null) {
    const gridNearby = document.getElementById("homeNearbyGrid");
    const gridPopularServices = document.getElementById("homePopularServicesGrid");
    try {
      const catQuery = preferredCategory && preferredCategory !== "all" ? `?category=${preferredCategory}` : "";
      const [bizRes, srvRes] = await Promise.all([
        StyleBookAPI.get(`/businesses${catQuery}`),
        StyleBookAPI.get(`/services${preferredCategory && preferredCategory !== "all" ? `?gender_type=${preferredCategory}` : ""}`),
      ]);

      if (gridNearby) {
        const list = (bizRes.businesses || []).slice(0, 6);
        gridNearby.innerHTML = list.length
          ? list.map((b) => window.renderSalonCard(b, this.savedIds)).join("")
          : `<div class="card" style="padding:28px;grid-column:1/-1;text-align:center;">No salons matched that filter.</div>`;
      }

      if (gridPopularServices) {
        const services = (srvRes.services || []).slice(0, 8);
        gridPopularServices.innerHTML = services
          .map(
            (s) => `
          <div class="card" style="padding:18px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span class="badge badge-verified">${s.category}</span>
                ${s.home_service_available ? `<span class="badge badge-home">Home Available</span>` : ""}
              </div>
              <h4 style="font-size:1rem;font-weight:700;margin-bottom:4px;">${s.name}</h4>
              <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px;">${s.description}</p>
              <div style="font-size:0.8rem;color:var(--text-light);">
                <i class="fa-solid fa-store"></i> ${s.business_name || "Verified Studio"} • <span class="mono-num">${s.duration} mins</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border);">
              <strong class="mono-num" style="font-size:1.1rem;color:var(--dark);">₹${s.price}</strong>
              <a href="booking.html?business_id=${s.business_id}&service_id=${s.id}" class="btn btn-primary btn-sm">Book Service</a>
            </div>
          </div>
        `
          )
          .join("");
      }
    } catch (err) {
      if (gridNearby) {
        gridNearby.innerHTML = `<div class="card" style="padding:24px;grid-column:1/-1;color:var(--danger);">${err.message}</div>`;
      }
    }
  },

  async initExplorePage() {
    const resultsGrid = document.getElementById("exploreResultsGrid");
    if (!resultsGrid) return;

    await this.loadSavedIds();

    const params = new URLSearchParams(window.location.search);
    const searchEl = document.getElementById("filterSearch");
    const cityEl = document.getElementById("filterCity");
    const catEl = document.getElementById("filterCategory");
    const sortEl = document.getElementById("filterSort");
    const ratingEl = document.getElementById("filterRating");
    const priceEl = document.getElementById("filterMaxPrice");
    const openNowEl = document.getElementById("filterOpenNow");
    const homeOnlyEl = document.getElementById("filterHomeService");
    const serviceEl = document.getElementById("filterService");

    if (params.get("search") && searchEl) searchEl.value = params.get("search");
    if (params.get("city") && cityEl) cityEl.value = params.get("city");
    if (params.get("category") && catEl) catEl.value = params.get("category");
    if (params.get("service") && serviceEl) serviceEl.value = params.get("service");

    const runFilter = async () => {
      resultsGrid.innerHTML = `<div class="skeleton" style="height:340px;"></div><div class="skeleton" style="height:340px;"></div><div class="skeleton" style="height:340px;"></div>`;
      const q = new URLSearchParams();
      if (searchEl && searchEl.value.trim()) q.set("search", searchEl.value.trim());
      if (cityEl && cityEl.value !== "all") q.set("city", cityEl.value);
      if (catEl && catEl.value !== "all") q.set("category", catEl.value);
      if (sortEl && sortEl.value) q.set("sort_by", sortEl.value);
      if (ratingEl && ratingEl.value) q.set("min_rating", ratingEl.value);
      if (priceEl && priceEl.value) q.set("max_price", priceEl.value);
      if (openNowEl && openNowEl.checked) q.set("open_now", "true");
      if (homeOnlyEl && homeOnlyEl.checked) q.set("home_service", "true");
      if (serviceEl && serviceEl.value !== "all") q.set("service_name", serviceEl.value);

      try {
        const res = await StyleBookAPI.get(`/businesses?${q.toString()}`);
        const list = res.businesses || [];
        const countEl = document.getElementById("exploreCount");
        if (countEl) countEl.textContent = `${list.length} Verified Salons & Parlours Found`;

        if (list.length === 0) {
          resultsGrid.innerHTML = `
            <div class="card" style="grid-column:1/-1;padding:44px;text-align:center;">
              <i class="fa-solid fa-magnifying-glass" style="font-size:2.2rem;color:var(--primary);margin-bottom:12px;"></i>
              <h3>No salons match those exact filters</h3>
              <p style="color:var(--text-muted);margin:8px 0 18px;">Try clearing a filter or searching across all NCR & UP cities.</p>
              <button type="button" class="btn btn-primary" id="resetFiltersInline">Reset All Filters</button>
            </div>
          `;
          const resetInline = document.getElementById("resetFiltersInline");
          if (resetInline) resetInline.onclick = () => window.location.href = "explore.html";
        } else {
          resultsGrid.innerHTML = list.map((b) => window.renderSalonCard(b, this.savedIds)).join("");
        }
      } catch (err) {
        resultsGrid.innerHTML = `<div class="card" style="padding:24px;grid-column:1/-1;color:var(--danger);">${err.message}</div>`;
      }
    };

    [searchEl, cityEl, catEl, sortEl, ratingEl, priceEl, openNowEl, homeOnlyEl, serviceEl].forEach((el) => {
      if (el) {
        el.addEventListener("change", runFilter);
        if (el.tagName === "INPUT" && el.type === "text") {
          el.addEventListener("input", () => {
            clearTimeout(this._debounce);
            this._debounce = setTimeout(runFilter, 300);
          });
        }
      }
    });

    const resetBtn = document.getElementById("resetExploreFilters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (searchEl) searchEl.value = "";
        if (cityEl) cityEl.value = "all";
        if (catEl) catEl.value = "all";
        if (sortEl) sortEl.value = "nearest";
        if (ratingEl) ratingEl.value = "";
        if (priceEl) priceEl.value = "";
        if (openNowEl) openNowEl.checked = false;
        if (homeOnlyEl) homeOnlyEl.checked = false;
        if (serviceEl) serviceEl.value = "all";
        runFilter();
      });
    }

    runFilter();
  },

  async initSalonDetailsPage() {
    const mount = document.getElementById("salonDetailsMount");
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const bizId = params.get("id") || "biz_1";
    await this.loadSavedIds();

    try {
      const res = await StyleBookAPI.get(`/businesses/${bizId}`);
      const b = res.business;
      const q = b.queue || { now_serving_number: 8, waiting_count: 3, estimated_wait_minutes: 30, seats_available: 2 };
      const img1 = (b.images && b.images[0]) || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=80";
      const img2 = (b.images && b.images[1]) || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80";
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.name + " " + b.address)}`;

      mount.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;padding-top:24px;">
          <div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
              <span class="badge badge-verified"><i class="fa-solid fa-circle-check"></i> Verified Partner</span>
              <span class="badge ${b.is_open ? "badge-open" : "badge-closed"}">${b.is_open ? "Open Now" : "Closed"}</span>
              ${b.home_service_available ? `<span class="badge badge-home"><i class="fa-solid fa-house-chimney-user"></i> Home Service Available</span>` : ""}
              <span class="rating-box mono-num"><i class="fa-solid fa-star"></i> ${b.rating} (${b.review_count} reviews)</span>
            </div>
            <h1 style="font-family:var(--font-display);font-size:2.1rem;font-weight:800;">${b.name}</h1>
            <p style="color:var(--text-muted);font-size:0.95rem;margin-top:4px;">
              <i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> ${b.address} (${b.distance_km || 1.2} km away) • <i class="fa-regular fa-clock"></i> ${b.opening_hours}
            </p>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a href="booking.html?business_id=${b.id}" class="btn btn-primary"><i class="fa-solid fa-calendar-check"></i> Book Now</a>
            <a href="chat.html?business_id=${b.id}" class="btn btn-soft"><i class="fa-solid fa-comments"></i> Chat</a>
            <a href="tel:${b.phone}" class="btn btn-outline"><i class="fa-solid fa-phone"></i> Call</a>
            <a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn btn-outline"><i class="fa-solid fa-diamond-turn-right"></i> Directions</a>
            <button type="button" class="btn btn-outline" onclick="navigator.clipboard && navigator.clipboard.writeText(window.location.href); window.showToast('Salon link copied to clipboard!', 'success');"><i class="fa-solid fa-share-nodes"></i> Share</button>
          </div>
        </div>

        <div class="details-gallery">
          <img src="${img1}" alt="${b.name}" style="width:100%;height:380px;object-fit:cover;" />
          <img src="${img2}" alt="${b.name} interior" style="width:100%;height:380px;object-fit:cover;" />
        </div>

        <div class="details-grid">
          <div>
            <!-- About & Amenities -->
            <div class="card" style="padding:24px;margin-bottom:24px;">
              <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:10px;">About ${b.name}</h2>
              <p style="color:var(--text-muted);margin-bottom:16px;">${b.description}</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${(b.amenities || []).map((a) => `<span class="badge" style="background:var(--surface-alt);color:var(--dark);"><i class="fa-solid fa-check" style="color:var(--success);"></i> ${a}</span>`).join("")}
              </div>
            </div>

            <!-- Services Menu -->
            <div class="card" style="padding:24px;margin-bottom:24px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
                <h2 style="font-size:1.3rem;font-weight:700;">Services & Transparent Pricing (${(b.services || []).length})</h2>
                <span style="font-size:0.84rem;color:var(--text-muted);">Select any service to book immediately</span>
              </div>
              <div>
                ${(b.services || [])
                  .map(
                    (s) => `
                  <div class="service-item-row">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <strong style="font-size:1rem;">${s.name}</strong>
                        <span class="badge badge-verified">${s.category}</span>
                        ${s.home_service_available ? `<span class="badge badge-home">Home Service</span>` : ""}
                      </div>
                      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;">${s.description}</p>
                      <span class="mono-num" style="font-size:0.8rem;color:var(--text-light);"><i class="fa-regular fa-clock"></i> ${s.duration} mins</span>
                    </div>
                    <div style="text-align:right;min-width:130px;">
                      <div class="mono-num" style="font-size:1.2rem;font-weight:700;margin-bottom:6px;">₹${s.price}</div>
                      <a href="booking.html?business_id=${b.id}&service_id=${s.id}" class="btn btn-primary btn-sm">Select & Book</a>
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>

            <!-- Staff Specialists -->
            <div class="card" style="padding:24px;margin-bottom:24px;">
              <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;">Meet Our Senior Stylists & Specialists</h2>
              <div class="cards-grid-4">
                ${(b.staff || [])
                  .map(
                    (st) => `
                  <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;text-align:center;">
                    <img src="${st.photo}" alt="${st.name}" style="width:74px;height:74px;border-radius:50%;object-fit:cover;margin:0 auto 10px;" />
                    <strong style="display:block;">${st.name}</strong>
                    <span style="font-size:0.8rem;color:var(--primary);font-weight:600;display:block;margin-bottom:4px;">${st.role}</span>
                    <span style="font-size:0.78rem;color:var(--text-muted);display:block;margin-bottom:10px;">${st.specialization} • ${st.experience}</span>
                    <a href="booking.html?business_id=${b.id}&staff_id=${st.id}" class="btn btn-soft btn-sm btn-block">Book with ${st.name.split(" ")[0]}</a>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>

            <!-- Verified Customer Reviews -->
            <div class="card" style="padding:24px;">
              <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;">Verified Customer Reviews (${(b.reviews || []).length})</h2>
              <div style="display:flex;flex-direction:column;gap:14px;">
                ${(b.reviews || [])
                  .map(
                    (r) => `
                  <div style="border-bottom:1px solid var(--border);padding-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <img src="${r.customer_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}" alt="${r.customer_name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />
                        <div>
                          <strong style="font-size:0.92rem;display:block;">${r.customer_name}</strong>
                          <span style="font-size:0.76rem;color:var(--text-light);">${r.service_name || "Verified Service"}</span>
                        </div>
                      </div>
                      <span class="rating-box mono-num"><i class="fa-solid fa-star"></i> ${r.rating}.0</span>
                    </div>
                    <p style="font-size:0.9rem;color:var(--text-muted);">${r.comment}</p>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          </div>

          <!-- LIVE QUEUE BOARD (VISIBLE BEFORE BOOKING) -->
          <aside class="queue-live-board">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <span class="badge" style="background:rgba(16,185,129,0.2);color:#6EE7B7;"><span class="queue-pulse-dot"></span> LIVE SALON QUEUE</span>
              <span class="mono-num" style="font-size:0.78rem;color:rgba(255,255,255,0.7);">${q.seats_available || b.seats_available} Seats Open</span>
            </div>
            <h3 style="font-family:var(--font-display);font-size:1.3rem;">Check Queue Before Booking</h3>
            <p style="font-size:0.84rem;color:rgba(255,255,255,0.75);margin-top:4px;">
              Real-time counter updated directly from the salon's terminal.
            </p>

            <div class="queue-metrics-grid">
              <div class="queue-metric-box">
                <div class="queue-metric-val">#${q.now_serving_number}</div>
                <div class="queue-metric-lbl">Now Serving</div>
              </div>
              <div class="queue-metric-box">
                <div class="queue-metric-val">${q.waiting_count}</div>
                <div class="queue-metric-lbl">People Waiting</div>
              </div>
              <div class="queue-metric-box">
                <div class="queue-metric-val">${q.estimated_wait_minutes}m</div>
                <div class="queue-metric-lbl">Est. Wait</div>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:14px;margin-bottom:18px;font-size:0.85rem;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="color:rgba(255,255,255,0.7);">Currently on chair:</span>
                <strong>${q.now_serving_customer_name || "Active Guest"}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:rgba(255,255,255,0.7);">Next Issued Token:</span>
                <strong class="mono-num" style="color:#FDE68A;">#${(q.last_issued_number || 18) + 1}</strong>
              </div>
            </div>

            <a href="booking.html?business_id=${b.id}" class="btn btn-primary btn-lg btn-block" style="margin-bottom:10px;">
              Book & Join Queue Now
            </a>
            <a href="queue.html?business_id=${b.id}" class="btn btn-outline btn-block" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.25);">
              Open Full Live Queue Board
            </a>
          </aside>
        </div>
      `;
    } catch (err) {
      mount.innerHTML = `<div class="card" style="padding:36px;margin-top:24px;text-align:center;color:var(--danger);">${err.message}</div>`;
    }
  },

  async initCustomerDashboard() {
    const mount = document.getElementById("customerDashboardMount");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth("customer");
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        const res = await StyleBookAPI.get("/bookings");
        const bookings = res.bookings || [];
        const activeBooking =
          bookings.find((b) => ["SERVING", "ACCEPTED", "WAITING", "CONFIRMED", "PENDING"].includes(b.status)) ||
          bookings[0];

        const steps = ["PENDING", "ACCEPTED", "WAITING", "SERVING", "COMPLETED"];
        const currentStatus = activeBooking ? activeBooking.status : "PENDING";

        mount.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <img src="${user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}" alt="${user.name}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2.5px solid var(--primary);box-shadow:var(--shadow-sm);" />
              <div>
                <h1 style="font-family:var(--font-display);font-size:1.85rem;font-weight:800;line-height:1.2;">Welcome back, ${user.name}!</h1>
                <p style="color:var(--text-muted);margin:0;">Live booking status, queue position, and salon communications.</p>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <a href="explore.html" class="btn btn-primary"><i class="fa-solid fa-plus"></i> New Booking</a>
              <a href="chat.html?mode=friend" class="btn btn-outline"><i class="fa-solid fa-user-group"></i> Chat with Friends</a>
              <a href="ai-studio.html" class="btn btn-soft"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Style Studio</a>
            </div>
          </div>

          ${
            activeBooking
              ? `
            <div class="card" style="padding:28px;margin-bottom:28px;border:2px solid var(--primary);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
                <div>
                  <span class="badge badge-verified" style="margin-bottom:6px;">LIVE BOOKING TRACKER</span>
                  <h2 style="font-size:1.45rem;font-weight:800;">${activeBooking.service_name}</h2>
                  <p style="color:var(--text-muted);font-size:0.95rem;">
                    <i class="fa-solid fa-store" style="color:var(--primary);"></i> <strong>${activeBooking.business_name}</strong> • ${activeBooking.date} at ${activeBooking.time} (${activeBooking.booking_type})
                  </p>
                </div>
                <div style="text-align:right;">
                  ${window.formatStatusBadge(activeBooking.status)}
                  <div class="mono-num" style="font-size:1.3rem;font-weight:800;margin-top:6px;">₹${activeBooking.service_price}</div>
                </div>
              </div>

              <!-- Live Queue Numbers Box -->
              <div class="queue-metrics-grid" style="background:#111827;padding:18px;border-radius:var(--radius-lg);color:#fff;">
                <div class="queue-metric-box">
                  <div class="queue-metric-val">${activeBooking.queue_number ? "#" + activeBooking.queue_number : "Pending"}</div>
                  <div class="queue-metric-lbl">Your Queue Token</div>
                </div>
                <div class="queue-metric-box">
                  <div class="queue-metric-val">#${activeBooking.business_now_serving || 18}</div>
                  <div class="queue-metric-lbl">Now Serving</div>
                </div>
                <div class="queue-metric-box">
                  <div class="queue-metric-val">${activeBooking.status === "SERVING" ? "Now!" : (activeBooking.people_ahead ?? 2) + " (" + (activeBooking.estimated_wait ?? 25) + "m)"}</div>
                  <div class="queue-metric-lbl">People Ahead & Est. Wait</div>
                </div>
              </div>

              <!-- Step Timeline -->
              <div class="timeline-steps">
                <div class="timeline-step ${["PENDING","ACCEPTED","WAITING","SERVING","COMPLETED"].includes(currentStatus) ? "done" : ""}">1. Booking Requested</div>
                <div class="timeline-step ${["ACCEPTED","WAITING","SERVING","COMPLETED"].includes(currentStatus) ? "done" : currentStatus === "PENDING" ? "current" : ""}">2. Accepted</div>
                <div class="timeline-step ${["ACCEPTED","WAITING"].includes(currentStatus) ? "current" : ["SERVING","COMPLETED"].includes(currentStatus) ? "done" : ""}">3. Waiting in Queue</div>
                <div class="timeline-step ${currentStatus === "SERVING" ? "current" : currentStatus === "COMPLETED" ? "done" : ""}">4. Service Started</div>
                <div class="timeline-step ${currentStatus === "COMPLETED" ? "done current" : ""}">5. Completed</div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border);">
                <span style="font-size:0.82rem;color:var(--text-light);"><i class="fa-solid fa-rotate fa-spin"></i> Auto-updating live queue every 5 seconds</span>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <a href="chat.html?booking_id=${activeBooking.id}" class="btn btn-soft btn-sm"><i class="fa-solid fa-comments"></i> Chat with Salon</a>
                  <a href="queue.html?business_id=${activeBooking.business_id}&booking_id=${activeBooking.id}" class="btn btn-outline btn-sm">Full Queue Screen</a>
                  ${
                    ["PENDING", "ACCEPTED", "WAITING"].includes(activeBooking.status)
                      ? `<button type="button" class="btn btn-danger btn-sm" onclick="StyleBookCustomer.cancelCustomerBooking('${activeBooking.id}')">Cancel Booking</button>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `
              : ""
          }

          <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;">All Recent Bookings (${bookings.length})</h3>
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${bookings
              .map(
                (b) => `
              <div class="card" style="padding:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    ${window.formatStatusBadge(b.status)}
                    ${b.queue_number ? `<span class="badge badge-verified mono-num">Token #${b.queue_number}</span>` : ""}
                    <span class="badge" style="background:var(--surface-alt);">${b.booking_type}</span>
                  </div>
                  <h4 style="font-size:1.08rem;font-weight:700;">${b.service_name}</h4>
                  <p style="font-size:0.88rem;color:var(--text-muted);">${b.business_name} • ${b.date} at ${b.time} • Specialist: ${b.staff_name}</p>
                  ${b.rejection_reason ? `<p style="font-size:0.84rem;color:var(--danger);margin-top:4px;">Reason: ${b.rejection_reason}</p>` : ""}
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <strong class="mono-num" style="font-size:1.15rem;">₹${b.service_price}</strong>
                  <a href="chat.html?booking_id=${b.id}" class="btn btn-outline btn-sm"><i class="fa-solid fa-message"></i> Chat</a>
                  ${
                    b.status === "COMPLETED" && !b.reviewed
                      ? `<button type="button" class="btn btn-primary btn-sm" onclick="StyleBookCustomer.openReviewModal('${b.id}', '${b.business_id}', '${b.business_name.replace(/'/g, "")}')"><i class="fa-solid fa-star"></i> Write Review</button>`
                      : ""
                  }
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `;
      } catch (err) {
        mount.innerHTML = `<div class="card" style="padding:24px;color:var(--danger);">${err.message}</div>`;
      }
    };

    await loadDashboardData();
    this._pollInterval = setInterval(loadDashboardData, 5000);
  },

  async cancelCustomerBooking(bookingId) {
    try {
      await StyleBookAPI.put(`/bookings/${bookingId}/cancel`, {});
      window.showToast("Booking cancelled.", "success");
      if (document.getElementById("customerDashboardMount")) this.initCustomerDashboard();
      if (document.getElementById("myBookingsMount")) this.initMyBookingsPage();
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  openReviewModal(bookingId, businessId, businessName) {
    let modal = document.getElementById("reviewModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "reviewModal";
      modal.style.cssText = "position:fixed;inset:0;background:rgba(17,24,39,0.65);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:480px;padding:28px;">
        <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:6px;">Rate Your Experience</h3>
        <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:18px;">${businessName}</p>
        <form id="submitReviewForm">
          <div class="form-group">
            <label class="form-label">Rating (1 to 5 Stars)</label>
            <select id="revRating" class="form-control">
              <option value="5">★★★★★ (5/5 - Exceptional)</option>
              <option value="4">★★★★☆ (4/5 - Very Good)</option>
              <option value="3">★★★☆☆ (3/5 - Good)</option>
              <option value="2">★★☆☆☆ (2/5 - Fair)</option>
              <option value="1">★☆☆☆☆ (1/5 - Poor)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Your Review</label>
            <textarea id="revComment" class="form-control" rows="3" placeholder="Share how the service, hygiene, and queue accuracy were..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Optional Photo URL</label>
            <input type="url" id="revPhoto" class="form-control" placeholder="https://..." />
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('reviewModal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Review</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById("submitReviewForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        await StyleBookAPI.post("/reviews", {
          booking_id: bookingId,
          business_id: businessId,
          rating: parseInt(document.getElementById("revRating").value, 10),
          comment: document.getElementById("revComment").value.trim(),
          photo: document.getElementById("revPhoto").value.trim(),
        });
        window.showToast("Thank you! Your review is now live.", "success");
        modal.remove();
        if (document.getElementById("customerDashboardMount")) this.initCustomerDashboard();
        if (document.getElementById("myBookingsMount")) this.initMyBookingsPage();
      } catch (err) {
        window.showToast(err.message, "error");
        btn.disabled = false;
      }
    };
  },

  async initMyBookingsPage() {
    const mount = document.getElementById("myBookingsMount");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth();
    if (!user) return;

    const renderList = async (statusFilter = "ALL") => {
      try {
        const res = await StyleBookAPI.get(`/bookings?status=${statusFilter}`);
        const list = res.bookings || [];
        const container = document.getElementById("myBookingsList");
        if (!container) return;
        if (!list.length) {
          container.innerHTML = `<div class="card" style="padding:36px;text-align:center;">No bookings found in this status tab. <a href="explore.html" style="color:var(--primary);font-weight:700;">Explore Salons →</a></div>`;
          return;
        }
        container.innerHTML = list
          .map(
            (b) => `
          <div class="card" style="padding:22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:14px;">
            <div>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                ${window.formatStatusBadge(b.status)}
                ${b.queue_number ? `<span class="badge badge-verified mono-num">Queue #${b.queue_number}</span>` : ""}
                <span class="badge" style="background:var(--surface-alt);">${b.booking_type}</span>
              </div>
              <h3 style="font-size:1.12rem;font-weight:700;">${b.service_name}</h3>
              <p style="font-size:0.9rem;color:var(--text-muted);">${b.business_name} • ${b.date} at ${b.time}</p>
              ${b.status === "ACCEPTED" ? `<p style="font-size:0.84rem;color:var(--primary);font-weight:600;margin-top:4px;">Now Serving: #${b.business_now_serving || 18} • People Ahead: ${b.people_ahead ?? 2} • Est. Wait: ${b.estimated_wait ?? 25} mins</p>` : ""}
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <strong class="mono-num" style="font-size:1.2rem;">₹${b.service_price}</strong>
              <a href="queue.html?business_id=${b.business_id}&booking_id=${b.id}" class="btn btn-soft btn-sm">Track Queue</a>
              <a href="chat.html?booking_id=${b.id}" class="btn btn-outline btn-sm">Chat</a>
              ${
                ["PENDING", "ACCEPTED"].includes(b.status)
                  ? `<button type="button" class="btn btn-danger btn-sm" onclick="StyleBookCustomer.cancelCustomerBooking('${b.id}')">Cancel</button>`
                  : ""
              }
              ${
                b.status === "COMPLETED" && !b.reviewed
                  ? `<button type="button" class="btn btn-primary btn-sm" onclick="StyleBookCustomer.openReviewModal('${b.id}', '${b.business_id}', '${b.business_name.replace(/'/g, "")}')">Rate & Review</button>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("");
      } catch (err) {
        window.showToast(err.message, "error");
      }
    };

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderList(btn.dataset.status);
      });
    });

    renderList("ALL");
  },

  async initProfilePage() {
    const form = document.getElementById("customerProfileForm");
    if (!form) return;
    const user = StyleBookAuth.requireAuth();
    if (!user) return;

    const idEl = document.getElementById("profileFriendId");
    if (idEl) {
      idEl.textContent = `${user.id} • ${user.phone}`;
    }

    window.copyProfileFriendId = function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(user.id);
      }
      window.showToast(`Friend ID copied: ${user.id} (Share with friends to chat!)`, "success");
    };

    document.getElementById("profName").value = user.name || "";
    document.getElementById("profEmail").value = user.email || "";
    document.getElementById("profPhone").value = user.phone || "";
    document.getElementById("profType").value = user.preferred_type || "unisex";
    document.getElementById("profCity").value = user.city || "Delhi";
    document.getElementById("profLocation").value = user.location || "";

    const profAvatarImg = document.getElementById("profAvatarImg");
    const profAvatarInput = document.getElementById("profAvatar");
    const profAvatarFile = document.getElementById("profAvatarFile");
    const profAvatarBadge = document.getElementById("profAvatarStatusBadge");

    if (profAvatarImg && user.avatar) {
      profAvatarImg.src = user.avatar;
    }
    if (profAvatarInput) {
      profAvatarInput.value = user.avatar || "";
    }

    if (profAvatarFile) {
      profAvatarFile.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file && window.StyleBookAuth && window.StyleBookAuth.compressAndSetAvatar) {
          window.StyleBookAuth.compressAndSetAvatar(file, profAvatarImg, profAvatarInput, profAvatarBadge);
        }
      });
    }

    document.querySelectorAll(".preset-avatar-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const url = opt.dataset.url;
        if (!url) return;
        if (profAvatarImg) profAvatarImg.src = url;
        if (profAvatarInput) profAvatarInput.value = url;
        if (profAvatarBadge) {
          profAvatarBadge.textContent = "Preset Chosen ✓";
          profAvatarBadge.style.background = "#EEF2FF";
          profAvatarBadge.style.color = "#4F46E5";
        }
        document.querySelectorAll(".preset-avatar-option").forEach((p) => p.classList.remove("active"));
        opt.classList.add("active");
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type='submit']");
      btn.disabled = true;
      try {
        const res = await StyleBookAPI.put("/auth/profile", {
          name: document.getElementById("profName").value.trim(),
          phone: document.getElementById("profPhone").value.trim(),
          preferred_type: document.getElementById("profType").value,
          city: document.getElementById("profCity").value,
          location: document.getElementById("profLocation").value.trim(),
          avatar: (profAvatarInput && profAvatarInput.value) || undefined,
        });
        StyleBookAPI.setSession(StyleBookAPI.getToken(), res.user);
        window.showToast("Profile updated successfully!", "success");
      } catch (err) {
        window.showToast(err.message, "error");
      } finally {
        btn.disabled = false;
      }
    });

    // Load Saved Salons
    const savedGrid = document.getElementById("savedSalonsGrid");
    if (savedGrid) {
      try {
        const favRes = await StyleBookAPI.get("/favorites");
        const list = favRes.businesses || [];
        savedGrid.innerHTML = list.length
          ? list.map((b) => window.renderSalonCard(b, list.map((x) => x.id))).join("")
          : `<div class="card" style="padding:24px;grid-column:1/-1;text-align:center;color:var(--text-muted);">No saved salons yet. Click the heart icon on any salon to save it here!</div>`;
      } catch (e) {}
    }
  },
};

window.StyleBookCustomer = StyleBookCustomer;
document.addEventListener("DOMContentLoaded", () => {
  StyleBookCustomer.initHomePage();
  StyleBookCustomer.initExplorePage();
  StyleBookCustomer.initSalonDetailsPage();
  StyleBookCustomer.initCustomerDashboard();
  StyleBookCustomer.initMyBookingsPage();
  StyleBookCustomer.initProfilePage();
});
