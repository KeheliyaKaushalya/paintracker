import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Empty, Spinner } from './components/ui'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAdmin, RequireAuth } from './features/auth/RequireAuth'
import { BoardPage } from './features/patients/BoardPage'
import { DischargedPage } from './features/patients/DischargedPage'
import { PatientDetailPage } from './features/patients/PatientDetailPage'
import { configError } from './lib/supabase'

// Screens used less often load only when opened, so the first screen appears faster on a phone.
const TeamPage = lazy(() => import('./features/admin/TeamPage').then((m) => ({ default: m.TeamPage })))
const PatientFormPage = lazy(() => import('./features/patients/PatientFormPage').then((m) => ({ default: m.PatientFormPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const RoundFormPage = lazy(() => import('./features/rounds/RoundFormPage').then((m) => ({ default: m.RoundFormPage })))

function ConfigProblem() {
  return (
    <main className="stack">
      <h1>Setup needed</h1>
      <div className="error-box" role="alert">{configError}</div>
    </main>
  )
}

export default function App() {
  if (configError) return <ConfigProblem />
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<BoardPage />} />
          <Route path="discharged" element={<DischargedPage />} />
          <Route path="patients/new" element={<PatientFormPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="patients/:id/edit" element={<PatientFormPage />} />
          <Route path="patients/:id/round" element={<RoundFormPage />} />
          <Route path="team" element={<RequireAdmin><TeamPage /></RequireAdmin>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Empty title="Page not found"><Link to="/">Back to the board</Link></Empty>} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}
