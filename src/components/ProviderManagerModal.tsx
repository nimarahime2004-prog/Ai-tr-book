import React, { useState } from 'react';
import {
  X,
  Server,
  Key,
  Globe,
  Cpu,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Layers,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Edit3,
  Eye,
  EyeOff
} from 'lucide-react';
import { APIServerEndpoint, ProviderType } from '../types.ts';

interface ProviderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverPool: APIServerEndpoint[];
  onUpdateServerPool: (pool: APIServerEndpoint[]) => void;
}

export const ProviderManagerModal: React.FC<ProviderManagerModalProps> = ({
  isOpen,
  onClose,
  serverPool,
  onUpdateServerPool,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New server form state
  const [newServerName, setNewServerName] = useState('');
  const [newProviderType, setNewProviderType] = useState<ProviderType>('openrouter');
  const [newBaseURL, setNewBaseURL] = useState('https://openrouter.ai/api/v1');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('deepseek/deepseek-r1');
  const [showNewKey, setShowNewKey] = useState(false);

  // Edit server state
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editServerData, setEditServerData] = useState<{
    name: string;
    providerType: ProviderType;
    baseURL: string;
    apiKey: string;
    model: string;
    isEnabled: boolean;
  } | null>(null);
  const [showEditKey, setShowEditKey] = useState(false);
  
  // Testing states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latencyMs?: number; error?: string }>>({});
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProviderTypeChange = (type: ProviderType) => {
    setNewProviderType(type);
    if (type === 'gemini') {
      setNewBaseURL('');
      setNewModel('gemini-3.8-flash');
      if (!newServerName || newServerName.includes('سرور')) setNewServerName('سرور گوگل جمینای');
    } else if (type === 'openrouter') {
      setNewBaseURL('https://openrouter.ai/api/v1');
      setNewModel('deepseek/deepseek-r1');
      if (!newServerName || newServerName.includes('سرور')) setNewServerName('سرور OpenRouter');
    } else if (type === 'openai') {
      setNewBaseURL('https://api.openai.com/v1');
      setNewModel('gpt-4o');
      if (!newServerName || newServerName.includes('سرور')) setNewServerName('سرور OpenAI رسمی');
    } else if (type === 'deepseek') {
      setNewBaseURL('https://api.deepseek.com/v1');
      setNewModel('deepseek-chat');
      if (!newServerName || newServerName.includes('سرور')) setNewServerName('سرور DeepSeek مستقیم');
    } else if (type === 'glm') {
      setNewBaseURL('https://open.bigmodel.cn/api/paas/v4');
      setNewModel('glm-4-flash');
      if (!newServerName || newServerName.includes('سرور')) setNewServerName('سرور GLM Zhipu');
    } else {
      setNewBaseURL('https://api.groq.com/openai/v1');
      setNewModel('llama-3.3-70b-versatile');
      if (!newServerName || newServerName.includes('سرور')) setNewServerName('سرور واسط / پروکسی');
    }
  };

  const handleEditProviderTypeChange = (type: ProviderType) => {
    if (!editServerData) return;
    let defBase = editServerData.baseURL;
    let defModel = editServerData.model;

    if (type === 'gemini') {
      defBase = '';
      defModel = 'gemini-3.8-flash';
    } else if (type === 'openrouter') {
      if (!defBase || defBase.includes('openai.com') || defBase.includes('deepseek.com')) defBase = 'https://openrouter.ai/api/v1';
      if (!defModel || defModel.includes('gemini') || defModel.includes('gpt')) defModel = 'deepseek/deepseek-r1';
    } else if (type === 'openai') {
      if (!defBase || defBase.includes('openrouter')) defBase = 'https://api.openai.com/v1';
      if (!defModel || defModel.includes('deepseek')) defModel = 'gpt-4o';
    } else if (type === 'deepseek') {
      if (!defBase || defBase.includes('openrouter')) defBase = 'https://api.deepseek.com/v1';
      if (!defModel || defModel.includes('gpt')) defModel = 'deepseek-chat';
    } else if (type === 'glm') {
      defBase = 'https://open.bigmodel.cn/api/paas/v4';
      defModel = 'glm-4-flash';
    } else if (type === 'custom') {
      if (!defBase) defBase = 'https://api.groq.com/openai/v1';
    }

    setEditServerData({
      ...editServerData,
      providerType: type,
      baseURL: defBase,
      model: defModel,
    });
  };

  const handleStartEdit = (server: APIServerEndpoint) => {
    setEditingServerId(server.id);
    setEditServerData({
      name: server.name,
      providerType: server.providerType,
      baseURL: server.baseURL,
      apiKey: server.apiKey,
      model: server.model,
      isEnabled: server.isEnabled,
    });
    setShowEditKey(false);
  };

  const handleCancelEdit = () => {
    setEditingServerId(null);
    setEditServerData(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServerId || !editServerData) return;

    if (editServerData.providerType !== 'gemini' && !editServerData.apiKey.trim()) {
      alert('لطفاً کلید API را وارد فرمایید.');
      return;
    }

    onUpdateServerPool(
      serverPool.map(s => {
        if (s.id !== editingServerId) return s;
        return {
          ...s,
          name: editServerData.name.trim() || s.name,
          providerType: editServerData.providerType,
          baseURL: editServerData.baseURL.trim(),
          apiKey: editServerData.apiKey.trim(),
          model: editServerData.model.trim() || s.model,
        };
      })
    );

    setSaveBanner(`تنظیمات سرور «${editServerData.name}» با موفقیت به‌روزرسانی و ذخیره شد.`);
    setTimeout(() => setSaveBanner(null), 3500);
    setEditingServerId(null);
    setEditServerData(null);
  };

  const handleTestServer = async (server: { providerType: ProviderType; apiKey: string; baseURL: string; model: string }, id: string) => {
    setTestingId(id);
    try {
      let isSuccess = false;
      let latencyMs = 0;
      let errorMsg: string | undefined = undefined;

      // Clean base url
      let effectiveBaseUrl = (server.baseURL || '').trim();
      if (!effectiveBaseUrl) {
        if (server.providerType === 'openrouter') effectiveBaseUrl = 'https://openrouter.ai/api/v1';
        else if (server.providerType === 'deepseek') effectiveBaseUrl = 'https://api.deepseek.com/v1';
        else if (server.providerType === 'openai') effectiveBaseUrl = 'https://api.openai.com/v1';
      }

      // Ping and test API key strictly through the backend server (Node.js proxy)
      // This guarantees all requests originate from the server IP, so users can connect from any location/device without VPN.
      try {
        const res = await fetch('/api/keys/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: server.providerType,
            apiKey: server.apiKey,
            baseURL: effectiveBaseUrl,
            model: server.model,
          }),
        });

        const rawText = await res.text();
        const trimmed = rawText.trim();
        if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<!doctype') || trimmed.toLowerCase().includes('<html')) {
          isSuccess = false;
          errorMsg = `پاسخ وب HTML از سرور دریافت شد (کد ${res.status}). لطفاً مطمئن شوید سرویس Node.js روی سرور فعال است و مسیر /api توسط IIS مسدود نشده است.`;
        } else {
          try {
            const data = JSON.parse(rawText);
            isSuccess = res.ok && Boolean(data?.success);
            latencyMs = data?.latencyMs || 0;
            errorMsg = data?.error;
          } catch {
            isSuccess = false;
            errorMsg = `پاسخ نامعتبر از سرور: ${trimmed.slice(0, 150)}`;
          }
        }
      } catch (networkErr: any) {
        isSuccess = false;
        errorMsg = networkErr?.message || 'عدم دسترسی به سرور بک‌اند برنامه. لطفاً وضعیت سرویس Node.js را بررسی نمایید.';
      }

      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: isSuccess,
          latencyMs,
          error: errorMsg,
        },
      }));

      // Update in server pool if it exists
      if (serverPool.some(s => s.id === id) && isSuccess) {
        onUpdateServerPool(
          serverPool.map(s => (s.id === id ? { ...s, lastLatencyMs: latencyMs, lastTestedAt: Date.now() } : s))
        );
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: false,
          error: err.message || 'خطا در ارسال تست اتصال',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProviderType !== 'gemini' && !newApiKey.trim()) {
      alert('لطفاً کلید API را برای این سرور وارد نمایید.');
      return;
    }

    const newEndpoint: APIServerEndpoint = {
      id: `server_${Date.now()}`,
      name: newServerName.trim() || `سرور ${serverPool.length + 1}`,
      providerType: newProviderType,
      baseURL: newBaseURL.trim(),
      apiKey: newApiKey.trim(),
      model: newModel.trim() || 'gemini-3.8-flash',
      isEnabled: true,
      priority: serverPool.length + 1,
      status: 'active',
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
    };

    onUpdateServerPool([...serverPool, newEndpoint]);
    setShowAddForm(false);
    setNewApiKey('');
    setNewServerName('');
    setSaveBanner('سرور جدید با موفقیت به استخر سوئیچ خودکار اضافه شد.');
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleToggleServer = (id: string) => {
    onUpdateServerPool(
      serverPool.map(s => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s))
    );
  };

  const handleDeleteServer = (id: string) => {
    if (serverPool.length <= 1) {
      setSaveBanner('حداقل یک سرور باید در استخر چرخش باقی بماند.');
      setTimeout(() => setSaveBanner(null), 3000);
      return;
    }
    const target = serverPool.find(s => s.id === id);
    onUpdateServerPool(serverPool.filter(s => s.id !== id));
    setDeleteConfirmId(null);
    setSaveBanner(`سرور «${target?.name || ''}» با موفقیت از استخر حذف شد.`);
    setTimeout(() => setSaveBanner(null), 3000);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newPool = [...serverPool];
    const temp = newPool[index];
    newPool[index] = newPool[index - 1];
    newPool[index - 1] = temp;
    onUpdateServerPool(newPool);
  };

  const handleMoveDown = (index: number) => {
    if (index === serverPool.length - 1) return;
    const newPool = [...serverPool];
    const temp = newPool[index];
    newPool[index] = newPool[index + 1];
    newPool[index + 1] = temp;
    onUpdateServerPool(newPool);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">استخر سرورهای API و سیستم سوئیچ خودکار (Failover Pool)</h2>
              <p className="text-xs text-slate-400">
                چندین سرور API اضافه کنید تا در صورت قطعی یا عدم پاسخگویی، سامانه به طور خودکار سوئیچ کند
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

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Tone & Prompt Preservation Guarantee Box */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-300">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold text-emerald-200">
                تضمین قطعی ثبات لحن، پرامپت و قالب‌بندی هنگام سوئیچ هوش مصنوعی:
              </strong>
              <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                تمام سرورهای موجود در این لیست دقیقاً همان پرامپت سیستمی جامع، واژه‌نامه تخصصی کتاب، لحن انتخابی و کدهای رنگی Word (<span className="font-mono text-emerald-300">#1a365d, #2b6cb0, #9b2c2c</span>) را دریافت می‌کنند. حتی با سوئیچ میان ارائه‌دهندگان، لحن و پیوستگی متن هیچ‌گونه تغییری نخواهد کرد.
              </p>
            </div>
          </div>

          {/* Server-Side Proxy / IP Independence Guarantee */}
          <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-blue-300">
            <Globe className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block font-bold text-blue-200">
                ارتباط ۱۰۰٪ از طریق سرور اختصاصی برنامه (بدون وابستگی به IP کاربر):
              </strong>
              <p className="text-[11px] text-blue-300/90 leading-relaxed">
                کلیه تست‌های پینگ، اعتبارسنجی کلیدها و ترجمه‌ها منحصراً توسط بک‌اند سرور برنامه اجرا می‌شوند (نه از مرورگر کاربر). بنابراین کاربران فارغ از لوکیشن یا محدودیت‌های IP و بدون نیاز به روشن بودن VPN روی دستگاه خود، می‌توانند به آسانی از سیستم استفاده کنند.
              </p>
            </div>
          </div>

          {/* Add Server Button Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">فهرست سرورهای متصل در استخر چرخش:</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {serverPool.filter(s => s.isEnabled).length} فعال از {serverPool.length} سرور
              </span>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'بستن فرم' : 'افزودن سرور / کلید جدید'}</span>
            </button>
          </div>

          {/* Add New Server Form */}
          {showAddForm && (
            <form onSubmit={handleAddServer} className="bg-slate-850 p-4 rounded-2xl border border-indigo-500/40 space-y-3.5 transition">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>مشخصات سرور یا کلید جدید:</span>
                </span>
                <span className="text-[10px] text-slate-400">به انتهای زنجیره سوئیچ اضافه می‌شود</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">عنوان یا برچسب سرور:</label>
                  <input
                    type="text"
                    value={newServerName}
                    onChange={e => setNewServerName(e.target.value)}
                    placeholder="مثلاً: سرور ۲ (OpenRouter DeepSeek)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">نوع ارائه‌دهنده مرجع:</label>
                  <select
                    value={newProviderType}
                    onChange={e => handleProviderTypeChange(e.target.value as ProviderType)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="gemini">Google Gemini (جمینای)</option>
                    <option value="openrouter">OpenRouter (کل مدل‌ها: DeepSeek, Claude, Llama)</option>
                    <option value="openai">OpenAI (رسمی ChatGPT)</option>
                    <option value="deepseek">DeepSeek (مستقیم)</option>
                    <option value="glm">GLM / Zhipu AI</option>
                    <option value="custom">سرور واسط / پروکسی / Groq / Local</option>
                  </select>
                </div>

                {newProviderType !== 'gemini' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">آدرس سرور (Base URL):</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={newBaseURL}
                      onChange={e => setNewBaseURL(e.target.value)}
                      placeholder="https://openrouter.ai/api/v1"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">مدل انتخابی این سرور:</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={newModel}
                    onChange={e => setNewModel(e.target.value)}
                    placeholder="e.g. deepseek/deepseek-r1 or gpt-4o"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className={newProviderType === 'gemini' ? 'sm:col-span-2' : ''}>
                  <label className="block text-slate-300 mb-1 font-semibold">کلید اختصاصی API Key:</label>
                  <input
                    type="password"
                    dir="ltr"
                    value={newApiKey}
                    onChange={e => setNewApiKey(e.target.value)}
                    placeholder={newProviderType === 'gemini' ? 'اختیاری (پیش‌فرض سیستم اعمال می‌شود)' : 'sk-or-...'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>ثبت و فعال‌سازی در استخر</span>
                </button>
              </div>
            </form>
          )}

          {/* Banner message */}
          {saveBanner && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveBanner}</span>
            </div>
          )}

          {/* Connected Servers List Table */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>ترتیب اولویت سرورها در سوئیچ خودکار (سرور بالاتر اول تست می‌شود):</span>
              <span>تعداد کل سرورها: {serverPool.length}</span>
            </div>

            <div className="divide-y divide-slate-850">
              {serverPool.map((server, idx) => {
                const isTestingThis = testingId === server.id;
                const testResult = testResults[server.id];

                return (
                  <div key={server.id} className="transition">
                    <div
                      className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        server.isEnabled ? 'bg-slate-900/40 hover:bg-slate-900/70' : 'bg-slate-950/80 opacity-60'
                      }`}
                    >
                    
                    {/* Left details */}
                    <div className="flex items-start gap-3">
                      {/* Priority Badge & Reorder */}
                      <div className="flex flex-col items-center justify-center pt-0.5">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center text-[10px] font-bold font-mono">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-0.5 mt-1">
                          <button
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-0.5 rounded text-slate-500 hover:text-white disabled:opacity-20"
                            title="انتقال به اولویت بالاتر"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === serverPool.length - 1}
                            className="p-0.5 rounded text-slate-500 hover:text-white disabled:opacity-20"
                            title="انتقال به اولویت پایین‌تر"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Server Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-white">{server.name}</strong>
                          <span className="text-[10px] px-2 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                            {server.providerType.toUpperCase()}
                          </span>
                          {idx === 0 && server.isEnabled && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                              سرور پیش‌فرض اول
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-3" dir="ltr">
                          <span>Model: <strong className="text-purple-300">{server.model}</strong></span>
                          {server.baseURL && (
                            <span className="text-slate-500 truncate max-w-[200px]">URL: {server.baseURL}</span>
                          )}
                        </div>

                        {/* Ping Result */}
                        <div className="mt-1">
                          {testResult ? (
                            testResult.success ? (
                              <span className="text-[11px] text-emerald-400 font-bold font-mono">
                                ✓ اتصال برقرار ({testResult.latencyMs}ms)
                              </span>
                            ) : (
                              <span className="text-[10px] text-red-400 truncate max-w-xs block" title={testResult.error}>
                                ✗ خطا: {testResult.error}
                              </span>
                            )
                          ) : server.lastLatencyMs ? (
                            <span className="text-[11px] text-slate-400 font-mono">
                              آخرین پینگ: {server.lastLatencyMs}ms
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      
                      {/* Test Ping Button */}
                      <button
                        onClick={() => handleTestServer(server, server.id)}
                        disabled={isTestingThis}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1"
                        title="تست پینگ و اتصال زنده"
                      >
                        {isTestingThis ? (
                          <RotateCw className="w-3 h-3 animate-spin text-blue-400" />
                        ) : (
                          <Play className="w-2.5 h-2.5 fill-current text-emerald-400" />
                        )}
                        <span>{isTestingThis ? 'درحال تست...' : 'تست پینگ'}</span>
                      </button>

                      {/* Edit Server & API Button */}
                      <button
                        onClick={() => {
                          if (editingServerId === server.id) {
                            handleCancelEdit();
                          } else {
                            handleStartEdit(server);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                          editingServerId === server.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                        title="ویرایش کلید API، آدرس، مدل و نام این سرور"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{editingServerId === server.id ? 'بستن ویرایش' : 'ویرایش API'}</span>
                      </button>

                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => handleToggleServer(server.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          server.isEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                        title={server.isEnabled ? 'غیرفعال کردن در سوئیچ خودکار' : 'فعال کردن در سوئیچ خودکار'}
                      >
                        {server.isEnabled ? '✓ فعال در چرخش' : 'غیرفعال'}
                      </button>

                      {/* Delete with inline confirmation */}
                      {serverPool.length > 1 && (
                        deleteConfirmId === server.id ? (
                          <div className="flex items-center gap-1 bg-red-950/90 p-1 rounded-lg border border-red-500/50">
                            <button
                              onClick={() => handleDeleteServer(server.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white transition"
                            >
                              حذف
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="انصراف"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(server.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                            title="حذف سرور"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>

                  </div>

                  {/* Inline Server / API Editing Panel */}
                  {editingServerId === server.id && editServerData && (
                    <form onSubmit={handleSaveEdit} className="p-4 bg-slate-900 border-t border-amber-500/30 space-y-3.5 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-amber-400" />
                          <span>ویرایش مشخصات و کلید API برای «{server.name}»:</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          تغییرات به طور زنده ذخیره می‌شود
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">عنوان یا برچسب سرور:</label>
                          <input
                            type="text"
                            value={editServerData.name}
                            onChange={e => setEditServerData({ ...editServerData, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">نوع ارائه‌دهنده مرجع:</label>
                          <select
                            value={editServerData.providerType}
                            onChange={e => handleEditProviderTypeChange(e.target.value as ProviderType)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                          >
                            <option value="gemini">Google Gemini (جمینای)</option>
                            <option value="openrouter">OpenRouter (کل مدل‌ها: DeepSeek, Claude, Llama)</option>
                            <option value="openai">OpenAI (رسمی ChatGPT)</option>
                            <option value="deepseek">DeepSeek (مستقیم)</option>
                            <option value="glm">GLM / Zhipu AI</option>
                            <option value="custom">سرور واسط / پروکسی / Groq / Local</option>
                          </select>
                        </div>

                        {editServerData.providerType !== 'gemini' && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-300 font-semibold">آدرس سرور (Base URL):</label>
                              <span className="text-[10px] text-amber-400/90 font-mono">باید به /v1 ختم شود</span>
                            </div>
                            <input
                              type="text"
                              dir="ltr"
                              value={editServerData.baseURL}
                              onChange={e => setEditServerData({ ...editServerData, baseURL: e.target.value })}
                              placeholder="https://openrouter.ai/api/v1"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold">مدل انتخابی این سرور:</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={editServerData.model}
                            onChange={e => setEditServerData({ ...editServerData, model: e.target.value })}
                            placeholder="e.g. deepseek/deepseek-r1 or gpt-4o"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                            required
                          />
                        </div>

                        <div className={editServerData.providerType === 'gemini' ? 'sm:col-span-2' : ''}>
                          <label className="block text-slate-300 mb-1 font-semibold">
                            کلید اختصاصی API Key:
                          </label>
                          <div className="relative">
                            <input
                              type={showEditKey ? 'text' : 'password'}
                              dir="ltr"
                              value={editServerData.apiKey}
                              onChange={e => setEditServerData({ ...editServerData, apiKey: e.target.value })}
                              placeholder={editServerData.providerType === 'gemini' ? 'اختیاری (در صورت خالی بودن، کلید پیش‌فرض اعمال می‌شود)' : 'sk-...'}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 pl-10 text-white font-mono focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditKey(!showEditKey)}
                              className="absolute left-2 top-2 text-slate-400 hover:text-white p-1"
                              title={showEditKey ? 'مخفی کردن کلید' : 'نمایش کلید'}
                            >
                              {showEditKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Live Test Status inside Edit Form */}
                      {testResults[server.id] && (
                        <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                          testResults[server.id].success
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/10 border border-red-500/20 text-red-300'
                        }`}>
                          <div className="flex items-center gap-2">
                            {testResults[server.id].success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span>
                              {testResults[server.id].success
                                ? `تست موفق بود! زمان پاسخگویی: ${testResults[server.id].latencyMs} میلی‌ثانیه`
                                : `خطا در تست: ${testResults[server.id].error}`}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleTestServer(editServerData, server.id)}
                          disabled={testingId === server.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5"
                        >
                          {testingId === server.id ? (
                            <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          ) : (
                            <Play className="w-3 h-3 fill-current text-emerald-400" />
                          )}
                          <span>{testingId === server.id ? 'درحال تست اتصال...' : 'تست پینگ همین مشخصات'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                          >
                            انصراف
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>ذخیره تغییرات سرور</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            سوئیچ خودکار: <strong className="text-emerald-400">فعال (در صورت بروز هرگونه خطا بلافاصله سوئیچ می‌شود)</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            تأیید و ذخیره
          </button>
        </div>

      </div>
    </div>
  );
};
