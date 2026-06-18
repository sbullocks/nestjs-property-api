# Frontend Guide — React + RTK Query + MUI

Guided build of a React frontend that connects to either NestJS backend (`app` or `app-v2`).
Same format as the backend rebuild-checklist — phases, checkboxes, notes. Build one phase
at a time. Reference `my-notes.md` and `crib-sheet.md` for the backend context.

**Tech stack:** Vite · React · TypeScript · Redux Toolkit · RTK Query · React Router · MUI

**Switching backends:** the only thing that changes is the `baseUrl` in `src/store/api.ts`.

- `app` on port 3000 → `baseUrl: 'http://localhost:3000'`
- `app-v2` on port 3001 → start with `npm run start -- --port 3001` and change baseUrl

---

## Phase 1 — Scaffold, Store, Router, MUI

- [x] Scaffold the project inside this workspace:
  ```bash
  npm create vite@latest frontend -- --template react-ts
  cd frontend
  npm install
  ```
- [x] Install all dependencies in one shot:
  ```bash
  npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
  npm install @reduxjs/toolkit react-redux react-router-dom
  ```
- [x] Set up folder structure inside `src/`:
  ```
  src/
    store/          ← Redux store + RTK Query API slice
    features/       ← feature slices (auth, etc.)
    pages/          ← full page components (LoginPage, PropertiesPage)
    components/     ← reusable UI components
    hooks/          ← custom hooks (useAuth, etc.)
  ```
- [x] Create the Redux store at `src/store/store.ts`:

  ```ts
  import { configureStore } from '@reduxjs/toolkit'
  import { api } from './api'

  export const store = configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(api.middleware),
  })

  export type RootState = ReturnType<typeof store.getState>
  export type AppDispatch = typeof store.dispatch
  ```

- [x] Create the base RTK Query API at `src/store/api.ts`:

  ```ts
  import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

  export const api = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({
      baseUrl: 'http://localhost:3000', // change to 3001 for app-v2
      prepareHeaders: (headers) => {
        const token = localStorage.getItem('token')
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return headers
      },
    }),
    tagTypes: ['Property'],
    endpoints: () => ({}), // endpoints added per feature
  })
  ```

  - `prepareHeaders` is the programmatic equivalent of Swagger's "Authorize" button — it attaches the JWT to every request automatically
  - `tagTypes` is RTK Query's cache invalidation system — you'll use these in Phase 4

- [x] Wire up providers in `src/main.tsx`:

  ```tsx
  import { StrictMode } from 'react'
  import { createRoot } from 'react-dom/client'
  import { Provider } from 'react-redux'
  import { BrowserRouter } from 'react-router-dom'
  import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
  import { store } from './store/store'
  import App from './App'

  const theme = createTheme() // customize later

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    </StrictMode>,
  )
  ```

  - `Provider` = makes Redux store available to all components
  - `BrowserRouter` = enables React Router throughout the app
  - `ThemeProvider` + `CssBaseline` = MUI baseline styling

- [x] Test: `npm run dev` → confirm app loads at `http://localhost:5173` with no errors

---

## Phase 2 — Auth (Login Page + Token + Protected Routes)

- [x] Create the auth API endpoints at `src/features/auth/authApi.ts`:

  ```ts
  import { api } from '../../store/api'

  export interface LoginRequest {
    tenantId: number
    role: string
  }

  export interface LoginResponse {
    access_token: string
  }

  export const authApi = api.injectEndpoints({
    endpoints: (builder) => ({
      login: builder.mutation<LoginResponse, LoginRequest>({
        query: (credentials) => ({
          url: '/auth/login',
          method: 'POST',
          body: credentials,
        }),
      }),
    }),
  })

  export const { useLoginMutation } = authApi
  ```

  - `injectEndpoints` adds endpoints to the base API without creating a separate API instance — keeps one RTK Query cache for everything
  - `builder.mutation` = for POST/PATCH/DELETE (changes data). `builder.query` = for GET (reads data)

- [x] Create the auth slice at `src/features/auth/authSlice.ts`:

  ```ts
  import { createSlice, PayloadAction } from '@reduxjs/toolkit'

  interface AuthState {
    token: string | null
    tenantId: number | null
    role: string | null
  }

  const initialState: AuthState = {
    token: localStorage.getItem('token'),
    tenantId: null,
    role: null,
  }

  const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
      setCredentials(
        state,
        action: PayloadAction<{
          token: string
          tenantId: number
          role: string
        }>,
      ) {
        state.token = action.payload.token
        state.tenantId = action.payload.tenantId
        state.role = action.payload.role
        localStorage.setItem('token', action.payload.token)
      },
      logout(state) {
        state.token = null
        state.tenantId = null
        state.role = null
        localStorage.removeItem('token')
      },
    },
  })

  export const { setCredentials, logout } = authSlice.actions
  export default authSlice.reducer
  ```

- [x] Add `authReducer` to the store in `src/store/store.ts`:

  ```ts
  import authReducer from '../features/auth/authSlice';
  // add to reducer:
  auth: authReducer,
  ```

- [x] Create a `useAuth` hook at `src/hooks/useAuth.ts`:

  ```ts
  import { useSelector } from 'react-redux'
  import { RootState } from '../store/store'

  export const useAuth = () => {
    return useSelector((state: RootState) => state.auth)
  }
  ```

- [x] Build the Login page at `src/pages/LoginPage.tsx`:

  ```tsx
  import { useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useDispatch } from 'react-redux'
  import {
    Box,
    Button,
    MenuItem,
    Select,
    TextField,
    Typography,
    Paper,
  } from '@mui/material'
  import { useLoginMutation } from '../features/auth/authApi'
  import { setCredentials } from '../features/auth/authSlice'

  export default function LoginPage() {
    const [tenantId, setTenantId] = useState(1)
    const [role, setRole] = useState('admin')
    const [login, { isLoading, error }] = useLoginMutation()
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        const { access_token } = await login({ tenantId, role }).unwrap()
        dispatch(setCredentials({ token: access_token, tenantId, role }))
        navigate('/properties')
      } catch {
        // error shown via RTK Query error state
      }
    }

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <Paper sx={{ p: 4, width: 360 }}>
          <Typography variant="h5" mb={3}>
            Property API Login
          </Typography>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label="Tenant ID"
              type="number"
              value={tenantId}
              onChange={(e) => setTenantId(Number(e.target.value))}
              required
            />
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="tenantuser">TenantUser</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
            {error && (
              <Typography color="error">
                Login failed — check tenantId and role
              </Typography>
            )}
            <Button type="submit" variant="contained" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </Box>
        </Paper>
      </Box>
    )
  }
  ```

- [x] Create a `ProtectedRoute` component at `src/components/ProtectedRoute.tsx`:

  ```tsx
  import { Navigate } from 'react-router-dom'
  import { useAuth } from '../hooks/useAuth'

  export default function ProtectedRoute({
    children,
  }: {
    children: React.ReactNode
  }) {
    const { token } = useAuth()
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
  }
  ```

- [x] Set up routes in `src/App.tsx`:

  ```tsx
  import { Routes, Route, Navigate } from 'react-router-dom'
  import LoginPage from './pages/LoginPage'
  import PropertiesPage from './pages/PropertiesPage'
  import ProtectedRoute from './components/ProtectedRoute'

  export default function App() {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/properties"
          element={
            <ProtectedRoute>
              <PropertiesPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }
  ```

  - Create a placeholder `PropertiesPage.tsx` for now: `export default function PropertiesPage() { return <div>Properties</div>; }`

- [x] Test: login with `tenantId: 1, role: admin` → should redirect to `/properties`
- [x] Test: refresh the page → should stay on `/properties` (token persisted in localStorage)
- [x] Test: no token → navigating to `/properties` redirects to `/login`

---

## Phase 3 — Properties List (RTK Query GET)

- [ ] Create the properties API at `src/features/properties/propertiesApi.ts`:

  ```ts
  import { api } from '../../store/api'

  export interface Property {
    id: number
    tenantId: number
    name: string
    address: string
    city: string
    state: string
    createdAt: string
    updatedAt: string
  }

  export interface PropertiesMeta {
    total: number
    page: number
    limit: number
    totalPages: number
  }

  export interface PropertiesResponse {
    data: Property[]
    meta: PropertiesMeta
  }

  export interface PropertyFilters {
    page?: number
    limit?: number
    city?: string
    state?: string
    search?: string
  }

  export const propertiesApi = api.injectEndpoints({
    endpoints: (builder) => ({
      getProperties: builder.query<PropertiesResponse, PropertyFilters>({
        query: (params) => ({
          url: '/properties',
          params, // RTK Query serializes this as ?page=1&limit=10&city=Austin
        }),
        providesTags: ['Property'],
      }),
    }),
  })

  export const { useGetPropertiesQuery } = propertiesApi
  ```

  - `providesTags: ['Property']` marks this cache entry — when a mutation invalidates `'Property'`, this query re-fetches automatically

- [ ] Build the Properties page at `src/pages/PropertiesPage.tsx`:

  ```tsx
  import { useState } from 'react'
  import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    TextField,
    Button,
    Stack,
  } from '@mui/material'
  import { useGetPropertiesQuery } from '../features/properties/propertiesApi'
  import PropertyCard from '../components/PropertyCard'
  import { useDispatch } from 'react-redux'
  import { logout } from '../features/auth/authSlice'
  import { useNavigate } from 'react-router-dom'
  import { useAuth } from '../hooks/useAuth'

  export default function PropertiesPage() {
    const [page, setPage] = useState(1)
    const [city, setCity] = useState('')
    const [search, setSearch] = useState('')
    const { role } = useAuth()
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const { data, isLoading, error } = useGetPropertiesQuery({
      page,
      limit: 10,
      city: city || undefined,
      search: search || undefined,
    })

    const handleLogout = () => {
      dispatch(logout())
      navigate('/login')
    }

    if (isLoading) return <CircularProgress sx={{ m: 4 }} />
    if (error)
      return (
        <Alert severity="error" sx={{ m: 4 }}>
          Failed to load properties
        </Alert>
      )

    return (
      <Box sx={{ p: 4 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h4">Properties</Typography>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Role: {role}
            </Typography>
            <Button variant="outlined" onClick={handleLogout}>
              Logout
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" gap={2} mb={3}>
          <TextField
            label="Search by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            size="small"
          />
          <TextField
            label="Filter by city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              setPage(1)
            }}
            size="small"
          />
        </Stack>

        <Stack gap={2}>
          {data?.data.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </Stack>

        {data && (
          <Stack direction="row" gap={2} justifyContent="center" mt={3}>
            <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Typography sx={{ alignSelf: 'center' }}>
              Page {data.meta.page} of {data.meta.totalPages}
            </Typography>
            <Button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Stack>
        )}
      </Box>
    )
  }
  ```

- [ ] Create `src/components/PropertyCard.tsx`:

  ```tsx
  import { Card, CardContent, Typography } from '@mui/material'
  import { Property } from '../features/properties/propertiesApi'

  export default function PropertyCard({ property }: { property: Property }) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">{property.name}</Typography>
          <Typography color="text.secondary">
            {property.address}, {property.city}, {property.state}
          </Typography>
        </CardContent>
      </Card>
    )
  }
  ```

- [ ] Test: login → properties list appears with your backend data
- [ ] Test: type in search box → list filters
- [ ] Test: type in city box → list filters by city
- [ ] Test: pagination buttons → page changes, different results

---

## Phase 4 — CRUD (Create, Edit, Delete)

- [ ] Add mutations to `propertiesApi.ts`:

  ```ts
  export interface CreatePropertyRequest {
    name: string;
    address: string;
    city: string;
    state: string;
  }

  // inside endpoints:
  createProperty: builder.mutation<Property, CreatePropertyRequest>({
    query: (body) => ({ url: '/properties', method: 'POST', body }),
    invalidatesTags: ['Property'],   // triggers getProperties to re-fetch
  }),
  updateProperty: builder.mutation<Property, { id: number } & Partial<CreatePropertyRequest>>({
    query: ({ id, ...body }) => ({ url: `/properties/${id}`, method: 'PATCH', body }),
    invalidatesTags: ['Property'],
  }),
  deleteProperty: builder.mutation<Property, number>({
    query: (id) => ({ url: `/properties/${id}`, method: 'DELETE' }),
    invalidatesTags: ['Property'],
  }),
  ```

  - `invalidatesTags: ['Property']` is RTK Query's cache invalidation — any query tagged `'Property'` (your getProperties) will automatically re-fetch after this mutation succeeds. This is the frontend equivalent of `cacheManager.clear()` on the backend

- [ ] Create `src/components/PropertyForm.tsx` (used for both create and edit):

  ```tsx
  import { useState } from 'react'
  import { Box, Button, TextField, Stack } from '@mui/material'
  import { CreatePropertyRequest } from '../features/properties/propertiesApi'

  interface Props {
    initialValues?: CreatePropertyRequest
    onSubmit: (values: CreatePropertyRequest) => void
    isLoading: boolean
    submitLabel?: string
  }

  export default function PropertyForm({
    initialValues,
    onSubmit,
    isLoading,
    submitLabel = 'Submit',
  }: Props) {
    const [values, setValues] = useState<CreatePropertyRequest>(
      initialValues ?? { name: '', address: '', city: '', state: '' },
    )

    const handleChange =
      (field: keyof CreatePropertyRequest) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setValues((prev) => ({ ...prev, [field]: e.target.value }))
      }

    return (
      <Stack
        gap={2}
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(values)
        }}
      >
        <TextField
          label="Name"
          value={values.name}
          onChange={handleChange('name')}
          required
        />
        <TextField
          label="Address"
          value={values.address}
          onChange={handleChange('address')}
          required
        />
        <TextField
          label="City"
          value={values.city}
          onChange={handleChange('city')}
          required
        />
        <TextField
          label="State (2 letters)"
          value={values.state}
          onChange={handleChange('state')}
          inputProps={{ maxLength: 2 }}
          required
        />
        <Button type="submit" variant="contained" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitLabel}
        </Button>
      </Stack>
    )
  }
  ```

- [ ] Add Create button + dialog to `PropertiesPage.tsx` — opens a MUI `Dialog` containing `PropertyForm`, calls `useCreatePropertyMutation`
- [ ] Add Edit + Delete buttons to `PropertyCard.tsx` — Edit opens a dialog pre-filled with current values, Delete calls `useDeletePropertyMutation` after a confirm dialog
- [ ] Test: create a property → list updates automatically (no manual refresh)
- [ ] Test: edit a property → list updates
- [ ] Test: delete a property → list updates

---

## Phase 5 — Role-Based UI

The backend enforces RBAC — the frontend should reflect it visually. A viewer shouldn't
see a Delete button they can't use.

- [ ] Expose `role` from `useAuth()` — it's already in the auth slice from Phase 2
- [ ] Hide Delete button for non-admin users in `PropertyCard.tsx`:
  ```tsx
  const { role } = useAuth()
  // only render delete button if admin
  {
    role === 'admin' && (
      <IconButton onClick={handleDelete} color="error">
        <DeleteIcon />
      </IconButton>
    )
  }
  ```
- [ ] Hide Create button for viewers in `PropertiesPage.tsx`:
  ```tsx
  {
    role !== 'viewer' && (
      <Button onClick={() => setOpenCreate(true)}>Add Property</Button>
    )
  }
  ```
- [ ] Test: login as `role: viewer` → no create or delete buttons visible
- [ ] Test: login as `role: admin` → all buttons visible
- [ ] Test: viewer trying to delete via the API directly (curl) still gets 403 — frontend hiding is UX only, backend enforces the real rule

---

## Connecting to app vs app-v2

The ONLY thing that changes when switching backends is the `baseUrl` in `src/store/api.ts`.

To run both backends simultaneously on different ports:

- `app`: `npm run start:dev` (port 3000, default)
- `app-v2`: in `app-v2/src/main.ts` change `process.env.PORT ?? 3000` to `process.env.PORT ?? 3001`, then `npm run start:dev`

Then in the frontend `api.ts`:

```ts
baseUrl: 'http://localhost:3000' // hits app (v1)
baseUrl: 'http://localhost:3001' // hits app-v2
```

Or use a Vite env var so you can switch without editing code:

- `frontend/.env` → `VITE_API_URL=http://localhost:3000`
- In `api.ts` → `baseUrl: import.meta.env.VITE_API_URL`
- Switch backends by changing the `.env` file and restarting Vite

---

## CORS

When the browser (`:5173`) calls the backend (`:3000`), you'll get a CORS error.
Add this to your backend `main.ts` (both app and app-v2):

```ts
app.enableCors({ origin: 'http://localhost:5173' })
```

This must be in the backend — CORS permission is granted by the server, not the client.

---

## Gotchas to Remember

| Mistake                                            | Fix                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | --- | ------------------------------------------------------ |
| `builder.query` for a POST                         | Use `builder.mutation` for anything that changes data                                 |
| `providesTags` missing on query                    | Mutations can't invalidate what's not tagged — add `providesTags: ['X']` to queries   |
| `invalidatesTags` missing on mutation              | List won't re-fetch after create/update/delete — add `invalidatesTags: ['X']`         |
| Forgot `prepareHeaders`                            | All protected routes return 401 — every request needs `Authorization: Bearer <token>` |
| CORS error in browser                              | Add `app.enableCors()` to the NestJS backend `main.ts`                                |
| Token not persisting on refresh                    | Store in `localStorage` and read it in `authSlice` initialState                       |
| Frontend hides button but API still accessible     | Frontend is UX only — backend guards enforce real rules. Both must exist              |
| `params` with undefined values sent as "undefined" | Pass `city: city                                                                      |     | undefined`— RTK Query omits keys with`undefined` value |
| `useGetPropertiesQuery` re-fetches on every render | Only re-fetches when args change — RTK Query caches by serialized args                |
