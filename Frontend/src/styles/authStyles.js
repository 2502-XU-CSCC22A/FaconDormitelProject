import bgImage from '../assets/dorm-bg.jpg';

const ORANGE = '#E8A93D';
const ORANGE_DARK = '#C68A2A';
const ORANGE_DARK_TEXT = '#9C5A1F';
const BLUE_LINK = '#2D7AE5';
const BACKGROUND_IMAGE = `url(${bgImage}) center/cover no-repeat`;

export const pageStyle = {
  minHeight: '100vh',
  width: '100vw',          // ← change from '100%' to '100vw'
  margin: 0,                // ← add this
  padding: '20px',
  background: BACKGROUND_IMAGE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Segoe UI', Tahoma, sans-serif"
};

export const cardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  borderRadius: '12px',
  padding: '40px 50px',
  width: '100%',
  maxWidth: '420px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  backdropFilter: 'blur(4px)'
};

export const logoContainerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '4px',
  marginBottom: '12px'
};

export const logoAccentStyle = {
  fontSize: '2.5rem',
  fontWeight: 'bold',
  color: ORANGE_DARK_TEXT,
  fontFamily: 'Georgia, serif'
};

export const logoTextStyle = {
  fontSize: '1.2rem',
  fontWeight: 'bold',
  color: ORANGE,
  letterSpacing: '1px'
};

export const switchPromptStyle = {
  textAlign: 'center',
  fontSize: '0.95rem',
  color: '#333',
  margin: '0 0 24px 0',
  fontWeight: '500'
};

export const switchLinkStyle = {
  color: BLUE_LINK,
  textDecoration: 'underline',
  fontSize: '0.85rem'
};

export const labelStyle = {
  display: 'block',
  fontSize: '0.95rem',
  fontWeight: '600',
  color: '#333',
  marginBottom: '6px',
  marginTop: '12px'
};

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '1rem',
  border: '2px solid #000',
  borderRadius: '4px',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
  outline: 'none'
};

export const buttonStyle = {
  display: 'block',
  margin: '24px auto 0 auto',
  padding: '12px 40px',
  backgroundColor: ORANGE,
  color: '#fff',
  fontSize: '1rem',
  fontWeight: 'bold',
  letterSpacing: '1px',
  border: 'none',
  borderRadius: '24px',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease'
};

export const buttonDisabledStyle = {
  ...buttonStyle,
  backgroundColor: '#ccc',
  cursor: 'not-allowed'
};

export const messageStyle = {
  marginTop: '16px',
  textAlign: 'center',
  fontSize: '0.9rem',
  color: '#333'
};

export const errorListStyle = {
  marginTop: '8px',
  paddingLeft: '20px',
  color: '#c62828',
  fontSize: '0.85rem'
};

export const forgotPasswordStyle = {
  display: 'block',
  textAlign: 'right',
  fontSize: '0.8rem',
  color: BLUE_LINK,
  textDecoration: 'underline',
  marginTop: '8px'
};