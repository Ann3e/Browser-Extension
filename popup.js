document.addEventListener('DOMContentLoaded', () => {
  const repoInput = document.getElementById('repo');
  const basePathInput = document.getElementById('basePath');
  const tokenInput = document.getElementById('token');
  const storeTokenCheckbox = document.getElementById('storeToken');
  const clientIdInput = document.getElementById('clientId');
  const exchangeUrlInput = document.getElementById('exchangeUrl');
  const saveBtn = document.getElementById('saveConfig');
  const authorizeBtn = document.getElementById('authorize');
  const list = document.getElementById('list');
  const status = document.getElementById('status');

  function showStatus(msg, ok) {
    status.textContent = msg;
    status.style.color = ok ? 'green' : 'red';
  }

  // load saved config and problems
  chrome.storage.local.get(['csesConfig','problems'], res => {
    if (res.csesConfig) {
      repoInput.value = res.csesConfig.repo || '';
      basePathInput.value = res.csesConfig.basePath || 'solutions';
      clientIdInput.value = res.csesConfig.clientId || '';
      exchangeUrlInput.value = res.csesConfig.exchangeUrl || '';
      if (res.csesConfig.token) {
        tokenInput.value = res.csesConfig.token;
        storeTokenCheckbox.checked = true;
      }
    }
    const problems = res.problems || {};
    renderList(problems);
  });

  saveBtn.addEventListener('click', () => {
    const cfg = {repo: repoInput.value.trim(), basePath: basePathInput.value.trim() || 'solutions', clientId: clientIdInput.value.trim(), exchangeUrl: exchangeUrlInput.value.trim()};
    if (storeTokenCheckbox.checked && tokenInput.value.trim()) cfg.token = tokenInput.value.trim();
    chrome.storage.local.set({csesConfig: cfg}, () => showStatus('Config saved', true));
  });

  authorizeBtn.addEventListener('click', () => {
    const clientId = clientIdInput.value.trim();
    const exchangeUrl = exchangeUrlInput.value.trim();
    if (!clientId || !exchangeUrl) return showStatus('Provide clientId and exchangeUrl', false);
    showStatus('Authorizing…', true);
    chrome.runtime.sendMessage({action: 'startOAuth', clientId, exchangeUrl}, resp => {
      if (resp && resp.ok) showStatus('Authorized!', true);
      else showStatus('Failed: ' + (resp && resp.error ? resp.error : 'unknown'), false);
    });
  });

  function renderList(problems) {
    const ids = Object.keys(problems || {});
    if (ids.length === 0) { list.textContent = 'No problems saved'; return; }
    list.innerHTML = '';
    ids.slice(0,200).reverse().forEach(id => {
      const p = problems[id];
      const el = document.createElement('div');
      el.className = 'item';
      const statusIcon = p.solved ? '✓' : '○';
      const lastSub = p.lastSubmission ? ` [${p.lastSubmission.lang}]` : '';
      el.textContent = `${statusIcon} ${id} — ${p.title || 'Unknown'}${lastSub}`;
      list.appendChild(el);
    });
  }

  function renderList(problems) {
    const ids = Object.keys(problems || {});
    if (ids.length === 0) { list.textContent = 'No problems saved'; return; }
    list.innerHTML = '';
    ids.slice(0,200).reverse().forEach(id => {
      const p = problems[id];
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = `${id} — ${p.solved ? 'Solved' : 'Not solved'} ${p.at ? ' @ '+p.at : ''}`;
      list.appendChild(el);
    });
  }
});
