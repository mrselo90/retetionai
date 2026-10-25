/**
 * Drops a stock offer of more help from the end of an answer ("Başka bir
 * sorunuz olursa yardımcı olmaktan memnuniyet duyarım.", "Ha bármilyen további
 * kérdése van, kérem, jelezze!"). The prompt asks for no such line
 * (replyConductRules), but the model still added one to about a fifth of its
 * answers, which reads as boilerplate in a WhatsApp conversation.
 *
 * Only the last sentence, and only when it offers help in general: a sentence
 * that sends the customer somewhere (the store's team, a doctor, a pharmacist)
 * stays, since that is part of the answer.
 */
const STOCK_OFFER = [
  /^(eğer\s+)?(başka|herhangi)\b.*\b(soru\p{L}*|konuda|yardımcı)\b/iu,
  /^ha\s+(bármilyen|további|más|egyéb)\b.*\b(kérdés\p{L}*|segít\p{L}*|jelezze|keressen)/iu,
  /^(if you have any|let me know|feel free|is there anything else|do you have any other)\b.*\b(questions?|help|assist\p{L}*|anything else)\b/iu,
  /^(wenn|falls)\s+sie\s+(weitere|noch|andere)\s+fragen\b/iu,
  /^(αν|εάν)\s+έχετε\s+(άλλες|περισσότερες)\s+(ερωτήσεις|απορίες)/iu,
];
const REFERRAL =
  /(mağaza|ekib|müşteri hizmet|doktor|hekim|eczac|bolt|üzlet|áruház|ügyfélszolgálat|orvos|gyógyszer|store|shop|team|support|doctor|pharmac|laden|team|arzt|apothek|κατάστημα|ομάδα|γιατρ|φαρμακ)/iu;

export function stripStockClosing(answer: string): string {
  // A trailing emoji would otherwise count as the last sentence.
  const text = answer.replace(/[\s\p{Extended_Pictographic}\u{FE0F}]+$/gu, '');
  const sentences = text.split(/(?<=[.!?])\s+/u);
  if (sentences.length < 2) return answer;
  const last = sentences[sentences.length - 1].trim();
  if (!STOCK_OFFER.some((pattern) => pattern.test(last)) || REFERRAL.test(last)) return answer;
  return sentences.slice(0, -1).join(' ').trimEnd();
}
