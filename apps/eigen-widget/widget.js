const params = new URLSearchParams(window.location.search);
const apiBase = (params.get('api_base') || '').replace(/\/+$/, '') || '';
const siteId = params.get('site_id') || '';
const mode = params.get('mode') === 'eigenx' ? 'eigenx' : 'public';
const theme = params.get('theme') || 'light';
const parentOriginParam = (params.get('parent_origin') || '').replace(/\/+$/, '');

const backdrop = document.getElementById('backdrop');
const launcher = document.getElementById('launcher');
const panel = document.getElementById('panel');
const headTitle = document.getElementById('head-title');
const headSub = document.getElementById('head-sub');
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');

if (theme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

function setOpen(open) {
  panel.hidden = !open;
  panel.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
  launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
  if (open) {
    input.focus();
  }
}

launcher.addEventListener('click', () => {
  setOpen(panel.hidden || !panel.classList.contains('open'));
});

backdrop.addEventListener('click', () => setOpen(false));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpen(false);
});

if (!apiBase || !siteId) {
  headTitle.textContent = 'Setup required';
  headSub.textContent = 'Missing api_base or site_id';
  chat.innerHTML = '<div class="msg bot">Add query params: api_base, site_id</div>';
  form.remove();
  launcher.remove();
  backdrop.remove();
  throw new Error('Missing widget params');
}

headTitle.textContent = mode === 'public' ? 'Public Eigen' : 'EigenX';
headSub.textContent = siteId;

let widgetToken = '';
let authBearer = '';
const allowedParentOrigin = parentOriginParam.toLowerCase();

window.addEventListener('message', (event) => {
  if (allowedParentOrigin && event.origin.toLowerCase() !== allowedParentOrigin) {
    return;
  }
  const data = event.data || {};
  if (data && data.type === 'eigen_widget_auth' && typeof data.authBearer === 'string') {
    authBearer = data.authBearer;
  }
});

function append(text, role, meta = '') {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  if (meta) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = meta;
    div.appendChild(m);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function ensureWidgetSession() {
  if (widgetToken) return widgetToken;
  const headers = { 'Content-Type': 'application/json' };
  if (mode === 'eigenx' && authBearer) {
    headers.Authorization = `Bearer ${authBearer}`;
  }
  const resp = await fetch(`${apiBase}/eigen-widget-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ site_id: siteId, mode }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const payload = await resp.json();
  widgetToken = payload.widget_token;
  return widgetToken;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  append(message, 'user');
  input.value = '';
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const token = await ensureWidgetSession();
    const response = await fetch(`${apiBase}/eigen-widget-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widget_token: token,
        message,
        response_format: 'structured',
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const n = Array.isArray(payload.citations) ? payload.citations.length : 0;
    const meta = n ? `${n} source${n === 1 ? '' : 's'}` : 'No citations';
    append(payload.response || 'No response', 'bot', meta);
  } catch (err) {
    append(err instanceof Error ? err.message : 'Request failed', 'bot');
  } finally {
    submitBtn.disabled = false;
  }
});

append(
  mode === 'public'
    ? 'Ask me about Rays Retreat or R2 — answers use your public corpus when it’s indexed.'
    : 'EigenX is ready. Your site can postMessage an auth token if this session needs sign-in.',
  'bot',
);
