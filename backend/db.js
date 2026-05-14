const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // maximum pool size
  idleTimeoutMillis: 30_000,  // close idle clients after 30s
  connectionTimeoutMillis: 5_000, // fail fast if all connections busy
});

module.exports = pool;
