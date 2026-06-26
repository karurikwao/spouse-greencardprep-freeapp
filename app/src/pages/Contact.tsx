import { ArrowLeft, Mail, MessageSquare, Send, HelpCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

const CONTACT_RECIPIENT = 'support@spouseinterview.com';

export function Contact() {
  const backHref = typeof window !== 'undefined' && localStorage.getItem('auth_token') ? '/dashboard' : '/';
  const backLabel = backHref === '/dashboard' ? 'Back to Dashboard' : 'Back to Home';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [notice, setNotice] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      `Name: ${formData.name}`,
      `Email: ${formData.email}`,
      '',
      formData.message,
    ].join('\n');
    const mailtoUrl = `mailto:${CONTACT_RECIPIENT}?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setNotice('Your email app should open with this message ready to send.');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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
              <Heart className="h-6 w-6 text-rose-500" />
              <span className="font-bold text-slate-900">Spouse Interview</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <MessageSquare className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Contact Us</h1>
          <p className="text-slate-600 max-w-lg mx-auto">
            Have questions, feedback, or need assistance? We&apos;re here to help! Reach out to us and we&apos;ll get back to you as soon as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="border-2 border-slate-200">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3 mx-auto">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Email Us</CardTitle>
              <CardDescription className="text-sm">
                <a href="mailto:hello@spouseinterview.com" className="text-blue-600 hover:underline font-medium">
                  hello@spouseinterview.com
                </a>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3 mx-auto">
                <HelpCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-lg">Support</CardTitle>
              <CardDescription className="text-sm">
                <a href="mailto:support@spouseinterview.com" className="text-blue-600 hover:underline font-medium">
                  support@spouseinterview.com
                </a>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-slate-200">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-3 mx-auto">
                <Send className="h-6 w-6 text-amber-600" />
              </div>
              <CardTitle className="text-lg">Feedback</CardTitle>
              <CardDescription className="text-sm">
                <a href="mailto:feedback@spouseinterview.com" className="text-blue-600 hover:underline font-medium">
                  feedback@spouseinterview.com
                </a>
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-2 border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Send us a Message</CardTitle>
            <CardDescription>Fill out the form below and we&apos;ll respond within 24-48 hours.</CardDescription>
          </CardHeader>
          <CardContent>
            <>
              {notice && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                  {notice}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-semibold text-slate-700">Your Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      className="border-2 border-slate-300 focus:border-blue-500 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold text-slate-700">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                      className="border-2 border-slate-300 focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="font-semibold text-slate-700">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="How can we help?"
                    required
                    className="border-2 border-slate-300 focus:border-blue-500 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="font-semibold text-slate-700">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us more about your question or feedback..."
                    required
                    rows={5}
                    className="border-2 border-slate-300 focus:border-blue-500 font-medium resize-none"
                  />
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold py-3">
                  <Send className="mr-2 h-5 w-5" />
                  Send Message
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  This opens your email app so you can review and send the message. By contacting us, you agree to our{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> and{' '}
                  <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>.
                </p>
              </form>
            </>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-6">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">Is Spouse Interview really free?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 text-sm font-medium">
                  Yes! All our practice questions, sample answers, and tools are completely free. We believe everyone deserves access to quality interview preparation resources.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">Do I need to create an account?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 text-sm font-medium">
                  No account needed! Your progress is saved locally in your browser. You can use all features immediately without signing up.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">Can I use this on my phone?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 text-sm font-medium">
                  Absolutely! Spouse Interview is fully responsive and works great on mobile devices. You can even install it as an app on your home screen.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">How do I report a problem?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 text-sm font-medium">
                  If you encounter any issues, please email us at support@spouseinterview.com with details about the problem and we&apos;ll help you resolve it.
                </p>
              </CardContent>
            </Card>
          </div>
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
