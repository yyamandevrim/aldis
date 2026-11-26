/** Allows one in-flight turn per chat (and so one Codex process for the single owner). */
export class ChatLock {
  private readonly busy = new Set<number>();

  /** Returns a release function, or null when the chat is already busy. */
  tryAcquire(chatId: number): (() => void) | null {
    if (this.busy.has(chatId)) return null;
    this.busy.add(chatId);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.busy.delete(chatId);
    };
  }

  isBusy(chatId: number): boolean {
    return this.busy.has(chatId);
  }
}
