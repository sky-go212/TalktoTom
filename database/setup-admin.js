#!/usr/bin/env node
/**
 * setup-admin.js — Create the first admin code in KV
 * Usage: node database/setup-admin.js [adminCode]
 * If no code given, generates a random one.
 *
 * Requires wrangler CLI configured.
 */
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

const args = process.argv.slice(2);
let adminCode = args[0];

if (!adminCode) {
  adminCode = 'ADMIN-' + randomBytes(3).toString('hex').toUpperCase();
}

console.log(`Setting admin code: ${adminCode}`);

try {
  execSync(
    `cd workers && npx wrangler kv key put --binding KV "admin:code" "${adminCode}" --remote`,
    { stdio: 'inherit' }
  );
  execSync(
    `cd workers && npx wrangler kv key put --binding KV "subservers:list" "[]" --remote`,
    { stdio: 'inherit' }
  );
  console.log('✅ Admin code set in KV');
  console.log(`\n🔑 Admin Code: ${adminCode}`);
  console.log('Keep this safe! Use it to login as Admin and create SubServers.');
} catch (err) {
  console.error('❌ Setup failed:', err.message);
}
