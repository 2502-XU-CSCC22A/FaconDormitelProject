// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setAuth } from '../utils/auth';
import {
  pageStyle,
  cardStyle,
  switchPromptStyle,
  switchLinkStyle,
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
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setAuth(data.token, data.user);
        setMessage('Login successful!');
        setTimeout(() => navigate('/dashboard'), 800);
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

        <p style={switchPromptStyle}>
          Don't have an account?{' '}
          <Link to="/register" style={switchLinkStyle}>Sign up</Link>
        </p>

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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          <a href="#" style={forgotPasswordStyle} onClick={(e) => e.preventDefault()}>
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