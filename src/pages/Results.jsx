import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

function Confetti() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#7c3aed','#6366f1','#10b981','#f59e0b','#f43f5e','#3b82f6','#a855f7','#34d399'];
    const particles = Array.from({ length: 180 }, () => ({
      x:  Math.random() * canvas.width,
      y:  -20 - Math.random() * 100,
      w:  Math.random() * 10 + 5,
      h:  Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      vr: (Math.random() - 0.5) * 6,
      opacity: 1,
    }));

    let animId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.06;
        p.rot += p.vr;
        if (p.y > canvas.height - 80) p.opacity = Math.max(0, p.opacity - 0.02);
        if (p.y < canvas.height + 20) alive = true;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}

export default function Results() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const { lang, getText } = useQuiz();

  if (!state) { navigate('/'); return null; }

  const { answers, questions } = state;
  const correct = answers.filter(a => a.selected === a.correct).length;
  const total   = answers.length;
  const percent = Math.round((correct / total) * 100);
  const showConfetti = percent >= 80;

  function grade() {
    if (percent >= 90) return { label: lang === 'en' ? 'Excellent! 🎉' : 'Mükemmel! 🎉', cls: 'grade-excellent' };
    if (percent >= 70) return { label: lang === 'en' ? 'Good Job! 👍' : 'İyi iş! 👍',    cls: 'grade-good' };
    if (percent >= 50) return { label: lang === 'en' ? 'Average 📚' : 'Orta 📚',          cls: 'grade-medium' };
    return              { label: lang === 'en' ? 'Keep Trying 💪' : 'Tekrar Dene 💪',       cls: 'grade-poor' };
  }

  const { label, cls } = grade();

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="results-page">
        <div className="results-card">
          <h1>{lang === 'en' ? 'Quiz Results' : 'Quiz Sonuçları'}</h1>

          <div className={`score-circle ${cls}`}>
            <span className="score-percent">{percent}%</span>
            <span className="score-label">{label}</span>
          </div>

          <p className="score-detail">
            {correct} / {total} {lang === 'en' ? 'correct answers' : 'doğru cevap'}
          </p>

          <div className="results-breakdown">
            {questions.map((q, i) => {
              const a          = answers[i];
              const isCorrect  = a.selected === a.correct;
              const { question, options } = getText(q);
              return (
                <div key={q.id} className={`result-row ${isCorrect ? 'result-correct' : 'result-wrong'}`}>
                  <span className="result-icon">{isCorrect ? '✓' : '✗'}</span>
                  <div className="result-info">
                    <p className="result-question">{question}</p>
                    {!isCorrect && (
                      <p className="result-answer">
                        {lang === 'en' ? 'Your answer:' : 'Senin cevabın:'}{' '}
                        <b>{options[a.selected]}</b>
                        {' — '}
                        {lang === 'en' ? 'Correct:' : 'Doğru:'}{' '}
                        <b>{options[a.correct]}</b>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="results-actions">
            <button className="btn-primary" onClick={() => navigate(-1)}>
              {lang === 'en' ? '↩ Try Again' : '↩ Tekrar Çöz'}
            </button>
            <button className="btn-secondary" onClick={() => navigate('/')}>
              {lang === 'en' ? 'Home' : 'Ana Sayfa'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
