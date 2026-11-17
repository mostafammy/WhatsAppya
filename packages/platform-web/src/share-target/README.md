# Web Share Target (Android)

`ShareTargetReceiver.ts` will read the POSTed `multipart/form-data` zip inside the
service worker (see `apps/web/public/manifest.webmanifest` → `share_target`) and hand
the `Blob` to `ZipFileSource.fromBlob`.
