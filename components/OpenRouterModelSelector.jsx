'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 后备模型列表（API 失败时使用）
 */
const FALLBACK_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', popular: true },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', popular: true },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', popular: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', popular: true },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'Google', popular: true },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'Meta', popular: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek', popular: true },
];

/**
 * 热门模型 ID 列表（用于标记）
 */
const POPULAR_MODEL_IDS = new Set([
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-sonnet:beta',
  'anthropic/claude-3-opus',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-4-turbo',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
]);

/**
 * 从 OpenRouter API 获取模型列表
 */
async function fetchOpenRouterModels() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format');
    }

    // 转换为组件需要的格式
    return data.data.map(model => {
      // 提取提供商名称 (id 格式通常是 "provider/model-name")
      const provider = model.id.split('/')[0] || 'Unknown';
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

      return {
        id: model.id,
        name: model.name || model.id,
        provider: providerName,
        popular: POPULAR_MODEL_IDS.has(model.id),
        pricing: model.pricing,
        context: model.context_length,
      };
    });
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    return null;
  }
}

/**
 * OpenRouter 模型选择器组件
 *
 * @param {string} currentModel - 当前选中的模型 ID
 * @param {function} onModelChange - 模型变更回调 (modelId) => void
 */
export default function OpenRouterModelSelector({ currentModel, onModelChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allModels, setAllModels] = useState(FALLBACK_MODELS); // 所有可用模型
  const [filteredModels, setFilteredModels] = useState(FALLBACK_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);

  // 组件挂载时获取模型列表
  useEffect(() => {
    let mounted = true;

    const loadModels = async () => {
      setIsLoading(true);
      setLoadError(false);

      // 尝试从缓存读取
      try {
        const cached = localStorage.getItem('openrouter-models-cache');
        const cacheTime = localStorage.getItem('openrouter-models-cache-time');
        const now = Date.now();

        // 缓存有效期 1 小时
        if (cached && cacheTime && (now - parseInt(cacheTime)) < 3600000) {
          const models = JSON.parse(cached);
          if (mounted) {
            setAllModels(models);
            setFilteredModels(models);
            setIsLoading(false);
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to read model cache:', e);
      }

      // 从 API 获取
      const models = await fetchOpenRouterModels();

      if (!mounted) return;

      if (models && models.length > 0) {
        setAllModels(models);
        setFilteredModels(models);
        setLoadError(false);

        // 缓存结果
        try {
          localStorage.setItem('openrouter-models-cache', JSON.stringify(models));
          localStorage.setItem('openrouter-models-cache-time', Date.now().toString());
        } catch (e) {
          console.warn('Failed to cache models:', e);
        }
      } else {
        // API 失败，使用后备列表
        setLoadError(true);
      }

      setIsLoading(false);
    };

    loadModels();

    return () => {
      mounted = false;
    };
  }, []);

  // 根据搜索关键词过滤模型
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredModels(allModels);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allModels.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query) ||
      model.provider.toLowerCase().includes(query)
    );
    setFilteredModels(filtered);
  }, [searchQuery, allModels]);

  // 关闭下拉菜单的处理
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // 打开下拉菜单时自动聚焦搜索框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 获取当前模型的显示名称
  const getCurrentModelName = () => {
    const model = allModels.find(m => m.id === currentModel);
    return model?.name || currentModel || '选择模型';
  };

  const handleModelSelect = (modelId) => {
    onModelChange?.(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // 手动刷新模型列表
  const handleRefresh = async () => {
    setIsLoading(true);
    setLoadError(false);

    // 清除缓存
    try {
      localStorage.removeItem('openrouter-models-cache');
      localStorage.removeItem('openrouter-models-cache-time');
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }

    // 重新获取
    const models = await fetchOpenRouterModels();

    if (models && models.length > 0) {
      setAllModels(models);
      setFilteredModels(models);
      setLoadError(false);

      // 缓存结果
      try {
        localStorage.setItem('openrouter-models-cache', JSON.stringify(models));
        localStorage.setItem('openrouter-models-cache-time', Date.now().toString());
      } catch (e) {
        console.warn('Failed to cache models:', e);
      }
    } else {
      setLoadError(true);
    }

    setIsLoading(false);
  };

  return (
    <div className="relative">
      {/* 选择器按钮 */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all group",
          "bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200",
          "hover:from-purple-100 hover:to-indigo-100 hover:border-purple-300",
          "text-purple-700"
        )}
        title="切换 OpenRouter 模型"
      >
        <Zap className="w-3.5 h-3.5" />
        <span className="max-w-[140px] truncate">{getCurrentModelName()}</span>
        <ChevronDown className={cn(
          'w-3.5 h-3.5 transition-transform duration-200',
          isOpen ? 'rotate-180' : 'rotate-0'
        )} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl shadow-zinc-200/50 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* 搜索框 */}
          <div className="p-3 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索模型..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all bg-white"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="刷新模型列表"
              >
                <RefreshCw className={cn(
                  'w-4 h-4 text-zinc-500',
                  isLoading && 'animate-spin'
                )} />
              </button>
            </div>
          </div>

          {/* 模型列表 */}
          <div className="max-h-[400px] overflow-y-auto p-1.5">
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-zinc-500">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span>加载模型列表...</span>
                </div>
              </div>
            ) : loadError ? (
              <div className="px-4 py-6 text-center">
                <div className="text-sm text-amber-600 mb-2">
                  无法获取最新模型列表
                </div>
                <div className="text-xs text-zinc-400">
                  使用后备列表
                </div>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-400">
                没有找到匹配的模型
              </div>
            ) : (
              <>
                {/* 热门模型 */}
                {searchQuery === '' && filteredModels.some(m => m.popular) && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      热门推荐
                    </div>
                    {filteredModels.filter(m => m.popular).map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        isSelected={currentModel === model.id}
                        onSelect={handleModelSelect}
                      />
                    ))}
                    <div className="my-2 h-px bg-zinc-100" />
                    <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      所有模型
                    </div>
                  </>
                )}

                {/* 所有模型或搜索结果 */}
                {filteredModels.filter(m => searchQuery !== '' || !m.popular).map((model) => (
                  <ModelItem
                    key={model.id}
                    model={model}
                    isSelected={currentModel === model.id}
                    onSelect={handleModelSelect}
                  />
                ))}
              </>
            )}
          </div>

          {/* 底部信息栏 */}
          {!isLoading && !loadError && (
            <div className="px-3 py-2 border-t border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{allModels.length} 个可用模型</span>
                {localStorage.getItem('openrouter-models-cache-time') && (
                  <span>
                    缓存 {Math.floor((Date.now() - parseInt(localStorage.getItem('openrouter-models-cache-time'))) / 60000)} 分钟前
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 单个模型选项组件
 */
function ModelItem({ model, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(model.id)}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm group',
        isSelected
          ? 'bg-purple-50 border border-purple-200'
          : 'hover:bg-zinc-50 border border-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium truncate',
              isSelected ? 'text-purple-700' : 'text-zinc-900'
            )}>
              {model.name}
            </span>
            {model.popular && !isSelected && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded uppercase">
                Hot
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-500">{model.provider}</span>
            <span className="text-xs text-zinc-300">·</span>
            <span className="text-xs text-zinc-400 font-mono truncate">{model.id}</span>
          </div>
        </div>
        {isSelected && (
          <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}
