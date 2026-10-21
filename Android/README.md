# Crust & Co. Pizza House: Android customer app

Kotlin, Jetpack Compose, Material 3, MVVM. Built from `prompts/06-claude-phase-1-android-foundation.md`, then restyled and polished.

## Open and run (Android Studio)
1. **File > Open** and choose this `Android` folder. Let Gradle sync. It downloads Gradle 9.6.0 and the dependencies on first sync.
2. If asked for a JDK: **Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK** = the bundled JetBrains Runtime (JDK 17 or newer is required).
3. Pick the `Medium_Phone_API_37.0` emulator (Device Manager) and press **Run**. The app opens with demo data and needs no server.
4. Unit tests: right-click `app/src/test` > **Run Tests**, or the Gradle task `app > Tasks > verification > testDebugUnitTest`.

If sync fails, copy the first red error from the **Build** panel; version problems show up there.

## Data source
Defaults to **demo data** (in-memory, same repository interfaces as the real API). The demo menu is the printed menu of Steinofen Pizzeria
Niki (Wesel), in euros: 188 items in 15 categories (`data/mock/MockMenu.kt`, with notes on what was hard to read). Orders, addresses and offers are
in `MockData.kt`. Switch to the live backend in `~/.gradle/gradle.properties` (or `gradle.properties` for this project):

```
crust.useMockData=false
crust.apiBaseUrl=http://10.0.2.2:3000/api/
```
`10.0.2.2` is your computer as seen from the emulator; the dashboard's dev server runs on port 3000. On a real phone use your computer's LAN IP.
Release builds only allow HTTPS; plain HTTP to `10.0.2.2` and `localhost` is allowed in debug builds only.

### Live menu (menu from the database, rest demo)
The menu can come from the real catalog API while orders, addresses, offers and checkout stay demo data (the demo server then prices the live menu):

```
crust.liveCatalog=true
crust.apiBaseUrl=http://localhost:3000/api/
```
1. Start the backend: `cd backend`, `npm run dev` (port 3000).
2. If the emulator cannot reach `10.0.2.2:3000` (on one machine it timed out for the Next dev server only), run `adb reverse tcp:3000 tcp:3000` and use `http://localhost:3000/api/` as above.
3. Build and run. Menu responses are cached on the phone (ETag, short max-age), so a repeat visit is instant and the last menu still shows offline for up to a week.

The app uses each portion's `key` as the variant id, prices extras per portion (a pizza topping costs 0,50 / 1,00 / 2,50 € by size), preselects the server's `is_default` option, and opens the product screen instead of adding directly when the server says `needs_choices`.

### Live orders (real checkout as a guest)
Add `crust.liveOrders=true` (it implies the live menu) and addresses, the price quote, coupons, checkout and order tracking all go to the real API:

```
crust.liveOrders=true
crust.apiBaseUrl=http://localhost:3000/api/
```
The app has no sign-in yet, so it registers as a **guest** the first time it needs to: the server returns a private device token, which the app stores encrypted with an Android Keystore key (`data/local/DeviceTokenStore.kt`). Orders and addresses belong to that token, and it is sent only to the customer endpoints. If the server does not recognise the token (for example the database was reset) the app registers a new guest and retries once, without showing an error. Prices, coupons, the minimum order by area and the delivery estimate all come from the server; the app sends only ids and quantities. Online payment is a labelled demo; no card data is ever collected. Details: `docs/api-contract.md` ("Customer endpoints") and `docs/checkout-implementation-plan.md`.

## Structure
```
app/src/main/java/com/crustandco/customer/
  core/            Money (euros, German format), AppResult/AppError, UiState, formatting
    designsystem/  Colors, typography (Fraunces + Plus Jakarta Sans), Phosphor icons, motion, theme and shared components
  domain/          Models and repository interfaces (no Compose, no Retrofit)
  data/remote/     Retrofit API, DTOs, error mapping, mappers
  data/repository/ Remote (Retrofit) implementations
  data/local/      Demo sign-in (made-up profile in SharedPreferences) and the in-memory cart
  data/mock/       Demo menu, orders, addresses, offers and the mock "server" (pricing, coupons), kept apart so they are easy to delete
  feature/         welcome, account (sign-in), home (offers carousel), menu (filters), search, product, cart, checkout, tracking, orders, addresses, profile
  navigation/      Type-safe routes, shared-element transitions and the bottom navigation bar (Home, Menu, Search, Cart, Profile)
  AppContainer.kt  Wires mock or real repositories in one place (no Hilt: not justified yet)
```
Dependency direction: `feature -> domain <- data`. ViewModels receive repository interfaces only.

## Rules this app follows
- Server is the authority for prices, coupons and totals. The app never sends a total.
- No Supabase service-role or secret key in the app. Only the user's access token will be sent once real sign-in exists.
- Status shown is always the backend's persisted status: no invented progress, no GPS claims.
- Demo payments are labelled as demo.

## What works (demo mode)
Welcome and sign-in (demo account or guest), Home (delivery address, auto-scrolling offers, categories, popular pizzas), Menu (category pills pinned
above the list, Veg / Non-veg / Spicy filters, item count, Deals, search), Search tab (type-ahead, quick-pick words), product detail
(sizes, required and optional choices, quantity, indicative price), cart (quantity, remove, coupon, server-priced summary),
checkout (address, delivery instructions, payment method, retry-safe order placement), order tracking driven by the persisted status,
My Orders (Active / Past), addresses (list and add), profile (edit, sign out).

## Not built yet
Real Google sign-in (see `docs/GOOGLE_SIGN_IN.md`), saved cards, favourites, notifications, help and support, live map tracking, real photography
(see `docs/IMAGES.md`), the live backend (the API's schemas for addresses, pricing and checkout are not final; see `docs/api-assumptions.md`),
size-dependent extra toppings, a minimum order value, and a phone-number rule for German numbers (the profile still expects an Indian mobile number).

## Speed
Judge speed on the `benchmark` build type, not on debug: `gradle --offline :app:assembleBenchmark -x lintVitalAnalyzeBenchmark -x lintVitalReportBenchmark -x lintVitalBenchmark`.
It is shrunk like release but signed with the debug key so it installs. Never distribute it. On the emulator a cold start took about 0.75 to 0.95 s
there, against 3 to 4 s for debug. `app/src/main/baseline-prof.txt` is a baseline profile that has the app's own code compiled ahead of time.

## Build and test from the command line
Studio downloads Gradle 9.6.0 into `~/.gradle/wrapper/dists`. With Android Studio closed (a running Studio can crash the build's AAPT2 step), run that copy with `JAVA_HOME` set to Studio's bundled JDK: `gradle --offline :app:assembleDebug :app:testDebugUnitTest`.

## Licences
Phosphor icons (MIT) and the Fraunces, Plus Jakarta Sans and Pacifico fonts (SIL Open Font Licence) are listed in `docs/THIRD_PARTY.md`.

## Known gaps
- Strings are inline in Kotlin rather than `strings.xml`; move them before localization (the app mixes English interface text with German menu text).
- No instrumented/UI tests yet. Unit tests cover mapping, error handling, money, and ViewModel state.
- The Gradle wrapper script and jar are not included. Studio uses `gradle/wrapper/gradle-wrapper.properties` to fetch Gradle. To add `gradlew`, run `gradle wrapper` once using the distribution Studio downloaded.
