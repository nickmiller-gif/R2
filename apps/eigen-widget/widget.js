/* ============================================================
   R2 · Eigen / EigenX widget runtime
   Matches the R2-Demo.html look: twin dock, morph-to-workspace,
   singleton shell with identity swap. Preserves all backend
   behavior — SSE streaming, auth handshake, feedback, citations,
   idempotency, parent-origin validation.
   ============================================================ */

const params = new URLSearchParams(window.location.search);
const apiBase = (params.get('api_base') || '').replace(/\/+$/, '') || '';
const siteId = params.get('site_id') || '';
const initialMode = params.get('mode') || 'public';
const parentOriginParam = (params.get('parent_origin') || '').replace(/\/+$/, '');
const intentParam = (params.get('conversation_intent') || '').trim();
const embeddedParam = params.get('embedded');
const isEmbedded = embeddedParam === '1' || !!parentOriginParam || window.self !== window.top;

/* ---------- DOM refs ---------- */
const backdrop = document.getElementById('backdrop');
const appDock = document.getElementById('app-dock');
const btnEigen = document.getElementById('btn-eigen');
const btnEigenX = document.getElementById('btn-eigenx');
const workspace = document.getElementById('workspace');
const wsShell = document.getElementById('ws-shell');
const wsLogo = document.getElementById('ws-logo');
const wsTitleName = document.getElementById('ws-title-name');
const wsTitleSub = document.getElementById('ws-title-sub');
const wsMode = document.getElementById('ws-mode');
const wsClose = document.getElementById('ws-close');
const wsBody = document.getElementById('ws-body');
const wsForm = document.getElementById('ws-form');
const wsInput = document.getElementById('ws-input');
const wsSubmit = document.getElementById('ws-submit');

/* ---------- State ---------- */
let activeApp = null; // 'eigen' | 'eigenx' | null
let activeMode = initialMode === 'eigenx' ? 'eigenx' : 'public';
let widgetToken = '';
let authBearer = '';
let allowedParentOrigin = '';
let pendingAssistant = null;
let morphRaf = 0;

if (parentOriginParam) {
  try {
    allowedParentOrigin = new URL(parentOriginParam).origin.toLowerCase();
  } catch {
    allowedParentOrigin = '';
  }
}

/* ---------- Utilities ---------- */
function timestampNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeIdempotencyKey(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/* ---------- Identity swap ---------- */
const EIGEN_IDENTITY = {
  app: 'eigen',
  name: 'Eigen',
  sub: 'public commons',
  modeLabel: 'Public',
  modeClass: 'active-public',
  symbolId: '#eigen-mark',
  placeholder: 'Ask the commons…',
  intro:
    'Ask a question. Answers draw from public evidence in the R2 commons. Citations show the evidence tier for each source.',
};
const EIGENX_IDENTITY = {
  app: 'eigenx',
  name: 'EigenX',
  sub: 'operator console',
  modeLabel: 'EigenX',
  modeClass: 'active-eigenx',
  symbolId: '#eigenx-mark',
  placeholder: 'Run an operator query…',
  intro:
    'EigenX runs in authenticated scope. Retrieval follows your policy scope; results cite the evidence tier for each source.',
};

function identityFor(app) {
  return app === 'eigenx' ? EIGENX_IDENTITY : EIGEN_IDENTITY;
}

function setAppIdentity(app) {
  const id = identityFor(app);
  activeApp = id.app;
  activeMode = id.app === 'eigenx' ? 'eigenx' : 'public';

  // Title / sub / mode badge
  if (wsTitleName) wsTitleName.textContent = id.name;
  if (wsTitleSub) wsTitleSub.textContent = siteId ? `${siteId} · ${id.sub}` : id.sub;
  if (wsMode) {
    wsMode.textContent = id.modeLabel;
    wsMode.classList.remove('active-public', 'active-eigenx');
    wsMode.classList.add(id.modeClass);
  }

  // Logo swap — rebuild inline SVG so the <use href> refreshes reliably
  if (wsLogo) {
    wsLogo.innerHTML = `<svg viewBox="0 0 200 200" width="36" height="36" aria-hidden="true"><use href="${id.symbolId}"/></svg>`;
  }

  // Composer placeholder
  if (wsInput) wsInput.placeholder = id.placeholder;

  // Body mode class (drives amber accents in EigenX)
  document.body.classList.toggle('mode-eigenx', id.app === 'eigenx');
  document.body.classList.toggle('mode-eigen', id.app === 'eigen');

  // Dock focus rings
  if (btnEigen) btnEigen.classList.toggle('is-active', id.app === 'eigen');
  if (btnEigenX) btnEigenX.classList.toggle('is-active', id.app === 'eigenx');
}

/* ---------- Morph open/close ---------- */
function writeMorphOrigin(rect) {
  if (!wsShell || !rect) return;
  wsShell.style.setProperty('--from-x', `${rect.left}px`);
  wsShell.style.setProperty('--from-y', `${rect.top}px`);
  wsShell.style.setProperty('--from-w', `${rect.width}px`);
  wsShell.style.setProperty('--from-h', `${rect.height}px`);
}

function cancelMorphRaf() {
  if (morphRaf) {
    cancelAnimationFrame(morphRaf);
    morphRaf = 0;
  }
}

function openApp(app, options = {}) {
  const { silent = false, origin = null } = options;
  setAppIdentity(app);

  if (isEmbedded) {
    // Embedded mode: no morph, workspace already fills the iframe via CSS
    workspace?.setAttribute('aria-hidden', 'false');
    workspace?.classList.add('open');
    backdrop?.classList.remove('open');
    appDock?.classList.add('is-hidden');
    btnEigen?.setAttribute('aria-expanded', 'true');
    btnEigenX?.setAttribute('aria-expanded', 'true');
    wsInput?.focus();
    return;
  }

  // Dim the originating button so it visually “lifts” into the shell
  const sourceBtn = app === 'eigenx' ? btnEigenX : btnEigen;
  const otherBtn = app === 'eigenx' ? btnEigen : btnEigenX;
  sourceBtn?.classList.add('is-opening');
  otherBtn?.classList.remove('is-opening');

  // Seed morph origin at the button rect
  const rect = origin ||
    sourceBtn?.getBoundingClientRect() || {
      left: window.innerWidth - 88,
      top: window.innerHeight - 88,
      width: 64,
      height: 64,
    };
  writeMorphOrigin(rect);

  // Make the shell visible at origin before transitioning to target
  workspace?.setAttribute('aria-hidden', 'false');
  backdrop?.classList.add('open');

  // Force reflow so the browser registers the start state before we add .open
  // (this makes the transition go from seeded vars → CSS target values)
  cancelMorphRaf();
  // eslint-disable-next-line no-unused-expressions
  wsShell?.offsetWidth;
  morphRaf = requestAnimationFrame(() => {
    workspace?.classList.add('open');
    if (!silent) setTimeout(() => wsInput?.focus({ preventScroll: true }), 120);
  });

  btnEigen?.setAttribute('aria-expanded', app === 'eigen' ? 'true' : 'false');
  btnEigenX?.setAttribute('aria-expanded', app === 'eigenx' ? 'true' : 'false');
}

function closeApp() {
  if (isEmbedded) return; // workspace is always shown in embedded mode

  // Rewrite origin to the button that owns the current app so the morph reverses
  const sourceBtn = activeApp === 'eigenx' ? btnEigenX : btnEigen;
  if (sourceBtn) writeMorphOrigin(sourceBtn.getBoundingClientRect());

  workspace?.classList.remove('open');
  backdrop?.classList.remove('open');
  workspace?.setAttribute('aria-hidden', 'true');
  btnEigen?.setAttribute('aria-expanded', 'false');
  btnEigenX?.setAttribute('aria-expanded', 'false');

  // Restore dock buttons after the morph closes
  setTimeout(() => {
    btnEigen?.classList.remove('is-opening');
    btnEigenX?.classList.remove('is-opening');
  }, 480);
}

/* ---------- Chat primitives ---------- */
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

  wsBody.appendChild(turn);
  wsBody.scrollTop = wsBody.scrollHeight;
  return { turn, msg, meta };
}

function appendBanner(text) {
  const banner = document.createElement('div');
  banner.className = 'state-banner';
  banner.textContent = text;
  wsBody.appendChild(banner);
  wsBody.scrollTop = wsBody.scrollHeight;
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
      if (!response.ok) throw new Error(await response.text());
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

function resolveConversationIntent() {
  if (intentParam === 'retreat_content' || intentParam === 'event_ops' || intentParam === 'general')
    return intentParam;
  if (siteId === 'raysretreat') return 'retreat_content';
  if (siteId === 'r2app') return 'event_ops';
  return 'general';
}

function createSseParser(onEvent) {
  let buffer = '';
  const dispatch = (raw) => {
    const lines = raw.split('\n');
    let event = 'message';
    const data = [];
    for (const line of lines) {
      if (line.startsWith(':')) continue; // comment/heartbeat line
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) {
        data.push(line.slice(line[5] === ' ' ? 6 : 5));
      }
    }
    const body = data.join('\n');
    onEvent(event, body);
  };
  const feed = (chunkText) => {
    buffer += chunkText;
    let marker = buffer.indexOf('\n\n');
    while (marker >= 0) {
      const raw = buffer.slice(0, marker);
      buffer = buffer.slice(marker + 2);
      marker = buffer.indexOf('\n\n');
      dispatch(raw);
    }
  };
  // Flush any remaining buffered event that didn't end in the spec
  // terminator before EOF — Supabase closes the stream immediately after
  // the final event, and some intermediaries can swallow the trailing
  // blank line. Without this, the `final` payload can silently drop.
  feed.flush = () => {
    const raw = buffer.trim();
    buffer = '';
    if (raw) dispatch(raw);
  };
  return feed;
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
  authBearer = bearer;
  widgetToken = '';
  setAppIdentity('eigenx');
  makeTurn('system', 'Signed in. Running in EigenX (authenticated) scope.');
}

function downgradeToPublic() {
  authBearer = '';
  widgetToken = '';
  setAppIdentity('eigen');
  makeTurn('system', 'Signed out. Running in public Eigen scope.');
}

async function submitMessage(message) {
  const userTurn = makeTurn('user', message);
  const assistantTurn = makeTurn('assistant', '');
  assistantTurn.turn.classList.add('streaming');
  pendingAssistant = assistantTurn;
  wsSubmit.disabled = true;

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
          deltaText = body;
        }
        assistantTurn.msg.textContent += deltaText;
        wsBody.scrollTop = wsBody.scrollHeight;
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
        }
      } else if (event === 'error') {
        let messageText = body || 'The request failed.';
        try {
          const parsed = JSON.parse(body);
          if (parsed && typeof parsed.message === 'string') messageText = parsed.message;
        } catch {
          messageText = body || 'The request failed.';
        }
        appendBanner(messageText);
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
    // Decode any trailing bytes the streaming decoder was holding onto,
    // then flush whatever's left in the parser buffer. Catches cases
    // where the server closes immediately after `final` without a
    // trailing blank line.
    parser(decoder.decode());
    parser.flush?.();
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Request failed';
    if (messageText.toLowerCase().includes('policy scope')) {
      appendBanner('This request exceeds the policy scope available in this session.');
    } else {
      appendBanner(messageText);
    }
  } finally {
    wsSubmit.disabled = false;
    if (pendingAssistant) pendingAssistant.turn.classList.remove('streaming');
    pendingAssistant = null;
    userTurn.turn.classList.remove('streaming');
  }
}

/* ---------- Setup guard ---------- */
if (!apiBase || !siteId) {
  document.body.classList.add('setup-error');
  if (wsTitleName) wsTitleName.textContent = 'Setup required';
  if (wsTitleSub) wsTitleSub.textContent = 'Missing api_base or site_id';
  appendBanner('Add query params: api_base and site_id.');
  wsForm?.remove();
  appDock?.remove();
  backdrop?.remove();
  // Keep the workspace visible at centered size via .setup-error CSS
  workspace?.classList.add('open');
  throw new Error('Missing widget params');
}

const requiresTrustedParentOrigin = initialMode === 'mixed' || initialMode === 'eigenx';
if (requiresTrustedParentOrigin && !allowedParentOrigin) {
  document.body.classList.add('setup-error');
  if (wsTitleName) wsTitleName.textContent = 'Setup required';
  if (wsTitleSub) wsTitleSub.textContent = 'Missing parent_origin';
  appendBanner('Mixed and EigenX modes require a valid parent_origin query param.');
  wsForm?.remove();
  appDock?.remove();
  backdrop?.remove();
  workspace?.classList.add('open');
  throw new Error('Missing or invalid parent_origin for mixed/eigenx mode');
}

/* ---------- Dock wiring ---------- */
btnEigen?.addEventListener('click', () => {
  if (activeApp === 'eigen' && workspace?.classList.contains('open')) {
    closeApp();
    return;
  }
  openApp('eigen');
});

btnEigenX?.addEventListener('click', () => {
  // If we already have an auth bearer, run authed scope.
  // Otherwise, ask the parent for auth (if embedded with trusted parent),
  // and also open the workspace optimistically in public scope until auth arrives.
  if (authBearer) {
    if (activeApp === 'eigenx' && workspace?.classList.contains('open')) {
      closeApp();
      return;
    }
    activeMode = 'eigenx';
    openApp('eigenx');
    return;
  }
  // No auth yet. Request it from a trusted parent if present.
  if (allowedParentOrigin) {
    try {
      window.parent?.postMessage?.(
        { type: 'eigen_widget_request_auth', scope: 'eigenx' },
        allowedParentOrigin,
      );
    } catch {
      /* ignore */
    }
  }
  openApp('eigenx');
  makeTurn(
    'system',
    'EigenX requires an authenticated session. Running in preview scope until sign-in.',
  );
});

wsClose?.addEventListener('click', () => closeApp());
backdrop?.addEventListener('click', () => closeApp());

window.addEventListener('keydown', (event) => {
  if (isEmbedded) return;
  if (event.key === 'Escape' && workspace?.classList.contains('open')) closeApp();
});

window.addEventListener('resize', () => {
  if (!workspace?.classList.contains('open')) {
    const sourceBtn = activeApp === 'eigenx' ? btnEigenX : btnEigen;
    if (sourceBtn) writeMorphOrigin(sourceBtn.getBoundingClientRect());
  }
});

/* ---------- Parent postMessage ---------- */
window.addEventListener('message', (event) => {
  if (!allowedParentOrigin) return;
  if (event.origin.toLowerCase() !== allowedParentOrigin) return;
  const data = event.data || {};
  if (!data || typeof data !== 'object') return;
  if (data.type === 'eigen_widget_theme' && typeof data.theme === 'string') {
    const theme = data.theme;
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('r2-widget-theme', theme);
      } catch {
        /* ignore */
      }
    } else if (theme === 'system') {
      try {
        localStorage.removeItem('r2-widget-theme');
      } catch {
        /* ignore */
      }
      const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
    return;
  }
  if (data.type === 'eigen_widget_auth' && typeof data.authBearer === 'string') {
    if (data.authBearer) upgradeToEigenx(data.authBearer);
    else downgradeToPublic();
  }
  if (data.type === 'eigen_widget_signout') downgradeToPublic();
  // Context passthrough — host apps may update operator context.
  if (data.type === 'eigen_widget_context' && data.context && typeof data.context === 'object') {
    try {
      const ctx = data.context;
      if (ctx.module_scope && wsTitleSub) {
        wsTitleSub.textContent = `${ctx.module_scope}`;
      }
    } catch {
      /* ignore */
    }
  }
});

/* ---------- Composer ---------- */
wsInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    wsForm?.requestSubmit();
  }
});

wsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = wsInput.value.trim();
  if (!message) return;
  wsInput.value = '';
  await submitMessage(message);
});

/* ---------- Boot ---------- */
if (isEmbedded) document.body.classList.add('embedded');

// Pick an initial identity that matches the requested mode
const bootApp = initialMode === 'eigenx' ? 'eigenx' : 'eigen';
setAppIdentity(bootApp);

// Seed a morph origin even before a click, so keyboard/programmatic opens animate
const bootBtn = bootApp === 'eigenx' ? btnEigenX : btnEigen;
if (bootBtn) writeMorphOrigin(bootBtn.getBoundingClientRect());

if (isEmbedded) {
  openApp(bootApp, { silent: true });
}

makeTurn('assistant', identityFor(bootApp).intro);

try {
  // Only broadcast ready to the validated parent origin. If we don't have
  // a confirmed parent_origin (embedded mode without handshake, or
  // standalone/top-level load), skip the post entirely — a wildcard here
  // would leak the widget's embed state to any frame that opens us in an
  // iframe, including an attacker who wraps the CDN URL in their own page.
  if (isEmbedded && allowedParentOrigin) {
    window.parent?.postMessage?.({ type: 'eigen_widget_ready' }, allowedParentOrigin);
  }
} catch {
  /* ignore */
}
