// /lib/services/llm-service.ts
// OpenAI GPT-5 integration service for Amara QUO
// Simplified implementation using Responses API

import { ProcessedEmail } from '@/lib/kv-client'
import { LLMPrompts } from './llm-prompts'

export interface LLMResponse {
  content: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  model: string
  processingTime: number
}

export interface LLMError {
  code: 'rate_limit' | 'api_error' | 'invalid_request' | 'timeout' | 'empty_response'
  message: string
  retryAfter?: number
}

class LLMService {
  private apiKey: string
  private model: string
  private maxTokens: number
  private maxRetries: number = 3
  private baseDelay: number = 1000

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.model = process.env.OPENAI_MODEL || 'gpt-5-nano'
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '1000')

    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured')
    }

    // Validate model is GPT-5 series
    if (!this.model.includes('gpt-5')) {
      console.warn(`⚠️ Model ${this.model} is not a GPT-5 series model. Consider using llm-service-gpt-4.ts for GPT-4 models.`)
    }

    console.log('🤖 GPT-5 Service initialized:', {
      model: this.model,
      maxTokens: this.maxTokens,
      hasApiKey: !!this.apiKey
    })
  }
  
  /**
   * Process an email with GPT-5
   */
  async processEmail(email: ProcessedEmail): Promise<LLMResponse> {
    const startTime = Date.now()
    
    // Use prompts from centralized location
    const systemPrompt = LLMPrompts.getSystemPrompt()
    const userContent = LLMPrompts.formatEmailForProcessing({
      from: email.from,
      subject: email.subject,
      receivedAt: email.receivedAt,
      body: email.body || email.snippet
    })
    
    const input = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]

    console.log('📝 Processing email:', email.subject)

    try {
      const response = await this.callGPT5(input)
      
      if (!response.content || response.content.trim().length === 0) {
        throw { code: 'empty_response', message: 'Received empty response from GPT-5' }
      }

      console.log('✅ Response received:', {
        contentLength: response.content.length,
        tokens: response.tokenUsage
      })
      
      return {
        ...response,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('GPT-5 processing failed:', error)
      throw this.normalizeError(error)
    }
  }

  /**
   * Call GPT-5 Responses API
   */
  private async callGPT5(input: any[], attempt: number = 1): Promise<LLMResponse> {
    try {
      // Simple request body - no reasoning
      const requestBody = {
        model: this.model,
        input: input,
        max_output_tokens: this.maxTokens
      }

      console.log(`📤 GPT-5 API call (attempt ${attempt})`)

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error:', response.status, errorText)

        // Retry logic for rate limits and server errors
        if (response.status === 429 && attempt < this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60')
          console.log(`⏰ Rate limited, retrying in ${retryAfter}s`)
          await this.delay(retryAfter * 1000)
          return this.callGPT5(input, attempt + 1)
        }

        if (response.status >= 500 && attempt < this.maxRetries) {
          const delayMs = this.baseDelay * Math.pow(2, attempt - 1)
          console.log(`⏰ Server error, retrying in ${delayMs}ms`)
          await this.delay(delayMs)
          return this.callGPT5(input, attempt + 1)
        }

        throw {
          code: response.status >= 500 ? 'api_error' : 'invalid_request',
          message: `GPT-5 API error: ${response.status}`
        }
      }

      const data = await response.json()
      
      // Check response status
      if (data.status === 'incomplete') {
        console.error('❌ Incomplete response:', data.incomplete_details)
        throw { 
          code: 'empty_response', 
          message: `Response incomplete: ${data.incomplete_details?.reason}` 
        }
      }

      // Extract content from response using centralized parser
      const content = LLMPrompts.parseModelResponse(data, 'gpt-5')
      
      if (!content) {
        console.error('❌ No text content found in response')
        console.log('Response structure:', JSON.stringify(data, null, 2))
        throw { code: 'empty_response', message: 'No text output from GPT-5' }
      }
      
      return {
        content: content,
        tokenUsage: {
          prompt: data.usage?.input_tokens || 0,
          completion: data.usage?.output_tokens || 0,
          total: data.usage?.total_tokens || 0
        },
        model: data.model || this.model,
        processingTime: 0
      }
    } catch (error) {
      if ((error as any).code) {
        throw error
      }
      
      // Network error retry
      if (attempt < this.maxRetries) {
        const delayMs = this.baseDelay * Math.pow(2, attempt - 1)
        console.log(`⏰ Network error, retrying in ${delayMs}ms`)
        await this.delay(delayMs)
        return this.callGPT5(input, attempt + 1)
      }
      
      throw {
        code: 'timeout',
        message: 'Network error: ' + (error as Error).message
      }
    }
  }

  /**
   * Normalize errors
   */
  private normalizeError(error: any): LLMError {
    if (error.code) {
      return error as LLMError
    }
    return {
      code: 'api_error',
      message: error.message || 'Unknown error occurred'
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Calculate cost for GPT-5
   */
  calculateCost(tokenUsage: { prompt: number; completion: number; total: number }): number {
    // GPT-5 pricing per 1M tokens
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-5': { input: 1.25, output: 5.00 },
      'gpt-5-mini': { input: 0.25, output: 1.00 },
      'gpt-5-nano': { input: 0.05, output: 0.40 }
    }
    
    const pricing = costs[this.model] || costs['gpt-5-nano']
    
    const promptCost = (tokenUsage.prompt / 1000000) * pricing.input
    const completionCost = (tokenUsage.completion / 1000000) * pricing.output
    
    return promptCost + completionCost
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' }
      }

      // Test with a simple request to the Responses API
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            { role: 'system', content: LLMPrompts.getTestPrompt() },
            { role: 'user', content: 'Say "Hello, GPT-5 connection test successful!"' }
          ],
          max_output_tokens: 20
        })
      })

      const data = await response.json()

      if (response.ok) {
        return { 
          success: true, 
          message: 'Connection successful',
          model: data.model || this.model
        }
      } else {
        return { 
          success: false, 
          message: `Failed: ${response.status} - ${data.error?.message || 'Unknown error'}`
        }
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Error: ${(error as Error).message}` 
      }
    }
  }
}

// Export singleton instance
export const llmService = new LLMService()