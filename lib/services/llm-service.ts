// /lib/services/llm-service.ts
// OpenAI GPT-5 integration service for Amara QUO
// Simplified implementation using Responses API

import { ProcessedEmail } from '@/lib/kv-client'

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
  private systemPrompt: string
  private maxRetries: number = 3
  private baseDelay: number = 1000

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.model = process.env.OPENAI_MODEL || 'gpt-5-nano'
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '1000')
    this.systemPrompt = process.env.SYSTEM_PROMPT || this.getDefaultSystemPrompt()

    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured')
    }

    console.log('🤖 GPT-5 Service initialized:', {
      model: this.model,
      maxTokens: this.maxTokens,
      hasApiKey: !!this.apiKey
    })
  }

  private getDefaultSystemPrompt(): string {
    return `You are Amara QUO, a savvy and professional sales rep.
1. Analyze incoming emails and understand their context and urgency
2. Provide a quote or response based on your knowledge of domain and data
3. Keep responses under 150 words unless complexity demands more
Always be respectful, clear, and actionable in your responses.`
  }
  
  /**
   * Process an email with GPT-5
   */
  async processEmail(email: ProcessedEmail): Promise<LLMResponse> {
    const startTime = Date.now()
    
    const input = [
      { role: 'system', content: this.systemPrompt },
      { 
        role: 'user', 
        content: `From: ${email.from}
Subject: ${email.subject}
Received: ${new Date(email.receivedAt).toLocaleString()}

Message:
${email.body || email.snippet}

Please analyze this email and provide an appropriate response.`
      }
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

      // Extract content from response
      let content = ''
      
      // Simple extraction - look for output_text first
      if (data.output_text) {
        content = data.output_text
      } 
      // Then check output array for message
      else if (data.output && Array.isArray(data.output)) {
        for (const output of data.output) {
          if (output.type === 'message' && output.content?.[0]?.text) {
            content = output.content[0].text
            break
          }
        }
      }
      
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
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' }
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      })

      if (response.ok) {
        return { success: true, message: 'Connection successful' }
      } else {
        return { success: false, message: `Failed: ${response.status}` }
      }
    } catch (error) {
      return { success: false, message: `Error: ${(error as Error).message}` }
    }
  }
}

// Export singleton instance
export const llmService = new LLMService()