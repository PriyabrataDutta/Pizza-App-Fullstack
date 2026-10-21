# Enabling real Google sign-in

Status: **not live.** The app shows an honest "Google sign-in isn't set up yet" dialog and offers the demo account.
`AuthRepository.googleSignInAvailable` is `false` until the steps below are done.

## What you need to do

1. **Google Cloud Console** → create a project → *APIs & Services → OAuth consent screen* (External, add yourself as a test user).
2. *Credentials → Create OAuth client ID*:
   - **Web application** — copy its Client ID (used by Supabase and as the `serverClientId` in the app).
   - **Android** — package `com.crustandco.customer` and your debug SHA-1
     (`keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android`).
     Add a second Android client for your release keystore later.
3. **Supabase** → project `crust-and-co` → *Authentication → Providers → Google*: enable, paste the Web client ID and secret.
   Under *Authentication → Providers → Google* tick "Skip nonce check" only if the client library you use cannot send a nonce.

## What gets implemented afterwards

- Dependencies: `androidx.credentials`, `androidx.credentials:credentials-play-services-auth`, `com.google.android.libraries.identity.googleid`.
- Flow: Credential Manager `GetGoogleIdOption` (serverClientId = Web client ID, nonce) → Google ID token →
  Supabase `POST /auth/v1/token?grant_type=id_token` with `provider=google` → session tokens.
- Store tokens encrypted (Android Keystore-backed), never in plain SharedPreferences; never log them.
- Add the Web client ID as a Gradle property (not committed), expose via `BuildConfig`.
- Replace the stub in the auth repository and flip `googleSignInAvailable`.

The Web client ID is public-ish; the client **secret** belongs only in the Supabase dashboard, never in the app or repo.
