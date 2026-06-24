/**
 * Authentication Modal
 * Handles login, signup, and password reset
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, Tag, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useOptionalAuth } from '@/lib/auth/AuthContext';
import { 
  getStoredReferralCode, 
  storeReferralCode, 
  recordSignupEvent,
  validatePromoCode,
} from '@/lib/promo';
import { cn } from '@/lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
  onAuthenticated?: () => void;
}

interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = 'google-identity-services';

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Identity Services could not load.')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services could not load.'));
    document.head.appendChild(script);
  });
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login', onAuthenticated }: AuthModalProps) {
  const { signIn, signUp, signInWithGoogle, resetPassword, isAuthenticated } = useOptionalAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  
  // Promo code states
  const [promoCode, setPromoCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{ valid: boolean; message: string } | null>(null);
  
  // OAuth state
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const googleLoginButtonRef = useRef<HTMLDivElement | null>(null);
  const googleSignupButtonRef = useRef<HTMLDivElement | null>(null);

  const finishAuthenticated = useCallback(() => {
    if (onAuthenticated) {
      onAuthenticated();
      return;
    }
    onClose();
  }, [onAuthenticated, onClose]);

  useEffect(() => {
    const storedCode = getStoredReferralCode();
    if (storedCode) {
      setPromoCode(storedCode);
      // Auto-validate stored code
      validatePromoCode(storedCode).then((result) => {
        if (result.valid) {
          setCodeValidation({ valid: true, message: `${result.discount_percent}% discount applied!` });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setShowResetForm(false);
      setError(null);
      setSuccess(null);
    }
  }, [defaultTab, isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
    } else {
      finishAuthenticated();
    }
    
    setIsLoading(false);
  };

  const handlePromoCodeChange = async (value: string) => {
    setPromoCode(value.toUpperCase());
    setCodeValidation(null);
    
    if (value.length >= 3) {
      setIsValidatingCode(true);
      const result = await validatePromoCode(value);
      setIsValidatingCode(false);
      
      if (result.valid) {
        setCodeValidation({ valid: true, message: `${result.discount_percent}% discount applied!` });
        storeReferralCode(value);
      } else {
        setCodeValidation({ valid: false, message: 'Invalid promo code' });
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error, data } = await signUp(email, password, {
      first_name: firstName,
      last_name: lastName,
      promo_code: promoCode || undefined,
    });
    
    if (error) {
      setError(error.message);
    } else {
      // Record referral event if user was created and has promo code
      if (data?.user && promoCode) {
        await recordSignupEvent(data.user.id, {
          email,
          first_name: firstName,
          last_name: lastName,
        });
      }
      setSuccess('Account created. You are signed in and your progress can now sync across devices.');
      finishAuthenticated();
    }
    
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await resetPassword(resetEmail);
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password reset instructions sent to your email!');
    }
    
    setIsLoading(false);
  };

  const handleGoogleCredential = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential) {
      setError('Google did not return a sign-in credential. Please try again.');
      return;
    }

    setIsOAuthLoading(true);
    setError(null);

    const { error } = await signInWithGoogle(response.credential, {
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      promo_code: promoCode || undefined,
    });

    if (error) {
      setError(error.message);
    } else {
      finishAuthenticated();
    }

    setIsOAuthLoading(false);
  }, [finishAuthenticated, firstName, lastName, promoCode, signInWithGoogle]);

  useEffect(() => {
    if (!isOpen || !googleClientId) return;

    let cancelled = false;
    const renderGoogleButtons = async () => {
      try {
        await loadGoogleIdentityScript();
        if (cancelled || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
        });

        const renderInto = (element: HTMLDivElement | null, text: 'signin_with' | 'signup_with') => {
          if (!element || element.childElementCount > 0) return;
          window.google?.accounts.id.renderButton(element, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text,
            width: Math.min(Math.max(element.clientWidth || 320, 240), 380),
          });
        };

        renderInto(googleLoginButtonRef.current, 'signin_with');
        renderInto(googleSignupButtonRef.current, 'signup_with');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google sign-in could not load.');
        }
      }
    };

    void renderGoogleButtons();

    return () => {
      cancelled = true;
    };
  }, [activeTab, googleClientId, handleGoogleCredential, isOpen]);

  if (!isOpen) return null;

  // If already authenticated, show success message
  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-md overflow-hidden border-2 border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-sky-50 shadow-2xl shadow-emerald-200/70">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600" />
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-950 mb-2">You're signed in!</h2>
            <p className="text-slate-700 mb-4">Your progress will be saved to the cloud.</p>
            <Button onClick={finishAuthenticated} className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white hover:from-blue-800 hover:to-cyan-700">
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <Card className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(44rem,calc(100vw-1.5rem))] overflow-y-auto border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/95 to-cyan-50/80 shadow-2xl shadow-blue-200/70 sm:max-h-[calc(100dvh-3rem)]">
        <div className="h-1.5 bg-gradient-to-r from-blue-700 via-cyan-500 to-emerald-500" />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-500 hover:bg-white hover:text-slate-900"
        >
          <X className="w-5 h-5" />
        </button>

        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-950">
            {showResetForm ? 'Reset Password' : activeTab === 'signup' ? 'Sign up' : 'Sign in'}
          </CardTitle>
          <CardDescription className="text-slate-700">
            {showResetForm 
              ? 'Enter your email to receive reset instructions'
              : activeTab === 'signup'
                ? 'Save progress, use your dashboard, and keep practicing across devices'
                : 'Sign in to sync your progress across devices'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <AlertDescription className="text-emerald-800">{success}</AlertDescription>
            </Alert>
          )}

          {showResetForm ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="font-semibold text-slate-900">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="border-slate-300 bg-white pl-10 text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-md shadow-blue-200 hover:from-blue-800 hover:to-cyan-700"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <button
                type="button"
                onClick={() => setShowResetForm(false)}
                className="w-full text-center text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Back to login
              </button>
            </form>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
              <TabsList className="mb-6 grid h-12 w-full grid-cols-2 rounded-xl border border-blue-200 bg-blue-50/80 p-1 shadow-inner">
                <TabsTrigger
                  value="login"
                  className="rounded-lg text-base font-extrabold text-blue-900 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-700 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-200"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg text-base font-extrabold text-blue-900 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-700 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-200"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="font-semibold text-slate-900">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-slate-300 bg-white pl-10 text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="font-semibold text-slate-900">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border-slate-300 bg-white pl-10 pr-10 text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowResetForm(true)}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Forgot password?
                  </button>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-md shadow-blue-200 hover:from-blue-800 hover:to-cyan-700"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  {googleClientId && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <Separator className="w-full" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-blue-50 px-2 text-slate-600">Or continue with</span>
                        </div>
                      </div>
                      <div
                        ref={googleLoginButtonRef}
                        className="flex min-h-11 w-full items-center justify-center overflow-hidden rounded-md bg-white"
                        aria-busy={isOAuthLoading}
                      />
                    </>
                  )}

                  <p className="text-xs text-slate-600 text-center">
                    You can also use the app without signing in. Your data will be stored locally.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name" className="font-semibold text-slate-900">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="first-name"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="border-slate-300 bg-white pl-10 text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name" className="font-semibold text-slate-900">Last Name</Label>
                      <Input
                        id="last-name"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="font-semibold text-slate-900">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-slate-300 bg-white pl-10 text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="font-semibold text-slate-900">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border-slate-300 bg-white pl-10 pr-10 text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">Must be at least 6 characters</p>
                  </div>

                  {/* Promo Code Input */}
                  <div className="space-y-2">
                    <Label htmlFor="promo-code" className="font-semibold text-slate-900">Promo Code (Optional)</Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="promo-code"
                        type="text"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => handlePromoCodeChange(e.target.value)}
                        className={cn(
                          "border-slate-300 bg-white pl-10 uppercase text-slate-950 placeholder:text-slate-500 focus-visible:ring-blue-500",
                          codeValidation?.valid && "border-emerald-300 focus-visible:ring-emerald-200",
                          codeValidation && !codeValidation.valid && "border-amber-300 focus-visible:ring-amber-200"
                        )}
                        disabled={isValidatingCode}
                      />
                      {codeValidation?.valid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    {codeValidation && (
                      <p className={cn(
                        "text-xs",
                        codeValidation.valid ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {codeValidation.message}
                      </p>
                    )}
                    {!codeValidation && promoCode && promoCode.length < 3 && (
                      <p className="text-xs text-slate-600">
                        Enter a valid promo code for discount
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-md shadow-blue-200 hover:from-blue-800 hover:to-cyan-700"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing up...' : 'Sign Up'}
                  </Button>

                  {googleClientId && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <Separator className="w-full" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-blue-50 px-2 text-slate-600">Or sign up with</span>
                        </div>
                      </div>
                      <div
                        ref={googleSignupButtonRef}
                        className="flex min-h-11 w-full items-center justify-center overflow-hidden rounded-md bg-white"
                        aria-busy={isOAuthLoading}
                      />
                    </>
                  )}

                  <p className="text-xs text-slate-600 text-center">
                    By signing up, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
