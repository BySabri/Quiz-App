import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

export default function Home() {
  const { questions, lang, getAllProgress, clearProgress, scoreHistory } = useQuiz();
  const navigate = useNavigate();
  const tr = lang === 'tr';

  useEffect(() => { document.title = 'QuizApp'; }, []);

  const [dismissedKeys, setDismissedKeys] = useState(new Set());

  const resumeSessions = useMemo(() => {
    return getAllProgress()
      .filter(({ progressKey, data }) => {
        if (dismissedKeys.has(progressKey)) return false;
        if (!data?.questionIds?.length) return false;
        if (data.current >= data.questionIds.length) return false;
        return true;
      });
  }, [dismissedKeys]); // eslint-disable-line

  function handleDiscard(progressKey, filter) {
    clearProgress(filter ?? progressKey);
    setDismissedKeys(prev => new Set([...prev, progressKey]));
  }

  const categoryMap = {};
  questions.forEach(q => {
    const cat   = q.category || 'Genel';
    const topic = q.topic    || 'Diğer';
    if (!categoryMap[cat]) categoryMap[cat] = {};
    if (!categoryMap[cat][topic]) categoryMap[cat][topic] = [];
    categoryMap[cat][topic].push(q);
  });

  // Topic bazlı istatistik: tamamlanan + devam eden quizlerden hesapla
  const statsMap = useMemo(() => {
    const map = {};

    // 1. Tamamlanan quizler (scoreHistory, en yeni önce)
    scoreHistory.forEach(entry => {
      if (entry.filter?.type === 'topic') {
        const key = `${entry.filter.category}__${entry.filter.value}`;
        if (!map[key]) map[key] = { percent: entry.percent };
      }
    });

    // 2. Devam eden quizler (answerMap'ten hesapla — scoreHistory'yi override eder)
    getAllProgress().forEach(({ data }) => {
      if (data.filter?.type === 'topic') {
        const key = `${data.filter.category}__${data.filter.value}`;
        const answers = Object.values(data.answerMap ?? {});
        if (answers.length === 0) return;
        const correct = answers.filter(a => a.selected === a.correct).length;
        const pct = Math.round((correct / answers.length) * 100);
        map[key] = { percent: pct }; // progress veri öncelikli
      }
    });

    return map;
  }, [scoreHistory]); // eslint-disable-line

  function goConfig(filter) { navigate('/quiz-config', { state: { filter } }); }

  function resumeLabel(raw) {
    const f = raw.filter;
    if (!f) return tr ? 'Tüm Sorular' : 'All Questions';
    if (f.type === 'topic') return `${f.category} › ${f.value}`;
    return f.value;
  }

  return (
    <div className="home">
      {/* Resume cards — her aktif oturum için ayrı kart */}
      {resumeSessions.map(({ progressKey, data }) => (
        <div className="resume-card" key={progressKey}>
          <div className="resume-info">
            <span className="resume-icon">▶</span>
            <div>
              <p className="resume-title">{tr ? 'Devam eden quiz' : 'Quiz in progress'}</p>
              <p className="resume-sub">
                {resumeLabel(data)} · {data.current + 1}/{data.questionIds.length} {tr ? 'soruda kaldın' : 'questions in'}
              </p>
            </div>
          </div>
          <div className="resume-actions">
            <button className="btn-primary btn-sm"
              onClick={() => navigate('/quiz', { state: { resume: true, progressKey, filter: data.filter, config: data.config } })}>
              {tr ? 'Devam Et' : 'Continue'}
            </button>
            <button className="btn-ghost-danger btn-sm"
              onClick={() => handleDiscard(progressKey, data.filter)}>
              {tr ? 'Sil' : 'Discard'}
            </button>
          </div>
        </div>
      ))}

      {/* Hero */}
      <div className="hero">
        <div className="hero-icon">⚡</div>
        <h1>{tr ? 'Quiz Platformu' : 'Quiz Platform'}</h1>
        <p>{tr ? 'Konu seçerek quiz başlat.' : 'Select a topic to start a quiz.'}</p>
        <button className="btn-primary hero-btn" onClick={() => goConfig(null)}>
          {tr ? `Tüm Sorular (${questions.length})` : `All Questions (${questions.length})`}
        </button>
      </div>

      {/* Categories */}
      {Object.keys(categoryMap).length === 0 && (
        <div className="empty-state">
          <p>{tr ? 'Henüz soru yüklenmemiş. Admin panelinden ekle.' : 'No questions yet. Add via Admin panel.'}</p>
        </div>
      )}

      {Object.keys(categoryMap).map(cat => (
        <div key={cat} className="category-section">
          <div className="category-section-header">
            <div>
              <h2 className="category-title">{cat}</h2>
              <span className="category-count">
                {questions.filter(q => (q.category || 'Genel') === cat).length} {tr ? 'soru' : 'questions'}
              </span>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => goConfig({ type: 'category', value: cat })}>
              {tr ? 'Tümünü Çöz' : 'Solve All'}
            </button>
          </div>
          <div className="topic-grid">
            {Object.entries(categoryMap[cat]).map(([topic, qs]) => {
              const statKey = `${cat}__${topic}`;
              const stat    = statsMap[statKey];
              const pctCorrect = stat ? `${stat.percent}%` : '0%';
              const pctWrong   = stat ? `${100 - stat.percent}%` : '0%';
              return (
                <button key={topic} className="topic-card"
                  onClick={() => goConfig({ type: 'topic', value: topic, category: cat })}>
                  {stat && (
                    <span
                      className="topic-fill"
                      style={{
                        background: `linear-gradient(to right,
                          rgba(16,185,129,0.28) ${stat.percent}%,
                          rgba(239,68,68,0.22)  ${stat.percent}%)`
                      }}
                    />
                  )}
                  <span className="topic-name">{topic}</span>
                  <span className="topic-count">{qs.length} {tr ? 'soru' : 'questions'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
