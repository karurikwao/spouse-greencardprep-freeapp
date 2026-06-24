/**
 * Readiness Check Page
 * Full-page readiness assessment
 */

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReadinessCheck } from '@/components/readiness';

interface ReadinessCheckPageProps {
  onBack: () => void;
}

export function ReadinessCheckPage({ onBack }: ReadinessCheckPageProps) {
  return (
    <div className="min-h-screen bg-slate-50/50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>
        
        <ReadinessCheck />
      </div>
    </div>
  );
}
