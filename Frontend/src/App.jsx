import Login from './components/Login';
import Register from './components/Register';

function App() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '50px', marginTop: '50px' }}>
      <Register />
      <Login />
    </div>
  );
}

export default App;