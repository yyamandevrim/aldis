export interface ChunkOptions {
  /** Hard upper bound for a single chunk's length. */
  max: number;
  /** A chunk shorter than this absorbs the next paragraph when it fits. */
  min?: number;
}

/** Splits on blank lines, but never inside a ``` fenced block. */
function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  const flush = () => {
    const block = current.join("\n").trim();
    if (block) blocks.push(block);
    current = [];
  };
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (!inFence && line.trim() === "") {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

function splitHard(s: string, max: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}

/** Greedily joins pieces with `sep` while staying within `max`. */
function pack(pieces: string[], sep: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const piece of pieces) {
    if (!cur) cur = piece;
    else if (cur.length + sep.length + piece.length <= max) cur += sep + piece;
    else {
      out.push(cur);
      cur = piece;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Breaks an oversized block by lines, then sentences, then hard slices. */
function splitOversize(block: string, max: number): string[] {
  if (block.length <= max) return [block];
  const lines = block.split("\n").flatMap((line) => {
    if (line.length <= max) return [line];
    const sentences = line
      .split(/(?<=[.!?…])\s+/)
      .flatMap((s) => (s.length <= max ? [s] : splitHard(s, max)));
    return pack(sentences, " ", max);
  });
  return pack(lines, "\n", max);
}

/** Splits a reply into chat-bubble sized chunks, paragraph by paragraph. */
export function chunkText(text: string, { max, min = 280 }: ChunkOptions): string[] {
  const blocks = splitBlocks(text).flatMap((b) => splitOversize(b, max));
  const out: string[] = [];
  let cur = "";
  for (const block of blocks) {
    if (!cur) cur = block;
    else if (cur.length < min && cur.length + 2 + block.length <= max) cur += `\n\n${block}`;
    else {
      out.push(cur);
      cur = block;
    }
  }
  if (cur) out.push(cur);
  return out;
}
