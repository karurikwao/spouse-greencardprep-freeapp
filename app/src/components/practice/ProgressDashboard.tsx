/**
 * Progress Dashboard
 * Shows statistics and insights about practice progress
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, CheckCircle, RefreshCw, AlertCircle, Bookmark, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { usePractice, normalizeAllTopics } from '@/lib/practice';
import { topics } from '@/data/topics';

interface ProgressDashboardProps {
  onBack: () => void;
  onPracticeTopic: (topicId: string) => void;
}

interface Stats {
  totalQuestionsReviewed: number;
  understoodCount: number;
  needsPracticeCount: number;
  nervousCount: number;
  savedCount: number;
  topicsStarted: number;
}

export function ProgressDashboard({ onBack, onPracticeTopic }: ProgressDashboardProps) {
  const { getStats, getNeedsPractice, getNervousQuestions, isSyncing } = usePractice();
  const [stats, setStats] = useState<Stats | null>(null);
  const [needsPracticeIds, setNeedsPracticeIds] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_nervousIds, setNervousIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedTopics = useMemo(() => normalizeAllTopics(topics), []);
  const totalQuestions = useMemo(() => 
    normalizedTopics.reduce((sum, t) => sum + t.questions.length, 0),
    [normalizedTopics]
  );

  // Load stats
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      const [statsData, needsPracticeData, nervousData] = await Promise.all([
        getStats(),
        getNeedsPractice(),
        getNervousQuestions(),
      ]);

      setStats(statsData);
      setNeedsPracticeIds(needsPracticeData);
      setNervousIds(nervousData);
      setIsLoading(false);
    };
    loadData();
  }, [getStats, getNeedsPractice, getNervousQuestions]);

  // Calculate percentages
  const percentages = useMemo(() => {
    if (!stats || totalQuestions === 0) return null;
    return {
      reviewed: Math.round((stats.totalQuestionsReviewed / totalQuestions) * 100),
      understood: Math.round((stats.understoodCount / totalQuestions) * 100),
      needsPractice: Math.round((stats.needsPracticeCount / totalQuestions) * 100),
      nervous: Math.round((stats.nervousCount / totalQuestions) * 100),
    };
  }, [stats, totalQuestions]);

  // Find topics with most "needs practice" questions
  const topicsNeedingAttention = useMemo(() => {
    const topicCounts: Record<string, { topic: typeof normalizedTopics[0]; count: number }> = {};

    for (const questionId of needsPracticeIds) {
      const topicId = questionId.split('-q')[0];
      const topic = normalizedTopics.find(t => t.id === topicId);
      if (topic) {
        if (!topicCounts[topicId]) {
          topicCounts[topicId] = { topic, count: 0 };
        }
        topicCounts[topicId].count++;
      }
    }

    return Object.values(topicCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [needsPracticeIds, normalizedTopics]);

  if (isLoading) {
    return (
      <div className="min-h-screen app-vivid-section flex items-center justify-center">
        <p className="font-bold text-slate-700">Loading your progress...</p>
      </div>
    );
  }

  if (!stats || !percentages) {
    return (
      <div className="min-h-screen app-vivid-section flex items-center justify-center">
        <p className="font-bold text-slate-700">Unable to load statistics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-vivid-section">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-blue-100 bg-white/95 shadow-sm shadow-blue-100/70 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4 -ml-2 font-bold text-blue-800 hover:bg-blue-50 hover:text-blue-950"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-200">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-950">
                Your Progress
              </h1>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                Track your preparation journey
              </p>
            </div>
          </div>

          {isSyncing && (
            <p className="text-xs font-bold text-blue-700 mt-2">Syncing...</p>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={BookOpen}
            label="Questions reviewed"
            value={stats.totalQuestionsReviewed}
            subValue={`of ${totalQuestions}`}
            color="slate"
          />
          <StatCard
            icon={CheckCircle}
            label="Comfortable with"
            value={stats.understoodCount}
            percentage={percentages.understood}
            color="emerald"
          />
          <StatCard
            icon={RefreshCw}
            label="Need more review"
            value={stats.needsPracticeCount}
            percentage={percentages.needsPractice}
            color="amber"
          />
          <StatCard
            icon={Bookmark}
            label="Saved for later"
            value={stats.savedCount}
            color="blue"
          />
        </div>

        {/* Overall Progress */}
        <Card className="mb-8 border-blue-200 shadow-xl shadow-blue-100/70">
          <CardHeader>
            <CardTitle className="text-base font-extrabold text-slate-950">
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-700">Questions reviewed</span>
                <span className="font-extrabold text-blue-800">{percentages.reviewed}%</span>
              </div>
              <Progress value={percentages.reviewed} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-700">Topics started</span>
                <span className="font-extrabold text-emerald-800">{stats.topicsStarted} of {normalizedTopics.length}</span>
              </div>
              <Progress 
                value={(stats.topicsStarted / normalizedTopics.length) * 100} 
                className="h-2" 
              />
            </div>
          </CardContent>
        </Card>

        {/* Topics Needing Attention */}
        {topicsNeedingAttention.length > 0 && (
          <Card className="mb-8 border-amber-200 shadow-xl shadow-amber-100/70">
            <CardHeader>
              <CardTitle className="text-base font-extrabold text-slate-950">
                Topics to review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topicsNeedingAttention.map(({ topic, count }) => (
                  <div 
                    key={topic.id}
                    className="app-vivid-tile flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-slate-900">{topic.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-amber-800">
                        {count} questions need review
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPracticeTopic(topic.id)}
                        className="text-xs"
                      >
                        Practice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comfort Level Breakdown */}
        <Card className="border-emerald-200 shadow-xl shadow-emerald-100/70">
          <CardHeader>
            <CardTitle className="text-base font-extrabold text-slate-950">
              Comfort level breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ComfortBar
                label="Comfortable"
                count={stats.understoodCount}
                percentage={percentages.understood}
                color="bg-emerald-400"
              />
              <ComfortBar
                label="Needs review"
                count={stats.needsPracticeCount}
                percentage={percentages.needsPractice}
                color="bg-amber-400"
              />
              <ComfortBar
                label="Unsure"
                count={stats.nervousCount}
                percentage={percentages.nervous}
                color="bg-rose-400"
              />
              <ComfortBar
                label="Not yet reviewed"
                count={totalQuestions - stats.totalQuestionsReviewed}
                percentage={100 - percentages.reviewed}
                color="bg-slate-200"
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

interface StatCardProps {
  icon: typeof TrendingUp;
  label: string;
  value: number;
  subValue?: string;
  percentage?: number;
  color: 'slate' | 'emerald' | 'amber' | 'blue' | 'rose';
}

function StatCard({ icon: Icon, label, value, subValue, percentage, color }: StatCardProps) {
  const colorClasses = {
    slate: 'bg-gradient-to-br from-blue-100 to-slate-100 text-blue-800',
    emerald: 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800',
    amber: 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800',
    blue: 'bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-800',
    rose: 'bg-gradient-to-br from-rose-100 to-pink-100 text-rose-800',
  };
  const cardShellClasses = {
    slate: 'border-blue-200 bg-gradient-to-br from-white via-blue-50/90 to-slate-50 shadow-blue-100/80',
    emerald: 'border-emerald-200 bg-gradient-to-br from-white via-emerald-50/90 to-teal-50 shadow-emerald-100/80',
    amber: 'border-amber-200 bg-gradient-to-br from-white via-amber-50/90 to-orange-50 shadow-amber-100/80',
    blue: 'border-blue-200 bg-gradient-to-br from-white via-blue-50/90 to-cyan-50 shadow-blue-100/80',
    rose: 'border-rose-200 bg-gradient-to-br from-white via-rose-50/90 to-pink-50 shadow-rose-100/80',
  };

  return (
    <Card className={cn('min-h-[176px] border-2 shadow-xl', cardShellClasses[color])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn('p-2.5 rounded-xl shadow-sm', colorClasses[color])}>
            <Icon className="w-4 h-4" />
          </div>
          {percentage !== undefined && (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold text-slate-700 shadow-sm">{percentage}%</span>
          )}
        </div>
        <div className="mt-3">
          <div className="text-3xl font-extrabold text-slate-950">
            {value}
            {subValue && (
              <span className="text-sm font-bold text-slate-600 ml-1">{subValue}</span>
            )}
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ComfortBarProps {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

function ComfortBar({ label, count, percentage, color }: ComfortBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-extrabold text-slate-950">{count}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-blue-100">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
