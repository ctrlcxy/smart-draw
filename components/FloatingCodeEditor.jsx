'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Code2, Minimize2, Play, Copy, Check, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils'; // 确保引入 cn 工具
import Editor from '@monaco-editor/react';

const STORAGE_KEY_PREFIX = 'smart-diagram-floating-code-cache:v1';

const getStorageKey = (engineType) => {
  const type = engineType || 'default';
  return `${STORAGE_KEY_PREFIX}:${type}`;
};

/**
 * 悬浮代码编辑器组件
 * 支持 XML (Draw.io) 和 JSON (Excalidraw) 语法高亮
 */
export default function FloatingCodeEditor({
  engineType = 'drawio',
  onApplyCode,
  processCode, // 代码处理函数，用于检测/修复代码
  messages = [], // 消息历史，用于获取最新生成的代码
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localCode, setLocalCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const editorRef = useRef(null);
  const prevCodeRef = useRef('');
  const prevMessagesLengthRef = useRef(0);
  const cacheAppliedRef = useRef(false); // 防止挂载时重复读取缓存

  // 编辑器语言配置
  const language = engineType === 'excalidraw' ? 'json' : 'xml';

  /**
   * 将当前编辑器/画布状态写入 localStorage
   */
  const saveCache = useCallback(
    (partial) => {
      if (typeof window === 'undefined') return;

      try {
        const key = getStorageKey(engineType);
        const raw = window.localStorage.getItem(key);
        let existing = {};

        if (raw) {
          try {
            existing = JSON.parse(raw) || {};
          } catch {
            existing = {};
          }
        }

        const payload = {
          ...existing,
          engineType,
          ...partial,
          updatedAt: Date.now(),
        };

        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to save floating editor cache:', error);
      }
    },
    [engineType],
  );

  /**
   * 从 localStorage 读取缓存
   */
  const loadCache = useCallback(() => {
    if (typeof window === 'undefined') return null;

    try {
      const key = getStorageKey(engineType);
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const storedCode = typeof parsed.code === 'string' && parsed.code.trim()
        ? parsed.code
        : (typeof parsed.canvasCode === 'string' ? parsed.canvasCode : '');

      if (!storedCode || !storedCode.trim()) return null;

      return {
        ...parsed,
        code: storedCode.trim(),
      };
    } catch (error) {
      console.error('Failed to load floating editor cache:', error);
      return null;
    }
  }, [engineType]);

  // 监听画布代码变化事件，将最新代码回填到编辑器
  useEffect(() => {
    const handleCanvasCodeChange = (event) => {
      try {
        const detail = event?.detail || {};
        const eventEngineType = detail.engineType;
        const newCode = detail.code;

        if (typeof newCode !== 'string' || !newCode.trim()) return;
        if (eventEngineType && eventEngineType !== engineType) return;

        setLocalCode(newCode);
        prevCodeRef.current = newCode;

        // 来自画布的最新状态，同步写入缓存
        saveCache({
          code: newCode,
          canvasCode: newCode,
          lastSource: 'canvas',
        });

        if (!isOpen) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Canvas code change handler error:', error);
      }
    };

    window.addEventListener('canvas-code-changed', handleCanvasCodeChange);
    return () => {
      window.removeEventListener('canvas-code-changed', handleCanvasCodeChange);
    };
  }, [engineType, isOpen, saveCache]);

  /**
   * 应用代码到画布
   * 流程：代码检测修复 -> 更新编辑器内容 -> 应用到 Canvas -> 写入缓存
   */
  const handleApply = useCallback(
    async (explicitCode) => {
      // ⚠️ 修复：onClick 事件会传入 Event 对象，需确保 explicitCode 是字符串
      const targetCode = typeof explicitCode === 'string' ? explicitCode : localCode;

      if (!targetCode?.trim() || isApplying) return;

      setIsApplying(true);
      try {
        let processedCode = targetCode;

        // 如果提供了代码处理函数，先进行检测和修复
        if (processCode) {
          const nextCode = await processCode(targetCode);
          const hasProcessedContent = typeof nextCode === 'string' && nextCode.trim().length > 0;

          // 检测失败时保留原始代码，避免清空编辑器/画布
          if (!hasProcessedContent) {
            console.warn('[FloatingCodeEditor] Processed code empty, skip apply.');
            return;
          }

          processedCode = nextCode;
          // 更新编辑器内容为修复后的代码
          setLocalCode(processedCode);
          prevCodeRef.current = processedCode;
        }

        // 应用到画布
        if (onApplyCode) {
          await onApplyCode(processedCode);
        }

        // 将最终应用到画布的代码写入缓存
        saveCache({
          code: processedCode,
          canvasCode: processedCode,
          lastSource: 'apply',
        });
      } catch (error) {
        console.error('Apply code error:', error);
      } finally {
        setIsApplying(false);
      }
    },
    [localCode, isApplying, processCode, onApplyCode, saveCache],
  );

  /**
   * 组件挂载时，尝试从缓存恢复代码并自动应用一次
   */
  useEffect(() => {
    if (cacheAppliedRef.current) return;
    cacheAppliedRef.current = true;

    const cached = loadCache();
    if (!cached || !cached.code) return;

    const cachedCode = cached.code;
    if (!cachedCode || !cachedCode.trim()) return;

    // 将缓存内容恢复到编辑器
    setLocalCode(cachedCode);
    prevCodeRef.current = cachedCode;
    setIsOpen(true);

    // 避免 LLM 初始消息被误判为“新消息”而再次自动应用
    prevMessagesLengthRef.current = messages.length;

    const applyFromCache = async () => {
      // 略微延迟，确保画布组件已完成挂载
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        await handleApply(cachedCode);
      } catch (error) {
        console.error('Auto apply cached code error:', error);
      }
    };

    applyFromCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从消息中提取代码的辅助函数
  const extractCodeFromMessage = useCallback((content) => {
    if (!content) return '';

    // 支持多模态消息结构：优先取文本部分
    if (Array.isArray(content)) {
      const textPart = content.find(c => c && c.type === 'text' && typeof c.text === 'string');
      content = textPart?.text || '';
    }

    if (typeof content !== 'string') return '';

    // 尝试提取 ```xml 或 ```json 代码块
    const xmlMatch = content.match(/```xml\s*([\s\S]*?)```/i);
    if (xmlMatch) return xmlMatch[1].trim();

    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i);
    if (jsonMatch) return jsonMatch[1].trim();

    // 尝试提取通用代码块
    const codeMatch = content.match(/```\s*([\s\S]*?)```/i);
    if (codeMatch) return codeMatch[1].trim();

    const trimmed = content.trim();
    if (!trimmed) return '';

    // 兼容当前提示词：LLM 直接输出纯 XML/JSON，而不包裹 Markdown 代码块
    // Draw.io XML 形态识别
    if (/^(<\?xml|<mxfile|<diagram|<mxGraphModel|<graph)/i.test(trimmed)) {
      return trimmed;
    }

    // Excalidraw JSON 形态识别
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return trimmed;
    }

    return '';
  }, []);

  // 当 LLM 生成结束时，自动填充代码并应用到画布
  // 通过监听 messages 长度变化来检测新消息
  useEffect(() => {
    const currentMessagesLength = messages.length;
    const messagesIncreased = currentMessagesLength > prevMessagesLengthRef.current;

    // 仅在新增的最后一条消息是 assistant 时，同步代码到编辑器并自动应用
    if (messagesIncreased && currentMessagesLength > 0) {
      const lastMessage = messages[currentMessagesLength - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        const codeContent = extractCodeFromMessage(lastMessage.content);
        if (codeContent) {
          // 先填入编辑器
          setLocalCode(codeContent);
          prevCodeRef.current = codeContent;
          setIsOpen(true);

          // 再自动应用到画布
          handleApply(codeContent);
        }
      }
    }

    prevMessagesLengthRef.current = currentMessagesLength;
  }, [messages, extractCodeFromMessage, handleApply]);

  /**
   * 复制代码到剪贴板
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [localCode]);

  /**
   * 编辑器挂载回调
   */
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  /**
   * 监听外部重置事件（例如切换引擎时清空代码与缓存）
   */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleReset = () => {
      setLocalCode('');
      prevCodeRef.current = '';
    };

    window.addEventListener('floating-code-editor-reset', handleReset);
    return () => {
      window.removeEventListener('floating-code-editor-reset', handleReset);
    };
  }, []);

  /**
   * 编辑器内容变化回调
   */
  const handleEditorChange = (value) => {
    setLocalCode(value || '');
  };

  // 收起状态 - 显示圆形 FAB 按钮
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-12 h-12 bg-zinc-900 text-white rounded-full shadow-lg shadow-zinc-900/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40 group"
        title="展开代码编辑器"
      >
        <Terminal className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
      </button>
    );
  }

  // 展开状态 - 显示完整编辑器面板
  return (
    <Card className="fixed bottom-4 left-4 w-[480px] h-[55vh] shadow-2xl flex flex-col z-40 bg-white/95 supports-[backdrop-filter]:bg-white/90 backdrop-blur-xl border border-zinc-200/80 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-zinc-100 border border-zinc-200">
            <Code2 className="w-3.5 h-3.5 text-zinc-600" />
          </div>
          <span className="text-sm font-medium text-zinc-700">
            {engineType === 'excalidraw' ? 'JSON' : 'XML'} 编辑器
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* 复制按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-lg transition-colors"
            onClick={handleCopy}
            title="复制代码"
            disabled={!localCode.trim()}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          {/* 收起按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-lg transition-colors"
            onClick={() => setIsOpen(false)}
            title="收起"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden bg-white">
        <Editor
          height="100%"
          language={language}
          theme="vs-light"
          value={localCode}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          loading={
            <div className="flex items-center justify-center h-full text-zinc-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">加载编辑器...</span>
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 1.5,
            lineNumbers: 'on',
            wordWrap: 'on',
            // formatOnPaste: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 12, bottom: 12 },
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            renderLineHighlight: 'none', // 移除行高亮背景，更干净
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
          }}
        />
      </div>

      {/* Footer - 应用按钮 */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50/80 border-t border-zinc-100">
         <div className="text-xs text-zinc-400">
             {localCode.length > 0 ? `${localCode.length} chars` : 'Empty'}
         </div>
        <Button
          onClick={() => handleApply()} // 修正：显式调用，避免传入 event 对象
          disabled={!localCode.trim() || isApplying}
          className={cn(
            "h-8 px-4 text-sm font-medium rounded-lg shadow-sm transition-all",
            isApplying ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800"
          )}
          title="应用代码到画布"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              应用中
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              应用代码
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
