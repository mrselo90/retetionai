/**
 * OpenAI client singleton (test-friendly)
 * Keeps OpenAI construction out of module top-levels where possible.
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

/**
 * Test helper to inject a mock client.
 * (Not used in production code paths.)
 */
export function __setOpenAIClientForTests(next: OpenAI | null) {
  client = next;
}

