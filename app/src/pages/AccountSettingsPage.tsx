/**
 * Account Settings Page
 * Allows users to manage their account:
 * - View/update profile info
 * - Change email
 * - Update password
 * - Delete/deactivate account
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  User, 
  Mail, 
  Lock, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string;
}

export function AccountSettingsPage() {
  const { user, signOut } = useAuth();
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    first_name: '',
    last_name: '',
    display_name: '',
    email: user?.email || '',
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [emailPendingConfirmation, setEmailPendingConfirmation] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Account deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
    checkEmailConfirmationStatus();
  }, []);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, display_name, email')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

    if (data) {
      const d = data as Record<string, unknown>;
      setProfile({
        first_name: (d.first_name as string) || '',
        last_name: (d.last_name as string) || '',
        display_name: (d.display_name as string) || '',
        email: user.email || (d.email as string) || '',
      });
    }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const checkEmailConfirmationStatus = async () => {
    // Check if there's a pending email change
  const { data: currentUser } = await supabase.auth.getUser();
  if ((currentUser as unknown as Record<string, unknown>)?.new_email) {
    setEmailPendingConfirmation(true);
    setEmailMessage({
      type: 'success',
      text: `A confirmation email has been sent. Please check your inbox to complete the change.`
    });
  }
  };

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoadingProfile(true);
    setProfileMessage(null);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          display_name: profile.display_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        setProfileMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        return;
      }

      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Change email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail) return;

    setIsLoadingEmail(true);
    setEmailMessage(null);

    try {
      const { error } = await supabase.auth.updateEmail(newEmail);

      if (error) {
        setEmailMessage({ type: 'error', text: error.message });
        return;
      }

      setEmailPendingConfirmation(true);
      setEmailMessage({
        type: 'success',
        text: `A confirmation email has been sent to ${newEmail}. Please check your inbox and click the confirmation link to complete the email change.`
      });
      setNewEmail('');
    } catch (err) {
      setEmailMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsLoadingEmail(false);
    }
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setIsLoadingPassword(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updatePassword(newPassword);

      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
        return;
      }

      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsLoadingPassword(false);
    }
  };

  // Account deactivation (soft delete)
  const handleDeactivateAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    if (!user) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Call the soft delete function
      const { data: deleteSuccess, error: deleteError } = await supabase.rpc(
        'soft_delete_user',
        { p_user_id: user.id }
      );

      if (deleteError || !deleteSuccess) {
        setDeleteError('Failed to deactivate account. Please try again or contact support.');
        return;
      }

      // Sign out the user
      await signOut();
      
      // Redirect to home
      window.location.href = '/';
    } catch (err) {
      setDeleteError('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGoBack = () => {
    window.history.back();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Please sign in to manage your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/'} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={handleGoBack}
          className="mb-4 -ml-2 text-slate-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-semibold text-slate-800 mb-6">Account Settings</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="danger" className="text-red-600 data-[state=active]:text-red-700">Danger</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {profileMessage && (
                    <Alert variant={profileMessage.type === 'success' ? 'default' : 'destructive'}
                           className={profileMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200' : ''}>
                      {profileMessage.type === 'success' ? 
                        <CheckCircle className="w-4 h-4 text-emerald-500" /> : 
                        <AlertCircle className="w-4 h-4" />
                      }
                      <AlertDescription className={profileMessage.type === 'success' ? 'text-emerald-800' : ''}>
                        {profileMessage.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input
                        id="first-name"
                        value={profile.first_name || ''}
                        onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input
                        id="last-name"
                        value={profile.last_name || ''}
                        onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name</Label>
                    <Input
                      id="display-name"
                      value={profile.display_name || ''}
                      onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                      placeholder="How you want to be called"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="bg-slate-700 hover:bg-slate-800"
                    disabled={isLoadingProfile}
                  >
                    {isLoadingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Change Email
                </CardTitle>
                <CardDescription>Update your email address</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Label className="text-slate-500 text-sm">Current Email</Label>
                    <p className="font-medium text-slate-800">{profile.email}</p>
                  </div>

                  {emailMessage && (
                    <Alert variant={emailMessage.type === 'success' ? 'default' : 'destructive'}
                           className={emailMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200' : ''}>
                      {emailMessage.type === 'success' ? 
                        <CheckCircle className="w-4 h-4 text-emerald-500" /> : 
                        <AlertCircle className="w-4 h-4" />
                      }
                      <AlertDescription className={emailMessage.type === 'success' ? 'text-emerald-800' : ''}>
                        {emailMessage.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  {!emailPendingConfirmation && (
                    <form onSubmit={handleChangeEmail} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-email">New Email Address</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="new.email@example.com"
                          required
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="bg-slate-700 hover:bg-slate-800"
                        disabled={isLoadingEmail || !newEmail}
                      >
                        {isLoadingEmail ? 'Sending...' : 'Change Email'}
                      </Button>

                      <p className="text-sm text-slate-500">
                        You will receive a confirmation email at the new address. 
                        Your email will not change until you click the confirmation link.
                      </p>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordMessage && (
                    <Alert variant={passwordMessage.type === 'success' ? 'default' : 'destructive'}
                           className={passwordMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200' : ''}>
                      {passwordMessage.type === 'success' ? 
                        <CheckCircle className="w-4 h-4 text-emerald-500" /> : 
                        <AlertCircle className="w-4 h-4" />
                      }
                      <AlertDescription className={passwordMessage.type === 'success' ? 'text-emerald-800' : ''}>
                        {passwordMessage.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">Must be at least 6 characters</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      minLength={6}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="bg-slate-700 hover:bg-slate-800"
                    disabled={isLoadingPassword || !newPassword || !confirmNewPassword}
                  >
                    {isLoadingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger Zone Tab */}
          <TabsContent value="danger">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Irreversible account actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-medium text-red-800 mb-2">Deactivate Account</h3>
                  <p className="text-sm text-red-600 mb-4">
                    This will deactivate your account and sign you out. Your data will be preserved 
                    but you will not be able to access it until you contact support to reactivate.
                  </p>
                  <p className="text-sm text-red-600 mb-4">
                    <strong>Note:</strong> This does not delete PDF files you already saved to your device.
                    If you have optional paid Robin credits, contact us before deactivating if you have
                    questions about unused credits.
                  </p>
                  <Button 
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deactivate Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Account Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Deactivate Account
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. Your account will be deactivated immediately.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {deleteError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}

              <div className="p-3 bg-slate-100 rounded text-sm space-y-2">
                <p><strong>What will happen:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>You will be signed out immediately</li>
                  <li>Your account will be marked as inactive</li>
                  <li>Your data will be preserved but inaccessible</li>
                  <li>You can contact support to reactivate</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong>DELETE</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="uppercase"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmation('');
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeactivateAccount}
                disabled={isDeleting || deleteConfirmation !== 'DELETE'}
              >
                {isDeleting ? 'Deactivating...' : 'Deactivate Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
