// src/components/admin/InviteLinkModal.jsx
import { useState } from 'react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px'
};

const modalStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '28px',
  maxWidth: '520px',
  width: '100%',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
};

const headingStyle = {
  margin: '0 0 8px 0',
  fontSize: '20px'
};

const subtextStyle = {
  margin: '0 0 20px 0',
  color: '#666',
  fontSize: '14px'
};

const linkBoxStyle = {
  display: 'flex',
  gap: '8px',
  background: '#f5f5f5',
  border: '1px solid #ddd',
  borderRadius: '6px',
  padding: '8px',
  marginBottom: '16px'
};

const linkInputStyle = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  fontSize: '13px',
  fontFamily: 'monospace',
  color: '#333',
  outline: 'none',
  minWidth: 0
};

const copyButtonStyle = {
  padding: '6px 14px',
  fontSize: '13px',
  fontWeight: 600,
  border: '1px solid #E8A93D',
  background: '#fff',
  color: '#E8A93D',
  borderRadius: '4px',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const copiedButtonStyle = {
  ...copyButtonStyle,
  background: '#E8A93D',
  color: '#fff'
};

const expiryStyle = {
  fontSize: '13px',
  color: '#888',
  marginBottom: '20px'
};

const closeButtonStyle = {
  width: '100%',
  padding: '10px',
  fontSize: '14px',
  fontWeight: 600,
  border: 'none',
  background: '#E8A93D',
  color: '#fff',
  borderRadius: '6px',
  cursor: 'pointer'
};

function formatExpiry(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function InviteLinkModal({ tenant, inviteLink, inviteExpiresAt, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // navigator.clipboard might not be available in some browsers/contexts.
      // Fallback: select the input so user can Ctrl+C manually.
      const input = document.getElementById('invite-link-input');
      if (input) input.select();
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={headingStyle}> Tenant invited</h3>
        <p style={subtextStyle}>
          {tenant.name ? `${tenant.name} (${tenant.email})` : tenant.email} has been added.
          Share this invite link so they can set their password:
        </p>

        <div style={linkBoxStyle}>
          <input
            id="invite-link-input"
            type="text"
            readOnly
            value={inviteLink}
            style={linkInputStyle}
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            style={copied ? copiedButtonStyle : copyButtonStyle}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p style={expiryStyle}>
           This link expires on <strong>{formatExpiry(inviteExpiresAt)}</strong> (7 days from now).
        </p>

        <button type="button" onClick={onClose} style={closeButtonStyle}>
          Done
        </button>
      </div>
    </div>
  );
}

export default InviteLinkModal;