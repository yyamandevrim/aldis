import { describe, expect, test } from "bun:test";
import type { Context } from "grammy";
import { authGuard } from "../src/bot/authGuard";
import { ChatLock } from "../src/bot/chatLock";

describe("authGuard", () => {
  const run = async (fromId?: number) => {
    let called = false;
    const ctx = { from: fromId === undefined ? undefined : { id: fromId } } as unknown as Context;
    await authGuard(42)(ctx, async () => {
      called = true;
    });
    return called;
  };

  test("passes owner", async () => expect(await run(42)).toBe(true));
  test("drops others", async () => expect(await run(7)).toBe(false));
  test("drops anonymous", async () => expect(await run()).toBe(false));
});

describe("ChatLock", () => {
  test("one holder per chat, release is idempotent", () => {
    const lock = new ChatLock();
    const release = lock.tryAcquire(1);
    expect(release).not.toBeNull();
    expect(lock.tryAcquire(1)).toBeNull();
    expect(lock.tryAcquire(2)).not.toBeNull();
    release!();
    release!();
    expect(lock.isBusy(1)).toBe(false);
    expect(lock.tryAcquire(1)).not.toBeNull();
  });
});
