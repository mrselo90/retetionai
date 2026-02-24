import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { X } from 'lucide-react';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  category?: string;
}

interface KeyboardShortcutsProps {
  shortcuts: Shortcut[];
}

export function KeyboardShortcuts({ shortcuts }: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show help with ?
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Execute shortcuts
      shortcuts.forEach((shortcut) => {
        const keys = shortcut.key.split('+').map((k) => k.trim().toLowerCase());
        const hasCtrl = keys.includes('ctrl') || keys.includes('cmd');
        const hasShift = keys.includes('shift');
        const hasAlt = keys.includes('alt');
        const mainKey = keys.filter((k) => !['ctrl', 'cmd', 'shift', 'alt'].includes(k))[0];

        const ctrlPressed = e.ctrlKey || e.metaKey;
        const shiftPressed = e.shiftKey;
        const altPressed = e.altKey;
        const keyPressed = e.key.toLowerCase();

        if (
          keyPressed === mainKey &&
          (!hasCtrl || ctrlPressed) &&
          (!hasShift || shiftPressed) &&
          (!hasAlt || altPressed)
        ) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  if (!showHelp) return null;

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-sm animate-scale-in">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Keyboard Shortcuts</CardTitle>
            <button
              onClick={() => setShowHelp(false)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3 text-foreground">{category}</h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-sm font-medium text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.key.split('+').map((key, i) => (
                        <React.Fragment key={i}>
                          <Badge variant="outline" size="sm" className="font-mono font-medium px-2 py-1">
                            {key.trim()}
                          </Badge>
                          {i < shortcut.key.split('+').length - 1 && <span className="text-muted-foreground">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Press <Badge variant="outline" size="sm" className="font-mono mx-1">?</Badge> to toggle this help
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook to use keyboard shortcuts
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  return <KeyboardShortcuts shortcuts={shortcuts} />;
}
