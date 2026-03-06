'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { NotificationDTO } from '@spotttrack/shared'

export function useNotifications() {
  return useQuery<{ notifications: NotificationDTO[] }>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/api/notifications'),
    staleTime: 60_000,
  })
}
