// /app/api/emails/route.ts
// API route for fetching all emails
// Returns list of emails with their current processing status

import { NextResponse } from 'next/server'
import { emailStore } from '@/lib/kv-client'

export async function GET() {
  try {
    const emails = await emailStore.getAllEmails()
    
    return NextResponse.json({
      success: true,
      emails,
      count: emails.length,
    })
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}