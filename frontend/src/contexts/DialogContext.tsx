import { createContext, useContext, useRef, useState, ReactNode } from 'react';

interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface DialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'danger';
}

interface DialogContextType {
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType>({ confirm: async () => false });

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [closing, setClosing] = useState(false);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const dismiss = (value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setClosing(true);
    setTimeout(() => { setState(null); setClosing(false); }, 180);
  };

  const confirm = (message: string, opts: DialogOptions = {}): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        message,
        title:        opts.title        ?? 'Konfirmasi',
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel:  opts.cancelLabel  ?? 'Batal',
        variant:      opts.variant      ?? 'default',
      });
      setClosing(false);
    });
  };

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}

      {state && (
        <div
          className={`modal-overlay${closing ? ' is-closing' : ''}`}
          onClick={() => dismiss(false)}
        >
          <div
            className={`modal modal-dialog${closing ? ' is-closing' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            {state.variant === 'danger' && (
              <div className="dialog-icon dialog-icon-danger">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                  <path d="M10,11v6M14,11v6"/>
                  <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
                </svg>
              </div>
            )}

            <h3 className="dialog-title">{state.title}</h3>
            <p className="dialog-message">{state.message}</p>

            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => dismiss(false)}>
                {state.cancelLabel}
              </button>
              <button
                className={state.variant === 'danger' ? 'btn-danger' : 'btn-primary'}
                onClick={() => dismiss(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);
