/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { ProjectHeader } from './components/ProjectHeader.tsx';
import { ChunkListSidebar } from './components/ChunkListSidebar.tsx';
import { TranslationWorkspace } from './components/TranslationWorkspace.tsx';
import { GlossaryModal } from './components/GlossaryModal.tsx';
import { ServerStatusModal } from './components/ServerStatusModal.tsx';
import { NewBookModal } from './components/NewBookModal.tsx';
import { TokenEstimatorModal } from './components/TokenEstimatorModal.tsx';
import { ProviderManagerModal } from './components/ProviderManagerModal.tsx';
import { BooksLibraryModal } from './components/BooksLibraryModal.tsx';
import { ExportDesignModal } from './components/ExportDesignModal.tsx';
import { PrintDocument } from './components/PrintDocument.tsx';
import { BookProject, BookChunk, ServerStatusResponse, GlossaryItem, AIProviderConfig, APIServerEndpoint } from './types.ts';
import { SAMPLE_BOOKS, SampleBook } from './utils/sampleBooks.ts';
import { chunkBookText } from './utils/chunker.ts';
import { DEFAULT_GLOSSARIES } from './constants/tones.ts';
import { DEFAULT_PROVIDERS } from './constants/providers.ts';

const STORAGE_KEY_BOOKS = 'persian_book_translator_books_library_v3';
const STORAGE_KEY_ACTIVE_BOOK = 'persian_book_translator_active_id_v3';
const STORAGE_KEY_PROVIDERS = 'persian_book_translator_providers_v3';
const STORAGE_KEY_ACTIVE_PROVIDER = 'persian_book_translator_active_provider_v3';
const STORAGE_KEY_SERVER_POOL = 'persian_book_translator_server_pool_v3';

export default function App() {
  // Connected API Servers Pool for Automatic Failover Switching
  const [serverPool, setServerPool] = useState<APIServerEndpoint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SERVER_POOL);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load server pool from localStorage');
    }

    return [
      {
        id: 'srv_gemini_primary',
        name: 'سرور ۱: Gemini 3.8 Flash (اصلی)',
        providerType: 'gemini',
        baseURL: '',
        apiKey: '',
        model: 'gemini-3.8-flash',
        isEnabled: true,
        priority: 1,
        status: 'active',
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
      },
      {
        id: 'srv_gemini_lite',
        name: 'سرور ۲: Gemini 3.1 Flash-Lite (پشتیبان پرسرعت)',
        providerType: 'gemini',
        baseURL: '',
        apiKey: '',
        model: 'gemini-3.1-flash-lite',
        isEnabled: true,
        priority: 2,
        status: 'active',
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
      },
      {
        id: 'srv_openrouter_deepseek',
        name: 'سرور ۳: OpenRouter (DeepSeek R1)',
        providerType: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: 'deepseek/deepseek-r1',
        isEnabled: false,
        priority: 3,
        status: 'active',
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
      },
    ];
  });

  // Global AI Providers (saved across all books)
  const [providers, setProviders] = useState<AIProviderConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROVIDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load saved providers from localStorage');
    }
    return DEFAULT_PROVIDERS;
  });

  const [activeProviderId, setActiveProviderId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PROVIDER) || 'prov_gemini';
  });

  // Books Shelf / Library
  const [books, setBooks] = useState<BookProject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load books library from localStorage');
    }

    // Default book shelf with sample
    const sample = SAMPLE_BOOKS[0];
    const initialChunks = chunkBookText(sample.excerpt, { maxWordsPerChunk: 700 });
    return [
      {
        id: 'default_power_of_now',
        title: sample.title,
        originalTitle: sample.originalTitle,
        author: sample.author,
        translator: 'سامانه هوشمند ترجمه کتاب',
        tone: sample.tone,
        providerId: 'prov_gemini',
        model: 'gemini-3.8-flash',
        glossary: [...DEFAULT_GLOSSARIES.spiritual],
        chunks: initialChunks,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });

  const [activeBookId, setActiveBookId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_BOOK) || books[0]?.id || 'default_power_of_now';
  });

  // Active Project helper
  const project = books.find(b => b.id === activeBookId) || books[0];

  const [activeChunkId, setActiveChunkId] = useState<string | null>(() => {
    return project?.chunks[0]?.id || null;
  });

  const [serverStatus, setServerStatus] = useState<ServerStatusResponse | null>(null);
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isNewBookModalOpen, setIsNewBookModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isProvidersModalOpen, setIsProvidersModalOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);

  // Batch Translation Engine
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, secondsToNextCall: 0 });
  const isBatchCancelledRef = useRef(false);

  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
    } catch (e) {
      console.warn('Failed saving books library');
    }
  }, [books]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_BOOK, activeBookId);
    } catch (e) {
      console.warn('Failed saving active book id');
    }
  }, [activeBookId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(providers));
    } catch (e) {
      console.warn('Failed saving providers');
    }
  }, [providers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROVIDER, activeProviderId);
    } catch (e) {
      console.warn('Failed saving active provider id');
    }
  }, [activeProviderId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SERVER_POOL, JSON.stringify(serverPool));
    } catch (e) {
      console.warn('Failed saving server pool');
    }
  }, [serverPool]);

  // Fetch server status on mount
  const fetchServerStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch (e) {
      console.warn('Error fetching server status');
    }
  };

  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 25000);
    return () => clearInterval(interval);
  }, []);

  // Update Active Book helper
  const handleUpdateProject = (updates: Partial<BookProject>) => {
    setBooks(prev =>
      prev.map(b => (b.id === activeBookId ? { ...b, ...updates, updatedAt: Date.now() } : b))
    );
  };

  const handleUpdateGlossary = (glossary: GlossaryItem[]) => {
    handleUpdateProject({ glossary });
  };

  const handleUpdateChunkHtml = (chunkId: string, newHtml: string) => {
    setBooks(prev =>
      prev.map(b => {
        if (b.id !== activeBookId) return b;
        return {
          ...b,
          chunks: b.chunks.map(c => (c.id === chunkId ? { ...c, translatedHtml: newHtml } : c)),
          updatedAt: Date.now(),
        };
      })
    );
  };

  // Provider Updates
  const handleUpdateProvider = (updated: AIProviderConfig) => {
    setProviders(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  };

  // Load a sample book into the library
  const handleLoadSampleBook = (sample: SampleBook) => {
    const chunks = chunkBookText(sample.excerpt, { maxWordsPerChunk: 700 });
    const defaultGlossary = DEFAULT_GLOSSARIES[sample.tone] || DEFAULT_GLOSSARIES.spiritual;
    const newBook: BookProject = {
      id: `sample_${sample.id}_${Date.now()}`,
      title: sample.title,
      originalTitle: sample.originalTitle,
      author: sample.author,
      translator: 'سامانه هوشمند ترجمه کتاب',
      tone: sample.tone,
      providerId: activeProviderId,
      model: project.model || 'gemini-3.8-flash',
      glossary: [...defaultGlossary],
      chunks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setBooks(prev => [newBook, ...prev]);
    setActiveBookId(newBook.id);
    setActiveChunkId(chunks[0]?.id || null);
  };

  // Create new custom project from modal
  const handleCreateProject = (newBook: BookProject) => {
    setBooks(prev => [newBook, ...prev]);
    setActiveBookId(newBook.id);
    setActiveChunkId(newBook.chunks[0]?.id || null);
  };

  const handleDeleteBook = (id: string) => {
    setBooks(prev => {
      const remaining = prev.filter(b => b.id !== id);
      if (activeBookId === id && remaining.length > 0) {
        setActiveBookId(remaining[0].id);
        setActiveChunkId(remaining[0].chunks[0]?.id || null);
      }
      return remaining;
    });
  };

  // Active provider config
  const activeProvider = providers.find(p => p.id === activeProviderId) || providers[0];

  // Translate Single Chunk Core Function
  const translateSingleChunk = async (chunkId: string): Promise<boolean> => {
    const chunk = project.chunks.find(c => c.id === chunkId);
    if (!chunk) return false;

    // Set chunk status to translating
    setBooks(prev =>
      prev.map(b => {
        if (b.id !== activeBookId) return b;
        return {
          ...b,
          chunks: b.chunks.map(c =>
            c.id === chunkId ? { ...c, status: 'translating', errorMessage: undefined } : c
          ),
        };
      })
    );

    try {
      const chunkIdx = project.chunks.findIndex(c => c.id === chunkId);
      const prevChunks = project.chunks.slice(0, chunkIdx).filter(c => c.translatedHtml);
      const previousSummary =
        prevChunks.length > 0
          ? `خلاصه بخش‌های گذشته: نویسنده در بخش‌های قبلی موضوعات آغازین را شرح داد.`
          : undefined;

      const chosenModel = activeProvider.selectedModel || project.model || 'gemini-3.8-flash';

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkId,
          englishText: chunk.englishText,
          chapterTitle: chunk.chapterTitle,
          tone: project.tone,
          model: chosenModel,
          serverPool: serverPool,
          glossary: project.glossary,
          previousSummary,
        }),
      });

      let data: any = null;
      let rawText = '';
      try {
        rawText = await res.text();
        data = JSON.parse(rawText);
      } catch {
        const trimmed = rawText.trim();
        if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<!doctype') || trimmed.toLowerCase().includes('<html')) {
          throw new Error(`سرور بک‌اند به جای خروجی JSON، یک صفحه وب HTML با کد وضعیت ${res.status} برگرداند. لطفاً اطمینان حاصل فرمایید سرویس Node.js روی سرور در حال اجراست و مسیر /api مسدود نشده است.`);
        }
        throw new Error(`پاسخ نامعتبر از سرور (کد ${res.status}): ${rawText.slice(0, 150)}`);
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `خطای سرور ترجمه (کد ${res.status})`);
      }

      setBooks(prev =>
        prev.map(b => {
          if (b.id !== activeBookId) return b;
          return {
            ...b,
            chunks: b.chunks.map(c =>
              c.id === chunkId
                ? {
                    ...c,
                    status: 'completed',
                    translatedHtml: data.translatedHtml,
                    keyUsed: data.keyUsed,
                    modelUsed: data.model,
                    providerUsed: data.provider || activeProvider.name,
                    serverUsed: data.serverUsed,
                    switchOccurred: data.switchOccurred,
                    translatedAt: Date.now(),
                  }
                : c
            ),
            updatedAt: Date.now(),
          };
        })
      );

      fetchServerStatus();
      return true;
    } catch (err: any) {
      console.error('Translation error:', err);
      setBooks(prev =>
        prev.map(b => {
          if (b.id !== activeBookId) return b;
          return {
            ...b,
            chunks: b.chunks.map(c =>
              c.id === chunkId
                ? { ...c, status: 'error', errorMessage: err.message || 'خطا در ارتباط با هوش مصنوعی' }
                : c
            ),
          };
        })
      );
      fetchServerStatus();
      return false;
    }
  };

  // Batch Translation Runner
  const handleStartBatchTranslate = async () => {
    isBatchCancelledRef.current = false;
    setIsBatchTranslating(true);

    const pendingChunks = project.chunks.filter(c => !c.translatedHtml);
    if (pendingChunks.length === 0) {
      alert('تمام بخش‌های این کتاب قبلاً ترجمه شده‌اند.');
      setIsBatchTranslating(false);
      return;
    }

    setBatchProgress({
      current: 1,
      total: pendingChunks.length,
      secondsToNextCall: 0,
    });

    for (let i = 0; i < pendingChunks.length; i++) {
      if (isBatchCancelledRef.current) break;

      const chunk = pendingChunks[i];
      setActiveChunkId(chunk.id);

      setBatchProgress(prev => ({
        ...prev,
        current: i + 1,
        total: pendingChunks.length,
        secondsToNextCall: 0,
      }));

      await translateSingleChunk(chunk.id);

      // Safe Delay Countdown (3 seconds) between requests
      if (i < pendingChunks.length - 1 && !isBatchCancelledRef.current) {
        for (let sec = 3; sec > 0; sec--) {
          if (isBatchCancelledRef.current) break;
          setBatchProgress(prev => ({ ...prev, secondsToNextCall: sec }));
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    setIsBatchTranslating(false);
    setBatchProgress({ current: 0, total: 0, secondsToNextCall: 0 });
  };

  const handleStopBatchTranslate = () => {
    isBatchCancelledRef.current = true;
    setIsBatchTranslating(false);
  };

  // Chunk Navigation
  const currentIndex = project.chunks.findIndex(c => c.id === activeChunkId);
  const currentChunk = project.chunks[currentIndex] || project.chunks[0] || null;

  const handleSelectPrevChunk = () => {
    if (currentIndex > 0) {
      setActiveChunkId(project.chunks[currentIndex - 1].id);
    }
  };

  const handleSelectNextChunk = () => {
    if (currentIndex < project.chunks.length - 1) {
      setActiveChunkId(project.chunks[currentIndex + 1].id);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-['Vazirmatn'] selection:bg-indigo-600 selection:text-white">
      
      {/* Printable Document (only visible on print) */}
      <PrintDocument project={project} />

      {/* Main Interactive App UI */}
      <div className="no-print flex flex-col min-h-screen">
        
        {/* Navigation Bar */}
        <Navbar
          currentProject={project}
          serverStatus={serverStatus}
          onOpenServerModal={() => setIsServerModalOpen(true)}
          onOpenNewBookModal={() => setIsNewBookModalOpen(true)}
          onOpenGlossaryModal={() => setIsGlossaryModalOpen(true)}
          onLoadSampleBook={handleLoadSampleBook}
          onPrintPdf={handlePrintPdf}
          onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
          booksCount={books.length}
          onOpenProvidersModal={() => setIsProvidersModalOpen(true)}
          activeProviderName={serverPool.find(s => s.isEnabled)?.name.split(' (')[0] || 'جمینای'}
          onOpenDesignModal={() => setIsDesignModalOpen(true)}
        />

        {/* Project Header Bar */}
        <ProjectHeader
          project={project}
          onUpdateProject={handleUpdateProject}
          onOpenGlossaryModal={() => setIsGlossaryModalOpen(true)}
          onOpenTokenModal={() => setIsTokenModalOpen(true)}
          onOpenExportModal={() => setIsDesignModalOpen(true)}
        />

        {/* Studio Body: Sidebar + Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <ChunkListSidebar
            chunks={project.chunks}
            activeChunkId={activeChunkId}
            onSelectChunk={setActiveChunkId}
            onTranslateChunk={translateSingleChunk}
            isBatchTranslating={isBatchTranslating}
          />

          <TranslationWorkspace
            currentChunk={currentChunk}
            project={project}
            onUpdateChunkHtml={handleUpdateChunkHtml}
            onTranslateCurrentChunk={() => currentChunk && translateSingleChunk(currentChunk.id)}
            onStartBatchTranslate={handleStartBatchTranslate}
            onStopBatchTranslate={handleStopBatchTranslate}
            isBatchTranslating={isBatchTranslating}
            batchProgress={batchProgress}
            onSelectPrevChunk={handleSelectPrevChunk}
            onSelectNextChunk={handleSelectNextChunk}
            hasPrevChunk={currentIndex > 0}
            hasNextChunk={currentIndex < project.chunks.length - 1}
            onUpdateModel={(model) => handleUpdateProject({ model })}
            serverPool={serverPool}
            onOpenServerPoolModal={() => setIsProvidersModalOpen(true)}
          />
        </div>

      </div>

      {/* Modals */}
      <GlossaryModal
        isOpen={isGlossaryModalOpen}
        onClose={() => setIsGlossaryModalOpen(false)}
        project={project}
        onUpdateGlossary={handleUpdateGlossary}
      />

      <ServerStatusModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        status={serverStatus}
        onRefresh={fetchServerStatus}
        selectedModel={project.model || 'gemini-3.8-flash'}
        onSelectModel={(model) => handleUpdateProject({ model })}
      />

      <NewBookModal
        isOpen={isNewBookModalOpen}
        onClose={() => setIsNewBookModalOpen(false)}
        onCreateProject={handleCreateProject}
        defaultModel={activeProvider.selectedModel || project.model || 'gemini-3.8-flash'}
      />

      <TokenEstimatorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        project={project}
      />

      <ProviderManagerModal
        isOpen={isProvidersModalOpen}
        onClose={() => setIsProvidersModalOpen(false)}
        serverPool={serverPool}
        onUpdateServerPool={setServerPool}
      />

      <BooksLibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        books={books}
        activeBookId={activeBookId}
        onSelectBook={(id) => {
          setActiveBookId(id);
          const target = books.find(b => b.id === id);
          if (target) {
            setActiveChunkId(target.chunks[0]?.id || null);
          }
        }}
        onDeleteBook={handleDeleteBook}
        onOpenNewBookModal={() => setIsNewBookModalOpen(true)}
      />

      {/* Book Design, Spiritual Themes, Header/Footer & Export Studio Modal */}
      <ExportDesignModal
        isOpen={isDesignModalOpen}
        onClose={() => setIsDesignModalOpen(false)}
        project={project}
        onUpdateDesign={(designConfig) => handleUpdateProject({ designConfig })}
        onPrintPdf={handlePrintPdf}
      />
    </div>
  );
}
