/**
* Authentication Context
* Manages user authentication state with apiClient
* Supports optional authentication - app works without login
*
* Improvements in this version:
* - Server-side admin verification via is_admin() RPC
* - Profile management methods
* - Periodic token validity checks with cross-tab sync
*/

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiClient } from '@/lib/apiClient';
import type { AuthUser, AuthSession } from '@/lib/apiClient';

// Role types
export type UserRole = 'user' | 'admin' | 'superadmin';

// User profile type
export interface UserProfile {
id: string;
user_id: string;
email: string;
first_name: string | null;
last_name: string | null;
display_name: string | null;
role: UserRole;
is_active: boolean;
created_at: string;
updated_at: string;
}

interface AuthContextType {
user: AuthUser | null;
session: AuthSession | null;
profile: UserProfile | null;
isLoading: boolean;
isAuthenticated: boolean;
isAdmin: boolean;
isSuperAdmin: boolean;
signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null; data: { user: AuthUser | null } }>;
signInWithGoogle: (credential: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null; data: { user: AuthUser | null } }>;
signOut: () => Promise<void>;
resetPassword: (email: string) => Promise<{ error: Error | null }>;
updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Note: Legacy superadmin emails are now in the database migration
// Primary authority is the database role in user_profiles table

const TOKEN_CHECK_INTERVAL = 30_000;

export function AuthProvider({ children }: { children: ReactNode }) {
const [user, setUser] = useState<AuthUser | null>(null);
const [session, setSession] = useState<AuthSession | null>(null);
const [profile, setProfile] = useState<UserProfile | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [isAdmin, setIsAdmin] = useState(false);
const [isSuperAdmin, setIsSuperAdmin] = useState(false);

// Fetch user profile and admin status
const fetchUserProfile = async (userId: string) => {
try {
const { data, error } = await apiClient
.from('user_profiles')
.select('*')
.eq('user_id', userId)
.single();

if (error) {
console.warn('Could not fetch user profile:', error);
return null;
}

return data as UserProfile;
} catch (err) {
console.error('Error fetching profile:', err);
return null;
}
};

// Check admin status via server-side RPC
const checkAdminStatus = async (userId: string): Promise<{ isAdmin: boolean; isSuperAdmin: boolean }> => {
try {
const { data: adminData, error: adminError } = await apiClient.rpc('is_admin', {
userId
});

const { data: superadminData, error: superadminError } = await apiClient.rpc('is_superadmin', {
userId
});

    if (!adminError && !superadminError) {
      return {
        isAdmin: (adminData as boolean) || false,
        isSuperAdmin: (superadminData as boolean) || false
      };
}

// Fall back to profile check
const profile = await fetchUserProfile(userId);
if (profile) {
return {
isAdmin: profile.role === 'admin' || profile.role === 'superadmin',
isSuperAdmin: profile.role === 'superadmin'
};
}
} catch (err) {
console.error('Error checking admin status:', err);
}

return { isAdmin: false, isSuperAdmin: false };
};

const loadSession = useCallback(async () => {
try {
const { data: session } = await apiClient.auth.getSession();
setSession(session);
setUser(session?.user ?? null);

if (session?.user) {
const profile = await fetchUserProfile(session.user.id);
setProfile(profile);

const adminStatus = await checkAdminStatus(session.user.id);
setIsAdmin(adminStatus.isAdmin);
setIsSuperAdmin(adminStatus.isSuperAdmin);
} else {
setProfile(null);
setIsAdmin(false);
setIsSuperAdmin(false);
}
} catch (error) {
console.error('Error loading session:', error);
setSession(null);
setUser(null);
setProfile(null);
setIsAdmin(false);
setIsSuperAdmin(false);
} finally {
setIsLoading(false);
}
}, []);

// Load user data on mount, set up token check interval and storage listener
useEffect(() => {
loadSession();

const intervalId = setInterval(() => {
loadSession();
}, TOKEN_CHECK_INTERVAL);

const handleStorageEvent = (event: StorageEvent) => {
if (['accessToken', 'refreshToken', 'auth_token', 'auth_refresh_token'].includes(event.key || '') || event.key === null) {
loadSession();
}
};

window.addEventListener('storage', handleStorageEvent);

return () => {
clearInterval(intervalId);
window.removeEventListener('storage', handleStorageEvent);
};
}, [loadSession]);

// Email/password sign in
const signIn = async (email: string, password: string) => {
const { error } = await apiClient.auth.signIn(email, password);
if (error) {
return { error: new Error(error.message) };
}
await loadSession();
return { error: null };
};

// Sign up with email/password
const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
const { data, error } = await apiClient.auth.signUp(email, password, metadata);
if (error) {
return { error: new Error(error.message), data: { user: null } };
}
await loadSession();
return { error: null, data: { user: data?.user ?? null } };
};

const signInWithGoogle = async (credential: string, metadata?: Record<string, unknown>) => {
const { data, error } = await apiClient.auth.signInWithGoogle(credential, metadata);
if (error) {
return { error: new Error(error.message), data: { user: null } };
}
await loadSession();
return { error: null, data: { user: data?.user ?? null } };
};

// Sign out
const signOut = async () => {
await apiClient.auth.signOut();
setSession(null);
setUser(null);
setProfile(null);
setIsAdmin(false);
setIsSuperAdmin(false);
};

// Request password reset email
const resetPassword = async (email: string) => {
const { error } = await apiClient.auth.resetPassword(email);
if (error) {
return { error: new Error(error.message) };
}
return { error: null };
};

// Update password (when user is logged in)
const updatePassword = async (newPassword: string) => {
const { error } = await apiClient.auth.updatePassword(newPassword);
if (error) {
return { error: new Error(error.message) };
}
return { error: null };
};

// Update email (sends confirmation)
const updateEmail = async (newEmail: string) => {
const { error } = await apiClient.auth.updateEmail(newEmail);
if (error) {
return { error: new Error(error.message) };
}
return { error: null };
};

// Update profile in database
const updateProfile = async (updates: Partial<UserProfile>) => {
if (!user) return { error: new Error('Not authenticated') };

const { error } = await apiClient
.from('user_profiles')
.update({
...updates,
updated_at: new Date().toISOString(),
})
.eq('user_id', user.id);

if (error) {
return { error: new Error(error.message) };
}

// Refresh profile after update
const profile = await fetchUserProfile(user.id);
setProfile(profile);

return { error: null };
};

// Manually refresh profile
const refreshProfile = async () => {
if (!user) return;
const profile = await fetchUserProfile(user.id);
setProfile(profile);
};

const value: AuthContextType = {
user,
session,
profile,
isLoading,
isAuthenticated: !!user,
isAdmin,
isSuperAdmin,
signIn,
signUp,
signInWithGoogle,
signOut,
resetPassword,
updatePassword,
updateEmail,
updateProfile,
refreshProfile,
};

return (
<AuthContext.Provider value={value}>
{children}
</AuthContext.Provider>
);
}

export function useAuth() {
const context = useContext(AuthContext);
if (context === undefined) {
throw new Error('useAuth must be used within an AuthProvider');
}
return context;
}

export function useOptionalAuth() {
const context = useContext(AuthContext);
if (context === undefined) {
return {
user: null,
session: null,
profile: null,
isLoading: false,
isAuthenticated: false,
isAdmin: false,
isSuperAdmin: false,
signIn: async () => ({ error: new Error('Auth not available') }),
signUp: async () => ({ error: new Error('Auth not available'), data: { user: null } }),
signInWithGoogle: async () => ({ error: new Error('Auth not available'), data: { user: null } }),
signOut: async () => {},
resetPassword: async () => ({ error: new Error('Auth not available') }),
updatePassword: async () => ({ error: new Error('Auth not available') }),
updateEmail: async () => ({ error: new Error('Auth not available') }),
updateProfile: async () => ({ error: new Error('Auth not available') }),
refreshProfile: async () => {},
};
}
return context;
}
