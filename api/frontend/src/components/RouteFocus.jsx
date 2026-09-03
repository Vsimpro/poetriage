import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteFocus() {
  const location = useLocation()

  useEffect(() => {
    const target = document.getElementById('main-content') || document.querySelector('h1')
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true })
    }
  }, [location.pathname])

  return null
}
