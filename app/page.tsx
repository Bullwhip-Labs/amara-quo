// /app/page.tsx
// Home page that redirects to dashboard
// Entry point for the application

import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
  return null // This won't be reached due to redirect
}