/**
 * StyleBook Owner Command Center Controller:
 * Dashboard KPIs, Booking Acceptance/Rejection, Live Queue Terminal, Services CRUD, Staff CRUD, Profile & Settings
 */
const StyleBookOwner = {
  _cachedBizId: null,
  _lastPendingCount: null,
  _dashboardPollInterval: null,
  _bookingsPollInterval: null,

  async getActiveOwnerBizId() {
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return "biz_1";
    if (this._cachedBizId) return this._cachedBizId;

    try {
      const res = await StyleBookAPI.get("/owner/my-business");
      if (res && res.business && res.business.id) {
        this._cachedBizId = res.business.id;
        user.business_id = res.business.id;
        localStorage.setItem("stylebook_user", JSON.stringify(user));
        return res.business.id;
      }
    } catch (e) {}

    return user.business_id || "biz_1";
  },

  renderSidebar() {
    const sidebar = document.getElementById("ownerSidebarMount");
    if (!sidebar) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;

    const path = window.location.pathname.split("/").pop() || "owner-dashboard.html";
    const items = [
      { href: "owner-dashboard.html", icon: "fa-chart-pie", label: "Dashboard" },
      { href: "owner-bookings.html", icon: "fa-calendar-check", label: "Bookings" },
      { href: "owner-queue.html", icon: "fa-users-viewfinder", label: "Live Queue" },
      { href: "owner-services.html", icon: "fa-scissors", label: "Services & Prices" },
      { href: "owner-staff.html", icon: "fa-user-tie", label: "Staff Team" },
      { href: "owner-chat.html", icon: "fa-comments", label: "Customer Chat" },
      { href: "owner-profile.html", icon: "fa-store", label: "Business Profile" },
      { href: "owner-settings.html", icon: "fa-sliders", label: "Settings & Hours" },
    ];

    sidebar.innerHTML = `
      <aside class="owner-sidebar" id="ownerSidebar">
        <a href="owner-dashboard.html" class="brand-logo" style="padding:4px 0 16px 0;display:flex;align-items:center;gap:10px;text-decoration:none;border-bottom:1px solid #1F2937;margin-bottom:14px;">
          <span class="brand-logo-mark">
            ${window.renderStyloraLogoSvg ? window.renderStyloraLogoSvg(36) : ""}
          </span>
          <div class="brand-name-wrap">
            <span class="brand-title brand-title-light" style="font-size:1.15rem;">STYLORA<span class="accent-dot" style="color:#FDE68A;">✦</span></span>
            <span class="brand-tagline brand-tagline-light" style="font-size:0.6rem;">PARTNER COMMAND</span>
          </div>
        </a>
        <div class="owner-sidebar-header" style="display:flex;align-items:center;gap:12px;">
          <img src="${user.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"}" alt="${user.name}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);flex-shrink:0;" />
          <div style="overflow:hidden;">
            <span class="badge badge-verified" style="margin-bottom:4px;font-size:0.7rem;padding:2px 6px;">PARTNER STUDIO</span>
            <strong style="display:block;color:#FFFFFF;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.name}</strong>
            <span style="font-size:0.75rem;color:#9CA3AF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${user.email}</span>
          </div>
        </div>
        ${items
          .map(
            (it) => `
          <a href="${it.href}" class="owner-nav-link ${path === it.href ? "active" : ""}">
            <i class="fa-solid ${it.icon}" style="width:20px;"></i>
            <span>${it.label}</span>
          </a>
        `
          )
          .join("")}
        <div style="margin-top:auto;padding-top:16px;border-top:1px solid #1F2937;">
          <button type="button" class="owner-nav-link" style="width:100%;background:none;border:none;cursor:pointer;color:#FCA5A5;" onclick="StyleBookAuth.logout()">
            <i class="fa-solid fa-right-from-bracket" style="width:20px;"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    `;
  },

  async initOwnerDashboard() {
    const mount = document.getElementById("ownerDashboardMount");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;
    const bizId = await this.getActiveOwnerBizId();

    const renderData = async () => {
      try {
        const [bkgRes, qRes] = await Promise.all([
          StyleBookAPI.get(`/bookings?business_id=${bizId}`),
          StyleBookAPI.get(`/queue/${bizId}`),
        ]);
        const bookings = bkgRes.bookings || [];
        const q = qRes.queue || {};

        const pendingList = bookings.filter((b) => b.status === "PENDING");
        const completedList = bookings.filter((b) => b.status === "COMPLETED");
        const cancelledList = bookings.filter((b) => ["CANCELLED", "REJECTED"].includes(b.status));
        const earnings = completedList.reduce((sum, b) => sum + (b.service_price || 0), 0);

        if (this._lastPendingCount !== null && pendingList.length > this._lastPendingCount) {
          const newest = pendingList[0];
          window.showToast(`🔔 New booking request from ${newest.customer_name}!`, "success");
        }
        this._lastPendingCount = pendingList.length;

        mount.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <img src="${user.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"}" alt="${user.name}" style="width:54px;height:54px;border-radius:50%;object-fit:cover;border:2.5px solid var(--primary);box-shadow:var(--shadow-sm);" />
            <div>
              <h1 style="font-family:var(--font-display);font-size:1.8rem;font-weight:800;line-height:1.2;">Salon Command Center</h1>
              <p style="color:var(--text-muted);margin:0;">Welcome, ${user.name}! Manage incoming requests, live queue tokens, and daily studio revenue.</p>
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <a href="owner-queue.html" class="btn btn-primary"><i class="fa-solid fa-bolt"></i> Open Queue Terminal</a>
            <a href="owner-services.html" class="btn btn-outline"><i class="fa-solid fa-plus"></i> Add Service</a>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-card-label">Total Bookings</span>
            <div class="kpi-card-value">${bookings.length}</div>
            <span style="font-size:0.78rem;color:var(--success);">Real-time count</span>
          </div>
          <div class="kpi-card" style="border-color:var(--warning);">
            <span class="kpi-card-label">Pending Requests</span>
            <div class="kpi-card-value" style="color:var(--warning);">${pendingList.length}</div>
            <span style="font-size:0.78rem;color:var(--text-muted);">Awaiting your action</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-card-label">Current Queue</span>
            <div class="kpi-card-value" style="color:var(--primary);">#${q.now_serving_number || 1} (${q.waiting_count || 0} waiting)</div>
            <span style="font-size:0.78rem;color:var(--text-muted);">Est. wait ${q.estimated_wait_minutes || 0} mins</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-card-label">Completed Earnings</span>
            <div class="kpi-card-value" style="color:var(--success);">₹${earnings.toLocaleString("en-IN")}</div>
            <span style="font-size:0.78rem;color:var(--text-muted);">${completedList.length} services completed</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-card-label">Cancelled / Rejected</span>
            <div class="kpi-card-value">${cancelledList.length}</div>
            <span style="font-size:0.78rem;color:var(--text-muted);">Zero penalty</span>
          </div>
        </div>

        ${
          pendingList.length > 0
            ? `
          <div class="card" style="padding:24px;margin-bottom:28px;border:2px solid var(--warning);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="font-size:1.2rem;font-weight:700;"><i class="fa-solid fa-bell" style="color:var(--warning);"></i> New Booking Requests (${pendingList.length})</h3>
              <span class="badge badge-pending">Action Required</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${pendingList
                .map(
                  (b) => `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;padding:16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--radius-md);">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                      <strong style="font-size:1.05rem;">${b.customer_name}</strong>
                      <span class="mono-num" style="font-size:0.84rem;color:var(--text-muted);">${b.customer_phone}</span>
                      <span class="badge badge-home">${b.booking_type}</span>
                    </div>
                    <div style="font-weight:600;color:var(--primary);">${b.service_name} — <span class="mono-num">₹${b.service_price}</span></div>
                    <div style="font-size:0.84rem;color:var(--text-muted);">Date: ${b.date} at ${b.time} • Specialist: ${b.staff_name} ${b.notes ? "• Notes: " + b.notes : ""}</div>
                  </div>
                  <div style="display:flex;gap:10px;">
                    <button type="button" class="btn btn-success btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'accept', this)"><i class="fa-solid fa-check"></i> ACCEPT & ISSUE TOKEN</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'reject', this)"><i class="fa-solid fa-xmark"></i> REJECT</button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <div class="card" style="padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:1.2rem;font-weight:700;">Upcoming & Recent Bookings</h3>
            <a href="owner-bookings.html" class="btn btn-soft btn-sm">View All Bookings</a>
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Date & Time</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  bookings.length === 0
                    ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No bookings yet. New customer bookings will appear here instantly!</td></tr>`
                    : bookings
                        .slice(0, 12)
                        .map(
                          (b) => `
                  <tr>
                    <td class="mono-num"><strong>${b.queue_number ? "#" + b.queue_number : "—"}</strong></td>
                    <td><strong>${b.customer_name}</strong><div style="font-size:0.78rem;color:var(--text-light);">${b.customer_phone}</div></td>
                    <td>${b.service_name}<div style="font-size:0.76rem;color:var(--text-light);">${b.booking_type}</div></td>
                    <td class="mono-num">${b.date}<br>${b.time}</td>
                    <td class="mono-num"><strong>₹${b.service_price}</strong></td>
                    <td>${window.formatStatusBadge(b.status)}</td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${b.status === "PENDING" ? `<button class="btn btn-success btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'accept', this)">Accept</button><button class="btn btn-danger btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'reject', this)">Reject</button>` : ""}
                        ${b.status === "ACCEPTED" ? `<button class="btn btn-primary btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'start', this)">Start Service</button>` : ""}
                        ${b.status === "SERVING" ? `<button class="btn btn-success btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'complete', this)">Complete</button>` : ""}
                        <a href="owner-chat.html?booking_id=${b.id}" class="btn btn-outline btn-sm">Chat</a>
                      </div>
                    </td>
                  </tr>
                `
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      `;
      } catch (err) {
        mount.innerHTML = `<div class="card" style="padding:24px;color:var(--danger);">${err.message}</div>`;
      }
    };

    await renderData();
    if (!this._dashboardPollInterval) {
      this._dashboardPollInterval = setInterval(renderData, 4500);
    }
  },

  async handleBookingAction(bookingId, action, btnEl) {
    if (btnEl) btnEl.disabled = true;
    try {
      let body = {};
      if (action === "reject") {
        body = { reason: "Selected stylist slot is currently full. Please pick another time." };
      }
      const res = await StyleBookAPI.put(`/bookings/${bookingId}/${action}`, body);
      const b = res.booking;
      if (action === "accept") {
        window.showToast(`Booking Accepted! Issued Queue Token #${b.queue_number}.`, "success");
      } else if (action === "start") {
        window.showToast(`Service started for ${b.customer_name} (Token #${b.queue_number})!`, "success");
      } else if (action === "complete") {
        window.showToast(`Service marked COMPLETED for ${b.customer_name}!`, "success");
      } else {
        window.showToast(`Booking status updated to ${b.status}.`, "info");
      }

      if (document.getElementById("ownerDashboardMount")) this.initOwnerDashboard();
      if (document.getElementById("ownerBookingsMount")) this.initOwnerBookingsPage();
      if (document.getElementById("ownerQueueMount")) this.initOwnerQueuePage();
    } catch (err) {
      window.showToast(err.message, "error");
      if (btnEl) btnEl.disabled = false;
    }
  },

  async initOwnerBookingsPage() {
    const mount = document.getElementById("ownerBookingsMount");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;
    const bizId = await this.getActiveOwnerBizId();

    let currentTab = "ALL";

    const loadTab = async (tab = currentTab) => {
      currentTab = tab;
      try {
        const res = await StyleBookAPI.get(`/bookings?business_id=${bizId}`);
        let list = res.bookings || [];
        if (tab === "PENDING") list = list.filter((b) => b.status === "PENDING");
        else if (tab === "ACCEPTED") list = list.filter((b) => ["ACCEPTED", "SERVING", "WAITING"].includes(b.status));
        else if (tab === "TODAY") list = list.filter((b) => b.date === "2026-09-26" || b.date === new Date().toISOString().split("T")[0]);
        else if (tab === "COMPLETED") list = list.filter((b) => b.status === "COMPLETED");
        else if (tab === "CANCELLED") list = list.filter((b) => ["CANCELLED", "REJECTED", "NO_SHOW"].includes(b.status));

        const tbody = document.getElementById("ownerBookingsTableBody");
        if (!tbody) return;
        if (list.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">No bookings in this tab. New bookings will automatically appear here.</td></tr>`;
          return;
        }
        tbody.innerHTML = list
          .map(
            (b) => `
          <tr>
            <td class="mono-num"><strong>${b.queue_number ? "#" + b.queue_number : "—"}</strong></td>
            <td><strong>${b.customer_name}</strong><div style="font-size:0.78rem;color:var(--text-light);">${b.customer_phone}</div></td>
            <td>${b.service_name}<div style="font-size:0.76rem;color:var(--primary);">${b.booking_type} • ${b.staff_name}</div></td>
            <td class="mono-num">${b.date}<br>${b.time}</td>
            <td class="mono-num"><strong>₹${b.service_price}</strong></td>
            <td>${window.formatStatusBadge(b.status)}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${b.status === "PENDING" ? `<button class="btn btn-success btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'accept', this)">Accept</button><button class="btn btn-danger btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'reject', this)">Reject</button>` : ""}
                ${b.status === "ACCEPTED" ? `<button class="btn btn-primary btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'start', this)">Start</button><button class="btn btn-danger btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'cancel', this)">Cancel</button>` : ""}
                ${b.status === "SERVING" ? `<button class="btn btn-success btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'complete', this)">Complete</button>` : ""}
                <a href="owner-chat.html?booking_id=${b.id}" class="btn btn-outline btn-sm">Chat</a>
              </div>
            </td>
          </tr>
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
        loadTab(btn.dataset.tab);
      });
    });

    await loadTab("ALL");
    if (!this._bookingsPollInterval) {
      this._bookingsPollInterval = setInterval(() => loadTab(currentTab), 4500);
    }
  },

  async initOwnerQueuePage() {
    const mount = document.getElementById("ownerQueueMount");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;
    const bizId = await this.getActiveOwnerBizId();

    const renderTerminal = async () => {
      try {
        const res = await StyleBookAPI.get(`/queue/${bizId}`);
        const q = res.queue || {};
        const list = res.queue_bookings || [];
        const serving = list.find((b) => b.status === "SERVING");
        const waiting = list.filter((b) => b.status !== "SERVING");

        mount.innerHTML = `
          <div class="owner-serving-hero">
            <div>
              <span class="badge" style="background:rgba(16,185,129,0.2);color:#6EE7B7;margin-bottom:8px;">
                <span class="queue-pulse-dot"></span> ${q.is_paused ? "QUEUE PAUSED" : "CURRENTLY SERVING"}
              </span>
              <div class="serving-token-giant">#${q.now_serving_number || 1}</div>
              <h2 style="font-size:1.5rem;margin-top:8px;">${serving ? serving.customer_name : q.now_serving_customer_name || "Station Open"}</h2>
              <p style="color:rgba(255,255,255,0.8);">${serving ? serving.service_name : q.now_serving_service_name || "Ready for Next Guest"}</p>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-lg" onclick="StyleBookOwner.queueCommand('${bizId}', 'next', this)">
                <i class="fa-solid fa-forward-step"></i> START NEXT
              </button>
              <button type="button" class="btn btn-success btn-lg" onclick="StyleBookOwner.queueCommand('${bizId}', 'complete', this)">
                <i class="fa-solid fa-check-double"></i> COMPLETE CURRENT
              </button>
              <button type="button" class="btn btn-outline btn-lg" style="background:rgba(255,255,255,0.1);color:#fff;border-color:rgba(255,255,255,0.25);" onclick="StyleBookOwner.queueCommand('${bizId}', 'pause', this)">
                <i class="fa-solid ${q.is_paused ? "fa-play" : "fa-pause"}"></i> ${q.is_paused ? "RESUME" : "PAUSE"}
              </button>
              <button type="button" class="btn btn-danger btn-lg" onclick="StyleBookOwner.queueCommand('${bizId}', 'skip', this)">
                <i class="fa-solid fa-user-slash"></i> SKIP / NO-SHOW
              </button>
            </div>
          </div>

          <div class="card" style="padding:24px;">
            <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;">Next in Queue (${waiting.length} Waiting • Est. Total Wait: ${q.estimated_wait_minutes || 0} mins)</h3>
            ${
              waiting.length === 0
                ? `<div style="padding:28px;text-align:center;color:var(--text-muted);">No customers waiting in queue right now. Accept pending bookings to add them to the queue!</div>`
                : `<div style="display:flex;flex-direction:column;gap:12px;">
                    ${waiting
                      .map(
                        (b, idx) => `
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border:1px solid var(--border);border-radius:var(--radius-md);background:#FFFFFF;flex-wrap:wrap;gap:12px;">
                        <div style="display:flex;align-items:center;gap:16px;">
                          <div class="mono-num" style="font-size:1.5rem;font-weight:800;color:var(--primary);">#${b.queue_number}</div>
                          <div>
                            <strong style="font-size:1.05rem;">${b.customer_name}</strong>
                            <div style="font-size:0.85rem;color:var(--text-muted);">${b.service_name} (${b.service_duration}m) • Specialist: ${b.staff_name}</div>
                          </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                          <span class="mono-num" style="font-size:0.85rem;color:var(--text-muted);">Est. wait: ${(idx + 1) * 15} mins</span>
                          <button type="button" class="btn btn-primary btn-sm" onclick="StyleBookOwner.handleBookingAction('${b.id}', 'start', this)">Call to Chair Now</button>
                        </div>
                      </div>
                    `
                      )
                      .join("")}
                  </div>`
            }
          </div>
        `;
      } catch (err) {
        window.showToast(err.message, "error");
      }
    };

    this._renderTerminal = renderTerminal;
    await renderTerminal();
  },

  async queueCommand(bizId, cmd, btnEl) {
    if (btnEl) btnEl.disabled = true;
    try {
      await StyleBookAPI.put(`/queue/${bizId}/${cmd}`, {});
      window.showToast(`Queue updated (${cmd.toUpperCase()})!`, "success");
      if (this._renderTerminal) await this._renderTerminal();
    } catch (err) {
      window.showToast(err.message, "error");
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  },

  async initOwnerServicesPage() {
    const mount = document.getElementById("ownerServicesList");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;
    const bizId = await this.getActiveOwnerBizId();

    const loadServices = async () => {
      try {
        const res = await StyleBookAPI.get(`/services?business_id=${bizId}`);
        const list = res.services || [];
        mount.innerHTML = list
          .map(
            (s) => `
          <div class="service-item-row">
            <div>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
                <strong>${s.name}</strong>
                <span class="badge badge-verified">${s.category}</span>
                <span class="badge" style="background:var(--surface-alt);">${s.gender_type.toUpperCase()}</span>
                ${s.home_service_available ? `<span class="badge badge-home">Home Service</span>` : ""}
              </div>
              <p style="font-size:0.85rem;color:var(--text-muted);">${s.description}</p>
              <span class="mono-num" style="font-size:0.8rem;color:var(--text-light);">Duration: ${s.duration} mins</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <strong class="mono-num" style="font-size:1.2rem;">₹${s.price}</strong>
              <button type="button" class="btn btn-danger btn-sm" onclick="StyleBookOwner.deleteServiceItem('${s.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `
          )
          .join("");
      } catch (err) {
        window.showToast(err.message, "error");
      }
    };

    const form = document.getElementById("addServiceForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        try {
          await StyleBookAPI.post("/services", {
            business_id: bizId,
            name: document.getElementById("srvName").value.trim(),
            category: document.getElementById("srvCategory").value,
            gender_type: document.getElementById("srvGender").value,
            price: parseInt(document.getElementById("srvPrice").value, 10),
            duration: parseInt(document.getElementById("srvDuration").value, 10),
            description: document.getElementById("srvDesc").value.trim(),
            available: true,
            home_service_available: document.getElementById("srvHome").checked,
          });
          form.reset();
          window.showToast("New service added to your menu!", "success");
          await loadServices();
        } catch (err) {
          window.showToast(err.message, "error");
        } finally {
          btn.disabled = false;
        }
      });
    }

    this._reloadServices = loadServices;
    await loadServices();
  },

  async deleteServiceItem(srvId) {
    try {
      await StyleBookAPI.delete(`/services/${srvId}`);
      window.showToast("Service removed.", "info");
      if (this._reloadServices) await this._reloadServices();
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  async initOwnerStaffPage() {
    const mount = document.getElementById("ownerStaffGrid");
    if (!mount) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;
    const bizId = await this.getActiveOwnerBizId();

    const loadStaff = async () => {
      try {
        const res = await StyleBookAPI.get(`/staff?business_id=${bizId}`);
        const list = res.staff || [];
        mount.innerHTML = list
          .map(
            (st) => `
          <div class="card" style="padding:20px;text-align:center;">
            <img src="${st.photo}" alt="${st.name}" style="width:84px;height:84px;border-radius:50%;object-fit:cover;margin:0 auto 12px;" />
            <h4 style="font-size:1.08rem;font-weight:700;">${st.name}</h4>
            <span style="color:var(--primary);font-size:0.84rem;font-weight:600;display:block;margin-bottom:6px;">${st.role}</span>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px;">${st.specialization} • ${st.experience}</p>
            <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:12px;">${st.working_days} (${st.working_hours})</div>
            <button type="button" class="btn btn-danger btn-sm btn-block" onclick="StyleBookOwner.deleteStaffMember('${st.id}')">Remove Specialist</button>
          </div>
        `
          )
          .join("");
      } catch (err) {
        window.showToast(err.message, "error");
      }
    };

    const form = document.getElementById("addStaffForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        try {
          await StyleBookAPI.post("/staff", {
            business_id: bizId,
            name: document.getElementById("stfName").value.trim(),
            role: document.getElementById("stfRole").value,
            specialization: document.getElementById("stfSpec").value.trim(),
            experience: document.getElementById("stfExp").value.trim(),
            working_days: document.getElementById("stfDays").value.trim(),
            working_hours: document.getElementById("stfHours").value.trim(),
            photo: document.getElementById("stfPhoto").value.trim(),
            available: true,
          });
          form.reset();
          window.showToast("Staff specialist added!", "success");
          await loadStaff();
        } catch (err) {
          window.showToast(err.message, "error");
        } finally {
          btn.disabled = false;
        }
      });
    }

    this._reloadStaff = loadStaff;
    await loadStaff();
  },

  async deleteStaffMember(id) {
    try {
      await StyleBookAPI.delete(`/staff/${id}`);
      window.showToast("Staff member removed.", "info");
      if (this._reloadStaff) await this._reloadStaff();
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },

  async initOwnerProfileAndSettings() {
    const form = document.getElementById("ownerBusinessForm");
    if (!form) return;
    const user = StyleBookAuth.requireAuth("owner");
    if (!user) return;
    const bizId = await this.getActiveOwnerBizId();

    try {
      const res = await StyleBookAPI.get(`/businesses/${bizId}`);
      const b = res.business;

      const ownerAvatarImg = document.getElementById("ownerAvatarImg");
      const ownerAvatarInput = document.getElementById("ownerAvatar");
      const ownerAvatarFile = document.getElementById("ownerAvatarFile");
      const ownerAvatarBadge = document.getElementById("ownerAvatarStatusBadge");

      if (ownerAvatarImg && user.avatar) {
        ownerAvatarImg.src = user.avatar;
      }
      if (ownerAvatarInput) {
        ownerAvatarInput.value = user.avatar || "";
      }

      if (ownerAvatarFile) {
        ownerAvatarFile.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          if (file && window.StyleBookAuth && window.StyleBookAuth.compressAndSetAvatar) {
            window.StyleBookAuth.compressAndSetAvatar(file, ownerAvatarImg, ownerAvatarInput, ownerAvatarBadge);
          }
        });
      }

      document.querySelectorAll(".preset-avatar-option").forEach((opt) => {
        opt.addEventListener("click", () => {
          const url = opt.dataset.url;
          if (!url) return;
          if (ownerAvatarImg) ownerAvatarImg.src = url;
          if (ownerAvatarInput) ownerAvatarInput.value = url;
          if (ownerAvatarBadge) {
            ownerAvatarBadge.textContent = "Preset Chosen ✓";
            ownerAvatarBadge.style.background = "#EEF2FF";
            ownerAvatarBadge.style.color = "#4F46E5";
          }
          document.querySelectorAll(".preset-avatar-option").forEach((p) => p.classList.remove("active"));
          opt.classList.add("active");
        });
      });

      if (document.getElementById("bizName")) document.getElementById("bizName").value = b.name || "";
      if (document.getElementById("bizCategory")) document.getElementById("bizCategory").value = b.category || "unisex";
      if (document.getElementById("bizPhone")) document.getElementById("bizPhone").value = b.phone || "";
      if (document.getElementById("bizEmail")) document.getElementById("bizEmail").value = b.email || "";
      if (document.getElementById("bizCity")) document.getElementById("bizCity").value = b.city || "Delhi";
      if (document.getElementById("bizAddress")) document.getElementById("bizAddress").value = b.address || "";
      if (document.getElementById("bizHours")) document.getElementById("bizHours").value = b.opening_hours || "09:00 AM - 09:00 PM";
      if (document.getElementById("bizPrice")) document.getElementById("bizPrice").value = b.starting_price || 299;
      if (document.getElementById("bizSeats")) document.getElementById("bizSeats").value = b.seats_available || 2;
      if (document.getElementById("bizAvgTime")) document.getElementById("bizAvgTime").value = b.avg_service_time_min || 20;
      if (document.getElementById("bizDesc")) document.getElementById("bizDesc").value = b.description || "";
      if (document.getElementById("bizHomeService")) document.getElementById("bizHomeService").checked = !!b.home_service_available;
      if (document.getElementById("bizIsOpen")) document.getElementById("bizIsOpen").checked = !!b.is_open;

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        btn.disabled = true;
        try {
          await StyleBookAPI.put(`/businesses/${bizId}`, {
            name: document.getElementById("bizName") ? document.getElementById("bizName").value.trim() : b.name,
            category: document.getElementById("bizCategory") ? document.getElementById("bizCategory").value : b.category,
            phone: document.getElementById("bizPhone") ? document.getElementById("bizPhone").value.trim() : b.phone,
            email: document.getElementById("bizEmail") ? document.getElementById("bizEmail").value.trim() : b.email,
            city: document.getElementById("bizCity") ? document.getElementById("bizCity").value : b.city,
            address: document.getElementById("bizAddress") ? document.getElementById("bizAddress").value.trim() : b.address,
            opening_hours: document.getElementById("bizHours") ? document.getElementById("bizHours").value.trim() : b.opening_hours,
            starting_price: document.getElementById("bizPrice") ? parseInt(document.getElementById("bizPrice").value, 10) : b.starting_price,
            seats_total: b.seats_total || 8,
            seats_available: document.getElementById("bizSeats") ? parseInt(document.getElementById("bizSeats").value, 10) : b.seats_available,
            avg_service_time_min: document.getElementById("bizAvgTime") ? parseInt(document.getElementById("bizAvgTime").value, 10) : b.avg_service_time_min,
            description: document.getElementById("bizDesc") ? document.getElementById("bizDesc").value.trim() : b.description,
            home_service_available: document.getElementById("bizHomeService") ? document.getElementById("bizHomeService").checked : b.home_service_available,
            is_open: document.getElementById("bizIsOpen") ? document.getElementById("bizIsOpen").checked : b.is_open,
          });

          if (ownerAvatarInput && ownerAvatarInput.value && ownerAvatarInput.value !== user.avatar) {
            try {
              const profRes = await StyleBookAPI.put("/auth/profile", { avatar: ownerAvatarInput.value });
              if (profRes && profRes.user) {
                StyleBookAPI.setSession(StyleBookAPI.getToken(), profRes.user);
                this.renderSidebar();
              }
            } catch (err) {}
          }

          window.showToast("Salon profile & settings saved!", "success");
        } catch (err) {
          window.showToast(err.message, "error");
        } finally {
          btn.disabled = false;
        }
      });
    } catch (err) {
      window.showToast(err.message, "error");
    }
  },
};

window.StyleBookOwner = StyleBookOwner;
document.addEventListener("DOMContentLoaded", () => {
  StyleBookOwner.renderSidebar();
  StyleBookOwner.initOwnerDashboard();
  StyleBookOwner.initOwnerBookingsPage();
  StyleBookOwner.initOwnerQueuePage();
  StyleBookOwner.initOwnerServicesPage();
  StyleBookOwner.initOwnerStaffPage();
  StyleBookOwner.initOwnerProfileAndSettings();
});
