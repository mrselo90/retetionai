export interface PersonaStyleSettings {
  emoji?: boolean;
  response_length?: 'short' | 'medium' | 'long' | string;
}

export interface StyleComplianceResult {
  compliant: boolean;
  checks: {
    emoji: boolean;
    length: boolean;
  };
  metrics: {
    charCount: number;
    sentenceCount: number;
    emojiCount: number;
  };
}

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

export function evaluateStyleCompliance(
  text: string,
  persona?: PersonaStyleSettings | null
): StyleComplianceResult {
  const normalized = (text || '').trim();
  const sentenceCount = (normalized.match(/[.!?]+/g) || []).length || (normalized ? 1 : 0);
  const emojiCount = (normalized.match(EMOJI_REGEX) || []).length;
  const charCount = normalized.length;

  const expectedLength = persona?.response_length || 'medium';
  let lengthOk = true;
  if (expectedLength === 'short') {
    lengthOk = sentenceCount <= 2 && charCount <= 280;
  } else if (expectedLength === 'medium') {
    lengthOk = sentenceCount <= 5 && charCount <= 700;
  } else if (expectedLength === 'long') {
    lengthOk = sentenceCount <= 8 && charCount <= 1400;
  }

  const emojiOk = persona?.emoji === false ? emojiCount === 0 : true;

  return {
    compliant: emojiOk && lengthOk,
    checks: { emoji: emojiOk, length: lengthOk },
    metrics: { charCount, sentenceCount, emojiCount },
  };
}

