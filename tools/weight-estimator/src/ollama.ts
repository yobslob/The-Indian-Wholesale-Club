import type { ModelEnv } from './env';

/**
 * Ollama's HTTP API on this laptop (https://github.com/ollama/ollama/blob/main/docs/api.md): /api/embed for finding
 * similar items, /api/chat with a JSON schema for the weights. Models stay loaded for 30 minutes between calls.
 */
export class Ollama {
  constructor(private readonly env: ModelEnv) {}

  get model(): string {
    return this.env.IWC_WEIGHT_MODEL;
  }

  private async post<T>(path: string, body: unknown, seconds: number): Promise<T> {
    const res = await fetch(`${this.env.OLLAMA_HOST}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(seconds * 1000),
    });
    if (!res.ok)
      throw new Error(`Ollama ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  /** The models this laptop has ("qwen2.5:7b", "nomic-embed-text:latest"). */
  async models(): Promise<string[]> {
    const res = await fetch(`${this.env.OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Ollama /api/tags: HTTP ${res.status}`);
    const body = (await res.json()) as { models?: { name: string }[] };
    return (body.models ?? []).map((m) => m.name);
  }

  /** One vector per text, 64 texts per call. */
  async embed(texts: string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const body = await this.post<{ embeddings: number[][] }>(
        '/api/embed',
        { model: this.env.IWC_EMBED_MODEL, input: texts.slice(i, i + 64), keep_alive: '30m' },
        300,
      );
      out.push(...body.embeddings.map((e) => Float32Array.from(e)));
    }
    return out;
  }

  /** The model's JSON answer; deterministic (temperature 0, one seed), so a re-run gives the same weight. */
  async ask(
    system: string,
    user: string,
    schema: unknown,
  ): Promise<{ content: string; tokens: number }> {
    const body = await this.post<{ message?: { content?: string }; eval_count?: number }>(
      '/api/chat',
      {
        model: this.env.IWC_WEIGHT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        format: schema,
        stream: false,
        keep_alive: '30m',
        options: { temperature: 0, seed: 7, num_ctx: 3072, num_predict: 600 },
      },
      180,
    );
    return { content: body.message?.content ?? '', tokens: body.eval_count ?? 0 };
  }
}
