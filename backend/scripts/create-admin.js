'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password, name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password, name = EXCLUDED.name, role = 'admin'`,
    [email.toLowerCase(), hash, process.env.SEED_ADMIN_NAME || 'Runtime Administrator']
  );
  console.log('administrator provisioned');
  await pool.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
