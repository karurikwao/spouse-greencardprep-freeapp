/**
* Partner Sync Module
* Allows couples to study together and track each other's progress
*/

import { apiClient } from '@/lib/apiClient';
import type { ComfortStatus } from './types';

// Types
export interface PartnerConnection {
id: string;
userId: string;
partnerId: string;
status: 'pending' | 'connected' | 'disconnected';
partnerEmail: string;
partnerName?: string;
createdAt: string;
}

export interface PartnerProgress {
userId: string;
partnerId: string;
questionStates: Record<string, {
comfortStatus: ComfortStatus;
isSavedForLater: boolean;
}>;
currentTopic: string | null;
lastUpdated: string;
}

export interface SyncSettings {
shareProgress: boolean;
shareSavedQuestions: boolean;
shareStats: boolean;
allowPartnerToSeeAnswers: boolean;
}

const DEFAULT_SETTINGS: SyncSettings = {
shareProgress: true,
shareSavedQuestions: true,
shareStats: true,
allowPartnerToSeeAnswers: false,
};

/**
* Send a partner connection request
*/
export async function sendPartnerRequest(
partnerEmail: string
): Promise<{ success: boolean; error?: string }> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) return { success: false, error: 'Not authenticated' };

  // Check if partner exists
  const { data: partnerData } = await apiClient
    .from('users')
    .select('id, email')
    .eq('email', partnerEmail)
    .single();

  const partner = partnerData as Record<string, unknown> | null;

  if (!partner) {
    return { success: false, error: 'User not found. They need to create an account first.' };
  }

  // Check if already connected - two queries to replace .or()
  const { data: asUser } = await apiClient
    .from('partner_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('partner_id', partner.id)
    .single();

  const { data: asPartner } = await apiClient
    .from('partner_connections')
    .select('*')
    .eq('user_id', partner.id as string)
    .eq('partner_id', user.id)
    .single();

  if (asUser || asPartner) {
    return { success: false, error: 'Connection already exists' };
  }

  // Create connection request
  const { error } = await apiClient
    .from('partner_connections')
    .insert({
      user_id: user.id,
      partner_id: partner.id as string,
status: 'pending',
partner_email: partnerEmail,
});

if (error) throw error;

return { success: true };
} catch (error) {
console.error('Error sending partner request:', error);
return { success: false, error: 'Failed to send request' };
}
}

/**
* Accept a partner connection request
*/
export async function acceptPartnerRequest(
connectionId: string
): Promise<{ success: boolean; error?: string }> {
try {
const { error } = await apiClient
.from('partner_connections')
.update({ status: 'connected', accepted_at: new Date().toISOString() })
.eq('id', connectionId);

if (error) throw error;
return { success: true };
} catch (error) {
console.error('Error accepting partner request:', error);
return { success: false, error: 'Failed to accept request' };
}
}

/**
* Get current partner connection
*/
export async function getPartnerConnection(): Promise<PartnerConnection | null> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) return null;

  // Two queries to replace .or()
  const { data: asUserData } = await apiClient
    .from('partner_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'connected');

  const { data: asPartnerData } = await apiClient
    .from('partner_connections')
    .select('*')
    .eq('partner_id', user.id)
    .eq('status', 'connected');

  const asUser = (asUserData ?? []) as Record<string, unknown>[];
  const asPartner = (asPartnerData ?? []) as Record<string, unknown>[];
  const merged = [...asUser, ...asPartner];
  const data = merged[0] ?? null;

  if (!data) return null;

  return {
    id: data.id as string,
    userId: data.user_id as string,
    partnerId: data.partner_id as string,
    status: data.status as 'pending' | 'connected' | 'disconnected',
    partnerEmail: data.partner_email as string,
    partnerName: data.partner_name as string | undefined,
    createdAt: data.created_at as string,
  };
} catch (error) {
console.error('Error getting partner connection:', error);
return null;
}
}

/**
* Sync progress with partner
*/
export async function syncProgressWithPartner(
questionStates: Record<string, { comfortStatus: ComfortStatus; isSavedForLater: boolean }>,
currentTopic: string | null
): Promise<boolean> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) return false;

const { error } = await apiClient
.from('partner_progress')
.upsert({
user_id: user.id,
question_states: questionStates,
current_topic: currentTopic,
last_updated: new Date().toISOString(),
});

if (error) throw error;
return true;
} catch (error) {
console.error('Error syncing progress:', error);
return false;
}
}

/**
* Get partner's progress
*/
export async function getPartnerProgress(partnerId: string): Promise<PartnerProgress | null> {
try {
const { data } = await apiClient
.from('partner_progress')
.select('*')
.eq('user_id', partnerId)
.single();

  if (!data) return null;

  const d = data as Record<string, unknown>;

  return {
    userId: d.user_id as string,
    partnerId: partnerId,
    questionStates: d.question_states as Record<string, { comfortStatus: ComfortStatus; isSavedForLater: boolean }>,
    currentTopic: d.current_topic as string | null,
    lastUpdated: d.last_updated as string,
  };
} catch (error) {
console.error('Error getting partner progress:', error);
return null;
}
}

/**
* Get sync settings
*/
export async function getSyncSettings(): Promise<SyncSettings> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) return DEFAULT_SETTINGS;

const { data } = await apiClient
.from('partner_settings')
.select('*')
.eq('user_id', user.id)
.single();

  if (!data) return DEFAULT_SETTINGS;

  const d = data as Record<string, unknown>;

  return {
    shareProgress: (d.share_progress as boolean) ?? true,
    shareSavedQuestions: (d.share_saved_questions as boolean) ?? true,
    shareStats: (d.share_stats as boolean) ?? true,
    allowPartnerToSeeAnswers: (d.allow_partner_answers as boolean) ?? false,
  };
} catch (error) {
return DEFAULT_SETTINGS;
}
}

/**
* Update sync settings
*/
export async function updateSyncSettings(
settings: Partial<SyncSettings>
): Promise<boolean> {
try {
const { data: user } = await apiClient.auth.getUser();
if (!user) return false;

const { error } = await apiClient
.from('partner_settings')
.upsert({
user_id: user.id,
share_progress: settings.shareProgress,
share_saved_questions: settings.shareSavedQuestions,
share_stats: settings.shareStats,
allow_partner_answers: settings.allowPartnerToSeeAnswers,
updated_at: new Date().toISOString(),
});

if (error) throw error;
return true;
} catch (error) {
console.error('Error updating sync settings:', error);
return false;
}
}

/**
* Disconnect from partner
*/
export async function disconnectPartner(connectionId: string): Promise<boolean> {
try {
const { error } = await apiClient
.from('partner_connections')
.update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
.eq('id', connectionId);

if (error) throw error;
return true;
} catch (error) {
console.error('Error disconnecting partner:', error);
return false;
}
}

/**
* Compare progress with partner
*/
export function compareProgress(
myProgress: Record<string, { comfortStatus: ComfortStatus }>,
partnerProgress: Record<string, { comfortStatus: ComfortStatus }>
): {
bothComfortable: string[];
bothNeedPractice: string[];
iNeedPractice: string[];
partnerNeedsPractice: string[];
} {
const bothComfortable: string[] = [];
const bothNeedPractice: string[] = [];
const iNeedPractice: string[] = [];
const partnerNeedsPractice: string[] = [];

const allQuestions = new Set([
...Object.keys(myProgress),
...Object.keys(partnerProgress),
]);

for (const questionId of allQuestions) {
const myStatus = myProgress[questionId]?.comfortStatus;
const partnerStatus = partnerProgress[questionId]?.comfortStatus;

if (myStatus === 'understood' && partnerStatus === 'understood') {
bothComfortable.push(questionId);
} else if (myStatus === 'needs-practice' && partnerStatus === 'needs-practice') {
bothNeedPractice.push(questionId);
} else if (myStatus === 'needs-practice') {
iNeedPractice.push(questionId);
} else if (partnerStatus === 'needs-practice') {
partnerNeedsPractice.push(questionId);
}
}

return {
bothComfortable,
bothNeedPractice,
iNeedPractice,
partnerNeedsPractice,
};
}

// Database schema comments:
/*
-- Partner connections table
CREATE TABLE partner_connections (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
status TEXT CHECK (status IN ('pending', 'connected', 'disconnected')),
partner_email TEXT NOT NULL,
partner_name TEXT,
created_at TIMESTAMP DEFAULT NOW(),
accepted_at TIMESTAMP,
disconnected_at TIMESTAMP,
UNIQUE(user_id, partner_id)
);

-- Partner progress sharing table
CREATE TABLE partner_progress (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
question_states JSONB DEFAULT '{}',
current_topic TEXT,
last_updated TIMESTAMP DEFAULT NOW(),
UNIQUE(user_id)
);

-- Partner settings table
CREATE TABLE partner_settings (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
share_progress BOOLEAN DEFAULT true,
share_saved_questions BOOLEAN DEFAULT true,
share_stats BOOLEAN DEFAULT true,
allow_partner_answers BOOLEAN DEFAULT false,
updated_at TIMESTAMP DEFAULT NOW(),
UNIQUE(user_id)
);
*/
