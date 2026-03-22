import { getOpenAIClient } from '../openaiClient.js';
import { getDefaultEmbeddingModel } from '../runtimeModelSettings.js';
import { getEmbeddingDimensionForModel } from './config.js';

export class EmbeddingService {
  async getModel(): Promise<string> {
    return getDefaultEmbeddingModel();
  }

  async getDimension(): Promise<number> {
    return getEmbeddingDimensionForModel(await this.getModel());
  }

  async embedText(text: string): Promise<number[]> {
    const model = await this.getModel();
    const client = getOpenAIClient();
    const resp = await client.embeddings.create({
      model,
      input: text,
      encoding_format: 'float',
    });
    const embedding = resp.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) throw new Error('Embedding response missing vector');
    const dimension = await this.getDimension();
    if (embedding.length !== dimension) {
      throw new Error(`Embedding dimension mismatch for ${model}: got ${embedding.length}, expected ${dimension}`);
    }
    return embedding;
  }
}
