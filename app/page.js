'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import FloatingChat from '@/components/FloatingChat';
import ConfigManager from '@/components/ConfigManager';
import ContactModal from '@/components/ContactModal';
import HistoryModal from '@/components/HistoryModal';
import CombinedSettingsModal from '@/components/CombinedSettingsModal';
import Notification from '@/components/Notification';
import { getConfig, isConfigValid } from '@/lib/config';
import { historyManager } from '@/lib/history-manager';
import { getBlob } from '@/lib/indexeddb';

// Dynamically import DrawioCanvas to avoid SSR issues
const DrawioCanvas = dynamic(() => import('@/components/DrawioCanvas'), {
  ssr: false,
});

export default function Home() {
  const [config, setConfig] = useState(null);
  const [isConfigManagerOpen, setIsConfigManagerOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCombinedSettingsOpen, setIsCombinedSettingsOpen] = useState(false);
  const [diagramXml, setDiagramXml] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [messages, setMessages] = useState([]);
  // Conversation id to group continuous dialogue within the same chat
  const newConversationId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const [conversationId, setConversationId] = useState(newConversationId());
  const [notification, setNotification] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Load config on mount and listen for config changes
  useEffect(() => {
    const savedConfig = getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }

    // Load password access state
    const passwordEnabled = localStorage.getItem('smart-excalidraw-use-password') === 'true';
    setUsePassword(passwordEnabled);

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e) => {
      if (e.key === 'smart-excalidraw-active-config' || e.key === 'smart-excalidraw-configs') {
        const newConfig = getConfig();
        setConfig(newConfig);
      }
      if (e.key === 'smart-excalidraw-use-password') {
        const passwordEnabled = localStorage.getItem('smart-excalidraw-use-password') === 'true';
        setUsePassword(passwordEnabled);
      }
    };

    // Listen for custom event from AccessPasswordModal (same tab)
    const handlePasswordSettingsChanged = (e) => {
      setUsePassword(e.detail.usePassword);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('password-settings-changed', handlePasswordSettingsChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('password-settings-changed', handlePasswordSettingsChanged);
    };
  }, []);

  // Post-process Draw.io XML code: robustly extract XML and clean artifacts
  const postProcessDrawioCode = (code) => {
    if (!code || typeof code !== 'string') return code;

    let processed = code;

    // Remove BOM and zero-width characters that can break XML parsing
    processed = processed.replace(/\ufeff/g, '').replace(/[\u200B-\u200D\u2060]/g, '');

    // 1) Prefer extracting first fenced block anywhere in the text
    // Try ```xml ... ``` first
    const fencedXmlMatch = processed.match(/```\s*xml\s*([\s\S]*?)```/i);
    if (fencedXmlMatch && fencedXmlMatch[1]) {
      processed = fencedXmlMatch[1];
    } else {
      // Fallback: any fenced block
      const fencedAnyMatch = processed.match(/```\s*([\s\S]*?)```/);
      if (fencedAnyMatch && fencedAnyMatch[1]) {
        processed = fencedAnyMatch[1];
      }
    }

    processed = processed.trim();

    // 2) If HTML-escaped XML is detected, decode minimal entities
    if (!/[<][a-z!?]/i.test(processed) && /&lt;\s*[a-z!?]/i.test(processed)) {
      processed = processed
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }

    // 3) If extra text remains before the first tag, trim to the first '<'
    const firstLt = processed.indexOf('<');
    if (firstLt > 0) {
      processed = processed.slice(firstLt);
    }

    // Final trim
    processed = processed.trim();

    return processed;
  };

  // Handle sending a message (supports optional images)
  const handleSendMessage = async (userMessage, chartType = 'auto', imageFiles = [], textFiles = [], displayText = null) => {
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result || '';
          const base64 = typeof result === 'string' ? result.split(',')[1] : '';
          resolve(base64 || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } catch (e) {
        resolve('');
      }
    });
    const usePassword = typeof window !== 'undefined' && localStorage.getItem('smart-excalidraw-use-password') === 'true';
    const accessPassword = typeof window !== 'undefined' ? localStorage.getItem('smart-excalidraw-access-password') : '';

    if (!usePassword && !isConfigValid(config)) {
      setNotification({
        isOpen: true,
        title: '配置提醒',
        message: '请先配置您的 LLM 提供商或启用访问密码',
        type: 'warning'
      });
      setIsConfigManagerOpen(true);
      return;
    }

    // Prepare display data for chat bubble (typed text + file chips + image thumbnails)
    const filesForDisplay = Array.isArray(textFiles) ? textFiles.map(f => ({
      name: f?.name || 'file',
      size: f?.size || 0,
      type: f?.type || 'text/plain'
    })) : [];
    let encodedImages = [];
    if (Array.isArray(imageFiles) && imageFiles.length > 0) {
      encodedImages = await Promise.all(
        imageFiles.map(async ({ file, type, name }) => ({
          data: await fileToBase64(file),
          mimeType: (file && file.type) || type || 'image/png',
          name: (file && file.name) || name || 'image'
        }))
      );
    }
    const imagesForDisplay = encodedImages.map(({ data, mimeType, name }) => ({
      url: `data:${mimeType};base64,${data}`,
      name,
      type: mimeType,
    }));
    const contentForDisplay = (displayText && typeof displayText === 'string') ? displayText : '';
    setMessages(prev => [...prev, { role: 'user', content: contentForDisplay, files: filesForDisplay, images: imagesForDisplay }]);
    setIsGenerating(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (usePassword && accessPassword) {
        headers['x-access-password'] = accessPassword;
      }

      // Prepare user payload with optional images
      let userPayload = userMessage;
      if (encodedImages.length > 0) {
        userPayload = { text: userMessage, images: encodedImages };
      }

    // Prepare conversation history for server (exclude large XML from assistant)
    const historyForServer = (() => {
      const HISTORY_LIMIT = 3;
      try {
        const trimmed = messages.slice(-HISTORY_LIMIT); // limit history size
        return trimmed
          .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
          .map(m => ({
            role: m.role,
            content: (m.type === 'xml')
              ? '[之前生成的 Draw.io XML 省略，已应用到画布]'
              : (typeof m.content === 'string' ? m.content : '')
          }))
          .filter(m => m.content && typeof m.content === 'string');
      } catch {
        return [];
      }
    })();

    // If there is an existing diagram, attach it as context to enable follow-ups
    const contextXml = (diagramXml && typeof diagramXml === 'string' && diagramXml.trim()) ? diagramXml : null;

    // Call generate API with streaming
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        config: usePassword ? null : config,
          userInput: (encodedImages.length > 0)
            ? { ...userPayload, contextXml }
            : (contextXml ? { text: userPayload, contextXml } : userPayload),
          chartType,
          conversationId,
          history: historyForServer,
      }),
    });

      if (!response.ok) {
        let errorMessage = '生成代码失败';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          switch (response.status) {
            case 400:
              errorMessage = '请求参数错误，请检查输入内容';
              break;
            case 401:
            case 403:
              errorMessage = 'API 密钥无效或权限不足，请检查配置';
              break;
            case 429:
              errorMessage = '请求过于频繁，请稍后再试';
              break;
            case 500:
            case 502:
            case 503:
              errorMessage = '服务器错误，请稍后重试';
              break;
            default:
              errorMessage = `请求失败 (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedCode = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulatedCode += data.content;
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              if (e.message && !e.message.includes('Unexpected')) {
                throw new Error('数据流解析错误：' + e.message);
              }
              console.error('Failed to parse SSE:', e);
            }
          }
        }
      }

      // Process and apply the generated code
      const processedCode = postProcessDrawioCode(accumulatedCode);

      if (processedCode) {
        // Validate XML cautiously, but avoid false negatives on valid Draw.io XML
        const isLikelyDrawioXml = /<(mxfile|mxGraphModel|diagram)([\s>])/i.test(processedCode);

        let isValid = false;
        try {
          const parser = new DOMParser();
          // Try parsing as XML
          const xmlDoc = parser.parseFromString(processedCode, 'application/xml');
          const hasParserErrorTag = xmlDoc.getElementsByTagName('parsererror').length > 0 ||
            (xmlDoc.documentElement && xmlDoc.documentElement.nodeName === 'parsererror');

          isValid = !hasParserErrorTag;
        } catch (e) {
          isValid = false;
        }

        // Fallback: if it looks like Draw.io XML, accept even if parser complains
        if (isValid || isLikelyDrawioXml) {
          setDiagramXml(processedCode);
          // Push XML to chat with special type for styling
          setMessages(prev => [...prev, { role: 'assistant', content: processedCode, type: 'xml' }]);

          // Save to history (IndexedDB, with conversation + attachments)
          await historyManager.addHistory({
            conversationId,
            chartType,
            userInput: contentForDisplay || (typeof userMessage === 'string' ? userMessage : ''),
            generatedCode: processedCode,
            images: imageFiles,
            files: textFiles,
            config: {
              name: config?.name || config?.type || '',
              model: config?.model || ''
            }
          });
        } else {
          throw new Error('XML 解析错误');
        }
      }
    } catch (error) {
      console.error('Error generating code:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${error.message}` }]);
      setNotification({
        isOpen: true,
        title: '生成失败',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle saving diagram from Draw.io (stable reference to help memoization)
  const handleSaveDiagram = useCallback((xml) => {
    setDiagramXml(xml);
  }, []);

  // Start a fresh chat
  const handleNewChat = () => {
    setMessages([]);
    setConversationId(newConversationId());
    // Clear canvas by resetting Draw.io XML
    setDiagramXml('');
  };

  // Handle config selection from manager
  const handleConfigSelect = (selectedConfig) => {
    if (selectedConfig) {
      setConfig(selectedConfig);
    }
  };

  // Handle applying history
  const handleApplyHistory = async (history) => {
    try {
      setConversationId(history.id);
      // Load entire conversation to support continuous chat context
      const msgs = await historyManager.getConversationMessages(history.id);

      // Rehydrate attachments (images/files) from IndexedDB blobs for display
      const normalized = await Promise.all((msgs || []).map(async (m) => {
        const base = { role: m.role, content: m.content, type: m.type };

        // 1) Primary path: attachments saved in IndexedDB
        const atts = Array.isArray(m.attachments) ? m.attachments : [];
        if (atts.length > 0) {
          const images = [];
          const files = [];
          for (const att of atts) {
            try {
              const rec = att?.blobId ? await getBlob(att.blobId) : null;
              const name = att?.name || rec?.name || 'file';
              const type = att?.type || rec?.type || 'application/octet-stream';
              const size = att?.size || rec?.size || 0;
              if (type.startsWith('image/') || att?.kind === 'image') {
                if (rec?.blob) {
                  const url = URL.createObjectURL(rec.blob);
                  images.push({ url, name, type });
                }
              } else {
                files.push({ name, type, size });
              }
            } catch {
              // ignore attachment rehydration failures per-item
            }
          }

          if (images.length > 0 || files.length > 0) {
            // When attachments exist, ensure we don't echo file contents.
            // Keep only the typed text before any file markers.
            let typedOnly = base.content;
            try {
              if (typeof base.content === 'string') {
                const idx = base.content.search(/^#\s*(?:来自文件|From file)\s*:/m);
                if (idx > -1) typedOnly = base.content.slice(0, idx).trim();
              }
            } catch {}
            return { ...base, content: typedOnly, images, files };
          }
        }

        // 2) Back-compatibility and file-upload fallback:
        // If no attachments are stored, try to infer display from legacy fields
        // or from the combined text format produced when sending files.
        if (m.role === 'user') {
          const images = Array.isArray(m.images) ? m.images.map(im => ({ url: im.url, name: im.name, type: im.type })) : [];
          let files = Array.isArray(m.files) ? m.files.map(f => ({ name: f.name, type: f.type || 'text/plain', size: f.size || 0 })) : [];

          // Parse combined text for file markers like "# 来自文件: filename"
          // and extract typed text (before the first marker)
          if ((images.length === 0 && files.length === 0) && typeof m.content === 'string' && m.content.includes('# 来自文件')) {
            try {
              const nameMatches = [...m.content.matchAll(/^#\s*来自文件:\s*(.+)$/gm)] || [];
              if (nameMatches.length > 0) {
                files = nameMatches.map(match => ({ name: (match[1] || 'file').trim(), type: 'text/plain', size: 0 }));
                const firstMarker = m.content.search(/^#\s*来自文件:/m);
                const typed = firstMarker > -1 ? m.content.slice(0, firstMarker).trim() : (m.content || '').trim();
                return { ...base, content: typed, files };
              }
            } catch {}
          }

          if (images.length > 0 || files.length > 0) {
            return { ...base, images, files };
          }
        }

        // Default: return base when nothing to augment
        return base;
      }));

      const lastXml = [...normalized].reverse().find(m => m.role === 'assistant' && m.type === 'xml');
      if (lastXml?.content) setDiagramXml(lastXml.content);
      setMessages(normalized);
    } catch (e) {
      // Fallback to old behavior if anything fails: strip file contents and keep filenames as chips
      try {
        const raw = typeof history.userInput === 'string' ? history.userInput : '';
        const firstMarker = raw.search(/^#\s*(?:来自文件|From file)\s*:/m);
        const typed = firstMarker > -1 ? raw.slice(0, firstMarker).trim() : raw;
        const nameMatches = [...raw.matchAll(/^#\s*(?:来自文件|From file)\s*:\s*(.+)$/gm)] || [];
        const files = nameMatches.map(m => ({ name: (m[1] || 'file').trim(), type: 'text/plain', size: 0 }));

        setDiagramXml(history.generatedCode);
        setMessages([
          { role: 'user', content: typed, files },
          { role: 'assistant', content: history.generatedCode, type: 'xml' }
        ]);
      } catch {
        setDiagramXml(history.generatedCode);
        setMessages([
          { role: 'user', content: history.userInput },
          { role: 'assistant', content: history.generatedCode, type: 'xml' }
        ]);
      }
    }
  };

  // Handle file upload
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        handleSendMessage(text, 'auto');
      }
    };
    input.click();
  };

  // Handle image upload
  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        // TODO: Implement image upload logic
        setNotification({
          isOpen: true,
          title: '功能开发中',
          message: '图片上传功能即将推出',
          type: 'info'
        });
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-2 py-2 bg-white border-b border-gray-200 z-10">
        <div className="flex items-center">
          <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
        </div>
        {/* <div className="flex items-center space-x-3">
          {(usePassword || (config && isConfigValid(config))) && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 rounded border border-green-300">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-900 font-medium">
                {usePassword ? '密码访问' : `${config?.name || config?.type} - ${config?.model}`}
              </span>
            </div>
          )}
        </div> */}
      </header>

      {/* Main Content - Full Screen DrawioCanvas */}
      <div className="flex-1 overflow-hidden">
        <DrawioCanvas xml={diagramXml} onSave={handleSaveDiagram} />
      </div>

      {/* Floating Chat */}
      <FloatingChat
        onSendMessage={handleSendMessage}
        isGenerating={isGenerating}
        messages={messages}
        onFileUpload={handleFileUpload}
        onImageUpload={handleImageUpload}
        onNewChat={handleNewChat}
        onApplyXml={(xml) => setDiagramXml(xml)}
        conversationId={conversationId}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenSettings={() => setIsCombinedSettingsOpen(true)}
      />

      {/* Config Manager Modal */}
      <ConfigManager
        isOpen={isConfigManagerOpen}
        onClose={() => setIsConfigManagerOpen(false)}
        onConfigSelect={handleConfigSelect}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onApply={handleApplyHistory}
      />

      {/* Combined Settings Modal */}
      <CombinedSettingsModal
        isOpen={isCombinedSettingsOpen}
        onClose={() => setIsCombinedSettingsOpen(false)}
        usePassword={usePassword}
        currentConfig={config}
        onOpenConfigManager={() => setIsConfigManagerOpen(true)}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Notification */}
      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}
