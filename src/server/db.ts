import { Pool } from 'pg';

export type Query = Pick<Pool, 'query'>;

type Binding = string | number | boolean | null | Buffer;

export async function first<Row>(db: Query, sql: string, params: Binding[] = []) {
  const result = await db.query<Row & Record<string, unknown>>(sql, params);
  return result.rows[0] as Row | undefined;
}

export async function rows<Row>(db: Query, sql: string, params: Binding[] = []) {
  const result = await db.query<Row & Record<string, unknown>>(sql, params);
  return result.rows as Row[];
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString && !process.env.PGHOST) throw new Error('DATABASE_URL oder PGHOST fehlt.');
  const pool = new Pool({ connectionString, max: 12, allowExitOnIdle: true });
  pool.on('error', () => console.error('Eine inaktive Crew-Datenbankverbindung wurde getrennt.'));
  return pool;
}

export async function writeTransaction<T>(pool: Pool, action: (db: Query) => Promise<T>) {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    // Serialize Crew writes across processes so capacity and overlap checks hold until commit.
    await connection.query('SELECT pg_advisory_xact_lock(73676607)');
    const result = await action(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
