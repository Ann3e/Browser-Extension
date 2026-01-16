// Content script for CSES problem pages
(function(){
  const m = location.pathname.match(/task\/(\d+)/);
  if (!m) return;
  const problemId = m[1];
  const pageTitle = (document.querySelector('h1') && document.querySelector('h1').innerText.trim()) || '';

  function createButton(text, color = '#0366d6') {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.margin = '4px';
    btn.style.padding = '6px 10px';
    btn.style.background = color;
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    return btn;
  }

  function showSyncModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:1px solid #ccc;border-radius:8px;padding:16px;z-index:9999;max-width:500px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
    const title = document.createElement('h3');
    title.textContent = 'Sync Solution to GitHub';
    title.style.margin = '0 0 12px 0';
    modal.appendChild(title);

    const label1 = document.createElement('label');
    label1.textContent = 'Language/Extension (e.g., cpp, py):';
    label1.style.cssText = 'display:block;margin:8px 0 4px;font-weight:bold;';
    const langInput = document.createElement('input');
    langInput.type = 'text';
    langInput.placeholder = 'cpp';
    langInput.style.cssText = 'width:100%;box-sizing:border-box;padding:6px;margin-bottom:12px;';
    modal.appendChild(label1);
    modal.appendChild(langInput);

    const label2 = document.createElement('label');
    label2.textContent = 'Paste URL or code:';
    label2.style.cssText = 'display:block;margin:8px 0 4px;font-weight:bold;';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://cses.fi/paste/...';
    urlInput.style.cssText = 'width:100%;box-sizing:border-box;padding:6px;margin-bottom:12px;';
    modal.appendChild(label2);
    modal.appendChild(urlInput);

    const label3 = document.createElement('label');
    label3.textContent = 'Code:';
    label3.style.cssText = 'display:block;margin:8px 0 4px;font-weight:bold;';
    const codeArea = document.createElement('textarea');
    codeArea.placeholder = 'Paste solution...';
    codeArea.style.cssText = 'width:100%;height:200px;box-sizing:border-box;padding:6px;font-family:monospace;margin-bottom:12px;';
    modal.appendChild(label3);
    modal.appendChild(codeArea);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

    const syncBtn = createButton('Sync', '#2ea44f');
    syncBtn.addEventListener('click', () => {
      const lang = langInput.value.trim() || 'txt';
      const code = codeArea.value.trim();
      const sourceUrl = urlInput.value.trim();
      
      // If URL is provided, fetch it first
      if (sourceUrl && !code) {
        chrome.runtime.sendMessage({action: 'fetchPaste', url: sourceUrl}, resp => {
          if (resp && resp.ok && resp.content) {
            doSync(resp.content);
          } else {
            alert('Failed to fetch: ' + (resp && resp.error ? resp.error : 'unknown'));
          }
        });
        return;
      }
      
      if (!code) { alert('Paste code or URL'); return; }
      doSync(code);
      
      function doSync(finalCode) {
        chrome.runtime.sendMessage({action: 'uploadSubmission', problemId, code: finalCode, lang, sourceUrl, title: pageTitle}, resp => {
          if (resp && resp.ok) { alert('Synced!'); modal.remove(); overlay.remove(); }
          else alert('Failed: ' + (resp && resp.error ? resp.error : 'unknown'));
        });
      }
    });
    btnRow.appendChild(syncBtn);

    const cancelBtn = createButton('Cancel');
    cancelBtn.addEventListener('click', () => { modal.remove(); overlay.remove(); });
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9998;';
    overlay.addEventListener('click', () => { modal.remove(); overlay.remove(); });
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  }

  function injectUI(isSolved) {
    const container = document.createElement('div');
    container.id = 'cses-sync-container';
    container.style.cssText = 'margin:8px 0;';

    const markBtn = createButton(isSolved ? 'Solved ✓' : 'Mark solved', isSolved ? '#2ea44f' : '#0366d6');
    markBtn.addEventListener('click', () => {
      const newState = !markBtn.textContent.includes('Solved');
      markBtn.textContent = newState ? 'Solved ✓' : 'Mark solved';
      markBtn.style.background = newState ? '#2ea44f' : '#0366d6';
      chrome.runtime.sendMessage({action: 'saveStatus', problemId, solved: newState, title: pageTitle, url: location.href}, resp => {});
    });
    container.appendChild(markBtn);

    const syncBtn = createButton('Sync to GitHub', '#6f42c1');
    syncBtn.addEventListener('click', showSyncModal);
    container.appendChild(syncBtn);

    const header = document.querySelector('h1') || document.body.firstElementChild;
    if (header) header.parentNode.insertBefore(container, header.nextSibling);
    else document.body.prepend(container);
  }

  chrome.runtime.sendMessage({action: 'getAll'}, resp => {
    const isSolved = resp && resp.problems && resp.problems[problemId] && resp.problems[problemId].solved;
    injectUI(Boolean(isSolved));
  });
})();
