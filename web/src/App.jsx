import { useState } from 'react';
import Register from './pages/Register.jsx';
import Ops from './pages/Ops.jsx';

export default function App() {
  const [view, setView] = useState('register');

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white px-6 py-3 flex gap-4 text-sm font-medium">
        <button
          onClick={() => setView('register')}
          className={view === 'register' ? 'text-blue-700' : 'text-slate-500'}
        >
          Registration
        </button>
        <button
          onClick={() => setView('ops')}
          className={view === 'ops' ? 'text-blue-700' : 'text-slate-500'}
        >
          Surge Story
        </button>
      </nav>
      {view === 'register' ? <Register /> : <Ops />}
    </div>
  );
}
