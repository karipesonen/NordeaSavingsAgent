import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:8000';

// ── Load curated education resources ──────────────────────────────────────────
const RESOURCES = JSON.parse(
  readFileSync(join(__dirname, 'public', 'data', 'education-resources.json'), 'utf-8')
).resources;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

// ── Helpers ────────────────────────────────────────────────────────────────────

// Human-readable labels for the Python routing words
const AGENT_LABELS = {
  analyst:    'Financial Analyst',
  web:        'Web Research',
  both:       'Financial Analyst · Web Research',
  banking:    'Banking',
  investment: 'Investment',
};

async function callPython(path, body) {
  const res = await fetch(`${PYTHON_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Python API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Extract the thread_id from the request (sent by the frontend as a header
// or inside sessionState). Fall back to "default" so single-user demos work.
function getThreadId(req) {
  return (
    req.headers['x-thread-id'] ||
    req.body?.sessionState?.threadId ||
    'default'
  );
}

// ── Main chat endpoint ─────────────────────────────────────────────────────────
// POST /api/nora/chat
// Body (from frontend): { messages: [{role, content}], memory, sessionState }
// Response:             { message, cards, suggestedReplies, memoryUpdates, invokedAgents }
app.post('/api/nora/chat', async (req, res) => {
  const { messages = [] } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'messages required' });

  // The last user message is what we forward to the Python agent
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return res.status(400).json({ error: 'no user message found' });

  const threadId = getThreadId(req);

  try {
    const data = await callPython('/chat', { message: lastUser.content, thread_id: threadId });

    // Banking interrupt → show a confirmation card so the frontend can handle it
    if (data.pending_confirmation) {
      return res.json({
        message: '',
        cards: [{
          type: 'banking_confirm',
          data: {
            message: data.pending_confirmation.message,
            threadId,
          },
        }],
        suggestedReplies: [],
        memoryUpdates: [],
        invokedAgents: ['banking'],
      });
    }

    const invokedAgents = (data.invoked_agents || []).map(a => AGENT_LABELS[a] || a);

    res.json({
      message: data.message || '',
      cards: [],
      suggestedReplies: [],
      memoryUpdates: [],
      invokedAgents,
    });
  } catch (err) {
    console.error('[/api/nora/chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Banking confirmation endpoint ──────────────────────────────────────────────
// POST /api/nora/confirm
// Body: { threadId, answer }
// Response: same shape as /api/nora/chat
app.post('/api/nora/confirm', async (req, res) => {
  const { threadId, answer } = req.body;
  if (!threadId || !answer) return res.status(400).json({ error: 'threadId and answer required' });

  try {
    const data = await callPython('/confirm', { thread_id: threadId, answer });

    // The graph might pause again (chained write actions)
    if (data.pending_confirmation) {
      return res.json({
        message: '',
        cards: [{
          type: 'banking_confirm',
          data: { message: data.pending_confirmation.message, threadId },
        }],
        suggestedReplies: [],
        memoryUpdates: [],
        invokedAgents: ['banking'],
      });
    }

    res.json({
      message: data.message || '',
      cards: [],
      suggestedReplies: [],
      memoryUpdates: [],
      invokedAgents: ['banking'],
    });
  } catch (err) {
    console.error('[/api/nora/confirm]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Curated resource library ───────────────────────────────────────────────────
app.get('/api/resources', (_req, res) => res.json({ resources: RESOURCES }));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let pythonOk = false;
  try {
    const r = await fetch(`${PYTHON_API}/health`);
    pythonOk = r.ok;
  } catch (_) {}
  res.json({ ok: true, pythonApi: PYTHON_API, pythonOk });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Nora server   → http://localhost:${PORT}`);
  console.log(`Python agents → ${PYTHON_API}`);
});
