const params = new URLSearchParams(window.location.search);
const apiBase = (params.get('api_base') || '').replace(/\/+$/, '') || '';
const siteId = params.get('site_id') || '';
const mode = params.get('mode') === 'eigenx' ? 'eigenx' : 'public';
const theme = params.get('theme') || 'light';
const parentOriginParam = (params.get('parent_origin') || '').replace(/\/+$/, '');

const head = document.getElementById('head');
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');

if (!apiBase || !siteId) {
  head.textContent = 'Eigen widget misconfigured';
  chat.innerHTML = '<div class="msg bot">Missing api_base or site_id query params.</div>';
  form.remove();
  throw new Error('Missing widget params');
}

if (theme === 'dark') {
  document.body.style.background = '#0f172a';
  chat.style.background = '#111827';
  head.style.color = '#cbd5e1';
}

head.textContent = mode === 'public' ? `Public Eigen • ${siteId}` : `EigenX • ${siteId}`;

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
    const meta = `Citations: ${Array.isArray(payload.citations) ? payload.citations.length : 0}`;
    append(payload.response || 'No response', 'bot', meta);
  } catch (err) {
    append(err instanceof Error ? err.message : 'Request failed', 'bot');
  }
});

append(
  mode === 'public'
    ? 'Public Eigen is ready.'
    : 'EigenX widget is ready. Parent page should postMessage auth token if needed.',
  'bot',
);
