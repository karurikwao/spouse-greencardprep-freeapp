/**
 * Couple Progress Card
 * 
 * Placeholder UI for couple comparison feature.
 * Shows partner connection status and encourages collaboration.
 */

import { Users, UserPlus, Heart, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CoupleProgressCardProps {
  isConnected?: boolean;
  partnerName?: string;
  alignmentScore?: number; // 0-100
  className?: string;
  onInvitePartner?: () => void;
  onViewComparison?: () => void;
}

export function CoupleProgressCard({
  isConnected = false,
  partnerName,
  alignmentScore: rawAlignmentScore,
  className,
  onInvitePartner,
  onViewComparison,
}: CoupleProgressCardProps) {
  // Validate and clamp alignment score
  const alignmentScore = rawAlignmentScore !== undefined 
    ? Math.max(0, Math.min(100, Math.round(Number(rawAlignmentScore) || 0)))
    : undefined;
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-rose-500" />
          <h3 className="font-semibold text-slate-800">Couple Alignment</h3>
        </div>
        {isConnected && alignmentScore !== undefined && (
          <div className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium',
            alignmentScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
            alignmentScore >= 50 ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          )}>
            {alignmentScore}% aligned
          </div>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-4">
          {/* Connected state */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white">
                <span className="text-sm font-medium text-blue-600">You</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center border-2 border-white">
                <span className="text-sm font-medium text-rose-600">
                  {partnerName ? partnerName.charAt(0).toUpperCase() : 'P'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
              <span className="text-sm text-slate-600">
                Connected with {partnerName || 'partner'}
              </span>
            </div>
          </div>

          {alignmentScore !== undefined && (
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">Answer alignment</span>
                <span className={cn(
                  'font-medium',
                  alignmentScore >= 80 ? 'text-emerald-600' :
                  alignmentScore >= 50 ? 'text-blue-600' :
                  'text-amber-600'
                )}>
                  {alignmentScore}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    alignmentScore >= 80 ? 'bg-emerald-500' :
                    alignmentScore >= 50 ? 'bg-blue-500' :
                    'bg-amber-500'
                  )}
                  style={{ width: `${alignmentScore}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {alignmentScore >= 80 
                  ? "Great alignment! Your answers are well coordinated."
                  : alignmentScore >= 50 
                  ? "Making progress. Continue reviewing answers together."
                  : "Needs attention. Discuss your answers to ensure consistency."}
              </p>
            </div>
          )}

          {onViewComparison && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={onViewComparison}
            >
              View Comparison
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Not connected state */}
          <div className="flex items-center justify-center py-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-slate-400" />
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-slate-600 mb-1">
              Invite your partner to practice together
            </p>
            <p className="text-xs text-slate-500">
              Compare answers and ensure you're both prepared with consistent responses
            </p>
          </div>

          {onInvitePartner && (
            <Button 
              size="sm" 
              className="w-full bg-rose-500 hover:bg-rose-600"
              onClick={onInvitePartner}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Partner
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default CoupleProgressCard;
