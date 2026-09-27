# 04. Backend API & Integrations

This document details the backend architecture, API routes, Supabase integrations, and third-party services for the e-commerce platform.

## 1. Supabase Client Setup Patterns

We use `@supabase/ssr` for Next.js web applications and `@supabase/supabase-js` for the React Native mobile app.

### Database Type Generation

Run the following command to generate types based on your Supabase schema:

```bash
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public > types/supabase.ts
```

### Server Client (Next.js App Router)

`lib/supabase/server.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // This can be ignored if called from a Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // This can be ignored if called from a Server Component
          }
        },
      },
    },
  );
}
```

### Browser Client (Next.js Client Components)

`lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### Middleware Client (Next.js Session Refresh)

`lib/supabase/middleware.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}
```

### Admin Service Role Client

`lib/supabase/admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
```

### React Native Client (Expo)

`lib/supabase/react-native.ts`

```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

## 2. Authentication Flows

### Profile Creation Trigger

Run this SQL in Supabase to automatically create a profile when a user signs up:

```sql
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Web Email/Password Signup

```typescript
import { createClient } from '@/lib/supabase/client';

const signUp = async (email, password, fullName) => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

## 3. API Route Handlers

> The implemented checkout flow uses PaymentIntents + Stripe Elements (not
> Stripe Checkout Sessions). The snippets below are abbreviated illustrations;
> the live route inventory is in section 4.

### `POST /api/checkout/create-intent`

Verifies stock and promo server-side, computes the authoritative breakdown,
and creates a Stripe PaymentIntent (or a clearly-marked simulator intent in
development).

```typescript
import { NextResponse } from 'next/server';
import {
  calculateCheckoutBreakdown,
  validatePromoCode,
  verifyVariantStock,
} from '@/lib/queries/orders';
import { getStripeServer, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { items, shippingAddress, shippingMethod, promoCode } = await req.json();

    // Server prices and stock are authoritative; client totals are never trusted
    const stock = await verifyVariantStock(supabaseAdmin, items);
    if (!stock.ok || !stock.verifiedItems) {
      return NextResponse.json({ error: stock.error || 'Inventory verification failed' }, { status: 409 });
    }

    const subtotal = stock.verifiedItems.reduce(
      (sum, { item, serverPriceCents }) => sum + serverPriceCents * item.quantity,
      0,
    );

    let discountCents = 0;
    if (promoCode) {
      const promo = await validatePromoCode(supabaseAdmin, promoCode, subtotal);
      if (!promo.valid) {
        return NextResponse.json({ error: promo.message || 'Invalid promo code' }, { status: 400 });
      }
      discountCents = promo.discountCents;
    }

    const breakdown = calculateCheckoutBreakdown(subtotal, discountCents, shippingMethod);

    if (isStripeConfigured()) {
      const stripe = getStripeServer();
      const intent = await stripe.paymentIntents.create({
        amount: breakdown.totalCents,
        currency: 'usd',
        receipt_email: shippingAddress.email,
      });
      return NextResponse.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        breakdown,
        isTestMode: false,
      });
    }

    // Development only: clearly-prefixed simulator intent (never accepted in production)
    return NextResponse.json({
      paymentIntentId: `mock_pi_${Date.now()}`,
      breakdown,
      isTestMode: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to start checkout. Please try again.' },
      { status: 500 },
    );
  }
}
```

### `POST /api/webhooks/stripe`

Handles Stripe webhook events.

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error: any) {
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      // Amount/currency are verified against the stored order, and processed
      // event ids are persisted for idempotency before any write happens.
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('payment_intent_id', paymentIntent.id);
      break;
    }
    // Handle other events...
  }

  return NextResponse.json({ received: true });
}
```

### `GET /api/tracking/[orderId]`

Customer-facing tracking status API.

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeTrackingEvents } from '@/lib/tracking';

export async function GET(req: Request, { params }: { params: { orderId: string } }) {
  const supabase = createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, tracking_code, status')
    .eq('id', params.orderId)
    .single();

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: events } = await supabase
    .from('tracking_events')
    .select('*')
    .eq('order_id', order.id)
    .order('event_timestamp', { ascending: false });

  return NextResponse.json({
    orderId: order.id,
    trackingNumber: order.tracking_code,
    status: order.status,
    events: sanitizeTrackingEvents(events),
  });
}
```

## 4. Implemented API Routes (Next.js)

There are **no Supabase Edge Functions** in this project — every server
responsibility lives in Next.js Route Handlers under `apps/web/app/api/`
(deployed automatically with the web app; `deploy.yml` does not push
functions).

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/checkout/create-intent` | `POST` | Stock + promo verification, server-side breakdown, Stripe PaymentIntent (or dev simulator) |
| `/api/checkout/validate-promo` | `POST` | Validates a promo code against the database and returns discount cents |
| `/api/orders/create` | `POST` | Payment verification (idempotent per payment intent), order insert at server prices, background confirmation email via `lib/email/resend.ts` |
| `/api/orders/[id]` | `GET` | Public order lookup by UUID or order number (email must match `shipping_address.email`), returns sanitized tracking events |
| `/api/webhooks/stripe` | `POST` | HMAC-verified Stripe webhook; strict amount/currency checks, processed-event idempotency, updates `payment_status` |
| `/api/webhooks/carrier` | `POST` | HMAC-signed carrier tracking events; sanitized through `@repo/shared/utils`, monotonic status mapping, `recorded: false` for unknown orders |
| `/api/admin/*` | `GET`/`POST`/`PATCH` | 9 admin routes (orders, orders/[id], products, products/[id], inventory, promo-codes, stats, tracking, categories) behind `requireAdmin()` (session + `profiles.role = 'admin'`) |
| `/api/search` | `GET` | Catalog search with sanitized `ilike` patterns |
| `/api/contact` | `POST` | Contact form intake + rate limiting + email delivery |
| `/api/newsletter` | `POST` | Newsletter signup persistence + confirmation email |
| `/api/health` | `GET` | Operational telemetry (Supabase, Stripe, Resend) |

Order confirmation emails are **not** triggered by database webhooks: the
`/api/orders/create` handler fires `sendOrderConfirmationEmail(...)` in the
background (failures are logged and never block the order response).

## 5. Payment Gateway Integration

### Stripe Workflow Details

- **Currency**: Stored as integer cents (e.g., $15.99 -> 1599) in PostgreSQL `BIGINT`.
- **Formatting utilities**: Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)` for frontend presentment.

## 6. Tracking Sanitization (shared utility)

### Status Mapping Layer

We mask the international origins (India) to present a US-native experience.

There is no tracking *proxy* service: sanitization is a pure shared function,
`packages/shared/src/utils/stealth-sanitizer.ts` (covered by
`packages/shared/tests/stealth-sanitizer.test.ts`), used by:

- `POST /api/webhooks/carrier` — sanitizes incoming carrier events before they
  are persisted (foreign locations collapse to domestic hub labels, forbidden
  vocabulary is stripped).
- `GET /api/orders/[id]` and `/admin/logistics` — re-sanitize on read as
  defense in depth, mapping raw milestones to customer-facing statuses with
  `mapTrackingMilestoneToOrderStatus` (unknown milestones never fall back to
  `in_transit`).

Event rows use the schema's own column names: `event_timestamp`,
`raw_status`, `customer_facing_status`, `location`, `description`.

## 7. Email Templates (Resend & React Email)

```tsx
// emails/OrderConfirmation.tsx
import { Html, Head, Preview, Body, Container, Text } from '@react-email/components';
import * as React from 'react';

interface OrderConfirmationProps {
  customerName: string;
  orderNumber: string;
  totalAmount: number;
}

export default function OrderConfirmation({
  customerName,
  orderNumber,
  totalAmount,
}: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Order Confirmation</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'sans-serif' }}>
        <Container>
          <Text>Hi {customerName},</Text>
          <Text>Thanks for your order #{orderNumber}.</Text>
          <Text>Total: ${(totalAmount / 100).toFixed(2)}</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## 8. Error Handling & Logging

Standardized API Error Response:

```typescript
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export function createApiError(code: ErrorCode, message: string, status: number = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}
```
