const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.use(express.json({ limit: '25mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
const DEFAULT_STATE_PATH = path.join(DATA_DIR, 'default-state.json');

const DEFAULT_DECK_NAMES = ['Statfjord A deck', 'Statfjord B deck', 'Statfjord C deck'];

let state = { version: 1, decks: [] };

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeAttachment(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : generateId('attachment');
  const name = typeof input.name === 'string' ? input.name : 'Attachment';
  const type = typeof input.type === 'string' ? input.type : '';
  const size = Number.isFinite(Number(input.size)) ? Number(input.size) : 0;
  const dataUrl = typeof input.dataUrl === 'string' ? input.dataUrl : '';
  const addedAt = typeof input.addedAt === 'string' ? input.addedAt : new Date().toISOString();
  return { id, name, type, size, dataUrl, addedAt };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const message = typeof entry.message === 'string' && entry.message.trim() ? entry.message.trim() : '';
  if (!message) {
    return null;
  }
  let timestamp = null;
  if (entry.timestamp instanceof Date) {
    timestamp = entry.timestamp.toISOString();
  } else if (typeof entry.timestamp === 'string' && entry.timestamp.trim()) {
    const parsed = new Date(entry.timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      timestamp = parsed.toISOString();
    }
  }
  if (!timestamp) {
    timestamp = new Date().toISOString();
  }
  return { message, timestamp };
}

function normalizeLayoutEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const type = entry.type === 'deck-area' ? 'deck-area' : 'item';
  const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : type === 'deck-area' ? 'Deck area' : 'Item';
  const width = Number.isFinite(Number(entry.width)) ? Number(entry.width) : 5;
  const height = Number.isFinite(Number(entry.height)) ? Number(entry.height) : 3;
  const x = Number.isFinite(Number(entry.x)) ? Number(entry.x) : 0;
  const y = Number.isFinite(Number(entry.y)) ? Number(entry.y) : 0;
  const rotation = Number.isFinite(Number(entry.rotation)) ? Number(entry.rotation) : 0;
  const locked = entry.locked === true || entry.locked === 'true';
  if (type === 'item') {
    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateId('item');
    const color = typeof entry.color === 'string' && entry.color.trim() ? entry.color.trim() : '#3a7afe';
    const comment = typeof entry.comment === 'string' ? entry.comment : '';
    const attachments = Array.isArray(entry.attachments)
      ? entry.attachments.map((item) => normalizeAttachment(item)).filter(Boolean)
      : [];
    const history = Array.isArray(entry.history)
      ? entry.history.map((record) => normalizeHistoryEntry(record)).filter(Boolean)
      : [];
    let lastModified = null;
    if (typeof entry.lastModified === 'string' && entry.lastModified.trim()) {
      const parsed = new Date(entry.lastModified);
      if (!Number.isNaN(parsed.getTime())) {
        lastModified = parsed.toISOString();
      }
    }
    if (!lastModified && history.length) {
      lastModified = history[0].timestamp;
    }
    if (!lastModified) {
      lastModified = new Date().toISOString();
    }
    return {
      type,
      id,
      label,
      width,
      height,
      x,
      y,
      rotation,
      locked,
      color,
      comment,
      attachments,
      history,
      lastModified,
    };
  }
  const nameHidden = entry.nameHidden === true || entry.nameHidden === 'true';
  return { type, label, width, height, x, y, rotation, locked, nameHidden };
}

function normalizePlanningItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  if (item.type !== 'item') {
    return null;
  }
  const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : 'Item';
  const width = Number.isFinite(Number(item.width)) ? Number(item.width) : 5;
  const height = Number.isFinite(Number(item.height)) ? Number(item.height) : 3;
  const x = Number.isFinite(Number(item.x)) ? Number(item.x) : 0;
  const y = Number.isFinite(Number(item.y)) ? Number(item.y) : 0;
  const rotation = Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0;
  const locked = item.locked === true || item.locked === 'true';
  const color = typeof item.color === 'string' && item.color.trim() ? item.color.trim() : '#3a7afe';
  const comment = typeof item.comment === 'string' ? item.comment : '';
  return { type: 'item', label, width, height, x, y, rotation, locked, color, comment };
}

function normalizePlanningJob(job) {
  if (!job || typeof job !== 'object') {
    return {
      id: generateId('plan'),
      label: 'Planning deck',
      deck: { items: [] }
    };
  }
  const id = typeof job.id === 'string' && job.id.trim() ? job.id.trim() : generateId('plan');
  const label = typeof job.label === 'string' && job.label.trim() ? job.label.trim() : 'Planning deck';
  const itemsSource = Array.isArray(job.deck?.items) ? job.deck.items : [];
  const items = itemsSource.map((item) => normalizePlanningItem(item)).filter(Boolean);
  return {
    id,
    label,
    deck: { items }
  };
}

function normalizeDeck(deck) {
  if (!deck || typeof deck !== 'object') {
    const name = typeof deck === 'string' ? deck : undefined;
    return {
      id: generateId('deck'),
      name: name && name.trim() ? name.trim() : 'Deck',
      layout: [],
      jobs: []
    };
  }
  const id = typeof deck.id === 'string' && deck.id.trim() ? deck.id.trim() : generateId('deck');
  const name = typeof deck.name === 'string' && deck.name.trim() ? deck.name.trim() : 'Deck';
  const layoutSource = Array.isArray(deck.layout) ? deck.layout : [];
  const layout = layoutSource.map((entry) => normalizeLayoutEntry(entry)).filter(Boolean);
  const jobsSource = Array.isArray(deck.jobs) ? deck.jobs : [];
  const jobs = jobsSource.map((job) => normalizePlanningJob(job));
  return { id, name, layout, jobs };
}

function normalizeState(raw) {
  const decksSource = Array.isArray(raw?.decks) ? raw.decks : [];
  let decks = decksSource.length ? decksSource : DEFAULT_DECK_NAMES.map((name) => ({ name }));
  decks = decks.map((deck) => normalizeDeck(deck));
  const version = Number.isFinite(Number(raw?.version)) ? Number(raw.version) : (state.version || 0) + 1;
  return { version, decks };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadState() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    state = normalizeState(JSON.parse(raw));
  } catch (error) {
    try {
      const fallback = await fs.readFile(DEFAULT_STATE_PATH, 'utf8');
      state = normalizeState(JSON.parse(fallback));
    } catch {
      state = normalizeState({ decks: DEFAULT_DECK_NAMES.map((name) => ({ name })) });
    }
    await persistState();
  }
}

async function persistState() {
  await ensureDataDir();
  const payload = JSON.stringify(state, null, 2);
  await fs.writeFile(STATE_PATH, payload);
}

app.get('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`window.__INITIAL_STATE__ = ${JSON.stringify(state)};\nwindow.__SOCKET_URL__ = '';`);
});

app.get('/api/state', (req, res) => {
  res.json(state);
});

app.post('/api/state', async (req, res) => {
  try {
    const normalized = normalizeState(req.body || {});
    normalized.version = (state.version || 0) + 1;
    state = normalized;
    await persistState();
    io.emit('state:update', state);
    res.json(state);
  } catch (error) {
    console.error('Failed to save state', error);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

io.on('connection', (socket) => {
  socket.emit('state:init', state);
});

const PORT = process.env.PORT || 3000;

loadState()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`RigLogistics server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
