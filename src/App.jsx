import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QuizProvider } from './context/QuizContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import QuizConfig from './pages/QuizConfig';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Gecmis from './pages/Gecmis';
import Admin from './pages/Admin';
import './App.css';

export default function App() {
  return (
    <QuizProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </QuizProvider>
  );
}
