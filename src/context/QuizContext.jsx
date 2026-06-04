import { createContext, useContext, useState, useEffect } from 'react';

const QuizContext = createContext();

const ADMIN_PASSWORD = 'eysadem';
const STORAGE_KEY    = 'quiz_questions';
const HISTORY_KEY    = 'quiz_history';
const PROGRESS_KEY   = 'quiz_progress';

export function QuizProvider({ children }) {
  const [questions,       setQuestions]       = useState([]);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [lang,            setLang]            = useState('en');
  const [scoreHistory,    setScoreHistory]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setQuestions(JSON.parse(stored));
    } else {
      fetch('/questions.json')
        .then(r => r.json())
        .then(data => { setQuestions(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); });
    }
  }, []);

  function adminLogin(p)  { if (p === ADMIN_PASSWORD) { setIsAdminLoggedIn(true); return true; } return false; }
  function adminLogout()  { setIsAdminLoggedIn(false); }

  function uploadQuestions(q) { setQuestions(q); localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); }

  function resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    fetch('/questions.json').then(r => r.json()).then(data => { setQuestions(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); });
  }

  function saveScore({ filter, config, score, total, timeTaken }) {
    const entry = { id: Date.now(), date: new Date().toISOString(), filter, config, score, total, percent: Math.round((score / total) * 100), timeTaken };
    const updated = [entry, ...scoreHistory].slice(0, 20);
    setScoreHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }
  function clearHistory() { setScoreHistory([]); localStorage.removeItem(HISTORY_KEY); }

  // Quiz progress persistence
  function saveProgress(data) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); }
  function clearProgress()    { localStorage.removeItem(PROGRESS_KEY); }
  function getRawProgress()   { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)); } catch { return null; } }

  function getText(q) {
    const question = typeof q.question === 'object' ? q.question[lang] ?? q.question.en ?? q.question.tr ?? '' : q.question;
    const options  = typeof q.options  === 'object' && !Array.isArray(q.options) ? q.options[lang] ?? q.options.en ?? q.options.tr ?? [] : q.options;
    return { question, options };
  }

  return (
    <QuizContext.Provider value={{
      questions, lang, setLang, getText,
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
