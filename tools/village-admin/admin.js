const connection = document.querySelector('#connection');
const capture = document.querySelector('#capture');
const status = document.querySelector('#status');
const messages = document.querySelector('#messages');
const clear = document.querySelector('#clear');
const refresh = document.querySelector('#refresh');
const players = document.querySelector('#players');
const playersStatus = document.querySelector('#players-status');
const playersRefresh = document.querySelector('#players-refresh');
const archiveCount = document.querySelector('#archive-count');
const archiveSearch = document.querySelector('#archive-search');
const archiveDay = document.querySelector('#archive-day');
const archiveStatus = document.querySelector('#archive-status');
const archiveResults = document.querySelector('#archive-results');
const archiveMore = document.querySelector('#archive-more');
let csrfToken = '';
let chatHour = 0;
let currentEntries = [];
let busy = false;
let playersBusy = false;
let currentPlayers = [];
let playersKey = '';
let playersRequestId = 0;
let archiveShown = 0;
let archiveLastDay = '';
let archiveRequestId = 0;
let archiveBusy = false;
let archiveQueued = null;
let searchTimer;

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
    row.className = 'live-message';
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

async function loadLive() {
  try {
    const chat = await request('/api/chat');
    chatHour = chat.chatHour;
    render(chat.entries);
  } catch (error) {
    status.textContent = error.message;
  }
}

function renderPlayers(online) {
  currentPlayers = online;
  playersRefresh.disabled = playersBusy;
  const nextKey = JSON.stringify([online, playersBusy]);
  if (nextKey === playersKey) return;
  playersKey = nextKey;
  const focusedId = players.querySelector('button:focus')?.dataset.playerId;
  players.replaceChildren();
  for (const player of online) {
    const row = document.createElement('article');
    row.className = 'player-row';
    const name = document.createElement('strong');
    name.textContent = player.name;
    const identity = document.createElement('div');
    identity.append(name);
    if (!player.canKick) {
      const note = document.createElement('p');
      note.textContent = 'Reconnect needed for IP kick';
      identity.append(note);
    }
    const kick = document.createElement('button');
    kick.type = 'button';
    kick.className = 'danger';
    kick.textContent = 'Kick for 5 minutes';
    kick.dataset.playerId = player.id;
    kick.disabled = playersBusy || !player.canKick;
    kick.setAttribute('aria-label', `Kick ${player.name} for 5 minutes`);
    if (!player.canKick) kick.title = 'This player needs to reconnect before an IP kick is available.';
    kick.addEventListener('click', () => kickPlayer(player));
    row.append(identity, kick);
    players.append(row);
  }
  if (focusedId) {
    const target = [...players.querySelectorAll('button')].find(button => button.dataset.playerId === focusedId && !button.disabled);
    (target || playersRefresh).focus();
  }
}

async function loadPlayers() {
  const requestId = ++playersRequestId;
  try {
    const data = await request('/api/players');
    if (requestId !== playersRequestId) return;
    renderPlayers(data.players);
    playersStatus.textContent = data.players.length
      ? `${data.players.length} player${data.players.length === 1 ? '' : 's'} online.`
      : 'No players online.';
  } catch (error) {
    if (requestId !== playersRequestId) return;
    renderPlayers([]);
    playersStatus.textContent = error.message;
  }
}

async function kickPlayer(player) {
  if (playersBusy) return;
  ++playersRequestId;
  playersBusy = true;
  renderPlayers(currentPlayers);
  playersStatus.textContent = `Kicking ${player.name}…`;
  try {
    const data = await request('/api/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Session': csrfToken },
      body: JSON.stringify({ playerId: player.id }),
    });
    renderPlayers(data.players);
    playersStatus.textContent = `${player.name} kicked for five minutes.${data.kickedCount > 1 ? ` ${data.kickedCount} players using that IP were disconnected.` : ''}`;
  } catch (error) {
    await loadPlayers();
    playersStatus.textContent = error.message;
  } finally {
    playersBusy = false;
    renderPlayers(currentPlayers);
    playersRefresh.focus();
  }
}

function updateArchiveMeta(data) {
  archiveCount.textContent = `${data.totalArchived} saved`;
  capture.classList.toggle('problem', Boolean(data.captureError));
  if (data.captureError) {
    capture.textContent = `Archive paused · ${data.captureError}`;
  } else if (data.lastCaptureAt) {
    const checked = new Date(data.lastCaptureAt * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    capture.textContent = `Saving on this Mac · checked ${checked}`;
  } else {
    capture.textContent = 'Waiting for the first chat capture…';
  }
  const selected = archiveDay.value;
  archiveDay.replaceChildren(new Option('All days', ''));
  for (const item of data.days) {
    const date = new Date(`${item.day}T12:00:00`);
    const label = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    archiveDay.add(new Option(`${label} · ${item.count}`, item.day));
  }
  if (selected && !data.days.some(item => item.day === selected)) {
    archiveDay.add(new Option(selected, selected));
  }
  archiveDay.value = selected;
}

function addArchivedMessages(entries) {
  for (const entry of entries) {
    const date = new Date(entry.firstSeenAt * 1000);
    const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    if (day !== archiveLastDay) {
      const heading = document.createElement('h3');
      heading.className = 'archive-day';
      heading.textContent = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      archiveResults.append(heading);
      archiveLastDay = day;
    }
    const row = document.createElement('article');
    row.className = 'archive-entry';
    const time = document.createElement('time');
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const content = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const message = document.createElement('p');
    message.textContent = entry.message;
    content.append(name, message);
    row.append(time, content);
    archiveResults.append(row);
  }
}

async function loadArchive(reset = true, metaOnly = false) {
  if (archiveBusy) {
    if (!metaOnly || !archiveQueued) archiveQueued = { reset, metaOnly };
    return;
  }
  archiveBusy = true;
  const requestId = ++archiveRequestId;
  archiveMore.disabled = true;
  const params = new URLSearchParams({
    q: archiveSearch.value.trim(),
    day: archiveDay.value,
    offset: String(reset || metaOnly ? 0 : archiveShown),
  });
  try {
    const data = await request(`/api/archive?${params}`);
    if (requestId !== archiveRequestId) return;
    updateArchiveMeta(data);
    if (!metaOnly) {
      const scrollTop = archiveResults.scrollTop;
      if (reset) {
        archiveResults.replaceChildren();
        archiveShown = 0;
        archiveLastDay = '';
      }
      addArchivedMessages(data.items);
      archiveShown += data.items.length;
      if (reset) archiveResults.scrollTop = scrollTop;
      archiveStatus.textContent = data.total
        ? `Showing ${archiveShown} of ${data.total} saved messages.`
        : data.totalArchived ? 'No messages match these filters.' : 'Nothing captured yet. New messages will appear here while this local server runs.';
      archiveMore.hidden = archiveShown >= data.total;
    }
  } catch (error) {
    archiveStatus.textContent = error.message;
  } finally {
    archiveBusy = false;
    archiveMore.disabled = false;
    if (archiveQueued) {
      const next = archiveQueued;
      archiveQueued = null;
      loadArchive(next.reset, next.metaOnly);
    }
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
    await loadArchive(true);
  } catch (error) {
    failure = error.message;
    await loadLive();
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
refresh.addEventListener('click', () => { loadLive(); loadArchive(true); });
playersRefresh.addEventListener('click', () => { if (!playersBusy) loadPlayers(); });
archiveSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadArchive(true), 240);
});
archiveDay.addEventListener('change', () => loadArchive(true));
archiveMore.addEventListener('click', () => loadArchive(false));

request('/api/session').then(session => {
  csrfToken = session.csrfToken;
  connection.textContent = `Connected to ${session.server}`;
  loadLive();
  loadPlayers();
  loadArchive();
  setInterval(() => {
    if (!busy) loadLive();
    if (!playersBusy) loadPlayers();
    loadArchive(archiveShown <= 80, archiveShown > 80);
  }, 5000);
}).catch(error => { connection.textContent = error.message; });
