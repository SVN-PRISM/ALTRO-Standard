import * as Firebird from 'node-firebird';
import { SecurityException, protectAndPrepare } from './QueryProtector';

export async function executeFirebirdQuery<T>(sql: string, params: unknown[]): Promise<T> {
  const host = process.env.FIREBIRD_HOST;
  const port = process.env.FIREBIRD_PORT ? Number(process.env.FIREBIRD_PORT) : 3050;
  const database = process.env.FIREBIRD_DATABASE;
  const user = process.env.FIREBIRD_USER;
  const password = process.env.FIREBIRD_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new SecurityException(
      'Data Source Unreachable: Firebird connection env variables are not fully configured.',
      undefined
    );
  }

  const options = { host, port, database, user, password };

  return new Promise<T>((resolve, reject) => {
    Firebird.attach(options, (attachErr: Error | null, db: unknown) => {
      if (attachErr || !db) {
        return reject(
          new SecurityException(
            'Data Source Unreachable: cannot connect to Firebird.',
            undefined,
            attachErr?.message
          )
        );
      }
      const connection = db as {
        query: (sql: string, params: unknown[], cb: (err: Error | null, result: T) => void) => void;
        detach: () => void;
      };
      connection.query(sql, params, (queryErr: Error | null, result: T) => {
        connection.detach();
        if (queryErr) {
          return reject(
            new SecurityException('Data Source Unreachable: Firebird query failed.', undefined, queryErr.message)
          );
        }
        resolve(result);
      });
    });
  });
}

/**
 * Выполняет защищённый запрос: проверка TDP, применение политик, затем вызов исполнителя.
 * Если исполнитель не передан, запрос только валидируется и возвращается mock (для UI без БД).
 */
export async function executeQuery<T = unknown>(
  sql: string,
  params: unknown[],
  intentVector: number[],
  context?: { entity: string; fields: string[] },
  executor?: (sql: string, params: unknown[]) => Promise<T>
): Promise<T | null> {
  const { modifiedSql, modifiedParams } = protectAndPrepare(sql, params, intentVector, context);
  if (executor) return executor(modifiedSql, modifiedParams);

  // Клиент: не импортируем и не вызываем node-firebird — иначе билд падает.
  if (typeof window !== 'undefined') {
    console.warn('[AL-DATA-GATEWAY] executeQuery called in browser context; Firebird call skipped.');
    return null;
  }

  return executeFirebirdQuery<T>(modifiedSql, modifiedParams);
}