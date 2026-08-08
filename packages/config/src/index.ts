import { z } from 'zod';

const secret = z.string().min(32);

export function parseCorsOrigins(value: string): readonly string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.some((origin) => origin === '*')) throw new Error('CORS wildcard is forbidden');
  const normalized = origins.map((origin) => {
    const parsed = new URL(origin);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    )
      throw new Error('CORS origin must be an origin-only URL');
    if (
      parsed.protocol !== 'https:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    )
      throw new Error('CORS origin must use HTTPS outside local development');
    return parsed.origin;
  });
  return Object.freeze([...new Set(normalized)]);
}

function hasProductionSecretEntropy(value: string): boolean {
  return new Set(value).size >= 10 && !/^(.)(\1)+$/u.test(value);
}

export const runtimeEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    CORS_ALLOWED_ORIGINS: z.string().default(''),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    SESSION_SECRET: secret,
    FIELD_ENCRYPTION_MASTER_KEY: secret,
    DOWNLOAD_SIGNING_SECRET: secret,
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.HOST === '127.0.0.1') {
      context.addIssue({
        code: 'custom',
        path: ['HOST'],
        message: 'production must bind an explicitly configured host',
      });
    }
    try {
      const origins = parseCorsOrigins(value.CORS_ALLOWED_ORIGINS);
      if (value.NODE_ENV === 'production' && origins.length === 0)
        context.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWED_ORIGINS'],
          message: 'production requires an explicit CORS origin allowlist',
        });
      if (
        value.NODE_ENV === 'production' &&
        origins.some((origin) => !origin.startsWith('https://'))
      )
        context.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWED_ORIGINS'],
          message: 'production CORS origins must use HTTPS',
        });
    } catch (error) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: error instanceof Error ? error.message : 'CORS origin configuration is invalid',
      });
    }
    if (value.NODE_ENV === 'production') {
      for (const key of [
        'SESSION_SECRET',
        'FIELD_ENCRYPTION_MASTER_KEY',
        'DOWNLOAD_SIGNING_SECRET',
      ] as const) {
        if (/replace|placeholder|example|change[-_ ]?me|dummy/iu.test(value[key]))
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'production secrets must not contain placeholder values',
          });
        else if (!hasProductionSecretEntropy(value[key]))
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'production secrets must contain sufficient character diversity',
          });
      }
    }
  });

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export function parseRuntimeEnvironment(source: NodeJS.ProcessEnv): RuntimeEnvironment {
  return runtimeEnvironmentSchema.parse(source);
}
