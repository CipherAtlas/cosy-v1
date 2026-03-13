# A Peaceful Room

Pastel, cozy wellness UI built with Next.js (App Router), TypeScript, Tailwind, Framer Motion, and Tone.js.

## GitHub Pages Deployment

This project is configured for static export and GitHub Pages.

### Automatic deploy (recommended)

1. Push to `main`.
2. GitHub Actions runs `.github/workflows/deploy-pages.yml`.
3. The workflow builds the static site and deploys `out/` to Pages.

### Base path / repo name

- The workflow sets `NEXT_PUBLIC_BASE_PATH=/<repo-name>` automatically.
- For local testing with a repo path, run:

```bash
NEXT_PUBLIC_BASE_PATH=/your-repo-name npm run build
```

### Notes

- Static export is enabled (`output: "export"`).
- Features remain client-side (localStorage + browser audio).
- There is no backend/API dependency in the deployed Pages build.
