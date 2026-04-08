Booth Ready + Resend email delivery upgrade

What this package changes
- Adds automatic delivery emails through Resend after Stripe confirms checkout
- Keeps your current local download page workflow
- Stores email send status in fulfilled-orders.json

Files included
- server.js
- .env.example
- README.txt

Before you use it
1. Create a Resend API key.
2. Verify your sending domain in Resend.
3. Use a verified sender address in RESEND_FROM_EMAIL.
4. Install the Resend SDK:
   npm install resend

Resend docs say you need an API key and a verified domain before sending, and the Node.js SDK is installed with `npm install resend`. citeturn825162search0turn825162search16
Resend API keys begin with `re_...` and authenticate requests against `https://api.resend.com`. citeturn825162search1turn825162search6

Recommended .env values
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=4242
DOMAIN=http://localhost:4242
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Booth Ready <orders@yourdomain.com>

How to install
1. Replace your existing server.js with the one in this package.
2. Merge the Resend lines from .env.example into your .env file.
3. Run:
   npm install resend
4. Restart the server:
   node server.js

How to test locally
1. Keep your site running on localhost:4242.
2. In a second terminal, run Stripe CLI forwarding:
   stripe listen --forward-to localhost:4242/webhook
3. Complete a Stripe test purchase.
4. After checkout.session.completed fires, the server will:
   - store the order
   - send the customer a delivery email through Resend

Important
- Without Stripe webhook forwarding, the email will not send automatically from the webhook path on localhost.
- Your success page and order page can still work locally even if the webhook is not forwarding, but email automation depends on the webhook.
- This package does not yet generate signed/expiring download links. It sends the current direct audio URL.

Next best upgrade after this
- signed download tokens
- branded HTML email template per license tier
- production deployment
