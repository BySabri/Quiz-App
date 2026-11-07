import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QuizProvider, useQuiz } from './context/QuizContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
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
      <div className="app-loading-ring">
        <div className="app-loading-ring-inner" />
        <span className="app-loading-icon">⚡</span>
      </div>
      <div className="app-loading-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}

function AppError({ message }) {
  const { signOut } = useAuth();
  return (
    <div className="app-loading">
      <p style={{ color: 'var(--danger)', marginBottom: 8 }}>Veritabanına bağlanılamadı</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{message}</p>
      <button className="btn-secondary btn-sm" onClick={signOut}>Çıkış yap</button>
    </div>
  );
}

function Inner() {
  const { authLoading, user } = useAuth();
  const { loading, dbError }  = useQuiz();

  if (authLoading) return <AppLoading />;
  if (!user)       return <Login />;
  if (loading)     return <AppLoading />;
  if (dbError)     return <AppError message={dbError} />;

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

// Kullanıcı değişince (giriş/çıkış) quiz state'i sıfırdan kurulsun
function UserScopedApp() {
  const { user } = useAuth();
  return (
    <QuizProvider key={user?.id ?? 'guest'}>
      <BrowserRouter>
        <Inner />
      </BrowserRouter>
    </QuizProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UserScopedApp />
    </AuthProvider>
  );
}
