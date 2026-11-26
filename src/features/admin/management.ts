import { supabase } from '../../lib/supabase'
import { useQuery } from '@tanstack/react-query'
export { useWards } from '../patients/hooks'
export async function allRows<T>(read: (from:number,to:number)=>PromiseLike<{data: unknown;error: {message:string}|null}>): Promise<T[]> {
 const rows:T[]=[]; for(let i=0;;i+=500){const {data,error}=await read(i,i+499); if(error) throw new Error(error.message); const batch=(data??[]) as T[]; rows.push(...batch); if(batch.length<500)return rows}
}
export const useWardCounts = () => useQuery({queryKey:['ward-counts'],queryFn:()=>allRows<{ward:string;status:string}>((a,b)=>supabase.from('patients').select('ward,status').is('deleted_at',null).order('id').range(a,b))})

