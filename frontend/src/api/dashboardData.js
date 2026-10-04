import { api } from '../lib/api.js'

export async function fetchStudentDashboardData() {
  const [dashboard, student, engagementResult] = await Promise.all([
    api.get('/dashboard/student/'),
    api.me(),
    api.get('/engagement/me/')
      .then((data) => ({ data }))
      .catch((error) => ({ error })),
  ])

  return {
    ...dashboard,
    student,
    engagement: engagementResult.data || null,
    engagementError: engagementResult.error?.message || '',
  }
}
