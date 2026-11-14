import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';
import DailyPage from './pages/DailyPage';
import MasterPage from './pages/MasterPage';
import AppLayout from './components/AppLayout';
import PageTransition, { PageTransitionProvider, usePageTransitionLocation } from './components/PageTransition';
import { DialogProvider } from './contexts/DialogContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { token } = useAuth();
  const { displayLocation, stage } = usePageTransitionLocation();
  return (
    <PageTransitionProvider stage={stage} pathname={displayLocation.pathname}>
    <Routes location={displayLocation}>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <PageTransition><LoginPage /></PageTransition>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/master" element={<MasterPage />} />
        <Route path="/daily" element={<DailyPage />} />
      </Route>
      <Route path="/board/:id" element={<ProtectedRoute><PageTransition><BoardPage /></PageTransition></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </PageTransitionProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DialogProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DialogProvider>
    </AuthProvider>
  );
}
