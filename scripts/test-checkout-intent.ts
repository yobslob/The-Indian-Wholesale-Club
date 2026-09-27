import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env') });

async function testPaymentIntentHandshake() {
  console.log('Testing Stripe PaymentIntent live handshake with database stock verification...');
  const { POST } = await import('../apps/web/app/api/checkout/create-intent/route');
  const { supabaseAdmin } = await import('../apps/web/lib/supabase/admin');

  // Query one live variant and its product from the database
  const { data: variants, error } = await supabaseAdmin
    .from('product_variants')
    .select('id, product_id, inventory_count, price_cents, products(id, name, slug, base_price_cents)')
    .limit(1);

  if (error || !variants || variants.length === 0) {
    throw new Error('Could not retrieve a variant from database: ' + JSON.stringify(error));
  }

  const variant = variants[0];
  const prod = variant.products as any;
  console.log(`Using live variant: ${variant.id} for "${prod.name}" (Inventory: ${variant.inventory_count})`);

  // Simulate a real customer checkout request
  const mockReq = new Request('http://localhost:3000/api/checkout/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          variantId: variant.id,
          productId: prod.id,
          productName: prod.name,
          productSlug: prod.slug,
          priceCents: prod.base_price_cents,
          quantity: 1,
        },
      ],
      shippingAddress: {
        email: 'jane.doe@example.com',
        fullName: 'Jane Doe',
        line1: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        phone: '212-555-0199',
      },
      shippingMethod: 'standard',
      promoCode: 'ROOT20', // Test promo code discount calculation live
    }),
  });

  const response = await POST(mockReq);
  const json = await response.json();

  console.log('Stripe Intent Response (HTTP ' + response.status + '):');
  console.log(JSON.stringify(json, null, 2));

  if (response.status === 200 && json.clientSecret && json.clientSecret.startsWith('pi_')) {
    console.log('\n[SUCCESS] Stripe live handshake verified! Real PaymentIntent created.');
    console.log(`PaymentIntent ID: ${json.clientSecret.split('_secret_')[0]}`);
    console.log(`Breakdown Total: $${(json.breakdown.totalCents / 100).toFixed(2)}`);
  } else {
    console.error('\n[FAILURE] PaymentIntent creation returned unexpected structure.');
    process.exit(1);
  }
}

testPaymentIntentHandshake().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
