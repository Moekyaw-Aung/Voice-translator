import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, X, Wand2 } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onRewrite: (text: string, instruction: string) => void;
  suggestions: any[];
  onApplySuggestion: (id: string) => void;
  onDismissSuggestion: (id: string) => void;
}

export function RichTextEditor({ content, onChange, onRewrite, suggestions, onApplySuggestion, onDismissSuggestion }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ text: string, rect: DOMRect } | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState<any | null>(null);
  const lastHtmlRef = useRef<string>('');

  // Handle selection for the floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        
        // Ensure selection is within editor
        let node: Node | null = range.commonAncestorContainer;
        let isInsideEditor = false;
        while (node && node !== document.body) {
          if (node === editorRef.current) {
            isInsideEditor = true;
            break;
          }
          node = node.parentNode;
        }

        if (isInsideEditor) {
          const rect = range.getBoundingClientRect();
          setSelection({
            text: sel.toString(),
            rect
          });
        } else {
          setSelection(null);
        }
      } else {
        setSelection(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Handle clicks on suggestions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SPAN' && target.dataset.suggestionId) {
        const id = target.dataset.suggestionId;
        const suggestion = suggestions.find(s => s.id === id);
        if (suggestion) {
          const rect = target.getBoundingClientRect();
          setActiveSuggestion({ ...suggestion, rect });
        }
      } else if (!target.closest('.suggestion-popup')) {
        setActiveSuggestion(null);
      }
    };

    const el = editorRef.current;
    if (el) {
      el.addEventListener('click', handleClick);
      return () => el.removeEventListener('click', handleClick);
    }
  }, [suggestions]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      lastHtmlRef.current = editorRef.current.innerHTML;
      onChange(text);
    }
  }, [onChange]);

  // Render content with highlights ONLY when external content changes or suggestions change
  useEffect(() => {
    if (!editorRef.current) return;
    
    let html = content.replace(/\\n/g, '<br/>');
    
    // Apply highlights
    suggestions.forEach(s => {
      // Escape regex chars
      const escaped = s.originalText.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
      // Replace only the first occurrence
      const regex = new RegExp(`(${escaped})`);
      html = html.replace(regex, `<span class="bg-amber-100 border-b-2 border-amber-400 cursor-pointer transition-colors hover:bg-amber-200" data-suggestion-id="${s.id}">$1</span>`);
    });

    // Only update if HTML actually changed from the outside
    // We compare with lastHtmlRef to avoid updating when the user is typing
    if (html !== lastHtmlRef.current) {
      editorRef.current.innerHTML = html || '<br/>';
      lastHtmlRef.current = html;
    }
  }, [content, suggestions]);

  const handleRewriteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selection && aiPrompt) {
      onRewrite(selection.text, aiPrompt);
      setSelection(null);
      setAiPrompt('');
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[60vh] text-lg leading-relaxed text-gray-800 font-serif outline-none p-8 bg-white rounded-2xl shadow-sm border border-gray-100 focus:ring-2 focus:ring-indigo-100 transition-all"
        style={{ whiteSpace: 'pre-wrap' }}
      />

      {/* Floating Selection Toolbar */}
      <AnimatePresence>
        {selection && !activeSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed z-50 bg-white shadow-xl rounded-xl border border-gray-200 p-2 flex flex-col gap-2 w-80"
            style={{
              top: Math.max(10, selection.rect.top - 110),
              left: Math.max(10, selection.rect.left + selection.rect.width / 2 - 160)
            }}
          >
            <div className="flex items-center gap-1 border-b border-gray-100 pb-2">
              <Sparkles size={16} className="text-indigo-500 ml-1" />
              <span className="text-sm font-medium text-gray-700">Ask AI to rewrite</span>
            </div>
            <form onSubmit={handleRewriteSubmit} className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g., Make it punchier..."
                className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button 
                type="submit"
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Go
              </button>
            </form>
            <div className="flex gap-1 pt-1">
              {['Shorter', 'Longer', 'Professional', 'Casual'].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent losing selection
                    onRewrite(selection.text, `Make it ${preset.toLowerCase()}`);
                    setSelection(null);
                  }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-md transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestion Popup */}
      <AnimatePresence>
        {activeSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="suggestion-popup fixed z-50 bg-white shadow-2xl rounded-xl border border-amber-200 p-4 flex flex-col gap-3 w-80"
            style={{
              top: activeSuggestion.rect.bottom + 10,
              left: Math.max(10, activeSuggestion.rect.left - 160 + activeSuggestion.rect.width / 2)
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5 text-amber-600">
                <Wand2 size={16} />
                <span className="text-sm font-semibold">AI Suggestion</span>
              </div>
              <button 
                onClick={() => setActiveSuggestion(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
              {activeSuggestion.reason}
            </div>
            
            <div className="text-sm font-medium text-gray-900 bg-amber-50 p-3 rounded-lg border border-amber-100">
              {activeSuggestion.suggestedText}
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  onApplySuggestion(activeSuggestion.id);
                  setActiveSuggestion(null);
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Check size={16} /> Accept
              </button>
              <button
                onClick={() => {
                  onDismissSuggestion(activeSuggestion.id);
                  setActiveSuggestion(null);
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
