import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES = ['nurse', 'resident', 'consultant', 'admin']
const ADMIN_ROLE = 'admin'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Who is calling?
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user }, error: userErr } = await caller.auth.getUser()
  if (userErr || !user) return json({ error: 'You are not signed in' }, 401)

  // 2. Are they an active administrator? (checked on the server, so it can't be faked)
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: me } = await admin.from('profiles').select('role, active').eq('id', user.id).maybeSingle()
  if (!me || me.role !== ADMIN_ROLE || me.active === false) {
    return json({ error: 'Only administrators can invite users' }, 403)
  }

  // 3. Validate the request
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.full_name ?? '').trim()
  const role = String(body.role ?? '')
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address' }, 400)
  if (!fullName) return json({ error: 'Enter the full name' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Choose a valid role' }, 400)

  // 4. Send the invite
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  })
  if (error) return json({ error: error.message }, 400)

  // 5. Create or update their profile with the chosen role, already approved
  const { error: pErr } = await admin.from('profiles').upsert({
    id: data.user.id,
    full_name: fullName,
    role,
    active: true,
  })
  if (pErr) return json({ error: `The invite was sent, but the profile was not saved: ${pErr.message}` }, 500)

  return json({ ok: true })
})