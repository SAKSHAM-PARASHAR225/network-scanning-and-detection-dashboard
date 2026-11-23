import { useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { MobileNavDrawer } from './components/layout/MobileNavDrawer'
import { AnalyticsPage } from './pages/Analytics'
import { AlertsPage } from './pages/Alerts'
import { Dashboard } from './pages/Dashboard'
import { LiveRadarPage } from './pages/LiveRadar'
import { SignalTrendsPage } from './pages/SignalTrends'
import { NetworksPage } from './pages/Networks'
import { ScanHistoryPage } from './pages/ScanHistory'
import { SettingsPage } from './pages/Settings'
import { LoginPage } from './pages/Login'
import { AuthenticationPage } from './pages/Authentication'
import { WirelessMonitoringProvider, useWirelessMonitoring } from './hooks/useWirelessMonitoring'
import { AppSettingsProvider } from './hooks/useAppSettings'
import { LiveSignalProvider } from './hooks/useLiveSignal'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { ConnectionBanner } from './components/layout/ConnectionBanner'
import { SetupScreen } from './components/setup/SetupScreen'

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Overview', subtitle: 'Real-time wireless security posture and activity' },
  '/networks': { title: 'Networks', subtitle: 'Nearby access point inventory and radio review' },
  '/radar': { title: 'Live Radar', subtitle: 'Real-time visualization of every network in range' },
  '/signals': { title: 'Signal Trends', subtitle: 'Live signal strength history for every network in range' },
  '/alerts': { title: 'Security Alerts', subtitle: 'Active threat monitoring and investigation queue' },
  '/history': { title: 'Scan History', subtitle: 'Recent wireless monitoring cycles and outcomes' },
  '/analytics': { title: 'Analytics', subtitle: 'Historical trends, signal quality, and detections' },
  '/settings': { title: 'Settings', subtitle: 'Monitoring thresholds and operational preferences' },
}

function DashboardShell() {
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { connectionStatus, restReachable, setupRequired } = useWirelessMonitoring()
  const meta = pageMeta[location.pathname] ?? pageMeta['/']

  // Only take over the whole screen once the backend has actually confirmed
  // setup is required — while still connecting/offline, fall through to the
  // normal shell so its own offline states can show instead.
  if (setupRequired && restReachable && connectionStatus === 'connected') {
    return <SetupScreen />
  }

  return (
    <div
      className="block min-h-screen text-slate-100 lg:grid"
      style={{ gridTemplateColumns: sidebarCollapsed ? '72px minmax(0, 1fr)' : '240px minmax(0, 1fr)' }}
    >
      <div className="hidden lg:contents">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      </div>
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-col overflow-hidden transition-all duration-200">
        <Header title={meta.title} subtitle={meta.subtitle} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <ConnectionBanner />

        <main className="min-h-[calc(100vh-4.5rem)] flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/networks" element={<NetworksPage />} />
            <Route path="/radar" element={<LiveRadarPage />} />
            <Route path="/signals" element={<SignalTrendsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/history" element={<ScanHistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

/** The monitoring socket only connects once the user is past the login gate. */
function ProtectedApp() {
  return (
    <AppSettingsProvider>
      <WirelessMonitoringProvider>
        <LiveSignalProvider>
          <DashboardShell />
        </LiveSignalProvider>
      </WirelessMonitoringProvider>
    </AppSettingsProvider>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/authenticating" element={<AuthenticationPage />} />
      <Route
        path="/*"
        element={(
          <RequireAuth>
            <ProtectedApp />
          </RequireAuth>
        )}
      />
    </Routes>
  )
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
