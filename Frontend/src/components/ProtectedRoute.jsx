import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth';

function ProtectedRoute({ children, requireRole }) {
  // Not logged in at all → kick to login
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Logged in, but wrong role → kick back to login (could also show an "Access Denied" page)
  if (requireRole && getUserRole() !== requireRole) {
    return <Navigate to="/login" replace />;
  }

  // All good — render the protected page
  return children;
}

export default ProtectedRoute;