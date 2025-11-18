# CozyCup — School Project (Simple Scaffold)

## What this contains
A minimal Node.js + Express + EJS project scaffold for a neutral-themed "CozyCup" shop that includes:
- Neutral-themed frontend (no nebula)
- Bottom-right widget that opens a smooth AI menu (Gemini proxy endpoint included)
- Google Login (Passport) — users must login with Google
- Cart + Custom Orders — users can add a custom order and *Send*
- Sending custom orders: saved to MongoDB and emailed to admins via SMTP (nodemailer)
- Admin panel — accessible only to accounts whose email is present in `ADMIN_EMAILS`
- Order status starts as `not viewed` and appears in user's cart after sending
- All sensitive configuration is via `.env`

> Important: this is a scaffold. You **must** run `npm install` and fill `.env` values before running.

## Quick start
1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. `npm run dev` (requires nodemon) or `npm start`
4. Visit `http://localhost:3000`

## Notes
- Google login requires creating an OAuth client in Google Cloud Console; set the Redirect URI to `http://localhost:3000/auth/google/callback`.
- For Gmail SMTP, use an app password (if using two-factor) or configure properly.
- Gemini API: the frontend widget sends queries to `/api/gemini` which proxies to Gemini using `GEMINI_API_KEY`. Fill the key in `.env`.
- This scaffold is a complete starting point; further hardening (rate-limiting, input validation, production session store, helmet, CORS rules, etc.) is recommended for real deploys.

