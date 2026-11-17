# Android (Trusted Web Activity)

Thin Play Store wrapper around `apps/web`. **No UI code lives here.**

```bash
npx @bubblewrap/cli init --manifest https://whatsappya.app/manifest.webmanifest
npx @bubblewrap/cli build
```

Generated sources (`app/`) and keystores are git-ignored. Host `/.well-known/assetlinks.json`
on the web app for Digital Asset Links verification.
