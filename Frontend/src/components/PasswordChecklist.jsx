// src/components/PasswordChecklist.jsx
import { getPasswordRules } from '../utils/validators';

function PasswordChecklist({ password }) {
  const rules = getPasswordRules(password);

  return (
    <ul style={{
      listStyle: 'none',
      padding: '8px 12px',
      margin: '8px 0 16px 0',
      fontSize: '0.8rem',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      border: '1px solid #ddd',
      borderRadius: '4px'
    }}>
      {rules.map((rule, idx) => (
        <li
          key={idx}
          style={{
            color: rule.passed ? '#2e7d32' : '#888',
            margin: '3px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{
            display: 'inline-block',
            width: '14px',
            fontWeight: 'bold'
          }}>
            {rule.passed ? '✓' : '○'}
          </span>
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

export default PasswordChecklist;