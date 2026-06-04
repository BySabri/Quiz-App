import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz() {
  const { questions, lang, getText, saveScore, saveProgress, clearProgress, getRawProgress } = useQuiz();
  const navigate = useNavigate();
  const { state } = useLocation();
  const tr = lang === 'tr';

  const isResume = state?.resume === true;
  const filter   = state?.filter  ?? null;
  const config   = state?.config  ?? { count: null, random: false, timer: 0 };

  // Build filtered list once (or restore from saved)
  const { filtered, initCurrent, initAnswers, initStreak, initStartTime } = useMemo(() => {
    if (isResume) {
      const raw = getRawProgress();
      if (raw && raw.questionIds) {
        const rebuilt = raw.questionIds.map(id => questions.find(q => q.id === id)).filter(Boolean);
        if (rebuilt.length === raw.questionIds.length) {
          return { filtered: rebuilt, initCurrent: raw.current, initAnswers: raw.answers, initStreak: raw.streak ?? 0, initStartTime: raw.startTime ?? Date.now() };
        }
      }
    }
    // Fresh start
    let base = [...questions];
    if (filter?.type === 'category') base = base.filter(q => (q.category || 'Genel') === filter.value);
    if (filter?.type === 'topic')    base = base.filter(q => (q.topic || 'Diğer') === filter.value && (q.category || 'Genel') === filter.category);
    if (config.random) base = shuffle(base);
    if (config.count)  base = base.slice(0, config.count);
    return { filtered: base, initCurrent: 0, initAnswers: [], initStreak: 0, initStartTime: Date.now() };
  }, []); // eslint-disable-line

  const [current,      setCurrent]      = useState(initCurrent);
  const [selected,     setSelected]     = useState(null);
  const [answers,      setAnswers]      = useState(initAnswers);
  const [showFeedback, setShowFeedback] = useState(false);
  const [streak,       setStreak]       = useState(initStreak);
  const [timeLeft,     setTimeLeft]     = useState(config.timer || 0);
  const [cardKey,      setCardKey]      = useState(initCurrent);

  const startTimeRef = useRef(initStartTime);
  const timerRef     = useRef(null);

  useEffect(() => { document.title = 'Quiz | QuizApp'; }, []);

  // Progress is saved manually in handleNext (not via useEffect) to avoid
  // overwriting clearProgress() when the quiz completes.

  // Timer
  useEffect(() => {
    if (!config.timer || showFeedback) return;
    setTimeLeft(config.timer);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setSelected(-1);
          setShowFeedback(true);
          setStreak(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [current, config.timer]); // eslint-disable-line

  // Keyboard
  const handleKey = useCallback((e) => {
    const key = e.key.toLowerCase();
    if (['a','b','c','d'].includes(key) && !showFeedback) {
      setSelected(key.charCodeAt(0) - 97);
    }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      if (!showFeedback && selected !== null) handleConfirm();
      else if (showFeedback) handleNext();
    }
  }, [showFeedback, selected]); // eslint-disable-line

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (filtered.length === 0) {
    return (
      <div className="quiz-empty">
        <p>{tr ? 'Soru bulunamadı.' : 'No questions found.'}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{tr ? 'Ana Sayfa' : 'Home'}</button>
      </div>
    );
  }

  const q = filtered[current];
  const { question, options } = getText(q);
  const explanation = q.explanation
    ? (typeof q.explanation === 'object' ? q.explanation[lang] ?? q.explanation.en : q.explanation)
    : null;

  const progress     = (current / filtered.length) * 100;
  const timerPercent = config.timer ? (timeLeft / config.timer) * 100 : 100;
  const filterLabel  = filter
    ? filter.type === 'topic' ? `${filter.category} › ${filter.value}` : filter.value
    : (tr ? 'Tüm Sorular' : 'All Questions');

  function handleSelect(idx) { if (!showFeedback) setSelected(idx); }

  function handleConfirm() {
    if (selected === null) return;
    clearInterval(timerRef.current);
    setShowFeedback(true);
    setStreak(s => selected === q.answer ? s + 1 : 0);
  }

  function handleNext() {
    const newAnswers = [...answers, { questionId: q.id, selected, correct: q.answer }];
    const nextIndex  = current + 1;

    setSelected(null);
    setShowFeedback(false);
    setCardKey(k => k + 1);

    if (nextIndex >= filtered.length) {
      // Quiz done — clear saved progress first, then navigate
      clearProgress();
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      const score = newAnswers.filter(a => a.selected === a.correct).length;
      saveScore({ filter, config, score, total: filtered.length, timeTaken });
      navigate('/results', { state: { answers: newAnswers, questions: filtered, timeTaken } });
    } else {
      // Save progress for mid-quiz resume
      saveProgress({
        questionIds: filtered.map(q => q.id),
        filter, config,
        current: nextIndex,
        answers: newAnswers,
        streak,
        startTime: startTimeRef.current,
      });
      setAnswers(newAnswers);
      setCurrent(nextIndex);
    }
  }

  function optionClass(idx) {
    if (!showFeedback) return selected === idx ? 'option selected' : 'option';
    const base = 'option disabled-opt';
    if (idx === q.answer)                     return `${base} correct`;
    if (idx === selected && idx !== q.answer) return `${base} wrong`;
    return base;
  }

  const timerDanger = config.timer > 0 && timeLeft <= 5;

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="quiz-header-left">
          <span className="question-counter">{tr ? 'S' : 'Q'} {current + 1}/{filtered.length}</span>
          <span className="filter-label">{filterLabel}</span>
        </div>
        <div className="quiz-header-right">
          {config.timer > 0 && (
            <div className={`timer-badge ${timerDanger ? 'timer-danger' : ''}`}>{timeLeft}s</div>
          )}
          {streak >= 2 && <div className="streak-badge" key={streak}><span>🔥</span>{streak}</div>}
          {q.topic && <span className="topic-badge">{q.topic}</span>}
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {config.timer > 0 && (
        <div className="timer-bar">
          <div className={`timer-fill ${timerDanger ? 'timer-fill-danger' : ''}`}
               style={{ width: `${timerPercent}%`, transition: 'width 1s linear' }} />
        </div>
      )}

      <div className="question-card" key={cardKey}>
        <h2>{question}</h2>

        <div className="options">
          {options.map((opt, idx) => (
            <button key={idx} className={optionClass(idx)} onClick={() => handleSelect(idx)}>
              <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
              {opt}
            </button>
          ))}
        </div>

        {showFeedback && explanation && (
          <div className="explanation-box">
            <p className="explanation-label">💡 {tr ? 'Açıklama' : 'Explanation'}</p>
            <p className="explanation-text">{explanation}</p>
          </div>
        )}

        {!showFeedback ? (
          <button className="btn-primary confirm-btn" onClick={handleConfirm} disabled={selected === null}>
            {tr ? 'Cevapla' : 'Submit Answer'}
          </button>
        ) : (
          <div className="feedback">
            {streak >= 3 && selected === q.answer && (
              <p className="streak-text">🔥 {streak} {tr ? 'üst üste!' : 'in a row!'}</p>
            )}
            <button className="btn-primary confirm-btn" onClick={handleNext}>
              {current + 1 >= filtered.length
                ? (tr ? 'Sonuçları Gör' : 'See Results')
                : (tr ? 'Sonraki →' : 'Next →')}
            </button>
          </div>
        )}
      </div>

      <p className="kbd-info">{tr ? 'A B C D seç · Boşluk onayla · Enter sonraki' : 'A B C D select · Space confirm · Enter next'}</p>
    </div>
  );
}
