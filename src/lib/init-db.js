// ============================================================
// Database Initialization Script
// Run: node src/lib/init-db.js
// ============================================================
/* eslint-disable */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function main() {
  // Read DATABASE_URL from .env.local
  const envPath = path.join(__dirname, '..', '..', '.env.local');
  let databaseUrl = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/ai_chat_web';

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) databaseUrl = match[1].trim();
  }

  console.log('Connecting to MySQL...');
  const connection = await mysql.createConnection({
    uri: databaseUrl,
    multipleStatements: true,
    authPlugins: {
      'caching_sha2_password': require('mysql2/lib/auth_plugins/caching_sha2_password'),
    }
  });

  // Run schema.sql
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('Running schema.sql...');
    await connection.query(schema);
    console.log('Schema created successfully.');
  }

  // Hash password untuk admin
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Seed admin (skip if already exists)
  const [existing] = await connection.query('SELECT id FROM ai_chat_web.users WHERE id = ?', ['admin']);
  if (existing.length === 0) {
    await connection.query(
      `INSERT INTO ai_chat_web.users (id, email, name, password, role, credit) VALUES (?, ?, ?, ?, 'admin', 999999.9999)`,
      ['admin', 'admin', 'Admin', hashedPassword]
    );
    console.log(`Admin account created. Email: admin, Password: ${adminPassword}`);
  } else {
    console.log('Admin account already exists, skipping seed.');
  }

  await connection.end();
  console.log('Database initialization complete.');
}

main().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
