import { describe, it, expect } from 'vitest';
import { buildSourceSnapshotHash } from './utils.js';

describe('multiLangRag utils', () => {
  it('produces same source_hash for whitespace/key-order equivalent snapshots', () => {
    const a = buildSourceSnapshotHash({
      title: ' Test Product ',
      description_html: '<p>Hello   world</p>',
      specs_json: { b: '2', a: '1' },
      faq_json: [{ answer: 'A', question: 'Q' }],
    });
    const b = buildSourceSnapshotHash({
      title: 'Test   Product',
      description_html: '<p>Hello world</p>',
      specs_json: { a: '1', b: '2' },
      faq_json: [{ question: 'Q', answer: 'A' }],
    });
    expect(a).toBe(b);
  });
});

