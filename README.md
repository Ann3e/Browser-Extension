# CSES → GitHub Sync (Chrome Extension)

Sync your CSES problem solutions to GitHub. For each problem you solve, the extension creates a folder with your submission code.

Quick start

1. Open `chrome://extensions`, enable Developer mode, click "Load unpacked" and select this folder.
2. Visit a CSES problem page (https://cses.fi/problemset/task/<id>/).
3. Click **Mark solved** to track progress.
4. Click **Sync to GitHub** to:
   - Paste your solution code or import from a shared paste URL (cses.fi/paste/..., pastebin.com, gist.github.com).
   - Choose the language/extension (cpp, py, java, etc.).
   - Sync to your repo under `solutions/<problemId>/<id>-<title>.<ext>`.

Setup

- **GitHub repo:** Configure `owner/repo` in the popup (e.g. `ann3e/solutions`).
- **Base path:** Directory in your repo where problem folders are stored (default: `solutions`).
- **Token:** Use a Personal Access Token (PAT) with `repo` scope for quick testing. Paste into the popup and check `Store token`.
  - Create a PAT: GitHub Settings → Developer settings → Personal access tokens → Generate new token (classic).
- **OAuth (optional):** For better security, use OAuth + an exchange server. Register a GitHub OAuth App and set the callback URL to your extension's redirect URL (shown in `chrome.identity.getRedirectURL()`).

File structure on GitHub

After syncing, your repo will have:

```
solutions/
├── 1/
│   └── 1-weird-algorithm.cpp
├── 2/
│   └── 2-missing-number.py
└── 3/
    └── 3-repetitions.java
```

Security notes

- PAT is stored in `chrome.storage.local` (not committed to git). Never commit tokens.
- OAuth is more secure: the extension never sees your `client_secret`, which stays on the exchange server.
- Use `.gitignore` to exclude any config files with secrets.

Optional: OAuth exchange server

If you want to use OAuth, you need an exchange server that holds your `client_secret` and exchanges the authorization `code` for an `access_token`. See `server/` folder for a minimal Node/Express example.

Troubleshooting

- **"No token configured":** Set a PAT in the popup and check `Store token`, or use OAuth + exchange URL.
- **"GitHub error: 401/403":** Verify your token has `repo` scope and permission to write to the repo.
- **Sync fails:** Check browser console for errors and ensure your repo, base path, and token are correct.

