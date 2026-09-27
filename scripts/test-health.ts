import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env') });

async function checkHealthRoute() {
  console.log('Testing /api/health endpoint handler...');
  // Dynamically import the GET handler
  const { GET } = await import('../apps/web/app/api/health/route');
  
  const response = await GET();
  const json = await response.json();
  console.log('Health Check Response (HTTP ' + response.status + '):');
  console.log(JSON.stringify(json, null, 2));
}

checkHealthRoute().catch((err) => {
  console.error('Health route test failed:', err);
  process.exit(1);
});
