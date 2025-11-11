'use client';

import { useState, useEffect, useRef } from 'react';
import { WandSparkles, Send, Plus, Image as ImageIcon, Bot, MessageSquarePlus, Minimize2, Copy, Check, Code2, X as XIcon, FileText, CheckCircle2, ChevronDown, SquareMousePointer, Settings, Clock,MoveUp } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Small helper to trigger <input type="file" multiple accept="image/*">
function ImagePicker({ onPick, children }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length && onPick) onPick(files);
          // Reset value so selecting the same file again still triggers change
          e.target.value = '';
        }}
      />
      <span onClick={() => inputRef.current?.click()}>{children}</span>
    </>
  );
}

// Helper to trigger <input type="file" accept=".md,.txt">
function TextFilePicker({ onPick, children }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length && onPick) onPick(files);
          e.target.value = '';
        }}
      />
      <span onClick={() => inputRef.current?.click()}>{children}</span>
    </>
  );
}

export default function FloatingChat({
  onSendMessage,
  isGenerating,
  messages = [],
  onFileUpload,
  onImageUpload,
  onNewChat,
  onApplyXml,
  conversationId,
  onOpenHistory,
  onOpenSettings,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]); // {file, url, name, type}
  const [files, setFiles] = useState([]); // {file, name, type, size}
  const [chartType, setChartType] = useState('auto');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const typeMenuRef = useRef(null);
  const typeMenuButtonRef = useRef(null);
  const chartTypeOptions = [
    { value: 'auto', label: '自动' },
    { value: 'flowchart', label: '流程图' },
    { value: 'mindmap', label: '思维导图' },
    { value: 'orgchart', label: '组织架构图' },
    { value: 'sequence', label: '时序图' },
    { value: 'class', label: 'UML类图' },
    { value: 'er', label: 'ER图' },
    { value: 'gantt', label: '甘特图' },
    { value: 'timeline', label: '时间线' },
    { value: 'tree', label: '树形图' },
    { value: 'network', label: '网络拓扑图' },
    { value: 'architecture', label: '架构图' },
    { value: 'dataflow', label: '数据流图' },
    { value: 'state', label: '状态图' },
    { value: 'swimlane', label: '泳道图' },
    { value: 'concept', label: '概念图' },
    { value: 'fishbone', label: '鱼骨图' },
    { value: 'swot', label: 'SWOT分析图' },
    { value: 'pyramid', label: '金字塔图' },
    { value: 'funnel', label: '漏斗图' },
    { value: 'venn', label: '韦恩图' },
    { value: 'matrix', label: '矩阵图' },
    { value: 'infographic', label: '信息图' },
  ];
  const currentTypeLabel = chartTypeOptions.find(o => o.value === chartType)?.label || '自动识别';

  const handleSend = async () => {
    if ((input.trim() === '' && images.length === 0 && files.length === 0) || isGenerating) return;

    // Read text files to string
    const readText = (file) => new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      } catch (e) {
        resolve('');
      }
    });

    const typedText = input.trim();
    let combinedText = typedText;
    if (files.length > 0) {
      const texts = await Promise.all(files.map(({ file, name }) => readText(file).then(t => ({ name, text: t }))));
      const parts = texts
        .map(({ name, text }) => {
          const safe = (text || '').toString();
          if (!safe) return '';
          return `# 来自文件: ${name}\n\n${safe}`;
        })
        .filter(Boolean);
      if (parts.length) {
        combinedText = [combinedText, ...parts].filter(Boolean).join('\n\n');
      }
    }

    // Pass images up so the page can serialize and send
    onSendMessage(
      combinedText,
      chartType,
      images.map(({ file, type, name }) => ({ file, type, name })),
      files.map(({ file, name, type, size }) => ({ file, name, type, size })),
      typedText
    );

    // Clear input and caches
    setInput('');
    images.forEach(img => img.url && URL.revokeObjectURL(img.url));
    setImages([]);
    setFiles([]);
  };

  // Auto-resize textarea
  const textareaRef = useRef(null);
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    adjustTextareaHeight();
  }, [input, isOpen]);

  // Reset input and selected attachments when conversation changes (new chat)
  useEffect(() => {
    if (!conversationId) return;
    setInput('');
    // Revoke any object URLs to avoid leaks
    try {
      images?.forEach(img => img?.url && URL.revokeObjectURL(img.url));
    } catch {}
    setImages([]);
    setFiles([]);
  }, [conversationId]);

  // Close chart type menu on outside click or Escape
  useEffect(() => {
    if (!showTypeMenu) return;
    const handleClickOutside = (e) => {
      const menuEl = typeMenuRef.current;
      const buttonEl = typeMenuButtonRef.current;
      if (
        menuEl && !menuEl.contains(e.target) &&
        (!buttonEl || !buttonEl.contains(e.target))
      ) {
        setShowTypeMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowTypeMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showTypeMenu]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Backspace removes last image chip when text cursor at start and no selection
    if (e.key === 'Backspace') {
      const el = textareaRef.current;
      const atStart = el && el.selectionStart === 0 && el.selectionEnd === 0;
      const hasAnyChips = images.length > 0 || files.length > 0;
      if (atStart && hasAnyChips) {
        e.preventDefault();
        if (images.length > 0) {
          const last = images[images.length - 1];
          if (last?.url) URL.revokeObjectURL(last.url);
          setImages(prev => prev.slice(0, -1));
        } else if (files.length > 0) {
          setFiles(prev => prev.slice(0, -1));
        }
      }
    }
  };

  // Detect XML content or fenced XML blocks
  const isXmlContent = (text = '') => {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (/```xml[\s\S]*```/i.test(trimmed)) return true;
    return /^(<\?xml|<mxfile|<diagram|<mxGraphModel|<graph)/i.test(trimmed);
  };

  const extractXml = (text = '') => {
    if (typeof text !== 'string') return text;
    const match = text.match(/```xml\s*([\s\S]*?)```/i);
    if (match) return match[1].trim();
    return text.trim();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-36 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
      >
        <WandSparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
    <Card className="fixed top-2 bottom-2 right-2 w-[420px] h-auto shadow-xl flex flex-col z-50 bg-white/90 supports-[backdrop-filter]:bg-white/80 backdrop-blur border border-gray-200/70 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-transparent rounded-t-3xl">
        <div className="flex items-center gap-2">
          {/* <div className="w-2 h-2 rounded-full bg-emerald-500" /> */}
          <h3 className="font-semibold text-sm text-gray-800">对话</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            title="历史记录"
            onClick={() => onOpenHistory && onOpenHistory()}
          >
            <Clock className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="配置"
            onClick={() => onOpenSettings && onOpenSettings()}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="新建对话"
            onClick={() => (onNewChat ? onNewChat() : window.dispatchEvent(new CustomEvent('new-chat')))}
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="收起面板"
            onClick={() => setIsOpen(false)}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-10">
              开始对话，其他的交给AI
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const isSystem = msg.role === 'system'

              if (isSystem) {
                return (
                  <div key={idx} className="flex items-start gap-2 text-[13px] text-gray-500">
                    <Bot className="w-4 h-4 mt-1 opacity-70" />
                    <div className="italic">System: {msg.content}</div>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-end w-full min-w-0',
                    isUser ? 'justify-end' : 'justify-start'
                  )}
                >
                  {(!isUser && (msg.type === 'xml' || isXmlContent(msg.content))) ? (
                    <XmlBubble xmlText={extractXml(msg.content)} onApplyXml={onApplyXml} />
                  ) : (
                    <div
                      className={cn(
                        'max-w-[80%] px-4 py-2 text-[13px] leading-6 rounded-md shadow-none whitespace-pre-wrap break-words break-all border border-gray-200 bg-gray-100 text-gray-900'
                      )}
                    >
                      {msg.content && (
                        <div>{msg.content}</div>
                      )}
                      {isUser && Array.isArray(msg.files) && msg.files.length > 0 && (
                        <div className={cn('mt-2 flex flex-wrap gap-2')}>
                          {msg.files.map((f, i) => (
                            <span key={i} className={cn(
                              'inline-flex items-center gap-1 pl-1 pr-1 py-0.5 rounded-md border text-[11px] bg-gray-200 border-gray-300 text-gray-800'
                            )}>
                              <FileText className="w-3 h-3 opacity-80" />
                              <span className="truncate max-w-[160px]" title={f.name}>{f.name || 'file'}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {isUser && Array.isArray(msg.images) && msg.images.length > 0 && (
                        <div className={cn('mt-2 flex flex-wrap gap-2')}>
                          {msg.images.map((im, i) => (
                            <img
                              key={i}
                              src={im.url}
                              alt={im.name || 'image'}
                              className={cn(
                                'w-16 h-16 rounded-md object-cover ring-1 ring-gray-300'
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-2 text-sm bg-gray-100 border border-gray-200 shadow-none">
                <div className="flex space-x-2 items-center gap-2">
                正在绘制图表
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 space-y-3 bg-transparent rounded-b-3xl">
        {/* Input Box */}
        <div className="relative">
          {/* File/Image chips overlay at the top-left of textarea */}
          {(files.length > 0 || images.length > 0) && (
            <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 pr-12">
              {/* text files */}
              {files.map((f, idx) => (
                <div key={`f-${idx}`} className="group flex items-center gap-1 max-w-[260px] pl-1 pr-1 py-0.5 rounded-full border border-gray-300 bg-white/90 shadow-sm">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-gray-100 text-gray-700">
                    <FileText className="w-3 h-3" />
                  </span>
                  <span className="text-[11px] text-gray-700 truncate max-w-[180px]" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-gray-100 text-gray-500"
                    title="移除文件"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* images */}
              {images.map((img, idx) => (
                <div key={`i-${idx}`} className="group flex items-center gap-1 max-w-[260px] pl-1 pr-1 py-0.5 rounded-full border border-gray-300 bg-white/90 shadow-sm">
                  {/* tiny thumbnail */}
                  <img src={img.url} alt={img.name || 'image'} className="w-4 h-4 rounded object-cover" />
                  <span className="text-[11px] text-gray-700 truncate max-w-[180px]" title={img.name || 'image'}>
                    {img.name || 'image'}
                  </span>
                  <button
                    onClick={() => {
                      if (img.url) URL.revokeObjectURL(img.url);
                      setImages(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-gray-100 text-gray-500"
                    title="移除图片"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const { items, files } = e.clipboardData || {};
              const pastedFiles = [];
              if (items && items.length) {
                for (const item of items) {
                  if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f && f.type.startsWith('image/')) pastedFiles.push(f);
                  }
                }
              } else if (files && files.length) {
                for (const f of files) {
                  if (f.type.startsWith('image/')) pastedFiles.push(f);
                }
              }
              if (pastedFiles.length > 0) {
                e.preventDefault();
                const next = pastedFiles.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name, type: f.type }));
                setImages(prev => [...prev, ...next]);
              }
            }}
            placeholder="描述你的需求..."
            rows={1}
            maxLength={10000}
            className={cn(
              "min-h-[112px] max-h-[40vh] pr-14 pb-12 resize-none overflow-auto no-scrollbar rounded-2xl bg-white border-gray-200",
              (images.length > 0 || files.length > 0) ? 'pt-10' : 'pt-3'
            )}
            disabled={isGenerating}
          />
          {/* Bottom inline toolbar as overlay, visually merged with textarea */}
          <div className="absolute left-0 right-0 bottom-0 flex items-center justify-between bg-white rounded-b-2xl px-2 py-2  border-gray-200">
            <div className="flex items-center gap-1">
              <TextFilePicker onPick={(picked) => {
                const arr = Array.from(picked || []);
                const allowed = arr.filter(f => {
                  const ext = (f.name || '').toLowerCase().split('.').pop();
                  const okExt = ext === 'md' || ext === 'txt';
                  const type = (f.type || '').toLowerCase();
                  const okType = type.includes('text') || type.includes('markdown') || type === '';
                  return okExt || okType;
                });
                if (allowed.length) {
                  const next = allowed.map(f => ({ file: f, name: f.name, type: f.type, size: f.size }));
                  setFiles(prev => [...prev, ...next]);
                }
              }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  title="上传文件（仅支持 .md/.txt）"
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </TextFilePicker>
              {/* Image input trigger */}
              <ImagePicker onPick={(files) => {
                const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
                if (imgs.length) {
                  const next = imgs.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name, type: f.type }));
                  setImages(prev => [...prev, ...next]);
                }
              }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  title="上传图片"
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </ImagePicker>
              <button
                ref={typeMenuButtonRef} onClick={() => setShowTypeMenu((v) => !v)}
                className="h-8 px-2 text-xs rounded-md hover:bg-gray-100 text-gray-700"
                title="选择图表类型"
              >
                {currentTypeLabel}
              </button>
            </div>
            <div>
              <Button
                onClick={handleSend}
                disabled={((!input.trim() && images.length === 0 && files.length === 0) || isGenerating)}
                size="icon"
                className="h-8 w-8 rounded-md bg-primary text-primary-foreground shadow"
                title="发送"
              >
                <MoveUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {showTypeMenu && (
            <div ref={typeMenuRef} className="absolute left-2 bottom-14 w-44 rounded-xl bg-white border border-gray-200 shadow-lg p-1 text-sm z-10">
              {chartTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setChartType(opt.value); setShowTypeMenu(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50',
                    chartType === opt.value ? 'bg-gray-50' : ''
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
    <style jsx global>{`
      .no-scrollbar::-webkit-scrollbar { width: 0; height: 0; }
      .no-scrollbar::-webkit-scrollbar-thumb { background: transparent; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
    </>
  );
}

function XmlBubble({ xmlText, onApplyXml }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(xmlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className="w-[95%] min-w-0 rounded-md overflow-hidden border border-gray-200 bg-gray-50 text-gray-900 shadow-none">
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
        title={expanded ? '收起' : '展开'}
      >
        <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
          <Code2 className="w-3.5 h-3.5 opacity-80" />
          {/* <span>XML</span> */}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onApplyXml === 'function') {
                onApplyXml(xmlText);
              } else {
                try {
                  window.dispatchEvent(new CustomEvent('apply-xml', { detail: { xml: xmlText } }));
                } catch {}
              }
            }}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-gray-700 hover:bg-gray-200"
            title="应用到画布"
          >
            <SquareMousePointer className="w-3.5 h-3.5 text-emerald-600" />
            {/* <span className="hidden sm:inline">应用</span> */}
          </button>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-600 transition-transform',
              expanded ? 'rotate-0' : '-rotate-90'
            )}
          />
        </div>
      </div>
      {expanded && (
        <div className="relative w-full min-w-0">
          <button
            onClick={copyToClipboard}
            className="absolute right-2 top-2 z-10 px-2 h-7 text-[12px] rounded-md text-gray-700 hover:bg-gray-200 flex items-center gap-1"
            title="复制代码"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
          <pre
            className={cn(
              'font-mono text-[12px] leading-6 px-3 py-3 pt-10 whitespace-pre-wrap break-words break-all text-gray-800 max-h-[70vh] overflow-auto w-full max-w-full min-w-0'
            )}
          >{xmlText}</pre>
        </div>
      )}
    </div>
  );
}
