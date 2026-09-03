import { useEffect, useState } from 'react'
import { fetchJson } from '../lib/api.js'

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  async function refreshUser() {
    try {
      const user = await fetchJson('/api/auth/me')
      setCurrentUser(user)
      return user
    } catch (error) {
      setCurrentUser(null)
      return null
    } finally {
      setAuthChecked(true)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  return { currentUser, setCurrentUser, authChecked, refreshUser }
}
