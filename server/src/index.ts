import { app } from './app';
import { ENV } from './config/env';
import { checkConnection } from './config/db';

async function startServer() {
  try {
    // Verify database connectivity
    await checkConnection();
    console.log('✔ Connected to MySQL Database (exam_monitoring_db) via mysql2');

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
