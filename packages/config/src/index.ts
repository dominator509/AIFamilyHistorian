import { z } from 'zod';

const secret = z.string().min(32);

function hasProductionSecretEntropy(value: string): boolean {
  return new Set(value).size >= 10 && !/^(.)(\1)+$/u.test(value);
}

export const runtimeEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
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
