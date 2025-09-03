// /app/api/emails/poll/route.ts
// API route for polling Upstash for new emails
// Checks for emails with historyId greater than last processed

import { NextResponse } from 'next/server'
import { emailStore, type EmailRecord } from '@/lib/kv-client'

// Mock function to simulate fetching new emails from Upstash
// In production, this would connect to your actual Upstash queue
async function fetchNewEmailsFromUpstash(lastHistoryId: number): Promise<EmailRecord[]> {
  // This is where you'd fetch from your actual Upstash store
  // For now, returning empty array (no new emails)
  
  // Example of what the real implementation would look like:
  // const response = await fetch(YOUR_UPSTASH_ENDPOINT, {
  //   headers: { 'Authorization': `Bearer ${process.env.UPSTASH_TOKEN}` }
  // })
  // const emails = await response.json()
  // return emails.filter(e => e.historyId > lastHistoryId)
  
  return []
}

export async function GET() {
  try {
    // Get the last processed history ID
    const lastHistoryId = await emailStore.getLastHistoryId()
    
    // Fetch new emails from Upstash
    const newEmails = await fetchNewEmailsFromUpstash(lastHistoryId)
    
    // Store new emails and update last history ID
    let maxHistoryId = lastHistoryId
    for (const email of newEmails) {
      await emailStore.storeEmail(email)
      if (email.historyId > maxHistoryId) {
        maxHistoryId = email.historyId
      }
    }
    
    if (maxHistoryId > lastHistoryId) {
      await emailStore.setLastHistoryId(maxHistoryId)
    }
    
    // Return all emails for dashboard update
    const allEmails = await emailStore.getAllEmails()
    
    return NextResponse.json({
      success: true,
      newCount: newEmails.length,
      emails: allEmails,
      lastHistoryId: maxHistoryId,
    })
  } catch (error) {
    console.error('Polling error:', error)
    return NextResponse.json(
      { error: 'Failed to poll for new emails' },
      { status: 500 }
    )
  }
}

// Manual endpoint to add test email
export async function POST(request: Request) {
  try {
    const email = await request.json() as EmailRecord
    
    // Store the email
    await emailStore.storeEmail(email)
    
    // Update last history ID if needed
    const lastHistoryId = await emailStore.getLastHistoryId()
    if (email.historyId > lastHistoryId) {
      await emailStore.setLastHistoryId(email.historyId)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email added successfully',
    })
  } catch (error) {
    console.error('Error adding email:', error)
    return NextResponse.json(
      { error: 'Failed to add email' },
      { status: 500 }
    )
  }
}