# Hearthwillow chat admin

This private console manages the shared village chat for the current UTC hour. You can remove one message or clear all messages in that hour. The changes are saved by the live Worker and sent to open visitor chats. The console runs on your computer; it is not a page on the public site.

## Start the live console

On the Mac that has the admin secret, open Terminal in the `cosy-v1` repository root and run:

```bash
python3 tools/village-admin/server.py
```

Open [http://127.0.0.1:3052/](http://127.0.0.1:3052/) in a browser. Keep that Terminal window open while using the console. Press Ctrl+C there to stop it. If it is already running, just open the address; there is no need to start a second copy. Python 3 is the only runtime needed for this console. You do not need to start Next.js or Wrangler to manage the live chat.

The launcher reads `~/.config/cosy-village/chat-admin-token` if that private file exists and is readable only by your account (mode `0600`). Otherwise it prompts for the secret in Terminal. Do not put the secret in the command, a URL, Git, or browser storage. The local server sends it to the Worker over HTTPS; the browser never receives it. The default connection is the production village Worker.

## Use the controls

- **Refresh** reloads the current hour's messages; the page also refreshes every five seconds.
- **Remove** deletes that message from the shared chat immediately.
- **Clear all messages** asks for confirmation, then empties the current hour. If the hour changed since the page loaded, the Worker rejects the request; refresh and try again.

The chat also clears automatically at each UTC-hour boundary. Clear all has been verified to clear an already-open production tab. A visitor tab opened before the updated client was published may still need a reload to see an individual message removal. These actions do not touch personal notes or preferences.

## If the page cannot connect

- **Address already in use:** the console may already be running. Open `http://127.0.0.1:3052/`, or stop the existing process before starting another. You can choose another local port with `python3 tools/village-admin/server.py --port 3053` and then open `http://127.0.0.1:3053/`.
- **Secret file permissions:** keep `~/.config/cosy-village/chat-admin-token` readable only by your account (`chmod 600 ~/.config/cosy-village/chat-admin-token`).
- **The server rejected the admin secret:** the local secret does not match the Worker's current `VILLAGE_ADMIN_TOKEN` secret. Obtain the current secret through a private channel; do not paste it into an issue or commit.
- **Could not reach the village server:** check your network connection and the Worker. The public village site does not need to be open for the console to work.

For an isolated local Worker test, start Wrangler separately and pass `--worker-url http://127.0.0.1:2567` to the launcher. That Worker needs its own matching `VILLAGE_ADMIN_TOKEN` in local secret configuration. The normal command above always targets production.

## Access boundary

The Python server binds only to `127.0.0.1`, checks the browser's Host, Origin and local session token on changes, and has no public Next.js route. The Worker checks the admin secret for every admin request. The local token file must remain private; deleting it removes this Mac's saved access. See [the implementation and release record](../../VILLAGE_BUILD.md#2026-09-29-local-chat-admin).
