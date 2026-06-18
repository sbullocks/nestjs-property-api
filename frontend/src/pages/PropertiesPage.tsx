import { useState } from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material'
import {
  useGetPropertiesQuery,
  useCreatePropertyMutation,
  type CreatePropertyRequest,
} from '../features/properties/propertiesApi'
import PropertyCard from '../components/PropertyCard'
import PropertyForm from '../components/PropertyForm'
import { useDispatch } from 'react-redux'
import { logout } from '../features/auth/authSlice'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function PropertiesPage() {
  const [page, setPage] = useState(1)
  const [city, setCity] = useState('')
  const [search, setSearch] = useState('')
  const [openCreate, setOpenCreate] = useState(false)
  const { role } = useAuth()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { data, isLoading, error } = useGetPropertiesQuery({
    page,
    limit: 10,
    city: city || undefined,
    search: search || undefined,
  })

  const [createProperty, { isLoading: isCreating }] = useCreatePropertyMutation()

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const handleCreate = async (values: CreatePropertyRequest) => {
    await createProperty(values)
    setOpenCreate(false)
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
          <Button variant="contained" onClick={() => setOpenCreate(true)}>
            Add Property
          </Button>
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

      {/* Create Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Property</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <PropertyForm
              onSubmit={handleCreate}
              isLoading={isCreating}
              submitLabel="Create"
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
