// /app/api/emails/poll/route.ts
// API route for polling Upstash for new emails
// Fixed to actually fetch from Upstash Redis

import { NextResponse } from 'next/server'
import { emailStore, type EmailRecord } from '@/lib/kv-client'
import { kv } from '@vercel/kv'

// Fetch new emails from Upstash that haven't been processed yet
async function fetchNewEmailsFromUpstash(lastHistoryId: number): Promise<EmailRecord[]> {
  try {
    console.log(`🔍 Fetching emails with historyId > ${lastHistoryId}`)
    
    // Get all email keys from Redis
    // Pattern: gmail:email:* (excluding status, response, metadata keys)
    const allKeys = await kv.keys('gmail:email:*')
    
    // Filter to get only base email keys
    const emailKeys = allKeys.filter(key => {
      const keyStr = key as string
      return keyStr.startsWith('gmail:email:') && 
             !keyStr.includes(':status') && 
             !keyStr.includes(':response') &&
             !keyStr.includes(':metadata') &&
             !keyStr.includes(':queue') &&
             !keyStr.includes(':all') &&
             !keyStr.includes(':last_history_id') &&
             !keyStr.includes(':processing')
    })

    console.log(`📧 Found ${emailKeys.length} total email keys in Redis`)

    const newEmails: EmailRecord[] = []
    
    // Check each email to see if it's new
    for (const key of emailKeys) {
      const emailId = (key as string).replace('gmail:email:', '')
      
      // Check if we already have this email in our tracking set
      const existsInSet = await kv.sismember('gmail:email:all', emailId)
      
      if (!existsInSet) {
        // This is a new email we haven't seen before
        const emailData = await kv.get<EmailRecord>(key as string)
        
        if (emailData && emailData.historyId > lastHistoryId) {
          console.log(`✨ Found new email: ${emailData.subject} (historyId: ${emailData.historyId})`)
          newEmails.push(emailData)
        }
      }
    }

    // Also check for emails by scanning a sorted set if you have one
    // This is more efficient if emails are stored in a sorted set by historyId
    const rangeKey = 'gmail:emails:by_history'
    const hasRange = await kv.exists(rangeKey)
    
    if (hasRange) {
      // Get emails with historyId greater than last processed
      // Using zrange with BYSCORE option
      const newEmailIds = await kv.zrange(
        rangeKey,
        lastHistoryId + 1,
        '+inf',
        {
          byScore: true,
          withScores: false
        }
      ) as string[]
      
      console.log(`📊 Found ${newEmailIds.length} emails from sorted set`)
      
      for (const emailId of newEmailIds) {
        const emailData = await kv.get<EmailRecord>(`gmail:email:${emailId}`)
        if (emailData && !newEmails.find(e => e.id === emailData.id)) {
          newEmails.push(emailData)
        }
      }
    }

    console.log(`📬 Returning ${newEmails.length} new emails`)
    return newEmails.sort((a, b) => b.historyId - a.historyId)
    
  } catch (error) {
    console.error('Error fetching from Upstash:', error)
    return []
  }
}

// GET - Poll for new emails
export async function GET() {
  try {
    // Get the last processed history ID
    const lastHistoryId = await emailStore.getLastHistoryId()
    console.log(`📍 Last processed historyId: ${lastHistoryId}`)
    
    // Fetch new emails from Upstash
    const newEmails = await fetchNewEmailsFromUpstash(lastHistoryId)
    
    // Store new emails and update last history ID
    let maxHistoryId = lastHistoryId
    let storedCount = 0
    
    for (const email of newEmails) {
      try {
        await emailStore.storeEmail(email)
        storedCount++
        
        if (email.historyId > maxHistoryId) {
          maxHistoryId = email.historyId
        }
        
        console.log(`💾 Stored email: ${email.subject}`)
      } catch (error) {
        console.error(`Failed to store email ${email.id}:`, error)
      }
    }
    
    // Update the last history ID if we processed new emails
    if (maxHistoryId > lastHistoryId) {
      await emailStore.setLastHistoryId(maxHistoryId)
      console.log(`📈 Updated lastHistoryId to: ${maxHistoryId}`)
    }
    
    // Return all emails for dashboard update
    const allEmails = await emailStore.getAllEmails()
    
    console.log(`📊 Poll complete: ${storedCount} new, ${allEmails.length} total`)
    
    return NextResponse.json({
      success: true,
      newCount: storedCount,
      emails: allEmails,
      lastHistoryId: maxHistoryId,
      stats: {
        totalEmails: allEmails.length,
        newEmails: storedCount,
        pending: allEmails.filter(e => e.status === 'pending').length,
        processing: allEmails.filter(e => e.status === 'processing').length,
        completed: allEmails.filter(e => e.status === 'completed').length
      }
    })
  } catch (error) {
    console.error('Polling error:', error)
    return NextResponse.json(
      { error: 'Failed to poll for new emails' },
      { status: 500 }
    )
  }
}

// POST - Manual endpoint to add test email
export async function POST(request: Request) {
  try {
    const email = await request.json() as EmailRecord
    
    // Ensure email has required fields
    if (!email.id || !email.from || !email.subject) {
      return NextResponse.json(
        { error: 'Missing required email fields' },
        { status: 400 }
      )
    }
    
    // Store the email
    await emailStore.storeEmail(email)
    console.log(`✅ Manually added email: ${email.subject}`)
    
    // Update last history ID if needed
    const lastHistoryId = await emailStore.getLastHistoryId()
    if (email.historyId > lastHistoryId) {
      await emailStore.setLastHistoryId(email.historyId)
    }
    
    // Also add to sorted set for efficient retrieval
    const rangeKey = 'gmail:emails:by_history'
    await kv.zadd(rangeKey, {
      score: email.historyId,
      member: email.id
    })
    
    return NextResponse.json({
      success: true,
      message: 'Email added successfully',
      emailId: email.id
    })
  } catch (error) {
    console.error('Error adding email:', error)
    return NextResponse.json(
      { error: 'Failed to add email' },
      { status: 500 }
    )
  }
}

// PUT - Force refresh all emails from Redis
export async function PUT() {
  try {
    // Import all existing emails
    const imported = await emailStore.importExistingEmails()
    
    // Get all emails
    const allEmails = await emailStore.getAllEmails()
    
    // Find the max history ID
    let maxHistoryId = 0
    for (const email of allEmails) {
      if (email.historyId > maxHistoryId) {
        maxHistoryId = email.historyId
      }
    }
    
    // Update last history ID
    if (maxHistoryId > 0) {
      await emailStore.setLastHistoryId(maxHistoryId)
    }
    
    console.log(`🔄 Force refresh: ${imported} imported, ${allEmails.length} total`)
    
    return NextResponse.json({
      success: true,
      imported,
      totalEmails: allEmails.length,
      maxHistoryId,
      emails: allEmails
    })
  } catch (error) {
    console.error('Force refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to force refresh emails' },
      { status: 500 }
    )
  }
}