import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuiz } from '../context/QuizContext';

function friendlyError(err, tr) {
  const msg = err?.message ?? '';
  if (err?.code === 'invalid_username')
    return tr ? 'Kullanıcı adı 3–20 karakter olmalı; sadece küçük harf, rakam, nokta, alt çizgi ve tire (Türkçe karakter yok).'
              : 'Username must be 3–20 chars: lowercase letters, digits, dot, underscore, dash.';
  if (/invalid login credentials/i.test(msg)) return tr ? 'Kullanıcı adı veya şifre hatalı.' : 'Wrong username or password.';
  if (/already registered/i.test(msg))        return tr ? 'Bu kullanıcı adı alınmış.' : 'This username is taken.';
  if (/at least 6 characters/i.test(msg))     return tr ? 'Şifre en az 6 karakter olmalı.' : 'Password must be at least 6 characters.';
  if (/email.*(invalid|not confirmed)/i.test(msg) || err?.code === 'email_address_invalid')
    return tr ? 'Supabase hesabı kabul etmedi. Admin: Authentication ayarlarında "Confirm email" kapalı olmalı.'
              : 'Supabase rejected the account. Admin: "Confirm email" must be turned off in Authentication settings.';
  return msg;
}

export default function Login() {
  const { signIn, signUp } = useAuth();
  const { lang, setLang }  = useQuiz();
  const tr = lang === 'tr';

  const [mode,     setMode]     = useState('signin'); // 'signin' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { document.title = (tr ? 'Giriş' : 'Sign in') + ' | QuizApp'; }, [tr]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    if (mode === 'signin') {
      const { error } = await signIn(username, password);
      if (error) setError(friendlyError(error, tr));
    } else {
      const { error, needsConfirm } = await signUp(username, password);
      if (error) setError(friendlyError(error, tr));
      else if (needsConfirm) setError(friendlyError({ message: 'email not confirmed' }, tr));
    }
    setBusy(false);
  }

  const isSignup = mode === 'signup';
  const title    = isSignup ? (tr ? 'Kayıt Ol' : 'Sign up') : (tr ? 'Giriş Yap' : 'Sign in');

  return (
    <div className="admin-login">
      <div className="login-card">
        <div className="hero-icon" style={{ textAlign: 'center', marginBottom: 8 }}>⚡</div>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder={tr ? 'Kullanıcı adı' : 'Username'} value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            required autoFocus />
          <input type="password" placeholder={tr ? 'Şifre (en az 6 karakter)' : 'Password (min 6 chars)'} value={password}
            onChange={e => setPassword(e.target.value)} minLength={6} required
            autoComplete={isSignup ? 'new-password' : 'current-password'} />
          {isSignup && (
            <p className="hint" style={{ margin: 0 }}>
              {tr ? 'Kullanıcı adı: 3–20 karakter, a-z 0-9 . _ -' : 'Username: 3–20 chars, a-z 0-9 . _ -'}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? '…' : title}</button>
        </form>

        <p className="hint" style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          {isSignup ? (tr ? 'Hesabın var mı?' : 'Have an account?') : (tr ? 'Hesabın yok mu?' : 'No account?')}{' '}
          <button type="button" className="link-btn"
            onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); }}>
            {isSignup ? (tr ? 'Giriş yap' : 'Sign in') : (tr ? 'Kayıt ol' : 'Sign up')}
          </button>
        </p>
        <p className="hint" style={{ textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
          <button type="button" className="link-btn" onClick={() => setLang(tr ? 'en' : 'tr')}>
            {tr ? 'English' : 'Türkçe'}
          </button>
        </p>
      </div>
    </div>
  );
}
