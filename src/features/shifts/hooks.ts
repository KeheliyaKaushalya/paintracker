import { useQuery } from '@tanstack/react-query'
import { fetchShiftAssignments, fetchShiftTemplates } from './api'

export const useShiftTemplates = (includeInactive = false) =>
  useQuery({ queryKey: ['shifts', 'templates', includeInactive], queryFn: () => fetchShiftTemplates(includeInactive) })

export const useShiftAssignments = (from: string, to: string) =>
  useQuery({ queryKey: ['shifts', 'assignments', from, to], queryFn: () => fetchShiftAssignments(from, to) })