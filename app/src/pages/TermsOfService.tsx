/**
 * Terms of Service Page
 */

import { ArrowLeft, AlertCircle, FileText, Gift, Megaphone, Scale, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TermsOfServiceProps {
  onBack: () => void;
}

export function TermsOfService({ onBack }: TermsOfServiceProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-medium text-slate-800">Terms of Service</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-slate-800 sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Please read these terms before using Spouse Interview.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Free App Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Spouse Interview provides free practice resources for couples preparing for marriage-based
              immigration interviews. The free app includes practice questions, study files, progress tools,
              partner practice, dashboard messages, and limited daily use of Robin.
            </p>
            <p className="text-slate-600">
              The app may be supported by ads, sponsor placements, affiliate resources, and clearly labeled
              messages from Spouse Interview. Ad placements can remain hidden until they are approved and enabled.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-blue-600" />
              Robin Usage and Optional Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Robin uses AI services that may create operating costs. We may set daily free usage limits,
              temporarily pause Robin during emergencies, or introduce optional paid credit packs for extra
              Robin messages.
            </p>
            <p className="text-slate-600">
              If optional paid Robin credits become available, the app will show the credit amount, price,
              expiration, rollover rules, and any purchase-specific terms before checkout. Unless a checkout
              page clearly says otherwise, paid Robin credits are one-time purchases and not recurring plans.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              Messages, Sponsors, and Ads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Admin messages, sponsor resources, affiliate links, and site announcements may appear in your
              dashboard or message center. These messages should be treated as general resources, not personal
              legal advice or private support replies.
            </p>
            <p className="text-slate-600">
              Sponsored resources should be clearly labeled, such as &quot;Messages from Spouse Interview&quot; or
              &quot;Sponsored Resource.&quot; We may measure deliveries, opens, clicks, and dismissals so we can
              understand whether messages are useful and keep sponsor reporting accurate.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-600" />
              User Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">By using the service, you agree to:</p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-slate-600">
              <li>Use the service only for lawful personal preparation</li>
              <li>Provide truthful information when creating an account or contacting us</li>
              <li>Keep your account credentials private</li>
              <li>Not scrape, copy, resell, overload, or disrupt the app or its content</li>
              <li>Respect our content, sponsor links, and intellectual property rights</li>
              <li>Use your own judgment and consult qualified professionals when needed</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Important: No Legal Advice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 font-medium text-amber-800">
                Spouse Interview is not a law firm and does not provide legal advice.
              </p>
              <p className="text-sm text-amber-700">
                The information, materials, and tools in the app are for education and practice only.
                They do not replace official USCIS instructions, legal advice, or guidance from a
                qualified immigration professional.
              </p>
            </div>
            <p className="text-slate-600">
              Using the service does not create an attorney-client relationship. We do not guarantee
              interview outcomes, application decisions, or government processing results.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Limitation of Liability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              To the maximum extent permitted by law, Spouse Interview and its affiliates, officers,
              employees, agents, and licensors shall not be liable for:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-slate-600">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, use, goodwill, or other intangible losses</li>
              <li>The outcome of your USCIS interview or immigration case</li>
              <li>Any decisions made by immigration officials</li>
              <li>Any errors, omissions, outages, or interruptions in our content or services</li>
            </ul>
            <p className="text-slate-600">
              For free use of the app, our total liability for claims arising from the service is limited
              to the maximum extent allowed by applicable law. For optional paid credit purchases, liability
              will not exceed the amount you paid for the specific unused purchase involved in the claim.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Account Termination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              We may suspend or terminate accounts for violations of these terms, abuse, fraud,
              security risks, or activity that harms other users or the service. You may also deactivate
              your account from account settings.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Changes to These Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              We may modify these terms as the free app, sponsor features, ads, or optional Robin credits
              evolve. We will post updated terms on this page and update the date below. Your continued
              use of the service after changes means you accept the updated terms.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-center text-slate-600">
              If you have questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:support@spouseinterview.com" className="text-blue-600 hover:underline">
                support@spouseinterview.com
              </a>
            </p>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-sm text-slate-500">
          Last updated: June 13, 2026
        </p>
      </main>
    </div>
  );
}
