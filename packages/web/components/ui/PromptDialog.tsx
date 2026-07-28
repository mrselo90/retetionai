'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PromptDialogProps {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Accessible prompt dialog — replaces window.prompt().
 * Use via the usePrompt hook below.
 */
export function PromptDialog({
  open,
  title,
  placeholder,
  defaultValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resetting the field when the dialog opens is a prop change, not a side
  // effect. React documents adjusting state during render for this; doing it in
  // an effect set state synchronously and cascaded an extra render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(defaultValue);
  }

  // Focusing the input is a genuine DOM side effect, so it stays in an effect.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onConfirm(value.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 z-10">
        <h3
          id="prompt-dialog-title"
          className="text-base font-semibold text-gray-900 mb-4"
        >
          {title}
        </h3>

        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="mb-6"
            autoComplete="off"
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button type="submit" size="sm" disabled={!value.trim()}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PromptOptions {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptState extends PromptOptions {
  open: boolean;
  resolve: ((value: string | null) => void) | null;
}

/**
 * Hook to imperatively trigger a prompt dialog.
 *
 * const { prompt, PromptDialogNode } = usePrompt();
 *
 * // in your handler:
 * const name = await prompt({ title: 'Name this view' });
 * if (name) saveView(name);
 *
 * // in your JSX:
 * return <>{PromptDialogNode}{...rest of page}</>
 */
export function usePrompt() {
  const [state, setState] = useState<PromptState>({
    open: false,
    title: '',
    resolve: null,
  });

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const handleConfirm = useCallback((value: string) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(null);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const PromptDialogNode = (
    <PromptDialog
      open={state.open}
      title={state.title}
      placeholder={state.placeholder}
      defaultValue={state.defaultValue}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { prompt, PromptDialogNode };
}
