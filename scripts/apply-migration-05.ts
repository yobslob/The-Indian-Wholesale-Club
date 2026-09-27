import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const envPath = path.resolve(__dirname, '../apps/web/.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^DATABASE_URL=(.*)$/m);
  if (!match) {
    throw new Error('DATABASE_URL not found in apps/web/.env');
  }
  const connectionString = match[1].trim();
  console.log('Connecting to Supabase PostgreSQL...');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('Connected! Reading migration file...');

  const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260925000005_fix_triggers_and_constraints.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Executing migration 20260925000005_fix_triggers_and_constraints.sql...');
  await client.query(sql);

  console.log('Migration successfully executed!');
  await client.end();
}

main().catch((err) => {
  console.error('Error applying migration:', err);
  process.exit(1);
});
