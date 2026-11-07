// Kategori / konu filtresine uyan soruları döndürür
export function filterQuestions(questions, filter) {
  if (!filter) return questions;
  return questions.filter(q => {
    const cat = q.category || 'Genel';
    if (filter.type === 'category') return cat === filter.value;
    if (filter.type === 'topic')    return (q.topic || 'Diğer') === filter.value && cat === filter.category;
    return true;
  });
}

// ---- Aralıklı tekrar ----
// Art arda (emin olarak) doğru sayısına göre bir sonraki tekrar kaç gün sonra:
// yanlış / emin değilim → hemen, 1 doğru → 1 gün, 2 → 3 gün, 3 → 7 gün, 4 → 14 gün, 5+ → 30 gün
const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDue(stat, now = Date.now()) {
  if (!stat) return false; // hiç çözülmemiş → "Çözülmemiş" havuzunda
  const days = REVIEW_INTERVAL_DAYS[Math.min(stat.streak ?? 0, REVIEW_INTERVAL_DAYS.length - 1)];
  return new Date(stat.lastAt).getTime() + days * DAY_MS <= now;
}

// Soru havuzu:
//   all      → hepsi
//   unsolved → hiç çözülmemiş
//   wrong    → son cevabı yanlış
//   due      → tekrar zamanı gelmiş (yanlışlar + "emin değilim"ler + süresi dolan doğrular)
export const POOLS = ['all', 'unsolved', 'wrong', 'due'];

export function applyPool(questions, pool, stats) {
  if (pool === 'unsolved') return questions.filter(q => !stats[q.id]);
  if (pool === 'wrong')    return questions.filter(q => stats[q.id] && !stats[q.id].lastCorrect);
  if (pool === 'due') {
    const now = Date.now();
    return questions.filter(q => isDue(stats[q.id], now));
  }
  return questions;
}
