require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 4242;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ordersPath = path.join(__dirname, "fulfilled-orders.json");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const CATALOG = [
  { slug: "60s-remix", name: "60s Remix", file: "60s-Remix.mp3", meta: "Boom Bap • Vintage Feel" },
  { slug: "60s", name: "60s", file: "60s.mp3", meta: "Classic • Warm" },
  { slug: "black-shuga", name: "Black Shuga", file: "Black_Shuga.mp3", meta: "Soulful • Boom Bap" },
  { slug: "epic", name: "Epic", file: "Epic.mp3", meta: "Cinematic • Hard-Hitting" },
  { slug: "key-witness", name: "Key Witness", file: "Key_Witness.mp3", meta: "Dark • Gritty" },
  { slug: "moonstruck", name: "Moonstruck", file: "Moonstruck.mp3", meta: "Moody • Atmospheric" },
  { slug: "mozee-along", name: "Mozee Along", file: "Mozee_Along.mp3", meta: "Smooth • Head-Nod" },
  { slug: "widgets", name: "Widgets", file: "Widgets.mp3", meta: "Modern • Punchy" },
];

const LICENSES = [
  {
    code: "basic",
    name: "Basic Lease",
    price: 29,
    description: "Affordable entry license for demos, early releases, and lightweight distribution."
  },
  {
    code: "premium",
    name: "Premium Lease",
    price: 79,
    description: "Upgraded license tier for broader release use and stronger commercial flexibility."
  },
  {
    code: "unlimited",
    name: "Unlimited Lease",
    price: 199,
    description: "Highest standard lease tier before exclusives, built for serious commercial rollout."
  }
];

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
  return CATALOG.find((item) => item.slug === slug);
}

function getLicenseByCode(code) {
  return LICENSES.find((item) => item.code === code);
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
    emailSentAt: extra.emailSentAt || existing.emailSentAt || null,
    emailError: extra.emailError || existing.emailError || null,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  writeOrders(orders);
  return orders[session.id];
}

function buildDownloadUrl(beatFile) {
  return `${DOMAIN}/audio/${encodeURIComponent(beatFile)}`;
}

function buildOrderUrl(sessionId) {
  return `${DOMAIN}/order.html?session_id=${encodeURIComponent(sessionId)}`;
}

function buildEmailHtml(order) {
  const amount = order.amountTotal ? `$${(order.amountTotal / 100).toFixed(2)}` : "-";
  const downloadUrl = buildDownloadUrl(order.beatFile);
  const orderUrl = buildOrderUrl(order.sessionId);

  return `
    <div style="font-family: Arial, sans-serif; background:#0b0b0b; padding:32px; color:#f5f5f5;">
      <div style="max-width:680px; margin:0 auto; background:#151515; border:1px solid rgba(255,255,255,.08); border-radius:20px; padding:32px;">
        <h1 style="margin:0 0 14px; font-size:32px;">Your Booth Ready order is confirmed</h1>
        <p style="color:#cfcfcf; line-height:1.65; margin:0 0 22px;">
          Thanks for your purchase. Your beat is ready now.
        </p>

        <div style="background:#101010; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:18px; margin:0 0 22px;">
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>Beat</span><strong>${order.beatName || "-"}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>License</span><strong>${order.licenseName || "-"}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>Amount</span><strong>${amount}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0;"><span>Status</span><strong>${order.paymentStatus || "-"}</strong></div>
        </div>

        <div style="margin:24px 0;">
          <a href="${downloadUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#c79a2b; color:#111; text-decoration:none; font-weight:700; margin-right:10px;">Download your beat</a>
          <a href="${orderUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; border:1px solid rgba(255,255,255,.12); color:#f5f5f5; text-decoration:none;">Open order page</a>
        </div>

        <p style="color:#9f9f9f; font-size:14px; line-height:1.6; margin-top:22px;">
          This email was sent automatically after Stripe confirmed your payment.
        </p>
      </div>
    </div>
  `;
}

async function sendDeliveryEmail(order) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is missing");
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is missing");
  }
  if (!order.customerEmail) {
    throw new Error("Customer email is missing");
  }

  const subject = `${order.beatName} — download ready`;

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [order.customerEmail],
    subject,
    html: buildEmailHtml(order),
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }

  return data;
}

app.use(cors());
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/catalog", (req, res) => {
  res.json({ catalog: CATALOG, licenses: LICENSES });
});

app.get("/api/session-status", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      upsertOrder(session);
    }

    res.json({
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email || null,
      beatName: session.metadata?.beatName || null,
      beatSlug: session.metadata?.beatSlug || null,
      beatFile: session.metadata?.beatFile || null,
      licenseName: session.metadata?.licenseName || null,
      licenseCode: session.metadata?.licenseCode || null,
      amountTotal: session.amount_total || null
    });
  } catch (error) {
    console.error("Session status error:", error.message);
    res.status(500).json({ error: "Unable to fetch session status" });
  }
});

app.get("/api/order", (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  const orders = readOrders();
  const order = orders[sessionId];

  if (!order) {
    return res.status(404).json({ error: "Order not found yet" });
  }

  res.json(order);
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { beatSlug, licenseCode } = req.body;

    const beat = getBeatBySlug(beatSlug);
    const license = getLicenseByCode(licenseCode);

    if (!beat || !license) {
      return res.status(400).json({ error: "Invalid beat or license selection" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_creation: "always",
      billing_address_collection: "auto",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${beat.name} — ${license.name}`,
              description: beat.meta
            },
            unit_amount: license.price * 100
          },
          quantity: 1
        }
      ],
      metadata: {
        beatSlug: beat.slug,
        beatName: beat.name,
        beatFile: beat.file,
        licenseCode: license.code,
        licenseName: license.name
      },
      success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/cancel.html`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
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
      const order = upsertOrder(session);

      try {
        await sendDeliveryEmail(order);
        upsertOrder(session, { emailSentAt: new Date().toISOString(), emailError: null });
        console.log(`Delivery email sent for ${session.id}`);
      } catch (emailError) {
        console.error("Delivery email error:", emailError.message);
        upsertOrder(session, { emailError: emailError.message });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
