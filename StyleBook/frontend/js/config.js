/**
 * StyleBook Frontend Configuration
 * Replace GOOGLE_MAPS_API_KEY with your own key or use the provisioned demo key.
 * When running locally via `uvicorn main:app --reload`, API requests route to /api.
 */
const API_BASE_URL =
  window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? `${window.location.origin}/api`
    : "/api";

const GOOGLE_MAPS_API_KEY = "AIzaSyA93tWRRTFeIgqK4W3-vcXmTjUEOHdS7kk";

window.STYLEBOOK_CONFIG = {
  API_BASE_URL,
  GOOGLE_MAPS_API_KEY,
  APP_NAME: "StyleBook",
  TAGLINE: "Your Style. Your Place. Your Time.",
  DEFAULT_LAT: 28.6315,
  DEFAULT_LNG: 77.2167,
  DEFAULT_CITY: "Delhi",
};
