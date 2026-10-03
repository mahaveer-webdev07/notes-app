const COLORS = ['#facc15', '#f97316', '#ef4444', '#22c55e', '#38bdf8'];

// ---------- State ----------
let notes = loadNotes();
let activeId = null;
let search = '';
let sort = 'recent';
let focus = false;
let copied = false;

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const workspace = $('workspace');
const noteList = $('noteList');
const editor = $('editor');
const counts = $('counts');

// ---------- Storage (same key/format as the React version) ----------
function loadNotes() {
  try {
    const data = JSON.parse(localStorage.getItem('notes'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem('notes', JSON.stringify(notes));
}

// ---------- Helpers ----------
function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(ts).toLocaleDateString();
}

const getActive = () => notes.find((n) => n.id === activeId);

// ---------- Actions ----------
function addNote() {
  const note = {
    id: Date.now(),
    title: 'Untitled',
    body: '',
    pinned: false,
    color: COLORS[0],
    updatedAt: Date.now(),
  };
  notes.unshift(note);
  activeId = note.id;
  save();
  renderAll();
  const t = editor.querySelector('.title-input');
  if (t) { t.focus(); t.select(); }
}

function updateNote(changes) {
  const note = getActive();
  if (!note) return;
  Object.assign(note, changes, { updatedAt: Date.now() });
  save();
}

function deleteNote() {
  if (!confirm('Delete this note?')) return;
  notes = notes.filter((n) => n.id !== activeId);
  activeId = null;
  save();
  renderAll();
}

async function copyNote() {
  const note = getActive();
  const text = `${note.title}\n\n${note.body}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback for browsers/pages where the Clipboard API is blocked
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  copied = true;
  renderEditor();
  setTimeout(() => { copied = false; if (getActive()) renderEditor(); }, 1500);
}

function downloadNote() {
  const note = getActive();
  const blob = new Blob([`${note.title}\n\n${note.body}`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(note.title || 'note').replace(/[^\w\- ]+/g, '')}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------- Rendering ----------
function renderCounts() {
  const pinned = notes.filter((n) => n.pinned).length;
  counts.textContent = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} · ${pinned} pinned`;
}

function renderList() {
  const q = search.toLowerCase();
  const visible = notes
    .filter((n) => (n.title + n.body).toLowerCase().includes(q))
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1; // pinned first
      if (sort === 'az') return (a.title || '').localeCompare(b.title || '');
      return (b.updatedAt ?? b.id) - (a.updatedAt ?? a.id);     // most recent first
    });

  noteList.innerHTML = '';

  if (visible.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = notes.length === 0
      ? 'No notes yet. Click "+ New" to start.'
      : 'No notes match your search.';
    noteList.appendChild(p);
    return;
  }

  visible.forEach((n) => {
    const item = document.createElement('div');
    item.className = 'note-item' + (n.id === activeId ? ' active' : '');
    item.dataset.id = n.id;

    const title = document.createElement('div');
    title.className = 'note-title';
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = n.color || COLORS[0];
    title.append(dot, (n.pinned ? '📌 ' : '') + (n.title || 'Untitled'));

    const meta = document.createElement('div');
    meta.className = 'note-meta muted';
    meta.textContent = `${n.body.slice(0, 35) || 'Empty note'} · ${timeAgo(n.updatedAt ?? n.id)}`;

    item.append(title, meta);
    noteList.appendChild(item);
  });
}

function renderStats() {
  const note = getActive();
  const el = $('stats');
  if (!note || !el) return;
  const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
  const readingTime = words ? Math.max(1, Math.ceil(words / 200)) : 0;
  el.innerHTML = '';
  [
    `${words} words`,
    `${note.body.length} characters`,
    `${readingTime} min read`,
    `Edited ${timeAgo(note.updatedAt ?? note.id)}`,
  ].forEach((t) => {
    const s = document.createElement('span');
    s.textContent = t;
    el.appendChild(s);
  });
}

function renderEditor() {
  const note = getActive();
  workspace.classList.toggle('focus', focus);

  if (!note) {
    editor.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📝</div>
        <h2>Start writing</h2>
        <p class="muted">Select a note from the list or create a new one.</p>
        <button id="empty-new">+ New note</button>
      </div>`;
    $('empty-new').addEventListener('click', addNote);
    return;
  }

  // Keep the cursor where it was if the editor is being re-rendered
  const prev = editor.querySelector('textarea');
  const hadFocus = prev && document.activeElement === prev;
  const selStart = prev ? prev.selectionStart : 0;
  const selEnd = prev ? prev.selectionEnd : 0;

  editor.innerHTML = `
    <div class="row">
      <input class="title-input" id="title" placeholder="Title" />
    </div>
    <div class="row toolbar">
      <div class="row" id="colors"></div>
      <div class="row">
        <button class="ghost" id="btn-pin"></button>
        <button class="ghost" id="btn-copy"></button>
        <button class="ghost" id="btn-download">Download</button>
        <button class="ghost" id="btn-focus"></button>
        <button class="danger" id="btn-delete">Delete</button>
      </div>
    </div>
    <textarea id="body" placeholder="Start writing..."></textarea>
    <div class="stats muted" id="stats"></div>`;

  // set values via properties (safe, no HTML injection)
  $('title').value = note.title;
  $('body').value = note.body;
  $('btn-pin').textContent = note.pinned ? 'Unpin' : 'Pin';
  $('btn-copy').textContent = copied ? 'Copied ✓' : 'Copy';
  $('btn-focus').textContent = focus ? 'Exit focus' : 'Focus';

  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'dot' + (note.color === c ? ' selected' : '');
    b.style.background = c;
    b.setAttribute('aria-label', `Set colour ${c}`);
    b.addEventListener('click', () => { updateNote({ color: c }); renderAll(); });
    $('colors').appendChild(b);
  });

  $('title').addEventListener('input', (e) => {
    updateNote({ title: e.target.value });
    renderList(); renderStats();
  });
  $('body').addEventListener('input', (e) => {
    updateNote({ body: e.target.value });
    renderList(); renderStats();
  });
  $('btn-pin').addEventListener('click', () => { updateNote({ pinned: !getActive().pinned }); renderAll(); });
  $('btn-copy').addEventListener('click', copyNote);
  $('btn-download').addEventListener('click', downloadNote);
  $('btn-focus').addEventListener('click', () => { focus = !focus; renderEditor(); });
  $('btn-delete').addEventListener('click', deleteNote);

  if (hadFocus) {
    const t = $('body');
    t.focus();
    t.setSelectionRange(selStart, selEnd);
  }
  renderStats();
}

function renderAll() {
  renderCounts();
  renderList();
  renderEditor();
}

// ---------- Sidebar events ----------
$('btn-new').addEventListener('click', addNote);
$('search').addEventListener('input', (e) => { search = e.target.value; renderList(); });
$('sort').addEventListener('change', (e) => { sort = e.target.value; renderList(); });
noteList.addEventListener('click', (e) => {
  const item = e.target.closest('.note-item');
  if (!item) return;
  activeId = Number(item.dataset.id);
  renderList();
  renderEditor();
});

// the counts also need refreshing while typing (title/body don't change them, but pin does via renderAll)
renderAll();
