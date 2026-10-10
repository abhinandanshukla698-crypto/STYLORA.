/**
 * StyleBook Authentication & Role Protection Controller
 */
const StyleBookAuth = {
  requireAuth(expectedRole = null) {
    const user = StyleBookAPI.getCurrentUser();
    const token = StyleBookAPI.getToken();
    if (!user || !token) {
      window.location.href = expectedRole === "owner" ? "owner-login.html" : "login.html";
      return null;
    }
    if (expectedRole === "owner" && user.role !== "owner") {
      window.showToast && window.showToast("Access restricted to business owners.", "error");
      window.location.href = "customer-dashboard.html";
      return null;
    }
    if (expectedRole === "customer" && user.role === "owner") {
      window.location.href = "owner-dashboard.html";
      return null;
    }
    return user;
  },

  logout() {
    StyleBookAPI.clearSession();
    window.showToast && window.showToast("Logged out successfully.", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 350);
  },

  async quickDemoLogin(role, buttonEl) {
    const email = role === "owner" ? "owner@stylebook.local" : "customer@stylebook.local";
    const password = "123456";
    const origText = buttonEl ? buttonEl.innerHTML : "";
    try {
      if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...`;
      }
      const res = await StyleBookAPI.post("/auth/login", { email, password });
      StyleBookAPI.setSession(res.token, res.user);
      window.showToast(`Welcome back, ${res.user.name}!`, "success");
      setTimeout(() => {
        window.location.href = res.user.role === "owner" ? "owner-dashboard.html" : "customer-dashboard.html";
      }, 450);
    } catch (err) {
      window.showToast(err.message || "Demo login failed.", "error");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = origText;
      }
    }
  },

  compressAndSetAvatar(file, previewImg, hiddenInput, badgeEl) {
    if (!file || !file.type.startsWith("image/")) {
      window.showToast("Please choose a valid image file (JPG, PNG, WEBP).", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        if (previewImg) previewImg.src = dataUrl;
        if (hiddenInput) hiddenInput.value = dataUrl;
        if (badgeEl) {
          badgeEl.textContent = "Photo Uploaded ✓";
          badgeEl.style.background = "#D1FAE5";
          badgeEl.style.color = "#065F46";
        }
        document.querySelectorAll(".preset-avatar-option").forEach((p) => p.classList.remove("active"));
        window.showToast("Profile photo selected successfully!", "success");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  initAvatarSelector() {
    const fileInput = document.getElementById("avatarFileInput");
    const previewImg = document.getElementById("avatarPreviewImg");
    const hiddenInput = document.getElementById("avatar");
    const badgeEl = document.getElementById("avatarStatusBadge");
    const toggleUrlBtn = document.getElementById("btnToggleUrlInput");
    const urlWrap = document.getElementById("avatarUrlWrap");
    const urlInput = document.getElementById("avatarUrlInput");
    const applyUrlBtn = document.getElementById("btnApplyAvatarUrl");

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.compressAndSetAvatar(file, previewImg, hiddenInput, badgeEl);
        }
      });
    }

    if (toggleUrlBtn && urlWrap) {
      toggleUrlBtn.addEventListener("click", () => {
        urlWrap.style.display = urlWrap.style.display === "none" ? "block" : "none";
        if (urlWrap.style.display === "block" && urlInput) {
          urlInput.focus();
        }
      });
    }

    if (applyUrlBtn && urlInput) {
      applyUrlBtn.addEventListener("click", () => {
        const url = urlInput.value.trim();
        if (!url) {
          window.showToast("Please enter an image link.", "error");
          return;
        }
        if (previewImg) previewImg.src = url;
        if (hiddenInput) hiddenInput.value = url;
        if (badgeEl) {
          badgeEl.textContent = "Link Photo Applied ✓";
          badgeEl.style.background = "#D1FAE5";
          badgeEl.style.color = "#065F46";
        }
        document.querySelectorAll(".preset-avatar-option").forEach((p) => p.classList.remove("active"));
        window.showToast("Profile photo link applied!", "success");
      });
    }

    // Preset avatars click handling
    document.querySelectorAll(".preset-avatar-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const url = opt.dataset.url;
        if (!url) return;
        if (previewImg) previewImg.src = url;
        if (hiddenInput) hiddenInput.value = url;
        if (badgeEl) {
          badgeEl.textContent = "Preset Chosen ✓";
          badgeEl.style.background = "#EEF2FF";
          badgeEl.style.color = "#4F46E5";
        }
        document.querySelectorAll(".preset-avatar-option").forEach((p) => p.classList.remove("active"));
        opt.classList.add("active");
      });
    });
  },

  initAuthForms() {
    this.initAvatarSelector();

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector("button[type='submit']");
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const orig = btn.innerHTML;
        try {
          btn.disabled = true;
          btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...`;
          const res = await StyleBookAPI.post("/auth/login", { email, password });
          StyleBookAPI.setSession(res.token, res.user);
          window.showToast(`Welcome back, ${res.user.name}!`, "success");
          const redirectParam = new URLSearchParams(window.location.search).get("redirect");
          setTimeout(() => {
            if (redirectParam) {
              window.location.href = redirectParam;
            } else {
              window.location.href = res.user.role === "owner" ? "owner-dashboard.html" : "customer-dashboard.html";
            }
          }, 450);
        } catch (err) {
          window.showToast(err.message || "Invalid email or password.", "error");
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    }

    const regForm = document.getElementById("registerForm");
    if (regForm) {
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = regForm.querySelector("button[type='submit']");
        const orig = btn.innerHTML;
        const role = regForm.dataset.role || "customer";
        const payload = {
          name: document.getElementById("name").value.trim(),
          email: document.getElementById("email").value.trim(),
          phone: document.getElementById("phone").value.trim(),
          password: document.getElementById("password").value,
          role: role,
          preferred_type: (document.getElementById("preferred_type") && document.getElementById("preferred_type").value) || "unisex",
          city: (document.getElementById("city") && document.getElementById("city").value) || "Delhi",
          location: (document.getElementById("location") && document.getElementById("location").value) || "Connaught Place, New Delhi",
          business_name: (document.getElementById("business_name") && document.getElementById("business_name").value) || undefined,
          business_category: (document.getElementById("business_category") && document.getElementById("business_category").value) || "unisex",
          business_address: (document.getElementById("business_address") && document.getElementById("business_address").value) || undefined,
          avatar: (document.getElementById("avatar") && document.getElementById("avatar").value) || undefined,
        };

        try {
          btn.disabled = true;
          btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Creating Account...`;
          const res = await StyleBookAPI.post("/auth/register", payload);
          StyleBookAPI.setSession(res.token, res.user);
          window.showToast("Account created! Welcome to StyleBook.", "success");
          setTimeout(() => {
            window.location.href = res.user.role === "owner" ? "owner-dashboard.html" : "customer-dashboard.html";
          }, 500);
        } catch (err) {
          window.showToast(err.message || "Registration could not be completed.", "error");
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    }
  },
};

window.StyleBookAuth = StyleBookAuth;
document.addEventListener("DOMContentLoaded", () => StyleBookAuth.initAuthForms());
