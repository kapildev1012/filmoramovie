/**
 * src/lib/db-driver.ts — Platform-agnostic database driver.
 *
 * Provides a single `getDB(locals)` function that returns an object matching
 * Cloudflare D1's `prepare().bind().first()/all()/run()` interface, regardless
 * of whether the app is running on Cloudflare (native D1) or Vercel (Turso/libSQL).
 *
 * The rest of the codebase (src/lib/db.ts, API routes, pages) calls `getDB(locals)`
 * instead of `locals.runtime.env.DB` directly. On Cloudflare the D1 binding is
 * returned as-is (zero overhead). On Vercel a thin libSQL wrapper is returned.
 */

// ── Detect platform at build time ──────────────────────────────────────────
const IS_CLOUDFLARE = import.meta.env.DEPLOY_TARGET !== 'vercel';

// ── Turso/libSQL singleton (Vercel only, lazy-initialised) ─────────────────
let _tursoClient: any = null;

async function getTursoClient() {
  if (_tursoClient) return _tursoClient;

  const { createClient } = await import('@libsql/client');
  const url = import.meta.env.TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL;
  const authToken = import.meta.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set. Required for Vercel deployment.');
  }

  _tursoClient = createClient({ url, authToken });
  return _tursoClient;
}

// ── D1-compatible wrapper around libSQL ────────────────────────────────────
// D1 API shape:
//   db.prepare(sql).bind(...args).first<T>()   → T | null
//   db.prepare(sql).bind(...args).all<T>()     → { results: T[] }
//   db.prepare(sql).bind(...args).run()        → { success: boolean }
//   db.batch([stmt, stmt, ...])                → results[]

interface D1Like {
  prepare(sql: string): D1PreparedLike;
  batch(stmts: D1PreparedLike[]): Promise<any[]>;
}

interface D1PreparedLike {
  bind(...values: any[]): D1PreparedLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
  // Internal: hold the SQL + params for batch()
  _sql?: string;
  _params?: any[];
}

function createTursoD1Wrapper(client: any): D1Like {
  function makePrepared(sql: string): D1PreparedLike {
    let params: any[] = [];

    const stmt: D1PreparedLike = {
      _sql: sql,
      _params: params,

      bind(...values: any[]) {
        params = values;
        stmt._params = values;
        return stmt;
      },

      async first<T = unknown>(): Promise<T | null> {
        const result = await client.execute({ sql, args: params });
        if (!result.rows || result.rows.length === 0) return null;
        // libSQL returns rows as arrays with .columns; convert to object
        const row = result.rows[0];
        // libSQL rows already have column-name keys in newer versions
        if (typeof row === 'object' && !Array.isArray(row)) {
          return row as T;
        }
        // Fallback: build object from columns
        const obj: any = {};
        for (let i = 0; i < result.columns.length; i++) {
          obj[result.columns[i]] = (row as any)[i];
        }
        return obj as T;
      },

      async all<T = unknown>(): Promise<{ results: T[] }> {
        const result = await client.execute({ sql, args: params });
        const rows = (result.rows ?? []).map((row: any) => {
          if (typeof row === 'object' && !Array.isArray(row)) return row;
          const obj: any = {};
          for (let i = 0; i < result.columns.length; i++) {
            obj[result.columns[i]] = row[i];
          }
          return obj;
        });
        return { results: rows as T[] };
      },

      async run(): Promise<{ success: boolean }> {
        await client.execute({ sql, args: params });
        return { success: true };
      },
    };

    return stmt;
  }

  return {
    prepare: makePrepared,

    async batch(stmts: D1PreparedLike[]) {
      // libSQL transaction for atomicity (matches D1.batch behaviour)
      const transaction = await client.transaction('write');
      try {
        const results = [];
        for (const stmt of stmts) {
          const r = await transaction.execute({
            sql: stmt._sql!,
            args: stmt._params ?? [],
          });
          results.push(r);
        }
        await transaction.commit();
        return results;
      } catch (e) {
        await transaction.rollback();
        throw e;
      }
    },
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the database driver from the request locals.
 *
 * - On Cloudflare: returns `locals.runtime.env.DB` (native D1, zero overhead).
 * - On Vercel: returns a D1-compatible wrapper around Turso/libSQL.
 */
export async function getDB(locals: any): Promise<D1Like> {
  if (IS_CLOUDFLARE) {
    // Cloudflare: direct D1 binding
    return locals.runtime.env.DB;
  }

  // Vercel: Turso wrapper
  const client = await getTursoClient();
  return createTursoD1Wrapper(client);
}

/**
 * Synchronous version for Cloudflare-only paths where the D1 binding is
 * guaranteed. Falls back to throwing on Vercel (use getDB instead).
 */
export function getDBSync(locals: any): D1Like {
  if (!IS_CLOUDFLARE) {
    throw new Error('getDBSync() is only available on Cloudflare. Use getDB() on Vercel.');
  }
  return locals.runtime.env.DB;
}
