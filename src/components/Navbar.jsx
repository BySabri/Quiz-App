import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';

export default function Navbar() {
  const { pathname }    = useLocation();
  const { lang, setLang } = useQuiz();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/',       label: 'Ana Sayfa', labelEn: 'Home' },
    { to: '/gecmis', label: 'Geçmiş',   labelEn: 'History' },
    { to: '/admin',  label: 'Admin',     labelEn: 'Admin' },
  ];

  const tr = lang === 'tr';

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>QuizApp</Link>

      {/* Desktop links */}
      <div className="nav-center nav-desktop">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={pathname === l.to ? 'nav-link active' : 'nav-link'}>
            {tr ? l.label : l.labelEn}
          </Link>
        ))}
      </div>

      <div className="nav-right">
        {/* Lang switch */}
        <div className="lang-switch" title="Dil değiştir">
          <span className={lang === 'en' ? 'lang-label active' : 'lang-label'}>EN</span>
          <button
            className={`switch-track ${lang === 'tr' ? 'switch-on' : ''}`}
            onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
            aria-label="Dil değiştir"
          >
            <span className="switch-thumb" />
          </button>
          <span className={lang === 'tr' ? 'lang-label active' : 'lang-label'}>TR</span>
        </div>

        {/* Hamburger (mobile) */}
        <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menü">
          <span className={`ham-bar ${menuOpen ? 'open' : ''}`} />
          <span className={`ham-bar ${menuOpen ? 'open' : ''}`} />
          <span className={`ham-bar ${menuOpen ? 'open' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {links.map(l => (
            <Link key={l.to} to={l.to}
              className={pathname === l.to ? 'mobile-link active' : 'mobile-link'}
              onClick={() => setMenuOpen(false)}>
              {tr ? l.label : l.labelEn}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
