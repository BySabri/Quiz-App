import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { applyPool } from '../lib/filters';

export default function Home() {
  const { questions, lang, getAllProgress, clearProgress, stats } = useQuiz();
  const navigate = useNavigate();
  const tr = lang === 'tr';

  useEffect(() => { document.title = 'QuizApp'; }, []);

  const resumeSessions = getAllProgress()
    .filter(({ data }) => data.questionIds.length > 0 && data.current < data.questionIds.length);

  function handleDiscard(progressKey) {
    clearProgress(progressKey);
  }

  const dueCount = applyPool(questions, 'due', stats).length;

  const categoryMap = {};
  questions.forEach(q => {
    const cat   = q.category || 'Genel';
    const topic = q.topic    || 'Diğer';
    if (!categoryMap[cat]) categoryMap[cat] = {};
    if (!categoryMap[cat][topic]) categoryMap[cat][topic] = [];
    categoryMap[cat][topic].push(q);
  });

  // Topic bazlı istatistik: her sorunun SON cevabına göre (tüm cihazlardan, kalıcı)
  const statsMap = useMemo(() => {
    const map = {};

    questions.forEach(q => {
      const cat = q.category || 'Genel';
      const topic = q.topic || 'Diğer';
      const key = `${cat}__${topic}`;
      
      if (!map[key]) {
        map[key] = { totalQ: 0, answeredCount: 0, correctCount: 0, wrongCount: 0 };
      }
      
      map[key].totalQ++;
      
      const s = stats[q.id];
      if (s) {
        map[key].answeredCount++;
        if (s.lastCorrect) map[key].correctCount++;
        else map[key].wrongCount++;
      }
    });

    // Oranları hesapla
    Object.keys(map).forEach(key => {
      const stat = map[key];
      stat.totalPct = stat.totalQ > 0 ? (stat.answeredCount / stat.totalQ) * 100 : 0;
      stat.correctRatio = stat.answeredCount > 0 ? stat.correctCount / stat.answeredCount : 0;
      stat.wrongRatio = stat.answeredCount > 0 ? stat.wrongCount / stat.answeredCount : 0;
    });

    return map;
  }, [stats, questions]);

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
                {data.config?.mode === 'exam' && (tr ? '📝 Sınav · ' : '📝 Exam · ')}
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
              onClick={() => handleDiscard(progressKey)}>
              {tr ? 'Sil' : 'Discard'}
            </button>
          </div>
        </div>
      ))}

      {/* Aralıklı tekrar: zamanı gelen sorular */}
      {dueCount > 0 && (
        <div className="resume-card due-card">
          <div className="resume-info">
            <span className="resume-icon">🔁</span>
            <div>
              <p className="resume-title">{tr ? 'Tekrar zamanı' : 'Time to review'}</p>
              <p className="resume-sub">
                {tr ? `${dueCount} soru tekrar bekliyor (yanlışlar, emin olmadıkların ve zamanı gelen doğrular)`
                    : `${dueCount} questions due (mistakes, unsure ones and correct ones due again)`}
              </p>
            </div>
          </div>
          <div className="resume-actions">
            <button className="btn-primary btn-sm"
              onClick={() => navigate('/quiz-config', { state: { filter: null, pool: 'due' } })}>
              {tr ? 'Tekrar Et' : 'Review'}
            </button>
          </div>
        </div>
      )}

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
              let bgGradient;
              if (stat.correctRatio === 1) {
                bgGradient = 'rgba(16,185,129,0.2)';
              } else if (stat.wrongRatio === 1) {
                bgGradient = 'rgba(244,63,94,0.3)';
              } else {
                const correctEdge = stat.correctRatio * 100;
                // 2% yumuşak geçiş
                const blendStart = Math.max(0, correctEdge - 2);
                const blendEnd   = Math.min(100, correctEdge + 2);
                
                bgGradient = `linear-gradient(90deg, 
                  rgba(16,185,129,0.2) 0%, 
                  rgba(16,185,129,0.2) ${blendStart}%, 
                  rgba(244,63,94,0.3) ${blendEnd}%, 
                  rgba(244,63,94,0.3) 100%)`;
              }

              return (
                <button key={topic} className="topic-card"
                  onClick={() => goConfig({ type: 'topic', value: topic, category: cat })}>
                  {stat && stat.totalPct > 0 && (
                    <div className="topic-fill" style={{ width: `${stat.totalPct}%`, background: bgGradient }}>
                      <div className="fill-shimmer" />
                    </div>
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
