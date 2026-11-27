import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../shared/components/Layout";
import { Empty, Spinner } from "../shared/components/ui";
import { LoginPage } from "../features/auth/LoginPage";
import { RequireAdmin, RequireAuth } from "../features/auth/RequireAuth";
import { BoardPage } from "../features/patients/BoardPage";
import { configError } from "../infrastructure/supabase/supabase";
import { SetPasswordPage } from "../features/auth/SetPasswordPage";
const ClinicalDashboardPage = lazy(() => import("../features/dashboard/ClinicalDashboardPage"));
const DischargedPage = lazy(() =>
  import("../features/patients/DischargedPage").then((m) => ({
    default: m.DischargedPage,
  })),
);

const PatientDetailPage = lazy(() =>
  import("../features/patients/PatientDetailPage").then((m) => ({
    default: m.PatientDetailPage,
  })),
);

// Screens used less often load only when opened, so the first screen appears faster on a phone.
const TeamPage = lazy(() =>
  import("../features/admin/TeamPage").then((m) => ({ default: m.TeamPage })),
);
const PatientFormPage = lazy(() =>
  import("../features/patients/PatientFormPage").then((m) => ({
    default: m.PatientFormPage,
  })),
);
const ProfilePage = lazy(() =>
  import("../features/profile/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);
const RoundFormPage = lazy(() =>
  import("../features/rounds/RoundFormPage").then((m) => ({
    default: m.RoundFormPage,
  })),
);
const ShiftsPage = lazy(() =>
  import("../features/shifts/ShiftsPage").then((m) => ({
    default: m.ShiftsPage,
  })),
);
const DeletedPage = lazy(() =>
  import("../features/admin/DeletedPage").then((m) => ({
    default: m.DeletedPage,
  })),
);

function ConfigProblem() {
  return (
    <main className="stack">
      <h1>Setup needed</h1>
      <div className="error-box" role="alert">
        {configError}
      </div>
    </main>
  );
}

export default function App() {
  if (configError) return <ConfigProblem />;
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<BoardPage />} />
            <Route path="dashboard" element={<ClinicalDashboardPage />} />
            <Route
              path="rounds"
              element={<BoardPage key="rounds" mode="rounds" />}
            />
            <Route path="discharged" element={<DischargedPage />} />
            <Route path="patients/new" element={<PatientFormPage />} />
            <Route path="patients/:id" element={<PatientDetailPage />} />
            <Route path="patients/:id/edit" element={<PatientFormPage />} />
            <Route path="patients/:id/round" element={<RoundFormPage />} />
            <Route
              path="team"
              element={
                <RequireAdmin>
                  <TeamPage />
                </RequireAdmin>
              }
            />
            <Route
              path="export"
              element={
                <RequireAdmin>
                  <Navigate to="/team?tab=exports" replace />
                </RequireAdmin>
              }
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="shifts" element={<ShiftsPage />} />
            <Route
              path="*"
              element={
                <Empty title="Page not found">
                  <Link to="/">Back to patients</Link>
                </Empty>
              }
            />
            <Route
              path="deleted"
              element={
                <RequireAdmin>
                  <DeletedPage />
                </RequireAdmin>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
