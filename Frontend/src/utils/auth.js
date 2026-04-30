

const TOKEN_KEY = 'token';
const USER_KEY = 'user';


export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};


export const getUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Could not parse user from localStorage:', err);
    return null;
  }
};


export const isAuthenticated = () => {
  return Boolean(getToken() && getUser());
};

/**
 * Returns the role of the logged-in user ('client', 'owner'), or null.
 */
export const getUserRole = () => {
  const user = getUser();
  return user ? user.role : null;
};

/**
 * Stores the JWT and user info in localStorage.
 * Called by the login page after a successful response.
 */
export const setAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Clears all auth data and (optionally) tells the backend.
 * The backend logout call is fire-and-forget — even if it fails,
 * we still clear local state.
 */
export const logout = async () => {
  const token = getToken();

  // Try to notify the backend (optional — JWTs are stateless)
  if (token) {
    try {
      await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      // Network error — fine, we still clear local state
      console.warn('Logout request failed (continuing anyway):', err);
    }
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Builds an Authorization header object for fetch calls.
 * Usage:
 *   fetch('/api/something', { headers: { ...authHeader() } });
 */
export const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};