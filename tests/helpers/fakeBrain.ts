import type { Brain, BrainEvent, BrainRunOptions } from "../../src/brain/types";

/** Brain that replays scripted events and records how it was called. */
export class FakeBrain implements Brain {
  calls: BrainRunOptions[] = [];

  constructor(private readonly script: (opts: BrainRunOptions) => BrainEvent[] | Promise<BrainEvent[]>) {}

  async *run(opts: BrainRunOptions): AsyncIterable<BrainEvent> {
    this.calls.push(opts);
    for (const ev of await this.script(opts)) yield ev;
  }
}
