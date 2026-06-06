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
- **Mid-quiz resume** — progress saved to localStorage; a "Continue" card appears on the home page
- **Confetti** — fires on 80%+ score 🎉

### Score History (`/gecmis`)
- Last 20 results stored in localStorage
- Summary stats: total quizzes, average score, personal best
- Per-entry: score %, topic/category, correct count, time taken, timestamp

### Admin Panel (`/admin`)
- **Password protected** (default: `eysadem` — change in `QuizContext.jsx`)
- **Question list** — search by text, filter by category/topic chips, delete individually or all at once
- **Question editor** — add or edit questions via form (EN/TR fields, options, correct answer, explanation)
- **JSON upload** — drag & drop or click to select; validates format, detects duplicates (overwrite or merge-only)
- **JSON export** — download the current question bank for offline editing

---

## JSON Question Format

```json
[
  {
    "id": 1,
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
| `id` | Yes | Unique integer |
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

### Supabase Connection

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

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
│   └── QuizContext.jsx     # Global state: questions, lang, score history, progress
├── pages/
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
└── questions.json          # Default sample questions (loaded on first run)
```

---

## Contributing

To add questions, use the JSON format above and upload via the Admin panel or edit `public/questions.json` directly. Pull requests are welcome.
