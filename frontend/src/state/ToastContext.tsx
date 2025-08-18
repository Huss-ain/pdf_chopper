import React, { createContext, useCallback, useContext, useState } from 'react';
import { Snackbar, Alert, Slide, Box } from '@mui/material';
import type { AlertColor } from '@mui/material';

interface ToastItem {
  id: number;
  message: string;
  severity: AlertColor;
  autoHide?: number;
}

interface ToastContextValue {
  toast: (message: string, severity?: AlertColor, autoHideMs?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, severity: AlertColor = 'info', autoHideMs = 4000) => {
    setItems(prev => [...prev, { id: Date.now() + Math.random(), message, severity, autoHide: autoHideMs }]);
  }, []);

  const remove = (id: number) => setItems(prev => prev.filter(t => t.id !== id));

  const value: ToastContextValue = {
    toast: push,
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    info: (m: string) => push(m, 'info'),
    warning: (m: string) => push(m, 'warning')
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1400 }}>
        {items.map(item => (
          <Snackbar
            key={item.id}
            open
            TransitionComponent={(p) => <Slide {...p} direction="left" />}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            autoHideDuration={item.autoHide}
            onClose={() => remove(item.id)}
            sx={{ mb: 1 }}
          >
            <Alert severity={item.severity} variant="filled" onClose={() => remove(item.id)} sx={{ boxShadow: 3 }}>
              {item.message}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
