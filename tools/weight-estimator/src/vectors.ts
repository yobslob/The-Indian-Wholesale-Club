import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './env';

import type { Ollama } from './ollama';

/**
 * Embeddings, kept on disk (.cache/, not in git) so a listing or reference is embedded once: a second run over
 * thousands of listings spends its time on the model only.
 */
export class Vectors {
  private readonly known = new Map<string, Float32Array>();
  private readonly file: string;

  constructor(
    private readonly ollama: Ollama,
    embedModel: string,
  ) {
    const dir = join(ROOT, '.cache');
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, `embeddings-${embedModel.replace(/[^a-z0-9.-]/gi, '_')}.jsonl`);
    if (existsSync(this.file)) {
      for (const line of readFileSync(this.file, 'utf8').split('\n')) {
        if (!line) continue;
        try {
          const { k, v } = JSON.parse(line) as { k: string; v: string };
          // copied out of Node's shared buffer pool, whose offsets need not be a multiple of 4
          this.known.set(k, new Float32Array(Uint8Array.from(Buffer.from(v, 'base64')).buffer));
        } catch {
          // a line cut short by a stopped run is embedded again
        }
      }
    }
  }

  private static key(text: string): string {
    return createHash('sha1').update(text).digest('hex');
  }

  /** Embeds the texts not seen before, in one batch. */
  async load(texts: string[]): Promise<void> {
    const missing = [...new Set(texts)].filter((t) => !this.known.has(Vectors.key(t)));
    if (!missing.length) return;
    const vectors = await this.ollama.embed(missing);
    const lines: string[] = [];
    missing.forEach((text, i) => {
      const k = Vectors.key(text);
      this.known.set(k, vectors[i]!);
      lines.push(JSON.stringify({ k, v: Buffer.from(vectors[i]!.buffer).toString('base64') }));
    });
    appendFileSync(this.file, `${lines.join('\n')}\n`);
  }

  of(text: string): Float32Array {
    const v = this.known.get(Vectors.key(text));
    if (!v) throw new Error(`not embedded: ${text.slice(0, 60)}`);
    return v;
  }
}
