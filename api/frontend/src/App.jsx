import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell.jsx'
import { RouteFocus } from './components/RouteFocus.jsx'
import { LoadingPanel } from './components/ui/LoadingPanel.jsx'
import { useAuth } from './hooks/useAuth.js'
import { AdminUsersPage } from './pages/AdminUsersPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { FileDetailsPage } from './pages/FileDetailsPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { SharePage } from './pages/SharePage.jsx'

function RequireAuth({ currentUser, authChecked, children }) {
  const location = useLocation()
  if (!authChecked) return <LoadingPanel />
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function RequireAdmin({ currentUser, authChecked, children }) {
  if (!authChecked) return <LoadingPanel />
  if (!currentUser) return <Navigate to="/login" replace />
  if (!currentUser.is_admin) return <Navigate to="/" replace />
  return children
}

function AuthedShell({ currentUser, setCurrentUser, children }) {
  return <AppShell currentUser={currentUser} setCurrentUser={setCurrentUser}>{children}</AppShell>
}

export default function App() {
  const { currentUser, setCurrentUser, authChecked } = useAuth()

  return (
    <>
      <RouteFocus />
      <Routes>
        <Route path="/share/:publicToken" element={<SharePage />} />
        <Route path="/login" element={<LoginPage currentUser={currentUser} setCurrentUser={setCurrentUser} authChecked={authChecked} />} />
        <Route path="/" element={<RequireAuth currentUser={currentUser} authChecked={authChecked}><AuthedShell currentUser={currentUser} setCurrentUser={setCurrentUser}><DashboardPage /></AuthedShell></RequireAuth>} />
        <Route path="/file/:sha256" element={<RequireAuth currentUser={currentUser} authChecked={authChecked}><AuthedShell currentUser={currentUser} setCurrentUser={setCurrentUser}><FileDetailsPage /></AuthedShell></RequireAuth>} />
        <Route path="/admin/panel" element={<RequireAdmin currentUser={currentUser} authChecked={authChecked}><AuthedShell currentUser={currentUser} setCurrentUser={setCurrentUser}><AdminUsersPage /></AuthedShell></RequireAdmin>} />
        <Route path="*" element={<Navigate to={currentUser ? '/' : '/login'} replace />} />
      </Routes>
    </>
  )
}
