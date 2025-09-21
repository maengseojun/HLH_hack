import { z } from 'zod';

export const zAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address');
export const zHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid hash');
export const zHex = z.string().regex(/^0x[0-9a-fA-F]*$/, 'Invalid hex string');
export const zUIntStr = z
  .string()
  .regex(/^\d+$/)
  .transform((v) => BigInt(v));
export const zBps = z.number().int().min(0).max(10_000);
export const zPositiveInt = z.number().int().min(0);

export const makeGuard = <T>(schema: z.ZodType<T, any, any>) =>
  (value: unknown): value is T => schema.safeParse(value).success;

export function zodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

export { z };

