import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TimerProvider } from "@/contexts/TimerContext";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import CalendarPage from "@/pages/Calendar";
import Tasks from "@/pages/Tasks";
import Timesheets from "@/pages/Timesheets";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Team from "@/pages/Team";
import Clients from "@/pages/Clients";
import { Marketing, Sales, Company, Financials } from "@/pages/Placeholders";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import PublicProject from "@/pages/PublicProject";
import { Toaster } from "sonner";

function HomeRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="h-screen flex items-center justify-center text-sm text-[var(--text-tertiary)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "client" ? "/projects" : "/calendar"} replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <TimerProvider user={user}>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/public/projects/:token" element={<PublicProject />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/calendar"   element={<ProtectedRoute tab="calendar"><CalendarPage /></ProtectedRoute>} />
          <Route path="/tasks"      element={<ProtectedRoute tab="tasks"><Tasks /></ProtectedRoute>} />
          <Route path="/timesheets" element={<ProtectedRoute tab="timesheets"><Timesheets /></ProtectedRoute>} />
          <Route path="/projects"   element={<ProtectedRoute tab="projects"><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute tab="projects"><ProjectDetail /></ProtectedRoute>} />
          <Route path="/team"       element={<ProtectedRoute tab="team"><Team /></ProtectedRoute>} />
          <Route path="/clients"    element={<ProtectedRoute tab="clients"><Clients /></ProtectedRoute>} />
          <Route path="/marketing"  element={<ProtectedRoute tab="marketing"><Marketing /></ProtectedRoute>} />
          <Route path="/sales"      element={<ProtectedRoute tab="sales"><Sales /></ProtectedRoute>} />
          <Route path="/company"    element={<ProtectedRoute tab="company"><Company /></ProtectedRoute>} />
          <Route path="/dashboard"  element={<ProtectedRoute tab="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="/financials" element={<ProtectedRoute tab="financials"><Financials /></ProtectedRoute>} />
          <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </TimerProvider>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
