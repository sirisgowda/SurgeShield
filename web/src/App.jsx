import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Navbar from './components/Navbar';
import RoleGuard from './components/RoleGuard';
import Login from './pages/Login';
import EventList from './pages/EventList';
import EventDetail from './pages/EventDetail';
import MyRegistrations from './pages/MyRegistrations';
import Ops from './pages/Ops';
import OpsDashboard from './pages/OpsDashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/login" element={<Login />} />
              
              {/* Event Browsing: All logged in users */}
              <Route
                path="/events"
                element={
                  <RoleGuard>
                    <EventList />
                  </RoleGuard>
                }
              />
              <Route
                path="/events/:id"
                element={
                  <RoleGuard>
                    <EventDetail />
                  </RoleGuard>
                }
              />

              {/* My Tickets: Attendee wallet */}
              <Route
                path="/me"
                element={
                  <RoleGuard allowedRoles={['attendee', 'organizer']}>
                    <MyRegistrations />
                  </RoleGuard>
                }
              />

              {/* Create Event: Organizer Studio */}
              <Route
                path="/ops"
                element={
                  <RoleGuard allowedRoles={['organizer']}>
                    <Ops />
                  </RoleGuard>
                }
              />

              {/* Ops dashboard: live decision_log view (read-only) */}
              <Route
                path="/ops/dashboard"
                element={
                  <RoleGuard>
                    <OpsDashboard />
                  </RoleGuard>
                }
              />

              <Route path="*" element={<Navigate to="/events" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
