import * as fs from 'fs';
import * as path from 'path';

import { Client } from 'pg';

function resolveConnectionString(): string {
  const fromProcessEnv = process.env.DATABASE_URL?.trim();
  if (fromProcessEnv) {
    return fromProcessEnv;
  }

  const envPath = path.resolve(__dirname, '../apps/web/.env');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf-8').match(/^DATABASE_URL=(.*)$/m);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }

  throw new Error(
    'DATABASE_URL not set. Export DATABASE_URL or add it to apps/web/.env (see .env.example).',
  );
}

async function seedDatabase() {
  const connectionString = resolveConnectionString();

  console.log('Connecting to Supabase PostgreSQL via connection pooler...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected! Reading supabase/seed.sql...');

  const seedSql = fs.readFileSync(path.resolve(__dirname, '../supabase/seed.sql'), 'utf-8');

  console.log('Applying seed data (categories, products, variants, promo codes)...');
  await client.query(seedSql);

  console.log('Seed data successfully applied to remote Supabase database!');
  await client.end();
}

seedDatabase().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
