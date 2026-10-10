/**
 * StyleBook Live Queue Tracker Page Controller
 * Polls backend every 4 seconds for real-time queue progression
 */
const StyleBookQueue = {
  currentBusinessId: "biz_1",

  async initQueuePage() {
    const mount = document.getElementById("liveQueueMount");
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    this.currentBusinessId = params.get("business_id") || "biz_1";

    const bizSelector = document.getElementById("queueBusinessSelect");
    if (bizSelector) {
      try {
        const allRes = await StyleBookAPI.get("/businesses");
        bizSelector.innerHTML = (allRes.businesses || [])
          .map(
            (b) =>
              `<option value="${b.id}" ${b.id === this.currentBusinessId ? "selected" : ""}>${b.name} (${b.city})</option>`
          )
          .join("");
        bizSelector.addEventListener("change", () => {
          this.currentBusinessId = bizSelector.value;
          this.refreshQueueBoard();
        });
      } catch (e) {}
    }

    await this.refreshQueueBoard();
    setInterval(() => this.refreshQueueBoard(), 4000);
  },

  async refreshQueueBoard() {
    const mount = document.getElementById("liveQueueMount");
    if (!mount) return;
    try {
      const [qRes, bizRes] = await Promise.all([
        StyleBookAPI.get(`/queue/${this.currentBusinessId}`),
        StyleBookAPI.get(`/businesses/${this.currentBusinessId}`),
      ]);
      const q = qRes.queue;
      const list = qRes.queue_bookings || [];
      const biz = bizRes.business;

      mount.innerHTML = `
        <div class="owner-serving-hero">
          <div>
            <span class="badge" style="background:rgba(16,185,129,0.2);color:#6EE7B7;margin-bottom:8px;">
              <span class="queue-pulse-dot"></span> ${q.is_paused ? "QUEUE PAUSED" : "LIVE TELEMETRY • ACTIVE"}
            </span>
            <h2 style="font-family:var(--font-display);font-size:1.8rem;">${biz.name}</h2>
            <p style="color:rgba(255,255,255,0.78);font-size:0.92rem;">${biz.address} • Avg. service duration: <span class="mono-num">${q.avg_service_duration} mins</span></p>
          </div>

          <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;">
            <div style="text-align:center;background:rgba(255,255,255,0.1);padding:16px 24px;border-radius:var(--radius-lg);">
              <span style="font-size:0.75rem;text-transform:uppercase;color:rgba(255,255,255,0.75);display:block;">Now Serving</span>
              <div class="serving-token-giant">#${q.now_serving_number}</div>
              <span style="font-size:0.82rem;color:#A7F3D0;">${q.now_serving_customer_name || "Active Client"}</span>
            </div>

            <div style="text-align:center;background:rgba(255,255,255,0.08);padding:16px 22px;border-radius:var(--radius-lg);">
              <span style="font-size:0.75rem;text-transform:uppercase;color:rgba(255,255,255,0.75);display:block;">Waiting in Line</span>
              <div class="mono-num" style="font-size:2.2rem;font-weight:800;">${q.waiting_count}</div>
              <span class="mono-num" style="font-size:0.82rem;color:#FDE68A;">~${q.estimated_wait_minutes} min wait</span>
            </div>
          </div>
        </div>

        <div class="card" style="padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
            <h3 style="font-size:1.2rem;font-weight:700;">Live Queue Lineup (${list.length} Tokens Active)</h3>
            <a href="booking.html?business_id=${biz.id}" class="btn btn-primary btn-sm">Join This Queue</a>
          </div>

          ${
            list.length === 0
              ? `<div style="padding:28px;text-align:center;color:var(--text-muted);">Zero wait! All chairs are immediately open. Book now for instant service.</div>`
              : `<div style="display:flex;flex-direction:column;gap:12px;">
                  ${list
                    .map(
                      (item, idx) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-radius:var(--radius-md);border:1px solid ${
                      item.status === "SERVING" ? "var(--success)" : "var(--border)"
                    };background:${item.status === "SERVING" ? "#ECFDF5" : "#FFFFFF"};">
                      <div style="display:flex;align-items:center;gap:16px;">
                        <div class="mono-num" style="font-size:1.45rem;font-weight:800;color:var(--primary);min-width:58px;">#${item.queue_number}</div>
                        <div>
                          <strong style="font-size:1rem;display:block;">${item.customer_name}</strong>
                          <span style="font-size:0.84rem;color:var(--text-muted);">${item.service_name} • Specialist: ${item.staff_name}</span>
                        </div>
                      </div>
                      <div style="text-align:right;">
                        ${window.formatStatusBadge(item.status)}
                        <div class="mono-num" style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
                          ${item.status === "SERVING" ? "On Chair Now" : `Ahead: ${item.people_ahead ?? idx} • ~${item.estimated_wait ?? idx * 15} mins`}
                        </div>
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
      mount.innerHTML = `<div class="card" style="padding:24px;color:var(--danger);">${err.message}</div>`;
    }
  },
};

window.StyleBookQueue = StyleBookQueue;
document.addEventListener("DOMContentLoaded", () => StyleBookQueue.initQueuePage());
