import { createPool } from '../server/db';
import { importSqlite } from '../server/import-sqlite';
import { migrate } from '../server/schema';

const [command, source] = Bun.argv.slice(2);
const pool = createPool();
try {
  if (command === 'import-sqlite' && source) {
    await importSqlite(pool, source);
    console.log('SQLite-Bestand in PostgreSQL übernommen. Melde dich neu an.');
  } else if (!command) {
    await migrate(pool);
    console.log('PostgreSQL-Schema geprüft.');
  } else {
    throw new Error('Aufruf: bun run migrate oder bun run migrate import-sqlite PFAD');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Datenbankoperation fehlgeschlagen.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
