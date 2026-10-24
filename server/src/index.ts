import fs from 'fs';
import path from 'path';
import { app } from './app';
import { ENV } from './config/env';
import { db, checkConnection } from './config/db';

async function autoInitDatabaseIfEmpty() {
  try {
    const [rows]: any = await db.query("SHOW TABLES LIKE 'users'");
    if (!rows || rows.length === 0) {
      console.log('🔄 Fresh database detected. Auto-importing initial schema and test data...');
      const sqlPath = path.resolve(__dirname, '../../database/exam_monitoring_db.sql');
      if (fs.existsSync(sqlPath)) {
        let sql = fs.readFileSync(sqlPath, 'utf8');
        // Strip CREATE DATABASE / USE so it executes inside the connected cloud database
        sql = sql.replace(/CREATE DATABASE IF NOT EXISTS `[^`]+`[^;]*;/gi, '');
        sql = sql.replace(/USE `[^`]+`;/gi, '');
        await db.query(sql);
        console.log('✔ Initial database schema and pre-seeded test accounts imported successfully!');
      }
    }
  } catch (initErr) {
    console.warn('⚠ Database auto-init check skipped or encountered error:', initErr);
  }
}

async function startServer() {
  try {
    // Verify database connectivity
    await checkConnection();
    console.log('✔ Connected to MySQL Database via mysql2');

    // Auto-seed if empty
    await autoInitDatabaseIfEmpty();

    app.listen(ENV.PORT, () => {
      console.log(`🚀 Exam Results Monitoring API running on http://localhost:${ENV.PORT}`);
      console.log(`🌐 Client URL: ${ENV.CLIENT_URL}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
