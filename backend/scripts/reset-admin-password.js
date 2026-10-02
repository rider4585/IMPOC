#!/usr/bin/env node
import 'dotenv/config';
import argon2 from 'argon2';
import { Sequelize } from 'sequelize';
import process from 'process';
import readline from 'readline';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

async function findAdmin() {
  const [results] = await sequelize.query(`
    SELECT id, uuid, username, email, status
    FROM users
    WHERE username = 'admin'
    ORDER BY id ASC
    LIMIT 1
  `);
  return results[0] || null;
}

function readPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.stdoutMuted = true;
    rl.query = prompt;
    rl.question(rl.query, (password) => {
      rl.history = rl.history.slice(1);
      rl.close();
      process.stdout.write('\n');
      resolve(password);
    });
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        if (rl.line.length < 100) {
          rl.output.write('*');
        }
      } else {
        rl.output.write(stringToWrite);
      }
    };
  });
}

async function main() {
  try {
    await sequelize.authenticate();
    const admin = await findAdmin();
    if (!admin) {
      console.error('ERROR: Admin user not found');
      process.exit(1);
    }

    let newPassword = process.argv[2];
    if (!newPassword) {
      newPassword = await readPassword('Enter new admin password: ');
    }
    if (!newPassword || newPassword.length < 8) {
      console.error('ERROR: New password must be at least 8 characters');
      console.error('Usage: npm run admin:reset-password [newPassword]');
      process.exit(1);
    }
    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await sequelize.query(
      'UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id',
      {
        replacements: { hash, id: admin.id },
      }
    );
    console.log(
      `SUCCESS: Admin password reset for username="${admin.username}" (id=${admin.id})`
    );
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
