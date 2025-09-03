// /lib/services/processor.ts
// Core email processing engine for Amara QUO
// Orchestrates the LLM processing pipeline

import { emailStore, type ProcessedEmail, type EmailStatus } from '@/lib/kv-client'
import { llmService, type LLMResponse, type LLMError } from './llm-service'

// ProcessingStatus now matches EmailStatus exactly
export type ProcessingStatus = EmailStatus

export interface ProcessingResult {
  emailId: string
  status: ProcessingStatus
  response?: string
  tokenUsage?: LLMResponse['tokenUsage']
  processingTime?: number
  error?: string
  processedAt: string
}

export interface ProcessingQueueItem {
  emailId: string
  priority: number
  attempts: number
  lastAttempt?: string
  error?: string
}

class EmailProcessor {
  private isProcessing: boolean = false
  private processingQueue: ProcessingQueueItem[] = []
  private maxConcurrent: number = 1 // Start with sequential processing
  private currentlyProcessing: Set<string> = new Set()

  /**
   * Process a single email
   */
  async processEmail(emailId: string): Promise<ProcessingResult> {
    console.log(`🚀 Starting processing for email: ${emailId}`)
    
    try {
      // Get email from KV store
      const email = await emailStore.getEmail(emailId)
      if (!email) {
        throw new Error('Email not found')
      }

      // Update status to processing
      await emailStore.updateEmailStatus(emailId, 'processing')

      // Process with LLM
      const llmResponse = await llmService.processEmail(email)

      // Store the response - ensuring it's saved properly
      await emailStore.updateEmailStatus(emailId, 'completed', {
        response: llmResponse.content,
        processedAt: new Date().toISOString(),
        tokenUsage: llmResponse.tokenUsage,
        processingTime: llmResponse.processingTime
      })

      console.log(`✅ Successfully processed email: ${emailId}`)
      console.log(`📊 Tokens used: ${llmResponse.tokenUsage.total}`)
      console.log(`💬 Response preview: ${llmResponse.content.substring(0, 100)}...`)

      return {
        emailId,
        status: 'completed',
        response: llmResponse.content,
        tokenUsage: llmResponse.tokenUsage,
        processingTime: llmResponse.processingTime,
        processedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error(`❌ Failed to process email ${emailId}:`, error)
      
      const errorMessage = this.getErrorMessage(error)
      const shouldRetry = this.shouldRetry(error as LLMError)
      
      // Determine if manual review is needed
      const status: ProcessingStatus = shouldRetry ? 'failed' : 'manual-review'
      
      await emailStore.updateEmailStatus(emailId, status, {
        error: errorMessage,
        processedAt: new Date().toISOString()
      })

      return {
        emailId,
        status,
        error: errorMessage,
        processedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Process multiple emails from the queue
   */
  async processQueue(): Promise<ProcessingResult[]> {
    if (this.isProcessing) {
      console.log('⏸️ Processing already in progress')
      return []
    }

    this.isProcessing = true
    const results: ProcessingResult[] = []

    try {
      // Get pending emails
      const pendingIds = await emailStore.getPendingEmails()
      console.log(`📬 Found ${pendingIds.length} pending emails`)

      // Process each email sequentially (for now)
      for (const emailId of pendingIds) {
        if (this.currentlyProcessing.has(emailId)) {
          continue
        }

        this.currentlyProcessing.add(emailId)
        
        try {
          const result = await this.processEmail(emailId)
          results.push(result)
          
          // Small delay between processing to avoid rate limits
          await this.delay(1000)
        } finally {
          this.currentlyProcessing.delete(emailId)
        }
      }

      return results
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Retry failed email processing
   */
  async retryEmail(emailId: string): Promise<ProcessingResult> {
    console.log(`🔄 Retrying email: ${emailId}`)
    
    const email = await emailStore.getEmail(emailId)
    if (!email) {
      throw new Error('Email not found')
    }

    if (email.status !== 'failed' && email.status !== 'manual-review') {
      throw new Error(`Cannot retry email with status: ${email.status}`)
    }

    // Reset status to pending before reprocessing
    await emailStore.updateEmailStatus(emailId, 'pending', {
      error: undefined
    })

    return this.processEmail(emailId)
  }

  /**
   * Get processing status for an email
   */
  async getStatus(emailId: string): Promise<ProcessingStatus | null> {
    const email = await emailStore.getEmail(emailId)
    if (!email) return null

    // Status is already aligned with ProcessingStatus type
    return email.status
  }

  /**
   * Check if an error is retryable
   */
  private shouldRetry(error: LLMError): boolean {
    if (!error?.code) return true
    
    const nonRetryableCodes = ['invalid_request']
    return !nonRetryableCodes.includes(error.code)
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (typeof error === 'string') return error
    if (error?.message) return error.message
    if (error?.error) return error.error
    return 'Unknown error occurred'
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    totalProcessed: number
  }> {
    const allEmails = await emailStore.getAllEmails()
    
    return {
      pending: allEmails.filter(e => e.status === 'pending').length,
      processing: allEmails.filter(e => e.status === 'processing').length,
      completed: allEmails.filter(e => e.status === 'completed').length,
      failed: allEmails.filter(e => e.status === 'failed' || e.status === 'manual-review').length,
      totalProcessed: allEmails.filter(e => e.status === 'completed' || e.status === 'failed' || e.status === 'manual-review').length
    }
  }

  /**
   * Calculate total token usage for cost tracking
   */
  async getTotalTokenUsage(): Promise<{
    prompt: number
    completion: number
    total: number
    estimatedCost: number
  }> {
    const allEmails = await emailStore.getAllEmails()
    
    let totalPrompt = 0
    let totalCompletion = 0
    
    for (const email of allEmails) {
      if (email.tokenUsage) {
        totalPrompt += email.tokenUsage.prompt || 0
        totalCompletion += email.tokenUsage.completion || 0
      }
    }
    
    const total = totalPrompt + totalCompletion
    const estimatedCost = llmService.calculateCost({ 
      prompt: totalPrompt, 
      completion: totalCompletion, 
      total 
    })
    
    return {
      prompt: totalPrompt,
      completion: totalCompletion,
      total,
      estimatedCost
    }
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor()