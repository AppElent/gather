# Gather mobile

Gather mobile is the native, connected-only companion to the Gather household
app. It shares the same Clerk account and Convex service as the web app.

## Run locally

1. Copy `.env.example` to `.env.local` and provide the Clerk and Convex values.
2. From the repository root, run `pnpm --filter @gather/mobile start`.
3. Open the development build on a device, or start the Android or iOS target
   with `pnpm --filter @gather/mobile android` or
   `pnpm --filter @gather/mobile ios`.

The native app icon and launch mark are rendered from Gather's web favicon. A
native rebuild is required after changing `app.json` or anything in
`assets/images`.
