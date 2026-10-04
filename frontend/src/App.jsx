import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './hooks/useToast.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import EmailVerification from './pages/EmailVerification.jsx'
import PasswordReset from './pages/PasswordReset.jsx'
import CertificateVerification from './pages/CertificateVerification.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import CourseCatalog from './pages/CourseCatalog.jsx'
import CourseView from './pages/CourseView.jsx'
import LessonView from './pages/LessonView.jsx'
import QuizTake from './pages/QuizTake.jsx'
import StudentGrades from './pages/StudentGrades.jsx'
import InstructorDashboard from './pages/InstructorDashboard.jsx'
import InstructorContent from './pages/InstructorContent.jsx'
import InstructorSubmissions from './pages/InstructorSubmissions.jsx'
import InstructorStudents from './pages/InstructorStudents.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-panel px-6 text-center">
      <h1 className="text-2xl font-bold text-ink">Page not found</h1>
      <p className="text-sm text-text-muted">That page doesn't exist or has moved.</p>
      <Link to="/" className="mt-2 text-sm font-medium text-coral hover:text-coral-dim">
        Back to home
      </Link>
    </div>
  )
}

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ToastProvider>
          <AppErrorBoundary>
            <BrowserRouter>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<EmailVerification />} />
              <Route path="/forgot-password" element={<PasswordReset />} />
              <Route path="/reset-password" element={<PasswordReset />} />
              <Route path="/verify/:certificateNumber" element={<CertificateVerification />} />

            {/* Student */}
            <Route
              path="/dashboard/student"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/courses"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <CourseCatalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/courses/:courseId"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <CourseView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/lessons/:lessonId"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <LessonView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/quiz/:quizId"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <QuizTake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/grades"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentGrades />
                </ProtectedRoute>
              }
            />

            {/* Instructor */}
            <Route
              path="/dashboard/instructor"
              element={
                <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                  <InstructorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/instructor/content"
              element={
                <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                  <InstructorContent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/instructor/submissions"
              element={
                <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                  <InstructorSubmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/instructor/students"
              element={
                <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                  <InstructorStudents />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/dashboard/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Unmatched paths land here instead of rendering a blank screen. */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AppErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </HelmetProvider>
  )
}

export default App
