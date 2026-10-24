/**
 * OpenAI access for the evals. With OPENAI_API_KEY set it calls OpenAI
 * directly; otherwise RAG_EVAL_PROXY_CMD must start evals/lib/openaiProxy.mjs
 * somewhere that has the key (it speaks JSON lines over stdin/stdout).
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';
import OpenAI from 'openai';

export interface ModelClient {
  chat(body: Record<string, unknown>): Promise<any>;
  embed(body: { model: string; input: string[] | string }): Promise<any>;
  /** The same client in the shape production code expects (openaiClient.ts). */
  asOpenAI(): OpenAI;
  close(): void;
}

export function createModelClient(): ModelClient {
  if (process.env.OPENAI_API_KEY) {
    const client = new OpenAI();
    return {
      chat: (body) => client.chat.completions.create(body as any),
      embed: (body) => client.embeddings.create(body),
      asOpenAI: () => client,
      close: () => {},
    };
  }

  const command = process.env.RAG_EVAL_PROXY_CMD;
  if (!command) {
    throw new Error('Set OPENAI_API_KEY, or RAG_EVAL_PROXY_CMD to a command that starts evals/lib/openaiProxy.mjs.');
  }
  const child: ChildProcessWithoutNullStreams = spawn('sh', ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  let nextId = 1;
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    if (!line.trim()) return;
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error));
    else waiter.resolve(message.result);
  });
  child.on('exit', (code) => {
    for (const waiter of pending.values()) waiter.reject(new Error(`OpenAI proxy exited (${code})`));
    pending.clear();
  });

  const send = (kind: 'chat' | 'embed', body: unknown) =>
    new Promise<any>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ id, kind, body })}\n`);
    });

  const client: ModelClient = {
    chat: (body) => send('chat', body),
    embed: (body) => send('embed', body),
    asOpenAI: () =>
      ({
        chat: { completions: { create: (body: unknown) => send('chat', body) } },
        embeddings: { create: (body: unknown) => send('embed', body) },
      }) as unknown as OpenAI,
    close: () => child.stdin.end(),
  };
  return client;
}
