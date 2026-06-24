import { useState, useEffect } from 'react';
import { X, Timer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminSettings, AdNetwork } from '@/data/admin';

interface InterstitialAdProps {
  isOpen: boolean;
  onContinue: () => void;
  settings: AdminSettings;
  adNetwork?: AdNetwork;
}

export function InterstitialAd({ isOpen, onContinue, settings, adNetwork }: InterstitialAdProps) {
  const [countdown, setCountdown] = useState(settings.interstitialDelay);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    setCountdown(settings.interstitialDelay);
    setCanSkip(false);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, settings.interstitialDelay]);

  if (!isOpen) return null;

  // If ads are disabled or no network is selected, just show a simple "please wait" message
  if (!settings.adsEnabled || !adNetwork || settings.activeNetworks.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Preparing Your Download</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-600">Please wait while we prepare your PDF...</p>
            <Button onClick={onContinue} className="w-full bg-blue-600 hover:bg-blue-700">
              <Download className="mr-2 h-4 w-4" />
              Download Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderAdContent = () => {
    const config = settings.adConfigs[adNetwork];
    
    switch (adNetwork) {
      case 'adsense':
        return (
          <div className="ad-container">
            <ins
              className="adsbygoogle"
              style={{ display: 'block', minWidth: '300px', minHeight: '250px' }}
              data-ad-client={config.publisherId}
              data-ad-slot={config.slotId}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        );
      
      case 'medianet':
        return (
          <div className="ad-container">
            <div id={`medianet-${config.slotId}`} />
          </div>
        );
      
      case 'ezoic':
        return (
          <div className="ad-container">
            <div id={`ezoic-pub-ad-placeholder-${config.publisherId}`} />
          </div>
        );
      
      case 'monetag':
        return (
          <div className="ad-container">
            {config.scriptUrl && (
              <script 
                dangerouslySetInnerHTML={{ 
                  __html: `// Monetag ad script would be loaded here` 
                }} 
              />
            )}
            <div className="bg-slate-100 p-8 rounded-lg text-center">
              <p className="text-slate-500">Advertisement</p>
              <div className="h-64 flex items-center justify-center">
                <p className="text-slate-400 text-sm">Monetag Ad Placeholder</p>
              </div>
            </div>
          </div>
        );
      
      case 'propellerads':
        return (
          <div className="ad-container">
            <div className="bg-slate-100 p-8 rounded-lg text-center">
              <p className="text-slate-500">Advertisement</p>
              <div className="h-64 flex items-center justify-center">
                <p className="text-slate-400 text-sm">PropellerAds Placeholder</p>
              </div>
            </div>
          </div>
        );
      
      case 'adsterra':
        return (
          <div className="ad-container">
            <div className="bg-slate-100 p-8 rounded-lg text-center">
              <p className="text-slate-500">Advertisement</p>
              <div className="h-64 flex items-center justify-center">
                <p className="text-slate-400 text-sm">Adsterra Ad Placeholder</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="bg-slate-100 p-8 rounded-lg text-center">
            <p className="text-slate-500">Advertisement</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/95 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5 text-blue-500" />
            Please Wait
          </CardTitle>
          {canSkip && (
            <button 
              onClick={onContinue}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ad Content */}
          <div className="min-h-[250px] flex items-center justify-center">
            {renderAdContent()}
          </div>
          
          {/* Countdown / Skip Section */}
          <div className="text-center space-y-3">
            {!canSkip ? (
              <>
                <p className="text-slate-600">
                  Please wait <span className="font-bold text-blue-600 text-xl">{countdown}</span> seconds
                </p>
                <p className="text-sm text-slate-500">
                  Your download will be available shortly
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-600">
                  Thank you for your patience!
                </p>
                <Button 
                  onClick={onContinue}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Continue to Download
                </Button>
              </>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
              style={{ 
                width: `${((settings.interstitialDelay - countdown) / settings.interstitialDelay) * 100}%` 
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
