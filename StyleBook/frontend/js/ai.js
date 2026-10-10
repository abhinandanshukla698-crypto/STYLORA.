/**
 * StyleBook AI Style Studio Controller:
 * Photo Upload & Live Camera Capture, Face Shape & Hair Analysis, Style Recommendations, "Book This Style" Redirect & AI Chat
 */
const StyleBookAI = {
  currentImageBase64: null,
  videoStream: null,

  initAIStudioPage() {
    const analyzeBtn = document.getElementById("runAiStyleAnalysisBtn");
    if (!analyzeBtn) return;

    const fileInput = document.getElementById("aiPhotoInput");
    const uploadZone = document.getElementById("aiPhotoDropZone");
    const previewImg = document.getElementById("aiPhotoPreview");
    const startCamBtn = document.getElementById("startCameraBtn");
    const captureCamBtn = document.getElementById("capturePhotoBtn");
    const videoEl = document.getElementById("aiCameraVideo");

    if (uploadZone && fileInput) {
      uploadZone.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.currentImageBase64 = ev.target.result;
          if (previewImg) {
            previewImg.src = this.currentImageBase64;
            previewImg.style.display = "block";
          }
          window.showToast("Photo loaded! Click 'Analyze My Style' for tailored recommendations.", "success");
        };
        reader.readAsDataURL(file);
      });
    }

    if (startCamBtn && videoEl) {
      startCamBtn.addEventListener("click", async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          window.showToast("Camera access is not available on this device. Please upload a photo instead.", "info");
          return;
        }
        try {
          this.videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
          videoEl.srcObject = this.videoStream;
          videoEl.style.display = "block";
          captureCamBtn.style.display = "inline-flex";
          startCamBtn.style.display = "none";
        } catch (err) {
          window.showToast("Camera permission denied. You can upload any photo or use our preset style analyzer.", "info");
        }
      });
    }

    if (captureCamBtn && videoEl) {
      captureCamBtn.addEventListener("click", () => {
        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth || 480;
        canvas.height = videoEl.videoHeight || 480;
        canvas.getContext("2d").drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        this.currentImageBase64 = canvas.toDataURL("image/jpeg", 0.85);
        if (previewImg) {
          previewImg.src = this.currentImageBase64;
          previewImg.style.display = "block";
        }
        if (this.videoStream) {
          this.videoStream.getTracks().forEach((t) => t.stop());
        }
        videoEl.style.display = "none";
        captureCamBtn.style.display = "none";
        startCamBtn.style.display = "inline-flex";
        window.showToast("Photo captured! Running style analysis...", "success");
        this.runPhotoAnalysis();
      });
    }

    analyzeBtn.addEventListener("click", () => this.runPhotoAnalysis());

    const chatForm = document.getElementById("studioAiChatForm");
    if (chatForm) {
      chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("studioAiChatInput");
        const q = input.value.trim();
        if (!q) return;
        input.value = "";
        await this.askStudioChat(q);
      });
    }

    // Run initial demonstration analysis so the right panel is populated immediately
    this.runPhotoAnalysis(true);
  },

  async runPhotoAnalysis(silent = false) {
    const mount = document.getElementById("aiAnalysisResultMount");
    const btn = document.getElementById("runAiStyleAnalysisBtn");
    if (!mount) return;

    const pref = (document.getElementById("aiPrefSelect") && document.getElementById("aiPrefSelect").value) || "men";
    const faceHint = (document.getElementById("aiFaceShapeSelect") && document.getElementById("aiFaceShapeSelect").value) || "Oval / Balanced Contour";
    const hairHint = (document.getElementById("aiHairTypeSelect") && document.getElementById("aiHairTypeSelect").value) || "Medium Wavy Texture";
    const occasion = (document.getElementById("aiOccasionSelect") && document.getElementById("aiOccasionSelect").value) || "Executive & Everyday";

    if (btn && !silent) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing Face Proportions & Hair...`;
    }

    try {
      const res = await StyleBookAPI.post("/ai/style-analysis", {
        image_base64: this.currentImageBase64,
        preference: pref,
        face_shape_hint: faceHint,
        hair_type_hint: hairHint,
        occasion: occasion,
      });
      const a = res.analysis;
      const srv = a.recommended_service;

      mount.innerHTML = `
        <div class="card" style="padding:26px;border:2px solid var(--primary);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
            <span class="badge badge-verified"><i class="fa-solid fa-wand-magic-sparkles"></i> AI STYLE DIAGNOSTIC REPORT</span>
            <span style="font-size:0.78rem;color:var(--text-muted);">Cosmetic Styling Guide</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:var(--surface-alt);padding:14px;border-radius:var(--radius-md);margin-bottom:20px;font-size:0.84rem;">
            <div><span style="color:var(--text-light);display:block;">Face Shape</span><strong>${a.face_shape}</strong></div>
            <div><span style="color:var(--text-light);display:block;">Hair Texture</span><strong>${a.hair_type}</strong></div>
            <div><span style="color:var(--text-light);display:block;">Ideal Length</span><strong>${a.hair_length}</strong></div>
          </div>

          <h4 style="font-size:1rem;font-weight:700;margin-bottom:10px;">Recommended Hairstyles</h4>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
            ${(a.suggested_hairstyles || [])
              .map(
                (h) => `
              <div style="padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;gap:12px;">
                <div>
                  <strong style="color:var(--dark);display:block;">${h.name}</strong>
                  <span style="font-size:0.82rem;color:var(--text-muted);">${h.desc}</span>
                </div>
                <span class="badge badge-open mono-num">${h.match}</span>
              </div>
            `
              )
              .join("")}
          </div>

          <h4 style="font-size:1rem;font-weight:700;margin-bottom:10px;">${pref === "women" ? "Suggested Makeup & Styling" : "Suggested Beard & Contour"}</h4>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
            ${(a.suggested_beard_or_makeup || [])
              .map(
                (b) => `
              <div style="padding:10px 14px;background:#F5F3FF;border-radius:var(--radius-sm);font-size:0.86rem;">
                <strong>${b.name}:</strong> ${b.desc}
              </div>
            `
              )
              .join("")}
          </div>

          <h4 style="font-size:1rem;font-weight:700;margin-bottom:6px;">Recommended Hair Color Palette</h4>
          <div class="color-swatch-row" style="margin-bottom:20px;">
            ${(a.suggested_colors || [])
              .map(
                (c) => `
              <div class="color-swatch-chip">
                <span class="swatch-circle" style="background:${c.hex};"></span>
                <span>${c.name}</span>
              </div>
            `
              )
              .join("")}
          </div>

          <!-- Book This Style CTA -->
          <div style="background:linear-gradient(135deg,#111827 0%,#311068 100%);color:#fff;padding:20px;border-radius:var(--radius-lg);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
            <div>
              <span style="font-size:0.74rem;color:#FDE68A;text-transform:uppercase;font-weight:700;">Matched Salon Service</span>
              <h4 style="font-size:1.12rem;margin:2px 0;">${srv.name}</h4>
              <span style="font-size:0.82rem;color:rgba(255,255,255,0.8);">${srv.business_name} • <strong class="mono-num">₹${srv.price}</strong> (${srv.duration} mins)</span>
            </div>
            <a href="booking.html?business_id=${srv.business_id}&service_id=${srv.service_id}" class="btn btn-primary">
              <i class="fa-solid fa-calendar-check"></i> Book This Style
            </a>
          </div>

          <p style="font-size:0.75rem;color:var(--text-light);margin-top:12px;">
            <i class="fa-solid fa-circle-info"></i> ${a.care_note}
          </p>
        </div>
      `;
    } catch (err) {
      window.showToast("AI service is currently unavailable. Showing curated style guide.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Analyze My Style`;
      }
    }
  },

  async askStudioChat(question) {
    const box = document.getElementById("studioAiChatBox");
    if (!box) return;
    box.innerHTML += `<div class="chat-bubble sent">${question}</div>`;
    const loadId = "st_ai_" + Date.now();
    box.innerHTML += `<div class="chat-bubble received" id="${loadId}"><i class="fa-solid fa-circle-notch fa-spin"></i> Consulting StyleBook AI...</div>`;
    box.scrollTop = box.scrollHeight;

    try {
      const res = await StyleBookAPI.post("/ai/chat", { message: question });
      const html = (res.reply || "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
      const el = document.getElementById(loadId);
      if (el) el.innerHTML = html;
    } catch (err) {
      const el = document.getElementById(loadId);
      if (el) el.innerHTML = "AI service is currently unavailable. Please try again.";
    }
    box.scrollTop = box.scrollHeight;
  },
};

window.StyleBookAI = StyleBookAI;
document.addEventListener("DOMContentLoaded", () => StyleBookAI.initAIStudioPage());
