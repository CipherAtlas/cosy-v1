# A Peaceful Room

A Peaceful Room is a calm, single-screen wellness space designed for quiet focus and gentle self-care.

The app uses a cozy pastel interface with six sections you can switch between from the left menu. Everything runs client-side in the browser.

## What You Can Do

### Focus
- Run a Pomodoro timer with focus/break durations
- Pick quick presets or custom minutes
- Set a short intention for your session
- Use embedded cozy audio controls while focusing
- Enter Focus Mode for a minimal immersive timer view
- Get gentle completion feedback when a focus session ends

### Music
- Generate procedural tracks with vibe presets (`lofi`, `piano`, `jazz`)
- Play/pause and generate a new track
- Toggle rain and vinyl ambience
- Adjust mix sliders for music layers, ambience, master, and output boost
- See lightweight now-playing info (vibe, key, tempo, section)

### Breathe
- Choose breathing presets:
- Box Breathing (4-4-4-4)
- Calm Breathing (4-4-6)
- Deep Relaxation (4-7-8)
- Start manually (no auto-start), then pause/resume/reset

### Mood
- Check in with your current mood
- Receive gentle next-step suggestions based on that mood
- Open suggested sections directly

### Gratitude
- Save gratitude notes locally on your device
- View recent entries
- Delete entries with lightweight confirm/cancel flow

### Compliment
- Read a daily-style gentle compliment
- Show another note anytime
- Supports English and Japanese compliment sets

## Language Support

- Language switcher in the sidebar (`English` / `日本語`)
- UI updates immediately when switched
- Preference is saved in localStorage and restored on reload

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + Framer Motion
- Tone.js for procedural audio
- localStorage for user-local persistence
- Static JSON/config data for compliments and mood suggestions

## Run Locally

```bash
npm install
npm run dev
```

## Deployment (GitHub Pages)

- Static export is enabled.
- Push to `main` to trigger `.github/workflows/deploy-pages.yml`.
- For project pages, base path is handled automatically in CI.
