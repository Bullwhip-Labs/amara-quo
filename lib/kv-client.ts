// /lib/kv-client.ts
// Vercel KV client with minimal logging
// Clean version without verbose debug output

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

// Key patterns for KV storage
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
  // Get all emails with their status
  async getAllEmails(): Promise<ProcessedEmail[]> {
    let emailIds = await kv.smembers(KEYS.ALL_EMAILS)
    
    if (!emailIds || emailIds.length === 0) {
      const allKeys = await kv.keys('gmail:email:*')
      emailIds = allKeys
        .filter(key => {
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
      
      if (emailIds.length > 0) {
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

  // Get single email with status and response - SILENT
  async getEmail(id: string): Promise<ProcessedEmail | null> {
    const [emailData, statusData, responseData] = await Promise.all([
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

    if (!emailData) {
      return null
    }

    // Get response from either location
    const response = responseData || statusData?.response

    return {
      ...emailData,
      status: statusData?.status || 'pending',
      processedAt: statusData?.processedAt,
      error: statusData?.error,
      response: response,
      category: statusData?.category,
      tokenUsage: statusData?.tokenUsage,
      processingTime: statusData?.processingTime,
      deliveryStatus: statusData?.deliveryStatus,
      deliveredAt: statusData?.deliveredAt
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

  // Update email status with LLM response data - MINIMAL LOGGING
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
    // Only log significant updates (with responses or errors)
    if (metadata?.response !== undefined || metadata?.error) {
      console.log(`📝 Updating email ${id}: status=${status}${metadata?.response ? ` response=${metadata.response.length} chars` : ''}${metadata?.error ? ` error="${metadata.error}"` : ''}`)
    }

    const currentStatus = await kv.get<any>(KEYS.EMAIL_STATUS(id)) || {}
    
    const statusData = {
      ...currentStatus,
      status,
      ...(metadata?.processedAt !== undefined ? { processedAt: metadata.processedAt } : {}),
      ...(metadata?.error !== undefined ? { error: metadata.error } : {}),
      ...(metadata?.response !== undefined ? { response: metadata.response } : {}),
      ...(metadata?.category !== undefined ? { category: metadata.category } : {}),
      ...(metadata?.tokenUsage !== undefined ? { tokenUsage: metadata.tokenUsage } : {}),
      ...(metadata?.processingTime !== undefined ? { processingTime: metadata.processingTime } : {}),
      ...(metadata?.deliveryStatus !== undefined ? { deliveryStatus: metadata.deliveryStatus } : {}),
      ...(metadata?.deliveredAt !== undefined ? { deliveredAt: metadata.deliveredAt } : {})
    }

    // Store status data
    await kv.set(KEYS.EMAIL_STATUS(id), statusData)

    // Handle response storage/deletion
    if (metadata?.response !== undefined) {
      if (metadata.response) {
        // Store response in separate key
        await kv.set(KEYS.EMAIL_RESPONSE(id), metadata.response)
        
        // Only verify for actual LLM responses (not clearing)
        if (status === 'completed') {
          const verifyResponse = await kv.get<string>(KEYS.EMAIL_RESPONSE(id))
          if (!verifyResponse) {
            console.error(`⚠️ WARNING: Response storage verification failed for ${id}!`)
          }
        }
      } else {
        // Clear response when resetting
        await kv.del(KEYS.EMAIL_RESPONSE(id))
      }
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

  async getLastHistoryId(): Promise<number> {
    const lastId = await kv.get<number>(KEYS.LAST_HISTORY_ID)
    return lastId || 0
  },

  async setLastHistoryId(historyId: number): Promise<void> {
    await kv.set(KEYS.LAST_HISTORY_ID, historyId)
  },

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

  async getProcessingQueue(): Promise<string[]> {
    const members = await kv.zrange(KEYS.PROCESSING_QUEUE, 0, -1)
    return members as string[]
  },

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