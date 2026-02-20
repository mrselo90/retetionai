import { getOpenAIClient } from '../openaiClient.js';
import { logger } from '@recete/shared';

/**
 * Enriches raw scraped product text to be more search-friendly for RAG.
 * Uses OpenAI to synthesize a structured, keyword-rich summary.
 */
export async function enrichProductData(rawText: string, productTitle: string): Promise<string> {
  if (!rawText || rawText.trim().length === 0) {
    return rawText;
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: "You are an expert e-commerce data enrichment AI. Your job is to take raw, noisy scraped text from a product page and synthesize it into a clean, highly structured, keyword-rich summary optimized for vector similarity search (RAG).\n\nGuidelines:\n1. Extract and prominently feature the product's main characteristics (name, category, material, color, size, variations, key ingredients, usage instructions).\n2. Remove UI noise (like 'Add to cart', 'Reviews', shipping policies, header/footer menus).\n3. Use clear bullet points and simple sentences to maximize semantic density.\n4. Output ONLY the enriched text, no conversational filler."
        },
        {
          role: 'user',
          content: `Product Title: ${productTitle}\n\nRaw Scraped Text:\n${rawText.slice(0, 15000)}` // Limit input size
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    const enrichedText = response.choices[0]?.message?.content?.trim();
    return enrichedText || rawText;
  } catch (error) {
    logger.error({ error, productTitle }, 'Failed to enrich product data');
    // Fallback to raw text if LLM call fails
    return rawText;
  }
}
