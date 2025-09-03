// /lib/kv-client.ts
// Vercel KV (Upstash) client configuration and helper functions
// Provides methods for email data management and queue operations

import { kv } from '@vercel/kv'

// Email data types
export interface EmailRecord {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: string
  snippet: string
  body: string
  receivedAt: string
  historyId: number
}

export interface ProcessedEmail extends EmailRecord {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  processedAt?: string
  error?: string
  response?: string
  category?: string
}

// Key patterns for KV storage - matching your existing gmail: prefix
const KEYS = {
  EMAIL: (id: string) => `gmail:email:${id}`,
  EMAIL_STATUS: (id: string) => `gmail:email:${id}:status`,
  EMAIL_RESPONSE: (id: string) => `gmail:email:${id}:response`,
  EMAIL_QUEUE: 'gmail:email:queue',
  LAST_HISTORY_ID: 'gmail:email:last_history_id',
  ALL_EMAILS: 'gmail:email:all',
} as const

// Helper functions for email management
export const emailStore = {
  // Get all emails with their status - including scanning for existing emails
  async getAllEmails(): Promise<ProcessedEmail[]> {
    // First try to get from our set
    let emailIds = await kv.smembers(KEYS.ALL_EMAILS)
    
    // If no emails in set, scan for existing gmail:email:* keys
    if (!emailIds || emailIds.length === 0) {
      const allKeys = await kv.keys('gmail:email:*')
      emailIds = allKeys
        .filter(key => {
          // Only get base email keys, not status or response keys
          const keyStr = key as string
          return keyStr.startsWith('gmail:email:') && 
                 !keyStr.includes(':status') && 
                 !keyStr.includes(':response') &&
                 !keyStr.includes(':queue') &&
                 !keyStr.includes(':all') &&
                 !keyStr.includes(':last_history_id')
        })
        .map(key => {
          const keyStr = key as string
          return keyStr.replace('gmail:email:', '')
        })
      
      // Add discovered emails to our set for future use
      if (emailIds.length > 0) {
        await kv.sadd(KEYS.ALL_EMAILS, ...emailIds)
      }
    }

    if (!emailIds || emailIds.length === 0) return []

    const emails: ProcessedEmail[] = []
    for (const id of emailIds) {
      const email = await this.getEmail(id as string)
      if (email) emails.push(email)
    }

    return emails.sort((a, b) => 
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    )
  },

  // Get single email with status
  async getEmail(id: string): Promise<ProcessedEmail | null> {
    const [emailData, status] = await Promise.all([
      kv.get<EmailRecord>(KEYS.EMAIL(id)),
      kv.get<{
        status: ProcessedEmail['status']
        processedAt?: string
        error?: string
        response?: string
        category?: string
      }>(KEYS.EMAIL_STATUS(id))
    ])

    if (!emailData) return null

    return {
      ...emailData,
      status: status?.status || 'pending',
      processedAt: status?.processedAt,
      error: status?.error,
      response: status?.response,
      category: status?.category,
    }
  },

  // Store new email
  async storeEmail(email: EmailRecord): Promise<void> {
    await Promise.all([
      kv.set(KEYS.EMAIL(email.id), email),
      kv.set(KEYS.EMAIL_STATUS(email.id), { status: 'pending' }),
      kv.sadd(KEYS.ALL_EMAILS, email.id),
      kv.zadd(KEYS.EMAIL_QUEUE, {
        score: new Date(email.receivedAt).getTime(),
        member: email.id,
      })
    ])
  },

  // Update email status
  async updateEmailStatus(
    id: string, 
    status: ProcessedEmail['status'],
    metadata?: {
      error?: string
      response?: string
      category?: string
    }
  ): Promise<void> {
    const statusData = {
      status,
      ...(status === 'completed' || status === 'failed' 
        ? { processedAt: new Date().toISOString() } 
        : {}),
      ...metadata,
    }

    await kv.set(KEYS.EMAIL_STATUS(id), statusData)
  },

  // Get last processed history ID
  async getLastHistoryId(): Promise<number> {
    const lastId = await kv.get<number>(KEYS.LAST_HISTORY_ID)
    return lastId || 0
  },

  // Update last processed history ID
  async setLastHistoryId(historyId: number): Promise<void> {
    await kv.set(KEYS.LAST_HISTORY_ID, historyId)
  },

  // Get pending emails
  async getPendingEmails(): Promise<string[]> {
    const emailIds = await kv.smembers(KEYS.ALL_EMAILS)
    const pending: string[] = []

    for (const id of emailIds) {
      const status = await kv.get<{ status: string }>(KEYS.EMAIL_STATUS(id as string))
      if (!status || status?.status === 'pending') {
        pending.push(id as string)
      }
    }

    return pending
  },

  // Scan and import existing emails (one-time migration)
  async importExistingEmails(): Promise<number> {
    const allKeys = await kv.keys('gmail:email:*')
    const emailKeys = allKeys.filter(key => {
      const keyStr = key as string
      return keyStr.startsWith('gmail:email:') && 
             !keyStr.includes(':status') && 
             !keyStr.includes(':response') &&
             !keyStr.includes(':queue') &&
             !keyStr.includes(':all') &&
             !keyStr.includes(':last_history_id')
    })

    let imported = 0
    for (const key of emailKeys) {
      const id = (key as string).replace('gmail:email:', '')
      const existsInSet = await kv.sismember(KEYS.ALL_EMAILS, id)
      
      if (!existsInSet) {
        await kv.sadd(KEYS.ALL_EMAILS, id)
        
        // Check if status exists, if not set to pending
        const statusExists = await kv.exists(KEYS.EMAIL_STATUS(id))
        if (!statusExists) {
          await kv.set(KEYS.EMAIL_STATUS(id), { status: 'pending' })
        }
        
        imported++
      }
    }

    return imported
  }
}