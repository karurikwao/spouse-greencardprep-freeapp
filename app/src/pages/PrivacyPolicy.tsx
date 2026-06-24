import { ArrowLeft, Shield, Lock, Eye, Database, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function PrivacyPolicy() {
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
              <Shield className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-slate-900">Spouse Interview</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
          <p className="text-slate-600">Last updated: June 13, 2026</p>
        </div>

        <Card className="border-2 border-slate-200 shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Introduction
              </h2>
              <p className="text-slate-700 leading-relaxed">
                Spouse Interview (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Information We Collect
              </h2>
              <div className="space-y-3 text-slate-700 leading-relaxed">
                <p><strong className="text-slate-900">Personal Data:</strong> You can browse many resources without an account. If you sign up, contact us, use partner practice, receive dashboard messages, or use Robin, we may collect information needed to provide those features, such as:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Account email, profile details, and authentication data</li>
                  <li>Information you voluntarily provide when contacting us or using app messages</li>
                  <li>Practice progress, partner sync status, PDF download activity, and Robin usage records</li>
                  <li>Data stored locally in your browser for progress tracking and app preferences</li>
                </ul>
                
                <p><strong className="text-slate-900">Automatically Collected Data:</strong> We may automatically collect certain information when you visit our website, including:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>Pages visited and time spent</li>
                  <li>Referring website</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">How We Use Your Information</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-slate-700">
                <li>Provide and maintain our services</li>
                <li>Improve user experience and website functionality</li>
                <li>Analyze usage patterns to enhance our content</li>
                <li>Respond to your inquiries and support requests</li>
                <li>Send updates and notifications (with your consent)</li>
                <li>Operate daily free Robin limits and protect the app from abuse</li>
                <li>Measure dashboard message, sponsor, affiliate, and ad performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Local Storage & Cookies</h2>
              <p className="text-slate-700 leading-relaxed">
                We use browser localStorage to save app preferences and some progress details on your device. Signed-in features may also sync selected progress data to our servers so you can use the dashboard, partner sync, PDFs, Robin, and messages. We use essential cookies for website functionality and may use analytics cookies to understand how visitors interact with the website.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Ads, Sponsors, Affiliates, and Messages</h2>
              <p className="text-slate-700 leading-relaxed">
                Spouse Interview may be supported by ads, sponsor placements, affiliate links, and messages from Spouse Interview. These placements may be hidden until they are approved and enabled. When active, we and our service providers may process information such as page views, message deliveries, opens, clicks, dismissals, referrers, device/browser details, and approximate location derived from IP address. Sponsored resources should be clearly labeled so users can distinguish them from personal support replies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Third-Party Services</h2>
              <p className="text-slate-700 leading-relaxed">
                We may use third-party service providers to help us operate the app, including hosting, authentication, email delivery, analytics, AI providers, ad networks, sponsor or affiliate platforms, and abuse prevention tools. These providers may access information only as needed to perform services for us or as described in their own terms and privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Data Security</h2>
              <p className="text-slate-700 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information. However, please be aware that no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Your Rights</h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-slate-700">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure (&ldquo;right to be forgotten&rdquo;)</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
              </ul>
              <p className="text-slate-700 leading-relaxed mt-3">
                To exercise these rights, please contact us using the information provided below.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Children&apos;s Privacy</h2>
              <p className="text-slate-700 leading-relaxed">
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn we have collected personal information from a child under 13, we will delete that information as quickly as possible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Changes to This Policy</h2>
              <p className="text-slate-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo; date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Contact Us
              </h2>
              <p className="text-slate-700 leading-relaxed mb-3">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <div className="bg-slate-100 rounded-lg p-4">
                <p className="text-slate-700"><strong>Email:</strong> privacy@spouseinterview.com</p>
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
