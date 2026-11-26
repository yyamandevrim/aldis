import { describe, expect, test } from "bun:test";
import { openDb } from "../src/store/db";
import { SessionStore } from "../src/store/sessions";

describe("SessionStore", () => {
  test("set/get/overwrite/clear", () => {
    const store = new SessionStore(openDb(":memory:"));
    expect(store.get(1)).toBeNull();
    store.set(1, "a", 100);
    expect(store.get(1)).toEqual({ chatId: 1, sessionId: "a", updatedAt: 100 });
    store.set(1, "b", 200);
    expect(store.get(1)).toEqual({ chatId: 1, sessionId: "b", updatedAt: 200 });
    store.clear(1);
    expect(store.get(1)).toBeNull();
  });
});
