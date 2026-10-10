/**
 * Centralized API Client & Error Handling for StyleBook
 * Handles 401, 403, 404, 422, 500 and network errors gracefully.
 */
const StyleBookAPI = {
  getToken() {
    return localStorage.getItem("stylebook_token") || "";
  },

  setSession(token, user) {
    if (token) localStorage.setItem("stylebook_token", token);
    if (user) localStorage.setItem("stylebook_user", JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem("stylebook_token");
    localStorage.removeItem("stylebook_user");
  },

  getCurrentUser() {
    try {
      const raw = localStorage.getItem("stylebook_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  async request(endpoint, options = {}) {
    const baseUrl = (window.STYLEBOOK_CONFIG && window.STYLEBOOK_CONFIG.API_BASE_URL) || "/api";
    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const fetchOptions = Object.assign({}, options, { headers });
    if (fetchOptions.body && typeof fetchOptions.body === "object" && !(fetchOptions.body instanceof FormData)) {
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (networkErr) {
      const friendly = new Error("Unable to connect to server. Please check your connection and try again.");
      friendly.status = 0;
      throw friendly;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (parseErr) {
      payload = null;
    }

    if (!response.ok) {
      const status = response.status;
      let detail = (payload && (payload.detail || payload.message)) || "";
      if (Array.isArray(detail)) {
        detail = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      }

      if (status === 401) {
        if (!endpoint.includes("/auth/login")) {
          this.clearSession();
          if (window.showToast) {
            window.showToast("Session expired or login required. Redirecting...", "error");
          }
          setTimeout(() => {
            const isOwnerPage = window.location.pathname.includes("owner-");
            window.location.href = isOwnerPage ? "owner-login.html" : "login.html";
          }, 900);
        }
        throw new Error(detail || "Invalid credentials or session expired.");
      }
      if (status === 403) {
        throw new Error(detail || "You do not have permission to perform this action.");
      }
      if (status === 404) {
        throw new Error(detail || "Requested resource was not found.");
      }
      if (status === 422) {
        throw new Error(detail || "Please check all form fields and try again.");
      }
      if (status >= 500) {
        throw new Error("Something went wrong on the server. Please try again.");
      }
      throw new Error(detail || "Something went wrong. Please try again.");
    }

    return payload;
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: "POST", body });
  },

  put(endpoint, body = {}) {
    return this.request(endpoint, { method: "PUT", body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },
};

window.StyleBookAPI = StyleBookAPI;
