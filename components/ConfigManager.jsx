'use client';

import { useState, useEffect } from 'react';
import { Plus, Download, Upload, CheckCircle2, Activity, Pencil, Copy, Trash2, X, Search, Loader2, Server, Key, Bot, Box } from 'lucide-react';
import { configManager } from '../lib/config-manager.js';
import Notification from './Notification';
import ConfirmDialog from './ConfirmDialog';
import { cn } from '@/lib/utils';

export default function ConfigManager({ isOpen, onClose, onConfigSelect }) {
  const [configs, setConfigs] = useState([]);
  const [activeConfigId, setActiveConfigId] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Load configs when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = () => {
    try {
      const allConfigs = configManager.getAllConfigs();
      const activeId = configManager.getActiveConfigId();
      setConfigs(allConfigs);
      setActiveConfigId(activeId);
    } catch (err) {
      setError('加载配置失败: ' + err.message);
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingConfig({
      name: '',
      type: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
      description: ''
    });
  };

  const handleEdit = (config) => {
    setIsCreating(false);
    setEditingConfig({ ...config });
  };

  const handleDelete = async (configId) => {
    setConfirmDialog({
      isOpen: true,
      title: '确认删除',
      message: '确定要删除这个配置吗？此操作不可恢复。',
      onConfirm: async () => {
        try {
          await configManager.deleteConfig(configId);
          loadConfigs();
          setError('');
          setNotification({
            isOpen: true,
            title: '删除成功',
            message: '配置已成功删除',
            type: 'success'
          });
        } catch (err) {
          setError('删除配置失败: ' + err.message);
        }
      }
    });
  };

  const handleClone = (config) => {
    const newName = `${config.name} (副本)`;

    try {
      configManager.cloneConfig(config.id, newName);
      loadConfigs();
      setError('');
      setNotification({
        isOpen: true,
        title: '克隆成功',
        message: '配置已成功克隆',
        type: 'success'
      });
    } catch (err) {
      setError('克隆配置失败: ' + err.message);
    }
  };

  const handleSetActive = async (configId) => {
    try {
      await configManager.setActiveConfig(configId);
      loadConfigs();
      onConfigSelect?.(configManager.getActiveConfig());
      setError('');
    } catch (err) {
      setError('切换配置失败: ' + err.message);
    }
  };

  const handleTestConnection = async (config) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await configManager.testConnection(config);
      if (result.success) {
        setNotification({
          isOpen: true,
          title: '连接测试成功',
          message: result.message,
          type: 'success'
        });
      } else {
        setNotification({
          isOpen: true,
          title: '连接测试失败',
          message: result.message,
          type: 'error'
        });
      }
    } catch (err) {
      setNotification({
        isOpen: true,
        title: '连接测试失败',
        message: err.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = (configData) => {
    try {
      if (isCreating) {
        const newConfig = configManager.createConfig(configData);
        if (configs.length === 0) {
          onConfigSelect?.(newConfig);
        }
      } else {
        configManager.updateConfig(editingConfig.id, configData);
        if (editingConfig.id === activeConfigId) {
          onConfigSelect?.(configManager.getConfig(editingConfig.id));
        }
      }

      setEditingConfig(null);
      setIsCreating(false);
      loadConfigs();
      setError('');
    } catch (err) {
      setError('保存配置失败: ' + err.message);
    }
  };

  const handleExport = () => {
    try {
      const exportData = configManager.exportConfigs();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'llm-configs.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('导出配置失败: ' + err.message);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = configManager.importConfigs(text);
        if (result.success) {
          setNotification({
            isOpen: true,
            title: '导入成功',
            message: `成功导入 ${result.count} 个配置`,
            type: 'success'
          });
          loadConfigs();
        } else {
          setError('导入配置失败: ' + result.message);
        }
      } catch (err) {
        setError('导入配置失败: ' + err.message);
      }
    };
    input.click();
  };

  if (!isOpen) return null;

  if (editingConfig) {
    return <ConfigEditor
      config={editingConfig}
      isCreating={isCreating}
      onSave={handleSaveConfig}
      onCancel={() => {
        setEditingConfig(null);
        setIsCreating(false);
      }}
    />;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white border border-zinc-200 rounded-lg shadow-sm">
                <Server className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">本地配置管理</h2>
                <p className="text-xs text-zinc-500">管理您的 API 连接与模型参数</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-zinc-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <p className="text-xs text-zinc-500 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100 inline-flex items-center">
              <Activity className="w-3.5 h-3.5 mr-2" />
              提示：若启用“访问密码”模式，将优先使用服务器端配置。
           </p>
           <div className="flex items-center gap-2">
              <button
                onClick={handleImport}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
              >
                <Upload className="w-4 h-4" />
                导入
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                新建配置
              </button>
           </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-600">
              <X className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Config List */}
          <div className="grid grid-cols-1 gap-4">
            {configs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400 bg-white border border-dashed border-zinc-200 rounded-2xl">
                <Box className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">暂无配置</p>
                <p className="text-xs mt-1">点击右上角“新建配置”开始使用</p>
              </div>
            ) : (
              configs.map((config) => {
                const isActive = config.id === activeConfigId;
                return (
                  <div
                    key={config.id}
                    className={cn(
                      "group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all duration-200",
                      isActive
                        ? "bg-white border-zinc-900 shadow-md ring-1 ring-zinc-900/5"
                        : "bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                    )}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className={cn("font-semibold truncate", isActive ? "text-zinc-900" : "text-zinc-700")}>
                            {config.name}
                        </h3>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-zinc-900 text-white rounded-full">
                             <CheckCircle2 className="w-3 h-3" /> 当前使用
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-500 rounded-full uppercase border border-zinc-200">
                            {config.type}
                          </span>
                        )}
                      </div>
                      {config.description && (
                        <p className="text-sm text-zinc-500 mb-2 line-clamp-1">{config.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 font-mono">
                        <span className="flex items-center gap-1" title={config.baseUrl}>
                            <Server className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{config.baseUrl}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            {config.model}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 mt-4 sm:mt-0 pl-0 sm:pl-4 sm:border-l sm:border-zinc-100">
                      {!isActive && (
                        <button
                          onClick={() => handleSetActive(config.id)}
                          title="设为当前"
                          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleTestConnection(config)}
                        disabled={isLoading}
                        title="测试连接"
                        className={cn(
                           "p-2 rounded-lg transition-colors",
                           isLoading ? "text-zinc-300" : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50"
                        )}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(config)}
                        title="编辑"
                        className="p-2 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleClone(config)}
                        title="克隆"
                        className="p-2 rounded-lg text-zinc-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        title="删除"
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Notification */}
      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
      />
    </div>
  );
}

// Configuration Editor Component
function ConfigEditor({ config, isCreating, onSave, onCancel }) {
  const [formData, setFormData] = useState({ ...config });
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (formData.model) {
      if (models.length > 0) {
        const exists = models.some(m => m.id === formData.model);
        setUseCustomModel(!exists);
      } else {
        setUseCustomModel(true);
      }
    }
  }, [models, formData.model]);

  const handleLoadModels = async () => {
    if (!formData.type || !formData.baseUrl || !formData.apiKey) {
      setError('请先填写提供商类型、基础 URL 和 API 密钥');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        type: formData.type,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey,
      });

      const response = await fetch(`/api/models?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加载模型失败');
      }

      setModels(data.models);
    } catch (err) {
      setError(err.message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.type || !formData.baseUrl || !formData.apiKey || !formData.model) {
      setError('请填写所有必填字段');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-lg font-semibold text-zinc-900">
            {isCreating ? '新建配置' : '编辑配置'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
             <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-sm text-red-600">
               <X className="w-4 h-4 mt-0.5 shrink-0" />
               <span className="leading-relaxed">{error}</span>
             </div>
          )}

          <div className="space-y-4">
            {/* Name & Description */}
            <div className="space-y-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    配置名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：我的 OpenAI"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    描述
                    </label>
                    <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="配置描述（可选）"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white resize-none"
                    />
                </div>
            </div>

            {/* Connection Details */}
            <div className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider px-1">连接信息</h3>
                
                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    提供商类型 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value, model: '' })}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white appearance-none"
                        >
                        <option value="openai">OpenAI (或兼容)</option>
                        <option value="anthropic">Anthropic</option>
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-400">
                            <Bot className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    基础 URL <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                         <Server className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                        <input
                        type="text"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                        placeholder={formData.type === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1'}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    API 密钥 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                        <Key className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                        <input
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white font-mono"
                        />
                    </div>
                </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-4 border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider px-1">模型选择</h3>
                    <button
                        onClick={handleLoadModels}
                        disabled={loading}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        {loading ? '加载中...' : '获取模型列表'}
                    </button>
                </div>
                
                <div>
                    {models.length > 0 && (
                        <div className="mb-3 flex p-1 bg-zinc-100 rounded-lg w-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setUseCustomModel(false);
                                    if (models.length > 0) {
                                        setFormData({ ...formData, model: models[0].id });
                                    }
                                }}
                                className={cn(
                                    "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                                    !useCustomModel ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                                )}
                            >
                                列表选择
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setUseCustomModel(true);
                                    setFormData({ ...formData, model: '' });
                                }}
                                className={cn(
                                    "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                                    useCustomModel ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                                )}
                            >
                                手动输入
                            </button>
                        </div>
                    )}

                    {models.length > 0 && !useCustomModel ? (
                    <div className="relative">
                        <select
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white appearance-none"
                        >
                            {models.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name || model.id}
                            </option>
                            ))}
                        </select>
                         <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-400">
                            <Bot className="w-4 h-4" />
                        </div>
                    </div>
                    ) : (
                    <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="例如：gpt-4、claude-3-opus-20240229"
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all bg-white"
                    />
                    )}
                </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 shadow-sm hover:shadow-md transition-all"
          >
            {isCreating ? '立即创建' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}