import { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Box,
} from '@mui/material'
import {
  type Property,
  type CreatePropertyRequest,
  useUpdatePropertyMutation,
  useDeletePropertyMutation,
} from '../features/properties/propertiesApi'
import PropertyForm from './PropertyForm'
import { useAuth } from '../hooks/useAuth'

export default function PropertyCard({ property }: { property: Property }) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)

  const { role } = useAuth()

  const [updateProperty, { isLoading: isUpdating }] =
    useUpdatePropertyMutation()
  const [deleteProperty] = useDeletePropertyMutation()

  const handleEdit = async (values: CreatePropertyRequest) => {
    await updateProperty({ id: property.id, ...values })
    setOpenEdit(false)
  }

  const handleDelete = async () => {
    await deleteProperty(property.id)
    setOpenDelete(false)
  }

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6">{property.name}</Typography>
          <Typography color="text.secondary">
            {property.address}, {property.city}, {property.state}
          </Typography>
        </CardContent>
        <CardActions>
          <Button size="small" onClick={() => setOpenEdit(true)}>
            Edit
          </Button>
          {role === 'admin' && (
            <Button size="small" color="error" onClick={() => setOpenDelete(true)}>
              Delete
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Property</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <PropertyForm
              initialValues={{
                name: property.name,
                address: property.address,
                city: property.city,
                state: property.state,
              }}
              onSubmit={handleEdit}
              isLoading={isUpdating}
              submitLabel="Save Changes"
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>Delete Property</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{property.name}"? This cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
