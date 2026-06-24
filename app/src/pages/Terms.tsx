import { ArrowLeft, FileText, Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function Terms() {
  const backHref = typeof window !== 'undefined' && localStorage.getItem('auth_token') ? '/dashboard' : '/';
  const backLabel = backHref === '/dashboard' ? 'Back to Dashboard' : 'Back to Home';
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a href={backHref} className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">{backLabel}</span>
            </a>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-slate-900">Spouse Interview</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Scale className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Terms of Service</h1>
          <p className="text-slate-600">Last updated: February 23, 2025</p>
        </div>

        <Card className="border-2 border-slate-200 shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
              <p className="text-slate-700 leading-relaxed">
                By accessing and using Spouse Interview (&ldquo;the Service&rdquo;), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. Description of Service</h2>
              <p className="text-slate-700 leading-relaxed">
                Spouse Interview provides free practice resources, including questions, sample answers, checklists, and tools to help couples prepare for marriage-based immigration interviews. All resources are provided for educational and practice purposes only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                3. Important Disclaimer
              </h2>
              <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 leading-relaxed font-medium">
                  <strong>NOT LEGAL ADVICE:</strong> The content provided on Spouse Interview is for informational and educational purposes only. It does not constitute legal advice, nor does it create an attorney-client relationship. Immigration laws and procedures are complex and subject to change. We strongly recommend consulting with a qualified immigration attorney for advice specific to your situation.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. User Responsibilities</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                By using our Service, you agree to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-slate-700">
                <li>Use the Service only for lawful purposes</li>
                <li>Not use the Service to engage in any fraudulent activities</li>
                <li>Provide accurate and truthful information in your interview preparation</li>
                <li>Not reproduce, duplicate, copy, sell, or resell any portion of the Service without express written permission</li>
                <li>Not attempt to gain unauthorized access to any part of the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. Intellectual Property</h2>
              <p className="text-slate-700 leading-relaxed">
                All content on Spouse Interview, including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, and software, is the property of Spouse Interview or its content suppliers and is protected by international copyright laws. You may download and print materials for personal, non-commercial use only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. User-Generated Content</h2>
              <p className="text-slate-700 leading-relaxed">
                Any data you enter into the timeline builder or other interactive tools is stored locally on your device using browser storage. We do not collect, store, or have access to this information. You are responsible for maintaining the confidentiality of any information you enter.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Limitation of Liability</h2>
              <p className="text-slate-700 leading-relaxed">
                In no event shall Spouse Interview, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-slate-700 mt-3">
                <li>Your access to or use of or inability to access or use the Service</li>
                <li>Any conduct or content of any third party on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">8. No Guarantee of Results</h2>
              <p className="text-slate-700 leading-relaxed">
                We do not guarantee any specific outcome from using our Service. Success in immigration interviews depends on many factors beyond our control, including but not limited to: the accuracy of your application, your individual circumstances, changes in immigration law, and the discretion of immigration officials.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">9. Third-Party Links</h2>
              <p className="text-slate-700 leading-relaxed">
                Our Service may contain links to third-party websites or services that are not owned or controlled by Spouse Interview. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">10. Termination</h2>
              <p className="text-slate-700 leading-relaxed">
                We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. All provisions of the Terms which by their nature should survive termination shall survive termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">11. Governing Law</h2>
              <p className="text-slate-700 leading-relaxed">
                These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">12. Changes to Terms</h2>
              <p className="text-slate-700 leading-relaxed">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days&apos; notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                13. Contact Us
              </h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="bg-slate-100 rounded-lg p-4">
                <p className="text-slate-700"><strong>Email:</strong> legal@spouseinterview.com</p>
                <p className="text-slate-700"><strong>Website:</strong> <a href="/" className="text-blue-600 hover:underline">www.SpouseInterview.com</a></p>
              </div>
            </section>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Button onClick={scrollToTop} variant="outline" className="font-semibold">
            Back to Top
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">© {new Date().getFullYear()} Spouse Interview. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
