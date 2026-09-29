# Hearthwillow chat admin

This is a local-only page for moderating the shared village chat. It lists the messages in the current UTC hour, removes individual messages, and clears that hour. Removals are saved in the Worker's Durable Object and broadcast to open visitor chats. Messages clear automatically at the hour boundary as before.

## Start locally

Run:

```bash
python3 tools/village-admin/server.py
```

Open `http://127.0.0.1:3052/`. Leave the terminal running while using the page; Ctrl+C stops it. The launch command reads the admin secret from `~/.config/cosy-village/chat-admin-token` when that private mode-0600 file exists, or prompts for it otherwise. The secret is sent to the Worker over HTTPS and is never sent to the browser. The page refreshes every five seconds and has a manual Refresh button. Clear all asks for confirmation; a stale page cannot clear a new chat hour.

For an isolated local Worker, start Wrangler separately and pass `--worker-url http://127.0.0.1:2567`. That Worker needs the same `VILLAGE_ADMIN_TOKEN` in its local secret configuration; this guide does not create one.

## Release requirement

The Worker expects a long random `VILLAGE_ADMIN_TOKEN` secret. Keep the value out of Git, shell history, browser storage and documentation. The Worker checks the token for every admin request. The local copy should be held in the private file above and deleted if access is revoked. The page binds only to loopback, enforces its own local session and Origin checks, and has no public Next.js route. An already-open old visitor client will not understand removal broadcasts until the updated site loads.

The new Worker adds a `messageId` to chat entries. On first load, older entries from the current hour get stable IDs while preserving their sender and message. Removing a message or clearing the hour affects the shared chat for all visitors; it does not delete anything from a visitor's personal notes or preferences.
