const params = new URLSearchParams(window.location.search);
const apiBase = (params.get('api_base') || '').replace(/\/+$/, '') || '';
const siteId = params.get('site_id') || '';
const initialMode = params.get('mode') || 'public';
const parentOriginParam = (params.get('parent_origin') || '').replace(/\/+$/, '');
const intentParam = (params.get('conversation_intent') || '').trim();
const embeddedParam = params.get('embedded');
const isEmbedded = embeddedParam === '1' || !!parentOriginParam || window.self !== window.top;

const backdrop = document.getElementById('backdrop');
const launcher = document.getElementById('launcher');
const panel = document.getElementById('panel');
const closeBtn = document.getElementById('close-btn');
const modeBadge = document.getElementById('mode-badge');
const headTitle = document.getElementById('head-title');
const headSub = document.getElementById('head-sub');
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');
const submitBtn = form.querySelector('button[type="submit"]');

let activeMode = initialMode === 'eigenx' ? 'eigenx' : 'public';
let widgetToken = '';
let authBearer = '';
let allowedParentOrigin = '';
let pendingAssistant = null;

if (parentOriginParam) {
  try {
    allowedParentOrigin = new URL(parentOriginParam).origin.toLowerCase();
  } catch {
    allowedParentOrigin = '';
  }
}

function setOpen(open) {
  if (isEmbedded) open = true;
  panel.hidden = !open;
  panel.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
  launcher.setAttribute('aria-label', open ? `Close ${activeMode === 'eigenx' ? 'EigenX' : 'Eigen'}` : `Open ${activeMode === 'eigenx' ? 'EigenX' : 'Eigen'}`);
  if (open) input.focus();
}

function timestampNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeIdempotencyKey(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function makeTurn(role, text) {
  const turn = document.createElement('article');
  turn.className = `turn ${role}`;

  const msg = document.createElement('div');
  msg.className = 'msg';
  msg.textContent = text;
  turn.appendChild(msg);

  const meta = document.createElement('div');
  meta.className = 'turn-meta';
  meta.textContent = timestampNow();
  turn.appendChild(meta);

  chat.appendChild(turn);
  chat.scrollTop = chat.scrollHeight;
  return { turn, msg, meta };
}

function appendBanner(text) {
  const banner = document.createElement('div');
  banner.className = 'state-banner';
  banner.textContent = text;
  chat.appendChild(banner);
  chat.scrollTop = chat.scrollHeight;
}

function tierClass(tier) {
  const normalized = String(tier || 'D').toUpperCase();
  if (normalized === 'A' || normalized === 'B') return `tier-${normalized.toLowerCase()}`;
  if (normalized === 'C') return 'tier-c';
  return 'tier-d';
}

function citationPreview(citation) {
  const source = citation?.source || 'Unknown source';
  const section = citation?.section ? ` · ${citation.section}` : '';
  const run = citation?.chunk_id ? ` (${citation.chunk_id})` : '';
  return `${source}${section}${run}`;
}

function addCitations(container, citations = []) {
  if (!Array.isArray(citations) || citations.length === 0) return;
  const row = document.createElement('div');
  row.className = 'citations';

  citations.forEach((citation, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'citation-chip';
    chip.textContent = `[${idx + 1}]`;
    const tier = document.createElement('span');
    const tierValue = citation?.evidence_tier || 'D';
    tier.className = `tier-badge ${tierClass(tierValue)}`;
    tier.textContent = String(tierValue).toUpperCase();
    chip.appendChild(tier);
    chip.title = citationPreview(citation);

    chip.addEventListener('click', () => {
      const existing = row.querySelector('.chunk-preview');
      if (existing) {
        existing.remove();
        if (existing.dataset.chipIndex === String(idx)) return;
      }
      const preview = document.createElement('div');
      preview.className = 'chunk-preview';
      preview.dataset.chipIndex = String(idx);
      preview.textContent = citationPreview(citation);
      row.appendChild(preview);
    });
    row.appendChild(chip);
  });

  container.appendChild(row);
}

function addToolDisclosure(container, retrievalPlan) {
  if (!retrievalPlan) return;
  const wrap = document.createElement('div');
  wrap.className = 'tool-disclosure';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = `retrieve(scope=${(retrievalPlan.policy_scope || []).join(',') || 'none'})`;
  const pre = document.createElement('pre');
  pre.hidden = true;
  pre.textContent = JSON.stringify(retrievalPlan, null, 2);
  btn.addEventListener('click', () => {
    pre.hidden = !pre.hidden;
  });
  wrap.appendChild(btn);
  wrap.appendChild(pre);
  container.appendChild(wrap);
}

function addFeedbackControls(container, turnId) {
  if (!turnId) return;
  const row = document.createElement('div');
  row.className = 'feedback';
  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = 'Helpful';
  const down = document.createElement('button');
  down.type = 'button';
  down.textContent = 'Not helpful';

  async function submitFeedback(value) {
    if (!widgetToken) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-idempotency-key': makeIdempotencyKey('widget-feedback'),
      };
      if (authBearer) headers.Authorization = `Bearer ${authBearer}`;
      const response = await fetch(`${apiBase}/eigen-widget-feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          widget_token: widgetToken,
          turn_id: turnId,
          value,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      up.classList.toggle('is-active', value === 1);
      down.classList.toggle('is-active', value === -1);
    } catch {
      appendBanner('Feedback could not be saved.');
    }
  }

  up.addEventListener('click', () => submitFeedback(1));
  down.addEventListener('click', () => submitFeedback(-1));
  row.appendChild(up);
  row.appendChild(down);
  container.appendChild(row);
}

function updateModeUI() {
  const label = activeMode === 'eigenx' ? 'EigenX' : 'Public Eigen';
  modeBadge.textContent = label;
  headTitle.textContent = label;
  headSub.textContent = siteId;
  launcher.setAttribute('aria-label', `Open ${activeMode === 'eigenx' ? 'EigenX' : 'Eigen'}`);
}

function resolveConversationIntent() {
  if (intentParam === 'retreat_content' || intentParam === 'event_ops' || intentParam === 'general') return intentParam;
  if (siteId === 'raysretreat') return 'retreat_content';
  if (siteId === 'r2app') return 'event_ops';
  return 'general';
}

function createSseParser(onEvent) {
  let buffer = '';
  return (chunkText) => {
    buffer += chunkText;
    let marker = buffer.indexOf('\n\n');
    while (marker >= 0) {
      const raw = buffer.slice(0, marker);
      buffer = buffer.slice(marker + 2);
      marker = buffer.indexOf('\n\n');
      const lines = raw.split('\n');
      let event = 'message';
      const data = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) {
          data.push(line.slice(line[5] === ' ' ? 6 : 5));
        }
      }
      const body = data.join('\n');
      onEvent(event, body);
    }
  };
}

async function ensureWidgetSession() {
  if (widgetToken) return widgetToken;
  const headers = { 'Content-Type': 'application/json' };
  if (activeMode === 'eigenx' && authBearer) headers.Authorization = `Bearer ${authBearer}`;
  const resp = await fetch(`${apiBase}/eigen-widget-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ site_id: siteId, mode: activeMode }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const payload = await resp.json();
  widgetToken = payload.widget_token;
  return widgetToken;
}

function upgradeToEigenx(bearer) {
  if (activeMode === 'eigenx') return;
  authBearer = bearer;
  activeMode = 'eigenx';
  widgetToken = '';
  updateModeUI();
  makeTurn('assistant', 'Signed in. Session scope now runs in EigenX mode.');
}

function downgradeToPublic() {
  if (activeMode === 'public') return;
  activeMode = 'public';
  authBearer = '';
  widgetToken = '';
  updateModeUI();
  makeTurn('assistant', 'Signed out. Session scope now runs in Public Eigen mode.');
}

async function submitMessage(message) {
  const userTurn = makeTurn('user', message);
  const assistantTurn = makeTurn('assistant', '');
  assistantTurn.turn.classList.add('streaming');
  pendingAssistant = assistantTurn;
  submitBtn.disabled = true;

  try {
    const token = await ensureWidgetSession();
    const response = await fetch(`${apiBase}/eigen-widget-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-idempotency-key': makeIdempotencyKey('widget-chat'),
      },
      body: JSON.stringify({
        widget_token: token,
        message,
        response_format: 'structured',
        conversation_intent: resolveConversationIntent(),
        stream: true,
      }),
    });
    if (!response.ok) throw new Error(await response.text());

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const payload = await response.json();
      assistantTurn.msg.textContent = payload.response || 'No response generated.';
      addToolDisclosure(assistantTurn.turn, payload.retrieval_plan);
      addCitations(assistantTurn.turn, payload.citations);
      addFeedbackControls(assistantTurn.turn, payload.conversation_turn_id);
      if (payload.evidence_notice) appendBanner(payload.evidence_notice);
      return;
    }

    const parser = createSseParser((event, body) => {
      if (event === 'delta') {
        let deltaText = body;
        try {
          const parsed = JSON.parse(body);
          if (parsed && typeof parsed.delta === 'string') {
            deltaText = parsed.delta;
          }
        } catch {
          console.warn('Malformed SSE delta payload', body);
          deltaText = body;
        }
        assistantTurn.msg.textContent += deltaText;
        chat.scrollTop = chat.scrollHeight;
      } else if (event === 'final') {
        let payload = null;
        try {
          payload = JSON.parse(body);
        } catch {
          payload = null;
        }
        if (payload) {
          if (!assistantTurn.msg.textContent.trim()) {
            assistantTurn.msg.textContent = payload.response || 'No response generated.';
          }
          addToolDisclosure(assistantTurn.turn, payload.retrieval_plan);
          addCitations(assistantTurn.turn, payload.citations);
          addFeedbackControls(assistantTurn.turn, payload.conversation_turn_id);
          if (payload.evidence_notice) appendBanner(payload.evidence_notice);
        }
      } else if (event === 'error') {
        let message = body || 'The request failed.';
        try {
          const parsed = JSON.parse(body);
          if (parsed && typeof parsed.message === 'string') {
            message = parsed.message;
          }
        } catch {
          message = body || 'The request failed.';
        }
        appendBanner(message);
      }
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream reader unavailable');
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Request failed';
    if (messageText.toLowerCase().includes('policy scope')) {
      appendBanner('This request exceeds the policy scope available in this session.');
    } else {
      appendBanner(messageText);
    }
  } finally {
    submitBtn.disabled = false;
    if (pendingAssistant) pendingAssistant.turn.classList.remove('streaming');
    pendingAssistant = null;
    userTurn.turn.classList.remove('streaming');
  }
}

if (!apiBase || !siteId) {
  headTitle.textContent = 'Setup required';
  headSub.textContent = 'Missing api_base or site_id';
  appendBanner('Add query params: api_base and site_id.');
  form.remove();
  launcher.remove();
  backdrop.remove();
  throw new Error('Missing widget params');
}

const requiresTrustedParentOrigin = initialMode === 'mixed' || initialMode === 'eigenx';
if (requiresTrustedParentOrigin && !allowedParentOrigin) {
  headTitle.textContent = 'Setup required';
  headSub.textContent = 'Missing parent_origin';
  appendBanner('Mixed and EigenX modes require a valid parent_origin query param.');
  form.remove();
  launcher.remove();
  backdrop.remove();
  throw new Error('Missing or invalid parent_origin for mixed/eigenx mode');
}

launcher.addEventListener('click', () => setOpen(panel.hidden || !panel.classList.contains('open')));
closeBtn.addEventListener('click', () => setOpen(false));
backdrop.addEventListener('click', () => setOpen(false));

window.addEventListener('keydown', (event) => {
  if (isEmbedded) return;
  if (event.key === 'Escape') setOpen(false);
});

window.addEventListener('message', (event) => {
  if (!allowedParentOrigin) return;
  if (event.origin.toLowerCase() !== allowedParentOrigin) return;
  const data = event.data || {};
  if (!data || typeof data !== 'object') return;
  if (data.type === 'eigen_widget_auth' && typeof data.authBearer === 'string') {
    if (data.authBearer) upgradeToEigenx(data.authBearer);
    else downgradeToPublic();
  }
  if (data.type === 'eigen_widget_signout') downgradeToPublic();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  await submitMessage(message);
});

updateModeUI();
if (isEmbedded) document.body.classList.add('embedded');
setOpen(isEmbedded);
makeTurn(
  'assistant',
  'Ask a question. Answers are drawn from the evidence corpus, and citations show the evidence tier for each source.',
);
window.parent?.postMessage?.({ type: 'eigen_widget_ready' }, '*');
