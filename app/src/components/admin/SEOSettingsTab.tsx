/**
 * SEO Settings Tab
 * 
 * Admin interface for configuring SEO-related settings.
 * Currently supports: Sitemap update frequency
 */

import { useState, useEffect } from 'react';
import { Globe, Save, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  getSEOSettingsAsync, 
  saveSitemapFrequency,
  getFrequencyOptions,
  type SitemapFrequency 
} from '@/lib/seo/settings';

export function SEOSettingsTab() {
  const [frequency, setFrequency] = useState<SitemapFrequency>('weekly');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Load current setting on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSEOSettingsAsync();
      setFrequency(settings.sitemapFrequency);
      setLastUpdated(new Date().toLocaleDateString());
    } catch (e) {
      console.error('Error loading SEO settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const success = await saveSitemapFrequency(frequency);
      
      setSaveStatus(success ? 'success' : 'error');
      
      if (success) {
        setLastUpdated(new Date().toLocaleDateString());
        // Clear status after 3 seconds
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (e) {
      console.error('Error saving sitemap frequency:', e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    await loadSettings();
  };

  const frequencyOptions = getFrequencyOptions();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-500">Loading settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-slate-600" />
        <div>
          <h2 className="text-xl font-medium text-slate-800">SEO Settings</h2>
          <p className="text-sm text-slate-500">
            Configure how search engines crawl and index your site
          </p>
        </div>
      </div>

      {/* Sitemap Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sitemap Configuration</CardTitle>
          <CardDescription>
            Control how often search engines should check for updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Frequency Selector */}
          <div className="space-y-3">
            <Label htmlFor="sitemap-frequency">Sitemap Update Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(value as SitemapFrequency)}
            >
              <SelectTrigger id="sitemap-frequency" className="w-full max-w-sm">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              This tells search engines how often your content changes. 
              Current: <span className="font-medium text-slate-700">{frequencyOptions.find(o => o.value === frequency)?.label}</span>
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">What does this do?</h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li><strong>Daily:</strong> Use if you add new questions every day</li>
              <li><strong>Weekly:</strong> Recommended for most sites (default)</li>
              <li><strong>Monthly:</strong> Use if content rarely changes</li>
            </ul>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-700 hover:bg-slate-800"
            >
              {isSaving ? (
                <>
                  <Save className="w-4 h-4 mr-2 animate-pulse" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>

            <Button 
              onClick={handleRefresh}
              variant="outline"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Settings saved to database!</span>
              </div>
            )}
          </div>

          {/* Status Alert */}
          {saveStatus === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Failed to save settings. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Sitemap Frequency</span>
              <span className="font-medium text-slate-800">
                {frequencyOptions.find(o => o.value === frequency)?.label}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">Last Updated</span>
              <span className="font-medium text-slate-800">
                {lastUpdated || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600">Storage Location</span>
              <span className="font-medium text-emerald-700">Database (PostgreSQL)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note about build */}
      <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg">
        <p className="font-medium text-slate-700 mb-1">Note for Developers</p>
        <p>
          These settings are stored in the database and will persist across all users and sessions.
          The sitemap.xml file is generated at build time using this setting.
          For changes to take effect in production, a new build must be deployed after updating.
        </p>
      </div>
    </div>
  );
}
