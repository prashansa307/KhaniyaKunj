import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

const ToastContext = createContext(null);

function ToastItem({ toast, onClose }) {
  const Icon =
    toast.type === 'error' ? FiAlertCircle : toast.type === 'success' ? FiCheckCircle : FiInfo;
  const toneClass =
    toast.type === 'error'
      ? 'from-rose-500 to-orange-500'
      : toast.type === 'success'
      ? 'from-blue-600 via-sky-500 to-cyan-500'
      : 'from-indigo-500 via-blue-500 to-sky-400';
  const iconClass =
    toast.type === 'error'
      ? 'bg-rose-100 text-rose-700'
      : toast.type === 'success'
      ? 'bg-sky-100 text-blue-700'
      : 'bg-blue-100 text-indigo-700';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      className="pointer-events-auto relative overflow-hidden rounded-2xl p-[1px] shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${toneClass}`} />
      <div className="relative rounded-[15px] bg-white/95 px-3 py-2.5 text-sm text-slate-800 backdrop-blur-xl dark:bg-slate-900/95 dark:text-slate-100">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[15px] ${iconClass}`}>
            <Icon />
          </span>
          <p className="flex-1 font-semibold leading-snug">{toast.message}</p>
          <button
            onClick={() => onClose(toast.id)}
            className="rounded-lg bg-slate-100 p-1 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Close notification"
          >
            <FiX size={14} />
          </button>
        </div>
        {toast.duration > 0 ? (
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: 0 }}
            transition={{ duration: toast.duration / 1000, ease: 'linear' }}
            className={`mt-2 h-[3px] rounded-full bg-gradient-to-r ${toneClass}`}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 2600) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);
  const canUseDom = typeof document !== 'undefined';
  const toastViewport = (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[2000] flex w-[min(560px,calc(100vw-1.25rem))] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {canUseDom ? createPortal(toastViewport, document.body) : toastViewport}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}
