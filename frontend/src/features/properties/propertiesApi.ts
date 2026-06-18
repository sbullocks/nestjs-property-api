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

export interface CreatePropertyRequest {
  name: string
  address: string
  city: string
  state: string
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
    createProperty: builder.mutation<Property, CreatePropertyRequest>({
      query: (body) => ({ url: '/properties', method: 'POST', body }),
      invalidatesTags: ['Property'], // triggers getProperties to re-fetch
    }),
    updateProperty: builder.mutation<
      Property,
      { id: number } & Partial<CreatePropertyRequest>
    >({
      query: ({ id, ...body }) => ({
        url: `/properties/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Property'],
    }),
    deleteProperty: builder.mutation<Property, number>({
      query: (id) => ({ url: `/properties/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Property'],
    }),
  }),
})

export const {
  useGetPropertiesQuery,
  useCreatePropertyMutation,
  useUpdatePropertyMutation,
  useDeletePropertyMutation,
} = propertiesApi
