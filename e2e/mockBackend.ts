import type { Page, Route } from '@playwright/test'

/**
 * A tiny pretend Supabase for the tests. It understands only the requests this app makes.
 * It is NOT a security test (the real rules live in supabase/tests/rls_test.sql).
 */
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MockState {
  role: 'nurse' | 'admin'
  active: boolean
  password: string
  offline: boolean
  patients: Row[]
  meds: Row[]
  alerts: Row[]
  rounds: Row[]
  profiles: Row[]
  requests: { method: string; path: string; body?: unknown }[]
}

export const ME = '11111111-1111-4111-8111-111111111111'
export const NURSE2 = '22222222-2222-4222-8222-222222222222'
export const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
export const P2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const patientDefaults: Row = {
  age: null, sex: null, category_note: null, surgery: null, indication: null, surgery_date: null, surgery_time: null,
  anaesthesia_mode: null, has_epidural: false, ep_level: null, ep_inserted_date: null, ep_inserted_time: null, ep_test_dose: null,
  has_nerve_catheter: false, nv_type: null, nv_inserted_date: null, nv_inserted_time: null, has_pca: false, pca_drug: null,
  pca_bolus: null, pca_lockout: null, pca_max_hr: null, status: 'active', discharged_date: null, category: 'Surgery',
  created_by: ME, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}
const roundDefaults: Row = {
  round_time: null, session: null, pain_rest: null, pain_move: null, rr: null, spo2: null, hr: null, bp_sys: null, bp_dia: null,
  gcs: null, mobilization: null, tags: [], note: null, amended_of: null, created_by: ME,
}

export function freshState(): MockState {
  return {
    role: 'nurse', active: true, password: 'correct-horse', offline: false,
    profiles: [
      { id: ME, full_name: 'Dr. Test User', role: 'nurse', active: true, created_at: new Date().toISOString() },
      { id: NURSE2, full_name: 'Nurse Pending', role: 'nurse', active: false, created_at: new Date().toISOString() },
    ],
    patients: [
      { ...patientDefaults, id: P1, bht: 'DEMO/0001', full_name: 'Demo Patient One', age: 61, sex: 'M', ward: '7A', surgery: 'Hernia repair',
        surgery_date: daysAgo(3), anaesthesia_mode: 'GA', has_epidural: true, ep_level: 'T11-T12' },
      { ...patientDefaults, id: P2, bht: 'DEMO/0002', full_name: 'Demo Patient Two', age: 47, sex: 'F', ward: '23B', surgery: 'Shoulder arthroscopy', surgery_date: daysAgo(1) },
    ],
    meds: [
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', patient_id: P1, sort_order: 0, drug: 'Paracetamol', route: 'IV', dose: '1 g', freq: 'Every 6h', freq_custom: null, dosing: 'single', topup: null },
    ],
    alerts: [
      { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', patient_id: P1, alert_text: 'Keep catheter until reviewed', created_by: ME, created_at: new Date().toISOString() },
    ],
    rounds: [
      { ...roundDefaults, id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', patient_id: P1, kind: 'pain', round_date: daysAgo(2), round_time: '08:00:00', session: 'Morning', pain_rest: 2, pain_move: 5, created_at: '2026-01-01T01:00:00Z' },
      { ...roundDefaults, id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', patient_id: P1, kind: 'pain', round_date: daysAgo(1), round_time: '08:00:00', session: 'Morning', pain_rest: 3, pain_move: 4, tags: ['Urgent review'], note: 'Top-up considered', created_at: '2026-01-02T01:00:00Z' },
    ],
    requests: [],
  }
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, role: 'authenticated', exp: 4_102_444_800 })}.mock`
const user = (email: string) => ({ id: ME, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })

export async function installMockBackend(page: Page, state: MockState) {
  await page.routeWebSocket(/\/realtime\//, () => { /* realtime is not simulated */ })

  await page.route(/mock\.supabase\.test/, async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*',
      'access-control-expose-headers': '*',
    }
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })
    const empty = (status: number) => route.fulfill({ status, headers: cors, body: '' })

    if (req.method() === 'OPTIONS') return empty(204)
    if (state.offline) return route.abort('internetdisconnected')

    let body: any = undefined // eslint-disable-line @typescript-eslint/no-explicit-any
    try { body = req.postDataJSON() } catch { /* no body */ }
    state.requests.push({ method: req.method(), path: url.pathname, body })

    // ----- auth -----
    if (url.pathname === '/auth/v1/token') {
      if (body?.password !== state.password) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return json(200, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock-refresh', user: user(body.email ?? 'test@example.com') })
    }
    if (url.pathname === '/auth/v1/user') {
      if (req.method() === 'PUT' && body?.password) state.password = body.password
      return json(200, user('test@example.com'))
    }
    if (url.pathname === '/auth/v1/logout') return empty(204)

    // ----- rest -----
    const table = url.pathname.replace('/rest/v1/', '')
    const tables: Record<string, Row[]> = { profiles: state.profiles, patients: state.patients, patient_meds: state.meds, patient_alerts: state.alerts, rounds: state.rounds }
    const rows = tables[table]
    if (!rows) return json(404, { code: 'PGRST205', message: `unknown table ${table}` })

    const filters: [string, string][] = []
    for (const [k, v] of url.searchParams) if (!['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) filters.push([k, v])
    const matches = (r: Row) => filters.every(([k, v]) => {
      if (v.startsWith('eq.')) return String(r[k]) === v.slice(3)
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(r[k]))
      throw new Error(`mock: unsupported filter ${k}=${v}`)
    })

    if (req.method() === 'GET') {
      const select = url.searchParams.get('select') ?? '*'
      let out = rows.filter(matches).map((r) => ({ ...r }))
      if (table === 'patients') {
        out = out.map((p) => ({
          ...p,
          ...(select.includes('patient_meds') ? { patient_meds: state.meds.filter((m) => m.patient_id === p.id) } : {}),
          ...(select.includes('patient_alerts') ? { patient_alerts: state.alerts.filter((a) => a.patient_id === p.id) } : {}),
        }))
      }
      return json(200, out)
    }

    if (req.method() === 'POST') {
      const items: Row[] = Array.isArray(body) ? body : [body]
      const merge = (req.headers()['prefer'] ?? '').includes('merge-duplicates')
      for (const it of items) {
        const existing = rows.find((r) => r.id === it.id)
        if (existing && merge) { Object.assign(existing, it); continue }
        if (existing) return json(409, { code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"`, details: '' })
        if (table === 'patients') {
          if (rows.some((r) => r.bht === it.bht)) return json(409, { code: '23505', message: 'duplicate key value violates unique constraint "patients_bht_unique"', details: `Key (bht)=(${it.bht}) already exists.` })
          rows.push({ ...patientDefaults, ...it, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        } else if (table === 'rounds') {
          rows.push({ ...roundDefaults, ...it, created_at: new Date().toISOString() })
        } else if (table === 'patient_alerts') {
          rows.push({ ...it, id: it.id ?? crypto.randomUUID(), created_at: new Date().toISOString() })
        } else {
          rows.push({ ...it, id: it.id ?? crypto.randomUUID() })
        }
      }
      return empty(201)
    }
    if (req.method() === 'PATCH') {
      rows.filter(matches).forEach((r) => Object.assign(r, body))
      return empty(204)
    }
    if (req.method() === 'DELETE') {
      const keep = rows.filter((r) => !matches(r))
      rows.length = 0
      rows.push(...keep)
      return empty(204)
    }
    return json(405, { message: 'mock: method not supported' })
  })
}
