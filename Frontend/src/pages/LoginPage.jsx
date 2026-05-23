// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuth } from '../utils/auth';
import {
  pageStyle,
  cardStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  buttonDisabledStyle,
  messageStyle,
  forgotPasswordStyle
} from '../styles/authStyles';
import logoImage from '../assets/logo.png';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const passwordWrapperStyle = {
    position: 'relative',
    marginBottom: '8px'
  };

  const passwordInputStyle = {
    ...inputStyle,
    paddingRight: '60px'
  };

  const toggleButtonStyle = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: '#666',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px'
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setAuth(data.token, data.user);
        setMessage('Login successful!');
        const destination = data.user.role === 'owner' ? '/admin/tenants' : '/portal';
        setTimeout(() => navigate(destination), 800);
      } else {
        setMessage(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setMessage('Failed to connect to the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <img
          src={logoImage}
          alt="Rfacon Dormitel"
          style={{ display: 'block', margin: '0 auto 12px', maxWidth: '260px', height: 'auto' }}
        />

        <form onSubmit={handleLogin}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <div style={passwordWrapperStyle}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={passwordInputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={toggleButtonStyle}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <a style={forgotPasswordStyle} onClick={() => navigate('/forgot-password')}>
            Forgot Password?
          </a>

          <button
            type="submit"
            disabled={isSubmitting}
            style={isSubmitting ? buttonDisabledStyle : buttonStyle}
          >
            {isSubmitting ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </form>

        {message && <p style={messageStyle}>{message}</p>}
      </div>
    </div>
  );
}

export default LoginPage;