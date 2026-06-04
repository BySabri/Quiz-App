import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const QuizContext = createContext();

const ADMIN_PASSWORD = 'eysadem';
const HISTORY_KEY    = 'quiz_history';
const PROGRESS_KEY   = 'quiz_progress';

export function QuizProvider({ children }) {
  const [questions,       setQuestions]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [dbError,         setDbError]         = useState(null);
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

  // ---- Tüm soruları Supabase'e yaz (mevcut = sil + yenileri ekle) ----
  async function uploadQuestions(newQuestions) {
    setQuestions(newQuestions); // optimistic
    try {
      // Mevcut tüm satırları sil
      const { data: existing } = await supabase.from('questions').select('id');
      const ids = (existing ?? []).map(r => r.id);
      if (ids.length > 0) {
        await supabase.from('questions').delete().in('id', ids);
      }
      // Yenileri ekle
      if (newQuestions.length > 0) {
        const rows = newQuestions.map((q, i) => ({
          id:          q.id ?? i + 1,
          category:    q.category    ?? null,
          topic:       q.topic       ?? null,
          question:    typeof q.question    === 'object' ? q.question    : { en: q.question },
          options:     Array.isArray(q.options) ? { en: q.options } : q.options,
          answer:      q.answer,
          explanation: q.explanation
            ? (typeof q.explanation === 'object' ? q.explanation : { en: q.explanation })
            : null,
        }));
        const { error } = await supabase.from('questions').insert(rows);
        if (error) console.error('Supabase insert error:', error.message);
      }
    } catch (err) {
      console.error('uploadQuestions error:', err);
    }
  }

  async function resetToDefault() {
    const res = await fetch('/questions.json');
    const data = await res.json();
    await uploadQuestions(data);
  }

  // ---- Skor geçmişi (localStorage, per-user) ----
  function saveScore({ filter, config, score, total, timeTaken }) {
    const entry = { id: Date.now(), date: new Date().toISOString(), filter, config, score, total, percent: Math.round((score / total) * 100), timeTaken };
    const updated = [entry, ...scoreHistory].slice(0, 20);
    setScoreHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }
  function clearHistory() { setScoreHistory([]); localStorage.removeItem(HISTORY_KEY); }

  // ---- Quiz ilerleme (localStorage, per-user) ----
  function saveProgress(data)  { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); }
  function clearProgress()     { localStorage.removeItem(PROGRESS_KEY); }
  function getRawProgress()    { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)); } catch { return null; } }

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
      uploadQuestions, resetToDefault,
      scoreHistory, saveScore, clearHistory,
      saveProgress, clearProgress, getRawProgress,
    }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() { return useContext(QuizContext); }
