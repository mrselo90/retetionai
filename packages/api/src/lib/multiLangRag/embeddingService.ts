import { getOpenAIClient } from '../openaiClient.js';
import { getEmbeddingDimensionForModel, getMultiLangRagFlags } from './config.js';

export class EmbeddingService {
  getModel(): string {
    return getMultiLangRagFlags().embeddingModel;
  }

  getDimension(): number {
    return getEmbeddingDimensionForModel(this.getModel());
  }

  async embedText(text: string): Promise<number[]> {
    const model = this.getModel();
    const client = getOpenAIClient();
    const resp = await client.embeddings.create({
      model,
      input: text,
      encoding_format: 'float',
    });
    const embedding = resp.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) throw new Error('Embedding response missing vector');
    if (embedding.length !== this.getDimension()) {
      throw new Error(`Embedding dimension mismatch for ${model}: got ${embedding.length}, expected ${this.getDimension()}`);
    }
    return embedding;
  }
}

