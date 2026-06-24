import { apiClient } from '@/lib/apiClient';
import type { AdminSettings } from '@/data/admin';

export const supabase = apiClient;

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await apiClient.auth.signIn(email, password);
  if (data) {
    return { data: { user: data.user }, error: null };
  }
  return { data: { user: null }, error };
};

export const signOut = async () => {
  return apiClient.auth.signOut();
};

export const resetPassword = async (email: string) => {
  return apiClient.auth.resetPassword(email);
};

export const updatePassword = async (newPassword: string) => {
  return apiClient.auth.updatePassword(newPassword);
};

export const checkIsAdmin = async (): Promise<boolean> => {
  const { data: user } = await apiClient.auth.getUser();
  if (!user) return false;
  const { data, error } = await apiClient.rpc('is_admin', { uid: user.id });
  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
  return (data as boolean) || false;
};

export const getAdSettings = async (): Promise<AdminSettings | null> => {
  const { data, error } = await apiClient
    .from('ad_settings')
    .select('settings')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Error fetching ad settings:', error);
    return null;
  }

  return (data as Record<string, unknown>)?.settings as AdminSettings || null;
};

export const updateAdSettings = async (settings: AdminSettings): Promise<boolean> => {
  const { error } = await apiClient
    .from('ad_settings')
    .update({
      settings,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  if (error) {
    console.error('Error updating ad settings:', error);
    return false;
  }

  return true;
};

export const incrementDownload = async (): Promise<void> => {
  await apiClient.rpc('increment_download');
};

export const getDownloadStats = async () => {
  const { data, error } = await apiClient
    .from('download_stats')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Error fetching stats:', error);
    return null;
  }

  return data;
};

export const resetStats = async (): Promise<boolean> => {
  const { error } = await apiClient.rpc('reset_stats');
  if (error) {
    console.error('Error resetting stats:', error);
    return false;
  }
  return true;
};

export const onAuthStateChange = (_callback: (event: string, session: unknown) => void) => {
  return { data: { subscription: { unsubscribe: () => {} } } };
};
