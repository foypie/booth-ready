# Booth Ready — Admin Upload v1.2 Architecture Decision Record

Date: 2026-05-15  
Baseline: GitHub main commit 9187491 — Upgrade admin beat metadata validation  
Production service: Render booth-ready-uat  
Production domain: https://boothreadybeats.com  
Current PM plan: Booth Ready Project Management Plan v2.14 — Admin Beat Manager v1.1 Live Passed

## Decision Context

Admin Beat Manager v1.1 allows metadata-based beat creation and beat status management, but it does not upload audio files. It only validates that an admin-entered filename already exists in /audio.

Admin Upload v1.2 is intended to add live-site beat upload capability. Architecture inspection was performed before implementation.

## Current Findings

data/beats.json is structured as:

- catalog: 25 beats
- licenses: 3 licenses

The current beat schema uses one audio field:

- file

That single file field is currently used for:

- public storefront preview audio
- admin filename validation
- Stripe Checkout metadata as beatFile
- post-purchase download resolution
- download delivery through /download

The frontend plays public preview audio from /audio using beat.file.

The server validates and resolves audio from the local /audio directory.

## Security Finding

The server currently uses:

app.use(express.static(__dirname));

This means files under /audio are public static assets.

Therefore, clean master files must not be uploaded into /audio.

The /download route is token-protected, but the files it currently serves are also in public /audio. That is acceptable for the current legacy setup, but it is not safe for future clean-master upload.

## Storage Finding

Current dependencies do not include upload middleware or object-storage packages.

Current dependencies are:

- cors
- dotenv
- express
- resend
- stripe

There is currently no multer, busboy, formidable, AWS SDK, Cloudflare R2/S3 SDK, Cloudinary SDK, or ffmpeg package.

Current runtime write points are local files inside the app directory:

- data/beats.json
- fulfilled-orders.json
- data/subscribers.json

This is not a robust long-term storage model for uploaded audio.

## Architecture Decision

Admin Upload v1.2 must separate public preview audio from protected clean master audio.

Public previews may remain public and may temporarily continue using /audio.

Clean masters must not be stored in public /audio.

Clean masters should eventually use protected storage, preferably object storage such as Cloudflare R2, AWS S3, Backblaze B2, or another private object-storage service.

A Render persistent disk may be considered only if the service tier supports it and the mounted path is outside public static routing.

## Target Schema Direction

The catalog schema should evolve from:

file

to a backward-compatible model containing:

- file
- previewFile
- masterFile
- masterStorageKey
- storageProvider

Backward compatibility rule:

previewFile = beat.previewFile || beat.file

Download resolution should eventually prefer protected master storage. Legacy fallback may remain temporarily but should not be treated as the final protection model.

## v1.2A Scope

Admin Upload v1.2A is a foundation release only.

It should:

- preserve live-passed v1.1 behavior
- add backward-compatible schema support for previewFile
- add placeholder support for masterFile, masterStorageKey, and storageProvider
- ensure public catalog output does not expose protected master fields
- keep existing 25 beats working
- keep existing Stripe checkout working
- keep existing download flow working
- keep Brevo, watermark, admin login, catalog, and beat status behavior unchanged

It should not:

- add file upload UI yet
- upload clean masters
- add object-storage credentials
- move existing audio
- change pricing
- change license behavior
- change card layout
- change artwork or title-art behavior

## v1.2B Future Scope

Admin Upload v1.2B should add real upload implementation after storage is selected.

Likely scope:

- preview audio upload
- master audio upload
- protected master storage
- upload validation
- public preview assignment
- protected download resolution
- object-storage or persistent-disk configuration
- QA to confirm master files are not publicly reachable

## v1.2A QA Requirements

Minimum QA:

1. Homepage loads.
2. Catalog loads.
3. Existing beat preview audio plays.
4. Beats for Life watermark starts and repeats.
5. Stripe Checkout opens.
6. License terms link still opens.
7. Admin login works.
8. Admin page opens.
9. Manager count remains 25.
10. Existing active beats display.
11. Hidden beat remains hidden from public catalog.
12. Admin add beat using existing audio filename still works.
13. Bad filename is still blocked.
14. Hide / Activate / Sold still work.
15. Public /api/catalog does not expose masterFile, masterStorageKey, or protected storage fields.

## Rollback

Rollback baseline:

GitHub main commit 9187491  
Admin Beat Manager v1.1 Live Passed

Latest checkpoint folder:

/Users/pierrefoy/Projects/booth-ready-ADMIN-BEAT-MANAGER-V1-1-PASSED-2026-05-15

Latest lean zip:

/Users/pierrefoy/Projects/booth-ready-ADMIN-BEAT-MANAGER-V1-1-PASSED-2026-05-15-LEAN.zip
