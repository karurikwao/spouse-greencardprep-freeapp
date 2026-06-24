/**
 * AI Model Registry
 * 
 * Central registry of all supported AI models and providers.
 * No API keys are stored or checked here - that happens server-side.
 */

import type { AIProvider, AIModelOption, AIProviderConfig } from './types';

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const REGISTERED_MODELS: AIModelOption[] = [
  // Unified OpenAI-compatible gateway
  {
    provider: 'unified',
    modelId: 'auto',
    displayName: 'Unified Auto Router',
    description: 'Routes to the best available model from the configured OpenAI-compatible proxy',
    tier: 'budget',
    enabled: true,
    defaultForProvider: true,
    defaultForInterview: true,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    provider: 'unified',
    modelId: 'gemini-2.5-flash-lite',
    displayName: 'Gemini Flash Lite via Unified',
    description: 'Fast low-cost model exposed through the unified LLM proxy',
    tier: 'budget',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 1048576,
  },
  {
    provider: 'unified',
    modelId: 'deepseek-ai/deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash via Unified',
    description: 'DeepSeek fallback model exposed through the unified LLM proxy',
    tier: 'standard',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 131072,
  },

  // OpenAI Models
  {
    provider: 'openai',
    modelId: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    description: 'Fast and cost-effective for most interview practice',
    tier: 'budget',
    enabled: true,
    defaultForProvider: true,
    defaultForInterview: true,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    provider: 'openai',
    modelId: 'gpt-5.4',
    displayName: 'GPT-5.4',
    description: 'More nuanced feedback and detailed responses',
    tier: 'premium',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  
  // Anthropic Models
  {
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    displayName: 'Claude Haiku',
    description: 'Fast, lower-cost model for support and interview practice',
    tier: 'budget',
    enabled: true,
    defaultForProvider: true,
    maxTokens: 4096,
    contextWindow: 200000,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5-20251022',
    displayName: 'Claude Sonnet 4.5',
    description: 'Balanced performance and quality',
    tier: 'standard',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 200000,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4-5-20251101',
    displayName: 'Claude Opus 4.5',
    description: 'Highest quality for complex scenarios',
    tier: 'premium',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 200000,
  },
  
  // DeepSeek Models
  {
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    description: 'Efficient and capable',
    tier: 'budget',
    enabled: true,
    defaultForProvider: true,
    maxTokens: 4096,
    contextWindow: 64000,
  },
  {
    provider: 'deepseek',
    modelId: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    description: 'Enhanced reasoning capabilities',
    tier: 'standard',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 64000,
  },

  // NVIDIA NIM Models
  {
    provider: 'nvidia',
    modelId: 'meta/llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B on NVIDIA',
    description: 'Fast NVIDIA-hosted model for interview coaching',
    tier: 'budget',
    enabled: true,
    defaultForProvider: true,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  {
    provider: 'nvidia',
    modelId: 'meta/llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70B on NVIDIA',
    description: 'Higher-quality NVIDIA-hosted model for nuanced feedback',
    tier: 'premium',
    enabled: true,
    defaultForProvider: false,
    maxTokens: 4096,
    contextWindow: 128000,
  },
];

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

export const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig> = {
  unified: {
    provider: 'unified',
    enabled: true,
    apiKeyEnvVar: 'UNIFIED_LLM_API_KEY', // Server-side only (no VITE_ prefix)
    defaultModel: 'auto',
    fallbackModel: 'gemini-2.5-flash-lite',
  },
  openai: {
    provider: 'openai',
    enabled: true,
    apiKeyEnvVar: 'OPENAI_API_KEY', // Server-side only (no VITE_ prefix)
    defaultModel: 'gpt-5-mini',
    fallbackModel: 'gpt-5.4',
  },
  anthropic: {
    provider: 'anthropic',
    enabled: true,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY', // Server-side only (no VITE_ prefix)
    defaultModel: 'claude-3-haiku-20240307',
    fallbackModel: 'claude-sonnet-4-5-20251022',
  },
  deepseek: {
    provider: 'deepseek',
    enabled: true,
    apiKeyEnvVar: 'DEEPSEEK_API_KEY', // Server-side only (no VITE_ prefix)
    defaultModel: 'deepseek-chat',
    fallbackModel: 'deepseek-reasoner',
  },
  nvidia: {
    provider: 'nvidia',
    enabled: true,
    apiKeyEnvVar: 'NVIDIA_API_KEY', // Server-side only (no VITE_ prefix)
    defaultModel: 'meta/llama-3.1-8b-instruct',
    fallbackModel: 'meta/llama-3.3-70b-instruct',
  },
};

// ============================================================================
// REGISTRY FUNCTIONS
// ============================================================================

/**
 * Get all enabled models
 */
export function getEnabledModels(): AIModelOption[] {
  return REGISTERED_MODELS.filter(m => m.enabled);
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): AIProvider[] {
  const enabled = new Set<AIProvider>();
  for (const model of REGISTERED_MODELS) {
    if (model.enabled) {
      enabled.add(model.provider);
    }
  }
  return Array.from(enabled);
}

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(provider: AIProvider): AIModelOption[] {
  return REGISTERED_MODELS.filter(m => m.provider === provider && m.enabled);
}

/**
 * Get a specific model by ID
 */
export function getModelById(modelId: string): AIModelOption | undefined {
  return REGISTERED_MODELS.find(m => m.modelId === modelId && m.enabled);
}

/**
 * Get the default model for a provider
 */
export function getDefaultModelForProvider(provider: AIProvider): AIModelOption | undefined {
  return REGISTERED_MODELS.find(m => m.provider === provider && m.defaultForProvider && m.enabled);
}

/**
 * Get the global default interview model
 */
export function getDefaultInterviewModel(): AIModelOption {
  const defaultModel = REGISTERED_MODELS.find(m => m.defaultForInterview && m.enabled);
  if (defaultModel) return defaultModel;
  
  // Fallback to first enabled model
  const firstEnabled = REGISTERED_MODELS.find(m => m.enabled);
  if (firstEnabled) return firstEnabled;
  
  throw new Error('No AI models are enabled');
}

/**
 * Check if a provider is enabled
 * 
 * NOTE: This only checks the registry, not API key availability.
 * API keys are managed server-side in the edge function.
 */
export function isProviderEnabled(provider: AIProvider): boolean {
  const config = PROVIDER_CONFIGS[provider];
  if (!config.enabled) return false;
  
  // Also check if any models are enabled for this provider
  return REGISTERED_MODELS.some(m => m.provider === provider && m.enabled);
}

/**
 * Check if a specific model is enabled
 * 
 * NOTE: This only checks the registry, not API key availability.
 */
export function isModelEnabled(provider: AIProvider, _modelId: string): boolean {
  // Just check if provider is enabled - model-specific checks happen server-side
  return isProviderEnabled(provider);
}

/**
 * Get provider config
 */
export function getProviderConfig(provider: AIProvider): AIProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * Get API key for a provider
 * 
 * SECURITY WARNING: This function should ONLY be called server-side.
 * It will return undefined in browser context.
 */
export function getProviderApiKey(provider: AIProvider): string | undefined {
  // In browser context, we cannot access server-side env vars
  if (typeof window !== 'undefined') {
    console.warn('[AI] Attempted to access API key from browser - this is not allowed');
    return undefined;
  }
  
  // Server-side only - this code won't execute in browser
  const config = PROVIDER_CONFIGS[provider];
  // @ts-ignore - Deno is only available in edge function context
  if (typeof Deno !== 'undefined') {
    // @ts-ignore
    return Deno.env.get(config.apiKeyEnvVar);
  }
  
  return undefined;
}

/**
 * Check if API key is available for a provider
 * 
 * NOTE: In browser context, this always returns false for security.
 * The actual key check happens server-side in the edge function.
 */
export function hasApiKey(_provider: AIProvider): boolean {
  // In browser, we can't check API keys - assume provider is available
  // The edge function will handle missing key errors gracefully
  return true;
}

/**
 * Validate a model selection
 * 
 * NOTE: This is a client-side check. Full validation happens server-side.
 */
export function validateModelSelection(
  provider: AIProvider,
  modelId: string
): { valid: boolean; error?: string } {
  if (!isProviderEnabled(provider)) {
    return { valid: false, error: `Provider ${provider} is not enabled` };
  }
  
  const model = getModelById(modelId);
  if (!model) {
    return { valid: false, error: `Model ${modelId} not found` };
  }
  
  if (model.provider !== provider) {
    return { valid: false, error: `Model ${modelId} is not available for provider ${provider}` };
  }
  
  // API key check happens server-side
  return { valid: true };
}

/**
 * Get recommended model based on use case
 */
export function getRecommendedModel(
  priority: 'cost' | 'quality' | 'speed' = 'quality'
): AIModelOption {
  const enabled = getEnabledModels();
  
  if (enabled.length === 0) {
    throw new Error('No AI models are enabled');
  }
  
  switch (priority) {
    case 'cost':
      // Prefer budget tier
      return enabled.find(m => m.tier === 'budget') 
        || enabled.find(m => m.tier === 'standard') 
        || enabled[0];
    
    case 'speed':
      // Prefer smaller/faster models
      return enabled.find(m => m.modelId.includes('mini') || m.modelId.includes('chat'))
        || enabled[0];
    
    case 'quality':
    default:
      // Use default interview model
      return getDefaultInterviewModel();
  }
}
