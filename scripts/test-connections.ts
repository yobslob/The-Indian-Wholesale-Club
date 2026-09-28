import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env') });

interface TestResult {
  service: string;
  target: string;
  status: 'CONNECTED' | 'FAILED' | 'CONFIG_MISSING';
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

const results: TestResult[] = [];

async function testSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    results.push({
      service: 'Supabase Database',
      target: url || 'N/A',
      status: 'CONFIG_MISSING',
      latencyMs: 0,
      error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    });
    return;
  }

  const start = Date.now();
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Test 1: Query categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug')
      .limit(5);

    if (catError) {
      throw new Error(`Categories query error: ${JSON.stringify(catError)}`);
    }

    // Test 2: Query products
    const { count: productCount, error: prodError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (prodError) {
      throw new Error(`Products query error: ${JSON.stringify(prodError)}`);
    }

    // Test 3: Query orders
    const { count: orderCount, error: ordError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (ordError) {
      throw new Error(`Orders query error: ${JSON.stringify(ordError)}`);
    }

    const latencyMs = Date.now() - start;
    results.push({
      service: 'Supabase PostgreSQL (REST API & RLS)',
      target: url,
      status: 'CONNECTED',
      latencyMs,
      details: {
        categoriesFound: categories?.length ?? 0,
        totalProducts: productCount ?? 0,
        totalOrders: orderCount ?? 0,
        sampleCategories: categories?.map((c) => c.name),
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      service: 'Supabase Database',
      target: url,
      status: 'FAILED',
      latencyMs,
      error: msg,
    });
  }
}

async function testStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    results.push({
      service: 'Stripe Payment Gateway',
      target: 'api.stripe.com',
      status: 'CONFIG_MISSING',
      latencyMs: 0,
      error: 'STRIPE_SECRET_KEY not set',
    });
    return;
  }

  const start = Date.now();
  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
    
    // Test API call to Stripe servers to verify credentials and connectivity
    const balance = await stripe.balance.retrieve();
    const latencyMs = Date.now() - start;

    results.push({
      service: 'Stripe Payment Gateway (Live API)',
      target: 'https://api.stripe.com/v1/balance',
      status: 'CONNECTED',
      latencyMs,
      details: {
        livemode: balance.livemode,
        availableCurrencies: balance.available.map((b) => b.currency),
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      service: 'Stripe Payment Gateway (Live API)',
      target: 'api.stripe.com',
      status: 'FAILED',
      latencyMs,
      error: msg,
    });
  }
}

async function testResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('re_test_...')) {
    results.push({
      service: 'Resend Email Service',
      target: 'api.resend.com',
      status: 'CONFIG_MISSING',
      latencyMs: 0,
      error: 'RESEND_API_KEY missing or placeholder',
    });
    return;
  }

  const start = Date.now();
  try {
    const resend = new Resend(apiKey);
    // Since this is a restricted sending key, test against the emails endpoint
    const res = await resend.emails.get('00000000-0000-0000-0000-000000000000');
    const latencyMs = Date.now() - start;

    // A 404 or restricted_api_key error confirms authentication with Resend succeeded
    if (
      res.error &&
      res.error.name !== 'not_found' &&
      (res.error as any).statusCode !== 404 &&
      res.error.name !== 'restricted_api_key'
    ) {
      throw new Error(res.error.message);
    }

    results.push({
      service: 'Resend Email API (Sending Key)',
      target: 'https://api.resend.com',
      status: 'CONNECTED',
      latencyMs,
      details: {
        keyType: 'Sending-Only (Production Best Practice)',
        authenticated: true,
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      service: 'Resend Email API',
      target: 'api.resend.com',
      status: 'FAILED',
      latencyMs,
      error: msg,
    });
  }
}

async function run() {
  console.log('====================================================');
  console.log('IWC - live connection check (Supabase, Stripe, Resend)');
  console.log(`Node.js Version: ${process.version}`);
  console.log('====================================================\n');

  await testSupabase();
  await testStripe();
  await testResend();

  console.log(JSON.stringify(results, null, 2));

  const allPassed = results.every((r) => r.status === 'CONNECTED');
  if (allPassed) {
    console.log('\n[SUCCESS] ALL EXTERNAL CONNECTIONS ACTIVE AND HEALTHY!');
    process.exit(0);
  } else {
    console.log('\n[ATTENTION] SOME CONNECTIONS HAD WARNINGS/FAILURES (SEE DETAILS ABOVE).');
    process.exit(1);
  }
}

run();
