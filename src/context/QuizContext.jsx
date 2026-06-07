import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const QuizContext = createContext();

const ADMIN_PASSWORD  = 'eysadem';
const HISTORY_KEY     = 'quiz_history';
const PROGRESS_PREFIX = 'quiz_progress_';

function getProgressKey(filter) {
  if (!filter) return 'all';
  if (filter.type === 'category') return `cat_${filter.value}`;
  return `topic_${filter.category}_${filter.value}`;
}

export function QuizProvider({ children }) {
  const [questions,       setQuestions]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [dbError,         setDbError]         = useState(null);
  const [uploadStatus,    setUploadStatus]    = useState(null); // { ok, msg }
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [lang,            setLang]            = useState('en');
  const [scoreHistory,    setScoreHistory]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); }
    catch { return []; }
  });

  // ---- Supabase'den soruları yükle ----
  useEffect(() => {
    supabase
      .from('questions')
      .select('*')
      .order('id')
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase load error:', error.message);
          setDbError(error.message);
        } else {
          setQuestions(data ?? []);
        }
        setLoading(false);
      });
  }, []);

  function adminLogin(p)  { if (p === ADMIN_PASSWORD) { setIsAdminLoggedIn(true); return true; } return false; }
  function adminLogout()  { setIsAdminLoggedIn(false); }

  // ---- Soruları Supabase'e yaz: hepsini sil → yenileri ekle ----
  async function uploadQuestions(newQuestions) {
    setUploadStatus(null);
    try {
      // 1. Tümünü sil (bigserial → id her zaman > 0)
      const { error: delErr } = await supabase.from('questions').delete().gt('id', 0);
      if (delErr) {
        console.error('Delete error:', delErr.message);
        setUploadStatus({ ok: false, msg: delErr.message });
        return { success: false };
      }

      // 2. Yenileri ekle (id göndermiyoruz, Supabase otomatik atıyor)
      if (newQuestions.length > 0) {
        const rows = newQuestions.map((q) => ({
          category:    q.category    ?? null,
          topic:       q.topic       ?? null,
          question:    typeof q.question === 'object' ? q.question : { en: q.question },
          options:     Array.isArray(q.options) ? { en: q.options } : q.options,
          answer:      q.answer,
          explanation: q.explanation
            ? (typeof q.explanation === 'object' ? q.explanation : { en: q.explanation })
            : null,
        }));
        const { error: insErr } = await supabase.from('questions').insert(rows);
        if (insErr) {
          console.error('Insert error:', insErr.message);
          setUploadStatus({ ok: false, msg: insErr.message });
          return { success: false };
        }
      }

      // 3. State'i güncel DB verisiyle senkronize et
      const { data: allQ } = await supabase.from('questions').select('*').order('id');
      setQuestions(allQ ?? []);
      setUploadStatus({ ok: true, msg: `${newQuestions.length} soru kaydedildi ✅` });
      return { success: true };
    } catch (err) {
      console.error('uploadQuestions error:', err);
      setUploadStatus({ ok: false, msg: err.message });
      return { success: false };
    }
  }

  // ---- Tüm soruları sil ----
  async function clearAllQuestions() {
    setUploadStatus(null);
    try {
      const { error } = await supabase.from('questions').delete().gt('id', 0);
      if (error) { setUploadStatus({ ok: false, msg: error.message }); return { success: false }; }
      setQuestions([]);
      setUploadStatus({ ok: true, msg: 'Tüm sorular silindi 🗑️' });
      return { success: true };
    } catch (err) {
      setUploadStatus({ ok: false, msg: err.message });
      return { success: false };
    }
  }

  async function resetToDefault() {
    const res = await fetch('/questions.json');
    const data = await res.json();
    await uploadQuestions(data);
  }

  // ---- Skor geçmişi (localStorage, per-user) ----
  function saveScore({ filter, config, score, total, timeTaken, wrongIds, answerMap }) {
    const entry = { id: Date.now(), date: new Date().toISOString(), filter, config, score, total, percent: Math.round((score / total) * 100), timeTaken, wrongIds, answerMap };
    const updated = [entry, ...scoreHistory].slice(0, 20);
    setScoreHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }
  function clearHistory() { 
    setScoreHistory([]); 
    localStorage.removeItem(HISTORY_KEY);
    // Tüm yarım kalmış quiz ilerlemelerini de temizle
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PROGRESS_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
  // ---- Quiz ilerleme: her filtre için ayrı localStorage key ----
  function saveProgress(filter, data) {
    const k = PROGRESS_PREFIX + getProgressKey(filter);
    localStorage.setItem(k, JSON.stringify(data));
  }
  function clearProgress(filter) {
    const k = PROGRESS_PREFIX + getProgressKey(filter);
    localStorage.removeItem(k);
  }
  function getRawProgress(filterOrKey) {
    const k = PROGRESS_PREFIX + (typeof filterOrKey === 'string' ? filterOrKey : getProgressKey(filterOrKey));
    try { return JSON.parse(localStorage.getItem(k)); }
    catch { return null; }
  }
  function getAllProgress() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PROGRESS_PREFIX)) continue;
      try {
        const data = JSON.parse(localStorage.getItem(k));
        if (data?.questionIds) result.push({ progressKey: k.slice(PROGRESS_PREFIX.length), data });
      } catch { /* skip */ }
    }
    return result;
  }

  // ---- Dil yardımcısı ----
  function getText(q) {
    const question = typeof q.question === 'object' ? q.question[lang] ?? q.question.en ?? q.question.tr ?? '' : q.question;
    const options  = typeof q.options  === 'object' && !Array.isArray(q.options) ? q.options[lang] ?? q.options.en ?? q.options.tr ?? [] : q.options;
    return { question, options };
  }

  return (
    <QuizContext.Provider value={{
      questions, loading, dbError,
      lang, setLang, getText,
      isAdminLoggedIn, adminLogin, adminLogout,
      uploadQuestions, resetToDefault, uploadStatus, clearAllQuestions,
      scoreHistory, saveScore, clearHistory,
      saveProgress, clearProgress, getRawProgress, getAllProgress,
    }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() { return useContext(QuizContext); }
