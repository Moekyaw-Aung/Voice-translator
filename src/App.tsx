import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Paperclip, Send, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import { RichTextEditor } from './components/RichTextEditor';
import { generateInitialDraft, rewriteText, getProactiveSuggestions, Attachment, Suggestion } from './services/aiService';

export default function App() {
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Proactive suggestions background task
  useEffect(() => {
    if (!content || content.length < 50) return;

    const timer = setTimeout(async () => {
      const newSuggestions = await getProactiveSuggestions(content);
      // Only add suggestions that still match text in the content
      setSuggestions(prev => {
        const validPrev = prev.filter(s => content.includes(s.originalText));
        const validNew = newSuggestions.filter(s => content.includes(s.originalText) && !validPrev.some(p => p.originalText === s.originalText));
        return [...validPrev, ...validNew];
      });
    }, 5000); // Debounce 5s

    return () => clearTimeout(timer);
  }, [content]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachments(prev => [...prev, {
            name: file.name,
            type: file.type,
            data: event.target!.result as string
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;

    setIsGenerating(true);
    try {
      const draft = await generateInitialDraft(prompt, attachments);
      setContent(draft);
      setIsSidebarOpen(false); // Close sidebar to focus on writing
    } catch (error) {
      console.error("Failed to generate draft", error);
      alert("Failed to generate draft. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewrite = async (textToRewrite: string, instruction: string) => {
    setIsGenerating(true);
    try {
      const rewritten = await rewriteText(textToRewrite, instruction, content);
      setContent(prev => prev.replace(textToRewrite, rewritten));
    } catch (error) {
      console.error("Failed to rewrite", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplySuggestion = (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (suggestion) {
      setContent(prev => prev.replace(suggestion.originalText, suggestion.suggestedText));
      setSuggestions(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleDismissSuggestion = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] text-gray-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full bg-white border-r border-gray-200 flex flex-col shadow-sm z-10"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                <Sparkles size={20} />
                <span>Magic Writer</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 lg:hidden">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">What are we writing today?</h3>
                <form onSubmit={handleGenerateDraft} className="flex flex-col gap-3">
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g., A blog post about the future of AI in design..."
                    className="w-full h-32 p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  
                  <div className="flex flex-col gap-2">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100 text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate text-gray-600">{att.name}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setAttachments(prev => prev.filter((_, index) => index !== i))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Paperclip size={18} />
                      <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                    <button
                      type="submit"
                      disabled={isGenerating || !prompt}
                      className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Generate Draft
                    </button>
                  </div>
                </form>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Wand2 size={16} className="text-amber-500" />
                    Proactive Suggestions
                  </h3>
                  <div className="flex flex-col gap-3">
                    {suggestions.map(s => (
                      <div key={s.id} className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-sm">
                        <p className="text-gray-600 mb-2">{s.reason}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleApplySuggestion(s.id)} className="text-amber-700 font-medium hover:underline">Apply</button>
                          <button onClick={() => handleDismissSuggestion(s.id)} className="text-gray-500 hover:underline">Dismiss</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 border-b border-gray-200 bg-white/50 backdrop-blur-sm flex items-center px-6 justify-between sticky top-0 z-10">
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <Sparkles size={18} />
              <span className="text-sm font-medium">AI Tools</span>
            </button>
          )}
          <div className="flex-1" />
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
              <Loader2 size={14} className="animate-spin" />
              AI is thinking...
            </div>
          )}
        </header>

        {/* Editor Container */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          {content === '' && !isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Sparkles size={48} className="mb-4 text-gray-300" />
              <p className="text-lg">Start typing or use the AI to generate a draft.</p>
            </div>
          ) : (
            <RichTextEditor
              content={content}
              onChange={setContent}
              onRewrite={handleRewrite}
              suggestions={suggestions}
              onApplySuggestion={handleApplySuggestion}
              onDismissSuggestion={handleDismissSuggestion}
            />
          )}
        </main>
      </div>
    </div>
  );
}
