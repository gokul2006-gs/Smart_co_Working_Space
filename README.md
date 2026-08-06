<p align="center">
  <img src="assets/animated-banner.svg" alt="Smart co Working Space" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61dafb?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/TanStack-Start-f59e0b?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-4.2-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47a248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Razorpay-Payments-2370ed?style=for-the-badge&logo=razorpay&logoColor=white" />
</p>

<p align="center">
  A full-stack coworking marketplace — discover premium workspaces, request bookings, and pay securely.
</p>

---

## ✨ Features

- **Space discovery** — browse curated coworking spaces by city, type, price, and availability
- **Booking flow** — members request bookings, owners approve or decline, with real-time status updates
- **Payment integration** — Razorpay and Stripe checkout with automatic booking confirmation on payment
- **Owner portal** — manage listings, review requests, and send payment instructions or gateway links
- **Admin panel** — full user management, booking audit trail, and platform stats
- **Email notifications** — booking confirmations, approvals, and rejections via Nodemailer (logs to console in dev)
- **JWT auth** — secure session management with httpOnly cookies

---

## 🚀 Quick start

```bash
# Install dependencies
npm install

# Copy environment file and fill in your values
cp .env.example .env

# Seed demo data (admin + space owners + spaces)
npm run seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Environment setup

```env
# Database
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/aperture

# Auth
JWT_SECRET=your-secret-key

# App URL (must match your dev port)
APP_URL=http://localhost:3000
VITE_APP_URL=http://localhost:3000

# Payment provider: razorpay | stripe | manual
PAYMENT_PROVIDER=razorpay
VITE_PAYMENT_PROVIDER=razorpay

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_CURRENCY=INR
RAZORPAY_USD_INR_RATE=83

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=usd

# Email (optional — logs to console if not set)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Admin seed credentials
ADMIN_EMAIL=admin@aperture.local
ADMIN_PASSWORD=Admin123!
```

---

## 🧪 Local Razorpay test/demo

If you're running the app locally and want to demo Razorpay in TEST mode, follow these steps:

- Use Razorpay TEST keys (they start with `rzp_test_`) in your local `.env` for `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
- Expose your local server so Razorpay can POST webhooks. Recommended: `ngrok` (requires signup) or `localtunnel` (no signup).

  ngrok example:
  ```powershell
  npx ngrok authtoken YOUR_AUTHTOKEN
  npx ngrok http 3000
  ```

  localtunnel example:
  ```powershell
  npx localtunnel --port 3000
  ```

- In the Razorpay dashboard (switch to TEST mode) add a webhook URL pointing to:
  `https://<your-tunnel-host>/api/webhooks/razorpay` and enable `payment.captured` and `payment_link.paid` events.
- Copy the webhook secret from the dashboard and set `RAZORPAY_WEBHOOK_SECRET` in your local `.env`.
- Restart the dev server: `npm run dev` and create a payment using Razorpay test card numbers (e.g. `4111 1111 1111 1111`, any future expiry, CVV `123`).

If you prefer not to configure a public webhook, the app includes a safety fallback for local demos: when `RAZORPAY_WEBHOOK_SECRET` is not set and `NODE_ENV !== 'production'`, the server will accept webhook requests for demo purposes only. For production, always set `RAZORPAY_WEBHOOK_SECRET` and keep it secret.


## 🌱 Demo accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aperture.local | Admin123! |
| Space Owner | mara@aperture.local | Password123! |
| Space Owner | devon@aperture.local | Password123! |
| Space Owner | priya@aperture.local | Password123! |

Register at `/register` to create a member account.

---

## 🛠 Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19 + Vite + Nitro) |
| Routing | TanStack Router (file-based) |
| Styling | Tailwind CSS v4, Radix UI, shadcn components |
| Database | MongoDB Atlas via Mongoose |
| Auth | JWT + bcryptjs + httpOnly cookies |
| Payments | Razorpay, Stripe, Paystack, PayU |
| Email | Nodemailer (SMTP or console fallback) |
| Validation | Zod |
| Forms | React Hook Form |
| Deployment | Vercel (Nitro preset) |

---

## 📁 Project structure

```
src/
  components/       Navbar, Footer, SpaceCard + shadcn UI
  hooks/            use-auth, use-mobile, use-scroll-reveal
  lib/              auth, booking, payment, email, db helpers
  models/           Mongoose models (User, Space, Booking)
  routes/           Pages and API endpoints (file-based routing)
scripts/
  seed-all.ts       Seeds admin + owners + spaces
  seed-admin.ts     Seeds admin account only
  seed-spaces.ts    Seeds spaces only
```

---

## 📜 Scripts

```bash
npm run dev           # Dev server (http://localhost:3000)
npm run build         # Production build
npm run preview       # Preview production build
npm run lint          # ESLint
npm run format        # Prettier
npm run seed          # Seed all demo data
npm run seed:admin    # Seed admin only
npm run seed:spaces   # Seed spaces only
```

---

## 🔄 Booking flow

```
Member requests booking
       ↓
Owner reviews → Approve / Decline
       ↓
  [With gateway]          [Manual]
Razorpay/Stripe link   Payment instructions
       ↓                      ↓
  Member pays           Owner confirms
       ↓                      ↓
   Confirmed ←————————————————
       ↓
  (past date) → Mark complete
```

---

## 🚢 Deploy to Vercel

```bash
npx vercel
```

Add all environment variables in the Vercel dashboard. The build preset is configured for Vercel automatically.

---

<p align="center">
  Built with React, TanStack, MongoDB, and Razorpay.
</p>
