# Hearthwillow village admin

This private console lists connected players, manages the shared village chat for the current UTC hour and keeps a searchable local archive for seven days. You can kick a player for five minutes, remove one live message or clear the current hour. The console runs on your computer; it is not a page on the public site. The matching Worker and village client are published, and the player controls are verified against production. The local console was restarted after this release with its archive preserved.

## Start the live console

On the Mac that has the admin secret, open Terminal in the `cosy-v1` repository root and run:

```bash
python3 tools/village-admin/server.py
```

Open [http://127.0.0.1:3052/](http://127.0.0.1:3052/) in a browser. Keep that Terminal window open while using the console and capturing chat; the browser page can be closed. Press Ctrl+C in Terminal to stop capture and the page. If it is already running, just open the address. Python 3 is the only runtime needed; Next.js and Wrangler are not required for the live console.

The launcher reads `~/.config/cosy-village/chat-admin-token` if that private file exists and is readable only by your account (mode `0600`). Otherwise it prompts for the secret in Terminal. Do not put the secret in the command, a URL, Git, or browser storage. The local server sends it to the Worker over HTTPS; the browser never receives it. The default connection is the production village Worker.

## Use the controls

- **Players online** lists currently connected visitors by their village names and refreshes every five seconds. Its **Refresh** button reloads the list immediately.
- **Kick for 5 minutes** immediately disconnects that player and every other session using the same public IP. The Worker refuses re-entry from that IP for exactly five minutes, including a new tab, reload or Worker restart. Trying again does not extend the cooldown. A stale player row reports that the player has left rather than kicking someone else.
- Kicked visitors see **“You've been kicked from this village. Log back in later!”** on the same forest-green full-screen background used when preparing a new sky. The village scene, audio and reconnect timers stop. After the five minutes, visitors can reload and enter again; the screen does not automatically rejoin.
- Visitors connected before the kick-capable Worker update need to reconnect before their **Kick** button becomes available. The console shows a reconnect note for those sessions. A shared home, office or VPN IP means everyone using it shares the cooldown; changing IP can bypass an IP-based kick.
- **Refresh** reloads the current hour's messages; the page also refreshes every five seconds.
- **Remove** deletes that message from the shared chat immediately.
- **Clear all messages** asks for confirmation, then empties the current hour. If the hour changed since the page loaded, the Worker rejects the request; refresh and try again.
- **Seven-day archive** groups captured messages by local date, shows when each was first seen on this Mac, and supports name/text search and a day filter. **Show older messages** loads the next page when needed.

The live chat clears automatically at each UTC-hour boundary. Clear all has been verified to clear an already-open production tab. A visitor tab opened before the updated client was published may still need a reload to see an individual message removal. The local archive keeps its captured copy after Remove or Clear all until that copy expires; these actions do not touch personal notes or preferences.

## Local archive and retention

The Python server checks the live Worker every five seconds even when the browser page is closed. It stores text, visitor names, message IDs and first-seen times in `~/.local/share/cosy-village/chat-archive.sqlite3`. The archive directory is mode `0700` and the database file is mode `0600`; neither the database nor the admin secret belongs in Git or the public site. The archive has no cloud backup or export.

Each message is stored once. Records older than seven rolling days are removed on startup, on archive reads and on each server check, even if the Worker is unreachable. If the local server is stopped when a record reaches seven days, that record is removed the next time the server starts. The displayed time is when this Mac first captured the message, not the exact send time.

Capture starts when you run the local server. The Worker exposes only the current UTC hour's latest 80 messages, so earlier hours cannot be recovered and gaps while the server is stopped cannot be filled. A message that appears and disappears between five-second checks, or is pushed out by a very busy chat before the next check, can also be missed. The status beside the title shows the latest successful check or a capture error.

## If the page cannot connect

- **Address already in use:** the console may already be running. Open `http://127.0.0.1:3052/`, or stop the existing process before starting another. You can choose another local port with `python3 tools/village-admin/server.py --port 3053` and then open `http://127.0.0.1:3053/`.
- **Secret file permissions:** keep `~/.config/cosy-village/chat-admin-token` readable only by your account (`chmod 600 ~/.config/cosy-village/chat-admin-token`).
- **The server rejected the admin secret:** the local secret does not match the Worker's current `VILLAGE_ADMIN_TOKEN` secret. Obtain the current secret through a private channel; do not paste it into an issue or commit.
- **Could not reach the village server:** check your network connection and the Worker. The public village site does not need to be open for the console to work.
- **Archive paused:** check the status beside the title. Live moderation can still work if the local database cannot be written; confirm that the archive directory and file remain private and the disk has space.

For an isolated local Worker test, start Wrangler separately and pass `--worker-url http://127.0.0.1:2567` to the launcher. That Worker needs its own matching `VILLAGE_ADMIN_TOKEN` in local secret configuration. The normal command above always targets production.

## Access boundary

The Python server binds only to `127.0.0.1`, checks the browser's Host, Origin and local session token on changes, and has no public Next.js route. The Worker checks the admin secret for every admin request, including player lists and kicks. It derives the IP fingerprint from [Cloudflare's client IP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip), preferring the original IPv6 address when supplied. Only a SHA-256 fingerprint is retained in private socket attachments and temporary cooldown storage; raw IPs and fingerprints never appear in public visitor messages or the console. The local token file must remain private; deleting it removes this Mac's saved access. See [the original release record](../../VILLAGE_BUILD.md#2026-09-29-local-chat-admin) and [the published kick checks](../../VILLAGE_BUILD.md#2026-09-30-five-minute-ip-kick-release-published).

After the matching Worker/client release, restart an already-running Python console to load its new player API handlers, then reload the browser page. This preserves the existing seven-day archive.
