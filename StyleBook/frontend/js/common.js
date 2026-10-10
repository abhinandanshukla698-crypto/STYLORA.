/**
 * Stylora Common UI Shell: Navbar, Notifications, Toast, Floating AI Assistant, Mobile Bottom Bar
 */
window.renderStyloraLogoSvg = function (size = 38) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="styloraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7C3AED"/>
          <stop offset="50%" stop-color="#EC4899"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
        <linearGradient id="styloraGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FDE68A"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#styloraGrad)"/>
      <rect x="1" y="1" width="42" height="42" rx="11" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <path d="M28 15C26.5 13.5 24.2 12.5 21.5 12.5C17.4 12.5 14.5 15 14.5 18.2C14.5 22.2 19.8 23.2 22.5 24.2C25.8 25.4 28.5 26.8 28.5 30.2C28.5 33.8 25.2 36.2 21 36.2C16.8 36.2 14 34 12.5 32" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15 15L20.5 20.5" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round"/>
      <path d="M33 8.5L34.1 11.4L37 12.5L34.1 13.6L33 16.5L31.9 13.6L29 12.5L31.9 11.4L33 8.5Z" fill="url(#styloraGold)"/>
    </svg>
  `;
};

window.showToast = function (message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon =
    type === "success"
      ? "fa-circle-check"
      : type === "error"
      ? "fa-triangle-exclamation"
      : "fa-bell";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
};

function formatStatusBadge(status) {
  const st = (status || "PENDING").toUpperCase();
  let cls = "badge-pending";
  if (["ACCEPTED", "CONFIRMED", "COMPLETED", "SERVING"].includes(st)) cls = "badge-accepted";
  if (["REJECTED", "CANCELLED", "NO_SHOW"].includes(st)) cls = "badge-rejected";
  return `<span class="badge ${cls}">${st.replace("_", " ")}</span>`;
}
window.formatStatusBadge = formatStatusBadge;

function renderSalonCard(biz, savedIds = []) {
  const q = biz.queue || { now_serving_number: 8, waiting_count: 2, estimated_wait_minutes: 20, seats_available: biz.seats_available || 2 };
  const img = (biz.images && biz.images[0]) || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80";
  const isSaved = savedIds.includes(biz.id);
  const catLabels = {
    men: "Men's Salon",
    women: "Women's Parlour",
    unisex: "Unisex Studio",
    home: "Home Beauty Fleet",
  };

  return `
    <article class="card salon-card" data-biz-id="${biz.id}">
      <div class="salon-card-media">
        <img src="${img}" alt="${biz.name}" loading="lazy" />
        <div class="salon-card-top-badges">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${biz.verified ? `<span class="badge badge-verified"><i class="fa-solid fa-circle-check"></i> Verified</span>` : ""}
            <span class="badge ${biz.is_open ? "badge-open" : "badge-closed"}">${biz.is_open ? "Open Now" : "Closed"}</span>
            ${biz.home_service_available ? `<span class="badge badge-home"><i class="fa-solid fa-house-chimney-user"></i> Home Service</span>` : ""}
          </div>
          <button type="button" class="fav-btn ${isSaved ? "saved" : ""}" onclick="window.toggleFavoriteSalon('${biz.id}', this)" aria-label="Save ${biz.name}">
            <i class="fa-${isSaved ? "solid" : "regular"} fa-heart"></i>
          </button>
        </div>
      </div>

      <div class="live-queue-strip">
        <div>
          <span class="queue-pulse-dot"></span>
          <strong>${q.waiting_count} people in queue</strong>
        </div>
        <div class="mono-num">Approx. wait: <strong>${q.estimated_wait_minutes} min</strong></div>
        <div class="mono-num" style="color:#A7F3D0;">${q.seats_available || biz.seats_available || 2} seats free</div>
      </div>

      <div class="salon-card-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <h3 class="salon-card-title">${biz.name}</h3>
          <span class="rating-box mono-num"><i class="fa-solid fa-star"></i> ${biz.rating} (${biz.review_count})</span>
        </div>

        <div class="salon-card-meta">
          <span><i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> ${biz.city} • <strong class="mono-num">${biz.distance_km || 1.5} km</strong></span>
          <span><i class="fa-solid fa-scissors"></i> ${catLabels[biz.category] || "Unisex Salon"}</span>
        </div>

        <p style="font-size:0.84rem;color:var(--text-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
          ${biz.address} • Hours: ${biz.opening_hours}
        </p>

        <div class="salon-card-footer">
          <div>
            <span style="font-size:0.75rem;color:var(--text-light);display:block;">Starting from</span>
            <strong class="mono-num" style="font-size:1.15rem;color:var(--dark);">₹${biz.starting_price}</strong>
          </div>
          <div style="display:flex;gap:8px;">
            <a href="salon-details.html?id=${biz.id}" class="btn btn-outline btn-sm">View Salon</a>
            <a href="booking.html?business_id=${biz.id}" class="btn btn-primary btn-sm">Book Now</a>
          </div>
        </div>
      </div>
    </article>
  `;
}
window.renderSalonCard = renderSalonCard;

window.toggleFavoriteSalon = async function (businessId, btnEl) {
  const user = StyleBookAPI.getCurrentUser();
  if (!user) {
    window.showToast("Please log in to save salons to your favorites.", "info");
    setTimeout(() => (window.location.href = "login.html"), 700);
    return;
  }
  try {
    const res = await StyleBookAPI.post(`/favorites/${businessId}`, {});
    if (btnEl) {
      btnEl.classList.toggle("saved", res.saved);
      btnEl.innerHTML = `<i class="fa-${res.saved ? "solid" : "regular"} fa-heart"></i>`;
    }
    window.showToast(res.saved ? "Saved to your favorite salons!" : "Removed from saved salons.", "success");
  } catch (err) {
    window.showToast(err.message, "error");
  }
};

function renderHeaderAndNav() {
  const navMount = document.getElementById("siteHeader");
  if (!navMount) return;

  const user = StyleBookAPI.getCurrentUser();
  const path = window.location.pathname.split("/").pop() || "index.html";
  const isOwner = user && user.role === "owner";

  let rightActionsHtml = "";
  if (user) {
    const dashLink = isOwner ? "owner-dashboard.html" : "customer-dashboard.html";
    rightActionsHtml = `
      <div class="notif-wrapper">
        <button type="button" class="notif-bell-btn" id="notifBellBtn" aria-label="Notifications">
          <i class="fa-regular fa-bell"></i>
          <span class="notif-count mono-num" id="notifBadge" style="display:none;">0</span>
        </button>
        <div class="notif-dropdown" id="notifDropdown">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <strong>Notifications</strong>
            <button type="button" class="btn btn-sm btn-soft" onclick="window.markAllNotificationsRead()">Mark all read</button>
          </div>
          <div id="notifList"><div style="padding:20px;text-align:center;color:var(--text-muted);">Loading...</div></div>
        </div>
      </div>
      <a href="${dashLink}" class="btn btn-soft btn-sm" style="display:inline-flex;align-items:center;gap:7px;">
        <img src="${user.avatar || (isOwner ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80" : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80")}" alt="${user.name}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1.5px solid var(--primary);" />
        ${user.name.split(" ")[0]}
      </a>
      <button type="button" class="btn btn-outline btn-sm" onclick="StyleBookAuth.logout()">Logout</button>
    `;
  } else {
    rightActionsHtml = `
      <a href="login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="register.html" class="btn btn-primary btn-sm">Sign Up</a>
      <a href="owner-login.html" class="btn btn-soft btn-sm"><i class="fa-solid fa-store"></i> For Business</a>
    `;
  }

  navMount.innerHTML = `
    <header class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="brand-logo" aria-label="Stylora Home">
          <span class="brand-logo-mark">
            ${window.renderStyloraLogoSvg(38)}
          </span>
          <div class="brand-name-wrap">
            <span class="brand-title">STYLORA<span class="accent-dot">✦</span></span>
            <span class="brand-tagline">SALON & GROOMING</span>
          </div>
        </a>

        <ul class="nav-links" id="mainNavLinks">
          <li><a href="index.html" class="${path === "index.html" ? "active" : ""}">Home</a></li>
          <li><a href="explore.html" class="${path === "explore.html" ? "active" : ""}">Explore</a></li>
          <li><a href="explore.html?category=men">Salons</a></li>
          <li><a href="explore.html?category=women">Parlours</a></li>
          <li><a href="explore.html?category=home">Home Service</a></li>
          <li><a href="ai-studio.html" class="${path === "ai-studio.html" ? "active" : ""}"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--primary);"></i> AI Style Studio</a></li>
          <li><a href="map.html" class="${path === "map.html" ? "active" : ""}">Map</a></li>
          <li><a href="${isOwner ? "owner-bookings.html" : "my-bookings.html"}" class="${path.includes("bookings") ? "active" : ""}">My Bookings</a></li>
        </ul>

        <div class="nav-actions">
          ${rightActionsHtml}
          <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Toggle Menu">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>
    </header>
  `;

  const mobileBtn = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("mainNavLinks");
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener("click", () => {
      navLinks.classList.toggle("mobile-open");
    });
  }

  const bellBtn = document.getElementById("notifBellBtn");
  const dropdown = document.getElementById("notifDropdown");
  if (bellBtn && dropdown) {
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => dropdown.classList.remove("open"));
    loadNotifications();
  }

  renderMobileBottomBar(user, path);
  renderFloatingAIAssistant();
}

let _lastSeenNotifIds = new Set();
let _notifPollInitialized = false;

async function loadNotifications() {
  if (!StyleBookAPI.getToken()) return;
  try {
    const res = await StyleBookAPI.get("/notifications");
    const badge = document.getElementById("notifBadge");
    const list = document.getElementById("notifList");
    if (badge) {
      if (res.unread_count > 0) {
        badge.style.display = "inline-flex";
        badge.textContent = res.unread_count;
      } else {
        badge.style.display = "none";
      }
    }

    const notifs = res.notifications || [];

    // Detect new incoming unread notifications to alert user with toast
    if (_notifPollInitialized) {
      notifs.forEach((n) => {
        if (!n.read && !_lastSeenNotifIds.has(n.id)) {
          window.showToast(`🔔 ${n.title}: ${n.message}`, "info");
        }
      });
    }
    _lastSeenNotifIds = new Set(notifs.map((n) => n.id));
    _notifPollInitialized = true;

    if (list) {
      if (notifs.length === 0) {
        list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">No notifications yet.</div>`;
      } else {
        list.innerHTML = notifs
          .map(
            (n) => `
          <div class="notif-item ${n.read ? "" : "unread"}" onclick="window.handleNotifClick('${n.id}', '${n.booking_id || ""}', '${n.type || ""}')">
            <div style="font-weight:600;color:var(--dark);margin-bottom:2px;">${n.title}</div>
            <div style="color:var(--text-muted);font-size:0.82rem;">${n.message}</div>
          </div>
        `
          )
          .join("");
      }
    }
  } catch (e) {
    // Silent ignore when logged out
  }
}

window.handleNotifClick = async function (id, bookingId, notifType) {
  try {
    await StyleBookAPI.put(`/notifications/${id}/read`, {});
    loadNotifications();
    const user = StyleBookAPI.getCurrentUser();
    if (notifType === "friend_chat" || notifType === "friend_request") {
      window.location.href = user && user.role === "owner" ? "owner-chat.html?mode=friend" : "chat.html?mode=friend";
    } else if (bookingId) {
      window.location.href = user && user.role === "owner" ? "owner-bookings.html" : "customer-dashboard.html";
    }
  } catch (e) {}
};

window.markAllNotificationsRead = async function () {
  try {
    await StyleBookAPI.put("/notifications/all/read", {});
    loadNotifications();
  } catch (e) {}
};

function renderMobileBottomBar(user, path) {
  if (document.getElementById("mobileBottomNav")) return;
  const nav = document.createElement("nav");
  nav.id = "mobileBottomNav";
  nav.className = "mobile-bottom-nav";

  if (user && user.role === "owner") {
    nav.innerHTML = `
      <a href="owner-dashboard.html" class="mobile-nav-item ${path === "owner-dashboard.html" ? "active" : ""}"><i class="fa-solid fa-chart-line"></i><span>Dashboard</span></a>
      <a href="owner-bookings.html" class="mobile-nav-item ${path === "owner-bookings.html" ? "active" : ""}"><i class="fa-solid fa-calendar-check"></i><span>Bookings</span></a>
      <a href="owner-queue.html" class="mobile-nav-item ${path === "owner-queue.html" ? "active" : ""}"><i class="fa-solid fa-users-line"></i><span>Queue</span></a>
      <a href="owner-chat.html" class="mobile-nav-item ${path === "owner-chat.html" ? "active" : ""}"><i class="fa-solid fa-comments"></i><span>Chat</span></a>
      <a href="owner-profile.html" class="mobile-nav-item ${path === "owner-profile.html" ? "active" : ""}"><i class="fa-solid fa-store"></i><span>Profile</span></a>
    `;
  } else {
    nav.innerHTML = `
      <a href="index.html" class="mobile-nav-item ${path === "index.html" ? "active" : ""}"><i class="fa-solid fa-house"></i><span>Home</span></a>
      <a href="explore.html" class="mobile-nav-item ${path === "explore.html" ? "active" : ""}"><i class="fa-solid fa-compass"></i><span>Explore</span></a>
      <a href="my-bookings.html" class="mobile-nav-item ${path.includes("booking") || path === "customer-dashboard.html" ? "active" : ""}"><i class="fa-solid fa-calendar-days"></i><span>Bookings</span></a>
      <a href="chat.html" class="mobile-nav-item ${path === "chat.html" ? "active" : ""}"><i class="fa-solid fa-message"></i><span>Chat</span></a>
      <a href="profile.html" class="mobile-nav-item ${path === "profile.html" ? "active" : ""}"><i class="fa-solid fa-user"></i><span>Profile</span></a>
    `;
  }
  document.body.appendChild(nav);
}

function renderFloatingAIAssistant() {
  if (document.getElementById("floatingAiBtn")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button type="button" class="floating-ai-btn" id="floatingAiBtn" aria-label="Ask Stylora AI">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <span>Ask Stylora AI</span>
    </button>

    <div class="floating-ai-panel" id="floatingAiPanel" role="dialog" aria-label="Stylora AI Assistant">
      <div class="floating-ai-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <i class="fa-solid fa-wand-magic-sparkles" style="color:#FDE68A;"></i>
          <div>
            <strong style="display:block;font-size:0.95rem;">Stylora AI Concierge</strong>
            <span style="font-size:0.74rem;color:rgba(255,255,255,0.75);">Live Queue, Pricing & Style Advisor</span>
          </div>
        </div>
        <button type="button" id="closeFloatingAi" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.1rem;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="floating-ai-body" id="floatingAiMessages">
        <div class="chat-bubble received" style="max-width:92%;">
          Hi! Ask me anything: <em>"Which salon has less queue?"</em>, <em>"What haircut suits an oval face?"</em>, or <em>"How much is a haircut?"</em>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="quick-reply-chip" onclick="window.askFloatingAI('Which salon has less queue?')">Fastest queue?</button>
          <button type="button" class="quick-reply-chip" onclick="window.askFloatingAI('What haircut should I get?')">Haircut advice</button>
          <button type="button" class="quick-reply-chip" onclick="window.askFloatingAI('How much is haircut and facial?')">Pricing guide</button>
        </div>
      </div>

      <form class="floating-ai-footer" id="floatingAiForm">
        <input type="text" class="form-control" id="floatingAiInput" placeholder="Ask about styles, queues, prices..." required />
        <button type="submit" class="btn btn-primary btn-sm"><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>
  `;
  document.body.appendChild(wrap);

  const btn = document.getElementById("floatingAiBtn");
  const panel = document.getElementById("floatingAiPanel");
  const closeBtn = document.getElementById("closeFloatingAi");
  const form = document.getElementById("floatingAiForm");

  btn.addEventListener("click", () => panel.classList.toggle("open"));
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("floatingAiInput");
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    await window.askFloatingAI(q);
  });
}

window.askFloatingAI = async function (question) {
  const panel = document.getElementById("floatingAiPanel");
  if (panel && !panel.classList.contains("open")) panel.classList.add("open");

  const box = document.getElementById("floatingAiMessages");
  if (!box) return;

  box.innerHTML += `<div class="chat-bubble sent">${question}</div>`;
  const loadingId = "ai_load_" + Date.now();
  box.innerHTML += `<div class="chat-bubble received" id="${loadingId}"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking live salon queues & styles...</div>`;
  box.scrollTop = box.scrollHeight;

  try {
    const res = await StyleBookAPI.post("/ai/chat", { message: question });
    const formatted = (res.reply || "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
    let recHtml = "";
    if (res.recommendations && res.recommendations.length) {
      recHtml = `<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">` +
        res.recommendations.map(r => `<a href="${r.link}" style="display:block;padding:8px 10px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;font-size:0.8rem;"><strong style="color:var(--primary);display:block;">${r.title} →</strong><span>${r.subtitle}</span></a>`).join("") +
        `</div>`;
    }
    const loader = document.getElementById(loadingId);
    if (loader) loader.innerHTML = `${formatted}${recHtml}`;
  } catch (err) {
    const loader = document.getElementById(loadingId);
    if (loader) loader.innerHTML = "AI service is currently using instant local recommendations. Try exploring Royale Crown Atelier (35m wait) or Velvet Rose Studio!";
  }
  box.scrollTop = box.scrollHeight;
};

function renderFooter() {
  const footerMount = document.getElementById("siteFooter");
  if (!footerMount) return;
  footerMount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="brand-logo" style="color:#FFFFFF;margin-bottom:12px;">
              <span class="brand-logo-mark">
                ${window.renderStyloraLogoSvg(38)}
              </span>
              <div class="brand-name-wrap">
                <span class="brand-title brand-title-light">STYLORA<span class="accent-dot" style="color:#FDE68A;">✦</span></span>
                <span class="brand-tagline brand-tagline-light">LIVE QUEUE & STUDIOS</span>
              </div>
            </div>
            <p style="font-size:0.9rem;color:#9CA3AF;max-width:340px;margin-bottom:16px;">
              Look Good. Feel Great. India's premier real-time salon, beauty parlour, unisex studio & doorstep beauty booking platform with transparent live queue tracking.
            </p>
            <div style="font-size:0.82rem;color:#A78BFA;">
              Delhi • Noida • Gurugram • Ghaziabad • Lucknow • Kanpur • Varanasi • Prayagraj
            </div>
          </div>

          <div>
            <h4 class="footer-title">Discover</h4>
            <ul class="footer-links">
              <li><a href="explore.html?category=men">Men's Salons</a></li>
              <li><a href="explore.html?category=women">Women's Beauty Parlours</a></li>
              <li><a href="explore.html?category=unisex">Unisex Studios</a></li>
              <li><a href="explore.html?category=home">Home Beauty Services</a></li>
              <li><a href="map.html">Live Salon Map</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-title">Smart Features</h4>
            <ul class="footer-links">
              <li><a href="ai-studio.html">AI Style Studio</a></li>
              <li><a href="queue.html">Live Queue Tracker</a></li>
              <li><a href="customer-dashboard.html">Customer Dashboard</a></li>
              <li><a href="my-bookings.html">My Bookings</a></li>
              <li><a href="chat.html">Direct Salon Chat</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-title">For Salon Partners</h4>
            <ul class="footer-links">
              <li><a href="owner-login.html">Partner Login</a></li>
              <li><a href="owner-register.html">Register Your Salon</a></li>
              <li><a href="owner-dashboard.html">Owner Command Center</a></li>
              <li><a href="owner-queue.html">Queue Terminal</a></li>
            </ul>
          </div>
        </div>
        <div style="border-top:1px solid #1F2937;padding-top:24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:0.84rem;color:#6B7280;">
          <span>© 2026 Stylora Technologies Pvt. Ltd. All rights reserved.</span>
          <span>Zero waiting room surprises • Live Queue Verified</span>
        </div>
      </div>
    </footer>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeaderAndNav();
  renderFooter();
  loadNotifications();
  setInterval(loadNotifications, 5000);
});
