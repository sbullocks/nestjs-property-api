import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

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
      action: PayloadAction<{ token: string; tenantId: number; role: string }>,
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
