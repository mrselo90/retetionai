#!/usr/bin/env node
// OpenAI proxy for the evals: reads one JSON request per line on stdin,
// {"id": 1, "kind": "chat" | "embed", "body": {...}}, and writes one JSON line
// per response, {"id": 1, "result": ...} or {"id": 1, "error": "..."}.
// Run it wherever OPENAI_API_KEY lives and point RAG_EVAL_PROXY_CMD at a
// command that starts it (e.g. over ssh), so the key never has to be copied.
import readline from 'node:readline';
import OpenAI from 'openai';

const client = new OpenAI();
const lines = readline.createInterface({ input: process.stdin });

lines.on('line', async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
    const result =
      request.kind === 'embed'
        ? await client.embeddings.create(request.body)
        : await client.chat.completions.create(request.body);
    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ id: request?.id, error: String(error?.message || error) })}\n`);
  }
});
