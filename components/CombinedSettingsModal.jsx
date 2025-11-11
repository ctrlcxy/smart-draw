'use client';

import { useState, useEffect } from 'react';

export default function CombinedSettingsModal({
  isOpen,
  onClose,
  usePassword: initialUsePassword,
  currentConfig,
  onOpenConfigManager,
}) {
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window !== 'undefined') {
      const savedPassword = localStorage.getItem('smart-excalidraw-access-password') || '';
      const savedUsePassword = localStorage.getItem('smart-excalidraw-use-password') === 'true';
      setPassword(savedPassword);
      setUsePassword(savedUsePassword ?? !!initialUsePassword);
    }
  }, [isOpen, initialUsePassword]);

  const handleValidate = async () => {
    if (!password) {
      setMessage('请输入访问密码');
      setMessageType('error');
      return;
    }

    setIsValidating(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.valid) {
        setMessage('密码验证成功');
        setMessageType('success');
      } else {
        setMessage(data.message || '密码验证失败');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('验证请求失败');
      setMessageType('error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart-excalidraw-access-password', password);
      localStorage.setItem('smart-excalidraw-use-password', usePassword.toString());
      window.dispatchEvent(
        new CustomEvent('password-settings-changed', { detail: { usePassword } })
      );
    }
    setMessage('设置已保存');
    setMessageType('success');
    setTimeout(() => {
      onClose?.();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">配置与访问</h2>
            {/* Current status pill inline for quick glance */}
            {usePassword ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> 服务器端（访问密码）
              </span>
            ) : currentConfig ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {(currentConfig.name || currentConfig.type)} - {currentConfig.model}
              </span>
            ) : (
              <span className="text-xs text-gray-500">未配置</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose?.();
                onOpenConfigManager?.();
              }}
              className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50"
              title="打开配置管理"
            >
              配置管理
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Hint - subtle, single line */}
          <p className="text-xs text-gray-500">访问密码优先级高于前端 LLM 配置，启用后将使用服务器端配置。</p>

          {/* Password row: input + validate inline */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="访问密码"
              disabled={!usePassword}
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                usePassword ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            />
            <button
              onClick={handleValidate}
              disabled={isValidating || !usePassword}
              className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400 transition-colors duration-200 text-sm"
            >
              {isValidating ? '验证中...' : '验证密码'}
            </button>
          </div>

          {/* Mode switch: 本地配置 <-> 访问密码 */}
          <div className="pt-1">
            <div className="inline-flex items-center text-sm">
              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setUsePassword(false)}
                  className={`px-3 py-1.5 transition-colors duration-200 ${
                    !usePassword
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  本地配置
                </button>
                <button
                  type="button"
                  onClick={() => setUsePassword(true)}
                  className={`px-3 py-1.5 border-l border-gray-200 transition-colors duration-200 ${
                    usePassword
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  访问密码
                </button>
              </div>
              <span className="ml-2 text-gray-500">
                切换使用本地 LLM 配置或服务器端访问密码
              </span>
            </div>
          </div>

          {/* Inline message - compact */}
          {message && (
            <div className={`px-3 py-2 rounded border text-sm ${messageType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors duration-200 text-sm"
          >
            关闭
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors duration-200 text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
