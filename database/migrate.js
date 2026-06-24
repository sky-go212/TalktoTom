#!/usr/bin/env node
/**
 * migrate.js — Initialize D1 tables for a SubServer
 * Usage:
 *   node database/migrate.js <subId>
 *   node database/migrate.js admin   ← set admin code
 *
 * Requires: wrangler CLI + D1 database configured in workers/wrangler.toml
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const subId = args[0];

if (!subId) {
  console.error('Usage: node migrate.js <subId>');
  process.exit(1);
}

const tableId = subId.replace(/-/g, '_');
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
const sql = schema.replace(/\{SUB_ID\}/g, tableId);

// Write temp SQL file
import { writeFileSync, unlinkSync } from 'fs';
const tmpFile = '/tmp/migrate_temp.sql';
writeFileSync(tmpFile, sql);

console.log(`Migrating SubServer: ${subId} (table prefix: ${tableId})`);

try {
  execSync(
    `cd workers && npx wrangler d1 execute sky-chat-db --file=${tmpFile} --remote`,
    { stdio: 'inherit' }
  );
  console.log('✅ Migration successful');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  unlinkSync(tmpFile);
}
