import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  Firestore,
} from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

const DATA_DIR = path.resolve(process.cwd(), "StyleBook/backend/data");
const FRONTEND_DIR = path.resolve(process.cwd(), "StyleBook/frontend");

// Firebase Firestore Cloud Database Setup
let db: Firestore | null = null;
let firestoreDbId = "";
const candidateConfigPaths = [
  path.resolve(process.cwd(), "firebase-applet-config.json"),
  path.resolve(process.cwd(), "StyleBook/backend/firebase-applet-config.json"),
  path.resolve(process.cwd(), "backend/firebase-applet-config.json"),
];
const firebaseConfigPath = candidateConfigPaths.find((p) => fs.existsSync(p));

if (firebaseConfigPath) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const fbApp = initializeApp(firebaseConfig);
    firestoreDbId = firebaseConfig.firestoreDatabaseId || "";
    db = getFirestore(fbApp, firestoreDbId);
    console.log(`Firebase Firestore initialized from ${firebaseConfigPath} (DB: ${firestoreDbId})`);
  } catch (err) {
    console.error("Failed to initialize Firebase Firestore:", err);
  }
}

const COLLECTION_MAP: Record<string, string> = {
  "users.json": "users",
  "businesses.json": "businesses",
  "services.json": "services",
  "bookings.json": "bookings",
  "queue.json": "queue",
  "messages.json": "messages",
  "notifications.json": "notifications",
  "reviews.json": "reviews",
  "favorites.json": "favorites",
  "friend_messages.json": "friend_messages",
};

// In-memory data store kept in sync with local storage and cloud database
const memoryDb: Record<string, any[]> = {};

function getDocId(item: any, fallbackPrefix = "doc"): string {
  if (item && item.id) return String(item.id);
  if (item && item.business_id && !item.user_id) return String(item.business_id);
  if (item && item.user_id && item.business_id) return `${item.user_id}_${item.business_id}`;
  return generateId(fallbackPrefix);
}

function writeLocalDiskOnly(filename: string, data: any[]): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const fp = path.join(DATA_DIR, filename);
    const tmp = path.join(DATA_DIR, `${filename}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, fp);
  } catch (err) {
    console.error(`Error writing ${filename} to disk:`, err);
  }
}

async function syncCollectionWithFirestore(filename: string, colName: string) {
  if (!db) return;
  try {
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    const localData = readLocalDiskJson(filename);

    if (snapshot.size > 0) {
      // Cloud database has documents: pull from Firestore
      const cloudDocs: any[] = [];
      snapshot.forEach((d) => {
        cloudDocs.push(d.data());
      });

      const mergedMap = new Map<string, any>();
      localData.forEach((item) => {
        mergedMap.set(getDocId(item, colName), item);
      });
      cloudDocs.forEach((item) => {
        mergedMap.set(getDocId(item, colName), item);
      });

      const merged = Array.from(mergedMap.values());
      memoryDb[filename] = merged;
      writeLocalDiskOnly(filename, merged);
      console.log(`Synced ${colName}: total ${merged.length} items (${cloudDocs.length} loaded from Firestore).`);
    } else if (localData.length > 0) {
      // Cloud is empty for this collection: seed existing records
      console.log(`Seeding ${colName} with ${localData.length} records to Cloud Firestore...`);
      for (const item of localData) {
        const docId = getDocId(item, colName);
        await setDoc(doc(db, colName, docId), item, { merge: true });
      }
      memoryDb[filename] = localData;
      console.log(`Seeded ${localData.length} records to ${colName}.`);
    } else {
      memoryDb[filename] = [];
    }
  } catch (err) {
    console.error(`Error syncing Firestore collection ${colName}:`, err);
  }
}

async function syncAllFirestore() {
  if (!db) return;
  console.log("Starting full Firestore database synchronization...");
  for (const [filename, colName] of Object.entries(COLLECTION_MAP)) {
    await syncCollectionWithFirestore(filename, colName);
  }
  console.log("Firestore database synchronization complete.");
}

const SECRET_KEY = "stylebook-super-secret-jwt-signing-key-2026-production";
const PASSWORD_SALT = "stylebook_salt_2026";

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function generateId(prefix = "id"): string {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

function hashPassword(password: string): string {
  const dk = crypto.pbkdf2Sync(password, PASSWORD_SALT, 100000, 32, "sha256");
  return `pbkdf2_sha256$100000$${PASSWORD_SALT}$${dk.toString("hex")}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2_sha256$")) {
    const parts = stored.split("$");
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const hashHex = parts[3];
      const dk = crypto.pbkdf2Sync(plain, salt, iterations, 32, "sha256").toString("hex");
      return dk === hashHex;
    }
  }
  return hashPassword(plain) === stored;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createJwtToken(payload: Record<string, any>, expiresInSec = 86400 * 7): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const h = b64urlEncode(Buffer.from(JSON.stringify(header)));
  const p = b64urlEncode(Buffer.from(JSON.stringify(body)));
  const sig = crypto.createHmac("sha256", SECRET_KEY).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

function decodeJwtToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = b64urlEncode(crypto.createHmac("sha256", SECRET_KEY).update(`${h}.${p}`).digest());
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf-8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function readLocalDiskJson<T = any>(filename: string): T[] {
  try {
    const fp = path.join(DATA_DIR, filename);
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, "utf-8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readJson<T = any>(filename: string): T[] {
  if (memoryDb[filename]) {
    return memoryDb[filename] as T[];
  }
  const diskData = readLocalDiskJson<T>(filename);
  memoryDb[filename] = diskData;
  return diskData;
}

function writeJson(filename: string, data: any[]): void {
  memoryDb[filename] = data;
  writeLocalDiskOnly(filename, data);

  // Asynchronously persist to Cloud Firestore database
  if (db && COLLECTION_MAP[filename]) {
    const colName = COLLECTION_MAP[filename];
    (async () => {
      try {
        for (const item of data) {
          const docId = getDocId(item, colName);
          await setDoc(doc(db!, colName, docId), item, { merge: true });
        }
      } catch (err) {
        console.error(`Firestore persist error for ${colName}:`, err);
      }
    })();
  }
}

function sanitizeUser(u: Record<string, any>) {
  const { password_hash, ...rest } = u;
  return rest;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function addNotification(userId: string, title: string, message: string, type: string, bookingId = "") {
  const list = readJson("notifications.json");
  const item = {
    id: generateId("ntf"),
    user_id: userId,
    title,
    message,
    type,
    booking_id: bookingId,
    read: false,
    created_at: nowIso(),
  };
  list.unshift(item);
  writeJson("notifications.json", list);
  return item;
}

function recalculateBusinessQueue(businessId: string) {
  const queues = readJson("queue.json");
  const bookings = readJson("bookings.json");
  const businesses = readJson("businesses.json");
  const biz = businesses.find((b) => b.id === businessId);
  const avgDur = biz?.avg_service_time_min || 20;

  let qState = queues.find((q) => q.business_id === businessId);
  if (!qState) {
    qState = {
      business_id: businessId,
      now_serving_number: 1,
      now_serving_booking_id: null,
      now_serving_customer_name: "Ready for Next Guest",
      now_serving_service_name: "All Stations Open",
      waiting_count: 0,
      estimated_wait_minutes: 0,
      seats_available: biz?.seats_available || 2,
      is_paused: false,
      avg_service_duration: avgDur,
      last_issued_number: 1,
      updated_at: nowIso(),
    };
    queues.push(qState);
  }

  const active = bookings
    .filter(
      (b) =>
        b.business_id === businessId &&
        ["ACCEPTED", "WAITING", "CONFIRMED", "SERVING"].includes(b.status) &&
        b.queue_number != null
    )
    .sort((a, b) => (a.queue_number || 9999) - (b.queue_number || 9999));

  const serving = active.find((b) => b.status === "SERVING");
  const waitingList = active.filter((b) => ["ACCEPTED", "WAITING", "CONFIRMED"].includes(b.status));

  if (serving) {
    qState.now_serving_number = serving.queue_number;
    qState.now_serving_booking_id = serving.id;
    qState.now_serving_customer_name = serving.customer_name;
    qState.now_serving_service_name = serving.service_name;
    serving.people_ahead = 0;
    serving.estimated_wait = 0;
  } else if (waitingList.length > 0) {
    qState.now_serving_booking_id = null;
  }

  const stepMin = Math.max(10, Math.round((qState.avg_service_duration || 20) * 0.6));
  qState.waiting_count = waitingList.length;
  qState.estimated_wait_minutes = waitingList.length * stepMin;

  waitingList.forEach((wb, idx) => {
    wb.people_ahead = idx + (serving ? 1 : 0);
    wb.estimated_wait = wb.people_ahead * stepMin;
  });

  qState.updated_at = nowIso();
  writeJson("queue.json", queues);
  writeJson("bookings.json", bookings);
  return qState;
}

function getAuthUser(req: Request): Record<string, any> | null {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  const payload = decodeJwtToken(token);
  if (!payload || !payload.sub) return null;
  const users = readJson("users.json");
  return users.find((u) => u.id === payload.sub) || null;
}

function requireUser(req: Request, res: Response): Record<string, any> | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ detail: "Authentication required. Please log in." });
    return null;
  }
  return user;
}

function requireOwnerUser(req: Request, res: Response): Record<string, any> | null {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "owner") {
    res.status(403).json({ detail: "Access restricted to verified salon/parlour owners." });
    return null;
  }
  return user;
}

// ==================================================
// AUTH ROUTES
// ==================================================
app.post("/api/auth/register", (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    password,
    role = "customer",
    preferred_type = "unisex",
    location = "Connaught Place, New Delhi",
    city = "Delhi",
    business_name,
    business_category = "unisex",
    business_address,
    avatar,
  } = req.body || {};

  if (!name || !email || !phone || !password || String(password).length < 6) {
    return res.status(422).json({ detail: "Please provide valid name, email, phone, and password (min 6 chars)." });
  }

  const users = readJson("users.json");
  const emailLower = String(email).toLowerCase().trim();
  if (users.some((u) => String(u.email).toLowerCase() === emailLower)) {
    return res.status(400).json({ detail: "An account with this email already exists." });
  }

  const safeRole = role === "owner" ? "owner" : "customer";
  const userId = generateId(safeRole === "owner" ? "usr_owner" : "usr_cust");
  let businessId: string | null = null;

  if (safeRole === "owner") {
    const businesses = readJson("businesses.json");
    const queues = readJson("queue.json");
    businessId = generateId("biz");
    businesses.push({
      id: businessId,
      owner_id: userId,
      name: business_name || `${name}'s Signature Salon & Studio`,
      category: business_category || "unisex",
      home_service_available: true,
      verified: true,
      rating: 4.9,
      review_count: 1,
      address: business_address || location || "Connaught Place, New Delhi",
      city: city || "Delhi",
      latitude: 28.6315,
      longitude: 77.2167,
      distance_km: 1.2,
      phone,
      email: emailLower,
      opening_hours: "09:00 AM - 09:00 PM",
      is_open: true,
      starting_price: 299,
      seats_total: 6,
      seats_available: 3,
      avg_service_time_min: 20,
      images: [
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=80",
      ],
      description: "Verified StyleBook partner studio offering luxury grooming, beauty care, and live queue booking.",
      amenities: ["AC Lounge", "Free Wi-Fi", "Sterilized Tools", "Home Service"],
      created_at: nowIso(),
    });
    writeJson("businesses.json", businesses);

    queues.push({
      business_id: businessId,
      now_serving_number: 1,
      now_serving_booking_id: null,
      now_serving_customer_name: "Ready for Guests",
      now_serving_service_name: "Online Queue Active",
      waiting_count: 0,
      estimated_wait_minutes: 0,
      seats_available: 3,
      is_paused: false,
      avg_service_duration: 20,
      last_issued_number: 1,
      updated_at: nowIso(),
    });
    writeJson("queue.json", queues);

    // Auto-create initial services and staff for this new salon
    const services = readJson("services.json");
    const newServices = [
      {
        id: generateId("srv"),
        business_id: businessId,
        name: "Signature Haircut & Styling",
        description: "Personalized consultation, wash, haircut, and styling.",
        duration: 30,
        price: 299,
        category: "Haircut",
        gender_type: business_category || "unisex",
        available: true,
        home_service_available: true,
      },
      {
        id: generateId("srv"),
        business_id: businessId,
        name: "Beard Trim & Hot Towel Sculpting",
        description: "Precision razor line-up and soothing hot towel conditioning.",
        duration: 20,
        price: 199,
        category: "Beard Styling",
        gender_type: "men",
        available: true,
        home_service_available: true,
      },
      {
        id: generateId("srv"),
        business_id: businessId,
        name: "Revitalizing Skin Glow Facial",
        description: "Deep pore cleanup and hydrating radiance facial.",
        duration: 45,
        price: 899,
        category: "Facial",
        gender_type: business_category || "unisex",
        available: true,
        home_service_available: true,
      },
      {
        id: generateId("srv"),
        business_id: businessId,
        name: "Deep Nourishing Hair Spa",
        description: "Intense moisture masque with therapeutic scalp massage.",
        duration: 40,
        price: 699,
        category: "Hair Spa",
        gender_type: business_category || "unisex",
        available: true,
        home_service_available: false,
      },
      {
        id: generateId("srv"),
        business_id: businessId,
        name: "Complete Luxury Package",
        description: "All-in-one head-to-toe grooming and relaxation package.",
        duration: 65,
        price: 1299,
        category: "Grooming Package",
        gender_type: business_category || "unisex",
        available: true,
        home_service_available: true,
      },
      {
        id: generateId("srv"),
        business_id: businessId,
        name: "Doorstep Home Service Visit",
        description: "100% sanitized home grooming & beauty service at your place.",
        duration: 45,
        price: 499,
        category: "Home Grooming",
        gender_type: "home",
        available: true,
        home_service_available: true,
      },
    ];
    services.push(...newServices);
    writeJson("services.json", services);

    const staffList = readJson("staff.json");
    staffList.push({
      id: generateId("stf"),
      business_id: businessId,
      name: `${String(name).split(" ")[0]} (Lead Specialist)`,
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
      role: "Lead Stylist & Director",
      specialization: "Hair Artistry, Styling & Skin Care",
      experience: "7 Years",
      working_days: "Mon - Sun",
      working_hours: "09:00 AM - 09:00 PM",
      available: true,
      rating: 5.0,
    });
    writeJson("staff.json", staffList);
  }

  const newUser = {
    id: userId,
    name: String(name).trim(),
    email: emailLower,
    phone: String(phone).trim(),
    password_hash: hashPassword(String(password)),
    role: safeRole,
    avatar:
      avatar ||
      (safeRole === "owner"
        ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
        : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"),
    preferred_type,
    location,
    city,
    latitude: 28.6315,
    longitude: 77.2167,
    business_id: businessId,
    created_at: nowIso(),
  };
  users.push(newUser);
  writeJson("users.json", users);

  const token = createJwtToken({ sub: userId, role: safeRole, email: emailLower });
  res.json({ token, user: sanitizeUser(newUser) });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const users = readJson("users.json");
  const emailLower = String(email || "").toLowerCase().trim();
  const user = users.find((u) => String(u.email).toLowerCase() === emailLower);
  if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
    return res.status(401).json({ detail: "Invalid email or password." });
  }

  // Ensure owner user has business_id populated
  if (user.role === "owner" && !user.business_id) {
    const businesses = readJson("businesses.json");
    const myBiz = businesses.find((b) => b.owner_id === user.id);
    if (myBiz) {
      user.business_id = myBiz.id;
      writeJson("users.json", users);
    }
  }

  const token = createJwtToken({ sub: user.id, role: user.role, email: user.email });
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ user: sanitizeUser(user) });
});

app.put("/api/auth/profile", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const users = readJson("users.json");
  const target = users.find((u) => u.id === user.id);
  if (!target) return res.status(404).json({ detail: "User not found." });

  const { name, phone, avatar, preferred_type, location, city } = req.body || {};
  if (name !== undefined) target.name = String(name).trim();
  if (phone !== undefined) target.phone = String(phone).trim();
  if (avatar !== undefined) target.avatar = avatar;
  if (preferred_type !== undefined) target.preferred_type = preferred_type;
  if (location !== undefined) target.location = location;
  if (city !== undefined) target.city = city;

  writeJson("users.json", users);
  res.json({ user: sanitizeUser(target) });
});

// ==================================================
// BUSINESSES & LOCATION ROUTES
// ==================================================
app.get("/api/businesses/nearby", (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(String(req.query.lat)) : 28.6315;
  const lng = req.query.lng ? parseFloat(String(req.query.lng)) : 77.2167;
  const city = req.query.city ? String(req.query.city).toLowerCase() : "";
  const category = req.query.category ? String(req.query.category).toLowerCase() : "";

  const businesses = readJson("businesses.json");
  const queues = readJson("queue.json");
  const qMap = new Map(queues.map((q) => [q.business_id, q]));

  const results = businesses
    .filter((b) => {
      if (city && city !== "all" && String(b.city).toLowerCase() !== city) return false;
      if (category && category !== "all") {
        if (category === "home") return Boolean(b.home_service_available || b.category === "home");
        return String(b.category).toLowerCase() === category;
      }
      return true;
    })
    .map((b) => {
      const dist = calculateDistanceKm(lat, lng, b.latitude || 28.6315, b.longitude || 77.2167);
      return {
        ...b,
        distance_km: dist < 50 ? dist : b.distance_km || 1.8,
        queue: qMap.get(b.id) || {
          now_serving_number: 8,
          waiting_count: 2,
          estimated_wait_minutes: 20,
          seats_available: b.seats_available || 2,
        },
      };
    })
    .sort((a, b) => (a.distance_km || 99) - (b.distance_km || 99));

  res.json({ businesses: results });
});

app.get("/api/businesses", (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search).toLowerCase().trim() : "";
  const city = req.query.city ? String(req.query.city).toLowerCase().trim() : "";
  const category = req.query.category ? String(req.query.category).toLowerCase().trim() : "";
  const homeService = req.query.home_service === "true";
  const openNow = req.query.open_now === "true";
  const minRating = req.query.min_rating ? parseFloat(String(req.query.min_rating)) : null;
  const maxPrice = req.query.max_price ? parseInt(String(req.query.max_price), 10) : null;
  const serviceName = req.query.service_name ? String(req.query.service_name).toLowerCase().trim() : "";
  const sortBy = req.query.sort_by ? String(req.query.sort_by) : "nearest";

  const businesses = readJson("businesses.json");
  const services = readJson("services.json");
  const queues = readJson("queue.json");
  const qMap = new Map(queues.map((q) => [q.business_id, q]));

  const results = businesses
    .filter((b) => {
      const bizServices = services.filter((s) => s.business_id === b.id && s.available !== false);
      if (city && city !== "all") {
        if (String(b.city).toLowerCase() !== city && !String(b.address).toLowerCase().includes(city)) return false;
      }
      if (category && category !== "all") {
        if (category === "home") {
          if (!b.home_service_available && b.category !== "home") return false;
        } else if (String(b.category).toLowerCase() !== category) {
          return false;
        }
      }
      if (homeService && !b.home_service_available) return false;
      if (openNow && !b.is_open) return false;
      if (minRating !== null && (b.rating || 0) < minRating) return false;
      if (maxPrice !== null && (b.starting_price || 0) > maxPrice) return false;
      if (serviceName && serviceName !== "all") {
        const hasSrv = bizServices.some(
          (s) =>
            String(s.name).toLowerCase().includes(serviceName) ||
            String(s.category).toLowerCase().includes(serviceName)
        );
        if (!hasSrv) return false;
      }
      if (search) {
        const matchBiz =
          String(b.name).toLowerCase().includes(search) ||
          String(b.address).toLowerCase().includes(search) ||
          String(b.city).toLowerCase().includes(search) ||
          String(b.description || "").toLowerCase().includes(search);
        const matchSrv = bizServices.some(
          (s) => String(s.name).toLowerCase().includes(search) || String(s.category).toLowerCase().includes(search)
        );
        if (!matchBiz && !matchSrv) return false;
      }
      return true;
    })
    .map((b) => ({
      ...b,
      queue: qMap.get(b.id) || {
        now_serving_number: 8,
        waiting_count: 2,
        estimated_wait_minutes: 20,
        seats_available: b.seats_available || 2,
      },
    }));

  if (sortBy === "price_asc") results.sort((a, b) => a.starting_price - b.starting_price);
  else if (sortBy === "price_desc") results.sort((a, b) => b.starting_price - a.starting_price);
  else if (sortBy === "rating") results.sort((a, b) => b.rating - a.rating);
  else if (sortBy === "fastest_queue")
    results.sort((a, b) => (a.queue?.estimated_wait_minutes || 0) - (b.queue?.estimated_wait_minutes || 0));
  else results.sort((a, b) => (a.distance_km || 1) - (b.distance_km || 1));

  res.json({ businesses: results });
});

app.get("/api/businesses/:id", (req: Request, res: Response) => {
  const businessId = req.params.id;
  const businesses = readJson("businesses.json");
  const biz = businesses.find((b) => b.id === businessId);
  if (!biz) return res.status(404).json({ detail: "Salon or Parlour not found." });

  const services = readJson("services.json").filter((s) => s.business_id === businessId);
  const staff = readJson("staff.json").filter((s) => s.business_id === businessId);
  const reviews = readJson("reviews.json").filter((r) => r.business_id === businessId);
  const queue = recalculateBusinessQueue(businessId);

  res.json({
    business: {
      ...biz,
      services,
      staff,
      reviews,
      queue,
    },
  });
});

app.put("/api/businesses/:id", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const businessId = req.params.id;
  const businesses = readJson("businesses.json");
  const biz = businesses.find((b) => b.id === businessId);
  if (!biz) return res.status(404).json({ detail: "Business not found." });

  Object.assign(biz, req.body);
  writeJson("businesses.json", businesses);
  res.json({ business: biz });
});

// ==================================================
// SERVICES & STAFF ROUTES
// ==================================================
app.get("/api/services", (req: Request, res: Response) => {
  const businessId = req.query.business_id ? String(req.query.business_id) : "";
  const genderType = req.query.gender_type ? String(req.query.gender_type).toLowerCase() : "";
  const services = readJson("services.json");
  const businesses = new Map(readJson("businesses.json").map((b) => [b.id, b]));

  const filtered = services
    .filter((s) => {
      if (businessId && s.business_id !== businessId) return false;
      if (genderType && genderType !== "all" && String(s.gender_type).toLowerCase() !== genderType) return false;
      return true;
    })
    .map((s) => {
      const biz = businesses.get(s.business_id);
      return {
        ...s,
        business_name: biz?.name || "Verified Studio",
        business_city: biz?.city || "Delhi",
      };
    });

  res.json({ services: filtered });
});

app.post("/api/services", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const services = readJson("services.json");
  const newSrv = {
    id: generateId("srv"),
    business_id: req.body.business_id || user.business_id || "biz_1",
    name: req.body.name,
    description: req.body.description || "",
    duration: Number(req.body.duration) || 30,
    price: Number(req.body.price) || 299,
    category: req.body.category || "Haircut",
    gender_type: req.body.gender_type || "unisex",
    available: true,
    home_service_available: Boolean(req.body.home_service_available),
  };
  services.push(newSrv);
  writeJson("services.json", services);
  res.json({ service: newSrv });
});

app.delete("/api/services/:id", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const services = readJson("services.json").filter((s) => s.id !== req.params.id);
  writeJson("services.json", services);
  res.json({ deleted: true });
});

app.get("/api/staff", (req: Request, res: Response) => {
  const businessId = req.query.business_id ? String(req.query.business_id) : "";
  let staff = readJson("staff.json");
  if (businessId) staff = staff.filter((s) => s.business_id === businessId);
  res.json({ staff });
});

app.post("/api/staff", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const staff = readJson("staff.json");
  const member = {
    id: generateId("stf"),
    business_id: req.body.business_id || user.business_id || "biz_1",
    name: req.body.name,
    photo:
      req.body.photo ||
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    role: req.body.role,
    specialization: req.body.specialization || "",
    experience: req.body.experience || "5 Years",
    working_days: req.body.working_days || "Mon - Sun",
    working_hours: req.body.working_hours || "09:30 AM - 08:30 PM",
    available: true,
    rating: 4.9,
  };
  staff.push(member);
  writeJson("staff.json", staff);
  res.json({ staff: member });
});

app.delete("/api/staff/:id", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const staff = readJson("staff.json").filter((s) => s.id !== req.params.id);
  writeJson("staff.json", staff);
  res.json({ deleted: true });
});

// ==================================================
// OWNER ACTIVE BUSINESS & STATS ROUTE
// ==================================================
app.get("/api/owner/my-business", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const businesses = readJson("businesses.json");
  const users = readJson("users.json");

  let myBiz = businesses.find((b) => b.owner_id === user.id || b.id === user.business_id);
  if (!myBiz) {
    myBiz = businesses.find((b) => b.id === "biz_1") || businesses[0];
  }

  // Ensure user has business_id properly linked
  if (myBiz && user.business_id !== myBiz.id) {
    user.business_id = myBiz.id;
    const target = users.find((u) => u.id === user.id);
    if (target) {
      target.business_id = myBiz.id;
      writeJson("users.json", users);
    }
  }

  const queue = recalculateBusinessQueue(myBiz.id);
  res.json({ business: myBiz, queue });
});

// ==================================================
// BOOKINGS & QUEUE ROUTES
// ==================================================
app.post("/api/bookings", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { business_id, service_id, staff_id, date, time, booking_type, customer_name, customer_phone, address, notes } =
    req.body || {};
  const businesses = readJson("businesses.json");
  const services = readJson("services.json");
  const staffList = readJson("staff.json");
  const bookings = readJson("bookings.json");

  const biz = businesses.find((b) => b.id === business_id);
  if (!biz) return res.status(404).json({ detail: "Salon not found." });

  // Safe service resolution
  let srv = services.find((s) => s.id === service_id);
  if (!srv) {
    srv = services.find((s) => s.business_id === business_id) || {
      id: generateId("srv"),
      business_id: biz.id,
      name: "Custom Salon Service",
      price: biz.starting_price || 299,
      duration: 30,
      category: "Hair & Grooming",
      gender_type: "unisex",
      available: true,
      home_service_available: true,
    };
  }

  const stf = staff_id ? staffList.find((st) => st.id === staff_id) : null;
  const qState = recalculateBusinessQueue(business_id);

  const newBooking = {
    id: generateId("bkg"),
    customer_id: user.id,
    customer_name: customer_name || user.name,
    customer_phone: customer_phone || user.phone,
    business_id: biz.id,
    business_name: biz.name,
    business_owner_id: biz.owner_id || "",
    service_id: srv.id,
    service_name: srv.name,
    service_price: srv.price,
    service_duration: srv.duration,
    staff_id: stf ? stf.id : null,
    staff_name: stf ? stf.name : "Any Available Specialist",
    date,
    time,
    booking_type: booking_type || "In-Salon",
    address: address || biz.address,
    notes: notes || "",
    status: "PENDING",
    rejection_reason: "",
    queue_number: null,
    people_ahead: qState.waiting_count || 2,
    estimated_wait: qState.estimated_wait_minutes || 25,
    reviewed: false,
    created_at: nowIso(),
  };

  bookings.unshift(newBooking);
  writeJson("bookings.json", bookings);

  addNotification(
    user.id,
    "Booking Requested",
    `Your booking request for ${srv.name} at ${biz.name} (${date} at ${time}) has been sent.`,
    "booking_requested",
    newBooking.id
  );

  // Send real-time notification to the salon owner
  if (biz.owner_id) {
    addNotification(
      biz.owner_id,
      "New Booking Request",
      `${newBooking.customer_name} requested ${srv.name} (${newBooking.booking_type}) on ${date} at ${time}.`,
      "new_booking",
      newBooking.id
    );
  }

  res.json({ booking: newBooking, queue: qState });
});

app.get("/api/bookings", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : "";
  const businessId = req.query.business_id ? String(req.query.business_id) : "";

  const bookings = readJson("bookings.json");
  const queues = new Map(readJson("queue.json").map((q) => [q.business_id, q]));
  const businesses = readJson("businesses.json");

  let filtered: any[] = [];

  if (user.role === "owner") {
    // Find all businesses owned by this user
    const myBusinesses = businesses.filter((b) => b.owner_id === user.id || b.id === user.business_id);
    const myBizIds = new Set(myBusinesses.map((b) => b.id));
    if (user.business_id) myBizIds.add(user.business_id);

    if (businessId && businessId !== "all" && myBizIds.has(businessId)) {
      filtered = bookings.filter((b) => b.business_id === businessId);
    } else if (myBizIds.size > 0) {
      filtered = bookings.filter((b) => myBizIds.has(b.business_id));
    } else {
      filtered = bookings.filter((b) => b.business_id === (businessId || "biz_1"));
    }
  } else {
    filtered = bookings.filter((b) => b.customer_id === user.id);
  }

  if (statusFilter && statusFilter !== "ALL") {
    filtered = filtered.filter((b) => String(b.status).toUpperCase() === statusFilter);
  }

  const enriched = filtered.map((b) => {
    const q = queues.get(b.business_id);
    return {
      ...b,
      business_now_serving: q?.now_serving_number || 18,
    };
  });

  res.json({ bookings: enriched });
});

app.get("/api/bookings/:id", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const bookings = readJson("bookings.json");
  const bkg = bookings.find((b) => b.id === req.params.id);
  if (!bkg) return res.status(404).json({ detail: "Booking not found." });
  const qState = recalculateBusinessQueue(bkg.business_id);
  const refreshed = readJson("bookings.json").find((b) => b.id === req.params.id) || bkg;
  res.json({ booking: refreshed, queue: qState });
});

app.put("/api/bookings/:id/accept", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const bookings = readJson("bookings.json");
  const queues = readJson("queue.json");
  const bkg = bookings.find((b) => b.id === req.params.id);
  if (!bkg) return res.status(404).json({ detail: "Booking not found." });

  const qState = queues.find((q) => q.business_id === bkg.business_id);
  const nextNum = (qState?.last_issued_number || 18) + 1;
  if (qState) {
    qState.last_issued_number = nextNum;
    writeJson("queue.json", queues);
  }

  bkg.status = "ACCEPTED";
  bkg.queue_number = nextNum;
  writeJson("bookings.json", bookings);

  const updatedQ = recalculateBusinessQueue(bkg.business_id);
  const updatedBkg = readJson("bookings.json").find((b) => b.id === req.params.id) || bkg;

  addNotification(
    bkg.customer_id,
    `Booking Accepted • Queue #${nextNum}`,
    `Your booking has been accepted by ${bkg.business_name}. Your live queue token is #${nextNum}.`,
    "booking_accepted",
    bkg.id
  );
  res.json({ booking: updatedBkg, queue: updatedQ });
});

app.put("/api/bookings/:id/reject", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const bookings = readJson("bookings.json");
  const bkg = bookings.find((b) => b.id === req.params.id);
  if (!bkg) return res.status(404).json({ detail: "Booking not found." });

  bkg.status = "REJECTED";
  bkg.rejection_reason = req.body?.reason || "Selected time slot is fully booked. Please pick another time.";
  bkg.queue_number = null;
  writeJson("bookings.json", bookings);

  const updatedQ = recalculateBusinessQueue(bkg.business_id);
  addNotification(
    bkg.customer_id,
    "Booking Rejected",
    `Your booking at ${bkg.business_name} could not be confirmed: ${bkg.rejection_reason}`,
    "booking_rejected",
    bkg.id
  );
  res.json({ booking: bkg, queue: updatedQ });
});

app.put("/api/bookings/:id/cancel", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const bookings = readJson("bookings.json");
  const bkg = bookings.find((b) => b.id === req.params.id);
  if (!bkg) return res.status(404).json({ detail: "Booking not found." });
  if (user.role !== "owner" && bkg.customer_id !== user.id) {
    return res.status(403).json({ detail: "Not authorized to cancel this booking." });
  }

  bkg.status = "CANCELLED";
  writeJson("bookings.json", bookings);
  const updatedQ = recalculateBusinessQueue(bkg.business_id);
  res.json({ booking: bkg, queue: updatedQ });
});

app.put("/api/bookings/:id/start", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const bookings = readJson("bookings.json");
  const bkg = bookings.find((b) => b.id === req.params.id);
  if (!bkg) return res.status(404).json({ detail: "Booking not found." });

  bookings.forEach((other) => {
    if (other.business_id === bkg.business_id && other.status === "SERVING" && other.id !== bkg.id) {
      other.status = "COMPLETED";
    }
  });

  if (!bkg.queue_number) {
    const queues = readJson("queue.json");
    const qState = queues.find((q) => q.business_id === bkg.business_id);
    const nextNum = (qState?.last_issued_number || 18) + 1;
    if (qState) {
      qState.last_issued_number = nextNum;
      writeJson("queue.json", queues);
    }
    bkg.queue_number = nextNum;
  }

  bkg.status = "SERVING";
  bkg.people_ahead = 0;
  bkg.estimated_wait = 0;
  writeJson("bookings.json", bookings);

  const updatedQ = recalculateBusinessQueue(bkg.business_id);
  addNotification(
    bkg.customer_id,
    "Service Started!",
    `Your service (${bkg.service_name}) at ${bkg.business_name} has started!`,
    "service_started",
    bkg.id
  );
  res.json({ booking: bkg, queue: updatedQ });
});

app.put("/api/bookings/:id/complete", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const bookings = readJson("bookings.json");
  const bkg = bookings.find((b) => b.id === req.params.id);
  if (!bkg) return res.status(404).json({ detail: "Booking not found." });

  bkg.status = "COMPLETED";
  bkg.people_ahead = 0;
  bkg.estimated_wait = 0;
  writeJson("bookings.json", bookings);

  const updatedQ = recalculateBusinessQueue(bkg.business_id);
  addNotification(
    bkg.customer_id,
    "Service Completed • Rate Your Visit",
    `Thank you for visiting ${bkg.business_name}! Please leave a review.`,
    "service_completed",
    bkg.id
  );
  res.json({ booking: bkg, queue: updatedQ });
});

// ==================================================
// QUEUE MANAGEMENT ROUTES
// ==================================================
function getBusinessQueuePayload(businessId: string) {
  const qState = recalculateBusinessQueue(businessId);
  const bookings = readJson("bookings.json");
  const active = bookings
    .filter(
      (b) =>
        b.business_id === businessId &&
        ["SERVING", "ACCEPTED", "WAITING", "CONFIRMED"].includes(b.status) &&
        b.queue_number != null
    )
    .sort((a, b) => (a.queue_number || 9999) - (b.queue_number || 9999));
  return { queue: qState, queue_bookings: active };
}

app.get("/api/queue/:business_id", (req: Request, res: Response) => {
  res.json(getBusinessQueuePayload(req.params.business_id));
});

app.put("/api/queue/:business_id/next", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const businessId = req.params.business_id;
  const bookings = readJson("bookings.json");

  bookings.forEach((b) => {
    if (b.business_id === businessId && b.status === "SERVING") {
      b.status = "COMPLETED";
    }
  });

  const waiting = bookings
    .filter(
      (b) =>
        b.business_id === businessId &&
        ["ACCEPTED", "WAITING", "CONFIRMED"].includes(b.status) &&
        b.queue_number != null
    )
    .sort((a, b) => (a.queue_number || 9999) - (b.queue_number || 9999));

  if (waiting.length > 0) {
    waiting[0].status = "SERVING";
    waiting[0].people_ahead = 0;
    waiting[0].estimated_wait = 0;
    addNotification(
      waiting[0].customer_id,
      `It's Your Turn! Queue #${waiting[0].queue_number}`,
      `${waiting[0].business_name} is now serving your token #${waiting[0].queue_number}.`,
      "service_started",
      waiting[0].id
    );
  }

  writeJson("bookings.json", bookings);
  res.json(getBusinessQueuePayload(businessId));
});

app.put("/api/queue/:business_id/complete", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const businessId = req.params.business_id;
  const bookings = readJson("bookings.json");
  bookings.forEach((b) => {
    if (b.business_id === businessId && b.status === "SERVING") {
      b.status = "COMPLETED";
    }
  });
  writeJson("bookings.json", bookings);
  res.json(getBusinessQueuePayload(businessId));
});

app.put("/api/queue/:business_id/skip", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const businessId = req.params.business_id;
  const bookings = readJson("bookings.json");
  const serving = bookings.find((b) => b.business_id === businessId && b.status === "SERVING");
  if (serving) {
    serving.status = "NO_SHOW";
  }
  writeJson("bookings.json", bookings);
  res.json(getBusinessQueuePayload(businessId));
});

app.put("/api/queue/:business_id/pause", (req: Request, res: Response) => {
  const user = requireOwnerUser(req, res);
  if (!user) return;
  const businessId = req.params.business_id;
  const queues = readJson("queue.json");
  const qState = queues.find((q) => q.business_id === businessId);
  if (qState) {
    qState.is_paused = !qState.is_paused;
    writeJson("queue.json", queues);
  }
  res.json(getBusinessQueuePayload(businessId));
});

// ==================================================
// CHAT, REVIEWS, FAVORITES & NOTIFICATIONS
// ==================================================
app.get("/api/messages/:booking_id", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const messages = readJson("messages.json");
  let changed = false;
  messages.forEach((m) => {
    if (m.booking_id === req.params.booking_id && m.sender_id !== user.id && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) writeJson("messages.json", messages);
  res.json({ messages: messages.filter((m) => m.booking_id === req.params.booking_id) });
});

app.post("/api/messages", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const { booking_id, business_id, text } = req.body || {};
  const messages = readJson("messages.json");
  const bookings = readJson("bookings.json");
  const businesses = readJson("businesses.json");

  const bkg = bookings.find((b) => b.id === booking_id);
  const bizId = business_id || bkg?.business_id || "biz_1";
  const biz = businesses.find((b) => b.id === bizId);

  const msg = {
    id: generateId("msg"),
    booking_id,
    business_id: bizId,
    sender_id: user.id,
    sender_name: user.role === "owner" && biz ? biz.name : user.name,
    sender_role: user.role,
    text: String(text || "").trim(),
    timestamp: nowIso(),
    read: false,
  };
  messages.push(msg);
  writeJson("messages.json", messages);

  // Send real-time notification to the other party
  if (user.role === "owner") {
    // Owner sent message -> Notify customer
    const customerId = bkg?.customer_id;
    if (customerId) {
      addNotification(
        customerId,
        `New Message from ${biz?.name || "Salon"}`,
        `${biz?.name || "Salon"}: "${msg.text.slice(0, 80)}"`,
        "chat_message",
        booking_id || ""
      );
    }
  } else {
    // Customer sent message -> Notify salon owner
    const ownerId = biz?.owner_id || bkg?.business_owner_id;
    if (ownerId) {
      addNotification(
        ownerId,
        `New Message from ${user.name}`,
        `${user.name}: "${msg.text.slice(0, 80)}"`,
        "chat_message",
        booking_id || ""
      );
    }
  }

  res.json({ message: msg });
});

// ==================================================
// FRIEND CHAT & DIRECT MESSAGING ROUTES
// ==================================================
function cleanDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

app.get("/api/friends/search", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const q = String(req.query.q || req.query.query || "").trim().toLowerCase();
  if (!q) return res.json({ users: [] });

  const cleanQuery = cleanDigits(q);
  const allUsers = readJson("users.json");

  const matches = allUsers
    .filter((u) => {
      if (u.id === user.id) return false;
      if (cleanQuery && cleanDigits(u.phone).includes(cleanQuery)) return true;
      if (String(u.id).toLowerCase() === q || String(u.id).toLowerCase().includes(q)) return true;
      if (String(u.name).toLowerCase().includes(q)) return true;
      if (String(u.email).toLowerCase().includes(q)) return true;
      return false;
    })
    .slice(0, 10)
    .map(sanitizeUser);

  res.json({ users: matches });
});

app.get("/api/friends/conversations", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const friendMessages = readJson("friend_messages.json");
  const allUsers = new Map(readJson("users.json").map((u) => [u.id, sanitizeUser(u)]));

  const friendMap = new Map<string, { lastMessage: any; unreadCount: number }>();

  friendMessages.forEach((m) => {
    let friendId: string | null = null;
    if (m.sender_id === user.id) friendId = m.recipient_id;
    else if (m.recipient_id === user.id) friendId = m.sender_id;

    if (!friendId) return;

    const existing = friendMap.get(friendId);
    const isUnread = m.recipient_id === user.id && !m.read;

    if (!existing) {
      friendMap.set(friendId, {
        lastMessage: m,
        unreadCount: isUnread ? 1 : 0,
      });
    } else {
      if (new Date(m.timestamp) > new Date(existing.lastMessage.timestamp)) {
        existing.lastMessage = m;
      }
      if (isUnread) existing.unreadCount++;
    }
  });

  const list: any[] = [];
  friendMap.forEach((meta, fId) => {
    const friendProfile = allUsers.get(fId) || {
      id: fId,
      name: meta.lastMessage.sender_id === fId ? meta.lastMessage.sender_name : meta.lastMessage.recipient_name || "Friend",
      phone: "+91 98000 00000",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    };
    list.push({
      friend: friendProfile,
      last_message: meta.lastMessage,
      unread_count: meta.unreadCount,
    });
  });

  list.sort((a, b) => new Date(b.last_message.timestamp).getTime() - new Date(a.last_message.timestamp).getTime());
  res.json({ conversations: list });
});

app.get("/api/friends/messages/:friend_id", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const friendId = req.params.friend_id;
  const friendMessages = readJson("friend_messages.json");

  let changed = false;
  friendMessages.forEach((m) => {
    if (m.sender_id === friendId && m.recipient_id === user.id && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) writeJson("friend_messages.json", friendMessages);

  const history = friendMessages.filter(
    (m) =>
      (m.sender_id === user.id && m.recipient_id === friendId) ||
      (m.sender_id === friendId && m.recipient_id === user.id)
  );

  res.json({ messages: history });
});

app.post("/api/friends/messages", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const { friend_id, recipient_id, text } = req.body || {};
  const targetId = friend_id || recipient_id;
  if (!targetId || !text) {
    return res.status(422).json({ detail: "friend_id and text are required." });
  }

  const allUsers = readJson("users.json");
  const recipient = allUsers.find((u) => u.id === targetId);
  const friendMessages = readJson("friend_messages.json");

  const newMsg = {
    id: generateId("fmsg"),
    sender_id: user.id,
    sender_name: user.name,
    recipient_id: targetId,
    recipient_name: recipient ? recipient.name : "Friend",
    text: String(text).trim(),
    timestamp: nowIso(),
    read: false,
  };

  friendMessages.push(newMsg);
  writeJson("friend_messages.json", friendMessages);

  // Send notification to recipient
  addNotification(
    targetId,
    `New message from ${user.name}`,
    `${user.name}: "${newMsg.text.slice(0, 80)}"`,
    "friend_chat",
    user.id
  );

  res.json({ message: newMsg });
});

app.post("/api/friends/request", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const { friend_id, phone } = req.body || {};
  const allUsers = readJson("users.json");
  let target = friend_id ? allUsers.find((u) => u.id === friend_id) : null;
  if (!target && phone) {
    const qClean = cleanDigits(phone);
    target = allUsers.find((u) => cleanDigits(u.phone) === qClean);
  }

  if (!target) return res.status(404).json({ detail: "User not found with this ID or phone number." });
  if (target.id === user.id) return res.status(400).json({ detail: "Cannot send friend request to yourself." });

  addNotification(
    target.id,
    `Friend Connection Request`,
    `${user.name} (${user.phone}) wants to chat with you on StyleBook!`,
    "friend_request",
    user.id
  );

  res.json({ success: true, friend: sanitizeUser(target) });
});

// ==================================================
// NEAREST PLACE & LOCALITY GEOLOCATION ROUTE
// ==================================================
const KNOWN_LOCALITIES = [
  { name: "Connaught Place, Central Delhi", city: "Delhi", lat: 28.6315, lng: 77.2167 },
  { name: "Outer Circle, Connaught Place", city: "Delhi", lat: 28.6328, lng: 77.2197 },
  { name: "Hauz Khas Village & Market", city: "Delhi", lat: 28.5494, lng: 77.2001 },
  { name: "M Block Market, Greater Kailash 1", city: "Delhi", lat: 28.5535, lng: 77.2389 },
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

app.get("/api/location/nearest", (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(String(req.query.lat)) : null;
  const lng = req.query.lng ? parseFloat(String(req.query.lng)) : null;
  const query = req.query.query ? String(req.query.query).toLowerCase().trim() : "";

  const businesses = readJson("businesses.json");
  const queues = new Map(readJson("queue.json").map((q) => [q.business_id, q]));

  let searchLat = lat ?? 28.6315;
  let searchLng = lng ?? 77.2167;
  let detectedName = "Connaught Place, New Delhi";

  if (query) {
    const matchedLoc = KNOWN_LOCALITIES.find(
      (l) => l.name.toLowerCase().includes(query) || l.city.toLowerCase().includes(query)
    );
    if (matchedLoc) {
      searchLat = matchedLoc.lat;
      searchLng = matchedLoc.lng;
      detectedName = matchedLoc.name;
    } else {
      const matchedBiz = businesses.find(
        (b) => b.name.toLowerCase().includes(query) || b.address.toLowerCase().includes(query)
      );
      if (matchedBiz) {
        searchLat = matchedBiz.latitude || searchLat;
        searchLng = matchedBiz.longitude || searchLng;
        detectedName = matchedBiz.address;
      }
    }
  } else if (lat != null && lng != null) {
    let bestLocDist = 999999;
    KNOWN_LOCALITIES.forEach((loc) => {
      const d = calculateDistanceKm(lat, lng, loc.lat, loc.lng);
      if (d < bestLocDist) {
        bestLocDist = d;
        detectedName = `${loc.name} (~${d} km)`;
      }
    });
  }

  const sortedBiz = businesses
    .map((b) => {
      const dist = calculateDistanceKm(searchLat, searchLng, b.latitude || 28.6315, b.longitude || 77.2167);
      return {
        ...b,
        distance_km: dist,
        queue: queues.get(b.id) || { waiting_count: 2, estimated_wait_minutes: 20 },
      };
    })
    .sort((a, b) => a.distance_km - b.distance_km);

  const nearestSalon = sortedBiz[0] || null;

  res.json({
    nearest_place: detectedName,
    latitude: searchLat,
    longitude: searchLng,
    nearest_business: nearestSalon,
    distance_to_nearest_salon_km: nearestSalon?.distance_km || 0.8,
  });
});

app.post("/api/reviews", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const { booking_id, business_id, rating, comment, photo } = req.body || {};
  const reviews = readJson("reviews.json");
  const bookings = readJson("bookings.json");
  const businesses = readJson("businesses.json");

  if (reviews.some((r) => r.booking_id === booking_id)) {
    return res.status(400).json({ detail: "You have already reviewed this booking." });
  }

  const bkg = bookings.find((b) => b.id === booking_id);
  if (bkg) {
    bkg.reviewed = true;
    writeJson("bookings.json", bookings);
  }

  const newRev = {
    id: generateId("rev"),
    booking_id,
    business_id,
    customer_id: user.id,
    customer_name: user.name,
    customer_avatar: user.avatar || "",
    service_name: bkg?.service_name || "Verified Service",
    rating: Number(rating) || 5,
    comment: String(comment || "").trim(),
    photo: photo || "",
    created_at: nowIso(),
  };
  reviews.unshift(newRev);
  writeJson("reviews.json", reviews);

  const biz = businesses.find((b) => b.id === business_id);
  if (biz) {
    const bizRevs = reviews.filter((r) => r.business_id === business_id);
    biz.review_count = bizRevs.length;
    biz.rating = Math.round((bizRevs.reduce((acc, r) => acc + Number(r.rating), 0) / bizRevs.length) * 10) / 10;
    writeJson("businesses.json", businesses);
  }

  res.json({ review: newRev });
});

app.get("/api/businesses/:id/reviews", (req: Request, res: Response) => {
  const reviews = readJson("reviews.json").filter((r) => r.business_id === req.params.id);
  res.json({ reviews });
});

app.get("/api/favorites", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const favorites = readJson("favorites.json").filter((f) => f.user_id === user.id);
  const businesses = new Map(readJson("businesses.json").map((b) => [b.id, b]));
  const queues = new Map(readJson("queue.json").map((q) => [q.business_id, q]));
  const savedBusinesses = favorites
    .map((f) => {
      const b = businesses.get(f.business_id);
      if (!b) return null;
      return { ...b, queue: queues.get(b.id) || { waiting_count: 2, estimated_wait_minutes: 20 } };
    })
    .filter(Boolean);
  res.json({ favorites, businesses: savedBusinesses });
});

app.post("/api/favorites/:business_id", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const businessId = req.params.business_id;
  let favorites = readJson("favorites.json");
  const exists = favorites.some((f) => f.user_id === user.id && f.business_id === businessId);
  if (exists) {
    favorites = favorites.filter((f) => !(f.user_id === user.id && f.business_id === businessId));
    writeJson("favorites.json", favorites);
    return res.json({ saved: false, business_id: businessId });
  } else {
    favorites.push({ id: generateId("fav"), user_id: user.id, business_id: businessId, created_at: nowIso() });
    writeJson("favorites.json", favorites);
    return res.json({ saved: true, business_id: businessId });
  }
});

app.get("/api/notifications", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const notifications = readJson("notifications.json").filter((n) => n.user_id === user.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications: notifications.slice(0, 30), unread_count: unreadCount });
});

app.put("/api/notifications/:id/read", (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  const notifications = readJson("notifications.json");
  notifications.forEach((n) => {
    if (n.user_id === user.id && (req.params.id === "all" || n.id === req.params.id)) {
      n.read = true;
    }
  });
  writeJson("notifications.json", notifications);
  res.json({ success: true });
});

// ==================================================
// AI STYLE STUDIO & ASSISTANT (Gemini + Fallback)
// ==================================================
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  const message = String(req.body?.message || "");
  const msgLower = message.toLowerCase();
  const businesses = readJson("businesses.json");
  const queues = new Map(readJson("queue.json").map((q) => [q.business_id, q]));

  const fastestBiz = [...businesses].sort(
    (a, b) => (queues.get(a.id)?.estimated_wait_minutes || 30) - (queues.get(b.id)?.estimated_wait_minutes || 30)
  )[0];
  const fastestWait = queues.get(fastestBiz?.id)?.estimated_wait_minutes || 10;

  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "";
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MY_AI_API_KEY") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are StyleBook AI, the smart salon & beauty concierge for StyleBook in India.
Fastest queue salon right now: ${fastestBiz?.name} (${fastestBiz?.city}) with ~${fastestWait} min wait, starting at ₹${fastestBiz?.starting_price}.
Flagship studio: Royale Crown Atelier (Connaught Place, Delhi), serving Token #18, 35 min wait, Men's Haircut ₹399, Beard Trim ₹249, Designer Women's Cut ₹699, HydraFacial ₹1899.
Keep your answer concise (3-4 bullet points max), warm, practical, and non-medical.
Customer question: ${message}`,
      });
      if (response.text) {
        return res.json({
          reply: response.text,
          recommendations: [
            {
              title: fastestBiz?.name || "Royale Crown Atelier",
              subtitle: `~${fastestWait} min wait • Starting ₹${fastestBiz?.starting_price || 299}`,
              link: `salon-details.html?id=${fastestBiz?.id || "biz_1"}`,
            },
            {
              title: "Book Executive Haircut (₹399)",
              subtitle: "Royale Crown Atelier • Connaught Place",
              link: "booking.html?business_id=biz_1&service_id=srv_1",
            },
          ],
          provider: "gemini",
        });
      }
    } catch {
      // Fall through to deterministic style engine
    }
  }

  let reply = "";
  let recommendations: any[] = [];
  if (msgLower.includes("queue") || msgLower.includes("wait") || msgLower.includes("less")) {
    reply = `Right now, **${fastestBiz?.name}** (${fastestBiz?.city}) has the shortest live queue with only **${fastestWait} mins estimated wait**! Our flagship **Royale Crown Atelier** in Connaught Place is currently serving **Token #18** with 2 chairs open.`;
    recommendations = [
      {
        title: fastestBiz?.name,
        subtitle: `${fastestWait} min wait • Starting ₹${fastestBiz?.starting_price}`,
        link: `salon-details.html?id=${fastestBiz?.id}`,
      },
      {
        title: "Royale Crown Atelier",
        subtitle: "Connaught Place • Live Token #18",
        link: "salon-details.html?id=biz_1",
      },
    ];
  } else if (msgLower.includes("beard") || msgLower.includes("shave")) {
    reply =
      "For sharp facial hair geometry:\n• **Oval / Square Face**: Try a **Short Boxed Beard** with razor-defined cheek lines.\n• **Round Face**: Opt for an **Angular Tapered Beard** with fuller chin length.\n• **Recommended Service**: *Beard Trim & Royal Hot-Towel Sculpting (₹249, 20 mins)*.";
    recommendations = [
      {
        title: "Book Beard Trim & Hot-Towel Sculpting",
        subtitle: "₹249 • 20 mins at Royale Crown Atelier",
        link: "booking.html?business_id=biz_1&service_id=srv_2",
      },
    ];
  } else if (msgLower.includes("price") || msgLower.includes("much") || msgLower.includes("cost")) {
    reply =
      "StyleBook Transparent INR Pricing Guide:\n• **Men's Haircut & Styling**: ₹179 – ₹399\n• **Beard Styling / Hot Towel Shave**: ₹199 – ₹299\n• **Women's Designer Haircut & Blowout**: ₹499 – ₹699\n• **O3+ HydraFacial / Gold Facial**: ₹899 – ₹1,899\n• **Doorstep Home Salon Services**: Starting at ₹349";
    recommendations = [{ title: "Explore All Salons & Prices", subtitle: "15+ Verified Studios", link: "explore.html" }];
  } else {
    reply =
      "Top Stylist Recommendations for You:\n• **Men's Signature**: **Textured Crop with Low Drop Fade** — suits oval, round, and diamond face contours.\n• **Women's Signature**: **Face-Framing Curtain Layers + Warm Caramel Balayage**.\n• **Instant Booking**: Lock your slot now at **Royale Crown Atelier** or book a **Home Beauty Specialist**.";
    recommendations = [
      {
        title: "Executive Haircut & Styling (₹399)",
        subtitle: "Royale Crown Atelier • 30 mins",
        link: "booking.html?business_id=biz_1&service_id=srv_1",
      },
      {
        title: "Designer Women's Cut & Blowout (₹699)",
        subtitle: "Royale Crown Atelier • 45 mins",
        link: "booking.html?business_id=biz_1&service_id=srv_3",
      },
    ];
  }

  res.json({ reply, recommendations, provider: "StyleBook Style Engine" });
});

app.post("/api/ai/style-analysis", (req: Request, res: Response) => {
  const pref = String(req.body?.preference || "men").toLowerCase();
  const faceShape = req.body?.face_shape_hint || "Oval / Balanced Contour";
  const hairType = req.body?.hair_type_hint || "Medium-Thick Wavy Texture";

  if (pref === "women") {
    return res.json({
      analysis: {
        face_shape: faceShape,
        hair_length: "Medium-Long (Collarbone to Mid-Back)",
        hair_type: hairType,
        undertone: "Warm Golden-Neutral",
        suggested_hairstyles: [
          {
            name: "Soft Face-Framing Curtain Layers",
            match: "98% Match",
            desc: "Softens cheekbones and adds airy movement around the jawline.",
          },
          {
            name: "Textured Parisian Lob (Long Bob)",
            match: "94% Match",
            desc: "Chic, low-maintenance silhouette ideal for work and evening events.",
          },
          {
            name: "Voluminous Hollywood Blowout Waves",
            match: "92% Match",
            desc: "High-glamour bounce for festive and cocktail occasions.",
          },
        ],
        suggested_beard_or_makeup: [
          { name: "Dewy Glass-Skin Base + Soft Rose Lip", desc: "Enhances natural radiance without heavy caking." },
          { name: "Warm Bronze Smokey Eye & Feathered Brows", desc: "Ideal for evening receptions and festive gatherings." },
        ],
        suggested_colors: [
          { name: "Warm Caramel & Honey Balayage", hex: "#B57C4A" },
          { name: "Espresso Truffle Gloss", hex: "#3B271E" },
          { name: "Cinnamon Mocha Babylights", hex: "#7A4934" },
        ],
        recommended_service: {
          service_id: "srv_3",
          business_id: "biz_1",
          name: "Designer Women's Haircut & Blowout",
          price: 699,
          duration: 45,
          business_name: "Royale Crown Atelier & Unisex Lounge",
        },
        care_note:
          "Cosmetic & styling suggestion only (non-medical). Use a heat-protectant serum and sulfate-free shampoo to preserve shine.",
      },
    });
  }

  res.json({
    analysis: {
      face_shape: faceShape,
      hair_length: "Short-Medium Textured Top (2.5 - 3.5 inches)",
      hair_type: hairType,
      undertone: "Warm Olive-Neutral",
      suggested_hairstyles: [
        {
          name: "Textured Crop with Low Drop Fade",
          match: "98% Match",
          desc: "Creates clean temple structure while maximizing natural volume on top.",
        },
        {
          name: "Modern Executive Side-Part Quiff",
          match: "95% Match",
          desc: "Sharp boardroom-ready contour with tapered neckline.",
        },
        {
          name: "Messy Wavy Fringe + Mid Taper",
          match: "91% Match",
          desc: "Effortless contemporary silhouette that balances forehead proportions.",
        },
      ],
      suggested_beard_or_makeup: [
        { name: "Short Boxed Beard + Razor Line-Up", desc: "Adds crisp jawline definition without excessive bulk." },
        { name: "Heavy Designer Stubble (4mm Tapered)", desc: "Clean, low-maintenance masculine contour." },
      ],
      suggested_colors: [
        { name: "Natural Espresso Matte Blend", hex: "#2B211B" },
        { name: "Dark Ash Chestnut Highlights", hex: "#4E3829" },
        { name: "Salt & Pepper Charcoal Toning", hex: "#4B5563" },
      ],
      recommended_service: {
        service_id: "srv_7",
        business_id: "biz_1",
        name: "Complete Men's Grooming Package",
        price: 1199,
        duration: 65,
        business_name: "Royale Crown Atelier & Unisex Lounge",
      },
      care_note:
        "Cosmetic & styling suggestion only (non-medical). Apply sea-salt spray on damp hair and finish with matte clay pomade.",
    },
  });
});

app.get("/api/database-status", (_req: Request, res: Response) => {
  res.json({
    connected: !!db,
    provider: "Firebase Firestore",
    database_id: firestoreDbId,
    collections: Object.values(COLLECTION_MAP),
    cached_counts: Object.fromEntries(
      Object.entries(memoryDb).map(([f, items]) => [COLLECTION_MAP[f] || f, items.length])
    ),
  });
});

// Serve StyleBook Vanilla HTML5/CSS3/JS Frontend directly
app.use(express.static(FRONTEND_DIR));

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stylora server running on http://0.0.0.0:${PORT}`);
  // Initial sync with Cloud Firestore
  syncAllFirestore().catch((err) => {
    console.error("Initial Firestore sync encountered error:", err);
  });
});
