# 09 - Launch Checklist & Operations Runbook

> Final production deployment, quality assurance verification, and operational guidelines for the ROOT stealth apparel platform.

---

## 1. Pre-Launch Verification Checklist

### 1.1 Infrastructure & Environment Variables

- [x] **PostgreSQL Database (Supabase)**:
  - All 4 database migrations applied (`000001` schema, `000002` RLS, `000003` triggers, `000004` storage).
  - Row-Level Security (RLS) active on all 13 tables (`profiles`, `addresses`, `products`, `orders`, etc.).
  - Database triggers active (`trigger_deduct_inventory`, `set_updated_at`).
  - Production connection pooling configured with PgBouncer.
- [x] **Stripe Payment Gateway**:
  - Live API keys generated in Stripe Dashboard (`pk_live_...`, `sk_live_...`).
  - Stripe Webhook endpoint registered: `https://rootapparel.com/api/webhooks/stripe`.
  - Webhook listening for `payment_intent.succeeded` and `payment_intent.payment_failed`.
  - Stripe Radar risk evaluation enabled with AVS (Address Verification Service) and CVC checks.
- [x] **Email Delivery (Resend)**:
  - Domain `rootapparel.com` verified with SPF, DKIM, and DMARC DNS records.
  - Production `RESEND_API_KEY` configured.
  - Order confirmation email template audited for stealth origin compliance (US virtual address in footer).
- [x] **Mobile App (Expo / EAS)**:
  - EAS Build profiles (`development`, `preview`, `production`) configured in `apps/app/eas.json`.
  - Bundle identifiers assigned (`com.root.app`).
  - App Store & Google Play metadata, icons, and splash assets verified.

---

## 2. Stealth Origin Compliance & Operational Playbook

### 2.1 Customer Facing Touchpoint Audit

| Channel              | Customer Facing Representation                                           | Underlying Execution                       |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| **Web Storefront**   | "Designed in New York. Direct-to-Consumer Elevated Basics."              | Next.js hosted on Vercel US-East           |
| **Mobile App**       | Native iOS & Android bottom-tab storefront                               | React Native / Expo SDK 52                 |
| **Order Tracking**   | "Carrier Regional Hub" → "Shipment In Transit" → "USPS Domestic Partner" | Raw scans sanitized by `stealth-sanitizer` |
| **Packaging & Tags** | Minimalist unbranded polymailers or branded ROOT mailers                 | FTC-compliant discrete garment care tags   |
| **Returns**          | US Domestic Virtual Address (Oregon / Delaware)                          | Return label routing to US 3PL hub         |

### 2.2 Customer Service Support Scripts

- **Q: Where does ROOT ship from?**
  - _Response_: "All orders are fulfilled through our dedicated carrier regional distribution network to ensure reliable domestic delivery to your doorstep."
- **Q: Why does standard delivery take 5–7 business days?**
  - _Response_: "To maintain exceptional direct-to-consumer value without retail markups, our garments undergo a multi-point quality inspection and packaging process at our regional fulfillment facility before final dispatch."
- **Q: How do returns work?**
  - _Response_: "We offer 30-day hassle-free domestic US returns. Simply generate a prepaid USPS return label through our portal to send items to our domestic returns center."

---

## 3. Security Hardening & Headers

Production security headers are actively enforced via `apps/web/next.config.js`:

- `Content-Security-Policy`: Scripts from self and Stripe Elements (`https://js.stripe.com`); styles/fonts from Google Fonts; images from Supabase Storage, Unsplash, and Picsum; `connect-src` limited to Supabase and the Stripe API (exact directives in `apps/web/next.config.js`).
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload` forcing HTTPS.
- `X-Frame-Options`: `SAMEORIGIN` preventing clickjacking.
- `X-Content-Type-Options`: `nosniff` preventing MIME confusion.
- `Referrer-Policy`: `strict-origin-when-cross-origin` preventing referrer leakage.
- `Permissions-Policy`: Restricts camera, microphone, and geolocation.

---

## 4. System Health & Telemetry Endpoint

The platform provides a public telemetry route at `/api/health`:

- **Endpoint**: `GET /api/health`
- **Output Sample**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-25T04:15:00.000Z",
    "uptimeSeconds": 1420,
    "latencyMs": 14,
    "environment": "production",
    "services": {
      "database": "connected",
      "stripe": "live",
      "resend": "configured"
    },
    "version": "1.0.0"
  }
  ```
- **Monitoring Setup**: Configure an external ping probe (BetterUptime, Pingdom, or Datadog) to alert on `status !== "healthy"` or `latencyMs > 500`.

---

## 5. Deployment & Rollback Runbook

### 5.1 Web Storefront Deployment (Vercel)

1. Merge release to `main` branch.
2. Verify GitHub Actions CI workflow passes:
   - `pnpm turbo lint`
   - `pnpm turbo typecheck`
   - `pnpm turbo test`
3. Vercel automatically creates an immutable production deployment.
4. Run live smoke test on `/api/health` and complete a test checkout transaction.

### 5.2 Instant Rollback Procedure

If a production defect occurs:

1. In Vercel Project Dashboard → **Deployments**.
2. Select previous stable deployment → Click **Promote to Production**.
3. Traffic transitions instantly with zero downtime.

### 5.3 Mobile App Release (EAS Build)

1. Execute EAS production build:
   ```bash
   cd apps/app
   eas build --platform all --profile production
   ```
2. Submit build to app stores:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```
3. Enable phased rollout (10% → 25% → 50% → 100%) in App Store Connect and Google Play Console.
