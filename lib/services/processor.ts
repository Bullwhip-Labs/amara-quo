// /lib/services/processor.ts
// Core email processing engine with Resend integration
// Automatically sends responses after successful LLM processing

import { emailStore, type ProcessedEmail, type EmailStatus } from '@/lib/kv-client'
import { llmFactory } from './llm-factory'
import { emailService } from './email-service'
import type { LLMResponse, LLMError } from './llm-service'

export type ProcessingStatus = EmailStatus

export interface ProcessingResult {
  emailId: string
  status: ProcessingStatus
  response?: string
  tokenUsage?: LLMResponse['tokenUsage']
  processingTime?: number
  error?: string
  processedAt: string
  emailSent?: boolean
  deliveryMessageId?: string
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
  private maxConcurrent: number = 1
  private currentlyProcessing: Set<string> = new Set()

  /**
   * Process a single email with comprehensive logging and email delivery
   */
  async processEmail(emailId: string, isRerun: boolean = false): Promise<ProcessingResult> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🚀 ${isRerun ? 'RERUNNING' : 'STARTING'} EMAIL PROCESSING`)
    console.log(`📧 Email ID: ${emailId}`)
    console.log(`⏰ Time: ${new Date().toISOString()}`)
    if (isRerun) {
      console.log(`🔄 This is a RERUN - previous response will be replaced`)
    }
    console.log(`${'='.repeat(60)}\n`)
    
    try {
      // Step 1: Get email from KV store
      console.log(`📥 Step 1: Fetching email from KV store...`)
      const email = await emailStore.getEmail(emailId)
      if (!email) {
        throw new Error('Email not found')
      }

      console.log(`✅ Email retrieved:`, {
        id: email.id,
        subject: email.subject,
        from: email.from,
        currentStatus: email.status,
        hasExistingResponse: !!email.response,
        bodyLength: email.body?.length || 0,
        snippetLength: email.snippet?.length || 0
      })

      // Step 2: Update status to processing
      console.log(`\n📝 Step 2: Updating status to 'processing'...`)
      await emailStore.updateEmailStatus(emailId, 'processing')
      console.log(`✅ Status updated to: processing`)

      // Step 3: Process with LLM
      console.log(`\n🤖 Step 3: Calling LLM service...`)
      console.log(`📋 Email content being sent:`)
      console.log(`   Subject: ${email.subject}`)
      console.log(`   Body preview: ${(email.body || email.snippet).substring(0, 100)}...`)
      
      const llmService = llmFactory.getService()
      const llmResponse = await llmService.processEmail(email)

      // Log the FULL response
      console.log(`\n✨ Step 4: LLM Response Received`)
      console.log(`${'='.repeat(60)}`)
      console.log(`📊 Response Stats:`)
      console.log(`   - Content Length: ${llmResponse.content.length} characters`)
      console.log(`   - Model: ${llmResponse.model}`)
      console.log(`   - Processing Time: ${llmResponse.processingTime}ms`)
      console.log(`   - Tokens:`, llmResponse.tokenUsage)
      console.log(`\n💬 FULL LLM RESPONSE:`)
      console.log(`${'='.repeat(60)}`)
      console.log(llmResponse.content || '[EMPTY RESPONSE]')
      console.log(`${'='.repeat(60)}\n`)

      // Step 5: Send email response
      console.log(`📧 Step 5: Sending email response...`)
      let emailSent = false
      let deliveryMessageId: string | undefined
      let deliveryStatus: ProcessedEmail['deliveryStatus'] = 'pending'
      let deliveryError: string | undefined

      if (emailService.isConfigured()) {
        const emailResult = await emailService.sendResponse(email, llmResponse.content)
        
        if (emailResult.success) {
          console.log(`✅ Email sent successfully!`)
          console.log(`   Message ID: ${emailResult.messageId}`)
          emailSent = true
          deliveryMessageId = emailResult.messageId
          deliveryStatus = 'sent'
        } else {
          console.warn(`⚠️ Email send failed: ${emailResult.error}`)
          deliveryError = emailResult.error
          deliveryStatus = 'failed'
          // Don't fail the entire processing if email sending fails
        }
      } else {
        console.log(`📧 Email service not configured - skipping email delivery`)
        const config = emailService.getConfiguration()
        console.log(`   Config:`, config)
      }

      // Step 6: Store the response with delivery status
      console.log(`\n💾 Step 6: Storing response and delivery status in KV...`)
      console.log(`   - Response length to store: ${llmResponse.content.length}`)
      console.log(`   - Email sent: ${emailSent}`)
      console.log(`   - Delivery status: ${deliveryStatus}`)
      
      await emailStore.updateEmailStatus(emailId, 'completed', {
        response: llmResponse.content,
        processedAt: new Date().toISOString(),
        tokenUsage: llmResponse.tokenUsage,
        processingTime: llmResponse.processingTime,
        category: llmResponse.category,
        deliveryStatus: deliveryStatus,
        deliveredAt: emailSent ? new Date().toISOString() : undefined,
        error: deliveryError // Store delivery error if any
      })

      console.log(`✅ Response stored with status 'completed'`)

      // Step 7: Verify the response was stored
      console.log(`\n🔍 Step 7: Verifying stored response...`)
      const verifyEmail = await emailStore.getEmail(emailId)
      
      console.log(`📋 Verification Results:`)
      console.log(`   - Email found: ${!!verifyEmail}`)
      console.log(`   - Status: ${verifyEmail?.status}`)
      console.log(`   - Has response: ${!!verifyEmail?.response}`)
      console.log(`   - Response length: ${verifyEmail?.response?.length || 0}`)
      console.log(`   - Email sent: ${verifyEmail?.deliveryStatus === 'sent'}`)
      console.log(`   - Delivery status: ${verifyEmail?.deliveryStatus}`)
      
      if (verifyEmail?.response) {
        console.log(`\n💬 STORED RESPONSE PREVIEW:`)
        console.log(`${'='.repeat(60)}`)
        console.log(verifyEmail.response.substring(0, 200) + '...')
        console.log(`${'='.repeat(60)}\n`)
      } else {
        console.log(`\n⚠️ WARNING: Response was not found in verification!`)
        console.log(`   This indicates a storage issue.`)
      }

      // Final summary
      console.log(`\n${'='.repeat(60)}`)
      console.log(`🎉 PROCESSING COMPLETE`)
      console.log(`📊 Summary:`)
      console.log(`   - Email ID: ${emailId}`)
      console.log(`   - Status: completed`)
      console.log(`   - Response stored: ${!!verifyEmail?.response}`)
      console.log(`   - Email sent: ${emailSent}`)
      console.log(`   - Delivery ID: ${deliveryMessageId || 'N/A'}`)
      console.log(`   - Tokens used: ${llmResponse.tokenUsage.total}`)
      console.log(`   - Time: ${llmResponse.processingTime}ms`)
      console.log(`${'='.repeat(60)}\n`)

      return {
        emailId,
        status: 'completed',
        response: llmResponse.content,
        tokenUsage: llmResponse.tokenUsage,
        processingTime: llmResponse.processingTime,
        processedAt: new Date().toISOString(),
        emailSent,
        deliveryMessageId
      }
      
    } catch (error) {
      console.error(`\n${'='.repeat(60)}`)
      console.error(`❌ PROCESSING FAILED`)
      console.error(`📧 Email ID: ${emailId}`)
      console.error(`🔴 Error:`, error)
      console.error(`${'='.repeat(60)}\n`)
      
      const errorMessage = this.getErrorMessage(error)
      const shouldRetry = this.shouldRetry(error as LLMError)
      const status: ProcessingStatus = shouldRetry ? 'failed' : 'manual-review'
      
      await emailStore.updateEmailStatus(emailId, status, {
        error: errorMessage,
        processedAt: new Date().toISOString(),
        deliveryStatus: 'failed'
      })

      return {
        emailId,
        status,
        error: errorMessage,
        processedAt: new Date().toISOString(),
        emailSent: false
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
      const pendingIds = await emailStore.getPendingEmails()
      console.log(`📬 Found ${pendingIds.length} pending emails`)

      for (const emailId of pendingIds) {
        if (this.currentlyProcessing.has(emailId)) {
          continue
        }

        this.currentlyProcessing.add(emailId)
        
        try {
          const result = await this.processEmail(emailId)
          results.push(result)
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
    console.log(`\n🔄 RETRYING EMAIL: ${emailId}`)
    
    const email = await emailStore.getEmail(emailId)
    if (!email) {
      throw new Error('Email not found')
    }

    console.log(`📊 Current status: ${email.status}`)
    
    if (email.status !== 'failed' && email.status !== 'manual-review') {
      throw new Error(`Cannot retry email with status: ${email.status}`)
    }

    await emailStore.updateEmailStatus(emailId, 'pending', {
      error: undefined,
      deliveryStatus: undefined,
      deliveredAt: undefined
    })

    return this.processEmail(emailId)
  }

  async getStatus(emailId: string): Promise<ProcessingStatus | null> {
    const email = await emailStore.getEmail(emailId)
    if (!email) return null
    return email.status
  }

  private shouldRetry(error: LLMError): boolean {
    if (!error?.code) return true
    const nonRetryableCodes = ['invalid_request']
    return !nonRetryableCodes.includes(error.code)
  }

  private getErrorMessage(error: any): string {
    if (typeof error === 'string') return error
    if (error?.message) return error.message
    if (error?.error) return error.error
    return 'Unknown error occurred'
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async getQueueStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    totalProcessed: number
    emailsSent: number
  }> {
    const allEmails = await emailStore.getAllEmails()
    
    const stats = {
      pending: allEmails.filter(e => e.status === 'pending').length,
      processing: allEmails.filter(e => e.status === 'processing').length,
      completed: allEmails.filter(e => e.status === 'completed').length,
      failed: allEmails.filter(e => e.status === 'failed' || e.status === 'manual-review').length,
      totalProcessed: allEmails.filter(e => e.status === 'completed' || e.status === 'failed' || e.status === 'manual-review').length,
      emailsSent: allEmails.filter(e => e.deliveryStatus === 'sent').length
    }

    return stats
  }

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
    const llmService = llmFactory.getService()
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

  /**
   * Get email service configuration
   */
  getEmailServiceConfig() {
    return emailService.getConfiguration()
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor()