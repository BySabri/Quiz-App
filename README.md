# Quiz Platform

> An open-source quiz and question bank app I built to study for my midterms and finals — and to make it easy for my friends to study together.

During university I kept running into the same problem: there was no tool where I could load my own notes as questions and run a proper exam simulation by topic. So I built one. The goal was simple — convert study notes into a structured question bank, practice under timed conditions, and share the same question pool with classmates. With the Admin panel, anyone can add questions for any course in JSON format and share them instantly.

---

## Features

### Quiz Engine
- **Category → Topic hierarchy** — browse by course, drill down to specific topics
- **Quiz configuration** — question count, sequential or random order, per-question timer (15 / 30 / 60s)
- **Per-question language tab** — switch between TR/EN on each individual question
- **Explanation box** — after each answer, a short explanation appears for why it's correct
- **Streak counter** — 🔥 badge when answering 2+ consecutive questions correctly
- **Keyboard shortcuts** — `A` `B` `C` `D` to select, `Space` to confirm, `Enter` for next question
- **Study / Exam mode** — study mode shows the answer after each question; exam mode hides feedback until the end, uses a total time limit and a question map to jump around
- **Question pool** — all questions, unsolved, my mistakes, or due for review
- **Spaced repetition** — a question you got right comes back after 1 → 3 → 7 → 14 → 30 days; wrong or "not sure" answers come back immediately. A "Time to review" card on the home page shows what's due
- **"Not sure" flag** — a lucky guess still counts as correct, but the question stays in your review list
- **Shuffled options** — prevents memorising "the answer was B" (questions whose explanation mentions option letters keep their order)
- **Mid-quiz resume** — start on your PC, continue on your phone; a "Continue" card appears on the home page
- **Confetti** — fires on 80%+ score 🎉

### Accounts & Sync
- Username + password sign-in (Supabase Auth; the username is stored as `username@quizapp.user` behind the scenes, no emails are sent)
- Every answer is saved per user, so progress, topic stats and history follow you across devices

### Score History (`/gecmis`)
- Last 50 results, synced to your account
- Summary stats: total quizzes, average score, personal best
- Per-entry: score %, topic/category, correct count, time taken, timestamp

### Admin Panel (`/admin`)
- **Admin-only** — only accounts listed in the `admins` table can see it; writes are enforced by Postgres Row Level Security
- **Question list** — search by text, filter by category/topic chips, delete individually or all at once
- **Question editor** — add or edit questions via form (EN/TR fields, options, correct answer, explanation)
- **JSON upload** — drag & drop or click to select; validates format, detects duplicates (overwrite or merge-only)
- **JSON export** — download the current question bank for offline editing

---

## JSON Question Format

```json
[
  {
    "category": "Network",
    "topic": "TCP",
    "question": { "en": "...", "tr": "..." },
    "options":  { "en": ["A", "B", "C", "D"], "tr": ["A", "B", "C", "D"] },
    "answer": 0,
    "explanation": { "en": "...", "tr": "..." }
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `id` | No | Ignored on import — the database assigns IDs. Re-uploading a question with the same text updates it in place |
| `category` | No | Groups topics on the home page |
| `topic` | No | Sub-category within a category |
| `question` | Yes | Object `{ en, tr }` or plain string |
| `options` | Yes | Object `{ en: [...], tr: [...] }` or plain array — minimum 2 items |
| `answer` | Yes | Zero-based index of the correct option |
| `explanation` | No | Object `{ en, tr }` or plain string |

Single-language (English or Turkish only) is supported — omit the other key.

---

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Routing | React Router v7 |
| Backend | Supabase (PostgreSQL) |
| Deploy | Netlify |
| Styling | Plain CSS (CSS custom properties, glassmorphism dark theme) |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Supabase Setup

1. Create a `.env` file in the project root:

   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. In the Supabase dashboard, open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql). It creates the user tables and locks the `questions` table down (read: signed-in users, write: admins only).
3. **Authentication → Sign In / Providers → Email**: turn off **Confirm email**. This is required — accounts use usernames, so there is no real inbox to confirm.
4. Sign up in the app, then make yourself admin in the SQL Editor:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'yourusername@quizapp.user';
   ```

Re-running `schema.sql` is safe; do it after pulling schema changes.

### Production Build

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
├── components/
│   └── Navbar.jsx          # Top nav with lang toggle + mobile hamburger
├── context/
│   ├── AuthContext.jsx     # Supabase session, sign in/up/out, isAdmin
│   └── QuizContext.jsx     # Questions, per-user stats, history, progress (synced)
├── lib/
│   ├── supabase.js         # Supabase client
│   ├── filters.js          # Category/topic filters, question pools, spaced-repetition schedule
│   └── quizUtils.js        # Shuffling, option order, clock formatting
├── pages/
│   ├── Login.jsx           # Sign in / sign up
│   ├── Home.jsx            # Category/topic selector + resume card
│   ├── QuizConfig.jsx      # Pre-quiz settings (count, order, timer)
│   ├── Quiz.jsx            # Quiz engine with timer + keyboard shortcuts
│   ├── Results.jsx         # Score breakdown + confetti
│   ├── Gecmis.jsx          # Score history page
│   └── Admin.jsx           # Admin panel (question editor, upload, delete)
├── App.jsx                 # Routes + loading screen
├── App.css                 # All component styles
└── index.css               # CSS variables, keyframes, global reset
public/
└── questions.json          # Default sample questions (Admin → "Reset to default")
supabase/
└── schema.sql              # Tables, RLS policies, record_answer(s) functions
```

---

## Contributing

To add questions, use the JSON format above and upload via the Admin panel or edit `public/questions.json` directly. Pull requests are welcome.
