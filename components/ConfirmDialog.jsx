'use client';

import { AlertTriangle, Info, Trash2, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'warning' // warning | danger | info
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) setVisible(true);
    else setTimeout(() => setVisible(false), 200);
  }, [isOpen]);

  if (!visible && !isOpen) return null;

  const typeConfig = {
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
      border: 'border-amber-100'
    },
    danger: {
      icon: Trash2,
      color: 'text-red-600',
      bg: 'bg-red-50',
      btn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200',
      border: 'border-red-100'
    },
    info: {
      icon: Info,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
      border: 'border-blue-100'
    }
  };

  const config = typeConfig[type] || typeConfig.warning;
  const Icon = config.icon;

  return (
    <div className={cn(
      "fixed inset-0 z-[70] flex items-center justify-center p-4 transition-all duration-200",
      isOpen ? "visible" : "invisible pointer-events-none"
    )}>
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={cn(
        "relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden transition-all duration-200 transform",
        isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
      )}>
        {/* Header Area */}
        <div className="p-6 pb-0 flex gap-4">
          <div className={cn("flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center", config.bg)}>
            <Icon className={cn("w-6 h-6", config.color)} />
          </div>
          <div className="flex-1 pt-1">
             <h3 className="text-lg font-semibold text-zinc-900 leading-tight mb-2">
               {title}
             </h3>
             <p className="text-sm text-zinc-500 leading-relaxed">
               {message}
             </p>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              // Optional: onClose() is usually called by parent after confirm, 
              // but safer to not force it here if logic is async
            }}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all transform active:scale-95",
              config.btn
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}