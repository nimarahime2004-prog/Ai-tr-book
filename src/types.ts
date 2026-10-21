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
  hasImages?: boolean;
  imageCount?: number;
}

export type BookThemeId =
  | 'spiritual'          // معنوی و اشراقی (تذهیب اسلیمی زرین و فیروزه‌ای)
  | 'spiritual_ancient'  // معنوی کهن (پاپیروس عتیق و خط کهن)
  | 'spiritual_azure'    // معنوی آرامش و نیایش (لاجوردی و ماندالای آسمانی)
  | 'novel'              // رمان کلاسیک ادبی (عاجی و زرشکی اشرافی)
  | 'luxury_gold'        // سلطنتی طلاکوب و فاخر (سرمه‌ای شب و طلای اعلا)
  | 'academic'           // دانشگاهی و پژوهشی (نیلی مینیمال و دقیق)
  | 'sage_nature'        // روانشناسی و رشد فردی (سبز مریم‌گلی و آرامش‌بخش)
  | 'minimal_clean';     // سفید چاپی خالص و اقتصادی

export type BackgroundPatternId = 'none' | 'arabesque' | 'geometry' | 'parchment';
export type BorderStyleId = 'ornate_spiritual' | 'double_classic' | 'thin_modern' | 'none';

export interface BookDesignConfig {
  themeId: BookThemeId;
  headerText: string;
  footerText: string;
  showHeader: boolean;
  showFooter: boolean;
  websiteUrl?: string; // e.g. "www.yoursite.com"
  brandName?: string;  // e.g. "انتشارات آرمان"
  showPageNumbers: boolean;
  showCoverPage: boolean;
  fontSize: 'small' | 'medium' | 'large';
  lineSpacing: 'compact' | 'normal' | 'relaxed';
  fontFamily: 'Vazirmatn Medium' | 'Vazirmatn' | 'B Nazanin' | 'Tahoma' | 'IRANSans';
  borderStyle: BorderStyleId;
  backgroundPattern: BackgroundPatternId;
  watermarkText?: string;
  pageMargin?: 'compact' | 'normal' | 'generous';
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
  designConfig?: BookDesignConfig;
  sourceFileType?: 'txt' | 'docx' | 'pdf' | 'json';
  totalImagesCount?: number;
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
