# Pet Parent Tracker

A **100% offline** Android app for pet parents, built with **React Native + Expo** (TypeScript). Track pet profiles, vaccines, medications, feeding schedules, vet records, expenses, and a personality journal — every byte of user data lives on the device. Zero servers, zero API calls, zero network dependence.

> **Current status — MVP:** Pet Profiles fully working (create, edit, list, switch active pet) plus the typed local-data layer and navigation skeleton the other six modules plug into. The other modules and the upsell products are wired in as placeholders and will ship in later iterations.

---

## Running in Expo Go (Android)

```bash
npm install        # install dependencies (done once)
npm start          # starts the Expo dev server / Metro bundler
```

Then open the QR code with the **Expo Go** app on your Android phone (scan it from the terminal or the Expo dashboard). The app loads over your local LAN — no account or backend needed to run.

Other useful commands:

```bash
npm run android    # start and open on an Android emulator / device
npm run ios        # (requires macOS + Xcode)
npm run web        # run in a browser (mostly for quick UI checks)
npm run typecheck  # run the TypeScript compiler with no emit (CI-style check)
```

---

## Architecture: 100% offline, data stored on-device

**No network, period.** There is no `fetch`/`axios`/HTTP call anywhere in the code, and no analytics. All data persists to `@react-native-async-storage/async-storage` and survives app restarts.

```
App.tsx                                  # entry point → renders RootNavigator
index.ts                                 # registerRootComponent(App)
src/
  navigation/RootNavigator.tsx           # nav tree + PetProvider (root)
  context/PetContext.tsx                 # usePets() hook: CRUD + active-pet, persisted
  screens/                               # Home, PetForm, placeholders (modules/upsells)
  storage/                               # generic data layer over AsyncStorage
    storage.ts                           #   CollectionStore<T> + KeyValueStore
    pets.ts                              #   petRepository + activePet
  types/index.ts                         # Pet, BaseEntity, Species, WeightUnit
  theme.ts                               # colors
```

### Where the data layer lives

`src/storage/storage.ts` defines two reusable primitives:

- **`CollectionStore<T extends BaseEntity>`** — a typed, ordered collection for one entity type. Each collection maps to a single AsyncStorage key (`@pet-parent-tracker/<name>`) holding a JSON array. Methods: `getAll`, `setAll`, `findById`, `create`, `upsert`, `update`, `remove`, `removeAll`. Writes replace the whole array (atomic under AsyncStorage's string semantics) — plenty for phone-scale datasets.
- **`KeyValueStore`** — a plain string key/value pair. Used for the currently-active pet id.

Entity **types** live in `src/types/index.ts`. Every persisted entity extends `BaseEntity` (`id`, `createdAt`, plus `BaseEntity` fields) so the generic store stays fully typed.

`src/storage/pets.ts` instantiates the stores for the app and exposes `petRepository` plus the `activePet` key-value store. `src/context/PetContext.tsx` wraps those in a React context (`PetProvider` / `usePets`) so screens get reactive, persisted pet state without touching AsyncStorage directly.

### How a future module adds its own data (recipe)

To add, say, **Vaccines**:

1. **Define the type** — in `src/types/index.ts`, add e.g. `export type Vaccine = BaseEntity & { petId: string; name: string; date: string; ... }`.
2. **Add a repository** — in a new `src/storage/vaccines.ts`, do:
   ```ts
   import { CollectionStore } from './storage';
   import type { Vaccine } from '../types';
   export const vaccineStore = new CollectionStore<Vaccine>('vaccines');
   // optional: a thin repository with domain helpers (e.g. getByPetId)
   ```
3. **Expose it to screens** (optional) — either call `vaccineStore` directly from a screen, or add a `VaccinesContext` mirroring `PetContext` if you want reactive state. For MVP-scale modules, the `CollectionStore` alone is enough.
4. **Wire the screen** — replace the matching placeholder in `src/screens/modules.tsx` with the real module screen (it already has a tab + title wired in `RootNavigator`).

### Navigation structure

`RootNavigator` lays out the whole tree:

- **`PetProvider`** wraps everything, so every screen shares pet state and the active-pet selection, backed by AsyncStorage.
- A **native stack** (`Stack`) hosts the bottom-tab navigator plus a **modal** `PetForm` screen (used for create/edit).
- **`MainTabs`** is a bottom tab bar:
  - **Home** — Pet Profiles, fully working. Rendered through a `HomeTab` wrapper that pulls the root-stack navigation via `useNavigation` so it can open the `PetForm` modal.
  - **Vaccines, Meds, Feeding, Vet Records, Expenses, Journal** — six future module tabs (placeholders today).
  - **More** (`UpsellsNavigator`) — the four on-device upsell products (printable planner, memorial book, artwork, emergency card) as placeholders.

Pluggable tabs live in the `PLACEHOLDER_TABS` array in `src/navigation/RootNavigator.tsx` — swap a `component` there to install a real module.

---

## Adding the upcoming modules

- **Six core modules** (Vaccines, Medications, Feeding, Vet Records, Expenses, Journal): replace their placeholder in `src/screens/modules.tsx`, add a typed `CollectionStore` + repository per the recipe above, and swap the `component` in `RootNavigator`'s `PLACEHOLDER_TABS`.
- **Four upsell products** (Printable Pet Planner, Memorial Book, Custom Pet Artwork, Emergency Pet Card): extend `src/screens/upsells.tsx` (an emoji-icon stack navigator) with real on-device generators built from stored pet data — all generated on the phone, no server.

---

## Verification

```bash
npm run typecheck     # tsc --noEmit — must be clean
npx expo-doctor       # SDK/config sanity check
npx expo export --platform android   # headless bundle check (proves it compiles/boots)
```

The MVP is wired as: `App.tsx → RootNavigator → PetProvider + NavigationContainer → MainTabs + PetForm modal`.
