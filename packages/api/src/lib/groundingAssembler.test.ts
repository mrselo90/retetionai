import { describe, it, expect } from 'vitest';
import {
  prioritizeEvidenceResults,
  buildInstructionEvidenceBlock,
  buildGroundedEvidenceContext,
  buildGroundingCacheKey,
  shouldUseDeterministicAnswer,
} from './groundingAssembler';
import type { RAGResult } from './rag';

describe('shouldUseDeterministicAnswer', () => {
  it('uses a fact-backed answer even when chunks were retrieved', () => {
    expect(shouldUseDeterministicAnswer({ usedFactKeys: ['ingredients'] }, 5)).toBe(true);
  });

  it('does NOT use a no-info answer when retrieval found evidence', () => {
    // The regression this guards: product_facts.ingredients is empty so the
    // planner emits "I don't have ingredient information", but retrieval already
    // surfaced the INCI list. Returning the template would tell the customer the
    // information does not exist while the answer sits in the context.
    expect(shouldUseDeterministicAnswer({ usedFactKeys: [] }, 3)).toBe(false);
  });

  it('falls back to a no-info answer when retrieval found nothing', () => {
    expect(shouldUseDeterministicAnswer({ usedFactKeys: [] }, 0)).toBe(true);
  });

  it('returns false when the planner produced nothing', () => {
    expect(shouldUseDeterministicAnswer(null, 0)).toBe(false);
    expect(shouldUseDeterministicAnswer(undefined, 4)).toBe(false);
  });
});

describe('prioritizeEvidenceResults', () => {
  it('should sort FAQ before general, then by similarity', () => {
    const results: RAGResult[] = [
      { chunkId: '1', productId: 'p1', productName: 'A', productUrl: '', chunkText: '', chunkIndex: 0, similarity: 0.9, sectionType: 'general' },
      { chunkId: '2', productId: 'p1', productName: 'A', productUrl: '', chunkText: '', chunkIndex: 1, similarity: 0.8, sectionType: 'faq' },
      { chunkId: '3', productId: 'p1', productName: 'A', productUrl: '', chunkText: '', chunkIndex: 2, similarity: 0.85, sectionType: 'warnings' },
    ];

    const sorted = prioritizeEvidenceResults(results);
    expect(sorted[0].sectionType).toBe('faq');
    expect(sorted[1].sectionType).toBe('warnings');
    expect(sorted[2].sectionType).toBe('general');
  });

  it('should sort by similarity within the same section type', () => {
    const results: RAGResult[] = [
      { chunkId: '1', productId: 'p1', productName: 'A', productUrl: '', chunkText: '', chunkIndex: 0, similarity: 0.7, sectionType: 'usage' },
      { chunkId: '2', productId: 'p1', productName: 'A', productUrl: '', chunkText: '', chunkIndex: 1, similarity: 0.9, sectionType: 'usage' },
    ];

    const sorted = prioritizeEvidenceResults(results);
    expect(sorted[0].similarity).toBe(0.9);
    expect(sorted[1].similarity).toBe(0.7);
  });

  it('should handle empty results', () => {
    expect(prioritizeEvidenceResults([])).toEqual([]);
  });
});

describe('buildInstructionEvidenceBlock', () => {
  it('should format recipe instructions', () => {
    const instructions = [
      {
        product_name: 'Cream X',
        usage_instructions: 'Apply after cleansing',
        recipe_summary: 'For daily use',
        prevention_tips: 'Avoid sun exposure',
      },
    ];

    const block = buildInstructionEvidenceBlock(instructions);
    expect(block).toContain('Cream X');
    expect(block).toContain('Apply after cleansing');
    expect(block).toContain('For daily use');
    expect(block).toContain('Avoid sun exposure');
  });

  it('should return empty string for no instructions', () => {
    expect(buildInstructionEvidenceBlock([])).toBe('');
  });
});

describe('buildGroundedEvidenceContext', () => {
  it('should combine facts, instructions, and RAG results', () => {
    const context = buildGroundedEvidenceContext({
      factsText: 'SPF: 50',
      instructions: [{ product_name: 'P', usage_instructions: 'Apply daily' }],
      ragResults: [
        { chunkId: '1', productId: 'p1', productName: 'Sunscreen', productUrl: 'http://x', chunkText: 'Contains zinc oxide', chunkIndex: 0, similarity: 0.9 },
      ],
    });

    expect(context).toContain('SPF: 50');
    expect(context).toContain('Apply daily');
    expect(context).toContain('Contains zinc oxide');
  });

  it('should handle empty inputs', () => {
    const context = buildGroundedEvidenceContext({});
    expect(context).toBe('');
  });
});

describe('buildGroundingCacheKey', () => {
  it('should produce a deterministic hash', () => {
    const key1 = buildGroundingCacheKey({ merchantId: 'm1', question: 'q1' });
    const key2 = buildGroundingCacheKey({ merchantId: 'm1', question: 'q1' });
    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64);
  });

  it('should produce different hashes for different inputs', () => {
    const key1 = buildGroundingCacheKey({ merchantId: 'm1', question: 'q1' });
    const key2 = buildGroundingCacheKey({ merchantId: 'm1', question: 'q2' });
    expect(key1).not.toBe(key2);
  });
});
