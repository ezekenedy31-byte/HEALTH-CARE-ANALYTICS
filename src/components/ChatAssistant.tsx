import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Bot, Send, Sparkles, X } from 'lucide-react';
import type { ChatMessage, ForecastAction } from '../types/hospital';

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  analyticsContext: Record<string, unknown>;
  dataScopeSummary: string;
  onApplyForecastAction: (action: ForecastAction) => void;
}

const STARTER_QUESTIONS = [
  'Which department had the longest wait times last month?',
  "What's our current bed occupancy rate and spike count?",
  'Forecast admissions for the next 2 weeks',
  'Show staffing ratios and overtime trends for Emergency',
];

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={idx} className="font-mono text-[11px] bg-white/15 px-1 py-0.5 rounded-[3px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-[#00A795] font-bold mt-0.5">•</span>
              <span>{renderInlineFormatting(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInlineFormatting(trimmed)}</p>;
      })}
    </div>
  );
}

export function ChatAssistant({
  isOpen,
  onClose,
  analyticsContext,
  dataScopeSummary,
  onApplyForecastAction,
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Ready to analyze your loaded hospital operations data. Ask about wait times, bed occupancy, staffing gaps, or request a 7–30 day forecast to update the dashboard live.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dataScope: dataScopeSummary,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory
            .filter((m) => m.id !== 'welcome' && !m.isError)
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text })),
          analyticsContext,
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        forecastAction?: ForecastAction;
        error?: string;
      };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || `Request failed with status ${response.status}`);
      }

      if (payload.forecastAction) {
        onApplyForecastAction(payload.forecastAction);
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: payload.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dataScope: dataScopeSummary,
        forecastAction: payload.forecastAction,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Unable to reach analytics AI endpoint.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `Could not complete AI query: ${errText}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Hospital Operations AI Analyst"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] bg-[#0A2E36] text-white flex flex-col border-l border-white/15 shadow-2xl no-print"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#00A795] text-[#0A2E36] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">Clinical Ops AI Analyst</h3>
            <p className="text-[11px] font-mono text-[#00A795] truncate">
              Data-Grounded Q&amp;A &amp; Forecasting
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
          aria-label="Close AI analyst panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Data Scope Strip */}
      <div className="px-5 py-2.5 bg-[#02808F]/25 border-b border-white/10 text-[11px] font-mono text-white/85">
        {dataScopeSummary}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-[6px] px-3.5 py-2.5 ${
                m.role === 'user'
                  ? 'bg-[#00A795] text-[#0A2E36] font-medium'
                  : m.isError
                  ? 'bg-white/10 border border-white/25 text-white'
                  : 'bg-[#02808F]/35 border border-white/10 text-white/95'
              }`}
            >
              {m.role === 'user' ? (
                <p className="text-xs sm:text-[13px] leading-relaxed">{m.text}</p>
              ) : (
                <FormattedMessageText text={m.text} />
              )}

              {m.forecastAction && (
                <button
                  type="button"
                  onClick={() => onApplyForecastAction(m.forecastAction!)}
                  className="mt-2.5 w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[4px] bg-[#0A2E36] text-[#00A795] text-[11px] font-mono font-semibold hover:bg-[#0A2E36]/80 cursor-pointer"
                >
                  <span>
                    Updated {m.forecastAction.horizonDays}d {m.forecastAction.metric} chart
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>

            <div className="mt-1 px-1 text-[10px] font-mono text-white/50">
              {m.timestamp}
              {m.role === 'assistant' && m.dataScope ? ` · Cited loaded records` : ''}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-[#02808F]/30 border border-white/10 rounded-[6px] px-3.5 py-2.5 text-xs text-white/80 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00A795] animate-spin" />
              Querying hospital metrics &amp; computing response...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter Questions */}
      <div className="px-4 py-2.5 border-t border-white/10 bg-[#0A2E36]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/60 mb-2">
          Suggested Analytics Prompts
        </div>
        <div className="flex flex-col gap-1.5">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={isLoading}
              onClick={() => void sendQuestion(q)}
              className="text-left text-[11px] text-white/90 hover:text-white bg-white/[0.06] hover:bg-[#02808F]/45 px-2.5 py-1.5 rounded-[4px] transition-colors truncate cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/12 bg-[#0A2E36]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about wait times, occupancy, or forecast..."
            disabled={isLoading}
            className="flex-1 bg-white/10 border border-white/15 rounded-[6px] px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-[#00A795]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-[6px] bg-[#00A795] text-[#0A2E36] hover:bg-[#02808F] hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Send question"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}
