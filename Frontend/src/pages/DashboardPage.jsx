// src/pages/DashboardPage.jsx
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../utils/auth';

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#f4f4f4',
      padding: '40px 20px',
      fontFamily: "'Segoe UI', Tahoma, sans-serif"
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '1px solid #eee'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Dashboard</h1>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
              Welcome back!
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              backgroundColor: '#E8A93D',
              color: '#fff',
              border: 'none',
              borderRadius: '20px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Log Out
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', color: '#333' }}>Your Account</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#666', width: '100px' }}>Email</td>
                <td style={{ padding: '8px 0' }}>{user?.email || '—'}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#666' }}>Role</td>
                <td style={{ padding: '8px 0' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    backgroundColor: user?.role === 'owner' ? '#FFE0B2' : '#C8E6C9',
                    color: user?.role === 'owner' ? '#9C5A1F' : '#2E7D32',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}>
                    {user?.role || 'unknown'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#FFF8E1',
          borderRadius: '8px',
          color: '#666',
          fontSize: '0.9rem',
          lineHeight: '1.5'
        }}>
          <strong> Under construction.</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            {user?.role === 'owner'
              ? 'Owner features (room management, billing, payment tracking) are coming soon.'
              : 'Tenant features (your room, your bills, payment history) are coming soon.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;