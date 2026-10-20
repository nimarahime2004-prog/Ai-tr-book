import { BookChunk } from '../types.ts';

export interface ChunkOptions {
  maxWordsPerChunk?: number; // Target word count per chunk, default ~700
}

export function chunkBookText(rawText: string, options: ChunkOptions = {}): BookChunk[] {
  const maxWords = options.maxWordsPerChunk || 700;
  const chunks: BookChunk[] = [];

  if (!rawText || !rawText.trim()) return chunks;

  // Normalize line endings
  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Chapter detection pattern
  const chapterPattern = /(?:^|\n)(?:#{1,3}\s+|(?:CHAPTER|Chapter|PART|Part|Section|SECTION)\s+(?:[0-9]+|[IVXLCDM]+|[A-Za-z]+)[\s:—–-]*[^\n]*)/i;

  // Split into raw chapter blocks if multiple chapters found
  const rawChapters: { title: string; body: string }[] = [];
  const lines = cleanText.split('\n');

  let currentTitle = 'مقدمه و بخش نخست';
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading =
      /^(?:#{1,3}\s+|(?:CHAPTER|Chapter|PART|Part|Section|SECTION)\s+[0-9IVXLCDM]+)/i.test(line.trim()) ||
      (line.length < 80 && /^(?:Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|فصل\s+\d+)/i.test(line.trim()));

    if (isHeading && currentLines.join('\n').trim().length > 100) {
      rawChapters.push({
        title: currentTitle,
        body: currentLines.join('\n').trim(),
      });
      currentTitle = line.replace(/^#+\s*/, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    rawChapters.push({
      title: currentTitle,
      body: currentLines.join('\n').trim(),
    });
  }

  // If no chapter headings were detected, treat the entire text as one block
  if (rawChapters.length === 0) {
    rawChapters.push({
      title: 'متن اصلی کتاب',
      body: cleanText.trim(),
    });
  }

  let globalChunkCounter = 1;

  rawChapters.forEach((ch, chIdx) => {
    const paragraphs = ch.body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let currentChunkParagraphs: string[] = [];
    let currentWordCount = 0;
    let subChunkNumber = 1;

    const commitSubChunk = () => {
      if (currentChunkParagraphs.length === 0) return;
      const englishText = currentChunkParagraphs.join('\n\n');
      const words = englishText.split(/\s+/).filter(Boolean).length;

      chunks.push({
        id: `chk_${Date.now()}_${globalChunkCounter}`,
        chapterNumber: chIdx + 1,
        chapterTitle: ch.title,
        chunkNumber: subChunkNumber,
        englishText,
        wordCount: words,
        estimatedTokens: Math.ceil(words * 1.35),
        status: 'idle',
      });

      globalChunkCounter++;
      subChunkNumber++;
      currentChunkParagraphs = [];
      currentWordCount = 0;
    };

    paragraphs.forEach(p => {
      const pWords = p.split(/\s+/).filter(Boolean).length;
      if (currentWordCount + pWords > maxWords && currentWordCount > 250) {
        commitSubChunk();
      }
      currentChunkParagraphs.push(p.trim());
      currentWordCount += pWords;
    });

    commitSubChunk();
  });

  return chunks;
}
