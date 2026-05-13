import { useState } from 'react';
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

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMismatchError, setShowMismatchError] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const passwordsMatch = password.length > 0 && password === confirmPassword;

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
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password reset! Redirecting to login...');
        setIsError(false);
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setIsError(true);
        setMessage(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setIsError(true);
      setMessage('Failed to connect to the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <img
            src={logoImage}
            alt="Rfacon Dormitel"
            style={{ display: 'block', margin: '0 auto 12px', maxWidth: '260px', height: 'auto' }}
          />
          <p style={{ ...messageStyle, color: '#c00', textAlign: 'center' }}>
            No reset token. Use the link from your reset email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <img
          src={logoImage}
          alt="Rfacon Dormitel"
          style={{ display: 'block', margin: '0 auto 12px', maxWidth: '260px', height: 'auto' }}
        />

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Reset Password</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '24px', fontSize: '14px' }}>
          Enter your new password below.
        </p>

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
            {isSubmitting ? 'RESETTING...' : 'RESET PASSWORD'}
          </button>
        </form>

        {message && (
          <p style={{ ...messageStyle, color: isError ? '#c00' : '#080' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
