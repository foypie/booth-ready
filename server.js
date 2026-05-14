require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 4242;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ordersPath = path.join(__dirname, "fulfilled-orders.json");
const dataPath = path.join(__dirname, "data", "beats.json");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/* =========================
   ADMIN AUTH
========================= */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "boothreadyadmin";
const ADMIN_COOKIE_NAME = "booth_ready_admin";
const ADMIN_COOKIE_VALUE = Buffer.from(`admin:${ADMIN_PASSWORD}`).toString("base64");

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, eqIndex));
      const value = decodeURIComponent(part.slice(eqIndex + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function isAdminAuthenticated(req) {
  const cookies = parseCookies(req);
  return cookies[ADMIN_COOKIE_NAME] === ADMIN_COOKIE_VALUE;
}

function requireAdmin(req, res, next) {
  if (isAdminAuthenticated(req)) return next();

  if (req.path.startsWith("/admin/") || req.path === "/admin/add-beat") {
    return res.status(401).json({ error: "Admin login required" });
  }

  return res.redirect("/admin-login.html");
}

/* =========================
   FALLBACK DATA
========================= */

const FALLBACK_CATALOG = [
  { slug: "60s-remix", name: "60s Remix", file: "60s-Remix.mp3", meta: "Boom Bap • Vintage Feel" },
  { slug: "60s", name: "60s", file: "60s.mp3", meta: "Classic • Warm" },
  { slug: "black-shuga", name: "Black Shuga", file: "Black_Shuga.mp3", meta: "Soulful • Boom Bap" },
  { slug: "epic", name: "Epic", file: "Epic.mp3", meta: "Cinematic • Hard-Hitting" },
  { slug: "key-witness", name: "Key Witness", file: "Key_Witness.mp3", meta: "Dark • Gritty" },
  { slug: "moonstruck", name: "Moonstruck", file: "Moonstruck.mp3", meta: "Moody • Atmospheric" },
  { slug: "mozee-along", name: "Mozee Along", file: "Mozee_Along.mp3", meta: "Smooth • Head-Nod" },
  { slug: "widgets", name: "Widgets", file: "Widgets.mp3", meta: "Modern • Punchy" },
];

const FALLBACK_LICENSES = [
  { code: "basic", name: "Basic License", price: 29 },
  { code: "premium", name: "Premium License", price: 79 },
  { code: "unlimited", name: "Unlimited License", price: 199 }
];

/* =========================
   HELPERS
========================= */

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLicense(license) {
  return {
    code: String(license.code || "").trim(),
    name: String(license.name || license.code || "License").trim(),
    price: Number(license.price),
    description: String(license.description || "").trim()
  };
}

function normalizeBeat(beat) {
  const slug = slugify(beat.slug || beat.name || "");
  const rawStatus = String(beat.status || (beat.active === false ? "hidden" : "active")).toLowerCase().trim();
  const status = ["active", "hidden", "sold"].includes(rawStatus) ? rawStatus : "active";

  return {
    ...beat,
    name: String(beat.name || "Untitled Beat").trim(),
    slug,
    file: String(beat.file || "").trim(),
    meta: String(beat.meta || beat.style || beat.description || "").replace(/\s+/g, " ").trim(),
    status,
    active: status === "active",
    updatedAt: beat.updatedAt || null
  };
}

function isBeatActive(beat) {
  const normalized = normalizeBeat(beat);
  return normalized.status === "active" && normalized.active !== false;
}

function readCatalogData() {
  try {
    if (!fs.existsSync(dataPath)) {
      return { catalog: FALLBACK_CATALOG.map(normalizeBeat), licenses: FALLBACK_LICENSES };
    }

    const raw = fs.readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return { catalog: parsed.map(normalizeBeat), licenses: FALLBACK_LICENSES };
    }

    return {
      catalog: (Array.isArray(parsed.catalog) ? parsed.catalog : FALLBACK_CATALOG).map(normalizeBeat),
      licenses: Array.isArray(parsed.licenses) ? parsed.licenses.map(normalizeLicense) : FALLBACK_LICENSES
    };
  } catch (error) {
    console.error("Read catalog error:", error.message);
    return { catalog: FALLBACK_CATALOG.map(normalizeBeat), licenses: FALLBACK_LICENSES };
  }
}

function writeCatalogData(data) {
  const dataDir = path.dirname(dataPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function readOrders() {
  try {
    if (!fs.existsSync(ordersPath)) return {};
    return JSON.parse(fs.readFileSync(ordersPath, "utf8"));
  } catch (error) {
    console.error("Read orders error:", error.message);
    return {};
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
}

function getBeatBySlug(slug) {
  const { catalog } = readCatalogData();
  return catalog.find((item) => item.slug === slug);
}

function getLicenseByCode(code) {
  const { licenses } = readCatalogData();
  return licenses.find((item) => item.code === code);
}

function getLicenseTermsPath(licenseCodeOrName) {
  const value = String(licenseCodeOrName || "").toLowerCase();
  if (value.includes("basic")) return "/licenses/basic-license.html?source=checkout";
  if (value.includes("premium")) return "/licenses/premium-license.html?source=checkout";
  if (value.includes("unlimited")) return "/licenses/unlimited-license.html?source=checkout";
  if (value.includes("exclusive")) return "/licenses/exclusive-license.html?source=checkout";
  return "/licenses/";
}

function buildLicenseTermsUrl(licenseCodeOrName) {
  return `${DOMAIN}${getLicenseTermsPath(licenseCodeOrName)}`;
}

function upsertOrder(session, extra = {}) {
  const orders = readOrders();
  const existing = orders[session.id] || {};
  orders[session.id] = {
    sessionId: session.id,
    customerEmail: session.customer_details?.email || session.customer_email || existing.customerEmail || null,
    paymentStatus: session.payment_status || existing.paymentStatus || null,
    amountTotal: session.amount_total ?? existing.amountTotal ?? null,
    beatSlug: session.metadata?.beatSlug || existing.beatSlug || null,
    beatName: session.metadata?.beatName || existing.beatName || null,
    beatFile: session.metadata?.beatFile || existing.beatFile || null,
    licenseCode: session.metadata?.licenseCode || existing.licenseCode || null,
    licenseName: session.metadata?.licenseName || existing.licenseName || null,
    licenseTermsUrl: session.metadata?.licenseTermsUrl || existing.licenseTermsUrl || buildLicenseTermsUrl(session.metadata?.licenseCode || session.metadata?.licenseName),
    downloadToken: existing.downloadToken || buildDownloadToken(session.id),
    emailSentAt: extra.emailSentAt || existing.emailSentAt || null,
    emailError: extra.emailError || existing.emailError || null,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  writeOrders(orders);
  return orders[session.id];
}

function getTokenSecret() {
  return process.env.DOWNLOAD_TOKEN_SECRET || process.env.STRIPE_SECRET_KEY || ADMIN_PASSWORD || "booth-ready-download-secret";
}

function buildDownloadToken(sessionId) {
  return crypto
    .createHmac("sha256", getTokenSecret())
    .update(String(sessionId))
    .digest("hex");
}

function safeCompareToken(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function buildDownloadUrlForOrder(order) {
  const token = order.downloadToken || buildDownloadToken(order.sessionId);
  return `${DOMAIN}/download?session_id=${encodeURIComponent(order.sessionId)}&token=${encodeURIComponent(token)}`;
}

function buildOrderUrl(sessionId) {
  return `${DOMAIN}/order.html?session_id=${encodeURIComponent(sessionId)}`;
}

const AUDIO_EXTENSIONS = [".mp3", ".MP3", ".wav", ".WAV", ".m4a", ".M4A"];

function cleanAudioFilename(value) {
  return path.basename(String(value || "").replace(/\0/g, "").trim());
}

function stripAudioExtension(filename) {
  return cleanAudioFilename(filename).replace(/\.(mp3|wav|m4a)$/i, "");
}

function audioLookupKey(filename) {
  return slugify(stripAudioExtension(filename));
}

function addAudioNameVariants(set, value) {
  const cleaned = cleanAudioFilename(value);
  if (!cleaned) return;

  const rawBase = stripAudioExtension(cleaned);
  const extMatch = cleaned.match(/\.(mp3|wav|m4a)$/i);
  const preferredExts = extMatch ? [extMatch[0], ...AUDIO_EXTENSIONS] : AUDIO_EXTENSIONS;

  const bases = new Set([
    rawBase,
    rawBase.replace(/\s+/g, "_"),
    rawBase.replace(/\s+/g, "-"),
    rawBase.replace(/[_-]+/g, " "),
    slugify(rawBase),
    slugify(rawBase).replace(/-/g, "_"),
  ]);

  if (extMatch) set.add(cleaned);

  bases.forEach((base) => {
    const safeBase = cleanAudioFilename(base);
    if (!safeBase) return;
    preferredExts.forEach((ext) => set.add(`${safeBase}${ext}`));
  });
}

function resolveAudioFileForOrder(order) {
  const audioDir = path.join(__dirname, "audio");
  if (!fs.existsSync(audioDir)) return null;

  const candidates = new Set();
  addAudioNameVariants(candidates, order.beatFile);
  addAudioNameVariants(candidates, order.beatName);
  addAudioNameVariants(candidates, order.beatSlug);

  const currentBeat = order.beatSlug ? getBeatBySlug(order.beatSlug) : null;
  if (currentBeat) {
    addAudioNameVariants(candidates, currentBeat.file);
    addAudioNameVariants(candidates, currentBeat.name);
    addAudioNameVariants(candidates, currentBeat.slug);
  }

  for (const candidate of candidates) {
    const candidatePath = path.join(audioDir, candidate);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return {
        filePath: candidatePath,
        actualFilename: path.basename(candidatePath),
        downloadFilename: cleanAudioFilename(order.beatFile) || path.basename(candidatePath)
      };
    }
  }

  const candidateLowerNames = new Set(Array.from(candidates).map((name) => name.toLowerCase()));
  const candidateKeys = new Set(Array.from(candidates).map(audioLookupKey).filter(Boolean));

  const audioFiles = fs.readdirSync(audioDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  for (const filename of audioFiles) {
    const lowerName = filename.toLowerCase();
    const lookupKey = audioLookupKey(filename);

    if (candidateLowerNames.has(lowerName) || candidateKeys.has(lookupKey)) {
      const filePath = path.join(audioDir, filename);
      return {
        filePath,
        actualFilename: filename,
        downloadFilename: cleanAudioFilename(order.beatFile) || filename
      };
    }
  }

  return null;
}

function buildEmailHtml(order) {
  const amount = order.amountTotal ? `$${(order.amountTotal / 100).toFixed(2)}` : "-";
  const downloadUrl = buildDownloadUrlForOrder(order);
  const orderUrl = buildOrderUrl(order.sessionId);
  const licenseTermsUrl = order.licenseTermsUrl || buildLicenseTermsUrl(order.licenseCode || order.licenseName);

  return `
    <div style="font-family: Arial, sans-serif; background:#0b0b0b; padding:32px; color:#f5f5f5;">
      <div style="max-width:680px; margin:0 auto; background:#151515; border:1px solid rgba(255,255,255,.08); border-radius:20px; padding:32px;">
        <h1 style="margin:0 0 14px; font-size:32px;">Your Booth Ready order is confirmed</h1>
        <p style="color:#cfcfcf; line-height:1.65; margin:0 0 22px;">Thanks for your purchase. Your beat is ready now. Your purchase is governed by the Booth Ready license terms for the license selected.</p>
        <div style="background:#101010; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:18px; margin:0 0 22px;">
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>Beat</span><strong>${order.beatName || "-"}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>License</span><strong>${order.licenseName || "-"}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>Amount</span><strong>${amount}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>Status</span><strong>${order.paymentStatus || "-"}</strong></div>
        </div>
        <div style="margin:24px 0;">
          <a href="${downloadUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#c79a2b; color:#111; text-decoration:none; font-weight:700; margin:0 10px 10px 0;">Download your beat</a>
          <a href="${orderUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; border:1px solid rgba(255,255,255,.12); color:#f5f5f5; text-decoration:none; margin:0 10px 10px 0;">Open order page</a>
          <a href="${licenseTermsUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; border:1px solid rgba(255,178,92,.45); color:#ffb25c; text-decoration:none; font-weight:700; margin:0 0 10px 0;">View license terms</a>
        </div>
        <p style="color:#8e8e8e; font-size:12px; line-height:1.5;">Keep this email for your records. If you have trouble downloading, open the order page link above.</p>
      </div>
    </div>
  `;
}

async function sendDeliveryEmail(order) {
  if (!resend) throw new Error("RESEND_API_KEY is missing");
  if (!process.env.RESEND_FROM_EMAIL) throw new Error("RESEND_FROM_EMAIL is missing");
  if (!order.customerEmail) throw new Error("Customer email is missing");

  const subject = `${order.beatName} — download ready`;
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [order.customerEmail],
    subject,
    html: buildEmailHtml(order),
  });

  if (error) throw new Error(error.message || "Resend send failed");
  return data;
}

async function deliverOrderIfNeeded(order) {
  if (!order || order.paymentStatus !== "paid") return order;
  if (order.emailSentAt) return order;

  try {
    await sendDeliveryEmail(order);
    const orders = readOrders();
    if (orders[order.sessionId]) {
      orders[order.sessionId].emailSentAt = new Date().toISOString();
      orders[order.sessionId].emailError = null;
      orders[order.sessionId].updatedAt = new Date().toISOString();
      writeOrders(orders);
      return orders[order.sessionId];
    }
  } catch (emailError) {
    console.error("Delivery email error:", emailError.message);
    const orders = readOrders();
    if (orders[order.sessionId]) {
      orders[order.sessionId].emailError = emailError.message;
      orders[order.sessionId].updatedAt = new Date().toISOString();
      writeOrders(orders);
      return orders[order.sessionId];
    }
  }

  return order;
}

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* =========================
   ADMIN ROUTES
   These must come BEFORE express.static so admin.html is protected.
========================= */

app.get("/admin-login.html", (req, res) => {
  if (isAdminAuthenticated(req)) return res.redirect("/admin.html");
  return res.sendFile(path.join(__dirname, "admin-login.html"));
});

app.post("/admin-login", (req, res) => {
  const submittedPassword = String(req.body.password || "");

  if (submittedPassword !== ADMIN_PASSWORD) {
    return res.redirect("/admin-login.html?error=1");
  }

  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(ADMIN_COOKIE_VALUE)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
  );

  return res.redirect("/admin.html");
});

app.get("/admin-logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
  return res.redirect("/");
});

app.get("/admin.html", requireAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, "admin.html"));
});



// ============================================================
// Title Art Engine v1 Server Helpers
// Scalable clean-art and titleArt assignment for admin-added beats.
// ============================================================

const CLEAN_ART_POOL_V1 = Array.from(
  { length: 24 },
  (_, i) => `/assets/beat-art-pool/clean-24/art-${String(i + 1).padStart(2, "0")}.webp`
);

function stableHashV1(input) {
  const s = String(input || "");
  let hash = 0;

  for (let i = 0; i < s.length; i += 1) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function assignCleanArtV1(slug) {
  if (!CLEAN_ART_POOL_V1.length) return "";
  return CLEAN_ART_POOL_V1[stableHashV1(slug) % CLEAN_ART_POOL_V1.length];
}

function buildTitleArtV1(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      mode: "single",
      primary: "Untitled"
    };
  }

  if (words.length === 1) {
    return {
      mode: "single",
      primary: words[0]
    };
  }

  if (words.length === 2) {
    return {
      mode: "accent",
      primary: words[0],
      accent: words[1]
    };
  }

  if (words.length <= 4) {
    return {
      mode: "stacked",
      lines: words
    };
  }

  return {
    mode: "compact",
    lines: words
  };
}

app.post("/admin/add-beat", requireAdmin, (req, res) => {
  try {
    const { name, file, meta, style, description, slug } = req.body;
    const finalMeta = String(meta || style || description || "").replace(/\s+/g, " ").trim();

    if (!name || !file || !finalMeta) {
      return res.status(400).json({ error: "Beat name, audio filename, and metadata are required." });
    }

    const data = readCatalogData();
    const finalSlug = slugify(slug || name);

    if (!finalSlug) {
      return res.status(400).json({ error: "Unable to generate slug." });
    }

    if (data.catalog.some((beat) => beat.slug === finalSlug)) {
      return res.status(409).json({ error: `Beat slug already exists: ${finalSlug}` });
    }

    const newBeat = normalizeBeat({
      name: String(name).trim(),
      slug: finalSlug,
      file: String(file).trim(),
      meta: finalMeta,
      art: assignCleanArtV1(finalSlug),
      titleArt: buildTitleArtV1(String(name).trim()),
      status: "active",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    data.catalog.push(newBeat);
    writeCatalogData(data);

    return res.json({ success: true, beat: newBeat });
  } catch (error) {
    console.error("Add beat error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/catalog", requireAdmin, (req, res) => {
  const data = readCatalogData();
  res.json({ catalog: data.catalog, licenses: data.licenses });
});

app.post("/admin/beat-status", requireAdmin, (req, res) => {
  try {
    const slug = slugify(req.body.slug);
    const status = String(req.body.status || "").toLowerCase().trim();

    if (!slug) return res.status(400).json({ error: "Beat slug is required." });
    if (!["active", "hidden", "sold"].includes(status)) {
      return res.status(400).json({ error: "Status must be active, hidden, or sold." });
    }

    const data = readCatalogData();
    const index = data.catalog.findIndex((beat) => beat.slug === slug);

    if (index === -1) {
      return res.status(404).json({ error: `Beat not found: ${slug}` });
    }

    data.catalog[index] = normalizeBeat({
      ...data.catalog[index],
      status,
      active: status === "active",
      updatedAt: new Date().toISOString()
    });

    writeCatalogData(data);
    return res.json({ success: true, beat: data.catalog[index] });
  } catch (error) {
    console.error("Beat status error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   PUBLIC ROUTES + STATIC
========================= */

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/catalog", (req, res) => {
  const data = readCatalogData();
  res.json({
    catalog: data.catalog.filter(isBeatActive),
    licenses: data.licenses
  });
});

app.get("/api/session-status", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    let order = null;

    if (session.payment_status === "paid") {
      order = upsertOrder(session);
      order = await deliverOrderIfNeeded(order);
    }

    const licenseTermsUrl = order?.licenseTermsUrl || buildLicenseTermsUrl(session.metadata?.licenseCode || session.metadata?.licenseName);

    res.json({
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email || null,
      beatName: session.metadata?.beatName || null,
      beatSlug: session.metadata?.beatSlug || null,
      beatFile: session.metadata?.beatFile || null,
      licenseName: session.metadata?.licenseName || null,
      licenseCode: session.metadata?.licenseCode || null,
      licenseTermsUrl,
      amountTotal: session.amount_total || null,
      downloadUrl: order && order.paymentStatus === "paid" ? buildDownloadUrlForOrder(order) : null,
      orderUrl: buildOrderUrl(session.id),
      emailSentAt: order?.emailSentAt || null,
      emailError: order?.emailError || null
    });
  } catch (error) {
    console.error("Session status error:", error.message);
    res.status(500).json({ error: "Unable to fetch session status" });
  }
});

app.get("/api/order", (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

  const orders = readOrders();
  const order = orders[sessionId];

  if (!order) return res.status(404).json({ error: "Order not found yet" });

  res.json({
    ...order,
    licenseTermsUrl: order.licenseTermsUrl || buildLicenseTermsUrl(order.licenseCode || order.licenseName),
    downloadUrl: order.paymentStatus === "paid" ? buildDownloadUrlForOrder(order) : null,
    orderUrl: buildOrderUrl(order.sessionId)
  });
});

app.get("/download", (req, res) => {
  try {
    const sessionId = String(req.query.session_id || "");
    const token = String(req.query.token || "");

    if (!sessionId || !token) {
      return res.status(400).send("Missing download credentials.");
    }

    const orders = readOrders();
    const order = orders[sessionId];

    if (!order || order.paymentStatus !== "paid") {
      return res.status(403).send("Download unavailable.");
    }

    const expectedToken = order.downloadToken || buildDownloadToken(order.sessionId);
    if (!safeCompareToken(token, expectedToken)) {
      return res.status(403).send("Invalid download link.");
    }

    const resolvedAudio = resolveAudioFileForOrder(order);

    if (!resolvedAudio) {
      console.error("Download file not found:", {
        sessionId,
        beatSlug: order.beatSlug,
        beatName: order.beatName,
        beatFile: order.beatFile
      });
      return res.status(404).send("Audio file not found.");
    }

    return res.download(resolvedAudio.filePath, resolvedAudio.downloadFilename);
  } catch (error) {
    console.error("Download error:", error.message);
    return res.status(500).send("Download error.");
  }
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { beatSlug, licenseCode } = req.body;
    const beat = getBeatBySlug(beatSlug);
    const license = getLicenseByCode(licenseCode);

    if (!beat) {
      return res.status(400).json({ error: `Beat not found: ${beatSlug}` });
    }

    if (!isBeatActive(beat)) {
      return res.status(409).json({ error: "This beat is no longer available for purchase." });
    }

    if (!license) {
      return res.status(400).json({ error: `License not found: ${licenseCode}` });
    }

    const price = Number(license.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: `Invalid license price for ${licenseCode}` });
    }

    const licenseTermsUrl = buildLicenseTermsUrl(license.code || license.name);

    
  const checkoutLicenseTermsUrl = licenseTermsUrl.startsWith("http")
    ? licenseTermsUrl
    : `${DOMAIN}${licenseTermsUrl}`;
const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_creation: "always",
      billing_address_collection: "auto",
      consent_collection: {
      terms_of_service: "required"
    },
    custom_text: {
        submit: {
          message: `By completing this purchase, you agree to the Booth Ready ${String(license.name || "License").trim()} terms: ${checkoutLicenseTermsUrl}`
        },
      terms_of_service_acceptance: {
        message: `I agree to the [Booth Ready License Terms](${checkoutLicenseTermsUrl}) for this purchase.`
      }
      },
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${String(beat.name || "Untitled Beat").trim()} — ${String(license.name || "License").trim()}`,
            description: `Booth Ready instrumental. Purchase subject to applicable Booth Ready License Terms.`
          },
          unit_amount: Math.round(price * 100)
        },
        quantity: 1
      }],
      metadata: {
        beatSlug: String(beat.slug || ""),
        beatName: String(beat.name || ""),
        beatFile: String(beat.file || ""),
        licenseCode: String(license.code || ""),
        licenseName: String(license.name || ""),
        licenseTermsUrl
      },
      success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/cancel.html`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.post("/webhook", async (req, res) => {
  let event = req.body;

  try {
    if (WEBHOOK_SECRET) {
      const signature = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      let order = upsertOrder(session);
      await deliverOrderIfNeeded(order);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});


/* ============================================================
   Stay Connected Lead Capture v1 - 2026-05-13
   - Stores owned-audience signup records locally
   - Email required
   - Phone optional
   - SMS consent required only when phone is entered
   ============================================================ */
const SUBSCRIBERS_PATH = path.join(__dirname, "data", "subscribers.json");

function readSubscribers() {
  try {
    if (!fs.existsSync(SUBSCRIBERS_PATH)) return [];
    const raw = fs.readFileSync(SUBSCRIBERS_PATH, "utf8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Subscriber read error:", error.message);
    return [];
  }
}

function writeSubscribers(subscribers) {
  fs.mkdirSync(path.dirname(SUBSCRIBERS_PATH), { recursive: true });
  fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(subscribers, null, 2) + "\n");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function brevoRequest(method, path, payload) {
  const https = require("https");
  const apiKey = process.env.BREVO_API_KEY;
  const body = payload ? JSON.stringify(payload) : "";

  if (!apiKey) {
    const error = new Error("BREVO_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.brevo.com",
      path,
      method,
      headers: {
        "api-key": apiKey,
        "accept": "application/json",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      }
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let parsed = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            parsed = { raw };
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data: parsed });
          return;
        }

        const error = new Error(parsed.message || parsed.code || `Brevo API error ${res.statusCode}`);
        error.statusCode = res.statusCode;
        error.data = parsed;
        reject(error);
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function normalizeBrevoSmsPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return "";

  if (phone.startsWith("+")) {
    return phone;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return phone;
}

async function sendSubscriberToBrevo(record) {
  const listId = Number(process.env.BREVO_LIST_ID || 0);

  if (!Number.isInteger(listId) || listId <= 0) {
    const error = new Error("BREVO_LIST_ID is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const attributes = {};

  if (record.phone && record.smsConsent) {
    attributes.SMS = normalizeBrevoSmsPhone(record.phone);
  }

  const payload = {
    email: record.email,
    listIds: [listId],
    updateEnabled: true
  };

  if (Object.keys(attributes).length) {
    payload.attributes = attributes;
  }

  return brevoRequest("POST", "/v3/contacts", payload);
}

/* ============================================================
   Stay Connected Brevo Integration v1 - 2026-05-13
   - Email required
   - Phone optional
   - SMS consent required before phone is sent to Brevo
   - Stores live contacts in Brevo list, not local JSON
   ============================================================ */
app.post("/api/subscribe", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const smsConsent = req.body.smsConsent === true || req.body.smsConsent === "true";
    const source = String(req.body.source || "stay-connected").trim().slice(0, 80);
    const page = String(req.body.page || "/").trim().slice(0, 200);
    const now = new Date().toISOString();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (phone && !smsConsent) {
      return res.status(400).json({ error: "Please check the text-message consent box to receive SMS updates." });
    }

    const record = {
      email,
      phone,
      smsConsent,
      source,
      page,
      tags: ["booth-ready", "stay-connected"],
      updatedAt: now
    };

    if (smsConsent && phone) {
      record.smsConsentText = "I agree to receive Booth Ready text updates. Msg & data rates may apply. Reply STOP to unsubscribe.";
      record.smsConsentAt = now;
    }

    await sendSubscriberToBrevo(record);

    res.json({
      ok: true,
      provider: "brevo",
      message: "Thanks — you are on the Booth Ready list."
    });
  } catch (error) {
    console.error("Subscribe/Brevo error:", error.message, error.data || "");
    res.status(error.statusCode || 500).json({
      error: "Subscription could not be saved. Please try again."
    });
  }
});


app.use(express.static(__dirname));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
