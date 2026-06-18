# Frontend Rebuild Checklist

Same format as the backend rebuild-checklist.md. One action per item. When stuck, go to
frontend-guide.md — the why is always there.

---

## Phase 1 — Scaffold, Store, Router, MUI

- [ ] From the project root (`nestjs-property-api/`) run:
  ```bash
  npm create vite@latest frontend -- --template react-ts
  cd frontend
  npm install
  ```
  - This scaffolds a Vite + React + TypeScript project into `frontend/` as a sibling to `app/` and `app-v2/`
  - Same concept as `nest new` on the backend — generates the boilerplate so you can start building immediately

- [ ] Install all dependencies — **use these pinned versions to avoid compatibility errors:**
  ```bash
  npm install react@18 react-dom@18 @types/react@18 @types/react-dom@18
  npm install @mui/material@5 @mui/icons-material@5 @emotion/react @emotion/styled
  npm install @reduxjs/toolkit react-redux react-router-dom
  ```
  - **[troubleshooting] React 19 + MUI v9 = broken.** The default Vite scaffold installs React 19 and `npm install @mui/material` pulls MUI v9. This combination causes "Invalid hook call / Cannot read properties of null (reading 'useMemo')" at the Redux `Provider`. Fix: downgrade to React 18 + MUI v5 as above
  - `npm install` downloads packages into `node_modules` — nothing starts, nothing runs. One-time setup step
  - `npm run dev` actually starts the dev server at `http://localhost:5173` — run this every dev session

- [ ] Create folder structure inside `src/`:
  ```
  src/
    store/          ← Redux store + RTK Query base API
    features/       ← feature slices (auth/, properties/)
    pages/          ← full page components
    components/     ← reusable UI pieces
    hooks/          ← custom hooks
  ```

- [ ] Create `src/store/api.ts` — RTK Query base API with `prepareHeaders` for JWT
  - `baseUrl` points at your running backend (`http://localhost:3000`)
  - `prepareHeaders` reads token from `localStorage` and attaches `Authorization: Bearer <token>`
  - `tagTypes: ['Property']` — needed for cache invalidation in Phase 4
  - Reference `frontend-guide.md` Phase 1 for the exact shape

- [ ] Create `src/store/store.ts` — Redux store wiring RTK Query reducer + middleware
  - `configureStore` with `[api.reducerPath]: api.reducer` in the reducer map
  - `.concat(api.middleware)` in the middleware chain — required for RTK Query cache to work

- [ ] Wire up providers in `src/main.tsx`:
  - `<Provider store={store}>` — makes Redux available to all components
  - `<BrowserRouter>` — enables React Router throughout
  - `<ThemeProvider theme={createTheme()}>` + `<CssBaseline />` — MUI baseline styling
  - Order matters: Provider wraps everything, BrowserRouter inside, ThemeProvider inside that

- [ ] Add CORS to backend `main.ts` (both `app` and `app-v2`):
  ```ts
  app.enableCors({ origin: 'http://localhost:5173' });
  ```
  - Must be in the BACKEND — CORS permission is granted by the server, not the browser
  - Without this, every API call from the frontend returns a CORS error in the browser console

- [ ] Test: `npm run dev` → confirm app loads at `http://localhost:5173` with no errors in console
  - The default Vite template CSS may look slightly different after adding MUI's `CssBaseline` — expected. `CssBaseline` resets browser defaults (removes margins, normalizes fonts). The Vite template CSS assumes browser defaults so they clash slightly. Doesn't matter — you'll replace `App.tsx` entirely in Phase 2
  - `npm run dev` must be run from inside the `frontend/` folder, same as `npm run start:dev` from inside `app/` or `app-v2/` on the backend

---

## Phase 2 — Auth (Login + Token + Protected Routes)

- [x] Create `src/features/auth/authApi.ts` — RTK Query login mutation
  - Define 2 interfaces: `LoginRequest { tenantId: number, role: string }` and `LoginResponse { access_token: string }` — TypeScript's way of declaring the expected shape of what goes in and what comes back
  - `builder.mutation` for `POST /auth/login` — mutations for POST/PATCH/DELETE (anything that changes data). `builder.query` is for GET (reads)
  - `injectEndpoints` adds the login endpoint INTO the base `api` instance from `store/api.ts` instead of creating a whole new `createApi()`. This means auth and properties share ONE Redux cache and ONE middleware setup — no conflicts
  - Exports `useLoginMutation` — the hook your LoginPage calls
  - This is the frontend equivalent of hitting `POST /auth/login` in Swagger to get back a token

- [x] Create `src/features/auth/authSlice.ts` — Redux slice for auth state
  - Interface `AuthState { token, tenantId, role }` — typed shape of the auth state object
  - `initialState` reads `localStorage.getItem('token')` so token survives page refresh
  - `setCredentials` action — updates state with token/tenantId/role + calls `localStorage.setItem()` to persist
  - `logout` action — sets token/tenantId/role back to null + calls `localStorage.removeItem()`
  - **Two exports:** `authSlice.actions` (the actions: `setCredentials`, `logout`) AND `default authSlice.reducer` (the reducer the store uses). Actions = what components dispatch. Reducer = how the store processes those dispatches and updates state. They are different things
  - The slice manages ALL auth state for the frontend — log in and log out are its only two jobs

- [x] Add `authReducer` to `store.ts` — wire slice into the Redux store
  - `auth: authReducer` in the reducer map
  - The store doesn't "have access to" actions — it registers the reducer (the state manager). Components dispatch actions TO the store, the store processes them THROUGH the reducer, state updates. Flow: component dispatches → action → reducer → new state
  - `import type { PayloadAction }` and `import type { RootState }` — must use `import type` for TypeScript type-only imports in decorated files or TypeScript throws

- [x] Create `src/hooks/useAuth.ts` — `useSelector` hook that returns auth state
  - `useSelector((state: RootState) => state.auth)` — reads specifically the `auth` slice of global Redux state
  - Any component that needs to know if user is logged in or what their role is calls `useAuth()`

- [x] Create `src/pages/LoginPage.tsx` — login form
  - `useState` for tenantId/role = LOCAL state (only known to this component, not global Redux)
  - `useLoginMutation` gives back `[login, { isLoading, error }]`
  - `handleSubmit` is async because it `await`s the API call for the token. `preventDefault()` stops the browser's default form submit behavior (page reload)
  - On success: dispatch `setCredentials` (updates global Redux state) then `navigate('/properties')`
  - **Training-wheels login** — in a real app this would be email + password. Backend looks up user, verifies password, returns token. Never send tenantId/role from the client in production

- [x] Create `src/components/ProtectedRoute.tsx`
  - Reads `token` from `useAuth()` — checks ONE thing only: does a token exist?
  - **Does NOT check role or tenantId** — ProtectedRoute is purely "are you logged in?" Role-based UI (hiding delete for viewers) is Phase 5, separate concern
  - No token → `<Navigate to="/login" replace />` | token exists → render children

- [x] Create `src/App.tsx` — route setup
  - Replace the default Vite boilerplate entirely
  - Import `Routes, Route, Navigate` from `react-router-dom`
  - `/login` → `LoginPage` | `/properties` → `<ProtectedRoute><PropertiesPage /></ProtectedRoute>` | `*` → redirect to `/login`
  - Placeholder `PropertiesPage.tsx` returning just `<div>Properties</div>` is enough for now

- [x] Add CORS to backend `main.ts` in BOTH `app` and `app-v2`:
  - `app.enableCors({ origin: 'http://localhost:5173' })`
  - **Must restart the backend server after adding** — not hot-reloaded
  - Without it: browser blocks the request before it even reaches the backend (CORS preflight fails)
  - Without backend running: `ERR_CONNECTION_REFUSED` — start the backend first

- [x] Test: login with `{ tenantId: 1, role: 'admin' }` → redirects to `/properties` ✅
- [x] Test: refresh the page → stays on `/properties` (token in localStorage persists) ✅
- [ ] Test: no token → navigating to `/properties` redirects to `/login`
- [ ] Test: logout → clears token, redirects to `/login`

---

## Phase 3 — Properties List (RTK Query GET)

- [ ] Create `src/features/properties/propertiesApi.ts` — getProperties query
  - `builder.query` for `GET /properties` — queries are for reading data (GET)
  - Accepts `params` object (`page`, `limit`, `city`, `state`, `search`) — RTK Query serializes to `?page=1&city=Austin`
  - `providesTags: ['Property']` — marks this cache entry so mutations can invalidate it
  - **Common mistake:** using `builder.mutation` for a GET — use `builder.query` for reads

- [ ] Build `src/pages/PropertiesPage.tsx` — main properties view
  - `useGetPropertiesQuery({ page, limit: 10, city, search })` — RTK Query hook, manages loading/error/data automatically
  - Show `CircularProgress` while loading, `Alert` on error
  - Render list of `PropertyCard` components
  - Search + city filter inputs — reset `page` to 1 when filter changes
  - Pagination buttons — Previous/Next, show current page and total pages from `data.meta`
  - Logout button that dispatches `logout()` action and navigates to `/login`

- [ ] Create `src/components/PropertyCard.tsx` — card for each property
  - Display `name`, `address`, `city`, `state`
  - Will add Edit + Delete buttons in Phase 4

- [ ] Test: properties list loads with real data from backend
- [ ] Test: search and city filter work — list updates on input
- [ ] Test: pagination — page changes show different results
- [ ] Test: login as `tenantId: 2` → only sees tenant 2's properties (multi-tenancy works end to end)

---

## Phase 4 — CRUD (Create, Edit, Delete)

- [ ] Add mutations to `propertiesApi.ts`:
  - `createProperty` — `POST /properties`, body: `{ name, address, city, state }`, `invalidatesTags: ['Property']`
  - `updateProperty` — `PATCH /properties/:id`, body: partial property, `invalidatesTags: ['Property']`
  - `deleteProperty` — `DELETE /properties/:id`, `invalidatesTags: ['Property']`
  - `invalidatesTags: ['Property']` is the frontend's equivalent of `cacheManager.clear()` on the backend — tells RTK Query to re-fetch `getProperties` after the mutation succeeds

- [ ] Create `src/components/PropertyForm.tsx` — reusable form for create and edit
  - MUI `TextField` for each field (`name`, `address`, `city`, `state`)
  - Accepts `initialValues` prop (empty for create, existing data for edit)
  - Calls `onSubmit` with form values on submit

- [ ] Add Create flow to `PropertiesPage.tsx`
  - "Add Property" button → opens MUI `Dialog` containing `PropertyForm`
  - On submit: call `useCreatePropertyMutation`, close dialog on success
  - List auto-updates via `invalidatesTags` — no manual refresh needed

- [ ] Add Edit flow to `PropertyCard.tsx`
  - Edit button → opens `Dialog` with `PropertyForm` pre-filled with current values
  - On submit: call `useUpdatePropertyMutation` with `{ id, ...values }`

- [ ] Add Delete flow to `PropertyCard.tsx`
  - Delete button → confirm dialog ("Are you sure?")
  - On confirm: call `useDeletePropertyMutation(property.id)`

- [ ] Test: create a property → appears in list immediately (no refresh)
- [ ] Test: edit a property → list updates with new values
- [ ] Test: delete a property → removed from list immediately
- [ ] Test: try to delete with a viewer token (via curl) → still gets 403 from backend

---

## Phase 5 — Role-Based UI

Frontend hides UI based on role. Backend still enforces the real rules — frontend is UX only.

- [ ] `useAuth()` already returns `role` — use it in components for conditional rendering
- [ ] Hide Delete button for non-admin users in `PropertyCard.tsx`:
  - `{role === 'admin' && <DeleteButton />}`
- [ ] Hide "Add Property" button for viewers in `PropertiesPage.tsx`:
  - `{role !== 'viewer' && <Button>Add Property</Button>}`
- [ ] Show current role in the header/nav so it's clear which user is logged in
- [ ] Test: login as `role: viewer` → no create or delete buttons visible
- [ ] Test: login as `role: admin` → all buttons visible
- [ ] Test: viewer trying `DELETE` via curl directly → still 403 (backend guards enforce real rules)

---

## Switching Between Backends

Only ONE line changes — `baseUrl` in `src/store/api.ts`:

```ts
baseUrl: 'http://localhost:3000'   // app (v1)
baseUrl: 'http://localhost:3001'   // app-v2
```

To run app-v2 on port 3001 — in `app-v2/src/main.ts`:
```ts
await app.listen(process.env.PORT ?? 3001);  // change 3000 → 3001
```

Both backends need CORS enabled for `http://localhost:5173`.

---

## Gotchas to Remember

| Mistake | Fix |
|---|---|
| CORS error in browser | Add `app.enableCors({ origin: 'http://localhost:5173' })` to backend `main.ts` |
| `builder.mutation` for a GET | Use `builder.query` for reads, `builder.mutation` for writes |
| `providesTags` missing on query | Mutations can't invalidate untagged queries — list won't re-fetch |
| `invalidatesTags` missing on mutation | List won't update after create/update/delete — must match the tag in `providesTags` |
| Token lost on page refresh | Read `localStorage.getItem('token')` in `authSlice` `initialState` |
| Forgot `prepareHeaders` | All protected routes return 401 — every request needs `Authorization: Bearer <token>` |
| Passing `city: ''` to query | Pass `city: city || undefined` — RTK Query omits `undefined` values from the URL |
| RTK Query middleware missing | Add `.concat(api.middleware)` in store — required for caching and invalidation to work |
| `<Provider>` missing | `useSelector` and `useDispatch` hooks throw — every component needs Redux context |
