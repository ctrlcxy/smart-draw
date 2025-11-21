import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Notification({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  autoClose = true,
  duration = 3000
}) {
  const [isVisible, setIsVisible] = useState(false);

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300); // Wait for exit animation
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, duration, onClose]);

  if (!isVisible && !isOpen) return null;

  const styles = {
    success: {
      wrapper: 'bg-white border-emerald-100 ring-1 ring-emerald-500/10',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      title: 'text-emerald-950',
      message: 'text-emerald-600',
      Icon: CheckCircle2
    },
    error: {
      wrapper: 'bg-white border-red-100 ring-1 ring-red-500/10',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      title: 'text-red-950',
      message: 'text-red-600',
      Icon: XCircle
    },
    warning: {
      wrapper: 'bg-white border-amber-100 ring-1 ring-amber-500/10',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      title: 'text-amber-950',
      message: 'text-amber-700',
      Icon: AlertTriangle
    },
    info: {
      wrapper: 'bg-white border-blue-100 ring-1 ring-blue-500/10',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      title: 'text-blue-950',
      message: 'text-blue-600',
      Icon: Info
    }
  };

  const currentStyle = styles[type] || styles.info;
  const IconComponent = currentStyle.Icon;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
      <div
        className={cn(
          "pointer-events-auto w-full rounded-xl shadow-xl border p-4 transition-all duration-300 ease-out transform",
          currentStyle.wrapper,
          isOpen ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("flex-shrink-0 p-1.5 rounded-full", currentStyle.iconBg)}>
            <IconComponent className={cn("w-5 h-5", currentStyle.iconColor)} />
          </div>
          
          <div className="flex-1 pt-0.5 min-w-0">
            {title && (
              <h3 className={cn("text-sm font-semibold leading-none mb-1", currentStyle.title)}>
                {title}
              </h3>
            )}
            {message && (
              <p className={cn("text-xs leading-relaxed opacity-90", currentStyle.message)}>
                {message}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 ml-2 text-zinc-400 hover:text-zinc-600 transition-colors p-1 hover:bg-zinc-100 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}