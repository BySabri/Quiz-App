import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

function gradeColor(p) {
  if (p >= 80) return 'var(--success)';
  if (p >= 60) return 'var(--primary-light)';
  if (p >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

function gradeLabel(p, tr) {
  if (p >= 90) return tr ? 'Mükemmel' : 'Excellent';
  if (p >= 70) return tr ? 'İyi' : 'Good';
  if (p >= 50) return tr ? 'Orta' : 'Average';
  return tr ? 'Tekrar Dene' : 'Try Again';
}

function timeAgo(isoDate, tr) {
  const diff = Math.floor((Date.now() - new Date(isoDate)) / 1000);
  if (diff < 60)    return tr ? 'Az önce' : 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} ${tr ? 'dk önce' : 'min ago'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${tr ? 'sa önce' : 'hr ago'}`;
  return `${Math.floor(diff / 86400)} ${tr ? 'gün önce' : 'day(s) ago'}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Gecmis() {
  const { scoreHistory, clearHistory, lang } = useQuiz();
  const navigate = useNavigate();
  const tr = lang === 'tr';

  useEffect(() => { document.title = (tr ? 'Geçmiş' : 'History') + ' | QuizApp'; }, [tr]);

  function filterLabel(entry) {
    const f = entry.filter;
    if (!f) return tr ? 'Tüm Sorular' : 'All Questions';
    if (f.type === 'topic') return `${f.category} › ${f.value}`;
    return f.value;
  }

  return (
    <div className="gecmis-page">
      <div className="gecmis-header">
        <h1>{tr ? 'Skor Geçmişi' : 'Score History'}</h1>
        {scoreHistory.length > 0 && (
          <button className="btn-ghost-danger btn-sm" onClick={clearHistory}>
            {tr ? 'Tümünü Temizle' : 'Clear All'}
          </button>
        )}
      </div>

      {scoreHistory.length === 0 ? (
        <div className="gecmis-empty">
          <p className="gecmis-empty-icon">📋</p>
          <p>{tr ? 'Henüz çözülmüş quiz yok.' : 'No quizzes completed yet.'}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            {tr ? 'Quiz Başlat' : 'Start a Quiz'}
          </button>
        </div>
      ) : (
        <>
          {/* Özet istatistik */}
          <div className="gecmis-stats">
            <div className="gecmis-stat">
              <span className="gecmis-stat-n">{scoreHistory.length}</span>
              <span className="gecmis-stat-l">{tr ? 'Toplam Quiz' : 'Total Quizzes'}</span>
            </div>
            <div className="gecmis-stat">
              <span className="gecmis-stat-n">
                {Math.round(scoreHistory.reduce((s, e) => s + e.percent, 0) / scoreHistory.length)}%
              </span>
              <span className="gecmis-stat-l">{tr ? 'Ortalama' : 'Average'}</span>
            </div>
            <div className="gecmis-stat">
              <span className="gecmis-stat-n">
                {Math.max(...scoreHistory.map(e => e.percent))}%
              </span>
              <span className="gecmis-stat-l">{tr ? 'En İyi' : 'Best'}</span>
            </div>
          </div>

          <div className="gecmis-list">
            {scoreHistory.map((entry, i) => (
              <div key={entry.id} className="gecmis-row">
                <div className="gecmis-rank">#{i + 1}</div>
                <div className="gecmis-score-circle" style={{ borderColor: gradeColor(entry.percent), color: gradeColor(entry.percent) }}>
                  <span className="gecmis-pct">{entry.percent}%</span>
                  <span className="gecmis-grade">{gradeLabel(entry.percent, tr)}</span>
                </div>
                <div className="gecmis-details">
                  <p className="gecmis-filter">{filterLabel(entry)}</p>
                  <p className="gecmis-meta">
                    {entry.score}/{entry.total} {tr ? 'doğru' : 'correct'}
                    {entry.timeTaken ? ` · ${entry.timeTaken}s` : ''}
                    {entry.config?.timer ? ` · ${entry.config.timer}s ${tr ? 'süre' : 'timer'}` : ''}
                    {entry.config?.random ? ` · ${tr ? 'rastgele' : 'random'}` : ''}
                  </p>
                  <p className="gecmis-date">{formatDate(entry.date)} · {timeAgo(entry.date, tr)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
