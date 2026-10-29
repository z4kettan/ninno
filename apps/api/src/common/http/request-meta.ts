import type { Request } from 'express';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/** Who is calling, for sessions and audit entries. */
export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip ?? null, userAgent: req.header('user-agent') ?? null };
}
