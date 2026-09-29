const connection = document.querySelector('#connection');
const status = document.querySelector('#status');
const messages = document.querySelector('#messages');
const clear = document.querySelector('#clear');
const refresh = document.querySelector('#refresh');
let csrfToken = '';
let chatHour = 0;
let currentEntries = [];
let busy = false;

async function request(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function render(entries) {
  currentEntries = entries;
  messages.replaceChildren();
  clear.disabled = busy || entries.length === 0;
  if (!entries.length) {
    status.textContent = 'No messages this hour.';
    return;
  }
  status.textContent = `${entries.length} message${entries.length === 1 ? '' : 's'} this hour.`;
  for (const entry of entries) {
    const row = document.createElement('article');
    const body = document.createElement('div');
    const name = document.createElement('strong');
    const message = document.createElement('p');
    const remove = document.createElement('button');
    name.textContent = entry.name;
    message.textContent = entry.message;
    remove.textContent = 'Remove';
    remove.type = 'button';
    remove.className = 'danger';
    remove.disabled = busy || !entry.messageId;
    remove.setAttribute('aria-label', `Remove message from ${entry.name}`);
    remove.addEventListener('click', () => mutate('/api/delete', { messageId: entry.messageId }));
    body.append(name, message);
    row.append(body, remove);
    messages.append(row);
  }
}

async function load() {
  try {
    const chat = await request('/api/chat');
    chatHour = chat.chatHour;
    render(chat.entries);
  } catch (error) {
    status.textContent = error.message;
  }
}

async function mutate(path, payload) {
  if (busy) return;
  busy = true;
  let failure = '';
  clear.disabled = true;
  for (const button of messages.querySelectorAll('button')) button.disabled = true;
  try {
    const chat = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Session': csrfToken },
      body: JSON.stringify(payload),
    });
    chatHour = chat.chatHour;
    render(chat.entries);
  } catch (error) {
    failure = error.message;
    await load();
  } finally {
    busy = false;
    render(currentEntries);
    if (failure) status.textContent = failure;
  }
}

clear.addEventListener('click', () => {
  if (currentEntries.length && confirm(`Clear all ${currentEntries.length} messages from this hour?`)) {
    mutate('/api/clear', { chatHour });
  }
});
refresh.addEventListener('click', load);

request('/api/session').then(session => {
  csrfToken = session.csrfToken;
  connection.textContent = `Connected to ${session.server}`;
  load();
  setInterval(() => { if (!busy) load(); }, 5000);
}).catch(error => { connection.textContent = error.message; });
