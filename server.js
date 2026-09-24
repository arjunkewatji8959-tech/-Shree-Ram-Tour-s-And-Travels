/**
 * SHREE RAM TOUR'S AND TRAVELS
 * Full-stack Node.js + Express backend.
 *
 * Storage:
 * - bookings.json and enquiries.json are stored in /data.
 * - For Railway, attach a persistent Volume and mount it at /app/data.
 *
 * Security:
 * - Owner dashboard uses JWT login.
 * - ADMIN_PASSWORD should be changed in production.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION";
const DEFAULT_OWNER_PASSWORD = "895987";

const DATA_DIR = __dirname;
const OWNER_FILE = path.join(DATA_DIR, "owner.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const ENQUIRIES_FILE = path.join(DATA_DIR, "enquiries.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, "[]");
if (!fs.existsSync(ENQUIRIES_FILE)) fs.writeFileSync(ENQUIRIES_FILE, "[]");
if (!fs.existsSync(CUSTOMERS_FILE)) fs.writeFileSync(CUSTOMERS_FILE, "[]");

async function getOwnerHash() {
  if (fs.existsSync(OWNER_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(OWNER_FILE, "utf8"));
      if (data.passwordHash) return data.passwordHash;
    } catch {}
  }
  const hash = await bcrypt.hash(DEFAULT_OWNER_PASSWORD, 10);
  writeJson(OWNER_FILE, { passwordHash: hash, updatedAt: new Date().toISOString() });
  return hash;
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Data helpers ----------
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function makeId(prefix) {
  return prefix + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
}

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

const VEHICLES = {
  "Sedan": { seats: 4, rate: 15 },
  "SUV": { seats: 6, rate: 16 },
  "Innova": { seats: 7, rate: 18 },
  "Tempo Traveller": { seats: 14, rate: 20 },
  "Luxury Car": { seats: 4, rate: 30 },
  "Bus": { seats: 35, rate: 35 }
};

// ---------- Auth ----------
function requireCustomer(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "customer") throw new Error("Invalid role");
    req.customer = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Customer login required." });
  }
}

function requireOwner(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "owner") throw new Error("Invalid role");
    req.owner = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Owner login required." });
  }
}

app.post("/api/customer/register", async (req, res) => {
  const name = clean(req.body.name, 100);
  const phone = clean(req.body.phone, 20);
  const email = clean(req.body.email, 150);
  const password = clean(req.body.password, 200);
  if (!name || !/^[0-9]{10}$/.test(phone) || password.length < 6) {
    return res.status(400).json({ message: "Name, valid 10-digit mobile and 6+ character password are required." });
  }
  const customers = readJson(CUSTOMERS_FILE);
  if (customers.some(c => c.phone === phone)) return res.status(409).json({ message: "This mobile number is already registered. Please login." });
  const customer = { id: makeId("CUS"), name, phone, email, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() };
  customers.unshift(customer);
  writeJson(CUSTOMERS_FILE, customers);
  const token = jwt.sign({ role: "customer", customerId: customer.id, name: customer.name, phone: customer.phone }, JWT_SECRET, { expiresIn: "30d" });
  res.status(201).json({ token, customer: { id: customer.id, name, phone, email } });
});

app.post("/api/customer/login", async (req, res) => {
  const phone = clean(req.body.phone, 20);
  const password = clean(req.body.password, 200);
  const customer = readJson(CUSTOMERS_FILE).find(c => c.phone === phone);
  if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) return res.status(401).json({ message: "Invalid mobile number or password." });
  const token = jwt.sign({ role: "customer", customerId: customer.id, name: customer.name, phone: customer.phone }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email } });
});

app.get("/api/customer/me", requireCustomer, (req, res) => {
  const customer = readJson(CUSTOMERS_FILE).find(c => c.id === req.customer.customerId);
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  const bookings = readJson(BOOKINGS_FILE).filter(b => b.customerId === customer.id);
  res.json({ customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, createdAt: customer.createdAt }, bookings });
});

app.post("/api/auth/login", async (req, res) => {
  const password = clean(req.body.password, 200);

  const hash = await getOwnerHash();
  const ok = await bcrypt.compare(password, hash);

  if (!ok) return res.status(401).json({ message: "Invalid owner password." });

  const token = jwt.sign(
    { role: "owner", name: "Daksh Pratap Singh" },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token, owner: "Daksh Pratap Singh" });
});



app.post("/api/auth/change-password", requireOwner, async (req, res) => {
  const currentPassword = clean(req.body.currentPassword, 200);
  const newPassword = clean(req.body.newPassword, 200);
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters." });
  }
  const hash = await getOwnerHash();
  const ok = await bcrypt.compare(currentPassword, hash);
  if (!ok) return res.status(401).json({ message: "Current password is incorrect." });

  const nextHash = await bcrypt.hash(newPassword, 10);
  writeJson(OWNER_FILE, { passwordHash: nextHash, updatedAt: new Date().toISOString() });
  res.json({ message: "Owner password changed successfully. Please use the new password next time." });
});

// ---------- Public booking ----------
app.post("/api/bookings", requireCustomer, (req, res) => {
  const body = req.body || {};
  const customers = readJson(CUSTOMERS_FILE);
  const customer = customers.find(c => c.id === req.customer.customerId);
  if (!customer) return res.status(401).json({ message: "Please login before booking." });
  const vehicle = clean(body.vehicle, 50);
  const km = Number(body.km);
  const passengers = Number(body.passengers);

  if (!clean(body.name, 100) || !/^[0-9]{10}$/.test(clean(body.phone, 20))) {
    return res.status(400).json({ message: "Name and valid 10-digit mobile are required." });
  }
  if (!clean(body.date, 30) || !clean(body.from, 200) || !clean(body.to, 200)) {
    return res.status(400).json({ message: "Travel date, pickup and destination are required." });
  }
  if (!VEHICLES[vehicle] || !Number.isFinite(km) || km < 1) {
    return res.status(400).json({ message: "Valid vehicle and travel KM are required." });
  }
  if (!Number.isFinite(passengers) || passengers < 1) {
    return res.status(400).json({ message: "Passenger count is invalid." });
  }

  const packagePrices = {
    "Bhedaghat Local Tour": 2499,
    "Temple & Heritage Escape": 9999,
    "Goa 3N / 4D": 14999,
    "Manali Escape": 18999,
    "Custom Outstation": 3500
  };
  const vehicleFare = Math.round(km * VEHICLES[vehicle].rate);
  const packageFare = packagePrices[clean(body.package, 100)] || 0;
  const requestedTotal = Number(body.fareOverride);
  const fare = Number.isFinite(requestedTotal) && requestedTotal > 0 ? Math.round(requestedTotal) : vehicleFare + packageFare;
  const booking = {
    id: makeId("SRT"),
    customerId: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: clean(body.email, 150),
    date: clean(body.date, 30),
    from: clean(body.from, 200),
    to: clean(body.to, 200),
    km,
    passengers,
    vehicle,
    returnDate: clean(body.returnDate, 30),
    tripType: clean(body.tripType, 50),
    package: clean(body.package, 100),
    message: clean(body.message, 1000),
    fare,
    rate: VEHICLES[vehicle].rate,
    paymentStatus: "Pending",
    status: "Pending",
    createdAt: new Date().toISOString()
  };

  const bookings = readJson(BOOKINGS_FILE);
  bookings.unshift(booking);
  writeJson(BOOKINGS_FILE, bookings);

  res.status(201).json({
    message: "Booking request received.",
    booking
  });
});

// ---------- Public booking tracking ----------
app.get("/api/bookings/track", (req, res) => {
  const id = clean(req.query.id, 50);
  const phone = clean(req.query.phone, 20);
  const booking = readJson(BOOKINGS_FILE).find(b => b.id === id && b.phone === phone);
  if (!booking) return res.status(404).json({ message: "Booking not found. Check your booking ID and mobile number." });
  res.json({ booking });
});

// ---------- Public contact/enquiry ----------
app.post("/api/enquiries", (req, res) => {
  const body = req.body || {};
  if (!clean(body.name, 100) || !clean(body.message, 1000)) {
    return res.status(400).json({ message: "Name and message are required." });
  }

  const enquiry = {
    id: makeId("ENQ"),
    name: clean(body.name, 100),
    phone: clean(body.phone, 20),
    email: clean(body.email, 150),
    message: clean(body.message, 1000),
    createdAt: new Date().toISOString()
  };

  const enquiries = readJson(ENQUIRIES_FILE);
  enquiries.unshift(enquiry);
  writeJson(ENQUIRIES_FILE, enquiries);

  res.status(201).json({ message: "Enquiry received.", enquiry });
});

// ---------- Owner API ----------
app.get("/api/owner/bookings", requireOwner, (req, res) => {
  const bookings = readJson(BOOKINGS_FILE);
  res.json({ bookings });
});

app.patch("/api/owner/bookings/:id/status", requireOwner, (req, res) => {
  const allowed = ["Pending", "Confirmed", "Ongoing", "Cancelled", "Completed"];
  const status = clean(req.body.status, 30);
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status." });

  const bookings = readJson(BOOKINGS_FILE);
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Booking not found." });

  bookings[index].status = status;
  bookings[index].updatedAt = new Date().toISOString();
  writeJson(BOOKINGS_FILE, bookings);

  res.json({ booking: bookings[index] });
});

app.patch("/api/owner/bookings/:id/payment", requireOwner, (req, res) => {
  const allowed = ["Pending", "Paid", "Failed", "Refunded"];
  const paymentStatus = clean(req.body.paymentStatus, 30);
  if (!allowed.includes(paymentStatus)) return res.status(400).json({ message: "Invalid payment status." });
  const bookings = readJson(BOOKINGS_FILE);
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Booking not found." });
  bookings[index].paymentStatus = paymentStatus;
  bookings[index].updatedAt = new Date().toISOString();
  writeJson(BOOKINGS_FILE, bookings);
  res.json({ booking: bookings[index] });
});

app.delete("/api/owner/bookings/:id", requireOwner, (req, res) => {
  const bookings = readJson(BOOKINGS_FILE);
  const next = bookings.filter(b => b.id !== req.params.id);
  if (next.length === bookings.length) return res.status(404).json({ message: "Booking not found." });
  writeJson(BOOKINGS_FILE, next);
  res.json({ message: "Booking deleted." });
});

app.get("/api/owner/enquiries", requireOwner, (req, res) => {
  res.json({ enquiries: readJson(ENQUIRIES_FILE) });
});

app.get("/api/owner/customers", requireOwner, (req, res) => {
  const customers = readJson(CUSTOMERS_FILE);
  const bookings = readJson(BOOKINGS_FILE);
  const rows = customers.map(c => {
    const cb = bookings.filter(b => b.customerId === c.id);
    return { id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.createdAt, bookings: cb.length, totalValue: cb.reduce((a,b)=>a+Number(b.fare||0),0) };
  });
  res.json({ customers: rows });
});

app.get("/api/owner/summary", requireOwner, (req, res) => {
  const bookings = readJson(BOOKINGS_FILE);
  const enquiries = readJson(ENQUIRIES_FILE);

  res.json({
    totalBookings: bookings.length,
    pending: bookings.filter(b => b.status === "Pending").length,
    confirmed: bookings.filter(b => b.status === "Confirmed").length,
    completed: bookings.filter(b => b.status === "Completed").length,
    cancelled: bookings.filter(b => b.status === "Cancelled").length,
    ongoing: bookings.filter(b => b.status === "Ongoing").length,
    upcoming: bookings.filter(b => b.status === "Confirmed" && new Date(b.date) >= new Date()).length,
    estimatedValue: bookings.reduce((sum, b) => sum + Number(b.fare || 0), 0),
    enquiries: enquiries.length
  });
});

// ---------- Health check ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Shree Ram Tour's And Travels" });
});

// ---------- Multi-page website routes ----------
const PAGE_FILES = {
  "/": "index.html",
  "/home": "index.html",
  "/vehicles": "vehicles.html",
  "/packages": "packages.html",
  "/booking": "booking.html",
  "/gallery": "gallery.html",
  "/about": "about.html",
  "/contact": "contact.html",
  "/owner": "owner.html",
  "/owner-login": "owner-login.html",
  "/hotels": "hotels.html",
  "/destinations": "destinations.html",
  "/track-booking": "track-booking.html",
  "/customer-login": "customer-login.html",
  "/package": "package.html",
  "/booking-view": "booking-view.html"
};
for (const [route, file] of Object.entries(PAGE_FILES)) {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, file)));
}

// ---------- Frontend ----------
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Shree Ram Tours server running on port ${PORT}`);
});
