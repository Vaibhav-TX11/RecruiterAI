import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PermissionProvider } from './contexts/PermissionContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth
import LoginPage from './pages/LoginPage';

// Stage 1: Screening
import ScreeningPage from './pages/ScreeningPage';

// Stage 2: Candidates
import CandidatesPage from './pages/CandidatesPage';
import MyNotesPage from './pages/MyNotesPage';

// Other Features
import UploadPage from './pages/UploadPage';
import JobsPage from './pages/JobsPage';
import MatchingPage from './pages/MatchingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BlacklistPage from './pages/BlacklistPage';
import ActivityPage from './pages/ActivityPage';
import UsersPage from './pages/UsersPage';

function App() {
  return (
    <Router>
      <PermissionProvider>
        <Routes>
          {/* Public Route - Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* All Protected Routes with Layout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    {/* Redirect root to screening */}
                    <Route path="/" element={<Navigate to="/screening" replace />} />

                    {/* STAGE 1: Bulk Screening */}
                    <Route path="/screening" element={<ScreeningPage />} />

                    {/* STAGE 2: Full Candidate Management */}
                    <Route path="/candidates" element={<CandidatesPage />} />
                    <Route path="/my-notes" element={<MyNotesPage />} />

                    {/* Resume Upload */}
                    <Route path="/upload" element={<UploadPage />} />

                    {/* Job Management */}
                    <Route path="/jobs" element={<JobsPage />} />
                    <Route path="/matching" element={<MatchingPage />} />

                    {/* Analytics & Reports */}
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/blacklist" element={<BlacklistPage />} />
                    <Route path="/activity" element={<ActivityPage />} />

                    {/* Admin */}
                    <Route path="/users" element={<UsersPage />} />

                    {/* 404 - Redirect to screening */}
                    <Route path="*" element={<Navigate to="/screening" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </PermissionProvider>
    </Router>
  );
}

export default App;