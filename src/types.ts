export type ToneId = 'spiritual' | 'novel' | 'self_help' | 'academic' | 'business';

export interface ToneDefinition {
  id: ToneId;
  name: string;
  enLabel: string;
  description: string;
  sampleKeywords: string[];
  systemToneTag: string;
}

export type ProviderType = 'gemini' | 'openrouter' | 'openai' | 'deepseek' | 'glm' | 'custom';

export interface AIProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseURL?: string;
  selectedModel: string;
  availableModels: string[];
  isActive?: boolean;
  lastLatencyMs?: number | null;
  lastTestedAt?: number;
}

export interface APIServerEndpoint {
  id: string;
  name: string;
  providerType: ProviderType;
  baseURL: string;
  apiKey: string;
  model: string;
  isEnabled: boolean;
  priority: number;
  lastLatencyMs?: number | null;
  lastTestedAt?: number;
  status: 'active' | 'cooldown' | 'error';
  errorMessage?: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface ModelOption {
  id: string;
  name: string;
  providerType?: ProviderType;
  recommended?: boolean;
}

export interface GlossaryItem {
  id: string;
  en: string;
  fa: string;
  category?: string;
  note?: string;
}

export interface BookChunk {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  chunkNumber: number;
  englishText: string;
  translatedHtml?: string;
  status: 'idle' | 'queued' | 'translating' | 'completed' | 'error';
  wordCount: number;
  estimatedTokens: number;
  errorMessage?: string;
  keyUsed?: string;
  modelUsed?: string;
  providerUsed?: string;
  serverUsed?: string;
  switchOccurred?: boolean;
  translatedAt?: number;
}

export interface BookProject {
  id: string;
  title: string;
  originalTitle: string;
  author: string;
  translator: string;
  tone: ToneId;
  providerId?: string; // ID of configured provider
  model: string; // Model selection
  customToneDescription?: string;
  glossary: GlossaryItem[];
  chunks: BookChunk[];
  createdAt: number;
  updatedAt: number;
  rollingSummary?: string;
}

export interface ServerKeyStatus {
  masked: string;
  label?: string;
  status: 'active' | 'cooldown';
  secondsLeftInCooldown: number;
  rpmCount: number;
  totalRequests: number;
  errorCount: number;
  lastLatencyMs?: number | null;
}

export interface ServerStatusResponse {
  activeKeys: number;
  totalKeys: number;
  rateLimitDelayMs: number;
  pool: ServerKeyStatus[];
  systemInstructionReady: boolean;
  availableModels?: ModelOption[];
}

export interface TokenCalculationResult {
  words: number;
  characters: number;
  paragraphs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  estimatedChunks: number;
  estimatedSeconds: number;
}
