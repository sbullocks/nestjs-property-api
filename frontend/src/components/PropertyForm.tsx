import { useState } from 'react'
import { Button, TextField, Stack } from '@mui/material'
import { type CreatePropertyRequest } from '../features/properties/propertiesApi'

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
