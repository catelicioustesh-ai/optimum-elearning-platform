import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './hooks/useToast.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

const Landing = lazy(() => import('./Landing.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const EmailVerification = lazy(() => import('./pages/EmailVerification.jsx'))
const PasswordReset = lazy(() => import('./pages/PasswordReset.jsx'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification.jsx'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'))
const CourseCatalog = lazy(() => import('./pages/CourseCatalog.jsx'))
const CourseView = lazy(() => import('./pages/CourseView.jsx'))
const LessonView = lazy(() => import('./pages/LessonView.jsx'))
const QuizTake = lazy(() => import('./pages/QuizTake.jsx'))
const StudentGrades = lazy(() => import('./pages/StudentGrades.jsx'))
const StudentAchievements = lazy(() => import('./pages/StudentAchievements.jsx'))
const StudentCertificates = lazy(() => import('./pages/StudentCertificates.jsx'))
const StudentProfile = lazy(() => import('./pages/StudentProfile.jsx'))
const StudentAssignments = lazy(() => import('./pages/StudentAssignments.jsx'))
const StudentResources = lazy(() => import('./pages/StudentResources.jsx'))
const StudentBookmarks = lazy(() => import('./pages/StudentBookmarks.jsx'))
const StudentNotifications = lazy(() => import('./pages/StudentNotifications.jsx'))
const StudentCommunity = lazy(() => import('./pages/StudentCommunity.jsx'))
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard.jsx'))
const InstructorContent = lazy(() => import('./pages/InstructorContent.jsx'))
const InstructorSubmissions = lazy(() => import('./pages/InstructorSubmissions.jsx'))
const InstructorStudents = lazy(() => import('./pages/InstructorStudents.jsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))

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
              <Suspense
                fallback={
                  <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-slate-600" role="status">
                    Loading Optimum LMS...
                  </div>
                }
              >
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
            <Route
              path="/dashboard/student/achievements"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentAchievements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/certificates"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentCertificates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/settings"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/assignments"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentAssignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/resources"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentResources />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/bookmarks"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentBookmarks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/notifications"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/community"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentCommunity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/discussions"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentCommunity />
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
              </Suspense>
            </BrowserRouter>
          </AppErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </HelmetProvider>
  )
}

export default App
