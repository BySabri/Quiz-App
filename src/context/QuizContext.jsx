import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const QuizContext = createContext();

const LANG_KEY      = 'quiz_lang';
const HISTORY_LIMIT = 50;
const PAGE_SIZE     = 1000; // Supabase tek sorguda en fazla 1000 satır döndürür

function getProgressKey(filter) {
  if (!filter) return 'all';
  if (filter.type === 'category') return `cat_${filter.value}`;
  return `topic_${filter.category}_${filter.value}`;
}
function resolveProgressKey(filterOrKey) {
  return typeof filterOrKey === 'string' ? filterOrKey : getProgressKey(filterOrKey);
}

// Supabase hata döndürürse fırlat
function must({ data, error }) {
  if (error) throw error;
  return data;
}

// 1000 satır limitine takılmadan tüm satırları sayfa sayfa çek
async function fetchAll(buildQuery) {
  let rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = must(await buildQuery().range(from, from + PAGE_SIZE - 1));
    rows = rows.concat(page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

const fetchQuestions = () => fetchAll(() => supabase.from('questions').select('*').order('id'));

function questionText(q) {
  return (typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question) ?? '';
}

function toDbQuestion(q) {
  return {
    category:    q.category ?? null,
    topic:       q.topic    ?? null,
    question:    typeof q.question === 'object' ? q.question : { en: q.question },
    options:     Array.isArray(q.options) ? { en: q.options } : q.options,
    answer:      q.answer,
    explanation: q.explanation
      ? (typeof q.explanation === 'object' ? q.explanation : { en: q.explanation })
      : null,
  };
}

function fromDbHistory(r) {
  return {
    id:        r.id,
    date:      r.created_at,
    filter:    r.filter,
    config:    r.config,
    score:     r.score,
    total:     r.total,
    percent:   r.total ? Math.round((r.score / r.total) * 100) : 0,
    timeTaken: r.time_taken,
    wrongIds:  r.wrong_ids ?? [],
  };
}

function fromDbAnswer(r) {
  return {
    correct:      r.correct_count,
    wrong:        r.wrong_count,
    streak:       r.correct_streak ?? 0,
    lastSelected: r.last_selected,
    lastCorrect:  r.last_correct,
    lastAt:       r.last_answered_at,
  };
}

// Not: App.jsx bu provider'ı key={userId} ile render eder,
// yani kullanıcı değişince tüm state sıfırdan kurulur.
export function QuizProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [questions,    setQuestions]    = useState([]);
  const [dataReady,    setDataReady]    = useState(false);
  const [dbError,      setDbError]      = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // { ok, msg }
  const [scoreHistory, setScoreHistory] = useState([]);
  const [progressMap,  setProgressMap]  = useState({});   // progressKey -> data
  const [stats,        setStats]        = useState({});   // questionId -> { correct, wrong, streak, lastSelected, lastCorrect, lastAt }
  const [lang,         setLangState]    = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'en'; } catch { return 'en'; }
  });

  // İlerleme yazımlarını sıraya sok: geç gelen eski bir istek yenisini ezmesin
  const progressQueue = useRef(Promise.resolve());
  function enqueueProgress(fn) {
    progressQueue.current = progressQueue.current
      .then(fn)
      .catch(err => console.error('quiz_progress:', err.message ?? err));
  }

  function setLang(l) {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* yoksay */ }
  }

  // ---- Giriş yapınca: sorular + kullanıcının tüm verisi ----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    Promise.all([
      fetchQuestions(),
      supabase.from('quiz_history').select('*')
        .order('created_at', { ascending: false }).limit(HISTORY_LIMIT).then(must),
      supabase.from('quiz_progress').select('progress_key, data').then(must),
      fetchAll(() => supabase.from('user_answers')
        .select('question_id, correct_count, wrong_count, correct_streak, last_selected, last_correct, last_answered_at')
        .order('question_id')),
    ])
      .then(([qs, history, progress, answers]) => {
        if (cancelled) return;
        setQuestions(qs);
        setScoreHistory(history.map(fromDbHistory));
        setProgressMap(Object.fromEntries(progress.map(r => [r.progress_key, r.data])));
        setStats(Object.fromEntries(answers.map(r => [r.question_id, fromDbAnswer(r)])));
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Supabase load error:', err);
        setDbError(err.message ?? String(err));
      })
      .finally(() => { if (!cancelled) setDataReady(true); });

    return () => { cancelled = true; };
  }, [userId]);

  // =====================================================================
  // ADMIN — soru işlemleri. ID'ler sabit kalır (artık "hepsini sil →
  // yeniden ekle" yok), böylece kullanıcı ilerlemeleri bozulmaz.
  // Yetki kontrolü veritabanında (RLS): admin değilsen yazma reddedilir.
  // =====================================================================
  async function runAdmin(action, okMsg) {
    setUploadStatus(null);
    try {
      const msg = (await action()) ?? okMsg;
      setQuestions(await fetchQuestions());
      setUploadStatus({ ok: true, msg });
      return { success: true };
    } catch (err) {
      console.error('Admin işlemi hatası:', err);
      setUploadStatus({ ok: false, msg: err.message ?? String(err) });
      return { success: false };
    }
  }

  const addQuestion = (q) => runAdmin(async () => {
    must(await supabase.from('questions').insert(toDbQuestion(q)));
  }, 'Yeni soru eklendi ✅');

  const updateQuestion = (id, q) => runAdmin(async () => {
    must(await supabase.from('questions').update(toDbQuestion(q)).eq('id', id));
  }, 'Soru güncellendi ✅');

  const deleteQuestion = (id) => runAdmin(async () => {
    must(await supabase.from('questions').delete().eq('id', id));
  }, 'Soru silindi 🗑️');

  const clearAllQuestions = () => runAdmin(async () => {
    must(await supabase.from('questions').delete().gt('id', 0));
  }, 'Tüm sorular silindi 🗑️');

  // mode 'replace': aynı metinli mevcut soruları günceller, yenileri ekler
  // mode 'merge'  : sadece yeni soruları ekler, mevcutlara dokunmaz
  const importQuestions = (list, mode = 'replace') => runAdmin(async () => {
    const idByText = new Map(questions.map(q => [questionText(q), q.id]));
    const toUpdate = new Map(); // id -> row (aynı soru dosyada 2 kez varsa sonuncusu kazanır)
    const toInsert = [];
    for (const q of list) {
      const id = idByText.get(questionText(q));
      if (id == null)            toInsert.push(toDbQuestion(q));
      else if (mode === 'replace') toUpdate.set(id, { id, ...toDbQuestion(q) });
    }
    if (toUpdate.size)   must(await supabase.from('questions').upsert([...toUpdate.values()]));
    if (toInsert.length) must(await supabase.from('questions').insert(toInsert));
    return `${toInsert.length} yeni soru eklendi, ${toUpdate.size} soru güncellendi ✅`;
  });

  const resetToDefault = () => runAdmin(async () => {
    const data = await (await fetch('/questions.json')).json();
    must(await supabase.from('questions').delete().gt('id', 0));
    must(await supabase.from('questions').insert(data.map(toDbQuestion)));
    return `Varsayılan ${data.length} soru yüklendi ✅`;
  });

  // =====================================================================
  // KULLANICI VERİSİ — tüm cihazlarda senkron
  // =====================================================================

  // Cevapları kaydet (iyimser: önce ekranda, sonra tek istekle DB'de)
  // entries: [{ questionId, selected, correctAnswer, guessed }]
  //   selected = -1 → süre doldu / boş;  guessed = "emin değilim" işaretli
  function recordAnswers(entries) {
    if (!entries.length) return;
    const nowIso = new Date().toISOString();
    setStats(s => {
      const next = { ...s };
      for (const e of entries) {
        const isCorrect = e.selected === e.correctAnswer;
        const prev = next[e.questionId] ?? { correct: 0, wrong: 0, streak: 0 };
        next[e.questionId] = {
          correct:      prev.correct + (isCorrect ? 1 : 0),
          wrong:        prev.wrong   + (isCorrect ? 0 : 1),
          streak:       isCorrect && !e.guessed ? (prev.streak ?? 0) + 1 : 0,
          lastSelected: e.selected,
          lastCorrect:  isCorrect,
          lastAt:       nowIso,
        };
      }
      return next;
    });
    const payload = entries.map(e => ({
      question_id: e.questionId,
      selected:    e.selected,
      correct:     e.selected === e.correctAnswer,
      guessed:     !!e.guessed,
    }));
    supabase.rpc('record_answers', { p_answers: payload })
      .then(({ error }) => { if (error) console.error('record_answers:', error.message); });
  }

  async function saveScore({ filter, config, score, total, timeTaken, wrongIds }) {
    const { data, error } = await supabase.from('quiz_history')
      .insert({ user_id: userId, filter, config, score, total, time_taken: timeTaken, wrong_ids: wrongIds })
      .select()
      .single();
    if (error) { console.error('saveScore:', error.message); return; }
    setScoreHistory(h => [fromDbHistory(data), ...h].slice(0, HISTORY_LIMIT));
  }

  // Geçmiş + yarım quizler + soru istatistikleri: hepsini sıfırla
  async function clearHistory() {
    setScoreHistory([]);
    setProgressMap({});
    setStats({});
    const results = await Promise.all([
      supabase.from('quiz_history').delete().eq('user_id', userId),
      supabase.from('quiz_progress').delete().eq('user_id', userId),
      supabase.from('user_answers').delete().eq('user_id', userId),
    ]);
    results.forEach(({ error }) => { if (error) console.error('clearHistory:', error.message); });
  }

  // ---- Quiz ilerleme: her filtre için ayrı kayıt ----
  function saveProgress(filter, data) {
    const key = getProgressKey(filter);
    setProgressMap(m => ({ ...m, [key]: data }));
    enqueueProgress(async () => {
      must(await supabase.from('quiz_progress').upsert({
        user_id: userId, progress_key: key, data, updated_at: new Date().toISOString(),
      }));
    });
  }
  function clearProgress(filterOrKey) {
    const key = resolveProgressKey(filterOrKey);
    setProgressMap(m => { const next = { ...m }; delete next[key]; return next; });
    enqueueProgress(async () => {
      must(await supabase.from('quiz_progress').delete().eq('user_id', userId).eq('progress_key', key));
    });
  }
  function getRawProgress(filterOrKey) {
    return progressMap[resolveProgressKey(filterOrKey)] ?? null;
  }
  function getAllProgress() {
    return Object.entries(progressMap)
      .filter(([, data]) => data?.questionIds)
      .map(([progressKey, data]) => ({ progressKey, data }));
  }

  // ---- Dil yardımcısı ----
  function getText(q) {
    const question = typeof q.question === 'object' ? q.question[lang] ?? q.question.en ?? q.question.tr ?? '' : q.question;
    const options  = typeof q.options  === 'object' && !Array.isArray(q.options) ? q.options[lang] ?? q.options.en ?? q.options.tr ?? [] : q.options;
    return { question, options };
  }

  return (
    <QuizContext.Provider value={{
      questions, loading: !!userId && !dataReady, dbError,
      lang, setLang, getText,
      addQuestion, updateQuestion, deleteQuestion, clearAllQuestions, importQuestions, resetToDefault, uploadStatus,
      stats, recordAnswers,
      scoreHistory, saveScore, clearHistory,
      saveProgress, clearProgress, getRawProgress, getAllProgress,
    }}>
      {children}
    </QuizContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useQuiz() { return useContext(QuizContext); }
