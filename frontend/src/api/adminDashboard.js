import { api, backendUrl } from '../lib/api.js'

export async function getAdminDashboard() {
  return api.get('/dashboard/admin/')
}

/**
 * There is deliberately no API endpoint to create instructor/admin users
 * (see apps/accounts/serializers.py — public registration only ever
 * creates students, on purpose, for security). New staff accounts are
 * created through Django admin (/admin/) by someone who already has
 * admin access. This helper just builds that URL rather than pretending
 * a "create user" API call exists.
 */
export function djangoAdminUrl() {
  return backendUrl('/admin/')
}
