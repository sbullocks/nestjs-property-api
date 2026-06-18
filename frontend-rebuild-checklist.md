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

- [ ] Create `src/features/auth/authApi.ts` — RTK Query login mutation
  - `builder.mutation` for `POST /auth/login` — mutations are for requests that change data (POST/PATCH/DELETE)
  - Login body: `{ tenantId: number, role: string }` — matches your backend `LoginDto`
  - Returns: `{ access_token: string }`

- [ ] Create `src/features/auth/authSlice.ts` — Redux slice for auth state
  - State: `{ token, tenantId, role }`
  - `setCredentials` action — stores token + user info, saves token to `localStorage`
  - `logout` action — clears state, removes token from `localStorage`
  - Read `localStorage.getItem('token')` in `initialState` so token survives page refresh

- [ ] Add `authReducer` to `store.ts` — wire slice into the Redux store

- [ ] Create `src/hooks/useAuth.ts` — `useSelector` hook that returns auth state
  - Used by any component that needs to know if user is logged in, what their role is

- [ ] Create `src/pages/LoginPage.tsx` — login form
  - MUI `TextField` for tenantId (number input), `Select` for role (admin/tenantuser/viewer)
  - Call `useLoginMutation`, on success dispatch `setCredentials` and navigate to `/properties`
  - Show error message if login fails
  - **This is the training-wheels login** — in a real app this would be email + password

- [ ] Create `src/components/ProtectedRoute.tsx`
  - Reads `token` from `useAuth()`
  - If no token → `<Navigate to="/login" replace />`
  - If token exists → render children

- [ ] Create `src/App.tsx` — route setup
  - `/login` → `LoginPage`
  - `/properties` → `<ProtectedRoute><PropertiesPage /></ProtectedRoute>`
  - `*` (catch-all) → redirect to `/login`
  - Create a placeholder `PropertiesPage.tsx` for now (just returns a `<div>`)

- [ ] Test: login with `{ tenantId: 1, role: 'admin' }` → redirects to `/properties`
- [ ] Test: refresh the page → stays on `/properties` (token in localStorage persists)
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
