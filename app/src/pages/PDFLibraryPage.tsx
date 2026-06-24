import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  Info,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AdPlacement } from '@/components/ads';
import { SecurePDFDownload } from '@/components/paywall';
import { categories, topics } from '@/data/topics';
import { cn } from '@/lib/utils';

interface PDFLibraryPageProps {
  onBack: () => void;
}

const categoryAdvice: Record<string, string> = {
  'home-living': 'Walk through your actual home while answering. Small details like colors, locations, and routines are easier to remember when you practice in the real room.',
  'daily-routine': 'Compare weekday and weekend answers with your spouse so the normal rhythm of your life is clear and consistent.',
  relationship: 'Use dates, places, and simple memories. If a detail is uncertain, align on the honest answer instead of guessing.',
  financial: 'Review shared bills, leases, addresses, work schedules, and documents before practicing these questions.',
  'family-social': 'Focus on names, relationships, visits, and how your families or friends naturally fit into your married life.',
  'tech-communication': 'Review shared accounts, phones, messages, photos, and digital evidence you may mention during the interview.',
  'special-practice': 'Practice slowly first, then repeat with timed drills so pressure does not change your answers.',
};

function getCategoryName(categoryId: string) {
  return categories.find(category => category.id === categoryId)?.name || 'Practice Topic';
}

function getTopicDisplayTitle(title: string) {
  return title.split(':')[0].trim() || title;
}

export function PDFLibraryPage({ onBack }: PDFLibraryPageProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const pdfTopics = useMemo(
    () => topics.filter(topic => topic.pdfFileName),
    []
  );

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return pdfTopics.filter(topic => {
      const matchesCategory = activeCategory === 'all' || topic.category === activeCategory;
      const searchHaystack = [
        topic.title,
        topic.description,
        topic.category,
        topic.checklist.join(' '),
      ].join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || searchHaystack.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, pdfTopics, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-emerald-50 pb-16 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/95 shadow-sm shadow-blue-100/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-blue-800 hover:bg-blue-50 hover:text-blue-950"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Free study files</p>
              <h1 className="text-xl font-extrabold text-slate-950 sm:text-2xl">PDF Library</h1>
            </div>
          </div>
          <Badge className="hidden border-0 bg-blue-100 px-3 py-1.5 text-blue-800 sm:inline-flex">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {pdfTopics.length} topic packs
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-3xl border-2 border-blue-200 bg-gradient-to-r from-white via-blue-50 to-emerald-50 p-5 shadow-xl shadow-blue-100/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-200">
                <BookOpen className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">Practice topic by topic</h2>
                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
                  Each pack focuses on one part of married life, with questions, reminders, and a practical checklist.
                  Access the files individually so you can practice in the order that matches your interview prep.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white/90 p-3 text-sm font-semibold leading-6 text-emerald-950 shadow-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <p>
                  Spouse Interview is independent, not affiliated with USCIS or any government agency, and not a law firm.
                  These materials are for practice only. Seek qualified legal help for case-specific questions.
                </p>
              </div>
            </div>
          </div>
        </section>

        <AdPlacement placement="pdf_library.inline" />

        <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics, rooms, routines, documents..."
              className="h-12 rounded-2xl border-blue-100 bg-white pl-10 font-semibold shadow-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('all')}
              className={cn(activeCategory === 'all' && 'bg-blue-700 text-white hover:bg-blue-800')}
            >
              All
            </Button>
            {categories.map(category => (
              <Button
                key={category.id}
                type="button"
                variant={activeCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className={cn(activeCategory === category.id && 'bg-blue-700 text-white hover:bg-blue-800')}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTopics.map(topic => (
            <Card key={topic.id} className="overflow-hidden border-2 border-blue-100 bg-white shadow-lg shadow-slate-100/80">
              <CardHeader className="border-b border-blue-50 bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="mb-3 bg-white text-blue-800 ring-1 ring-blue-100">
                      {getCategoryName(topic.category)}
                    </Badge>
                    <CardTitle className="line-clamp-2 text-lg font-extrabold text-slate-950">
                      {getTopicDisplayTitle(topic.title)}
                    </CardTitle>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-200">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <p className="line-clamp-3 text-sm font-medium leading-6 text-slate-700">
                  {topic.description}
                </p>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-emerald-950">
                    <Info className="h-4 w-4 text-emerald-700" />
                    Practice advice
                  </div>
                  <p className="text-sm font-medium leading-6 text-emerald-900">
                    {categoryAdvice[topic.category] || 'Practice with your spouse, answer honestly, and note anything you need to verify before the interview.'}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Includes</p>
                    <p className="text-sm font-extrabold text-slate-950">{topic.questionCount} questions</p>
                  </div>
                  <SecurePDFDownload
                    pdfFileName={topic.pdfFileName}
                    pdfTitle={getTopicDisplayTitle(topic.title)}
                    topicId={topic.id}
                    categoryId={topic.category}
                    source="pdf_library"
                    size="sm"
                    label="Access PDF"
                    className="shrink-0 border-blue-200 bg-white font-extrabold text-blue-800 hover:border-blue-400 hover:bg-blue-50"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {filteredTopics.length === 0 && (
          <section className="rounded-3xl border-2 border-dashed border-blue-200 bg-white p-8 text-center shadow-sm">
            <FileText className="mx-auto h-10 w-10 text-blue-700" />
            <h2 className="mt-3 text-lg font-extrabold text-slate-950">No PDF topics found</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Try a different search term or choose All categories.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default PDFLibraryPage;
