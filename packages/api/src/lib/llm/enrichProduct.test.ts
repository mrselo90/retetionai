import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { enrichProductData } from './enrichProduct.js';
import { getOpenAIClient } from '../openaiClient.js';
import { logger } from '@recete/shared';

vi.mock('../openaiClient.js', () => ({
    getOpenAIClient: vi.fn(),
}));

vi.mock('@recete/shared', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('enrichProductData', () => {
    let mockCreateCompletion: Mock;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCreateCompletion = vi.fn();
        (getOpenAIClient as Mock).mockReturnValue({
            chat: {
                completions: {
                    create: mockCreateCompletion,
                },
            },
        });
    });

    it('should return raw text if input is empty', async () => {
        const result1 = await enrichProductData('', 'Product A');
        expect(result1).toBe('');

        const result2 = await enrichProductData('   ', 'Product B');
        expect(result2).toBe('   ');

        expect(getOpenAIClient).not.toHaveBeenCalled();
    });

    it('should successfully enrich product data using OpenAI', async () => {
        const mockRawText = 'This is raw product text with noise like Add to Cart and Reviews.';
        const mockEnrichedText = '- Key feature 1\n- Key feature 2';

        mockCreateCompletion.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: mockEnrichedText,
                    },
                },
            ],
        });

        const result = await enrichProductData(mockRawText, 'Test Product');

        expect(result).toBe(mockEnrichedText);
        expect(mockCreateCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gpt-4o-mini',
                messages: expect.arrayContaining([
                    expect.objectContaining({ role: 'system' }),
                    expect.objectContaining({
                        role: 'user',
                        content: `Product Title: Test Product\n\nRaw Scraped Text:\n${mockRawText}`,
                    }),
                ]),
                temperature: 0.1,
                max_tokens: 1500,
            })
        );
    });

    it('should slice very long input text to prevent token limits', async () => {
        const mockRawText = 'A'.repeat(20000); // 20k characters

        mockCreateCompletion.mockResolvedValue({
            choices: [{ message: { content: 'Enriched output' } }],
        });

        await enrichProductData(mockRawText, 'Long Product');

        expect(mockCreateCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({
                        role: 'user',
                        content: expect.stringMatching(/Raw Scraped Text:\nA{15000}$/), // Should be sliced to 15k
                    }),
                ]),
            })
        );
    });

    it('should handle OpenAI API errors and fallback to raw text', async () => {
        const mockRawText = 'Raw text with no enrichment';

        mockCreateCompletion.mockRejectedValue(new Error('OpenAI API Error'));

        const result = await enrichProductData(mockRawText, 'Error Product');

        expect(result).toBe(mockRawText);
        expect(logger.error).toHaveBeenCalled();
    });
});
