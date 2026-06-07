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

// Tek bir soru için, verilen dilde metin + seçenekleri döndürür
function pickText(q, l) {
  const question = typeof q.question === 'object'
    ? q.question[l] ?? q.question.en ?? q.question.tr ?? ''
    : q.question;
  const options = typeof q.options === 'object' && !Array.isArray(q.options)
    ? q.options[l] ?? q.options.en ?? q.options.tr ?? []
    : q.options;
  return { question, options };
}

function hasBothLangs(q) {
  const qOk = typeof q.question === 'object' && q.question.en && q.question.tr;
  return qOk;
}

export default function Quiz() {
  const { questions, lang, saveScore, saveProgress, clearProgress, getRawProgress } = useQuiz();
  const navigate = useNavigate();
  const { state } = useLocation();
  const tr = lang === 'tr';

  const isResume   = state?.resume === true;
  const filter      = state?.filter  ?? null;
  const progressKey = state?.progressKey ?? null; // resume için
  const config      = state?.config  ?? { count: null, random: false, timer: 0 };

  // Build filtered list once, restore if resuming
  const { filtered, initCurrent, initAnswerMap, initStreak, initStartTime, resumedFilter } = useMemo(() => {
    if (isResume) {
      // progressKey state'ten gelir (Home.jsx'ten geçirildi)
      const raw = getRawProgress(progressKey ?? filter);
      if (raw?.questionIds) {
        const rebuilt = raw.questionIds.map(id => questions.find(q => q.id === id)).filter(Boolean);
        if (rebuilt.length === raw.questionIds.length) {
          return {
            filtered:      rebuilt,
            initCurrent:   raw.current    ?? 0,
            initAnswerMap: raw.answerMap  ?? {},
            initStreak:    raw.streak     ?? 0,
            initStartTime: raw.startTime  ?? Date.now(),
            resumedFilter: raw.filter,
          };
        }
      }
    }
    const activeFilter = filter;
    let base = [...questions];
    if (activeFilter?.type === 'category') base = base.filter(q => (q.category || 'Genel') === activeFilter.value);
    if (activeFilter?.type === 'topic')    base = base.filter(q => (q.topic || 'Diğer') === activeFilter.value && (q.category || 'Genel') === activeFilter.category);
    if (config.random) base = shuffle(base);
    if (config.count)  base = base.slice(0, config.count);
    return { filtered: base, initCurrent: 0, initAnswerMap: {}, initStreak: 0, initStartTime: Date.now(), resumedFilter: null };
  }, []); // eslint-disable-line

  // Resume durumunda filter’ı progress veriden al
  const activeFilter = resumedFilter ?? filter;

  const [current,      setCurrent]      = useState(initCurrent);
  const [selected,     setSelected]     = useState(initAnswerMap[initCurrent]?.selected ?? null);
  const [showFeedback, setShowFeedback] = useState(!!initAnswerMap[initCurrent]);
  const [answerMap,    setAnswerMap]    = useState(initAnswerMap);
  const [streak,       setStreak]       = useState(initStreak);
  const [timeLeft,     setTimeLeft]     = useState(config.timer || 0);
  const [cardKey,      setCardKey]      = useState(initCurrent);
  const [qLang,        setQLang]        = useState(lang); // bu soru için aktif dil

  const startTimeRef = useRef(initStartTime);
  const timerRef     = useRef(null);

  useEffect(() => { document.title = 'Quiz | QuizApp'; }, []);

  // Timer per question
  useEffect(() => {
    if (!config.timer || showFeedback) return;
    setTimeLeft(config.timer);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          const entry = { questionId: filtered[current]?.id, selected: -1, correct: filtered[current]?.answer };
          setAnswerMap(m => ({ ...m, [current]: entry }));
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

  // Keyboard shortcuts
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
    if (e.key === 'ArrowLeft' && current > 0) handleBack();
  }, [showFeedback, selected, current]); // eslint-disable-line

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
  const { question, options } = pickText(q, qLang);
  const explanation = q.explanation
    ? (typeof q.explanation === 'object' ? q.explanation[qLang] ?? q.explanation.en ?? q.explanation.tr : q.explanation)
    : null;
  const showLangTab = hasBothLangs(q);

  const isLastQuestion = current === filtered.length - 1;
  const progress       = ((current + (showFeedback ? 1 : 0)) / filtered.length) * 100;
  const timerPercent   = config.timer ? (timeLeft / config.timer) * 100 : 100;
  const timerDanger    = config.timer > 0 && timeLeft <= 5;
  const filterLabel    = activeFilter
    ? activeFilter.type === 'topic' ? `${activeFilter.category} › ${activeFilter.value}` : activeFilter.value
    : (tr ? 'Tüm Sorular' : 'All Questions');

  function handleSelect(idx) { if (!showFeedback) setSelected(idx); }

  function handleConfirm() {
    if (selected === null) return;
    clearInterval(timerRef.current);
    const entry = { questionId: q.id, selected, correct: q.answer };
    setAnswerMap(m => ({ ...m, [current]: entry }));
    setShowFeedback(true);
    setStreak(s => selected === q.answer ? s + 1 : 0);
  }

  function goTo(index, entry) {
    setCurrent(index);
    setSelected(entry?.selected ?? null);
    setShowFeedback(!!entry);
    setQLang(lang);              // her yeni soruda global dile dön
    setTimeLeft(config.timer || 0);
    setCardKey(k => k + 1);
  }

  function handleBack() {
    if (current === 0) return;
    clearInterval(timerRef.current);
    const prevIndex = current - 1;
    goTo(prevIndex, answerMap[prevIndex]);
  }

  function handleNext() {
    clearInterval(timerRef.current);
    const nextIndex = current + 1;

    if (isLastQuestion) {
      clearProgress(activeFilter);
      const finalAnswers = filtered.map((_, i) => answerMap[i]).filter(Boolean);
      const timeTaken    = Math.round((Date.now() - startTimeRef.current) / 1000);
      const score        = finalAnswers.filter(a => a.selected === a.correct).length;
      saveScore({ filter: activeFilter, config, score, total: filtered.length, timeTaken });
      navigate('/results', { state: { answers: finalAnswers, questions: filtered, timeTaken } });
    } else {
      saveProgress(activeFilter, {
        questionIds: filtered.map(fq => fq.id),
        filter: activeFilter, config,
        current: nextIndex,
        answerMap,
        streak,
        startTime: startTimeRef.current,
      });
      goTo(nextIndex, answerMap[nextIndex]);
    }
  }

  function optionClass(idx) {
    if (!showFeedback) return selected === idx ? 'option selected' : 'option';
    const base = 'option disabled-opt';
    if (idx === q.answer)                     return `${base} correct`;
    if (idx === selected && idx !== q.answer) return `${base} wrong`;
    return base;
  }

  const primaryDisabled = !showFeedback && selected === null;
  const primaryLabel = !showFeedback
    ? (tr ? 'Cevapla' : 'Submit')
    : isLastQuestion
      ? (tr ? 'Bitir' : 'Finish')
      : (tr ? 'Sonraki' : 'Next');

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
        {showLangTab && (
          <div className="qlang-tabs">
            <button
              className={qLang === 'en' ? 'qlang-tab active' : 'qlang-tab'}
              onClick={() => setQLang('en')}
            >EN</button>
            <button
              className={qLang === 'tr' ? 'qlang-tab active' : 'qlang-tab'}
              onClick={() => setQLang('tr')}
            >TR</button>
          </div>
        )}

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
            <p className="explanation-label">💡 {qLang === 'tr' ? 'Açıklama' : 'Explanation'}</p>
            <p className="explanation-text">{explanation}</p>
          </div>
        )}

        {showFeedback && streak >= 3 && selected === q.answer && (
          <p className="streak-text">🔥 {streak} {tr ? 'üst üste!' : 'in a row!'}</p>
        )}

        {/* ---- Nav: dairesel geri (sol) + gradient ileri (sağ) ---- */}
        <div className="quiz-nav">
          <button
            className="nav-arrow"
            onClick={handleBack}
            disabled={current === 0}
            aria-label={tr ? 'Geri' : 'Back'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            className="btn-primary nav-next"
            onClick={showFeedback ? handleNext : handleConfirm}
            disabled={primaryDisabled}
          >
            {primaryLabel}
            {showFeedback && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4 }}>
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <p className="kbd-info">{tr ? '← geri · A B C D seç · Boşluk onayla · Enter sonraki' : '← back · A B C D select · Space confirm · Enter next'}</p>
    </div>
  );
}
