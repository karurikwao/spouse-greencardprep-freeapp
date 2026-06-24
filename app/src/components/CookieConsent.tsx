import { useState, useEffect } from 'react';
import { Cookie, Check, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: true,
    functional: true
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show banner after a short delay
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      try {
        const saved = JSON.parse(consent);
        setPreferences(saved);
      } catch {
        // Invalid saved data, show banner again
        setShowBanner(true);
      }
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    const allEnabled: CookiePreferences = {
      essential: true,
      analytics: true,
      functional: true
    };
    savePreferences(allEnabled);
  };

  const acceptEssentialOnly = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      functional: false
    };
    savePreferences(essentialOnly);
  };

  const handlePreferenceChange = (key: keyof CookiePreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Main Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
        <Card className="max-w-4xl mx-auto bg-white border-2 border-slate-200 shadow-2xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Cookie className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-lg mb-1">We use cookies</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  We use cookies to enhance your experience, analyze site traffic, and improve our services. 
                  By clicking &ldquo;Accept All&rdquo;, you consent to our use of cookies. 
                  <a href="/privacy" className="text-blue-600 hover:underline ml-1 font-medium">Learn more</a>
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="font-semibold border-slate-300"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Preferences
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={acceptEssentialOnly}
                  className="font-semibold border-slate-300"
                >
                  Essential Only
                </Button>
                <Button 
                  size="sm"
                  onClick={acceptAll}
                  className="bg-blue-600 hover:bg-blue-700 font-semibold"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Accept All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cookie Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-amber-600" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Customize which cookies you want to allow. Essential cookies are always enabled.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Essential Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Label className="font-bold text-slate-900">Essential Cookies</Label>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Required</span>
                </div>
                <p className="text-sm text-slate-600">
                  These cookies are necessary for the website to function properly. They enable basic features like page navigation and access to secure areas.
                </p>
              </div>
              <Switch checked={true} disabled className="data-[state=checked]:bg-blue-600" />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 bg-white rounded-lg border-2 border-slate-200">
              <div className="flex-1">
                <Label className="font-bold text-slate-900 mb-1 block">Analytics Cookies</Label>
                <p className="text-sm text-slate-600">
                  Help us understand how visitors interact with our website by collecting and reporting information anonymously.
                </p>
              </div>
              <Switch 
                checked={preferences.analytics} 
                onCheckedChange={() => handlePreferenceChange('analytics')}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            {/* Functional Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 bg-white rounded-lg border-2 border-slate-200">
              <div className="flex-1">
                <Label className="font-bold text-slate-900 mb-1 block">Functional Cookies</Label>
                <p className="text-sm text-slate-600">
                  Enable enhanced functionality and personalization, such as remembering your preferences and progress.
                </p>
              </div>
              <Switch 
                checked={preferences.functional} 
                onCheckedChange={() => handlePreferenceChange('functional')}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowSettings(false)} className="font-semibold">
              Cancel
            </Button>
            <Button onClick={saveCustomPreferences} className="bg-blue-600 hover:bg-blue-700 font-semibold">
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Reopen cookie settings button component (can be placed in footer)
export function CookieSettingsButton() {
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: true,
    functional: true
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (consent) {
      try {
        setPreferences(JSON.parse(consent));
      } catch {
        // Invalid data
      }
    }
  }, []);

  const handlePreferenceChange = (key: keyof CookiePreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const savePreferences = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    setShowSettings(false);
  };

  return (
    <>
      <button 
        onClick={() => setShowSettings(true)}
        className="text-slate-400 hover:text-white transition-colors text-sm"
      >
        Cookie Settings
      </button>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-amber-600" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences at any time.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Label className="font-bold text-slate-900">Essential Cookies</Label>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Required</span>
                </div>
                <p className="text-sm text-slate-600">
                  Necessary for the website to function properly.
                </p>
              </div>
              <Switch checked={true} disabled className="data-[state=checked]:bg-blue-600" />
            </div>

            <div className="flex items-start justify-between gap-4 p-4 bg-white rounded-lg border-2 border-slate-200">
              <div className="flex-1">
                <Label className="font-bold text-slate-900 mb-1 block">Analytics Cookies</Label>
                <p className="text-sm text-slate-600">
                  Help us understand how visitors use our website.
                </p>
              </div>
              <Switch 
                checked={preferences.analytics} 
                onCheckedChange={() => handlePreferenceChange('analytics')}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            <div className="flex items-start justify-between gap-4 p-4 bg-white rounded-lg border-2 border-slate-200">
              <div className="flex-1">
                <Label className="font-bold text-slate-900 mb-1 block">Functional Cookies</Label>
                <p className="text-sm text-slate-600">
                  Remember your preferences and progress.
                </p>
              </div>
              <Switch 
                checked={preferences.functional} 
                onCheckedChange={() => handlePreferenceChange('functional')}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowSettings(false)} className="font-semibold">
              Cancel
            </Button>
            <Button onClick={savePreferences} className="bg-blue-600 hover:bg-blue-700 font-semibold">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
