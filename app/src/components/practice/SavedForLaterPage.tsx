/**
 * Saved For Later Page
 * Shows all questions the user has saved across all topics
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Bookmark, BookmarkX, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePractice, normalizeAllTopics } from '@/lib/practice';
import { topics } from '@/data/topics';

interface SavedForLaterPageProps {
  onBack: () => void;
  onPracticeQuestion: (topicId: string, questionIndex: number) => void;
}

export function SavedForLaterPage({ onBack, onPracticeQuestion }: SavedForLaterPageProps) {
  const { getSavedForLater, toggleSaveForLater, getComfortStatus, isSyncing } = usePractice();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);

  // Load saved questions
  useEffect(() => {
    const loadSaved = async () => {
      setIsLoading(true);
      const ids = await getSavedForLater();
      setSavedIds(ids);
      setIsLoading(false);
    };
    loadSaved();
  }, [getSavedForLater]);

  // Group saved questions by topic
  const groupedQuestions = useMemo(() => {
    const groups: { 
      topic: typeof normalizedTopics[0]; 
      questions: { question: typeof normalizedTopics[0]['questions'][0]; comfortStatus: ReturnType<typeof getComfortStatus> }[] 
    }[] = [];

    for (const topic of normalizedTopics) {
      const topicQuestions = topic.questions
        .filter(q => savedIds.includes(q.id))
        .map(q => ({
          question: q,
          comfortStatus: getComfortStatus(q.id),
        }));

      if (topicQuestions.length > 0) {
        groups.push({
          topic,
          questions: topicQuestions,
        });
      }
    }

    return groups;
  }, [normalizedTopics, savedIds, getComfortStatus]);

  const handleRemove = async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleSaveForLater(questionId);
    setSavedIds(prev => prev.filter(id => id !== questionId));
  };

  const handleQuestionClick = (topicId: string, questionIndex: number) => {
    onPracticeQuestion(topicId, questionIndex);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <p className="text-slate-500">Loading saved questions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4 -ml-2 text-slate-500 hover:text-slate-800 font-normal"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-slate-400" />
            <div>
              <h1 className="text-2xl text-slate-800 font-medium">
                Saved for Later
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Questions you want to review again
              </p>
            </div>
          </div>

          {isSyncing && (
            <p className="text-xs text-slate-400 mt-2">Syncing...</p>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {groupedQuestions.length === 0 ? (
          <div className="text-center py-16">
            <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg text-slate-700 font-medium mb-2">
              No saved questions yet
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              While practicing, click "Save to review later" on questions you want to come back to.
            </p>
            <Button onClick={onBack} variant="outline" className="mt-6">
              Start practicing
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedQuestions.map(({ topic, questions }) => (
              <div key={topic.id}>
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
                  {topic.title}
                </h2>
                
                <div className="space-y-3">
                  {questions.map(({ question, comfortStatus }) => (
                    <Card
                      key={question.id}
                      onClick={() => handleQuestionClick(topic.id, question.sortOrder)}
                      className={cn(
                        'cursor-pointer transition-all duration-200',
                        'hover:shadow-sm hover:border-slate-300',
                        'border-slate-200/60'
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-700 leading-relaxed">
                              {question.prompt}
                            </p>
                            
                            <div className="flex items-center gap-2 mt-3">
                              {comfortStatus && (
                                <Badge 
                                  variant="secondary" 
                                  className={cn(
                                    'text-xs font-normal',
                                    comfortStatus === 'understood' && 'bg-emerald-50 text-emerald-700',
                                    comfortStatus === 'needs-practice' && 'bg-amber-50 text-amber-700',
                                    comfortStatus === 'nervous' && 'bg-rose-50 text-rose-700',
                                  )}
                                >
                                  {comfortStatus === 'understood' && 'Comfortable'}
                                  {comfortStatus === 'needs-practice' && 'Needs review'}
                                  {comfortStatus === 'nervous' && 'Unsure'}
                                </Badge>
                              )}
                              <span className="text-xs text-slate-400">
                                Question {question.sortOrder + 1}
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleRemove(question.id, e)}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-600"
                          >
                            <BookmarkX className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
