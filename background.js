async function uploadToGitHub(problems, problemId, submission, repo, basePath, token) {
  if (!repo || !basePath || !token) throw new Error('missing repo/basePath/token');
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) throw new Error('repo must be owner/repo');
  
  const title = (problems[problemId] && problems[problemId].title) || `problem-${problemId}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100);
  const ext = submission.lang || 'txt';
  const fileName = `${problemId}-${slug}.${ext}`;
  const filePath = `${basePath}/${problemId}/${fileName}`;
  
  const content = btoa(unescape(encodeURIComponent(submission.code)));
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`;
  
  const getResp = await fetch(url, {headers: {Authorization: `token ${token}`}});
  let sha = null;
  if (getResp.ok) {
    const json = await getResp.json();
    if (json && json.sha) sha = json.sha;
  }
  
  const putBody = {message: `Add/Update CSES solution ${problemId}`, content};
  if (sha) putBody.sha = sha;
  
  const putResp = await fetch(url, {
    method: 'PUT',
    headers: {Authorization: `token ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(putBody)
  });
  
  if (!putResp.ok) {
    const txt = await putResp.text();
    throw new Error(`GitHub error: ${putResp.status} ${txt}`);
  }
  return await putResp.json();
}

function decodeHtmlEntities(text) {
  const map = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&amp;': '&',
    '&#39;': "'",
    '&apos;': "'"
  };
  let decoded = text;
  for (const [entity, char] of Object.entries(map)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  return decoded;
}

async function fetchPasteContent(url) {
  let fetchUrl = url;
  
  // Handle CSES paste - fetch HTML and extract from pre tag
  if (url.includes('cses.fi/paste/')) {
    const match = url.match(/cses\.fi\/paste\/([a-f0-9]+)/);
    if (match) {
      const pasteId = match[1];
      try {
        const resp = await fetch(`https://cses.fi/paste/${pasteId}`);
        if (resp.ok) {
          const html = await resp.text();
          // Extract code from <pre> tag
          const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
          if (preMatch) {
            return decodeHtmlEntities(preMatch[1].trim());
          }
          throw new Error('Could not find code in paste page');
        }
        throw new Error(`HTTP ${resp.status}`);
      } catch (e) {
        throw new Error(`CSES paste fetch failed: ${e.message}`);
      }
    }
  } 
  // Handle pastebin
  else if (url.includes('pastebin.com/')) {
    const match = url.match(/pastebin\.com\/([a-zA-Z0-9]+)/);
    if (match) fetchUrl = `https://pastebin.com/raw/${match[1]}`;
  } 
  // Handle gist
  else if (url.includes('gist.github.com')) {
    if (!url.endsWith('/raw')) fetchUrl = url.endsWith('/') ? url + 'raw' : url + '/raw';
  }
  
  const resp = await fetch(fetchUrl);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} (URL: ${fetchUrl})`);
  return await resp.text();
}

function getProblems() {
  return new Promise(resolve => {
    chrome.storage.local.get(['problems'], res => resolve(res.problems || {}));
  });
}

function setProblems(obj) {
  return new Promise(resolve => {
    chrome.storage.local.set({problems: obj}, () => resolve(true));
  });
}

async function syncToGitHub(problems, repoFull, path, token) {
  if (!repoFull || !path || !token) throw new Error('missing repo/path/token');
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) throw new Error('repo must be owner/repo');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const payload = {
    updatedAt: new Date().toISOString(),
    problems
  };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));

  // Check if file exists to obtain sha
  const getResp = await fetch(url, {headers: {Authorization: `token ${token}`}});
  let sha = null;
  if (getResp.ok) {
    const json = await getResp.json();
    if (json && json.sha) sha = json.sha;
  }

  const putBody = {message: 'CSES sync update', content};
  if (sha) putBody.sha = sha;

  const putResp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(putBody)
  });

  if (!putResp.ok) {
    const txt = await putResp.text();
    throw new Error(`GitHub error: ${putResp.status} ${txt}`);
  }
  return await putResp.json();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.action === 'fetchPaste') {
        const content = await fetchPasteContent(msg.url);
        sendResponse({ok: true, content});
      } else if (msg.action === 'uploadSubmission') {
        const problems = await getProblems();
        const problem = problems[msg.problemId] || {};
        const submission = {code: msg.code, lang: msg.lang, sourceUrl: msg.sourceUrl, timestamp: new Date().toISOString()};
        problems[msg.problemId] = Object.assign({}, problem, {solved: true, title: msg.title || problem.title || '', lastSubmission: submission, at: new Date().toISOString()});
        await setProblems(problems);
        const cfg = await new Promise(r => chrome.storage.local.get(['csesConfig'], r));
        const config = cfg.csesConfig || {};
        let token = config.token;
        if (!token) return sendResponse({ok: false, error: 'No token configured'});
        const repo = config.repo;
        const basePath = config.basePath || 'solutions';
        const res = await uploadToGitHub(problems, msg.problemId, submission, repo, basePath, token);
        sendResponse({ok: true, result: res});
      } else if (msg.action === 'startOAuth') {
        const clientId = msg.clientId;
        const exchangeUrl = msg.exchangeUrl; // server that exchanges code->token
        if (!clientId) return sendResponse({ok:false, error:'missing clientId'});
        const redirectUri = chrome.identity.getRedirectURL();
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`;
        chrome.identity.launchWebAuthFlow({url: authUrl, interactive: true}, async (redirectedTo) => {
          try {
            if (chrome.runtime.lastError) return sendResponse({ok:false, error: chrome.runtime.lastError.message});
            if (!redirectedTo) return sendResponse({ok:false, error:'no redirect returned'});
            const u = new URL(redirectedTo);
            const code = u.searchParams.get('code');
            if (!code) return sendResponse({ok:false, error:'no code in redirect'});

            if (!exchangeUrl) return sendResponse({ok:false, error:'no exchangeUrl provided; set up a proxy to exchange code for token'});

            const resp = await fetch(exchangeUrl, {
              method: 'POST',
              headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
              body: JSON.stringify({code, redirect_uri: redirectUri, client_id: clientId})
            });
            if (!resp.ok) {
              const txt = await resp.text();
              return sendResponse({ok:false, error:`exchange failed: ${resp.status} ${txt}`});
            }
            const data = await resp.json();
            const token = data.access_token || data.token || data.accessToken;
            if (!token) return sendResponse({ok:false, error:'no access_token in exchange response'});
            // store token in config
            chrome.storage.local.get(['csesConfig'], s => {
              const cfg = s.csesConfig || {};
              cfg.token = token;
              chrome.storage.local.set({csesConfig: cfg}, () => {
                sendResponse({ok:true});
              });
            });
          } catch (err) {
            sendResponse({ok:false, error: err.message});
          }
        });
        return true; // keep message channel open
      } else if (msg.action === 'saveStatus') {
        const problems = await getProblems();
        const existing = problems[msg.problemId] || {};
        problems[msg.problemId] = Object.assign({}, existing, {solved: !!msg.solved, at: new Date().toISOString(), title: msg.title || existing.title || '', url: msg.url || existing.url || ''});
        await setProblems(problems);
        sendResponse({ok: true});
      } else if (msg.action === 'getAll') {
        const problems = await getProblems();
        sendResponse({ok: true, problems});
      } else if (msg.action === 'sync') {
        const problems = await getProblems();
        // prefer token from storage if not provided
        let token = msg.token;
        if (!token) {
          const s = await new Promise(r => chrome.storage.local.get(['csesConfig'], r));
          token = s.csesConfig && s.csesConfig.token;
        }
        const res = await syncToGitHub(problems, msg.repo, msg.path, token);
        sendResponse({ok: true, result: res});
      } else {
        sendResponse({ok: false, error: 'unknown action'});
      }
    } catch (err) {
      sendResponse({ok: false, error: err.message});
    }
  })();
  return true;
});
