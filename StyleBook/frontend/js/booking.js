/**
 * StyleBook Booking Workflow Controller:
 * Pre-booking Live Queue Preview, Service/Staff/Date/Time Selection, Confirmation & Success Receipt
 */
const StyleBookBooking = {
  businesses: [],
  currentBiz: null,

  async initBookingPage() {
    const form = document.getElementById("bookingConfirmForm");
    if (!form) return;

    const user = StyleBookAPI.getCurrentUser();
    if (!user) {
      window.showToast("Please log in to complete a booking.", "info");
      setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 600);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialBizId = params.get("business_id") || "biz_1";
    const initialSrvId = params.get("service_id") || "";
    const initialStaffId = params.get("staff_id") || "";

    const bizSelect = document.getElementById("bkgBusiness");
    const srvSelect = document.getElementById("bkgService");
    const staffSelect = document.getElementById("bkgStaff");
    const dateInput = document.getElementById("bkgDate");
    const timeSelect = document.getElementById("bkgTime");
    const typeSelect = document.getElementById("bkgType");
    const custName = document.getElementById("bkgCustName");
    const custPhone = document.getElementById("bkgCustPhone");
    const addressInput = document.getElementById("bkgAddress");

    if (custName) custName.value = user.name || "";
    if (custPhone) custPhone.value = user.phone || "";
    if (addressInput) addressInput.value = user.location || "Connaught Place, New Delhi";
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    try {
      const allRes = await StyleBookAPI.get("/businesses");
      this.businesses = allRes.businesses || [];
      bizSelect.innerHTML = this.businesses
        .map((b) => `<option value="${b.id}" ${b.id === initialBizId ? "selected" : ""}>${b.name} (${b.city})</option>`)
        .join("");

      await this.loadBusinessForBooking(initialBizId, initialSrvId, initialStaffId);
    } catch (err) {
      window.showToast(err.message, "error");
    }

    bizSelect.addEventListener("change", () => this.loadBusinessForBooking(bizSelect.value));
    [srvSelect, staffSelect, dateInput, timeSelect, typeSelect].forEach((el) => {
      if (el) el.addEventListener("change", () => this.updateSummaryReceipt());
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type='submit']");
      const orig = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Confirming Booking...`;

      try {
        const payload = {
          business_id: bizSelect.value,
          service_id: srvSelect.value,
          staff_id: staffSelect.value || null,
          date: dateInput.value,
          time: timeSelect.value,
          booking_type: typeSelect.value,
          customer_name: custName.value.trim(),
          customer_phone: custPhone.value.trim(),
          address: addressInput.value.trim(),
          notes: document.getElementById("bkgNotes").value.trim(),
        };
        const res = await StyleBookAPI.post("/bookings", payload);
        localStorage.setItem("stylebook_last_booking", JSON.stringify(res.booking));
        window.showToast("Booking request submitted! Status: PENDING", "success");
        setTimeout(() => {
          window.location.href = `booking-success.html?booking_id=${res.booking.id}`;
        }, 450);
      } catch (err) {
        window.showToast(err.message || "Booking could not be completed.", "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = orig;
      }
    });
  },

  async loadBusinessForBooking(bizId, preferredSrvId = "", preferredStaffId = "") {
    const srvSelect = document.getElementById("bkgService");
    const staffSelect = document.getElementById("bkgStaff");
    try {
      const res = await StyleBookAPI.get(`/businesses/${bizId}`);
      this.currentBiz = res.business;
      const services = this.currentBiz.services || [];
      const staff = this.currentBiz.staff || [];

      srvSelect.innerHTML = services
        .map(
          (s) =>
            `<option value="${s.id}" data-price="${s.price}" data-duration="${s.duration}" data-name="${s.name}" ${
              s.id === preferredSrvId ? "selected" : ""
            }>${s.name} — ₹${s.price} (${s.duration} mins)</option>`
        )
        .join("");

      staffSelect.innerHTML =
        `<option value="">Any Available Senior Specialist</option>` +
        staff
          .map(
            (st) =>
              `<option value="${st.id}" ${st.id === preferredStaffId ? "selected" : ""}>${st.name} (${st.role})</option>`
          )
          .join("");

      this.updateSummaryReceipt();
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  updateSummaryReceipt() {
    if (!this.currentBiz) return;
    const srvSelect = document.getElementById("bkgService");
    const opt = srvSelect.options[srvSelect.selectedIndex];
    const price = opt ? opt.dataset.price : this.currentBiz.starting_price;
    const dur = opt ? opt.dataset.duration : 30;
    const srvName = opt ? opt.dataset.name : "Selected Service";
    const dateVal = document.getElementById("bkgDate").value;
    const timeVal = document.getElementById("bkgTime").value;
    const typeVal = document.getElementById("bkgType").value;
    const q = this.currentBiz.queue || { now_serving_number: 18, waiting_count: 3, estimated_wait_minutes: 30 };

    const mount = document.getElementById("bookingSummaryMount");
    if (!mount) return;
    mount.innerHTML = `
      <div style="border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:14px;margin-bottom:14px;">
        <span class="badge" style="background:rgba(16,185,129,0.2);color:#6EE7B7;margin-bottom:6px;">PRE-BOOKING QUEUE CHECK</span>
        <h3 style="font-size:1.25rem;">${this.currentBiz.name}</h3>
        <p style="font-size:0.82rem;color:rgba(255,255,255,0.7);">${this.currentBiz.address}</p>
      </div>

      <div class="queue-metrics-grid">
        <div class="queue-metric-box">
          <div class="queue-metric-val">#${q.now_serving_number}</div>
          <div class="queue-metric-lbl">Now Serving</div>
        </div>
        <div class="queue-metric-box">
          <div class="queue-metric-val">${q.waiting_count}</div>
          <div class="queue-metric-lbl">People Ahead</div>
        </div>
        <div class="queue-metric-box">
          <div class="queue-metric-val">${q.estimated_wait_minutes}m</div>
          <div class="queue-metric-lbl">Est. Wait</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;font-size:0.9rem;margin-top:16px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:rgba(255,255,255,0.7);">Selected Service:</span>
          <strong>${srvName}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:rgba(255,255,255,0.7);">Service Duration:</span>
          <strong class="mono-num">${dur} Minutes</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:rgba(255,255,255,0.7);">Date & Time:</span>
          <strong class="mono-num">${dateVal} • ${timeVal}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:rgba(255,255,255,0.7);">Booking Type:</span>
          <strong>${typeVal}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid rgba(255,255,255,0.18);font-size:1.15rem;">
          <span>Total Payable:</span>
          <strong class="mono-num" style="color:#FDE68A;">₹${price}</strong>
        </div>
      </div>
    `;
  },

  async detectNearestPlace() {
    const btn = document.getElementById("btnDetectNearestPlace");
    const origHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Detecting...`;
    }

    const fallbackLoc = async () => {
      try {
        const res = await StyleBookAPI.get("/location/nearest?query=Connaught Place");
        this.applyDetectedLocation(res);
      } catch (e) {
        window.showToast("Could not detect location. Please type your area.", "info");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      }
    };

    if (!navigator.geolocation) {
      await fallbackLoc();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await StyleBookAPI.get(`/location/nearest?lat=${latitude}&lng=${longitude}`);
          this.applyDetectedLocation(res);
        } catch (e) {
          await fallbackLoc();
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
          }
        }
      },
      async () => {
        window.showToast("GPS permission denied. Using central city landmark.", "info");
        await fallbackLoc();
      },
      { timeout: 7000 }
    );
  },

  applyDetectedLocation(res) {
    if (!res || !res.nearest_place) return;
    const addrInput = document.getElementById("bkgAddress");
    const badge = document.getElementById("nearestPlaceBadge");
    const textEl = document.getElementById("nearestPlaceText");

    if (addrInput) {
      addrInput.value = res.nearest_place;
    }

    if (badge && textEl) {
      badge.style.display = "block";
      const salonNote = res.nearest_business
        ? ` • Nearest Salon: ${res.nearest_business.name} (${res.distance_to_nearest_salon_km || 1} km away)`
        : "";
      textEl.innerHTML = `<strong>📍 Nearest Detected Area:</strong> ${res.nearest_place}${salonNote}`;
    }

    window.showToast(`Nearest place detected: ${res.nearest_place}`, "success");
    this.updateSummaryReceipt();
  },

  _typeDebounce: null,
  onAddressTyped(query) {
    clearTimeout(this._typeDebounce);
    if (!query || query.length < 3) return;
    this._typeDebounce = setTimeout(async () => {
      try {
        const res = await StyleBookAPI.get(`/location/nearest?query=${encodeURIComponent(query)}`);
        if (res && res.nearest_place) {
          const badge = document.getElementById("nearestPlaceBadge");
          const textEl = document.getElementById("nearestPlaceText");
          if (badge && textEl) {
            badge.style.display = "block";
            const salonNote = res.nearest_business
              ? ` • Nearest Salon: ${res.nearest_business.name} (${res.distance_to_nearest_salon_km} km)`
              : "";
            textEl.innerHTML = `<strong>📍 Nearest Area Match:</strong> ${res.nearest_place}${salonNote}`;
          }
        }
      } catch (e) {}
    }, 500);
  },

  openLocationPickerModal() {
    let modal = document.getElementById("areaPickerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "areaPickerModal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;";
      document.body.appendChild(modal);
    }

    const popularAreas = [
      { name: "Connaught Place, Central Delhi", city: "Delhi", lat: 28.6315, lng: 77.2167 },
      { name: "Outer Circle, Connaught Place", city: "Delhi", lat: 28.6328, lng: 77.2197 },
      { name: "Hauz Khas Village & Market", city: "Delhi", lat: 28.5494, lng: 77.2001 },
      { name: "Select Citywalk, Saket", city: "Delhi", lat: 28.5283, lng: 77.2185 },
      { name: "Karol Bagh Main Market", city: "Delhi", lat: 28.6517, lng: 77.1906 },
      { name: "Central Market, Lajpat Nagar", city: "Delhi", lat: 28.5677, lng: 77.2433 },
      { name: "Sector 18 Atta Market", city: "Noida", lat: 28.5708, lng: 77.326 },
      { name: "Sector 62 Electronic City", city: "Noida", lat: 28.6271, lng: 77.3621 },
      { name: "DLF Cyber City & Cyber Hub", city: "Gurugram", lat: 28.4952, lng: 77.089 },
      { name: "Sector 29 Leisure Valley", city: "Gurugram", lat: 28.4682, lng: 77.0632 },
      { name: "Indirapuram Habitat Centre", city: "Ghaziabad", lat: 28.6415, lng: 77.3712 },
      { name: "Hazratganj Main Market", city: "Lucknow", lat: 26.8512, lng: 80.9462 },
      { name: "Gomti Nagar Patrakarpuram", city: "Lucknow", lat: 26.8525, lng: 80.9995 },
      { name: "Civil Lines & Swaroop Nagar", city: "Kanpur", lat: 26.4725, lng: 80.334 },
      { name: "Assi Ghat & Lanka", city: "Varanasi", lat: 25.2912, lng: 82.998 },
      { name: "Civil Lines & MG Marg", city: "Prayagraj", lat: 25.4522, lng: 81.8344 },
    ];

    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:540px;max-height:85vh;overflow-y:auto;padding:24px;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px;">
          <div>
            <h3 style="font-size:1.25rem;font-weight:700;"><i class="fa-solid fa-map-location-dot" style="color:var(--primary);"></i> Select Nearest Place</h3>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Pick an area to find nearest salons and calculate doorstep visit time.</p>
          </div>
          <button type="button" onclick="document.getElementById('areaPickerModal').remove()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-light);">&times;</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr;gap:8px;">
          ${popularAreas
            .map(
              (p) => `
            <div onclick="StyleBookBooking.selectAreaFromModal('${p.name}', ${p.lat}, ${p.lng})" style="padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#FFFFFF;transition:background 0.2s;" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background='#FFFFFF'">
              <div>
                <strong style="font-size:0.9rem;display:block;">${p.name}</strong>
                <span style="font-size:0.75rem;color:var(--text-muted);">${p.city}</span>
              </div>
              <span class="btn btn-sm btn-soft">Select</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  },

  async selectAreaFromModal(placeName, lat, lng) {
    const modal = document.getElementById("areaPickerModal");
    if (modal) modal.remove();
    try {
      const res = await StyleBookAPI.get(`/location/nearest?lat=${lat}&lng=${lng}&query=${encodeURIComponent(placeName)}`);
      this.applyDetectedLocation(res);
    } catch (e) {
      const addrInput = document.getElementById("bkgAddress");
      if (addrInput) addrInput.value = placeName;
    }
  },

  async initBookingSuccessPage() {
    const mount = document.getElementById("bookingSuccessMount");
    if (!mount) return;
    const params = new URLSearchParams(window.location.search);
    const bkgId = params.get("booking_id");

    let bkg = null;
    if (bkgId) {
      try {
        const res = await StyleBookAPI.get(`/bookings/${bkgId}`);
        bkg = res.booking;
      } catch (e) {}
    }
    if (!bkg) {
      try {
        bkg = JSON.parse(localStorage.getItem("stylebook_last_booking"));
      } catch (e) {}
    }

    if (!bkg) {
      mount.innerHTML = `<div class="card" style="padding:36px;text-align:center;">Booking found in your dashboard. <a href="customer-dashboard.html" class="btn btn-primary">Go to Dashboard</a></div>`;
      return;
    }

    mount.innerHTML = `
      <div class="card" style="max-width:640px;margin:36px auto;padding:36px;text-align:center;">
        <div style="width:68px;height:68px;border-radius:50%;background:var(--success-bg);color:var(--success);display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:16px;">
          <i class="fa-solid fa-check"></i>
        </div>
        <span class="badge badge-pending" style="display:inline-flex;margin-bottom:8px;">STATUS: ${bkg.status}</span>
        <h1 style="font-family:var(--font-display);font-size:1.85rem;margin-bottom:8px;">Booking Request Sent!</h1>
        <p style="color:var(--text-muted);margin-bottom:24px;">
          Your request (${bkg.id}) has been sent to <strong>${bkg.business_name}</strong>. As soon as the owner clicks <strong>ACCEPT</strong>, your live queue number will be generated automatically.
        </p>

        <div style="background:var(--surface-alt);border-radius:var(--radius-lg);padding:20px;text-align:left;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.9rem;">
          <div><span style="color:var(--text-light);display:block;">Service</span><strong>${bkg.service_name}</strong></div>
          <div><span style="color:var(--text-light);display:block;">Price & Duration</span><strong class="mono-num">₹${bkg.service_price} (${bkg.service_duration}m)</strong></div>
          <div><span style="color:var(--text-light);display:block;">Date & Time</span><strong class="mono-num">${bkg.date} • ${bkg.time}</strong></div>
          <div><span style="color:var(--text-light);display:block;">Booking Type</span><strong>${bkg.booking_type}</strong></div>
          <div><span style="color:var(--text-light);display:block;">People Ahead</span><strong class="mono-num">${bkg.people_ahead ?? 3} Guests</strong></div>
          <div><span style="color:var(--text-light);display:block;">Estimated Wait</span><strong class="mono-num">~${bkg.estimated_wait ?? 30} mins</strong></div>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <a href="customer-dashboard.html" class="btn btn-primary"><i class="fa-solid fa-gauge-high"></i> Track Live Booking</a>
          <a href="chat.html?booking_id=${bkg.id}" class="btn btn-soft"><i class="fa-solid fa-comments"></i> Chat with Salon</a>
          <a href="owner-login.html" class="btn btn-outline"><i class="fa-solid fa-user-tie"></i> Switch to Owner to Accept</a>
        </div>
      </div>
    `;
  },
};

window.StyleBookBooking = StyleBookBooking;
document.addEventListener("DOMContentLoaded", () => {
  StyleBookBooking.initBookingPage();
  StyleBookBooking.initBookingSuccessPage();
});
