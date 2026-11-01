import type { ModelEnv } from './env';

/**
 * Ollama's HTTP API on this laptop (as tools/weight-estimator): /api/chat with a JSON schema. The model stays loaded
 * for 30 minutes between calls; several calls at once are answered together when OLLAMA_NUM_PARALLEL allows.
 */
export class Ollama {
  constructor(private readonly env: ModelEnv) {}

  get model(): string {
    return this.env.IWC_DESC_MODEL;
  }

  /** Why the model cannot write now, or null when it can. */
  async problem(): Promise<string | null> {
    try {
      const res = await fetch(`${this.env.OLLAMA_HOST}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return `Ollama answered HTTP ${res.status}`;
      const names =
        ((await res.json()) as { models?: { name: string }[] }).models?.map((m) => m.name) ?? [];
      const want = this.model.includes(':') ? this.model : `${this.model}:latest`;
      return names.includes(want) ? null : `${this.model} is not on this laptop (README: Setup)`;
    } catch {
      return `Ollama is not running at ${this.env.OLLAMA_HOST} (start it from the Start menu)`;
    }
  }

  async ask(
    system: string,
    user: string,
    schema: unknown,
    seed: number,
  ): Promise<{ content: string; tokens: number }> {
    const res = await fetch(`${this.env.OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        format: schema,
        stream: false,
        keep_alive: '30m',
        // a little warmth for new wording; a new seed on every try so a retry is not the same answer again
        options: {
          temperature: 0.5,
          top_p: 0.9,
          repeat_penalty: 1.05,
          seed,
          num_ctx: 4096,
          num_predict: 600,
        },
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok)
      throw new Error(`Ollama /api/chat: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { message?: { content?: string }; eval_count?: number };
    return { content: body.message?.content ?? '', tokens: body.eval_count ?? 0 };
  }
}
