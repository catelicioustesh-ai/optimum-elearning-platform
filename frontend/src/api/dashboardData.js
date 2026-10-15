import { api } from '../lib/api.js'

export async function fetchStudentDashboardData() {
  return api.get('/dashboard/student/')
}
