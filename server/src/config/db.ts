import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ENV } from './env';

/**
 * Parse database connection options from DATABASE_URL.
 * Supports standard format: mysql://user:password@host:port/database
 */
function getDatabaseConfig() {
  try {
    const parsed = new URL(ENV.DATABASE_URL);

    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'exam_monitoring_db',
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'exam_monitoring_db',
    };
  }
}

const config = getDatabaseConfig();

/**
 * Shared MySQL Connection Pool
 * Configured with sane connection limits and keep-alive for local XAMPP / MariaDB.
 */
export const db: Pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: false,
  multipleStatements: true,
});

/**
 * Execute a parameterized SELECT query returning an array of rows.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await db.query<RowDataPacket[] & T[]>(sql, params);
  return rows as T[];
}

/**
 * Execute a parameterized SELECT query returning the first matching row or null.
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const [rows] = await db.query<RowDataPacket[] & T[]>(sql, params);
  return (rows[0] as T) || null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement.
 */
export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
}

/**
 * Execute a series of queries inside an atomic transaction.
 * Automatically handles COMMIT on success and ROLLBACK on error.
 */
export async function withTransaction<T>(
  callback: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Helper to test live connectivity to MySQL.
 */
export async function checkConnection(): Promise<void> {
  await db.query('SELECT 1');
}
