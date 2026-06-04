import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QuizProvider } from './context/QuizContext';
import { useQuiz } from './context/QuizContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import QuizConfig from './pages/QuizConfig';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Gecmis from './pages/Gecmis';
import Admin from './pages/Admin';
import './App.css';

function AppLoading() {
  return (
    <div className="app-loading">
      <div className="app-loading-spinner" />
      <p>Yükleniyor...</p>
    </div>
  );
}

function AppError({ message }) {
  return (
    <div className="app-loading">
      <p style={{ color: 'var(--danger)', marginBottom: 8 }}>Veritabanına bağlanılamadı</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{message}</p>
    </div>
  );
}

function Inner() {
  const { loading, dbError } = useQuiz();
  if (loading)  return <AppLoading />;
  if (dbError)  return <AppError message={dbError} />;

  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/quiz-config"  element={<QuizConfig />} />
          <Route path="/quiz"         element={<Quiz />} />
          <Route path="/results"      element={<Results />} />
          <Route path="/gecmis"       element={<Gecmis />} />
          <Route path="/admin"        element={<Admin />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <QuizProvider>
      <BrowserRouter>
        <Inner />
      </BrowserRouter>
    </QuizProvider>
  );
}
