import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchMedChanges, fetchPatient, fetchPatients, fetchProfiles, fetchWards } from './api'

export const usePatients = (status: 'active' | 'discharged') =>
  useQuery({ queryKey: ['patients', status], queryFn: () => fetchPatients(status) })

export const usePatient = (id: string | undefined) =>
  useQuery({ queryKey: ['patient', id], queryFn: () => fetchPatient(id!), enabled: !!id })

export const useProfiles = () => useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles })

export const useWards = () => useQuery({ queryKey: ['wards'], queryFn: fetchWards })

/** id -> name, so "recorded by" can show who. */
export function useNameLookup(): (id: string) => string {
  const { data } = useProfiles()
  const map = useMemo(() => new Map((data ?? []).map((p) => [p.id, p.full_name || 'Unnamed user'])), [data])
  return (id: string) => map.get(id) ?? 'Unknown'
}

export const useMedChanges = (patientId: string) =>
  useQuery({ queryKey: ['med-changes', patientId], queryFn: () => fetchMedChanges(patientId) })
