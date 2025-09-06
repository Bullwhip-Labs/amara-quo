// /lib/services/email-service.ts
// Pure email delivery service - delegates content formatting to email-wrapper
// Handles delivery logic, domain filtering, and template selection

import { Resend } from 'resend'
import { ProcessedEmail } from '@/lib/kv-client'
import { EmailWrapper, type EmailWrapperOptions } from './email-wrapper'

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
  sentAt?: string
}

class EmailService {
  private resend: Resend | null = null
  private fromEmail: string
  private fromName: string
  private enabled: boolean
  private testMode: boolean
  private allowedDomains: string[]
  private blockedDomains: string[]
  private emailWrapper: EmailWrapper

  constructor() {
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'amara@example.com'
    this.fromName = process.env.RESEND_FROM_NAME || 'Amara QUO'
    this.enabled = process.env.ENABLE_EMAIL_SENDING === 'true'
    this.testMode = process.env.EMAIL_TEST_MODE === 'true'
    
    this.allowedDomains = process.env.EMAIL_ALLOWED_DOMAINS?.split(',').map(d => d.trim()) || []
    this.blockedDomains = process.env.EMAIL_BLOCKED_DOMAINS?.split(',').map(d => d.trim()) || ['noreply', 'no-reply', 'donotreply']

    this.emailWrapper = new EmailWrapper()

    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && this.enabled) {
      this.resend = new Resend(apiKey)
      console.log('📧 Email service initialized')
    } else {
      console.warn('⚠️ Email service not initialized - missing API key or disabled')
    }
  }

  /**
   * Send email response with automatic template selection
   * Maintains backward compatibility with original API
   */
  async sendResponse(
    email: ProcessedEmail,
    responseContent: string,
    templateOverride?: 'standard' | 'urgent' | 'quote'
  ): Promise<EmailSendResult> {
    try {
      if (!this.enabled) {
        return { success: false, error: 'Email sending is disabled' }
      }

      if (!this.resend) {
        return { success: false, error: 'Resend client not initialized' }
      }

      const toEmail = this.extractEmailAddress(email.from)
      
      const { allowed, reason } = this.shouldSendToEmail(toEmail)
      if (!allowed) {
        console.log(`📧 Email blocked: ${toEmail} - ${reason}`)
        return { success: false, error: `Email blocked: ${reason}` }
      }

      // Select template based on content or override
      const template = templateOverride || this.selectTemplate(email.subject, responseContent)
      
      // Generate email content using wrapper
      const wrapperOptions: EmailWrapperOptions = {
        template,
        subject: `Re: ${email.subject}`
      }

      const emailContent = this.emailWrapper.wrapContent(responseContent, wrapperOptions)

      if (this.testMode) {
        console.log('📧 TEST MODE - Email would be sent:', {
          to: toEmail,
          subject: wrapperOptions.subject,
          template,
          contentLength: responseContent.length
        })
        return {
          success: true,
          messageId: `test-${Date.now()}`,
          sentAt: new Date().toISOString()
        }
      }

      console.log(`📧 Sending ${template} email to ${toEmail}...`)
      
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [toEmail],
        subject: wrapperOptions.subject,
        html: emailContent.html,
        text: emailContent.text,
        headers: {
          'X-Entity-Ref-ID': email.id,
          'X-Email-Template': template,
        },
        tags: [
          { name: 'email_id', value: email.id },
          { name: 'template', value: template },
        ]
      })

      if (result.error) {
        console.error('📧 Email send failed:', result.error)
        return { success: false, error: result.error.message }
      }

      console.log(`✅ Email sent: ${result.data?.id}`)
      
      return {
        success: true,
        messageId: result.data?.id,
        sentAt: new Date().toISOString()
      }

    } catch (error) {
      console.error('📧 Email service error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Select template based on email content
   */
  private selectTemplate(subject: string, responseContent: string): 'standard' | 'urgent' | 'quote' {
    const lowerSubject = subject.toLowerCase()
    const lowerContent = responseContent.toLowerCase()

    // Check for urgent indicators
    if (['urgent', 'asap', 'emergency', 'rush'].some(keyword => 
      lowerSubject.includes(keyword) || lowerContent.includes(keyword)
    )) {
      return 'urgent'
    }

    // Check for quote content (tables or pricing keywords)
    if (responseContent.includes('|') || ['quote', 'rate', 'price', '$'].some(keyword => 
      lowerSubject.includes(keyword) || lowerContent.includes(keyword)
    )) {
      return 'quote'
    }

    return 'standard'
  }

  private shouldSendToEmail(email: string): { allowed: boolean; reason?: string } {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) {
      return { allowed: false, reason: 'Invalid email address' }
    }

    for (const blocked of this.blockedDomains) {
      if (email.toLowerCase().includes(blocked)) {
        return { allowed: false, reason: `Blocked pattern: ${blocked}` }
      }
    }

    if (this.allowedDomains.length > 0) {
      const isAllowed = this.allowedDomains.some(allowed => 
        domain === allowed || email.toLowerCase().includes(allowed)
      )
      if (!isAllowed) {
        return { allowed: false, reason: 'Domain not in allowed list' }
      }
    }

    return { allowed: true }
  }

  private extractEmailAddress(fromField: string): string {
    const match = fromField.match(/<([^>]+)>/)
    return match ? match[1] : fromField
  }

  /**
   * Send test email
   */
  async sendTestEmail(toEmail: string, template: 'standard' | 'urgent' | 'quote' = 'quote'): Promise<EmailSendResult> {
    const testEmail: ProcessedEmail = {
      id: 'test-' + Date.now(),
      threadId: 'test-thread',
      subject: 'Test Freight Quote from Amara QUO',
      from: toEmail,
      to: this.fromEmail,
      date: new Date().toISOString(),
      snippet: 'Test email',
      body: 'Test email body',
      receivedAt: new Date().toISOString(),
      historyId: 0,
      status: 'completed'
    }

    const testContent = `
## Freight Quote Response

Thank you for your inquiry. Here are the **current rates**:

| Lane | Rate | Transit | Equipment |
|------|------|---------|-----------|
| Chicago → Los Angeles | **$2,450** | 3-4 days | Dry van, 53' |
| New York → Miami | **$1,890** | 2-3 days | Dry van, 53' |

### Important Notes:
* All rates include *fuel surcharge* & capacity confirmation
* **Equipment availability**: Confirmed for next week
  * Standard dry van, 53' length
  * Refrigerated units available on request
* Transit times are business days & exclude weekends

**Note**: Rates include fuel & are valid until end of week.

Best regards,  
**Fred - Amara QUO Freight Intelligence**
    `.trim()

    return this.sendResponse(testEmail, testContent, template)
  }

  isConfigured(): boolean {
    return this.enabled && !!this.resend
  }

  getConfiguration() {
    return {
      enabled: this.enabled,
      testMode: this.testMode,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
      hasApiKey: !!process.env.RESEND_API_KEY,
      templates: ['standard', 'urgent', 'quote']
    }
  }
}

export const emailService = new EmailService()