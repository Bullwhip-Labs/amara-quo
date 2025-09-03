// /lib/services/llm-factory.ts
// Factory pattern for selecting the appropriate LLM service
// Automatically routes to GPT-4 or GPT-5 based on model configuration

import { llmService } from './llm-service'
import { llmGPT4Service } from './llm-service-gpt-4'
import { ProcessedEmail } from '@/lib/kv-client'

export interface ILLMService {
  processEmail(email: ProcessedEmail): Promise<{
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
  }>
  calculateCost(tokenUsage: { prompt: number; completion: number; total: number }): number
  testConnection(): Promise<{ success: boolean; message: string; model?: string }>
}

class LLMFactory {
  private service: ILLMService | null = null
  private modelType: 'gpt-4' | 'gpt-5' | 'unknown' = 'unknown'

  constructor() {
    this.initializeService()
  }

  private initializeService() {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    
    // Determine which service to use based on model name
    if (model.includes('gpt-5')) {
      console.log('🤖 Using GPT-5 service for model:', model)
      this.modelType = 'gpt-5'
      this.service = llmService
    } else if (model.includes('gpt-4')) {
      console.log('🤖 Using GPT-4 service for model:', model)
      this.modelType = 'gpt-4'
      this.service = llmGPT4Service
    } else {
      // Default to GPT-4 service for unknown models
      console.warn(`⚠️ Unknown model type: ${model}, defaulting to GPT-4 service`)
      this.modelType = 'gpt-4'
      this.service = llmGPT4Service
    }
  }

  /**
   * Get the appropriate LLM service
   */
  getService(): ILLMService {
    if (!this.service) {
      this.initializeService()
    }
    return this.service!
  }

  /**
   * Get the model type being used
   */
  getModelType(): 'gpt-4' | 'gpt-5' | 'unknown' {
    return this.modelType
  }

  /**
   * Process an email using the appropriate service
   */
  async processEmail(email: ProcessedEmail) {
    return this.getService().processEmail(email)
  }

  /**
   * Calculate cost using the appropriate pricing model
   */
  calculateCost(tokenUsage: { prompt: number; completion: number; total: number }): number {
    return this.getService().calculateCost(tokenUsage)
  }

  /**
   * Test the connection
   */
  async testConnection() {
    return this.getService().testConnection()
  }
}

// Export singleton instance
export const llmFactory = new LLMFactory()

// Export for backward compatibility
export const getLLMService = () => llmFactory.getService()