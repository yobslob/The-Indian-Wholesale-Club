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

  /**
   * D-202: a vision model's answer about one photo (a JPEG, base64): JSON when a schema is given, else plain text.
   * Deterministic like `ask`; a photo is about 1,250 tokens, so the context is larger. With `until`, the answer
   * streams and stops as soon as `until` says the text so far is enough (a transcription past its net quantity):
   * the GPU writes about 45 words a second, so the 900 a back panel takes cost 20 s, and most are ingredients.
   */
  async see(
    model: string,
    prompt: string,
    jpegBase64: string,
    schema: unknown | null,
    until?: (text: string) => string | null,
  ): Promise<string> {
    const body = {
      model,
      messages: [{ role: 'user', content: prompt, images: [jpegBase64] }],
      ...(schema ? { format: schema } : {}),
      stream: Boolean(until),
      keep_alive: '30m',
      options: { temperature: 0, seed: 7, num_ctx: 4096, num_predict: schema ? 200 : 900 },
    };
    if (!until)
      return (
        (await this.post<{ message?: { content?: string } }>('/api/chat', body, 240)).message
          ?.content ?? ''
      );
    const stop = new AbortController();
    const res = await fetch(`${this.env.OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any([AbortSignal.timeout(240_000), stop.signal]),
    });
    if (!res.ok || !res.body)
      throw new Error(`Ollama /api/chat: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const decoder = new TextDecoder();
    let text = '';
    let pending = '';
    try {
      const reader = res.body.getReader();
      for (let r = await reader.read(); !r.done; r = await reader.read()) {
        pending += decoder.decode(r.value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const part = JSON.parse(line) as { message?: { content?: string }; error?: string };
          if (part.error) throw new Error(`Ollama /api/chat: ${part.error.slice(0, 200)}`);
          const add = part.message?.content ?? '';
          text += add;
          const enough = add.includes('\n') ? until(text) : null;
          if (enough !== null) {
            stop.abort(); // Ollama stops writing when the request closes
            return enough;
          }
        }
      }
    } catch (error) {
      if (stop.signal.aborted) return text;
      throw error;
    }
    return text;
  }

  /** D-202: how much of a loaded model sits in the GPU's memory (1 = all of it), or null when it is not loaded. */
  async onGpu(model: string): Promise<number | null> {
    const res = await fetch(`${this.env.OLLAMA_HOST}/api/ps`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      models?: { name: string; size: number; size_vram: number }[];
    };
    const m = body.models?.find((x) => x.name === model || x.name === `${model}:latest`);
    return m && m.size ? m.size_vram / m.size : null;
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
