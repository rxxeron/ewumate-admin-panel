import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmProvider } from './components/ConfirmProvider';
import { PageSkeleton } from './components/PageSkeleton';

// Code-split all page routes for optimized bundle size & fast initial load
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const ActiveSemester = lazy(() => import('./pages/ActiveSemester').then(m => ({ default: m.ActiveSemester })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const UsersList = lazy(() => import('./pages/UsersList').then(m => ({ default: m.UsersList })));
const UserDetails = lazy(() => import('./pages/UserDetails').then(m => ({ default: m.UserDetails })));
const CoursesList = lazy(() => import('./pages/CoursesList').then(m => ({ default: m.CoursesList })));
const AcademicData = lazy(() => import('./pages/AcademicData').then(m => ({ default: m.AcademicData })));
const FileParser = lazy(() => import('./pages/FileParser').then(m => ({ default: m.FileParser })));
const PortalAutomation = lazy(() => import('./pages/PortalAutomation').then(m => ({ default: m.PortalAutomation })));
const StudyVaultManager = lazy(() => import('./pages/StudyVaultManager').then(m => ({ default: m.StudyVaultManager })));
const OfficeHoursModeration = lazy(() => import('./pages/OfficeHoursModeration').then(m => ({ default: m.OfficeHoursModeration })));
const FacultyReviewsModeration = lazy(() => import('./pages/FacultyReviewsModeration').then(m => ({ default: m.FacultyReviewsModeration })));
const TutorialsManager = lazy(() => import('./pages/TutorialsManager').then(m => ({ default: m.TutorialsManager })));
const FacultyAssignmentsModeration = lazy(() => import('./pages/FacultyAssignmentsModeration').then(m => ({ default: m.FacultyAssignmentsModeration })));
const CalendarEditor = lazy(() => import('./pages/CalendarEditor').then(m => ({ default: m.CalendarEditor })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Feedbacks = lazy(() => import('./pages/Feedbacks').then(m => ({ default: m.Feedbacks })));
const Donations = lazy(() => import('./pages/Donations').then(m => ({ default: m.Donations })));
const DataQuality = lazy(() => import('./pages/DataQuality').then(m => ({ default: m.DataQuality })));
const FacultyMaster = lazy(() => import('./pages/FacultyMaster').then(m => ({ default: m.FacultyMaster })));

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                  <Login />
                </Suspense>
              }
            />

            <Route element={<AuthGuard />}>
              <Route element={<Layout />}>
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Dashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Analytics />
                    </Suspense>
                  }
                />
                <Route
                  path="/active-semester"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <ActiveSemester />
                    </Suspense>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Notifications />
                    </Suspense>
                  }
                />
                <Route
                  path="/local-notifications"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Notifications defaultView="local_stats" />
                    </Suspense>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <UsersList />
                    </Suspense>
                  }
                />
                <Route
                  path="/users/:id"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <UserDetails />
                    </Suspense>
                  }
                />
                <Route
                  path="/courses"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <CoursesList />
                    </Suspense>
                  }
                />
                <Route
                  path="/academic-data"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <AcademicData />
                    </Suspense>
                  }
                />
                <Route
                  path="/parser"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <FileParser />
                    </Suspense>
                  }
                />
                <Route
                  path="/scraper"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <PortalAutomation />
                    </Suspense>
                  }
                />
                <Route
                  path="/study-vault"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <StudyVaultManager />
                    </Suspense>
                  }
                />
                <Route
                  path="/office-hours"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <OfficeHoursModeration />
                    </Suspense>
                  }
                />
                <Route
                  path="/faculty-reviews"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <FacultyReviewsModeration />
                    </Suspense>
                  }
                />
                <Route
                  path="/tutorials"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <TutorialsManager />
                    </Suspense>
                  }
                />
                <Route
                  path="/faculty-assignments"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <FacultyAssignmentsModeration />
                    </Suspense>
                  }
                />
                <Route
                  path="/calendar-editor"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <CalendarEditor />
                    </Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Settings />
                    </Suspense>
                  }
                />
                <Route
                  path="/feedbacks"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Feedbacks />
                    </Suspense>
                  }
                />
                <Route
                  path="/donations"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Donations />
                    </Suspense>
                  }
                />
                <Route
                  path="/data-quality"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <DataQuality />
                    </Suspense>
                  }
                />
                <Route
                  path="/faculty"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <FacultyMaster />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </ConfirmProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
