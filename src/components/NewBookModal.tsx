import React, { useState } from 'react';
import {
  X,
  Upload,
  BookOpen,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
  Calculator,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { BookProject, ToneId } from '../types.ts';
import { TONE_DEFINITIONS, DEFAULT_GLOSSARIES } from '../constants/tones.ts';
import { chunkBookText } from '../utils/chunker.ts';

interface NewBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: BookProject) => void;
  defaultModel: string;
}

export const NewBookModal: React.FC<NewBookModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  defaultModel,
}) => {
  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [translator, setTranslator] = useState('');
  const [tone, setTone] = useState<ToneId>('spiritual');
  const [model, setModel] = useState(defaultModel || 'gemini-3.8-flash');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [maxWordsPerChunk, setMaxWordsPerChunk] = useState(700);

  if (!isOpen) return null;

  // Live calculation
  const wordsCount = rawText.split(/\s+/).filter(Boolean).length;
  const estimatedInputTokens = Math.ceil(wordsCount * 1.35);
  const estimatedOutputTokens = Math.ceil(wordsCount * 1.65);
  const totalTokens = estimatedInputTokens + estimatedOutputTokens;
  const estimatedChunks = Math.max(1, Math.ceil(wordsCount / maxWordsPerChunk));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.chunks && Array.isArray(parsed.chunks)) {
            onCreateProject(parsed);
            onClose();
          } else {
            alert('فرمت فایل پشتیبان JSON معتبر نیست.');
          }
        } catch (err) {
          alert('خطا در خواندن فایل JSON');
        }
      };
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      if (!originalTitle) {
        setOriginalTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      alert('لطفاً متن انگلیسی کتاب را در قالب فایل txt بارگذاری کرده یا در کادر متنی وارد نمایید.');
      return;
    }

    const chunks = chunkBookText(rawText, { maxWordsPerChunk });
    const defaultGlossary = DEFAULT_GLOSSARIES[tone] || DEFAULT_GLOSSARIES.spiritual;

    const newProject: BookProject = {
      id: `proj_${Date.now()}`,
      title: title.trim() || originalTitle.trim() || 'کتاب جدید',
      originalTitle: originalTitle.trim() || 'Untitled Book',
      author: author.trim() || 'نامشخص',
      translator: translator.trim() || 'سامانه هوشمند ترجمه کتاب',
      tone,
      providerId: 'prov_gemini',
      model,
      glossary: [...defaultGlossary],
      chunks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onCreateProject(newProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">آپلود کتاب انگلیسی و قطعه‌بندی خودکار</h2>
              <p className="text-xs text-slate-400">
                پشتیبانی از فایل‌های txt و استخراج خودکار سرفصل‌ها، واژگان و محاسبه توکن
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* File Upload Box (Prominent) */}
          <div className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 bg-slate-950/60 p-5 rounded-xl text-center transition">
            <label className="cursor-pointer flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">
                  {fileName ? `فایل انتخاب شده: ${fileName}` : 'کلیک کنید یا فایل متنی کتاب (.txt) را اینجا رها کنید'}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  سامانه به صورت خودکار فصول، تیترها و پاراگراف‌ها را شناسایی و دسته‌بندی می‌کند
                </span>
              </div>
              <input
                type="file"
                accept=".txt,.md,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Live Token & Size Badge (if text is loaded) */}
          {wordsCount > 0 && (
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">کلمات شناسایی‌شده:</span>
                <strong className="text-white font-mono text-sm">{wordsCount.toLocaleString('fa-IR')}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">تعداد چانک‌ها (بخش‌ها):</span>
                <strong className="text-indigo-400 font-mono text-sm">{estimatedChunks} بخش</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">مجموع توکن تخمینی:</span>
                <strong className="text-emerald-400 font-mono text-sm">~{totalTokens.toLocaleString('fa-IR')}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">سیاست ترجمه:</span>
                <strong className="text-amber-400 text-xs">کامل و بدون سانسور</strong>
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                عنوان فارسی کتاب:
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="مثلاً: عادت‌های اتمی یا نیروی حال"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                عنوان اصلی انگلیسی:
              </label>
              <input
                type="text"
                dir="ltr"
                value={originalTitle}
                onChange={e => setOriginalTitle(e.target.value)}
                placeholder="e.g. Atomic Habits"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                نام نویسنده:
              </label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="مثلاً: James Clear"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                نام مترجم / تیم ترجمه:
              </label>
              <input
                type="text"
                value={translator}
                onChange={e => setTranslator(e.target.value)}
                placeholder="نام شما یا سامانه ترجمه"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Model & Tone Selection Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>مدل هوش مصنوعی برای ترجمه:</span>
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (پیشنهادی / هوشمند و فصیح)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (فوق سریع و کم‌مصرف)</option>
                <option value="gemini-4-argon">Gemini 4 Argon (نهایت عمق فلسفی و ادبی)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest (جدیدترین نسخه)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                لحن و زمینه کتاب:
              </label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as ToneId)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {TONE_DEFINITIONS.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Textarea preview / fallback */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              پیش‌نمایش یا چسباندن متن انگلیسی:
            </label>
            <textarea
              dir="ltr"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="متن انگلیسی کتاب را اینجا بچسبانید یا فایل txt را از بالا انتخاب کنید..."
              rows={6}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              required
            />
          </div>

          {/* Guarantees Box */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">
                قوانین فعال: <strong>بدون خلاصه‌سازی (Verbatim)</strong> و <strong>بدون سانسور اخلاقی</strong>
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold">۱۰۰٪ تضمین ترجمه کامل</span>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>قطعه‌بندی هوشمند و شروع ترجمه کتاب</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
