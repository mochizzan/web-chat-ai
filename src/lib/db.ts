/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL tidak diatur');
    pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await getPool().execute(sql, params || []);
  return rows as T;
}

/**
 * Use querySimple for queries that are incompatible with Prepared Statements (e.g. LIMIT/OFFSET with parameters)
 */
export async function querySimple<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await getPool().query(sql, params || []);
  return rows as T;
}

export async function querySingle<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const [rows] = await getPool().execute(sql, params || []);
  const arr = rows as any[];
  return arr.length > 0 ? arr[0] as T : null;
}

export async function transaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
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
 * Convert a Date or ISO string to a MySQL-compatible DATETIME string (without trailing Z).
 * MySQL does not accept the 'Z' suffix in DATETIME/TIMESTAMP columns.
 * Example: "2026-05-16T19:09:57.601Z" → "2026-05-16 19:09:57.601"
 */
export function toMySQLDatetime(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}
