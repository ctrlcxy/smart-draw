'use client';

import { useState, useEffect } from 'react';
import { historyManager } from '../lib/history-manager.js';
import { CHART_TYPES } from '../lib/constants.js';
import ConfirmDialog from './ConfirmDialog';
import { X, Trash2, RotateCcw, HardDrive, Clock, History, FileText, Bot, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HistoryModal({ isOpen, onClose, onApply, editorType }) {
  const [histories, setHistories] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  useEffect(() => {
    if (isOpen) {
      loadHistories();
    }
  }, [isOpen]);

  const loadHistories = async () => {
    try {
      const allHistories = await historyManager.getHistories();
      const filtered = Array.isArray(allHistories)
        ? allHistories.filter((h) => {
            if (!editorType) return true;
            const edt = (h.editor || 'drawio');
            return edt === editorType;
          })
        : [];
      // 按时间倒序排列
      setHistories(filtered.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error('Failed to load histories', e);
      setHistories([]);
    }
  };

  const handleApply = (history) => {
    onApply?.(history);
    onClose();
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: '确认删除',
      message: '确定要删除这条历史记录吗？',
      onConfirm: async () => {
        await historyManager.deleteHistory(id);
        await loadHistories();
      }
    });
  };

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: '确认清空',
      message: '确定要清空所有历史记录吗？此操作不可恢复。',
      onConfirm: async () => {
        await historyManager.clearAll();
        await loadHistories();
      }
    });
  };

  // 格式化时间显示
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

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
                <History className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-zinc-900">历史记录</h2>
                <p className="text-xs text-zinc-500">查看与恢复之前的生成记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {histories.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors mr-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空全部
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30">
          {/* Info Banner */}
          <div className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-600">
            <HardDrive className="w-3.5 h-3.5" />
            <span>所有历史记录均加密存储在您的本地浏览器中，不会上传至服务器。</span>
          </div>

          <div className="space-y-4">
            {histories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-400 bg-white border border-dashed border-zinc-200 rounded-2xl">
                <Clock className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium text-zinc-500">暂无历史记录</p>
                <p className="text-xs mt-1 text-zinc-400">开始对话后，记录将自动保存</p>
              </div>
            ) : (
              histories.map((history) => (
                <div
                  key={history.id}
                  className="group relative bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 hover:shadow-md transition-all duration-200 p-4 sm:p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Tags & Time */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {CHART_TYPES[history.chartType] || history.chartType}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                           <Calendar className="w-3 h-3" />
                           {formatTime(history.timestamp)}
                        </span>
                      </div>

                      {/* Prompt */}
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                            <FileText className="w-4 h-4 text-zinc-400" />
                        </div>
                        <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3 font-medium">
                           {history.userInput}
                        </p>
                      </div>

                      {/* Model Info */}
                      {history.config && (history.config.name || history.config.model) && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md w-fit">
                          <Bot className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">
                            {history.config.name || 'Unknown'} • {history.config.model || 'Default'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 border-t sm:border-t-0 sm:border-l border-zinc-100 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0">
                      <button
                        onClick={() => handleApply(history)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 hover:shadow-sm transition-all w-full sm:w-auto"
                        title="恢复此版本"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        恢复
                      </button>
                      <button
                        onClick={() => handleDelete(history.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors w-full sm:w-auto"
                        title="删除记录"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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