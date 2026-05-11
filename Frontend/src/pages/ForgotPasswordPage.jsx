import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } catch (err) {
      console.error('Forgot password fetch error:', err);
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
      setEmail('');
    }
  };

  const backLinkStyle = {
    display: 'block',
    textAlign: 'center',
    marginTop: '16px',
    color: '#E8A93D',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none'
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <img
          src={logoImage}
          alt="Rfacon Dormitel"
          style={{ display: 'block', margin: '0 auto 12px', maxWidth: '260px', height: 'auto' }}
        />

        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Forgot Password</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '24px', fontSize: '14px' }}>
          Enter your email and we'll send you a reset link.
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              style={isSubmitting ? buttonDisabledStyle : buttonStyle}
            >
              {isSubmitting ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
          </form>
        ) : (
          <p style={{ ...messageStyle, color: '#080', textAlign: 'center' }}>
            If an account exists with that email, we have sent reset instructions.
          </p>
        )}

        <a
          style={backLinkStyle}
          onClick={() => navigate('/login')}
        >
          ← Back to Login
        </a>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
