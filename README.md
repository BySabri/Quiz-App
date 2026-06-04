# Quiz Platform

Bilingual (EN/TR), topic-based quiz application built with React 19 + Vite. Features a dark glassmorphism UI, configurable quiz sessions, mid-quiz resume, score history, and a full admin panel.

---

## Features

### Quiz
- **Category → Topic hierarchy** — browse by subject, drill down to specific topics
- **Quiz Config** — choose question count, sequential or random order, per-question timer (15 / 30 / 60s)
- **Bilingual** — EN/TR toggle in navbar; questions, options and explanations switch instantly
- **Explanation box** — after each answer, a brief explanation appears explaining why the answer is correct
- **Left-to-right fill animation** — smooth green/red sweep on answer reveal instead of distracting shake effects
- **Streak counter** — 🔥 badge when answering 2+ consecutive questions correctly
- **Keyboard shortcuts** — `A` `B` `C` `D` to select, `Space` to confirm, `Enter` for next question
- **Mid-quiz resume** — progress saved to localStorage; a "Continue" card appears on the home page if a quiz was interrupted
- **Confetti** — fires on 80%+ score

### Score History (`/gecmis`)
- Last 20 results stored in localStorage
- Summary stats: total quizzes, average score, personal best
- Per-entry: score %, topic/category, correct count, time taken, timestamp

### Admin Panel (`/admin`)
- **Password protected** (default: `eysadem` — change in `QuizContext.jsx`)
- **Question list** — search by text, filter by category/topic chips, delete individual or all questions
- **Question editor** — add or edit questions directly via form (EN/TR fields, options, correct answer, explanation) without touching JSON
- **JSON upload** — drag & drop or click to select; validates format, detects duplicates (offers overwrite or merge-only)
- **JSON export** — download current questions for editing

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
| `category` | No | Groups topics on home page |
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
| Build tool | Vite 8 |
| Routing | React Router v7 |
| Styling | Plain CSS (CSS custom properties, glassmorphism) |
| Persistence | localStorage only — no backend required |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build for production

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
├── App.jsx                 # Routes
├── App.css                 # All component styles
└── index.css               # CSS variables, keyframes, global reset
public/
└── questions.json          # Default sample questions (loaded on first run)
```
