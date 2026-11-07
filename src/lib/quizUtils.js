export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function optionCount(q) {
  if (Array.isArray(q.options)) return q.options.length;
  return Math.max(q.options?.en?.length ?? 0, q.options?.tr?.length ?? 0);
}

function allTexts(field) {
  if (!field) return [];
  if (typeof field === 'string') return [field];
  if (Array.isArray(field)) return field;
  return Object.values(field).flat();
}

// Şıklara harfle ya da konumla atıf yapan sorular karıştırılmaz
// ("Option B", "A, C ve D seçenekleri", "(C)", "All of the above", "Hepsi" …)
const LETTER_REF = /\boptions? [A-D]\b|\b[A-D] seçene|seçenek [A-D]\b|\([A-D]\)|\b[A-D]\)/i;
const POSITION_REF = /all of the above|none of the above|both of the above|hepsi|hiçbiri|yukarıdaki/i;

export function canShuffleOptions(q) {
  const texts = [...allTexts(q.explanation), ...allTexts(q.question)];
  if (texts.some(t => LETTER_REF.test(t))) return false;
  if (allTexts(q.options).some(t => LETTER_REF.test(t) || POSITION_REF.test(t))) return false;
  return true;
}

// questionId -> [orijinal indexler, ekrandaki sırayla]. Sadece karıştırılanlar kaydedilir.
export function buildOptionOrders(questions, enabled) {
  if (!enabled) return {};
  const orders = {};
  for (const q of questions) {
    if (!canShuffleOptions(q)) continue;
    orders[q.id] = shuffle([...Array(optionCount(q)).keys()]);
  }
  return orders;
}

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
