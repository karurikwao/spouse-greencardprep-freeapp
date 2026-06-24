/**
 * Reset Password Page
 * Handles password reset flow after user clicks email link
 * Route: /reset-password
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);

  // Check for recovery token on mount
  useEffect(() => {
    const checkRecoveryToken = () => {
      try {
        const token = new URLSearchParams(window.location.search).get('token');

        if (token) {
          setHasRecoveryToken(true);
        } else {
          setError('Invalid reset link. Please request a password reset from the login page.');
          setHasRecoveryToken(false);
        }
      } catch {
        setError('Something went wrong. Please try again or request a new reset link.');
        setHasRecoveryToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    checkRecoveryToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await apiClient.auth.updatePassword(newPassword);

      if (updateError) {
        if (updateError.message.includes('expired') || updateError.message.includes('invalid')) {
          setError('This reset link has expired. Please request a new password reset.');
        } else {
          setError(updateError.message);
        }
        return;
      }

      // Success!
      setSuccess(true);
      
      // Clear the URL hash to prevent confusion
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    // Navigate to home and the login modal can be opened from there
    window.location.href = '/';
  };

  // Loading state while validating token
  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700"></div>
            </div>
            <p className="text-center text-slate-500 mt-4">Validating reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/expired token state
  if (!hasRecoveryToken && error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-slate-800">Reset Link Expired</CardTitle>
            <CardDescription>This password reset link is no longer valid</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="text-sm text-slate-500">
              Password reset links expire after a short time for security. Please request a new reset link from the login page.
            </p>
            <Button 
              onClick={handleGoToLogin}
              className="w-full bg-slate-700 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              Password Updated
            </CardTitle>
            <CardDescription>Your password has been successfully changed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <Button 
              onClick={handleGoToLogin}
              className="w-full bg-slate-700 hover:bg-slate-800"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main reset form
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl text-slate-800">Reset Your Password</CardTitle>
          <CardDescription>Enter a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Must be at least 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-slate-700 hover:bg-slate-800"
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>

            <button
              type="button"
              onClick={handleGoToLogin}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel and return to login
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
