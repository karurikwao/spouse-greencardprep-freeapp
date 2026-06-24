/**
 * Free-app contact panel.
 *
 * Kept under the old export name so legacy imports no longer revive the full
 * ticketing workflow.
 */

import { Mail, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SupportTicketPanelProps {
  className?: string;
}

export function SupportTicketPanel({ className }: SupportTicketPanelProps) {
  return (
    <Card className={cn('border-slate-200 bg-white', className)}>
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <MessageSquare className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg text-slate-950">Messages and Contact</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 text-sm leading-6 text-slate-700">
        <p>
          App announcements, welcome notes, and sponsored resources are delivered through
          your in-app messages. For direct help, send a simple email instead of opening a ticket.
        </p>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-950">
          Dashboard messages should be clearly labeled as Messages from Spouse Interview
          or Sponsored Resource, so users can tell announcements apart from private help.
        </div>
        <Button asChild className="bg-blue-700 hover:bg-blue-800">
          <a href="mailto:support@spouseinterview.com">
            <Mail className="mr-2 h-4 w-4" />
            Email Spouse Interview
          </a>
        </Button>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Send className="h-3.5 w-3.5" />
          Admin broadcasts and welcome messages remain available in the Messages inbox.
        </div>
      </CardContent>
    </Card>
  );
}
