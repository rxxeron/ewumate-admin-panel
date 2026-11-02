import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmProvider } from './components/ConfirmProvider';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ActiveSemester } from './pages/ActiveSemester';
import { Notifications } from './pages/Notifications';
import { UsersList } from './pages/UsersList';
import { CoursesList } from './pages/CoursesList';
import { Settings } from './pages/Settings';
import { UserDetails } from './pages/UserDetails';
import { AcademicData } from './pages/AcademicData';
import { FileParser } from './pages/FileParser';
import { Feedbacks } from './pages/Feedbacks';
import { Donations } from './pages/Donations';
import { FacultyMaster } from './pages/FacultyMaster';
import { Analytics } from './pages/Analytics';

import { CalendarEditor } from './pages/CalendarEditor';
import { DataQuality } from './pages/DataQuality';
import { PortalAutomation } from './pages/PortalAutomation';
import { StudyVaultManager } from './pages/StudyVaultManager';
import { OfficeHoursModeration } from './pages/OfficeHoursModeration';
import { TutorialsManager } from './pages/TutorialsManager';
import { FacultyAssignmentsModeration } from './pages/FacultyAssignmentsModeration';
import { FacultyReviewsModeration } from './pages/FacultyReviewsModeration';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ConfirmProvider>
          <Routes>
            <Route path='/login' element={<Login />} />

            <Route element={<AuthGuard />}>
              <Route element={<Layout />}>
                <Route path='/' element={<Dashboard />} />
                <Route path='/analytics' element={<Analytics />} />
                <Route path='/active-semester' element={<ActiveSemester />} />
                <Route path='/notifications' element={<Notifications />} />
                <Route path='/local-notifications' element={<Notifications defaultView="local_stats" />} />
                <Route path='/users' element={<UsersList />} />
                <Route path='/users/:id' element={<UserDetails />} />
                <Route path='/courses' element={<CoursesList />} />
                <Route path='/academic-data' element={<AcademicData />} />
                <Route path='/parser' element={<FileParser />} />
                <Route path='/scraper' element={<PortalAutomation />} />
                <Route path='/study-vault' element={<StudyVaultManager />} />
                <Route path='/office-hours' element={<OfficeHoursModeration />} />
                <Route path='/faculty-reviews' element={<FacultyReviewsModeration />} />
                <Route path='/tutorials' element={<TutorialsManager />} />
                <Route path='/faculty-assignments' element={<FacultyAssignmentsModeration />} />

                <Route path='/calendar-editor' element={<CalendarEditor />} />
                <Route path='/settings' element={<Settings />} />
                <Route path='/feedbacks' element={<Feedbacks />} />
                <Route path='/donations' element={<Donations />} />
                <Route path='/data-quality' element={<DataQuality />} />
                <Route path='/faculty' element={<FacultyMaster />} />
              </Route>
            </Route>
          </Routes>
        </ConfirmProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
