// src/pages/RegisterPage.jsx
import logoImage from '../assets/logo.png';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordChecklist from '../components/PasswordChecklist';
import { isValidEmail, isPasswordValid } from '../utils/validators';
import {
  pageStyle,
  cardStyle,
  logoContainerStyle,
  logoTextStyle,
  logoAccentStyle,
  switchPromptStyle,
  switchLinkStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  buttonDisabledStyle,
  messageStyle,
  errorListStyle
} from '../styles/authStyles';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const formIsValid = isValidEmail(email) && isPasswordValid(password);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrors([]);
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Registration successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setMessage(data.message || 'Registration failed');
        if (Array.isArray(data.errors)) {
          setErrors(data.errors);
        }
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
  style={{
    display: 'block',
    margin: '0 auto 12px',
    maxWidth: '260px',
    height: 'auto'
  }}
/>

        <p style={switchPromptStyle}>
          Already have an account?{' '}
          <Link to="/login" style={switchLinkStyle}>Log in</Link>
        </p>

        <form onSubmit={handleRegister}>
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

          <PasswordChecklist password={password} />

          <button
            type="submit"
            disabled={!formIsValid || isSubmitting}
            style={(!formIsValid || isSubmitting) ? buttonDisabledStyle : buttonStyle}
          >
            {isSubmitting ? 'SIGNING UP...' : 'SIGN UP'}
          </button>
        </form>

        {message && <p style={messageStyle}>{message}</p>}
        {errors.length > 0 && (
          <ul style={errorListStyle}>
            {errors.map((err, idx) => <li key={idx}>{err}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

export default RegisterPage;