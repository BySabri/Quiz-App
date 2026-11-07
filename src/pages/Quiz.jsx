import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { filterQuestions, applyPool } from '../lib/filters';
import { shuffle, buildOptionOrders, formatClock } from '../lib/quizUtils';

const DEFAULT_CONFIG = { count: null, random: false, timer: 0 };

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
  return typeof q.question === 'object' && q.question.en && q.question.tr;
}

// Soru listesini kur; devam ediliyorsa kayıttan geri yükle
function buildInit({ state, questions, stats, getRawProgress }) {
  const filter = state?.filter ?? null;
  const config = state?.config ?? DEFAULT_CONFIG;

  if (state?.resume === true) {
    const raw = getRawProgress(state.progressKey ?? filter);
    if (raw?.questionIds) {
      const rebuilt = raw.questionIds.map(id => questions.find(q => q.id === id)).filter(Boolean);
      if (rebuilt.length === raw.questionIds.length) {
        return {
          filtered:     rebuilt,
          optionOrders: raw.optionOrders ?? {},
          current:      raw.current   ?? 0,
          answerMap:    raw.answerMap ?? {},
          unsureMap:    raw.unsureMap ?? {},
          streak:       raw.streak    ?? 0,
          startTime:    raw.startTime ?? Date.now(),
          filter:       raw.filter ?? filter,
        };
      }
    }
  }

  let base;
  if (state?.specificIds?.length > 0) {
    base = questions.filter(q => state.specificIds.includes(q.id));
  } else {
    base = applyPool(filterQuestions(questions, filter), config.pool ?? 'all', stats);
    if (config.random) base = shuffle(base);
    if (config.count)  base = base.slice(0, config.count);
  }
  return {
    filtered:     base,
    optionOrders: buildOptionOrders(base, !!config.shuffleOptions),
    current: 0, answerMap: {}, unsureMap: {}, streak: 0,
    startTime: Date.now(),
    filter,
  };
}

export default function Quiz() {
  const { questions, stats, getRawProgress, lang } = useQuiz();
  const navigate  = useNavigate();
  const { state } = useLocation();
  // Bir kez kurulur (karıştırma her render'da tekrarlanmasın)
  const [init] = useState(() => buildInit({ state, questions, stats, getRawProgress }));
  const tr = lang === 'tr';

  if (init.filtered.length === 0) {
    return (
      <div className="quiz-empty">
        <p>{tr ? 'Soru bulunamadı.' : 'No questions found.'}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{tr ? 'Ana Sayfa' : 'Home'}</button>
      </div>
    );
  }
  return <QuizRunner init={init} config={state?.config ?? DEFAULT_CONFIG} />;
}

// Modlar:
//   study (varsayılan) → seç → Cevapla → doğru cevap + açıklama → Sonraki
//   exam               → seç (anında kaydedilir, değiştirilebilir), geri bildirim yok,
//                        toplam süre, sonuçlar ve istatistik kaydı sınav bitince
function QuizRunner({ init, config }) {
  const { lang, recordAnswers, saveScore, saveProgress, clearProgress } = useQuiz();
  const navigate = useNavigate();
  const tr     = lang === 'tr';
  const isExam = config.mode === 'exam';
  const { filtered, optionOrders, startTime, filter: activeFilter } = init;

  const [current,      setCurrent]      = useState(init.current);
  const [selected,     setSelected]     = useState(init.answerMap[init.current]?.selected ?? null);
  const [showFeedback, setShowFeedback] = useState(!isExam && !!init.answerMap[init.current]);
  const [answerMap,    setAnswerMap]    = useState(init.answerMap); // index -> { questionId, selected, correct }
  const [unsureMap,    setUnsureMap]    = useState(init.unsureMap); // index -> true ("emin değilim")
  const [streak,       setStreak]       = useState(init.streak);
  const [timeLeft,     setTimeLeft]     = useState(config.timer || 0);
  const [now,          setNow]          = useState(() => Date.now());
  const [cardKey,      setCardKey]      = useState(init.current);
  const [qLang,        setQLang]        = useState(lang); // bu soru için aktif dil

  const timerRef    = useRef(null);
  const finishedRef = useRef(false); // bitir bir kez çalışsın

  // ---- Türetilmiş değerler ----
  const q = filtered[current];
  const { question, options } = pickText(q, qLang);
  // Ekrandaki sıra → orijinal şık indexi (cevaplar her zaman orijinal indexle saklanır)
  const perm = (optionOrders[q.id] ?? options.map((_, i) => i)).filter(i => i < options.length);
  const explanation = q.explanation
    ? (typeof q.explanation === 'object' ? q.explanation[qLang] ?? q.explanation.en ?? q.explanation.tr : q.explanation)
    : null;
  const showLangTab = hasBothLangs(q);

  const isLastQuestion = current === filtered.length - 1;
  const answeredCount  = Object.keys(answerMap).length;
  const progress       = isExam
    ? (answeredCount / filtered.length) * 100
    : ((current + (showFeedback ? 1 : 0)) / filtered.length) * 100;

  // Sınav süresi başlangıç zamanından hesaplanır → sayfa kapanıp açılsa da doğru işler
  const examLeft = isExam && config.examSeconds
    ? Math.max(0, config.examSeconds - Math.floor((now - startTime) / 1000))
    : null;

  const timerVisible = examLeft !== null || (!isExam && config.timer > 0);
  const timerPercent = examLeft !== null
    ? (examLeft / config.examSeconds) * 100
    : config.timer ? (timeLeft / config.timer) * 100 : 100;
  const timerDanger  = examLeft !== null ? examLeft <= 60 : (config.timer > 0 && timeLeft <= 5);

  const filterLabel = activeFilter
    ? activeFilter.type === 'topic' ? `${activeFilter.category} › ${activeFilter.value}` : activeFilter.value
    : (tr ? 'Tüm Sorular' : 'All Questions');

  // ---- Kayıt ----
  function persist(patch) {
    saveProgress(activeFilter, {
      questionIds: filtered.map(fq => fq.id),
      filter: activeFilter, config, optionOrders,
      current, answerMap, unsureMap, streak, startTime,
      ...patch,
    });
  }

  // ---- Seçim ----
  function selectOption(origIdx) {
    if (isExam) {
      setSelected(origIdx);
      const newMap = { ...answerMap, [current]: { questionId: q.id, selected: origIdx, correct: q.answer } };
      setAnswerMap(newMap);
      persist({ answerMap: newMap });
    } else if (!showFeedback) {
      setSelected(origIdx);
    }
  }

  function toggleUnsure() {
    if (!isExam && showFeedback) return;
    const newU = { ...unsureMap };
    if (newU[current]) delete newU[current]; else newU[current] = true;
    setUnsureMap(newU);
    if (isExam) persist({ unsureMap: newU });
  }

  // ---- Çalışma modu: cevabı işle (sel = -1 → süre doldu) ----
  function commitAnswer(sel) {
    const entry        = { questionId: q.id, selected: sel, correct: q.answer };
    const newAnswerMap = { ...answerMap, [current]: entry };
    const newStreak    = sel === q.answer ? streak + 1 : 0;
    setSelected(sel);
    setAnswerMap(newAnswerMap);
    setShowFeedback(true);
    setStreak(newStreak);
    recordAnswers([{ questionId: q.id, selected: sel, correctAnswer: q.answer, guessed: !!unsureMap[current] }]);
    // Yarım quiz kaydı → başka cihazdan "Devam Et" ile sürdürülebilir
    if (!isLastQuestion) persist({ answerMap: newAnswerMap, streak: newStreak });
  }

  function handleConfirm() {
    if (selected === null) return;
    clearInterval(timerRef.current);
    commitAnswer(selected);
  }

  // ---- Bitir ----
  function finishQuiz(map) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    clearProgress(activeFilter);

    // Boş bırakılanlar -1 (yanlış sayılır, tekrar listesine düşer)
    const answers = filtered.map((fq, i) => map[i] ?? { questionId: fq.id, selected: -1, correct: fq.answer });
    if (isExam) {
      recordAnswers(answers.map((a, i) => ({
        questionId: a.questionId, selected: a.selected, correctAnswer: a.correct, guessed: !!unsureMap[i],
      })));
    }
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const score     = answers.filter(a => a.selected === a.correct).length;
    const wrongIds  = answers.filter(a => a.selected !== a.correct).map(a => a.questionId);

    saveScore({ filter: activeFilter, config, score, total: filtered.length, timeTaken, wrongIds });
    navigate('/results', { state: { answers, questions: filtered, timeTaken, mode: config.mode } });
  }

  function handleFinishExam() {
    const blank = filtered.length - answeredCount;
    if (blank > 0 && !window.confirm(tr
      ? `${blank} soru boş. Sınavı bitirmek istiyor musun?`
      : `${blank} question(s) unanswered. Finish the exam?`)) return;
    finishQuiz(answerMap);
  }

  // ---- Gezinme ----
  function goTo(index) {
    const entry = answerMap[index];
    setCurrent(index);
    setSelected(entry?.selected ?? null);
    setShowFeedback(!isExam && !!entry);
    setQLang(lang);              // her yeni soruda global dile dön
    setTimeLeft(config.timer || 0);
    setCardKey(k => k + 1);
  }

  function handleBack() {
    if (current === 0) return;
    clearInterval(timerRef.current);
    if (isExam) persist({ current: current - 1 });
    goTo(current - 1);
  }

  function handleNext() {
    clearInterval(timerRef.current);
    if (isLastQuestion) {
      if (isExam) handleFinishExam();
      else finishQuiz(answerMap);
      return;
    }
    persist({ current: current + 1 });
    goTo(current + 1);
  }

  function jumpTo(index) {
    if (index === current) return;
    persist({ current: index });
    goTo(index);
  }

  function handlePrimary(fromKeyboard = false) {
    if (isExam) {
      if (!isLastQuestion) handleNext();
      else if (!fromKeyboard) handleFinishExam(); // klavyeyle yanlışlıkla bitmesin
      return;
    }
    if (!showFeedback) handleConfirm();
    else handleNext();
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const pos = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
    if (pos !== -1) {
      if (pos < perm.length) selectOption(perm[pos]);
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      handlePrimary(true);
    }
    if (e.key === 'ArrowLeft') handleBack();
    if (e.key === 'ArrowRight' && isExam && !isLastQuestion) handleNext();
  }

  // ---- Effect'ler ----
  useEffect(() => { document.title = (isExam ? 'Sınav' : 'Quiz') + ' | QuizApp'; }, [isExam]);

  // Zamanlayıcılar süre dolunca güncel state ile çalışsın diye son handler'ları ref'te tut
  const onTimeUpRef = useRef(null);
  useEffect(() => {
    onTimeUpRef.current = isExam
      ? () => finishQuiz(answerMap)  // sınav süresi bitti → otomatik bitir
      : () => commitAnswer(-1);      // soru süresi bitti → boş cevap
  });

  // Çalışma modu: soru başına geri sayım (başlangıç değerini goTo() ayarlar)
  useEffect(() => {
    if (isExam || !config.timer || showFeedback) return;
    let left = config.timer;
    const id = setInterval(() => {
      left -= 1;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) { clearInterval(id); onTimeUpRef.current?.(); }
    }, 1000);
    timerRef.current = id;
    return () => clearInterval(id);
  }, [current, config.timer]); // eslint-disable-line

  // Sınav modu: saati her saniye ilerlet, süre bitince otomatik bitir
  useEffect(() => {
    if (!isExam || !config.examSeconds) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - startTime >= config.examSeconds * 1000) { clearInterval(id); onTimeUpRef.current?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  // Klavye (her render'da güncel handler'la yeniden bağlanır)
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Görünüm ----
  function optionClass(idx) {
    if (isExam || !showFeedback) return selected === idx ? 'option selected' : 'option';
    const base = 'option disabled-opt';
    if (idx === q.answer)                     return `${base} correct`;
    if (idx === selected && idx !== q.answer) return `${base} wrong`;
    return base;
  }

  const primaryDisabled = !isExam && !showFeedback && selected === null;
  const primaryLabel = isExam
    ? (isLastQuestion ? (tr ? 'Sınavı Bitir' : 'Finish Exam') : (tr ? 'Sonraki' : 'Next'))
    : !showFeedback
      ? (tr ? 'Cevapla' : 'Submit')
      : isLastQuestion
        ? (tr ? 'Bitir' : 'Finish')
        : (tr ? 'Sonraki' : 'Next');
  const showNextArrow = isExam ? !isLastQuestion : showFeedback;

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="quiz-header-left">
          <span className="question-counter">{tr ? 'S' : 'Q'} {current + 1}/{filtered.length}</span>
          <span className="filter-label">{isExam ? `📝 ${filterLabel}` : filterLabel}</span>
        </div>
        <div className="quiz-header-right">
          {examLeft !== null && (
            <div className={`timer-badge ${timerDanger ? 'timer-danger' : ''}`}>{formatClock(examLeft)}</div>
          )}
          {!isExam && config.timer > 0 && (
            <div className={`timer-badge ${timerDanger ? 'timer-danger' : ''}`}>{timeLeft}s</div>
          )}
          {!isExam && streak >= 2 && <div className="streak-badge" key={streak}><span>🔥</span>{streak}</div>}
          {isExam && (
            <button className="btn-secondary btn-sm" onClick={handleFinishExam}>{tr ? 'Bitir' : 'Finish'}</button>
          )}
          {q.topic && <span className="topic-badge">{q.topic}</span>}
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {timerVisible && (
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
          {perm.map((origIdx, pos) => (
            <button key={origIdx} className={optionClass(origIdx)} onClick={() => selectOption(origIdx)}>
              <span className="option-letter">{String.fromCharCode(65 + pos)}</span>
              {options[origIdx]}
            </button>
          ))}
        </div>

        {(isExam || !showFeedback) && (
          <button type="button" className={unsureMap[current] ? 'unsure-btn active' : 'unsure-btn'} onClick={toggleUnsure}>
            🤔 {tr ? 'Emin değilim' : 'Not sure'}
          </button>
        )}

        {!isExam && showFeedback && unsureMap[current] && selected === q.answer && (
          <p className="unsure-note">
            {tr ? 'Doğru, ama emin olmadığın için bu soru tekrar listene eklendi.'
                : 'Correct, but since you weren\'t sure it was added to your review list.'}
          </p>
        )}

        {!isExam && showFeedback && explanation && (
          <div className="explanation-box">
            <p className="explanation-label">💡 {qLang === 'tr' ? 'Açıklama' : 'Explanation'}</p>
            <p className="explanation-text">{explanation}</p>
          </div>
        )}

        {!isExam && showFeedback && streak >= 3 && selected === q.answer && (
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
            onClick={() => handlePrimary()}
            disabled={primaryDisabled}
          >
            {primaryLabel}
            {showNextArrow && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4 }}>
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Sınav modu: soru haritası (cevaplanan / emin olunmayan / şu anki) */}
      {isExam && (
        <div className="exam-nav">
          {filtered.map((fq, i) => (
            <button
              key={fq.id}
              className={['exam-dot', i === current && 'current', answerMap[i] && 'answered', unsureMap[i] && 'unsure']
                .filter(Boolean).join(' ')}
              onClick={() => jumpTo(i)}
            >{i + 1}</button>
          ))}
        </div>
      )}

      <p className="kbd-info">
        {isExam
          ? (tr ? '← → gez · A B C D seç · Enter sonraki' : '← → navigate · A B C D select · Enter next')
          : (tr ? '← geri · A B C D seç · Boşluk onayla · Enter sonraki' : '← back · A B C D select · Space confirm · Enter next')}
      </p>
    </div>
  );
}
