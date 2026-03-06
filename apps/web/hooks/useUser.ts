'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { UserDTO } from '@spotttrack/shared'

export function useUser() {
  return useQuery<UserDTO>({
    queryKey: ['user', 'me'],
    queryFn: () => apiFetch<UserDTO>('/api/auth/me'),
    retry: false,
  })
}
