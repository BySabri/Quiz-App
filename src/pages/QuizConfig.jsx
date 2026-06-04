import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

const TIMER_OPTIONS = [
  { label: 'Yok', labelEn: 'None', value: 0 },
  { label: '15 sn', labelEn: '15 sec', value: 15 },
  { label: '30 sn', labelEn: '30 sec', value: 30 },
  { label: '60 sn', labelEn: '60 sec', value: 60 },
];

const COUNT_OPTIONS = [10, 20, 30];

export default function QuizConfig() {
  const { questions, lang } = useQuiz();
  const navigate = useNavigate();
  const { state } = useLocation();
  const filter = state?.filter ?? null;

  const filtered = filter
    ? questions.filter(q => {
        if (filter.type === 'category') return (q.category || 'Genel') === filter.value;
        if (filter.type === 'topic')    return (q.topic || 'Diğer') === filter.value && (q.category || 'Genel') === filter.category;
        return true;
      })
    : questions;

  const maxCount = filtered.length;
  const [count,  setCount]  = useState('all');
  const [random, setRandom] = useState(true);
  const [timer,  setTimer]  = useState(0);

  useEffect(() => { document.title = 'Quiz Ayarları | QuizApp'; }, []);

  const tr = lang === 'tr';
  const filterLabel = filter
    ? filter.type === 'topic' ? `${filter.category} › ${filter.value}` : filter.value
    : (tr ? 'Tüm Sorular' : 'All Questions');

  const actualCount = count === 'all' ? maxCount : Math.min(Number(count), maxCount);

  function handleStart() {
    navigate('/quiz', { state: { filter, config: { count: actualCount, random, timer } } });
  }

  return (
    <div className="config-page">
      <div className="config-card">
        <div className="config-badge">{filterLabel}</div>
        <h1 className="config-title">{tr ? 'Quiz Ayarları' : 'Quiz Settings'}</h1>

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
          <div className="config-toggle-row">
            <button
              className={!random ? 'config-opt active' : 'config-opt'}
              onClick={() => setRandom(false)}
            >
              {tr ? 'Sıralı' : 'Sequential'}
            </button>
            <button
              className={random ? 'config-opt active' : 'config-opt'}
              onClick={() => setRandom(true)}
            >
              {tr ? 'Rastgele' : 'Random'}
            </button>
          </div>
        </div>

        {/* Süre */}
        <div className="config-section">
          <p className="config-label">{tr ? 'Soru Başına Süre' : 'Time Per Question'}</p>
          <div className="config-options">
            {TIMER_OPTIONS.map(opt => (
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
          {actualCount} {tr ? 'soru' : 'questions'} · {random ? (tr ? 'rastgele' : 'random') : (tr ? 'sıralı' : 'sequential')} · {timer > 0 ? `${timer}s` : (tr ? 'süresiz' : 'no timer')}
        </div>

        <div className="config-actions">
          <button className="btn-primary config-start-btn" onClick={handleStart}>
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
