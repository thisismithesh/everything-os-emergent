import { Navigate } from "react-router-dom";
import { useAuth, canSee } from "@/contexts/AuthContext";

function Loader() {
  return (
    <div className="h-screen w-full flex items-center justify-center text-[var(--text-tertiary)] text-sm">
      Loading…
    </div>
  );
}

export default function ProtectedRoute({ children, tab }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (tab && !canSee(tab, user.role)) {
    // Redirect to first accessible page based on role
    const fallback = user.role === "client" ? "/projects" : "/calendar";
    return <Navigate to={fallback} replace />;
  }
  return children;
}
