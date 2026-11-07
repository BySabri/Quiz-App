import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { filterQuestions, applyPool, POOLS } from '../lib/filters';

const TIMER_OPTIONS = [
  { label: 'Yok', labelEn: 'None', value: 0 },
  { label: '15 sn', labelEn: '15 sec', value: 15 },
  { label: '30 sn', labelEn: '30 sec', value: 30 },
  { label: '60 sn', labelEn: '60 sec', value: 60 },
];

// Sınav modu: soru başına ayrılan süre (saniye) → toplam süre soru sayısıyla çarpılır
const EXAM_TIME_OPTIONS = [0, 60, 90, 120];

const COUNT_OPTIONS = [10, 20, 30];

const POOL_LABELS = {
  all:      { tr: 'Tümü',          en: 'All' },
  unsolved: { tr: 'Çözülmemiş',    en: 'Unsolved' },
  wrong:    { tr: 'Yanlışlarım',   en: 'My mistakes' },
  due:      { tr: 'Tekrar Zamanı', en: 'Due for review' },
};

function Toggle({ value, onChange, options }) {
  return (
    <div className="config-toggle-row">
      {options.map(([v, label]) => (
        <button key={String(v)} className={value === v ? 'config-opt active' : 'config-opt'} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function QuizConfig() {
  const { questions, lang, stats } = useQuiz();
  const navigate = useNavigate();
  const { state } = useLocation();
  const filter = state?.filter ?? null;

  const [pool,           setPool]           = useState(state?.pool ?? 'all');
  const [mode,           setMode]           = useState('study'); // 'study' | 'exam'
  const [count,          setCount]          = useState('all');
  const [random,         setRandom]         = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [timer,          setTimer]          = useState(0);
  const [examPerQ,       setExamPerQ]       = useState(90);

  const base       = filterQuestions(questions, filter);
  const poolCounts = Object.fromEntries(POOLS.map(p => [p, applyPool(base, p, stats).length]));
  const maxCount   = poolCounts[pool];

  useEffect(() => { document.title = 'Quiz Ayarları | QuizApp'; }, []);

  const tr = lang === 'tr';
  const isExam = mode === 'exam';
  const filterLabel = filter
    ? filter.type === 'topic' ? `${filter.category} › ${filter.value}` : filter.value
    : (tr ? 'Tüm Sorular' : 'All Questions');

  const actualCount = count === 'all' ? maxCount : Math.min(Number(count), maxCount);
  const examSeconds = isExam ? actualCount * examPerQ : 0;
  const minutes     = s => Math.ceil(s / 60);

  function handleStart() {
    navigate('/quiz', {
      state: {
        filter,
        config: {
          count: actualCount, random, pool, mode, shuffleOptions,
          timer: isExam ? 0 : timer,
          examSeconds,
        },
      },
    });
  }

  const timeSummary = isExam
    ? (examSeconds ? `${minutes(examSeconds)} ${tr ? 'dk' : 'min'}` : (tr ? 'süresiz' : 'no timer'))
    : (timer > 0 ? `${timer}s/${tr ? 'soru' : 'q'}` : (tr ? 'süresiz' : 'no timer'));

  return (
    <div className="config-page">
      <div className="config-card">
        <div className="config-badge">{filterLabel}</div>
        <h1 className="config-title">{tr ? 'Quiz Ayarları' : 'Quiz Settings'}</h1>

        {/* Mod */}
        <div className="config-section">
          <p className="config-label">{tr ? 'Mod' : 'Mode'}</p>
          <Toggle value={mode} onChange={setMode} options={[
            ['study', tr ? 'Çalışma' : 'Study'],
            ['exam',  tr ? 'Sınav'   : 'Exam'],
          ]} />
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {isExam
              ? (tr ? 'Cevaplar ve açıklamalar sonda gösterilir. Sorular arasında serbestçe gezebilir, cevabını değiştirebilirsin.'
                    : 'Answers and explanations are shown at the end. Move freely between questions and change answers.')
              : (tr ? 'Her sorudan sonra doğru cevap ve açıklama gösterilir.'
                    : 'Correct answer and explanation shown after each question.')}
          </p>
        </div>

        {/* Soru havuzu */}
        <div className="config-section">
          <p className="config-label">{tr ? 'Hangi Sorular' : 'Which Questions'}</p>
          <div className="config-options">
            {POOLS.map(p => (
              <button
                key={p}
                className={pool === p ? 'config-opt active' : 'config-opt'}
                onClick={() => { setPool(p); setCount('all'); }}
                disabled={poolCounts[p] === 0}
              >
                {POOL_LABELS[p][tr ? 'tr' : 'en']} ({poolCounts[p]})
              </button>
            ))}
          </div>
        </div>

        {/* Soru sayısı */}
        <div className="config-section">
          <p className="config-label">{tr ? 'Soru Sayısı' : 'Question Count'}</p>
          <div className="config-options">
            <button
              className={count === 'all' ? 'config-opt active' : 'config-opt'}
              onClick={() => setCount('all')}
            >
              {tr ? `Tümü (${maxCount})` : `All (${maxCount})`}
            </button>
            {COUNT_OPTIONS.filter(n => n < maxCount).map(n => (
              <button
                key={n}
                className={count === n ? 'config-opt active' : 'config-opt'}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Sıralama */}
        <div className="config-section">
          <p className="config-label">{tr ? 'Soru Sırası' : 'Question Order'}</p>
          <Toggle value={random} onChange={setRandom} options={[
            [false, tr ? 'Sıralı'   : 'Sequential'],
            [true,  tr ? 'Rastgele' : 'Random'],
          ]} />
        </div>

        {/* Şıklar */}
        <div className="config-section">
          <p className="config-label">{tr ? 'Şıkları Karıştır' : 'Shuffle Options'}</p>
          <Toggle value={shuffleOptions} onChange={setShuffleOptions} options={[
            [true,  tr ? 'Evet'  : 'Yes'],
            [false, tr ? 'Hayır' : 'No'],
          ]} />
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {tr ? '"Cevap B\'ydi" diye ezberlemeyi önler. Açıklamasında şık harfi geçen sorular karıştırılmaz.'
                : 'Prevents memorising "the answer was B". Questions whose explanation mentions option letters stay in order.'}
          </p>
        </div>

        {/* Süre */}
        <div className="config-section">
          <p className="config-label">
            {isExam ? (tr ? 'Sınav Süresi' : 'Exam Time') : (tr ? 'Soru Başına Süre' : 'Time Per Question')}
          </p>
          <div className="config-options">
            {isExam
              ? EXAM_TIME_OPTIONS.map(v => (
                  <button
                    key={v}
                    className={examPerQ === v ? 'config-opt active' : 'config-opt'}
                    onClick={() => setExamPerQ(v)}
                    title={v ? `${v} sn/soru` : undefined}
                  >
                    {v === 0 ? (tr ? 'Süresiz' : 'None') : `${minutes(actualCount * v)} ${tr ? 'dk' : 'min'}`}
                  </button>
                ))
              : TIMER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={timer === opt.value ? 'config-opt active' : 'config-opt'}
                    onClick={() => setTimer(opt.value)}
                  >
                    {tr ? opt.label : opt.labelEn}
                  </button>
                ))}
          </div>
        </div>

        <div className="config-summary">
          {isExam ? (tr ? 'Sınav' : 'Exam') : (tr ? 'Çalışma' : 'Study')}
          {' · '}{actualCount} {tr ? 'soru' : 'questions'}
          {' · '}{random ? (tr ? 'rastgele' : 'random') : (tr ? 'sıralı' : 'sequential')}
          {' · '}{timeSummary}
        </div>

        <div className="config-actions">
          <button className="btn-primary config-start-btn" onClick={handleStart} disabled={actualCount === 0}>
            {tr ? 'Başla' : 'Start'}
          </button>
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            {tr ? 'Geri' : 'Back'}
          </button>
        </div>
      </div>
    </div>
  );
}
