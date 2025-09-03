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

// Define status type separately for clarity
export type EmailStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'manual-review'

export interface ProcessedEmail extends EmailRecord {
  status: EmailStatus
  processedAt?: string
  error?: string
  response?: string
  category?: string
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
  processingTime?: number
  deliveryStatus?: 'pending' | 'sent' | 'failed'
  deliveredAt?: string
}

// Key patterns for KV storage - matching your existing gmail: prefix
const KEYS = {
  EMAIL: (id: string) => `gmail:email:${id}`,
  EMAIL_STATUS: (id: string) => `gmail:email:${id}:status`,
  EMAIL_RESPONSE: (id: string) => `gmail:email:${id}:response`,
  EMAIL_METADATA: (id: string) => `gmail:email:${id}:metadata`,
  EMAIL_QUEUE: 'gmail:email:queue',
  PROCESSING_QUEUE: 'gmail:email:processing:queue',
  LAST_HISTORY_ID: 'gmail:email:last_history_id',
  ALL_EMAILS: 'gmail:email:all',
  TOKEN_USAGE: 'gmail:stats:token_usage',
  PROCESSING_STATS: 'gmail:stats:processing'
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
                 !keyStr.includes(':metadata') &&
                 !keyStr.includes(':queue') &&
                 !keyStr.includes(':all') &&
                 !keyStr.includes(':last_history_id') &&
                 !keyStr.includes(':processing')
        })
        .map(key => {
          const keyStr = key as string
          return keyStr.replace('gmail:email:', '')
        })
      
      // Add discovered emails to our set for future use
      if (emailIds.length > 0) {
        // Add each email ID individually to avoid TypeScript spread issues
        for (const emailId of emailIds) {
          await kv.sadd(KEYS.ALL_EMAILS, emailId)
        }
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

  // Get single email with status and response
  async getEmail(id: string): Promise<ProcessedEmail | null> {
    const [emailData, status, response] = await Promise.all([
      kv.get<EmailRecord>(KEYS.EMAIL(id)),
      kv.get<{
        status: EmailStatus
        processedAt?: string
        error?: string
        response?: string
        category?: string
        tokenUsage?: ProcessedEmail['tokenUsage']
        processingTime?: number
        deliveryStatus?: ProcessedEmail['deliveryStatus']
        deliveredAt?: string
      }>(KEYS.EMAIL_STATUS(id)),
      kv.get<string>(KEYS.EMAIL_RESPONSE(id))
    ])

    if (!emailData) return null

    return {
      ...emailData,
      status: status?.status || 'pending',
      processedAt: status?.processedAt,
      error: status?.error,
      response: response || status?.response,
      category: status?.category,
      tokenUsage: status?.tokenUsage,
      processingTime: status?.processingTime,
      deliveryStatus: status?.deliveryStatus,
      deliveredAt: status?.deliveredAt
    }
  },

  // Store new email
  async storeEmail(email: EmailRecord): Promise<void> {
    await Promise.all([
      kv.set(KEYS.EMAIL(email.id), email),
      kv.set(KEYS.EMAIL_STATUS(email.id), { status: 'pending' as EmailStatus }),
      kv.sadd(KEYS.ALL_EMAILS, email.id),
      kv.zadd(KEYS.EMAIL_QUEUE, {
        score: new Date(email.receivedAt).getTime(),
        member: email.id,
      })
    ])
  },

  // Update email status with LLM response data
  async updateEmailStatus(
    id: string, 
    status: EmailStatus,
    metadata?: {
      error?: string
      response?: string
      category?: string
      processedAt?: string
      tokenUsage?: ProcessedEmail['tokenUsage']
      processingTime?: number
      deliveryStatus?: ProcessedEmail['deliveryStatus']
      deliveredAt?: string
    }
  ): Promise<void> {
    const currentStatus = await kv.get<any>(KEYS.EMAIL_STATUS(id)) || {}
    
    const statusData = {
      ...currentStatus,
      status,
      ...(metadata?.processedAt ? { processedAt: metadata.processedAt } : {}),
      ...(metadata?.error !== undefined ? { error: metadata.error } : {}),
      ...(metadata?.response !== undefined ? { response: metadata.response } : {}), // Store response here too
      ...(metadata?.category ? { category: metadata.category } : {}),
      ...(metadata?.tokenUsage ? { tokenUsage: metadata.tokenUsage } : {}),
      ...(metadata?.processingTime !== undefined ? { processingTime: metadata.processingTime } : {}),
      ...(metadata?.deliveryStatus ? { deliveryStatus: metadata.deliveryStatus } : {}),
      ...(metadata?.deliveredAt ? { deliveredAt: metadata.deliveredAt } : {})
    }

    await kv.set(KEYS.EMAIL_STATUS(id), statusData)

    // Also store response separately for larger responses
    if (metadata?.response) {
      await kv.set(KEYS.EMAIL_RESPONSE(id), metadata.response)
      console.log(`💾 Stored response for email ${id} in both status and response keys`)
    }

    // Update processing queue
    if (status === 'processing') {
      await kv.zadd(KEYS.PROCESSING_QUEUE, {
        score: Date.now(),
        member: id
      })
    } else if (status === 'completed' || status === 'failed') {
      await kv.zrem(KEYS.PROCESSING_QUEUE, id)
    }

    // Update token usage stats
    if (metadata?.tokenUsage) {
      await this.updateTokenUsage(metadata.tokenUsage)
    }
  },

  // Update global token usage statistics
  async updateTokenUsage(usage: ProcessedEmail['tokenUsage']): Promise<void> {
    if (!usage) return
    
    const current = await kv.get<{
      totalPrompt: number
      totalCompletion: number
      totalTokens: number
      emailsProcessed: number
      lastUpdated: string
    }>(KEYS.TOKEN_USAGE) || {
      totalPrompt: 0,
      totalCompletion: 0,
      totalTokens: 0,
      emailsProcessed: 0,
      lastUpdated: new Date().toISOString()
    }

    await kv.set(KEYS.TOKEN_USAGE, {
      totalPrompt: current.totalPrompt + usage.prompt,
      totalCompletion: current.totalCompletion + usage.completion,
      totalTokens: current.totalTokens + usage.total,
      emailsProcessed: current.emailsProcessed + 1,
      lastUpdated: new Date().toISOString()
    })
  },

  // Get token usage statistics
  async getTokenUsageStats(): Promise<{
    totalPrompt: number
    totalCompletion: number
    totalTokens: number
    emailsProcessed: number
    averageTokensPerEmail: number
  }> {
    const stats = await kv.get<{
      totalPrompt: number
      totalCompletion: number
      totalTokens: number
      emailsProcessed: number
    }>(KEYS.TOKEN_USAGE) || {
      totalPrompt: 0,
      totalCompletion: 0,
      totalTokens: 0,
      emailsProcessed: 0
    }

    return {
      ...stats,
      averageTokensPerEmail: stats.emailsProcessed > 0 
        ? Math.round(stats.totalTokens / stats.emailsProcessed)
        : 0
    }
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

  // Get emails in processing queue
  async getProcessingQueue(): Promise<string[]> {
    const members = await kv.zrange(KEYS.PROCESSING_QUEUE, 0, -1)
    return members as string[]
  },

  // Get processing statistics
  async getProcessingStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    manualReview: number
    totalEmails: number
    successRate: number
  }> {
    const allEmails = await this.getAllEmails()
    
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      manualReview: 0,
      totalEmails: allEmails.length,
      successRate: 0
    }

    for (const email of allEmails) {
      switch (email.status) {
        case 'pending': stats.pending++; break
        case 'processing': stats.processing++; break
        case 'completed': stats.completed++; break
        case 'failed': stats.failed++; break
        case 'manual-review': stats.manualReview++; break
      }
    }

    const totalProcessed = stats.completed + stats.failed + stats.manualReview
    if (totalProcessed > 0) {
      stats.successRate = Math.round((stats.completed / totalProcessed) * 100)
    }

    return stats
  },

  // Scan and import existing emails (one-time migration)
  async importExistingEmails(): Promise<number> {
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

    let imported = 0
    for (const key of emailKeys) {
      const id = (key as string).replace('gmail:email:', '')
      const existsInSet = await kv.sismember(KEYS.ALL_EMAILS, id)
      
      if (!existsInSet) {
        await kv.sadd(KEYS.ALL_EMAILS, id)
        
        // Check if status exists, if not set to pending
        const statusExists = await kv.exists(KEYS.EMAIL_STATUS(id))
        if (!statusExists) {
          await kv.set(KEYS.EMAIL_STATUS(id), { status: 'pending' as EmailStatus })
        }
        
        imported++
      }
    }

    return imported
  }
}