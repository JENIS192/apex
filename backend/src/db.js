const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

let pool;

async function init() {
  const { DB_HOST = 'localhost', DB_PORT = 3306, DB_USER, DB_PASSWORD, DB_NAME = 'apex_noir' } = process.env;
  const base = { host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, charset: 'utf8mb4' };

  // Create the database when permitted (skipped on managed DBs such as RDS where it already exists).
  try {
    const boot = await mysql.createConnection(base);
    await boot.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await boot.end();
  } catch (e) {
    if (e.code !== 'ER_DBACCESS_DENIED_ERROR') throw e;
  }

  // Schema runs on a dedicated multi-statement connection; the app pool stays single-statement (injection-safe).
  const schemaConn = await mysql.createConnection({ ...base, database: DB_NAME, multipleStatements: true });
  await schemaConn.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8'));
  await schemaConn.end();

  pool = mysql.createPool({ ...base, database: DB_NAME, waitForConnections: true, connectionLimit: 10, decimalNumbers: true });
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log(`\x1b[32m✅ MySQL connected successfully → ${DB_HOST}:${DB_PORT}/${DB_NAME}\x1b[0m`);

  await require('./seed')(pool);
}

module.exports = { init, get pool() { return pool; } };
