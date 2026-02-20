import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    processProductForRAG,
    batchProcessProducts,
    getProductChunkCount,
    deleteProductChunks,
} from './knowledgeBase.js';
import { getSupabaseServiceClient } from '@recete/shared';
import * as embeddings from './embeddings.js';

// Mock dependencies
vi.mock('@recete/shared', () => ({
    getSupabaseServiceClient: vi.fn(),
}));

vi.mock('./embeddings.js', () => ({
    chunkText: vi.fn(),
    generateEmbeddingsBatch: vi.fn(),
}));

describe('Knowledge Base Module', () => {
    const mockProductId = 'product-123';
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
        };

        vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase);
    });

    describe('processProductForRAG', () => {
        it('should process product content successfully', async () => {
            const rawContent = 'This is product content that will be chunked and embedded.';
            const mockChunks = [
                { text: 'This is product content', index: 0 },
                { text: 'that will be chunked and embedded.', index: 1 },
            ];
            const mockEmbeddings = [
                { embedding: [0.1, 0.2, 0.3], tokenCount: 5 },
                { embedding: [0.4, 0.5, 0.6], tokenCount: 6 },
            ];

            vi.mocked(embeddings.chunkText).mockReturnValue(mockChunks);
            vi.mocked(embeddings.generateEmbeddingsBatch).mockResolvedValue(mockEmbeddings);
            mockSupabase.eq.mockResolvedValue({ error: null });

            const result = await processProductForRAG(mockProductId, rawContent);

            expect(result).toEqual({
                productId: mockProductId,
                chunksCreated: 2,
                totalTokens: 11,
                success: true,
            });

            expect(mockSupabase.delete).toHaveBeenCalled();
            expect(mockSupabase.insert).toHaveBeenCalledWith([
                {
                    product_id: mockProductId,
                    chunk_text: mockChunks[0].text,
                    embedding: JSON.stringify(mockEmbeddings[0].embedding),
                    chunk_index: 0,
                },
                {
                    product_id: mockProductId,
                    chunk_text: mockChunks[1].text,
                    embedding: JSON.stringify(mockEmbeddings[1].embedding),
                    chunk_index: 1,
                },
            ]);
        });

        it('should return error for empty content', async () => {
            const result = await processProductForRAG(mockProductId, '');

            expect(result).toEqual({
                productId: mockProductId,
                chunksCreated: 0,
                totalTokens: 0,
                success: false,
                error: 'No content to process',
            });
        });

        it('should return error for whitespace-only content', async () => {
            const result = await processProductForRAG(mockProductId, '   \n\t  ');

            expect(result).toEqual({
                productId: mockProductId,
                chunksCreated: 0,
                totalTokens: 0,
                success: false,
                error: 'No content to process',
            });
        });

        it('should return error when no chunks generated', async () => {
            vi.mocked(embeddings.chunkText).mockReturnValue([]);

            const result = await processProductForRAG(mockProductId, 'content');

            expect(result).toEqual({
                productId: mockProductId,
                chunksCreated: 0,
                totalTokens: 0,
                success: false,
                error: 'No chunks generated',
            });
        });

        it('should handle embedding generation errors', async () => {
            const mockChunks = [{ text: 'chunk', index: 0 }];

            vi.mocked(embeddings.chunkText).mockReturnValue(mockChunks);
            vi.mocked(embeddings.generateEmbeddingsBatch).mockRejectedValue(new Error('API error'));

            const result = await processProductForRAG(mockProductId, 'content');

            expect(result.success).toBe(false);
            expect(result.error).toBe('API error');
        });
    });

    describe('batchProcessProducts', () => {
        it('should process multiple products successfully', async () => {
            const productIds = ['prod-1', 'prod-2'];
            const mockProducts = [
                { id: 'prod-1', raw_text: 'Content for product 1' },
                { id: 'prod-2', raw_text: 'Content for product 2' },
            ];

            mockSupabase.in.mockResolvedValue({ data: mockProducts, error: null });

            const mockChunks = [{ text: 'chunk', index: 0 }];
            const mockEmbeddings = [{ embedding: [0.1], tokenCount: 5 }];

            vi.mocked(embeddings.chunkText).mockReturnValue(mockChunks);
            vi.mocked(embeddings.generateEmbeddingsBatch).mockResolvedValue(mockEmbeddings);
            mockSupabase.eq.mockResolvedValue({ error: null });

            const results = await batchProcessProducts(productIds);

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
        });

        it('should handle products without raw_text or enriched_text', async () => {
            const productIds = ['prod-1', 'prod-2'];
            const mockProducts = [
                { id: 'prod-1', raw_text: 'Content' },
                { id: 'prod-2', raw_text: null, enriched_text: null },
            ];

            mockSupabase.in.mockResolvedValue({ data: mockProducts, error: null });

            const mockChunks = [{ text: 'chunk', index: 0 }];
            const mockEmbeddings = [{ embedding: [0.1], tokenCount: 5 }];

            vi.mocked(embeddings.chunkText).mockReturnValue(mockChunks);
            vi.mocked(embeddings.generateEmbeddingsBatch).mockResolvedValue(mockEmbeddings);
            mockSupabase.eq.mockResolvedValue({ error: null });

            const results = await batchProcessProducts(productIds);

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
            expect(results[1].error).toBe('No raw_text or enriched_text available');
        });

        it('should throw error if products fetch fails', async () => {
            mockSupabase.in.mockResolvedValue({ data: null, error: { message: 'DB error' } });

            await expect(batchProcessProducts(['prod-1'])).rejects.toThrow('Failed to fetch products');
        });

        it('should process products with delay between them', async () => {
            const productIds = ['prod-1', 'prod-2'];
            const mockProducts = [
                { id: 'prod-1', raw_text: 'Content 1' },
                { id: 'prod-2', raw_text: 'Content 2' },
            ];

            mockSupabase.in.mockResolvedValue({ data: mockProducts, error: null });

            const mockChunks = [{ text: 'chunk', index: 0 }];
            const mockEmbeddings = [{ embedding: [0.1], tokenCount: 5 }];

            vi.mocked(embeddings.chunkText).mockReturnValue(mockChunks);
            vi.mocked(embeddings.generateEmbeddingsBatch).mockResolvedValue(mockEmbeddings);
            mockSupabase.eq.mockResolvedValue({ error: null });

            const startTime = Date.now();
            await batchProcessProducts(productIds);
            const duration = Date.now() - startTime;

            // Should have at least 100ms delay between products
            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe('getProductChunkCount', () => {
        it('should return chunk count for product', async () => {
            mockSupabase.eq.mockResolvedValue({ count: 5, error: null });

            const result = await getProductChunkCount(mockProductId);

            expect(result).toBe(5);
            expect(mockSupabase.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
        });

        it('should return 0 if no chunks found', async () => {
            mockSupabase.eq.mockResolvedValue({ count: null, error: null });

            const result = await getProductChunkCount(mockProductId);

            expect(result).toBe(0);
        });

        it('should throw error on database error', async () => {
            mockSupabase.eq.mockResolvedValue({ count: null, error: { message: 'DB error' } });

            await expect(getProductChunkCount(mockProductId)).rejects.toThrow('Failed to count chunks');
        });
    });

    describe('deleteProductChunks', () => {
        it('should delete all chunks for product', async () => {
            mockSupabase.eq.mockResolvedValue({ error: null });

            await deleteProductChunks(mockProductId);

            expect(mockSupabase.delete).toHaveBeenCalled();
            expect(mockSupabase.eq).toHaveBeenCalledWith('product_id', mockProductId);
        });

        it('should throw error on database error', async () => {
            mockSupabase.eq.mockResolvedValue({ error: { message: 'Delete failed' } });

            await expect(deleteProductChunks(mockProductId)).rejects.toThrow('Failed to delete chunks');
        });
    });
});
