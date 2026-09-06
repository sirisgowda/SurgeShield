import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { getToken, clearToken } from './lib/api';
import Login from './pages/Login';
import EventList from './pages/EventList';
import EventDetail from './pages/EventDetail';
import MyRegistrations from './pages/MyRegistrations';
import Ops from './pages/Ops';

const Protected = ({ children }) => (getToken() ? children : <Navigate to="/login" replace />);

function Nav() {
  const loggedIn = !!getToken();
  if (!loggedIn) return null;
  return (
    <nav className="max-w-2xl mx-auto px-4 pt-6 flex gap-4 text-sm text-slate-600">
      <Link to="/events" className="hover:text-slate-900">Events</Link>
      <Link to="/me" className="hover:text-slate-900">My registrations</Link>
      <Link to="/ops" className="hover:text-slate-900">Create event</Link>
      <button
        className="ml-auto underline"
        onClick={() => { clearToken(); location.href = '/login'; }}
      >
        Log out
      </button>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/events" element={<Protected><EventList /></Protected>} />
        <Route path="/events/:id" element={<Protected><EventDetail /></Protected>} />
        <Route path="/me" element={<Protected><MyRegistrations /></Protected>} />
        <Route path="/ops" element={<Protected><Ops /></Protected>} />
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
