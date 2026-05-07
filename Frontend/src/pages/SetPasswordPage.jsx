// src/pages/SetPasswordPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PasswordChecklist from '../components/PasswordChecklist';
import { isPasswordValid } from '../utils/validators';
import {
  pageStyle,
  cardStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  buttonDisabledStyle,
  messageStyle
} from '../styles/authStyles';
import logoImage from '../assets/logo.png';

function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Only flips true when the user clicks Set Password with mismatched values.
  const [showMismatchError, setShowMismatchError] = useState(false);

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setIsError(true);
      setMessage('No invite token provided. Please use the link from your invite email.');
    }
  }, [token]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Don't gate on passwordsMatch — let the user click Submit and SEE the error
  const canSubmit =
    !!token && isPasswordValid(password) && confirmPassword.length > 0 && !isSubmitting;

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!passwordsMatch) {
      setShowMismatchError(true);
      return;
    }

    setShowMismatchError(false);
    setMessage('');
    setIsError(false);
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password set successfully! Redirecting to login...');
        setIsError(false);
        setTimeout(() => {
          navigate('/login', { state: { justOnboarded: true } });
        }, 1500);
      } else {
        setIsError(true);
        setMessage(data.message || 'Failed to set password.');
      }
    } catch (error) {
      console.error('Set password error:', error);
      setIsError(true);
      setMessage('Failed to connect to the server. Please try again.');
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

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Set Your Password</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '24px', fontSize: '14px' }}>
          Welcome! Create a password to finish setting up your account.
        </p>

        {token ? (
          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>New Password</label>
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

            <PasswordChecklist password={password} />

            <label style={{ ...labelStyle, marginTop: '12px' }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (showMismatchError) setShowMismatchError(false);
              }}
              required
              style={inputStyle}
            />
            {showMismatchError && (
              <p style={{ color: '#c00', fontSize: '13px', marginTop: '-4px' }}>
                Passwords don't match.
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={canSubmit ? buttonStyle : buttonDisabledStyle}
            >
              {isSubmitting ? 'SETTING PASSWORD...' : 'SET PASSWORD'}
            </button>
          </form>
        ) : null}

        {message && (
          <p style={{ ...messageStyle, color: isError ? '#c00' : '#080' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default SetPasswordPage;