const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    const email = await question('Email: ');
    const name = await question('Name: ');
    const password = await question('Password: ');

    if (!email || !name || !password) {
      console.error('Error: Email, Name, and Password are required.');
      process.exit(1);
    }

    const connection = await mysql.createConnection({
      uri: process.env.DATABASE_URL || 'mysql://root:ServeBay.dev@127.0.0.1:3306/ai_chat_web'
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = `mi-labs-${uuidv4()}`;

    const [result] = await connection.execute(
      'INSERT INTO users (id, email, name, password, role, isEmailVerified, credit) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, name, hashedPassword, 'admin', 1, 25.0000]
    );

    console.log('\n✅ Admin account created successfully!');
    console.log(`ID: ${id}`);
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log('Role: admin');
    console.log('isEmailVerified: 1');

    await connection.end();
  } catch (error) {
    console.error('\n❌ Error creating admin account:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createAdmin();