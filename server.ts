import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle, Header, Footer, PageNumber } from 'docx';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Key Pool & Rate Limiter Architecture ---
interface KeyStatus {
  key: string;
  masked: string;
  status: 'active' | 'cooldown';
  cooldownUntil: number;
  rpmCount: number;
  totalRequests: number;
  lastUsed: number;
  errorCount: number;
}

// Gather keys from env
const rawKeys: string[] = [];
if (process.env.GEMINI_API_KEY) {
  rawKeys.push(process.env.GEMINI_API_KEY.trim());
}
if (process.env.GEMINI_API_KEY_POOL) {
  const pool = process.env.GEMINI_API_KEY_POOL.split(',').map(k => k.trim()).filter(Boolean);
  pool.forEach(k => {
    if (!rawKeys.includes(k)) rawKeys.push(k);
  });
}

const keyPool: KeyStatus[] = rawKeys.map(k => ({
  key: k,
  masked: k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : 'Key-***',
  status: 'active',
  cooldownUntil: 0,
  rpmCount: 0,
  totalRequests: 0,
  lastUsed: 0,
  errorCount: 0,
}));

// Fallback if no key found (still create dummy item to prevent crashes, will warn properly)
if (keyPool.length === 0) {
  keyPool.push({
    key: '',
    masked: 'Default-Env-Key',
    status: 'active',
    cooldownUntil: 0,
    rpmCount: 0,
    totalRequests: 0,
    lastUsed: 0,
    errorCount: 0,
  });
}

let currentKeyIndex = 0;
const safeDelayMs = 2800; // 2.8s safe interval between calls to avoid RPM spikes
let lastCallTimestamp = 0;

function getAvailableKey(): KeyStatus | null {
  const now = Date.now();
  // Clean up expired cooldowns
  keyPool.forEach(k => {
    if (k.status === 'cooldown' && now >= k.cooldownUntil) {
      k.status = 'active';
      k.cooldownUntil = 0;
    }
  });

  // Try round-robin from current index
  for (let i = 0; i < keyPool.length; i++) {
    const idx = (currentKeyIndex + i) % keyPool.length;
    const candidate = keyPool[idx];
    if (candidate.status === 'active' && candidate.key) {
      currentKeyIndex = (idx + 1) % keyPool.length;
      return candidate;
    }
  }

  // If all are in cooldown, pick the one with earliest cooldown expiry
  const sorted = [...keyPool].sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  return sorted[0] || null;
}

function markKeyCooldown(keyObj: KeyStatus, seconds = 60) {
  keyObj.status = 'cooldown';
  keyObj.cooldownUntil = Date.now() + seconds * 1000;
  keyObj.errorCount++;
}

// Reset RPM counts every minute
setInterval(() => {
  keyPool.forEach(k => {
    k.rpmCount = 0;
  });
}, 60000);

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastCallTimestamp;
  if (timeSinceLast < safeDelayMs) {
    const waitTime = safeDelayMs - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastCallTimestamp = Date.now();
}

// System prompt as specified in the brief + strict no-summarization & uncensored literary translation
const SYSTEM_INSTRUCTION_TRANSLATOR = `Role & Objective:
You are an elite, professional book translator and document formatter specializing in translating long-form English books into fluent, natural, and publication-ready Persian (Farsi).

Context & Input Processing:
- You will receive sections/chapters of a book along with project-specific metadata (Tone, Custom Glossary, Formatting Rules).
- If context caching is active, utilize previously cached terminology and narrative flow to maintain 100% voice and naming consistency.

Translation Principles:
1. Fluency & Natural Phrasing: Do not produce robotic or literal word-for-word translations. Rephrase idioms and sentences naturally into fluent, idiomatic, publication-grade Persian while strictly preserving the author's original meaning, subtlety, and intent.
2. Tone Adaptation: Adopt the exact specified tone for the book:
   - Spiritual / Philosophical: Reverent, deep, meditative, poetic yet crystal clear (e.g., using terms like «آگاهی»، «حضور»، «مشاهده‌گر»).
   - Novel / Narrative: Engaging, fluid, descriptive, preserving literary rhythm and dialogue dynamics.
   - Self-Help / Psychology: Clear, empowering, instructional, and modern Persian.
   - Academic / Technical: Precise, formal, and structured.
3. Custom Glossary Priority: Strictly prioritize the provided custom glossary mapping over default translations. Never translate proprietary terms inconsistently.
4. Strict No-Summarization Guarantee: Under NO circumstances are you allowed to summarize, condense, abbreviate, skip, or omit any paragraph, sentence, metaphor, example, or dialogue. Every single paragraph and thought must be translated in full completeness.
5. Faithful & Uncensored Translation: This is an official literary and scholarly book translation. Translate all text faithfully, directly, and without censorship, puritanical sanitization, moralizing, or softening. Preserve the author's original voice, register, realism, and vocabulary completely.

Formatting & Structural Rules (HTML / Rich Styling):
To allow seamless export to DOCX and PDF with color-coded typography:
- Enclose the output in clean, semantic HTML format:
  - Book / Chapter Titles: <h1 style="color: #1a365d; font-size: 24pt; margin-bottom: 20px; text-align: center;">...</h1>
  - Major Subheadings: <h2 style="color: #2b6cb0; font-size: 18pt; margin-top: 25px; margin-bottom: 12px;">...</h2>
  - Minor Sections: <h3 style="color: #2c5282; font-size: 14pt; margin-top: 15px; margin-bottom: 8px;">...</h3>
  - Body Paragraphs: <p style="line-height: 1.9; font-size: 12pt; text-align: justify; margin-bottom: 14px;">...</p>
  - Quotes / Callouts: <blockquote style="border-right: 4px solid #3182ce; padding: 10px 18px; margin: 15px 0; background: #f7fafc; color: #4a5568; font-style: italic;">...</blockquote>
  - Key Terms / Glossary Highlights: <span style="color: #9b2c2c; font-weight: bold;">...</span>

Output Expectation:
Return ONLY the formatted, translated Persian text inside the specified HTML structure. Do not include conversational filler, introductory remarks, or concluding notes.`;

// API Routes
app.get('/api/status', (req, res) => {
  const now = Date.now();
  const poolInfo = keyPool.map(k => ({
    masked: k.masked,
    label: (k as any).label || 'کلید پیش‌فرض',
    status: k.status === 'cooldown' && now < k.cooldownUntil ? 'cooldown' : 'active',
    secondsLeftInCooldown: Math.max(0, Math.ceil((k.cooldownUntil - now) / 1000)),
    rpmCount: k.rpmCount,
    totalRequests: k.totalRequests,
    errorCount: k.errorCount,
    lastLatencyMs: (k as any).lastLatencyMs || null,
  }));

  res.json({
    activeKeys: poolInfo.filter(k => k.status === 'active').length,
    totalKeys: poolInfo.length,
    rateLimitDelayMs: safeDelayMs,
    pool: poolInfo,
    systemInstructionReady: true,
    availableModels: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (پیش‌فرض هوشمند و فصیح)', recommended: true },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (فوق سریع و کم‌مصرف)' },
      { id: 'gemini-4-argon', name: 'Gemini 4 Argon (نهایت عمق فلسفی و ادبی)' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (جدیدترین نسخه)' },
    ],
  });
});

// Add Key to In-Memory Pool
app.post('/api/keys/add', async (req, res) => {
  const { key, label } = req.body;
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    return res.status(400).json({ error: 'کلید وارد شده نامعتبر است (حداقل ۸ کاراکتر).' });
  }
  const cleanKey = key.trim();
  const existing = keyPool.find(k => k.key === cleanKey);
  if (existing) {
    return res.json({ success: true, message: 'این کلید قبلاً در استخر ثبت شده است.', key: { masked: existing.masked } });
  }

  const masked = `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}`;
  const newKeyObj: KeyStatus & { label?: string; lastLatencyMs?: number } = {
    key: cleanKey,
    masked,
    label: label || `کلید کمکی ${keyPool.length + 1}`,
    status: 'active',
    cooldownUntil: 0,
    rpmCount: 0,
    totalRequests: 0,
    lastUsed: 0,
    errorCount: 0,
  };
  keyPool.push(newKeyObj);
  return res.json({ success: true, key: { masked, label: newKeyObj.label, status: 'active' } });
});

// Test Connection for a specific key / provider
app.post('/api/keys/test', async (req, res) => {
  const { provider, apiKey, baseURL, model, masked } = req.body;

  // If testing a non-Gemini provider (OpenAI, OpenRouter, DeepSeek, GLM, Custom proxy)
  if (provider && provider !== 'gemini') {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 4) {
      return res.status(400).json({ error: 'لطفاً کلید API معتبر برای این ارائه‌دهنده را وارد کنید.' });
    }

    const targetUrl = `${(baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    const testModel = model || (provider === 'openrouter' ? 'deepseek/deepseek-r1' : 'gpt-4o-mini');
    const t0 = Date.now();

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          ...(provider === 'openrouter' ? {
            'HTTP-Referer': 'https://aistudio.google.com',
            'X-Title': 'Persian Book Translator'
          } : {})
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Reply with exact single word: PONG_OK' }],
          max_tokens: 10,
        }),
      });

      const latencyMs = Date.now() - t0;
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const answer = data.choices?.[0]?.message?.content?.trim() || 'PONG_OK';
      return res.json({
        success: true,
        latencyMs,
        masked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
        response: answer,
        modelUsed: testModel,
      });
    } catch (err: any) {
      const latencyMs = Date.now() - t0;
      return res.status(500).json({
        success: false,
        latencyMs,
        error: err?.message || 'خطا در ارتباط با سرور ارائه‌دهنده',
      });
    }
  }

  // Gemini Key Test
  const targetKey = (masked ? keyPool.find(k => k.masked === masked) : null) || keyPool[0];
  const testKey = (apiKey && typeof apiKey === 'string' && apiKey.length > 8) ? apiKey : (targetKey?.key || process.env.GEMINI_API_KEY);

  if (!testKey) {
    return res.status(400).json({ error: 'کلید معتبری برای تست در استخر یافت نشد.' });
  }

  const testModel = model || 'gemini-3.8-flash';
  const t0 = Date.now();
  try {
    const ai = new GoogleGenAI({
      apiKey: testKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const result = await ai.models.generateContent({
      model: testModel,
      contents: 'Ping test for Persian book translation engine. Reply with exact word: PONG_OK',
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const latencyMs = Date.now() - t0;
    if (targetKey) {
      (targetKey as any).lastLatencyMs = latencyMs;
      targetKey.status = 'active';
      targetKey.cooldownUntil = 0;
    }
    return res.json({
      success: true,
      latencyMs,
      masked: `${testKey.slice(0, 4)}...${testKey.slice(-4)}`,
      response: result.text?.trim() || 'PONG_OK',
      modelUsed: testModel,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    return res.status(500).json({
      success: false,
      latencyMs,
      error: err?.message || 'خطا در برقراری ارتباط با مدل',
      masked: `${testKey.slice(0, 4)}...${testKey.slice(-4)}`,
    });
  }
});

// Remove a custom key
app.delete('/api/keys/:masked', (req, res) => {
  const { masked } = req.params;
  const idx = keyPool.findIndex(k => k.masked === masked);
  if (idx !== -1 && keyPool.length > 1) {
    keyPool.splice(idx, 1);
    return res.json({ success: true });
  }
  return res.status(400).json({ error: 'امکان حذف کلید اصلی سیستم وجود ندارد.' });
});

// Calculate token and quota estimates
app.post('/api/calculate-tokens', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.json({
      words: 0,
      characters: 0,
      paragraphs: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      totalTokens: 0,
      estimatedChunks: 0,
      estimatedSeconds: 0,
    });
  }

  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const characters = clean.length;
  const paragraphs = clean.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const estimatedInputTokens = Math.ceil(words * 1.35);
  const estimatedOutputTokens = Math.ceil(words * 1.65);
  const totalTokens = estimatedInputTokens + estimatedOutputTokens;
  const estimatedChunks = Math.max(1, Math.ceil(words / 700));
  const estimatedSeconds = Math.round(estimatedChunks * 4.5);

  return res.json({
    words,
    characters,
    paragraphs,
    estimatedInputTokens,
    estimatedOutputTokens,
    totalTokens,
    estimatedChunks,
    estimatedSeconds,
  });
});

app.post('/api/translate', async (req, res) => {
  const { chunkId, englishText, tone, glossary, previousSummary, chapterTitle, model, provider, apiKey, baseURL, serverPool } = req.body;

  if (!englishText || typeof englishText !== 'string') {
    return res.status(400).json({ error: 'متن انگلیسی برای ترجمه الزامی است.' });
  }

  const targetModel = model || 'gemini-3.8-flash';

  // Format glossary items
  let glossaryText = 'واژه‌نامه عمومی';
  if (Array.isArray(glossary) && glossary.length > 0) {
    glossaryText = glossary
      .map((item: { en: string; fa: string }) => `  * ${item.en} -> ${item.fa}`)
      .join('\n');
  } else if (typeof glossary === 'string' && glossary.trim()) {
    glossaryText = glossary;
  }

  // Build the User Prompt exactly as specified in the brief with zero-summarization guarantee
  const userPrompt = `[CONFIGURATION]
- Book Tone: ${tone || 'معنوی و خودشناسی'}
- Chapter / Section Context: ${chapterTitle || 'بخش جاری کتاب'}
- Glossary / واژه‌نامه اختصاصی:
${glossaryText}
${previousSummary ? `\n[PREVIOUS SUMMARY / CONTEXT]\n${previousSummary}\n` : ''}
[CRITICAL INSTRUCTION]
Do NOT summarize. Translate every single sentence, dialogue, nuance, and paragraph verbatim into fluent, natural Persian without omission or censorship.

[INPUT TEXT TO TRANSLATE]
${englishText}`;

  // 1. MULTI-SERVER FAILOVER POOL: If user has configured an active pool of servers/endpoints
  if (Array.isArray(serverPool) && serverPool.length > 0) {
    const activeServers = serverPool.filter((s: any) => s.isEnabled !== false);

    for (let sIdx = 0; sIdx < activeServers.length; sIdx++) {
      const server = activeServers[sIdx];
      console.log(`[Auto-Switching Engine] Attempting Server ${sIdx + 1}/${activeServers.length}: "${server.name}" (${server.providerType} / ${server.model})...`);

      try {
        await enforceRateLimit();

        if (server.providerType === 'gemini') {
          const sKey = (server.apiKey && server.apiKey.length > 8) ? server.apiKey.trim() : process.env.GEMINI_API_KEY;
          if (!sKey) throw new Error('کلید API برای این سرور جمینای تنظیم نشده است.');

          const ai = new GoogleGenAI({
            apiKey: sKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const thinkingLevel =
            server.model === 'gemini-3.1-flash-lite'
              ? ThinkingLevel.MINIMAL
              : ThinkingLevel.LOW;

          const response = await ai.models.generateContent({
            model: server.model || 'gemini-3.8-flash',
            contents: userPrompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION_TRANSLATOR,
              temperature: 0.35,
              topP: 0.95,
              thinkingConfig: { thinkingLevel },
            },
          });

          let cleanHtml = (response.text || '').trim();
          if (cleanHtml.startsWith('```html')) {
            cleanHtml = cleanHtml.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
          } else if (cleanHtml.startsWith('```')) {
            cleanHtml = cleanHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          console.log(`[Auto-Switching Engine] Success via Server "${server.name}"!`);
          return res.json({
            chunkId,
            translatedHtml: cleanHtml,
            serverUsed: server.name,
            serverId: server.id,
            model: server.model || 'gemini-3.8-flash',
            provider: 'gemini',
            keyUsed: `${sKey.slice(0, 4)}...${sKey.slice(-4)}`,
            switchOccurred: sIdx > 0,
            success: true,
          });
        } else {
          // OpenAI-Compatible Server (OpenRouter, OpenAI, DeepSeek, GLM, Groq, Custom proxy)
          if (!server.apiKey || server.apiKey.trim().length < 4) {
            throw new Error(`کلید API برای سرور "${server.name}" تنظیم نشده است.`);
          }

          const targetUrl = `${(server.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s failover timeout

          const response = await fetch(targetUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${server.apiKey.trim()}`,
              ...(server.providerType === 'openrouter' ? {
                'HTTP-Referer': 'https://aistudio.google.com',
                'X-Title': 'Persian Book Translator'
              } : {})
            },
            body: JSON.stringify({
              model: server.model,
              messages: [
                { role: 'system', content: SYSTEM_INSTRUCTION_TRANSLATOR },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.35,
              top_p: 0.95
            })
          });
          clearTimeout(timeoutId);

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error?.message || `خطای HTTP ${response.status}`);
          }

          let cleanHtml = (data.choices?.[0]?.message?.content || '').trim();
          if (cleanHtml.startsWith('```html')) {
            cleanHtml = cleanHtml.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
          } else if (cleanHtml.startsWith('```')) {
            cleanHtml = cleanHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          console.log(`[Auto-Switching Engine] Success via Server "${server.name}"!`);
          return res.json({
            chunkId,
            translatedHtml: cleanHtml,
            serverUsed: server.name,
            serverId: server.id,
            model: server.model,
            provider: server.providerType,
            keyUsed: `${server.apiKey.slice(0, 4)}...${server.apiKey.slice(-4)}`,
            switchOccurred: sIdx > 0,
            success: true,
          });
        }
      } catch (err: any) {
        console.warn(`[Auto-Switching Engine] Server "${server.name}" failed: ${err.message}. Automatically switching to next server...`);
        // Continue to next server in activeServers!
      }
    }
    console.warn('[Auto-Switching Engine] All custom servers in pool failed or timed out. Falling back to default Gemini system pool...');
  }

  // 2. SINGLE NON-GEMINI PROVIDER FALLBACK
  if (provider && provider !== 'gemini') {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 4) {
      return res.status(400).json({ error: `کلید API برای ارائه‌دهنده ${provider} وارد نشده است.` });
    }

    const targetUrl = `${(baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    try {
      await enforceRateLimit();
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          ...(provider === 'openrouter' ? {
            'HTTP-Referer': 'https://aistudio.google.com',
            'X-Title': 'Persian Book Translator'
          } : {})
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION_TRANSLATOR },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.35,
          top_p: 0.95
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `خطای سرور ${response.status}`);
      }

      let cleanHtml = (data.choices?.[0]?.message?.content || '').trim();
      if (cleanHtml.startsWith('```html')) {
        cleanHtml = cleanHtml.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
      } else if (cleanHtml.startsWith('```')) {
        cleanHtml = cleanHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      return res.json({
        chunkId,
        translatedHtml: cleanHtml,
        keyUsed: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
        model: targetModel,
        provider,
        success: true,
      });
    } catch (err: any) {
      console.error(`Provider ${provider} translation error:`, err);
      return res.status(500).json({
        error: `خطا در ترجمه با ${provider}: ${err?.message || 'مشکل در برقراری ارتباط'}`,
      });
    }
  }

  // Fallback model chain in case of temporary 503 high demand on Google servers
  const fallbackChain: Record<string, string[]> = {
    'gemini-3.8-flash': ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
    'gemini-3.1-flash-lite': ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'],
    'gemini-4-argon': ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    'gemini-flash-latest': ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'],
  };

  const modelCandidates = fallbackChain[targetModel] || [targetModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];

  let lastError: any = null;
  let successfulHtml = '';
  let successfulModel = targetModel;
  let keyUsedName = 'Primary-Key';

  modelLoop: for (let mIdx = 0; mIdx < modelCandidates.length; mIdx++) {
    const currentModelCandidate = modelCandidates[mIdx];
    const maxRetriesPerModel = Math.max(2, keyPool.length);

    for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
      const keyObj = getAvailableKey();
      const apiKey = keyObj?.key || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: 'کلید دسترسی Gemini API تعریف نشده است. لطفاً متغیر GEMINI_API_KEY را بررسی کنید.',
        });
      }

      try {
        await enforceRateLimit();

        if (keyObj) {
          keyObj.rpmCount++;
          keyObj.totalRequests++;
          keyObj.lastUsed = Date.now();
        }

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        // Use appropriate thinking level for model
        const thinkingLevel =
          currentModelCandidate === 'gemini-3.1-flash-lite'
            ? ThinkingLevel.MINIMAL
            : ThinkingLevel.LOW;

        const response = await ai.models.generateContent({
          model: currentModelCandidate,
          contents: userPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_TRANSLATOR,
            temperature: 0.35,
            topP: 0.95,
            thinkingConfig: { thinkingLevel },
          },
        });

        const translatedHtml = response.text || '';

        // Clean up any markdown code block wrapper if model outputted ```html ... ```
        let cleanHtml = translatedHtml.trim();
        if (cleanHtml.startsWith('```html')) {
          cleanHtml = cleanHtml.replace(/^```html\s*/i, '').replace(/\s*```$/, '');
        } else if (cleanHtml.startsWith('```')) {
          cleanHtml = cleanHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        successfulHtml = cleanHtml;
        successfulModel = currentModelCandidate;
        keyUsedName = keyObj ? keyObj.masked : 'Primary-Key';
        break modelLoop;
      } catch (err: any) {
        lastError = err;
        const errorMessage = String(err?.message || err);
        console.warn(`Model ${currentModelCandidate} attempt ${attempt + 1} failed:`, errorMessage.slice(0, 120));

        const isQuotaExceeded =
          errorMessage.includes('429') ||
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('Quota exceeded');

        const isHighDemand =
          errorMessage.includes('503') ||
          errorMessage.includes('high demand') ||
          errorMessage.includes('UNAVAILABLE');

        if (isQuotaExceeded && keyObj) {
          markKeyCooldown(keyObj, 60);
          console.warn(`Key ${keyObj.masked} moved to cooldown for 60s.`);
        }

        // If high demand 503 on this model, switch immediately to next candidate model
        if (isHighDemand && mIdx < modelCandidates.length - 1) {
          console.warn(`503 High Demand detected on ${currentModelCandidate}. Automatically switching to fallback model ${modelCandidates[mIdx + 1]}...`);
          await new Promise(r => setTimeout(r, 1000));
          break; // Exit inner loop and try next model in modelCandidates
        }

        // Small backoff before retrying next key
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }

  if (successfulHtml) {
    return res.json({
      chunkId,
      translatedHtml: successfulHtml,
      keyUsed: keyUsedName,
      model: successfulModel,
      fallbackUsed: successfulModel !== targetModel,
      success: true,
    });
  }

  const errText = String(lastError?.message || lastError);
  let friendlyError = 'مشکل در برقراری ارتباط با مدل هوش مصنوعی';
  if (errText.includes('503') || errText.includes('high demand') || errText.includes('UNAVAILABLE')) {
    friendlyError = 'سرورهای هوش مصنوعی در حال حاضر دچار ترافیک بالای موقت (کد ۵۰۳) هستند. لطفاً لحظاتی دیگر مجدداً تلاش فرمایید یا مدل دیگری را از بالای صفحه انتخاب نمایید.';
  } else if (errText.includes('429') || errText.includes('Quota exceeded')) {
    friendlyError = 'سهمیه مجاز درخواست‌های کلید موقتاً به پایان رسیده است. پس از گذشت یک دقیقه به طور خودکار آزاد می‌شود.';
  }

  return res.status(500).json({
    error: `خطا در ترجمه: ${friendlyError}`,
  });
});

// Quick term extraction for custom glossary builder
app.post('/api/extract-glossary', async (req, res) => {
  const { sampleText, tone } = req.body;
  if (!sampleText || typeof sampleText !== 'string') {
    return res.status(400).json({ error: 'متن نمونه برای استخراج واژگان الزامی است.' });
  }

  const keyObj = getAvailableKey();
  const apiKey = keyObj?.key || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'کلید Gemini API یافت نشد.' });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const prompt = `Analyze this excerpt from an English book (Tone: ${tone || 'Spiritual / Philosophical / Literature'}).
Extract 10 to 15 key technical, philosophical, or recurring thematic terms/idioms that must have precise, uniform Persian translations.
Return ONLY valid JSON array with objects shaped: {"en": "English Term", "fa": "ترجمه دقیق و فصیح فارسی", "note": "توضیح کوتاه کاربرد در متن"}.

Text excerpt:
${sampleText.slice(0, 4000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({ glossary: parsed });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'خطا در استخراج واژه‌نامه' });
  }
});

// Helper to generate proper multi-script font definition for Word (ensuring Persian text gets Vazirmatn Medium)
function createFontDef(fontName: string = 'Vazirmatn Medium') {
  return {
    name: fontName,
    cs: fontName,
    ascii: fontName,
    hAnsi: fontName,
  };
}

// Helper to preserve color-coded glossary terms (#9b2c2c) and styling in Word TextRuns
function parseHtmlToTextRuns(html: string, fontName: string = 'Vazirmatn Medium'): TextRun[] {
  const runs: TextRun[] = [];
  const fontDef = createFontDef(fontName);
  const regex = /<span style="[^"]*#9b2c2c[^"]*"[^>]*>([\s\S]*?)<\/span>|<b[^>]*>([\s\S]*?)<\/b>|<strong[^>]*>([\s\S]*?)<\/strong>|<i[^>]*>([\s\S]*?)<\/i>|<em[^>]*>([\s\S]*?)<\/em>|([^<]+)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      // Highlighted glossary term in red bold
      runs.push(
        new TextRun({
          text: match[1].replace(/<[^>]+>/g, ''),
          font: fontDef,
          size: 24,
          bold: true,
          color: '9B2C2C',
          rightToLeft: true,
        })
      );
    } else if (match[2] || match[3]) {
      // Bold text
      runs.push(
        new TextRun({
          text: (match[2] || match[3]).replace(/<[^>]+>/g, ''),
          font: fontDef,
          size: 24,
          bold: true,
          color: '2D3748',
          rightToLeft: true,
        })
      );
    } else if (match[4] || match[5]) {
      // Italic text
      runs.push(
        new TextRun({
          text: (match[4] || match[5]).replace(/<[^>]+>/g, ''),
          font: fontDef,
          size: 24,
          italics: true,
          color: '4A5568',
          rightToLeft: true,
        })
      );
    } else if (match[6] && match[6].length > 0) {
      runs.push(
        new TextRun({
          text: match[6],
          font: fontDef,
          size: 24,
          color: '2D3748',
          rightToLeft: true,
        })
      );
    }
  }

  if (runs.length === 0) {
    runs.push(
      new TextRun({
        text: html.replace(/<[^>]+>/g, '').trim(),
        font: fontDef,
        size: 24,
        color: '2D3748',
        rightToLeft: true,
      })
    );
  }

  return runs;
}

// Generate DOCX export from translated sections
app.post('/api/export/docx', async (req, res) => {
  try {
    const { title, author, translator, chapters, designConfig } = req.body;
    const fontFamily = designConfig?.fontFamily || 'Vazirmatn Medium';
    const fontDef = createFontDef(fontFamily);

    // Only include header if showHeader is explicitly true AND text is non-empty
    const showHeader = designConfig?.showHeader === true && Boolean(designConfig?.headerText?.trim());
    const headerText = showHeader ? (designConfig?.headerText?.trim() || '') : '';

    // Only include footer if showFooter is true OR showPageNumbers is true
    const showFooter = designConfig?.showFooter === true && Boolean(designConfig?.footerText?.trim());
    const footerText = showFooter ? (designConfig?.footerText?.trim() || '') : '';
    const showPageNumbers = designConfig?.showPageNumbers !== false;

    const docChildren: Paragraph[] = [];

    // Title Page
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2000, after: 400 },
        bidirectional: true,
        children: [
          new TextRun({
            text: title || 'کتاب ترجمه شده',
            font: fontDef,
            size: 48, // 24pt
            bold: true,
            color: '1A365D',
            rightToLeft: true,
          }),
        ],
      })
    );

    if (author) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          bidirectional: true,
          children: [
            new TextRun({
              text: `نویسنده: ${author}`,
              font: fontDef,
              size: 26,
              color: '4A5568',
              rightToLeft: true,
            }),
          ],
        })
      );
    }

    if (translator) {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 1200 },
          bidirectional: true,
          children: [
            new TextRun({
              text: `ترجمه و ویرایش: ${translator}`,
              font: fontDef,
              size: 24,
              italics: true,
              color: '718096',
              rightToLeft: true,
            }),
          ],
        })
      );
    }

    // Page break after title page
    docChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        spacing: { before: 400 },
      })
    );

    // Parse chapters HTML into DOCX elements
    if (Array.isArray(chapters)) {
      chapters.forEach((ch: { title?: string; htmlContent?: string }, chIdx: number) => {
        if (chIdx > 0) {
          docChildren.push(new Paragraph({ pageBreakBefore: true }));
        }

        if (ch.title) {
          docChildren.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { before: 600, after: 400 },
              bidirectional: true,
              children: [
                new TextRun({
                  text: ch.title,
                  font: fontDef,
                  size: 36, // 18pt
                  bold: true,
                  color: '1A365D',
                  rightToLeft: true,
                }),
              ],
            })
          );
        }

        // Parse paragraphs and blockquotes from HTML
        const html = ch.htmlContent || '';
        const blockRegex = /<(h[1-3]|p|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
        let match;
        let foundAny = false;

        while ((match = blockRegex.exec(html)) !== null) {
          foundAny = true;
          const tag = match[1].toLowerCase();
          const innerHtml = match[2];
          const plainText = innerHtml.replace(/<[^>]+>/g, '').trim();

          if (!plainText) continue;

          if (tag === 'h1') {
            docChildren.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 500, after: 300 },
                bidirectional: true,
                children: [
                  new TextRun({
                    text: plainText,
                    font: fontDef,
                    size: 36,
                    bold: true,
                    color: '1A365D',
                    rightToLeft: true,
                  }),
                ],
              })
            );
          } else if (tag === 'h2') {
            docChildren.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 400, after: 200 },
                bidirectional: true,
                children: [
                  new TextRun({
                    text: plainText,
                    font: fontDef,
                    size: 30,
                    bold: true,
                    color: '2B6CB0',
                    rightToLeft: true,
                  }),
                ],
              })
            );
          } else if (tag === 'h3') {
            docChildren.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_3,
                alignment: AlignmentType.RIGHT,
                spacing: { before: 300, after: 150 },
                bidirectional: true,
                children: [
                  new TextRun({
                    text: plainText,
                    font: fontDef,
                    size: 26,
                    bold: true,
                    color: '2C5282',
                    rightToLeft: true,
                  }),
                ],
              })
            );
          } else if (tag === 'blockquote') {
            docChildren.push(
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 240, after: 240 },
                indent: { right: 720 },
                bidirectional: true,
                border: {
                  right: {
                    color: '3182CE',
                    size: 24,
                    style: BorderStyle.SINGLE,
                  },
                },
                children: [
                  new TextRun({
                    text: '« ',
                    font: fontDef,
                    size: 22,
                    color: '3182CE',
                    rightToLeft: true,
                  }),
                  ...parseHtmlToTextRuns(innerHtml, fontFamily),
                  new TextRun({
                    text: ' »',
                    font: fontDef,
                    size: 22,
                    color: '3182CE',
                    rightToLeft: true,
                  }),
                ],
              })
            );
          } else {
            // Standard paragraph with preserved color highlights
            docChildren.push(
              new Paragraph({
                alignment: AlignmentType.BOTH, // Justified
                spacing: { line: 360, before: 100, after: 200 }, // 1.5 - 1.8 line spacing
                bidirectional: true,
                children: parseHtmlToTextRuns(innerHtml, fontFamily),
              })
            );
          }
        }

        // If no HTML tags were matched, output clean text lines
        if (!foundAny) {
          const lines = html.replace(/<[^>]+>/g, '').split('\n').map(l => l.trim()).filter(Boolean);
          lines.forEach(line => {
            docChildren.push(
              new Paragraph({
                alignment: AlignmentType.BOTH,
                spacing: { line: 360, after: 200 },
                bidirectional: true,
                children: [
                  new TextRun({
                    text: line,
                    font: fontDef,
                    size: 24,
                    rightToLeft: true,
                  }),
                ],
              })
            );
          });
        }
      });
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch / 2.54 cm
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          headers: showHeader && headerText ? {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  bidirectional: true,
                  children: [
                    new TextRun({
                      text: headerText,
                      font: fontDef,
                      size: 18, // 9pt
                      color: '718096',
                      rightToLeft: true,
                    }),
                  ],
                }),
              ],
            }),
          } : undefined,
          footers: (showFooter || showPageNumbers) ? {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  bidirectional: true,
                  children: [
                    ...(footerText ? [
                      new TextRun({
                        text: showPageNumbers ? `${footerText} • صفحه ` : footerText,
                        font: fontDef,
                        size: 18,
                        color: '718096',
                        rightToLeft: true,
                      }),
                    ] : (showPageNumbers ? [
                      new TextRun({
                        text: 'صفحه ',
                        font: fontDef,
                        size: 18,
                        color: '718096',
                        rightToLeft: true,
                      }),
                    ] : [])),
                    ...(showPageNumbers ? [
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        font: fontDef,
                        size: 18,
                        color: '718096',
                        rightToLeft: true,
                      }),
                    ] : []),
                  ],
                }),
              ],
            }),
          } : undefined,
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title || 'book-translated')}.docx"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('DOCX Export error:', err);
    res.status(500).json({ error: 'خطا در ایجاد فایل Word' });
  }
});

// Setup Vite or static serving
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Book Translator server listening on port ${PORT} (mode: ${isProduction ? 'prod' : 'dev'})`);
  });
}

startServer();
