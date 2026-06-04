import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuiz } from '../context/QuizContext';

const EMPTY_FORM = {
  category: '', topic: '',
  question_en: '', question_tr: '',
  opt_en: ['', '', '', ''], opt_tr: ['', '', '', ''],
  answer: 0,
  explanation_en: '', explanation_tr: '',
};

function buildQuestion(f, existingId) {
  return {
    id: existingId ?? Date.now(),
    category: f.category,
    topic: f.topic,
    question: { en: f.question_en, tr: f.question_tr },
    options:  { en: f.opt_en, tr: f.opt_tr },
    answer: f.answer,
    explanation: { en: f.explanation_en, tr: f.explanation_tr },
  };
}

export default function Admin() {
  const { isAdminLoggedIn, adminLogin, adminLogout, questions, uploadQuestions, resetToDefault } = useQuiz();
  const [password,          setPassword]          = useState('');
  const [loginError,        setLoginError]        = useState('');
  const [uploadStatus,      setUploadStatus]      = useState('');
  const [previewQuestions,  setPreviewQuestions]  = useState(null);
  const [parseError,        setParseError]        = useState('');
  const [duplicates,        setDuplicates]        = useState([]);
  const [activeTab,         setActiveTab]         = useState('questions');
  const [filterCat,         setFilterCat]         = useState('');
  const [filterTopic,       setFilterTopic]       = useState('');
  const [searchText,        setSearchText]        = useState('');
  const [confirmDeleteId,   setConfirmDeleteId]   = useState(null);
  const [confirmDeleteAll,  setConfirmDeleteAll]  = useState(false);
  const [selectedFile,      setSelectedFile]      = useState(null);
  const [dragOver,          setDragOver]          = useState(false);
  const [form,              setForm]              = useState(EMPTY_FORM);
  const [editingId,         setEditingId]         = useState(null);
  const [formError,         setFormError]         = useState('');
  const fileRef = useRef();

  useEffect(() => { document.title = 'Admin | QuizApp'; }, []);

  function handleLogin(e) {
    e.preventDefault();
    if (!adminLogin(password)) setLoginError('Şifre yanlış.');
    setPassword('');
  }

  const categories = [...new Set(questions.map(q => q.category || 'Genel'))];
  const topics = filterCat
    ? [...new Set(questions.filter(q => (q.category || 'Genel') === filterCat).map(q => q.topic || 'Diğer'))]
    : [...new Set(questions.map(q => q.topic || 'Diğer'))];

  const visibleQuestions = questions.filter(q => {
    const qText = typeof q.question === 'object' ? (q.question.en ?? q.question.tr ?? '') : (q.question ?? '');
    if (filterCat   && (q.category || 'Genel') !== filterCat)   return false;
    if (filterTopic && (q.topic    || 'Diğer') !== filterTopic) return false;
    if (searchText  && !qText.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  // ---- Silme ----
  function handleDelete(id) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    uploadQuestions(questions.filter(q => q.id !== id));
    setConfirmDeleteId(null);
    setUploadStatus('Soru silindi.');
  }
  function handleDeleteAll() {
    if (!confirmDeleteAll) { setConfirmDeleteAll(true); return; }
    uploadQuestions([]);
    setConfirmDeleteAll(false);
    setUploadStatus('Tüm sorular silindi.');
  }
  function handleCatChange(val) { setFilterCat(val); setFilterTopic(''); }

  // ---- Soru editörü ----
  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function setOptEn(i, val)   { setForm(f => { const a = [...f.opt_en]; a[i] = val; return { ...f, opt_en: a }; }); }
  function setOptTr(i, val)   { setForm(f => { const a = [...f.opt_tr]; a[i] = val; return { ...f, opt_tr: a }; }); }

  function handleEdit(q) {
    setEditingId(q.id);
    setForm({
      category:       q.category || '',
      topic:          q.topic    || '',
      question_en:    typeof q.question === 'object' ? q.question.en || '' : q.question || '',
      question_tr:    typeof q.question === 'object' ? q.question.tr || '' : '',
      opt_en:         Array.isArray(q.options) ? q.options : (q.options?.en ?? ['','','','']),
      opt_tr:         Array.isArray(q.options) ? ['','','',''] : (q.options?.tr ?? ['','','','']),
      answer:         q.answer ?? 0,
      explanation_en: typeof q.explanation === 'object' ? q.explanation.en || '' : q.explanation || '',
      explanation_tr: typeof q.explanation === 'object' ? q.explanation.tr || '' : '',
    });
    setActiveTab('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleFormSave() {
    if (!form.question_en.trim()) { setFormError('İngilizce soru metni zorunlu.'); return; }
    if (form.opt_en.some(o => !o.trim())) { setFormError('Tüm İngilizce seçenekler doldurulmalı.'); return; }
    setFormError('');
    const q = buildQuestion(form, editingId ?? undefined);
    let updated;
    if (editingId !== null) {
      updated = questions.map(x => x.id === editingId ? q : x);
    } else {
      updated = [...questions, { ...q, id: (questions.reduce((m, x) => Math.max(m, x.id || 0), 0)) + 1 }];
    }
    uploadQuestions(updated);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setUploadStatus(editingId !== null ? 'Soru güncellendi.' : 'Yeni soru eklendi.');
    setActiveTab('questions');
  }

  function handleFormCancel() {
    setForm(EMPTY_FORM); setEditingId(null); setFormError('');
    setActiveTab('questions');
  }

  // ---- JSON yükleme ----
  const processFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.json')) { setParseError('Lütfen bir .json dosyası seçin.'); return; }
    setSelectedFile(file.name); setParseError(''); setPreviewQuestions(null); setDuplicates([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('JSON bir dizi (array) olmalı.');
        data.forEach((q, i) => {
          if (!q.question) throw new Error(`Soru ${i + 1}: "question" alanı eksik.`);
          const isBilingual = typeof q.question === 'object';
          if (isBilingual && !q.question.en && !q.question.tr)
            throw new Error(`Soru ${i + 1}: "question" en az "en" veya "tr" içermeli.`);
          const optionsArr = Array.isArray(q.options) ? q.options : (q.options?.en ?? q.options?.tr ?? null);
          if (!optionsArr || optionsArr.length < 2) throw new Error(`Soru ${i + 1}: "options" en az 2 seçenek içermeli.`);
          if (typeof q.answer !== 'number') throw new Error(`Soru ${i + 1}: "answer" sayısal index olmalı.`);
          if (q.answer < 0 || q.answer >= optionsArr.length) throw new Error(`Soru ${i + 1}: "answer" geçerli bir index değil.`);
        });

        // Duplicate algılama
        const existingTexts = new Set(
          questions.map(q => (typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question) ?? '')
        );
        const dups = data.filter(q => {
          const t = typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question;
          return existingTexts.has(t);
        });
        setDuplicates(dups);
        setPreviewQuestions(data);
      } catch (err) { setParseError(err.message); }
    };
    reader.readAsText(file);
  }, [questions]); // eslint-disable-line

  function handleFileChange(e) { processFile(e.target.files[0]); }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  }

  function handleUpload(mode = 'replace') {
    if (!previewQuestions) return;
    let final = previewQuestions;
    if (mode === 'merge') {
      const existingTexts = new Set(
        questions.map(q => (typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question) ?? '')
      );
      const newOnly = previewQuestions.filter(q => {
        const t = typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question;
        return !existingTexts.has(t);
      });
      final = [...questions, ...newOnly];
    }
    uploadQuestions(final);
    setUploadStatus(`${final.length} soru yüklendi.`);
    setPreviewQuestions(null); setDuplicates([]); setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleReset() {
    if (!confirm('Varsayılan sorulara sıfırlanacak. Emin misin?')) return;
    resetToDefault();
    setUploadStatus('Varsayılan sorulara sıfırlandı.');
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'questions.json'; a.click();
    URL.revokeObjectURL(url);
  }

  if (!isAdminLoggedIn) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <h2>Admin Girişi</h2>
          <form onSubmit={handleLogin}>
            <input type="password" placeholder="Şifre" value={password}
              onChange={e => setPassword(e.target.value)} autoFocus />
            {loginError && <p className="error">{loginError}</p>}
            <button className="btn-primary" type="submit">Giriş Yap</button>
          </form>
        </div>
      </div>
    );
  }

  const allCategories = [...new Set(questions.map(q => q.category || 'Genel'))];
  const allTopics     = form.category
    ? [...new Set(questions.filter(q => (q.category || '') === form.category).map(q => q.topic || ''))]
    : [...new Set(questions.map(q => q.topic || ''))];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Paneli</h1>
        <button className="btn-secondary" onClick={adminLogout}>Çıkış</button>
      </div>

      <div className="admin-stats">
        {[
          { n: questions.length, l: 'Soru' },
          { n: categories.length, l: 'Kategori' },
          { n: [...new Set(questions.map(q => q.topic || 'Diğer'))].length, l: 'Konu' },
        ].map(({ n, l }) => (
          <div key={l} className="stat-card">
            <span className="stat-number">{n}</span>
            <span className="stat-label">{l}</span>
          </div>
        ))}
      </div>

      <div className="admin-tabs">
        {[['questions','Sorular'],['editor', editingId !== null ? 'Düzenle' : 'Soru Ekle'],['upload','Yükle / Yönet']].map(([id,label]) => (
          <button key={id} className={activeTab === id ? 'tab active' : 'tab'} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* ---- SORULAR ---- */}
      {activeTab === 'questions' && (
        <div className="admin-section">
          <div className="question-filters">
            <div className="filter-search-wrap">
              <span className="filter-icon">⌕</span>
              <input className="filter-input" type="text" placeholder="Soru ara..."
                value={searchText} onChange={e => setSearchText(e.target.value)} />
              {searchText && <button className="filter-clear" onClick={() => setSearchText('')}>✕</button>}
            </div>
            <div className="filter-chips">
              <button className={filterCat === '' ? 'chip chip-active' : 'chip'} onClick={() => handleCatChange('')}>Tümü</button>
              {categories.map(c => (
                <button key={c} className={filterCat === c ? 'chip chip-active' : 'chip'} onClick={() => handleCatChange(c)}>{c}</button>
              ))}
            </div>
            {filterCat && topics.length > 0 && (
              <div className="filter-chips">
                <button className={filterTopic === '' ? 'chip chip-topic chip-active' : 'chip chip-topic'} onClick={() => setFilterTopic('')}>Tüm Konular</button>
                {topics.map(t => (
                  <button key={t} className={filterTopic === t ? 'chip chip-topic chip-active' : 'chip chip-topic'} onClick={() => setFilterTopic(t)}>{t}</button>
                ))}
              </div>
            )}
          </div>

          <div className="filter-result-bar">
            <span className="filter-result-info">{visibleQuestions.length} soru</span>
            {uploadStatus && <span className="success">{uploadStatus}</span>}
            <button className="btn-primary btn-sm" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setActiveTab('editor'); }}>+ Soru Ekle</button>
            {questions.length > 0 && (
              confirmDeleteAll
                ? <div className="inline-confirm">
                    <span>Tümü silinsin mi?</span>
                    <button className="btn-danger btn-sm" onClick={handleDeleteAll}>Evet, Sil</button>
                    <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteAll(false)}>İptal</button>
                  </div>
                : <button className="btn-danger btn-sm" onClick={handleDeleteAll}>Tüm Soruları Sil</button>
            )}
          </div>

          <div className="question-list">
            {visibleQuestions.map(q => (
              <div key={q.id} className="question-row">
                <div className="question-row-meta">
                  <span className="q-category">{q.category || 'Genel'}</span>
                  {q.topic && <span className="q-topic">{q.topic}</span>}
                </div>
                <p className="question-row-text">
                  {typeof q.question === 'object'
                    ? <><span>{q.question.en}</span>{q.question.tr && <span className="q-tr-text"> / {q.question.tr}</span>}</>
                    : q.question}
                </p>
                <div className="question-row-actions">
                  <button className="btn-secondary btn-sm" onClick={() => handleEdit(q)}>Düzenle</button>
                  {confirmDeleteId === q.id
                    ? <>
                        <span className="delete-confirm-text">Emin misin?</span>
                        <button className="btn-danger btn-sm" onClick={() => handleDelete(q.id)}>Evet</button>
                        <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>İptal</button>
                      </>
                    : <button className="btn-ghost-danger btn-sm" onClick={() => handleDelete(q.id)}>Sil</button>
                  }
                </div>
              </div>
            ))}
            {visibleQuestions.length === 0 && <p className="empty-state-small">Soru bulunamadı.</p>}
          </div>
        </div>
      )}

      {/* ---- SORU EDITÖRÜ ---- */}
      {activeTab === 'editor' && (
        <div className="admin-section">
          <h2 style={{marginBottom:20}}>{editingId !== null ? 'Soruyu Düzenle' : 'Yeni Soru Ekle'}</h2>

          <div className="editor-row">
            <div className="editor-field">
              <label className="editor-label">Kategori</label>
              <input className="editor-input" list="cats" value={form.category}
                onChange={e => setField('category', e.target.value)} placeholder="Network" />
              <datalist id="cats">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="editor-field">
              <label className="editor-label">Konu</label>
              <input className="editor-input" list="tops" value={form.topic}
                onChange={e => setField('topic', e.target.value)} placeholder="TCP" />
              <datalist id="tops">{allTopics.map(t => <option key={t} value={t} />)}</datalist>
            </div>
          </div>

          <div className="editor-row">
            <div className="editor-field">
              <label className="editor-label">Soru (EN) *</label>
              <textarea className="editor-textarea" rows={3} value={form.question_en}
                onChange={e => setField('question_en', e.target.value)} placeholder="How many bits is an IPv4 address?" />
            </div>
            <div className="editor-field">
              <label className="editor-label">Soru (TR)</label>
              <textarea className="editor-textarea" rows={3} value={form.question_tr}
                onChange={e => setField('question_tr', e.target.value)} placeholder="IPv4 adresi kaç bit uzunluğundadır?" />
            </div>
          </div>

          <div className="editor-row">
            <div className="editor-field">
              <label className="editor-label">Seçenekler (EN) *</label>
              {[0,1,2,3].map(i => (
                <div key={i} className="editor-opt-row">
                  <button
                    type="button"
                    className={`opt-letter-btn ${form.answer === i ? 'opt-letter-active' : ''}`}
                    onClick={() => setField('answer', i)}
                    title="Doğru cevap olarak işaretle"
                  >{String.fromCharCode(65+i)}</button>
                  <input className="editor-input" value={form.opt_en[i]}
                    onChange={e => setOptEn(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65+i)}`} />
                </div>
              ))}
            </div>
            <div className="editor-field">
              <label className="editor-label">Seçenekler (TR)</label>
              {[0,1,2,3].map(i => (
                <div key={i} className="editor-opt-row">
                  <span className={`opt-letter-btn ${form.answer === i ? 'opt-letter-active' : ''}`}>{String.fromCharCode(65+i)}</span>
                  <input className="editor-input" value={form.opt_tr[i]}
                    onChange={e => setOptTr(i, e.target.value)} placeholder={`Seçenek ${String.fromCharCode(65+i)}`} />
                </div>
              ))}
            </div>
          </div>

          <p className="editor-answer-hint">
            Doğru cevap: <strong style={{color:'var(--success)'}}>
              {String.fromCharCode(65 + form.answer)} — {form.opt_en[form.answer] || '(boş)'}
            </strong> — değiştirmek için sol tarafta harf butonuna tıkla.
          </p>

          <div className="editor-row">
            <div className="editor-field">
              <label className="editor-label">Açıklama (EN)</label>
              <textarea className="editor-textarea" rows={3} value={form.explanation_en}
                onChange={e => setField('explanation_en', e.target.value)} placeholder="Explain why this answer is correct..." />
            </div>
            <div className="editor-field">
              <label className="editor-label">Açıklama (TR)</label>
              <textarea className="editor-textarea" rows={3} value={form.explanation_tr}
                onChange={e => setField('explanation_tr', e.target.value)} placeholder="Neden doğru olduğunu açıkla..." />
            </div>
          </div>

          {formError && <p className="error" style={{marginBottom:12}}>{formError}</p>}

          <div style={{display:'flex', gap:10}}>
            <button className="btn-primary" onClick={handleFormSave}>
              {editingId !== null ? 'Güncelle' : 'Kaydet'}
            </button>
            <button className="btn-secondary" onClick={handleFormCancel}>İptal</button>
          </div>
        </div>
      )}

      {/* ---- YÜKLE / YÖNET ---- */}
      {activeTab === 'upload' && (
        <>
          <div className="admin-section">
            <h2>Soru Yükle (JSON)</h2>

            <div className="format-box">
              <p className="format-title">Beklenen JSON Formatı</p>
              <pre className="format-pre">{`[
  {
    "id": 1,
    "category": "Network",
    "topic": "TCP",
    "question": { "en": "...", "tr": "..." },
    "options":  { "en": ["A","B","C","D"], "tr": ["A","B","C","D"] },
    "answer": 0,
    "explanation": { "en": "...", "tr": "..." }
  }
]`}</pre>
              <div className="format-rules">
                <span className="format-rule">✓ <code>answer</code> → doğru seçeneğin indexi (0–3)</span>
                <span className="format-rule">✓ <code>topic</code> ve <code>explanation</code> opsiyonel</span>
                <span className="format-rule">✓ Tek dil (sadece <code>en</code> veya <code>tr</code>) de geçerli</span>
              </div>
            </div>

            <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />

            {/* Drop zone */}
            <div
              className={`drop-zone ${dragOver ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <span className="drop-icon">{selectedFile ? '✓' : '↑'}</span>
              <p className="drop-main">{selectedFile ? selectedFile : 'Dosyayı buraya sürükle'}</p>
              <p className="drop-sub">{selectedFile ? 'Değiştirmek için tıkla' : 'veya tıklayarak seç'}</p>
            </div>

            {parseError && <p className="error" style={{marginTop:10}}>{parseError}</p>}

            {previewQuestions && (
              <div className="preview">
                <p className="preview-info">{previewQuestions.length} soru hazır</p>

                {duplicates.length > 0 && (
                  <div className="duplicate-warning">
                    <p className="duplicate-title">⚠️ {duplicates.length} duplicate soru tespit edildi:</p>
                    <ul className="duplicate-list">
                      {duplicates.slice(0, 3).map((q, i) => {
                        const t = typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question;
                        return <li key={i}>{t}</li>;
                      })}
                      {duplicates.length > 3 && <li>...ve {duplicates.length - 3} tane daha</li>}
                    </ul>
                    <div style={{display:'flex', gap:8, marginTop:10}}>
                      <button className="btn-primary btn-sm" onClick={() => handleUpload('replace')}>Üzerine Yaz (Tümünü)</button>
                      <button className="btn-secondary btn-sm" onClick={() => handleUpload('merge')}>Sadece Yenileri Ekle</button>
                    </div>
                  </div>
                )}

                {duplicates.length === 0 && (
                  <>
                    <div className="preview-list">
                      {previewQuestions.slice(0, 5).map((q, i) => {
                        const qText = typeof q.question === 'object' ? q.question.en ?? q.question.tr : q.question;
                        return (
                          <div key={i} className="preview-item">
                            <b>{i + 1}.</b> {qText}
                            {q.topic && <span className="q-topic" style={{marginLeft:8}}>{q.topic}</span>}
                          </div>
                        );
                      })}
                      {previewQuestions.length > 5 && <p style={{color:'var(--text-muted)',fontSize:13}}>...ve {previewQuestions.length - 5} soru daha</p>}
                    </div>
                    <button className="btn-primary" onClick={() => handleUpload('replace')}>Yükle ve Kaydet</button>
                  </>
                )}
              </div>
            )}
            {uploadStatus && <p className="success" style={{marginTop:10}}>{uploadStatus}</p>}
          </div>

          <div className="admin-section">
            <h2>Mevcut Soruları İndir</h2>
            <p className="hint">Mevcut soruları JSON olarak indir, düzenle ve tekrar yükle.</p>
            <button className="btn-secondary" onClick={handleExport}>JSON İndir</button>
          </div>

          <div className="admin-section danger-zone">
            <h2>Sıfırla</h2>
            <p className="hint">Varsayılan örnek sorulara geri dön.</p>
            <button className="btn-danger" onClick={handleReset}>Varsayılana Sıfırla</button>
          </div>
        </>
      )}
    </div>
  );
}
