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
