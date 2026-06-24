/**
 * AI Demo Section
 * 
 * Shows a simulated conversation with Robin to help visitors
 * understand the AI interview experience.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  sender: 'robin' | 'user';
  text: string;
  delay: number;
}

const DEMO_CONVERSATION: Message[] = [
  {
    id: 1,
    sender: 'robin',
    text: "Can you tell me how you and your spouse first met?",
    delay: 500,
  },
  {
    id: 2,
    sender: 'user',
    text: "We met in 2019 while working at the same restaurant in Boston.",
    delay: 2000,
  },
  {
    id: 3,
    sender: 'robin',
    text: "That's great. Can you tell me where you went on your first date?",
    delay: 3500,
  },
  {
    id: 4,
    sender: 'user',
    text: "We went to a small café near Boston Common. It was a Tuesday evening.",
    delay: 5500,
  },
  {
    id: 5,
    sender: 'robin',
    text: "Nice. Questions like this help officers understand your relationship timeline. Keep practicing!",
    delay: 7500,
  },
];

export function AIDemoSection() {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const startAnimation = useCallback(() => {
    setVisibleMessages([]);
    setCurrentIndex(0);
    setIsTyping(true);

    DEMO_CONVERSATION.forEach((message) => {
      setTimeout(() => {
        setVisibleMessages((prev) => [...prev, message.id]);
        setCurrentIndex((prev) => prev + 1);
        
        // Show typing indicator for next message
        const nextMessage = DEMO_CONVERSATION.find(m => m.id === message.id + 1);
        if (nextMessage) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 800);
        }
      }, message.delay);
    });

    // Reset after full cycle
    setTimeout(() => {
      startAnimation();
    }, 12000);
  }, []);

  useEffect(() => {
    startAnimation();
    return () => {
      // Cleanup handled by timeout clearing on unmount
    };
  }, [startAnimation]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
          <Bot className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">
          Practice realistic interview questions with Robin
        </h3>
        <p className="text-slate-600 text-sm max-w-lg mx-auto">
          Practice with Robin before your USCIS marriage interview.
        </p>
        <p className="text-slate-500 text-xs max-w-lg mx-auto mt-2">
          Robin will ask follow-up questions similar to what USCIS officers may ask.
        </p>
      </div>

      {/* Chat Demo */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="space-y-4">
          {DEMO_CONVERSATION.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3 transition-all duration-500',
                visibleMessages.includes(message.id)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2'
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  message.sender === 'robin'
                    ? 'bg-blue-100'
                    : 'bg-slate-100'
                )}
              >
                {message.sender === 'robin' ? (
                  <Bot className="w-4 h-4 text-blue-600" />
                ) : (
                  <User className="w-4 h-4 text-slate-600" />
                )}
              </div>

              {/* Message */}
              <div
                className={cn(
                  'rounded-2xl px-4 py-2.5 max-w-[80%] text-sm',
                  message.sender === 'robin'
                    ? 'bg-blue-50 text-slate-800 rounded-tl-none'
                    : 'bg-slate-100 text-slate-800 rounded-tr-none'
                )}
              >
                {message.sender === 'robin' && (
                  <p className="text-xs text-blue-600 font-medium mb-1">Robin</p>
                )}
                <p>{message.text}</p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && currentIndex < DEMO_CONVERSATION.length && (
            <div className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-blue-50 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subtle footer note */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Robin is your virtual interview coach for marriage interview practice.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AIDemoSection;
