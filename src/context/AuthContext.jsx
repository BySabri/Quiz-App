import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

// Supabase Auth e-posta ister. Kullanıcı adı arka planda sahte bir adrese çevrilir
// (hiç mail gönderilmez — Supabase'de "Confirm email" KAPALI olmalı).
// '@' içeren giriş doğrudan e-posta olarak kullanılır.
const USERNAME_DOMAIN = 'quizapp.user';
const USERNAME_RE     = /^[a-z0-9._-]{3,20}$/;

function toEmail(login) {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`;
}

export function AuthProvider({ children }) {
  const [session,     setSession]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin,     setIsAdmin]     = useState(false);

  // Oturum: sayfa açılışında localStorage'dan geri yüklenir (INITIAL_SESSION),
  // sonra giriş/çıkış/token yenileme olaylarını dinler.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const user     = session?.user ?? null;
  const userId   = user?.id ?? null;
  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? '';

  // Admin mi? Karar veritabanında (admins tablosu), burada sadece UI için okunur.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error('is_admin:', error.message);
      setIsAdmin(data === true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function signIn(login, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(login), password });
    return { error };
  }

  async function signUp(username, password) {
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) return { error: { code: 'invalid_username', message: 'invalid_username' } };
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(u), password, options: { data: { username: u } },
    });
    // "Confirm email" açıksa session gelmez → Supabase ayarı yanlış demektir
    return { error, needsConfirm: !error && !data.session };
  }

  async function signOut() {
    setIsAdmin(false);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, username, authLoading, isAdmin: !!userId && isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
