-- =====================================================================
-- QuizApp — Supabase şeması
-- Supabase Dashboard → SQL Editor → bu dosyanın tamamını yapıştır → Run
-- Tekrar çalıştırmak güvenlidir (idempotent).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Admin listesi
--    API üzerinden kimse okuyamaz/yazamaz; sadece is_admin() bakar.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------
-- 2) questions: okuma giriş yapan herkese, yazma sadece admin'e
--    Önce tablodaki eski (herkese açık) policy'lerin hepsi silinir.
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'questions'
  loop
    execute format('drop policy %I on public.questions', p.policyname);
  end loop;
end $$;

alter table public.questions enable row level security;

create policy questions_read on public.questions
  for select to authenticated using (true);
create policy questions_admin_insert on public.questions
  for insert to authenticated with check (public.is_admin());
create policy questions_admin_update on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy questions_admin_delete on public.questions
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- 3) Kullanıcı başına soru istatistiği (her soru için 1 satır)
-- ---------------------------------------------------------------------
create table if not exists public.user_answers (
  user_id          uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  question_id      bigint  not null references public.questions(id) on delete cascade,
  correct_count    int     not null default 0,
  wrong_count      int     not null default 0,
  correct_streak   int     not null default 0,  -- art arda (emin olarak) doğru → aralıklı tekrar
  last_selected    int,
  last_correct     boolean,
  last_answered_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.user_answers enable row level security;

drop policy if exists own_answers on public.user_answers;
create policy own_answers on public.user_answers
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Şema ilk sürümle kurulduysa: correct_streak kolonunu ekle (bir kez)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_answers' and column_name = 'correct_streak'
  ) then
    alter table public.user_answers add column correct_streak int not null default 0;
    update public.user_answers set correct_streak = 1 where last_correct;
  end if;
end $$;

-- Cevabı atomik olarak işler (iki cihazdan aynı anda çözülse de sayaç bozulmaz)
-- p_guessed = "emin değilim" → doğru olsa bile seri sıfırlanır, soru tekrar listesine düşer
drop function if exists public.record_answer(bigint, int, boolean);
create or replace function public.record_answer(
  p_question_id bigint, p_selected int, p_correct boolean, p_guessed boolean default false)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.user_answers as ua
    (user_id, question_id, correct_count, wrong_count, correct_streak, last_selected, last_correct, last_answered_at)
  select auth.uid(), p_question_id,
         case when p_correct then 1 else 0 end,
         case when p_correct then 0 else 1 end,
         case when p_correct and not p_guessed then 1 else 0 end,
         p_selected, p_correct, now()
  where exists (select 1 from public.questions where id = p_question_id)  -- silinmiş soruyu atla
  on conflict (user_id, question_id) do update set
    correct_count    = ua.correct_count + excluded.correct_count,
    wrong_count      = ua.wrong_count   + excluded.wrong_count,
    correct_streak   = case when p_correct and not p_guessed then ua.correct_streak + 1 else 0 end,
    last_selected    = excluded.last_selected,
    last_correct     = excluded.last_correct,
    last_answered_at = excluded.last_answered_at;
$$;

-- Toplu kayıt (sınav modu bitince tüm cevaplar tek istekte)
-- p_answers: [{ "question_id": 1, "selected": 2, "correct": true, "guessed": false }, ...]
create or replace function public.record_answers(p_answers jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare a jsonb;
begin
  for a in select value from jsonb_array_elements(p_answers) loop
    perform public.record_answer(
      (a->>'question_id')::bigint,
      (a->>'selected')::int,
      (a->>'correct')::boolean,
      coalesce((a->>'guessed')::boolean, false));
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 4) Tamamlanan quiz geçmişi
-- ---------------------------------------------------------------------
create table if not exists public.quiz_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  filter      jsonb,
  config      jsonb,
  score       int not null,
  total       int not null,
  time_taken  int,
  wrong_ids   bigint[] not null default '{}'
);
create index if not exists quiz_history_user_created
  on public.quiz_history (user_id, created_at desc);
alter table public.quiz_history enable row level security;

drop policy if exists own_history on public.quiz_history;
create policy own_history on public.quiz_history
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 5) Yarım kalan quizler (PC'de başla, telefonda devam et)
-- ---------------------------------------------------------------------
create table if not exists public.quiz_progress (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  progress_key text not null,
  data         jsonb not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, progress_key)
);
alter table public.quiz_progress enable row level security;

drop policy if exists own_progress on public.quiz_progress;
create policy own_progress on public.quiz_progress
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------
grant select, insert, update, delete
  on public.user_answers, public.quiz_history, public.quiz_progress
  to authenticated;
grant execute on function public.record_answer(bigint, int, boolean, boolean) to authenticated;
grant execute on function public.record_answers(jsonb) to authenticated;


-- =====================================================================
-- SON ADIM (ayrı çalıştır): uygulamadan kayıt olduktan SONRA
-- kendini admin yap. 'kullaniciadin' kısmını kendi kullanıcı adınla değiştir.
-- (Uygulama kullanıcı adını arka planda 'kullaniciadin@quizapp.user' olarak saklar.)
-- =====================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'kullaniciadin@quizapp.user'
-- on conflict do nothing;
