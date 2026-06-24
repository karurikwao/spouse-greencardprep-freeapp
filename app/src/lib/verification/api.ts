/**
* Site Verification Code API
*
* Provides methods for managing and retrieving:
* - Head verification code
* - Footer verification code
* - Body-end verification code
*
* SECURITY NOTE: This is for trusted admin-entered code only.
* This is NOT for user-generated content.
*/

import { apiClient } from '@/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Types
// ============================================================================

export type VerificationPlacement = 'head' | 'footer' | 'body_end';
export type VerificationEnvironment = 'production' | 'test';

export interface VerificationCode {
id: string;
placement: VerificationPlacement;
code: string;
is_enabled: boolean;
notes: string | null;
environment: VerificationEnvironment;
created_by: string | null;
updated_by: string | null;
created_at: string;
updated_at: string;
}

export interface VerificationCodeInput {
placement: VerificationPlacement;
code: string;
is_enabled: boolean;
notes?: string;
environment?: VerificationEnvironment;
}

type VerificationCodeRpcValue =
| string
| null
| undefined
| {
  code?: unknown;
  html?: unknown;
  value?: unknown;
  get_verification_code?: unknown;
};

// ============================================================================
// Helper Functions
// ============================================================================

const PLACEMENT_LABELS: Record<VerificationPlacement, string> = {
head: 'Head Section (<head>)',
footer: 'Footer (before </body>)',
body_end: 'Body End (end of <body>)',
};

const PLACEMENT_DESCRIPTIONS: Record<VerificationPlacement, string> = {
head: 'Code injected into the HTML <head> section. Good for meta tags, analytics scripts, and CSS.',
footer: 'Code injected just before the closing </body> tag. Good for scripts that should load after content.',
body_end: 'Code injected at the very end of the body. Good for deferred loading or tracking pixels.',
};

const PLACEMENT_WARNINGS: Record<VerificationPlacement, string> = {
head: 'Warning: Code in <head> blocks page rendering. Keep it minimal and async when possible.',
footer: 'Warning: Code here runs after page content loads. Good for most scripts.',
body_end: 'Warning: Code here runs last. May miss early page events.',
};

export const getPlacementLabel = (placement: VerificationPlacement): string =>
PLACEMENT_LABELS[placement] || placement;

export const getPlacementDescription = (placement: VerificationPlacement): string =>
PLACEMENT_DESCRIPTIONS[placement] || '';

export const getPlacementWarning = (placement: VerificationPlacement): string =>
PLACEMENT_WARNINGS[placement] || '';

function coerceVerificationCode(value: VerificationCodeRpcValue | VerificationCodeRpcValue[]): string {
if (typeof value === 'string') {
return value;
}

if (Array.isArray(value)) {
return coerceVerificationCode(value[0]);
}

if (value && typeof value === 'object') {
const candidate = value.code ?? value.get_verification_code ?? value.html ?? value.value;
return typeof candidate === 'string' ? candidate : '';
}

return '';
}

// ============================================================================
// API Functions
// ============================================================================

/**
* Get all verification codes (admin only)
*/
export async function getAllVerificationCodes(
environment: VerificationEnvironment = 'production'
): Promise<VerificationCode[]> {
const { data, error } = await apiClient
.from('site_verification_codes')
.select('*')
.eq('environment', environment)
.order('placement', { ascending: true });

if (error) {
return [];
}

  return (data as VerificationCode[]) || [];
}

/**
* Get a single verification code by placement
*/
export async function getVerificationCode(
placement: VerificationPlacement,
environment: VerificationEnvironment = 'production'
): Promise<VerificationCode | null> {
const { data, error } = await apiClient
.from('site_verification_codes')
.select('*')
.eq('placement', placement)
.eq('environment', environment)
.single();

if (error) {
return null;
}

if (!data) {
return null;
}

return (Array.isArray(data) ? data[0] : data) as VerificationCode;
}

/**
* Get enabled verification code for a placement (public, for site rendering)
* Returns only the code string, or empty string if not enabled/empty
*/
export async function getEnabledVerificationCode(
placement: VerificationPlacement,
environment: VerificationEnvironment = 'production'
): Promise<string> {
try {
const response = await fetch(
`${API_URL}/api/verification-code/${encodeURIComponent(placement)}?environment=${encodeURIComponent(environment)}`
);
const payload = await response.json().catch(() => ({}));
if (response.ok) {
return typeof payload.code === 'string' ? payload.code : '';
}
} catch {
// Optional verification snippets should fail closed without noisy console errors.
}

const { data } = await apiClient
.rpc('get_verification_code', { placement, environment });

return coerceVerificationCode(data as VerificationCodeRpcValue | VerificationCodeRpcValue[]);
}

/**
* Update a verification code (admin only)
* Uses upsert - creates if doesn't exist, updates if exists
*/
export async function updateVerificationCode(
input: VerificationCodeInput
): Promise<{ success: boolean; error?: string }> {
const { error } = await apiClient
.rpc('upsert_verification_code', {
placement: input.placement,
code: input.code,
isEnabled: input.is_enabled,
notes: input.notes || null,
environment: input.environment || 'production',
});

if (error) {
console.error('Error updating verification code:', error);
return { success: false, error: error.message };
}

return { success: true };
}

/**
* Toggle enabled status for a verification code (admin only)
*/
export async function toggleVerificationCode(
placement: VerificationPlacement,
isEnabled: boolean,
environment: VerificationEnvironment = 'production'
): Promise<{ success: boolean; error?: string }> {
// First get current code
const current = await getVerificationCode(placement, environment);

if (!current) {
return { success: false, error: 'Verification code not found' };
}

return updateVerificationCode({
placement,
code: current.code,
is_enabled: isEnabled,
notes: current.notes || undefined,
environment,
});
}

/**
* Validate verification code input
* Returns validation errors or null if valid
*/
export function validateVerificationCode(
input: VerificationCodeInput
): string | null {
if (!input.placement) {
return 'Placement is required';
}

if (!['head', 'footer', 'body_end'].includes(input.placement)) {
return 'Invalid placement. Must be head, footer, or body_end';
}

if (input.is_enabled && !input.code?.trim()) {
return 'Code cannot be empty when enabled';
}

return null;
}

// ============================================================================
// Simple validation for common issues (not security - just helpful warnings)
// ============================================================================

export interface CodeValidationResult {
warnings: string[];
suggestions: string[];
}

/**
* Perform simple sanity checks on verification code
* This is NOT a security validator - it's for helpful admin warnings
*/
export function validateCodeContent(code: string, placement: VerificationPlacement): CodeValidationResult {
const warnings: string[] = [];
const suggestions: string[] = [];

if (!code.trim()) {
return { warnings, suggestions };
}

const lowerCode = code.toLowerCase();

// Check for script tags (expected, but warn if in head without async/defer)
if (lowerCode.includes('<script') && placement === 'head') {
if (!lowerCode.includes('async') && !lowerCode.includes('defer')) {
warnings.push('Script in <head> without async or defer may block page rendering');
suggestions.push('Add async or defer attributes to scripts in <head>');
}
}

// Check for document.write (generally discouraged)
if (lowerCode.includes('document.write')) {
warnings.push('document.write is generally discouraged and may cause issues');
}

// Suggest minification check
if (code.length > 5000 && !code.includes('min')) {
suggestions.push('Consider using minified versions of scripts for better performance');
}

// Check for inline styles (may be intentional, but worth noting)
if (lowerCode.includes('<style')) {
suggestions.push('Inline styles in verification code may override site styles');
}

return { warnings, suggestions };
}
