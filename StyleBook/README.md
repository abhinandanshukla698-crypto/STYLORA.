# StyleBook — Your Style. Your Place. Your Time.

**StyleBook** is a complete, production-style full-stack web application combining:
1. **Men's Salon**
2. **Women's Beauty Parlour**
3. **Unisex Salon**
4. **Home Beauty / Salon Service**

Customers can discover verified salons & parlours across Delhi, Noida, Gurugram, Ghaziabad, Lucknow, Kanpur, Varanasi, and Prayagraj, check **real-time queue numbers and estimated wait times BEFORE booking**, book In-Salon or Home Services, chat with the salon, track live queue progress, leave verified reviews, and use the **AI Style Studio** for hairstyle, beard, color, and makeup recommendations.

Salon/Parlour Owners get a dedicated **Command Center Dashboard** to accept or reject booking requests, automatically issue queue tokens, advance the live queue (`START NEXT`, `PAUSE`, `COMPLETE`, `SKIP`), manage services & INR prices, manage staff specialists, and chat with customers.

---

## 1. Folder Structure

```text
StyleBook/
├── backend/
│   ├── main.py                # FastAPI application, REST API routes & static file server
│   ├── database.py            # Thread-safe UTF-8 JSON read/write + automatic seed generator
│   ├── auth.py                # JWT Bearer authentication & role guards (customer / owner)
│   ├── models.py              # Domain models & enums
│   ├── schemas.py             # Pydantic v2 request validation schemas
│   ├── utils.py               # PBKDF2-HMAC-SHA256 password hashing, JWT signing, Haversine distance
│   ├── requirements.txt       # Python dependencies
│   └── data/
│       ├── users.json         # 12 customers + 15 owners (hashed passwords)
│       ├── businesses.json    # 15 salons/parlours across Delhi NCR & UP
│       ├── services.json      # 60+ services across Men, Women, Unisex & Home categories
│       ├── bookings.json      # 32+ bookings across PENDING, ACCEPTED, SERVING, COMPLETED, etc.
│       ├── queue.json         # Live queue counters for all 15 businesses
│       ├── messages.json      # Customer-to-salon chat history
│       ├── reviews.json       # 52+ verified customer reviews
│       ├── staff.json         # Stylists, barbers, bridal MUAs & beauticians
│       ├── notifications.json # Real-time customer & owner notifications
│       └── favorites.json     # Customer saved salons
│
├── frontend/
│   ├── index.html             # Landing page with Hero, Onboarding Type Switcher, Nearby Salons
│   ├── login.html             # Customer login + 1-click demo login
│   ├── register.html          # Customer registration
│   ├── explore.html           # Search, multi-filter & sort salons with pre-booking queue strip
│   ├── salon-details.html     # Gallery, services, staff, reviews & Live Queue Board before booking
│   ├── booking.html           # Booking form + pre-booking queue & price receipt
│   ├── booking-success.html   # Booking confirmation receipt (PENDING status)
│   ├── customer-dashboard.html# Live booking tracker with 5-step timeline & auto-polling
│   ├── my-bookings.html       # Customer bookings filterable by status + review modal
│   ├── queue.html             # Public live salon queue display board
│   ├── chat.html              # Customer chat with quick replies & read receipts
│   ├── profile.html           # Customer profile editor & Saved Salons
│   ├── ai-studio.html         # AI Style Studio (photo upload, webcam capture, style advisor)
│   ├── map.html               # Google Maps locator with markers & graceful fallback
│   ├── owner-login.html       # Salon owner login + 1-click demo owner login
│   ├── owner-register.html    # Salon partner registration
│   ├── owner-dashboard.html   # Owner KPIs, New Booking Request alerts & Upcoming table
│   ├── owner-bookings.html    # Owner booking management (Pending, Accepted, Today, Completed, Cancelled)
│   ├── owner-queue.html       # Owner live queue control terminal (START NEXT, PAUSE, COMPLETE, SKIP)
│   ├── owner-services.html    # Owner service menu & INR pricing CRUD
│   ├── owner-staff.html       # Owner staff & specialist team CRUD
│   ├── owner-chat.html        # Owner customer chat console
│   ├── owner-profile.html     # Owner business storefront editor
│   ├── owner-settings.html    # Owner working hours, chairs & queue duration settings
│   ├── css/
│   │   ├── style.css
│   │   ├── responsive.css
│   │   ├── auth.css
│   │   ├── customer.css
│   │   ├── owner.css
│   │   └── ai.css
│   └── js/
│       ├── config.js
│       ├── api.js
│       ├── auth.js
│       ├── common.js
│       ├── customer.js
│       ├── booking.js
│       ├── queue.js
│       ├── chat.js
│       ├── owner.js
│       ├── map.js
│       └── ai.js
└── README.md
```

---

## 2. Quick Start (Python + FastAPI)

### Prerequisites
- Python 3.9+ installed (`python --version`)

### Step 1: Create & Activate Virtual Environment
```bash
cd StyleBook/backend
python -m venv .venv
```

**Windows:**
```bash
.venv\Scripts\activate
```

**macOS / Linux:**
```bash
source .venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Start the Server (Serves Both Backend API & Frontend Static Files)
```bash
uvicorn main:app --reload
```

- **Web Application**: Open [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger API Docs**: Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 3. Demo Credentials

| Role | Email | Password | Assigned Studio |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@stylebook.local` | `123456` | All Salons & Home Services |
| **Salon Owner** | `owner@stylebook.local` | `123456` | Royale Crown Atelier & Unisex Lounge (`biz_1`) |

*(Both `login.html` and `owner-login.html` also feature **1-Click Demo Login** buttons for instant testing.)*

---

## 4. Google Maps & AI Configuration

### Google Maps Setup (`frontend/js/config.js`)
Open `StyleBook/frontend/js/config.js`:
```javascript
const GOOGLE_MAPS_API_KEY = "YOUR_KEY_HERE";
```
- When a valid Google Maps JavaScript API key is configured, `map.html` loads interactive Google Maps using the modern Dynamic Library Import (`google.maps.importLibrary`), `AdvancedMarkerElement`, and `InfoWindow`.
- If the key is missing or restricted, StyleBook automatically renders a **graceful fallback** with `"Open in Google Maps"` search and turn-by-turn directions links so the page never crashes.

### AI Style Studio Setup (`.env`)
Set optional environment variables on the server:
```env
AI_PROVIDER="gemini"
AI_API_KEY="YOUR_AI_API_KEY"
```
- API keys are kept strictly server-side and are never exposed in frontend JavaScript.
- If no external AI key is configured, the built-in StyleBook Style Engine provides instant face-shape, hairstyle, beard, hair color, and makeup recommendations.

---

## 5. How the End-to-End Booking & Live Queue Workflow Works

1. **Pre-Booking Queue Visibility**: Every salon card on `explore.html` and the live board on `salon-details.html` show `Now Serving #`, `People Waiting`, `Estimated Wait Minutes`, and `Available Seats` **before** you book.
2. **Booking Request (`PENDING`)**: When a customer books on `booking.html`, a booking is created with status `PENDING` and the salon owner receives a notification.
3. **Owner Acceptance & Token Generation (`ACCEPTED`)**: When the owner logs into `owner-dashboard.html` or `owner-bookings.html` and clicks **ACCEPT**, the status becomes `ACCEPTED` and the next sequential `queue_number` (e.g., `#23`) is automatically issued.
4. **Live Queue Tracking (`SERVING` → `COMPLETED`)**: The owner controls the chair via `owner-queue.html` (`START NEXT`, `PAUSE`, `COMPLETE`, `SKIP`). The customer's dashboard (`customer-dashboard.html`) polls every few seconds and updates the 5-step progress timeline in real time.
5. **Verified Reviews**: Once a booking reaches `COMPLETED`, the customer can leave a 1–5 star review, which dynamically updates the salon's average rating.
