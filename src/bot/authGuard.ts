import type { Context, NextFunction } from "grammy";

/** Silently drops every update that is not from the owner. */
export function authGuard(allowedUserId: number) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (ctx.from?.id !== allowedUserId) return;
    await next();
  };
}
