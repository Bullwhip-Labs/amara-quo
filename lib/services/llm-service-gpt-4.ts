// /lib/services/llm-service-gpt-4.ts
// OpenAI GPT-4 integration service with structured outputs
// Supports gpt-4o-mini and gpt-4o models

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
  category?: string
  priority?: number
  sentiment?: string
}

export interface LLMError {
  code: 'rate_limit' | 'api_error' | 'invalid_request' | 'timeout' | 'empty_response'
  message: string
  retryAfter?: number
}

interface StructuredResponse {
  response: string
  category: string
  priority: number
  requires_followup: boolean
  sentiment: string
  suggested_actions: string[]
}

class LLMGPT4Service {
  private apiKey: string
  private model: string
  private maxTokens: number
  private useStructuredOutput: boolean
  private maxRetries: number = 3
  private baseDelay: number = 1000

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500')
    this.useStructuredOutput = process.env.USE_STRUCTURED_OUTPUT === 'true'

    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured')
    }

    // Validate model is GPT-4 series
    if (!this.model.includes('gpt-4')) {
      console.warn(`⚠️ Model ${this.model} is not a GPT-4 series model. Use llm-service.ts for GPT-5 models.`)
    }

    console.log('🤖 GPT-4 Service initialized:', {
      model: this.model,
      maxTokens: this.maxTokens,
      useStructuredOutput: this.useStructuredOutput,
      hasApiKey: !!this.apiKey
    })
  }

  /**
   * Process an email with GPT-4
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

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]

    console.log('📝 Processing email with GPT-4:', email.subject)

    try {
      const response = await this.callGPT4API(messages)
      
      if (!response.content || response.content.trim().length === 0) {
        throw { code: 'empty_response', message: 'Received empty response from GPT-4' }
      }

      console.log('✅ GPT-4 Response received:', {
        contentLength: response.content.length,
        tokens: response.tokenUsage,
        category: response.category,
        priority: response.priority
      })
      
      return {
        ...response,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('GPT-4 processing failed:', error)
      throw this.normalizeError(error)
    }
  }

  /**
   * Call GPT-4 Chat Completions API
   */
  private async callGPT4API(messages: any[], attempt: number = 1): Promise<LLMResponse> {
    try {
      // Build request body based on configuration
      const requestBody: any = {
        model: this.model,
        messages: messages,
        temperature: 0.7
      }

      // Add structured output if enabled and model supports it
      if (this.useStructuredOutput && this.supportsStructuredOutput()) {
        requestBody.response_format = LLMPrompts.getStructuredOutputSchema()
        // For structured outputs, we need higher token limit
        requestBody.max_tokens = Math.max(this.maxTokens, 1000)
      } else {
        requestBody.max_tokens = this.maxTokens
      }

      console.log(`📤 GPT-4 API call (attempt ${attempt}, structured=${this.useStructuredOutput})`)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

        // Retry logic for rate limits
        if (response.status === 429 && attempt < this.maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60')
          console.log(`⏰ Rate limited, retrying in ${retryAfter}s`)
          await this.delay(retryAfter * 1000)
          return this.callGPT4API(messages, attempt + 1)
        }

        // Retry for server errors
        if (response.status >= 500 && attempt < this.maxRetries) {
          const delayMs = this.baseDelay * Math.pow(2, attempt - 1)
          console.log(`⏰ Server error, retrying in ${delayMs}ms`)
          await this.delay(delayMs)
          return this.callGPT4API(messages, attempt + 1)
        }

        throw {
          code: response.status === 429 ? 'rate_limit' : 
                response.status >= 500 ? 'api_error' : 'invalid_request',
          message: `GPT-4 API error: ${response.status}`
        }
      }

      const data = await response.json()
      
      // Parse response based on whether structured output was used
      let content: string
      let category: string | undefined
      let priority: number | undefined
      let sentiment: string | undefined

      if (this.useStructuredOutput && data.choices?.[0]?.message?.content) {
        try {
          const structured: StructuredResponse = JSON.parse(data.choices[0].message.content)
          content = structured.response
          category = structured.category
          priority = structured.priority
          sentiment = structured.sentiment
          
          console.log('📊 Structured output parsed:', {
            category,
            priority,
            sentiment,
            requiresFollowup: structured.requires_followup,
            actionsCount: structured.suggested_actions.length
          })
        } catch (parseError) {
          // Fallback to plain text if JSON parsing fails
          console.warn('Failed to parse structured output, using plain text')
          content = data.choices[0].message.content
        }
      } else {
        // Plain text response
        content = data.choices?.[0]?.message?.content || ''
      }
      
      if (!content) {
        console.error('❌ No content found in GPT-4 response')
        throw { code: 'empty_response', message: 'No content in GPT-4 response' }
      }
      
      return {
        content: content,
        tokenUsage: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0
        },
        model: data.model || this.model,
        processingTime: 0,
        category,
        priority,
        sentiment
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
        return this.callGPT4API(messages, attempt + 1)
      }
      
      throw {
        code: 'timeout',
        message: 'Network error: ' + (error as Error).message
      }
    }
  }

  /**
   * Check if model supports structured outputs
   */
  private supportsStructuredOutput(): boolean {
    const supportedModels = ['gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'gpt-4o-2024-08-06']
    return supportedModels.some(model => this.model.includes(model))
  }

  /**
   * Normalize errors to standard format
   */
  private normalizeError(error: unknown): LLMError {
    if (error && typeof error === 'object' && 'code' in error) {
      return error as LLMError
    }
    return {
      code: 'api_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Calculate cost for GPT-4 models
   */
  calculateCost(tokenUsage: { prompt: number; completion: number; total: number }): number {
    // GPT-4 pricing per 1K tokens (not 1M like GPT-5)
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.0025, output: 0.01 },          // $2.50/$10 per 1M
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },  // $0.15/$0.60 per 1M
      'gpt-4-turbo': { input: 0.01, output: 0.03 },       // $10/$30 per 1M
      'gpt-4': { input: 0.03, output: 0.06 }              // $30/$60 per 1M
    }
    
    // Find matching pricing tier
    let pricing = costs['gpt-4o-mini'] // default
    for (const [modelKey, modelCosts] of Object.entries(costs)) {
      if (this.model.includes(modelKey)) {
        pricing = modelCosts
        break
      }
    }
    
    // Convert to per-1M tokens and calculate
    const promptCost = (tokenUsage.prompt / 1000000) * (pricing.input * 1000)
    const completionCost = (tokenUsage.completion / 1000000) * (pricing.output * 1000)
    
    return promptCost + completionCost
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' }
      }

      // Test with a simple completion
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: LLMPrompts.getTestPrompt() },
            { role: 'user', content: 'Say "Hello, GPT-4 connection test successful!"' }
          ],
          max_tokens: 20
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
export const llmGPT4Service = new LLMGPT4Service()