// src/components/admin/InviteTenantForm.jsx
import { useState } from 'react';
import { authHeader } from '../../utils/auth';

const sectionStyle = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '20px',
  marginTop: '20px',
  background: '#fafafa'
};

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 2fr auto',
  gap: '12px',
  alignItems: 'end'
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '4px',
  color: '#444'
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  background: '#fff'
};

const buttonStyle = {
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#fff',
  background: '#E8A93D',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const buttonDisabledStyle = {
  ...buttonStyle,
  background: '#ddd',
  color: '#888',
  cursor: 'not-allowed'
};

const errorStyle = {
  color: '#c00',
  fontSize: '13px',
  marginTop: '8px'
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function InviteTenantForm({ onTenantCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = isValidEmail(email) && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader()
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        // Clear form, hand off the result to the parent (it'll show the modal)
        setName('');
        setEmail('');
        onTenantCreated(data);
      } else {
        setError(data.message || 'Failed to invite tenant.');
      }
    } catch (err) {
      console.error('Invite tenant error:', err);
      setError('Failed to connect to the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={sectionStyle}>
      <h3 style={{ margin: '0 0 16px 0' }}>Invite a Tenant</h3>

      <form onSubmit={handleSubmit}>
        <div style={formGridStyle}>
          <div>
            <label style={labelStyle} htmlFor="invite-name">Name (optional)</label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@example.com"
              required
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            style={canSubmit ? buttonStyle : buttonDisabledStyle}
          >
            {isSubmitting ? 'Inviting...' : 'Invite'}
          </button>
        </div>

        {error && <p style={errorStyle}>{error}</p>}
      </form>
    </div>
  );
}

export default InviteTenantForm;