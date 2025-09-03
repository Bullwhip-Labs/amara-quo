// /app/api/emails/sync/route.ts
// API route to sync all existing emails from Upstash
// One-time import or force refresh functionality

import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { emailStore, type EmailRecord } from '@/lib/kv-client'

export async function POST() {
  try {
    console.log('🔄 Starting full email sync from Upstash...')
    
    // Get all email keys from Redis
    const allKeys = await kv.keys('gmail:email:*')
    console.log(`📊 Found ${allKeys.length} total keys in Redis`)
    
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
    
    console.log(`📧 Found ${emailKeys.length} email keys to sync`)
    
    let imported = 0
    let skipped = 0
    let failed = 0
    let maxHistoryId = 0
    
    for (const key of emailKeys) {
      try {
        const emailId = (key as string).replace('gmail:email:', '')
        
        // Check if already in our tracking set
        const existsInSet = await kv.sismember('gmail:email:all', emailId)
        
        if (existsInSet) {
          skipped++
          continue
        }
        
        // Get the email data
        const emailData = await kv.get<EmailRecord>(key as string)
        
        if (!emailData) {
          console.warn(`⚠️ No data found for key: ${key}`)
          failed++
          continue
        }
        
        // Store the email properly
        await emailStore.storeEmail(emailData)
        imported++
        
        // Track max history ID
        if (emailData.historyId > maxHistoryId) {
          maxHistoryId = emailData.historyId
        }
        
        // Also add to sorted set for efficient retrieval
        await kv.zadd('gmail:emails:by_history', {
          score: emailData.historyId,
          member: emailData.id
        })
        
        console.log(`✅ Imported: ${emailData.subject} (historyId: ${emailData.historyId})`)
        
      } catch (error) {
        console.error(`❌ Failed to import ${key}:`, error)
        failed++
      }
    }
    
    // Update the last history ID
    if (maxHistoryId > 0) {
      await emailStore.setLastHistoryId(maxHistoryId)
      console.log(`📈 Updated lastHistoryId to: ${maxHistoryId}`)
    }
    
    // Get final stats
    const allEmails = await emailStore.getAllEmails()
    const stats = await emailStore.getProcessingStats()
    
    console.log(`✅ Sync complete: ${imported} imported, ${skipped} skipped, ${failed} failed`)
    
    return NextResponse.json({
      success: true,
      sync: {
        imported,
        skipped,
        failed,
        totalKeys: emailKeys.length
      },
      current: {
        maxHistoryId,
        ...stats,
        totalEmails: allEmails.length  // Override the totalEmails from stats
      },
      emails: allEmails
    })
    
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to sync emails',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET - Check sync status
export async function GET() {
  try {
    // Check what's in Redis vs what's in our tracking
    const allKeys = await kv.keys('gmail:email:*')
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
    
    const trackedEmails = await kv.smembers('gmail:email:all')
    const lastHistoryId = await emailStore.getLastHistoryId()
    const allEmails = await emailStore.getAllEmails()
    
    // Find untracked emails
    const untrackedKeys: string[] = []
    for (const key of emailKeys) {
      const emailId = (key as string).replace('gmail:email:', '')
      if (!trackedEmails.includes(emailId)) {
        untrackedKeys.push(key as string)
      }
    }
    
    return NextResponse.json({
      redis: {
        totalKeys: allKeys.length,
        emailKeys: emailKeys.length,
        trackedEmails: trackedEmails.length,
        untrackedCount: untrackedKeys.length,
        untrackedKeys: untrackedKeys.slice(0, 10) // Show first 10
      },
      current: {
        totalEmails: allEmails.length,
        lastHistoryId,
        oldestEmail: allEmails[allEmails.length - 1]?.receivedAt,
        newestEmail: allEmails[0]?.receivedAt
      },
      needsSync: untrackedKeys.length > 0
    })
    
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check sync status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}