const API_URL = import.meta.env.VITE_API_URL || '';

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('auth_refresh_token');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('auth_token', access);
  localStorage.setItem('auth_refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh_token');
}

function normalizeApiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;

  const payload = body as Record<string, unknown>;
  const error = payload.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const errorPayload = error as Record<string, unknown>;
    for (const key of ['userMessage', 'message', 'detail', 'code']) {
      const value = errorPayload[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }

  for (const key of ['userMessage', 'message', 'detail']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return fallback;
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && token) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${getToken()}`;
        const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
        if (!retry.ok) {
          const body = await retry.json().catch(() => ({ error: retry.statusText }));
          return { data: null, error: { message: normalizeApiErrorMessage(body, retry.statusText), code: String(retry.status) } };
        }
        const body = await retry.json();
        return { data: body.data !== undefined ? body.data : body, error: null };
      }
      clearTokens();
      return { data: null, error: { message: 'Session expired', code: '401' } };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return { data: null, error: { message: normalizeApiErrorMessage(body, res.statusText), code: String(res.status) } };
    }

    const body = await res.json();
    return { data: body.data !== undefined ? body.data : body, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh, refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    const payload = body.data || body;
    const accessToken = payload.accessToken || payload.access_token;
    const refreshToken = payload.refreshToken || payload.refresh_token || refresh;
    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

type AuthSessionPayload = Partial<AuthSession> & {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

function normalizeAuthSession(data: AuthSessionPayload | null): AuthSession | null {
  if (!data?.user) return null;

  const accessToken = data.accessToken || data.access_token;
  const refreshToken = data.refreshToken || data.refresh_token || getRefreshToken();

  if (!accessToken || !refreshToken) return null;

  return {
    user: data.user,
    accessToken,
    refreshToken,
  };
}

const RETIRED_FREE_APP_FUNCTIONS = new Set([
  'create-checkout-session',
  'create-retention-checkout-session',
  'confirm-checkout-session',
  'create-customer-portal',
  'cancel-subscription',
  'resume-subscription',
  'request-refund',
  'support-ai-assist',
  'create-support-ticket',
  'admin-support-tickets',
  'admin-support-ticket-draft',
  'process-refund',
]);

export const apiClient = {
  auth: {
    async signIn(email: string, password: string) {
      const result = await request<AuthSessionPayload>('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const session = normalizeAuthSession(result.data);
      if (session) {
        setTokens(session.accessToken, session.refreshToken);
        return { data: session, error: null };
      }
      return result;
    },

    async signUp(email: string, password: string, metadata?: Record<string, unknown>) {
      const result = await request<AuthSessionPayload>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, metadata }),
      });
      const session = normalizeAuthSession(result.data);
      if (session) {
        setTokens(session.accessToken, session.refreshToken);
        return { data: session, error: null };
      }
      return result;
    },

    async signInWithGoogle(credential: string, metadata?: Record<string, unknown>) {
      const result = await request<AuthSessionPayload>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential, metadata }),
      });
      const session = normalizeAuthSession(result.data);
      if (session) {
        setTokens(session.accessToken, session.refreshToken);
        return { data: session, error: null };
      }
      return result;
    },

    async signOut() {
      const result = await request('/api/auth/signout', { method: 'POST' });
      clearTokens();
      return result;
    },

    async getSession() {
      const token = getToken();
      if (!token) return { data: null, error: null };
      const result = await request<AuthSessionPayload>('/api/auth/session', { method: 'GET' });
      const session = normalizeAuthSession(result.data);
      if (session) {
        setTokens(session.accessToken, session.refreshToken);
        return { data: session, error: null };
      }
      return { data: null, error: result.error };
    },

    async getUser() {
      if (!getToken()) return { data: null, error: null };
      return request<AuthUser>('/api/auth/user', { method: 'GET' });
    },

    async resetPassword(email: string) {
      return request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }),
      });
    },

    async updatePassword(newPassword: string) {
      const token = new URLSearchParams(window.location.search).get('token') || undefined;
      return request('/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword, token }),
      });
    },

    async updateEmail(newEmail: string) {
      return request('/api/auth/update-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail }),
      });
    },

    async deleteAccount() {
      return request('/api/auth/delete-account', { method: 'POST' });
    },
  },

  async rpc<T = unknown>(funcName: string, params: Record<string, unknown> = {}) {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        let camelKey = key;
        const snakeMap: Record<string, string> = {
          userId: 'p_user_id', contentType: 'p_content_type', contentId: 'p_content_id',
          placement: 'p_placement', notificationId: 'p_notification_id',
          code: 'p_code', promoCode: 'p_promo_code', referrer: 'p_referrer',
          landingPage: 'p_landing_page', eventType: 'p_event_type', metadata: 'p_metadata',
          broadcastId: 'p_broadcast_id', ticketId: 'p_ticket_id',
          adminUserId: 'p_admin_user_id', reply: 'p_reply',
          refundId: 'p_refund_id', adminNotes: 'p_admin_notes',
          candidateId: 'p_candidate_id', reviewStatus: 'p_review_status',
          reviewerNotes: 'p_reviewer_notes', approvedForPublication: 'p_approved_for_publication',
          slug: 'p_slug', status: 'p_status', includeInSitemap: 'p_include_in_sitemap',
          noindexOverride: 'p_noindex_override', notes: 'p_notes',
          provider: 'p_provider', model: 'p_model', topicId: 'p_topic_id',
          sessionId: 'p_session_id', turnCount: 'p_turn_count',
          subscriptionId: 'p_subscription_id', stripePaymentIntentId: 'p_stripe_payment_intent_id',
          stripeChargeId: 'p_stripe_charge_id', planType: 'p_plan_type',
          amount: 'p_amount', currency: 'p_currency', purchasedAt: 'p_purchased_at',
          daysSincePurchase: 'p_days_since_purchase', questionsCompleted: 'p_questions_completed',
          mockInterviewsCompleted: 'p_mock_interviews_completed', reason: 'p_reason',
          additionalComments: 'p_additional_comments',
          originalAnswer: 'p_original_answer', sanitizedAnswer: 'p_sanitized_answer',
          category: 'p_category', answerPattern: 'p_answer_pattern',
          qualityScore: 'p_quality_score', qualityReason: 'p_quality_reason',
          sourceSessionId: 'p_source_session_id', sourceTurnNumber: 'p_source_turn_number',
          questionId: 'p_question_id', questionSlug: 'p_question_slug',
          questionPrompt: 'p_question_prompt',
          isEnabled: 'p_is_enabled', environment: 'p_environment',
          pdfFilename: 'p_pdf_filename', pdfTitle: 'p_pdf_title',
          categoryId: 'p_category_id', downloadSource: 'p_download_source',
          eventStatus: 'p_event_status', sessionHash: 'p_session_hash',
          userAgentHash: 'p_user_agent_hash',
          userRole: 'p_user_role',
          groupKey: 'p_group_key',
          triggeredManually: 'p_triggered_manually',
          pagesConsidered: 'p_pages_considered', pagesPublished: 'p_pages_published',
          publishedSlugs: 'p_published_slugs', sitemapIncluded: 'p_sitemap_included',
          noindexRespected: 'p_noindex_respected', onlyApprovedPublished: 'p_only_approved_published',
          executionDurationMs: 'p_execution_duration_ms', errorMessage: 'p_error_message',
          triggeredBy: 'p_triggered_by', triggeredAt: 'p_triggered_at',
          error: 'p_error', source: 'p_source',
          trialEndsAt: 'p_trial_ends_at', currentPeriodEndsAt: 'p_current_period_ends_at',
          providerCustomerId: 'p_provider_customer_id', providerSubscriptionId: 'p_provider_subscription_id',
        };
        if (snakeMap[key]) {
          camelKey = snakeMap[key];
        } else if (key.startsWith('p_')) {
          camelKey = key;
        } else {
          camelKey = `p_${key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)}`;
        }
        mapped[camelKey] = value;
      }
    }
    return request<T>(`/api/rpc/${funcName}`, {
      method: 'POST',
      body: JSON.stringify(mapped),
    });
  },

  from(table: string) {
    const builder = {
      select(columns: string = '*') {
        return new TableQueryBuilder(API_URL, table, 'GET', columns);
      },
      insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
        const data = Array.isArray(rows) ? rows : [rows];
        return new TableQueryBuilder(API_URL, table, 'POST', undefined, data);
      },
      update(data: Record<string, unknown>) {
        return new TableQueryBuilder(API_URL, table, 'PATCH', undefined, data);
      },
      delete() {
        return new TableQueryBuilder(API_URL, table, 'DELETE');
      },
      upsert(data?: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        const rows = data ? (Array.isArray(data) ? data : [data]) : undefined;
        const qb = new TableQueryBuilder(API_URL, table, 'POST', undefined, rows);
        return qb.upsert(data, options);
      },
    };
    return builder;
  },

  async invokeFunction<T = unknown>(name: string, body: Record<string, unknown> = {}) {
    if (RETIRED_FREE_APP_FUNCTIONS.has(name)) {
      return {
        data: null,
        error: {
          message: 'This legacy payment, refund, or ticket workflow is retired in the free app.',
          code: 'FREE_APP_WORKFLOW_RETIRED',
        },
      } as { data: T | null; error: { message: string; code?: string } | null };
    }

    const routeMap: Record<string, string> = {
      'create-checkout-session': '/api/stripe/create-checkout-session',
      'create-retention-checkout-session': '/api/stripe/create-retention-checkout-session',
      'confirm-checkout-session': '/api/stripe/confirm-checkout-session',
      'create-customer-portal': '/api/stripe/create-customer-portal',
      'cancel-subscription': '/api/stripe/cancel-subscription',
      'resume-subscription': '/api/stripe/resume-subscription',
      'request-refund': '/api/stripe/request-refund',
      'generate-pdf-signed-url': '/api/pdf/generate-signed-url',
      'ai-interview-turn': '/api/ai/interview-turn',
      'dashboard-agent-question': '/api/ai/dashboard-agent',
      'dashboard-agent-history': '/api/ai/dashboard-agent/history',
      'support-ai-assist': '/api/ai/support-assist',
      'create-support-ticket': '/api/support/tickets',
      'admin-support-tickets': '/api/admin/support/tickets',
      'admin-support-ticket-draft': '/api/ai/support-ticket-draft',
      'process-refund': '/api/process-refund',
      'trigger-coolify-rebuild': '/api/rpc/trigger-rebuild',
      'admin-users': '/api/admin/users',
    };
    const route = routeMap[name] || `/api/invoke/${name}`;
    return request<T>(route, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  storage: {
    async from(_bucket: string) {
      return {
        async upload(_path: string, _fileBody: Blob | ArrayBuffer | string, _options?: Record<string, unknown>) {
          return { data: null, error: { message: 'Storage uploads not supported in API mode' } };
        },
        async download(_path: string) {
          return { data: null, error: { message: 'Storage downloads not supported in API mode' } };
        },
        async getPublicUrl(_path: string) {
          return { data: { publicUrl: '' }, error: null };
        },
      };
    },
  },

  getToken: getToken,
  setTokens: setTokens,
  clearTokens: clearTokens,
};

class TableQueryBuilder {
  private filters: Array<{ col: string; op: string; val: unknown }> = [];
  private orderCol?: string;
  private orderAsc = true;
  private limitCount?: number;
  private singleRow = false;
  private upsertConflict?: string;
  private apiUrl: string;
  private table: string;
  private method: string;
  private selectColumns?: string;
  private bodyData?: Record<string, unknown> | Record<string, unknown>[];

  constructor(
    apiUrl: string,
    table: string,
    method: string,
    selectColumns?: string,
    bodyData?: Record<string, unknown> | Record<string, unknown>[],
  ) {
    this.apiUrl = apiUrl;
    this.table = table;
    this.method = method;
    this.selectColumns = selectColumns;
    this.bodyData = bodyData;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push({ col, op: 'neq', val });
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push({ col, op: 'gt', val });
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push({ col, op: 'gte', val });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push({ col, op: 'lt', val });
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push({ col, op: 'lte', val });
    return this;
  }

  like(col: string, val: string) {
    this.filters.push({ col, op: 'like', val });
    return this;
  }

  ilike(col: string, val: string) {
    this.filters.push({ col, op: 'ilike', val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push({ col, op: 'in', val: vals });
    return this;
  }

  is(col: string, val: unknown) {
    this.filters.push({ col, op: 'is', val });
    return this;
  }

  or(_filter: string) {
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  upsert(data?: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    if (data) this.bodyData = Array.isArray(data) ? data : [data];
    this.upsertConflict = options?.onConflict;
    this.method = 'POST';
    return this;
  }

  async then<T = unknown[]>(
    resolve: (value: { data: T | null; error: { message: string; code?: string } | null }) => void,
    _reject: (reason: unknown) => void,
  ) {
    const result = await this.execute();
    resolve(result as { data: T | null; error: { message: string; code?: string } | null });
  }

  private async execute(): Promise<{ data: unknown; error: { message: string; code?: string } | null }> {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (this.selectColumns && this.method === 'GET') {
      params.set('select', this.selectColumns);
    }

  const eqFilters = this.filters.filter(f => f.op === 'eq');
  if (eqFilters.length === 1) {
    params.set('eq', eqFilters[0].col);
    params.set('eqValue', String(eqFilters[0].val));
  } else if (eqFilters.length > 1) {
    params.set('filters', JSON.stringify(eqFilters.map(f => ({ col: f.col, op: f.op, val: f.val }))));
  }

  const nonEqFilters = this.filters.filter(f => f.op !== 'eq');
  if (nonEqFilters.length > 0) {
    const existing = params.get('filters');
    const allFilters = existing ? JSON.parse(existing) : [];
    for (const f of nonEqFilters) {
      allFilters.push({ col: f.col, op: f.op, val: f.val });
    }
    params.set('filters', JSON.stringify(allFilters));
  }

    if (this.orderCol) {
      params.set('order', `${this.orderAsc ? '' : '-'}${this.orderCol}`);
    }
    if (this.limitCount) {
      params.set('limit', String(this.limitCount));
    }
  if (this.singleRow) {
    params.set('single', 'true');
  }

  if (this.upsertConflict !== undefined) {
    params.set('upsert', 'true');
    if (this.upsertConflict) {
      params.set('onConflict', this.upsertConflict);
    }
  }

  const qs = params.toString();
    const url = `${this.apiUrl}/api/table/${this.table}${qs ? `?${qs}` : ''}`;

    try {
      const res = await fetch(url, {
        method: this.method,
        headers,
        body: this.bodyData ? JSON.stringify(this.bodyData) : undefined,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        return { data: null, error: { message: normalizeApiErrorMessage(body, res.statusText), code: String(res.status) } };
      }

      const body = await res.json();
      return { data: body.data, error: null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } };
    }
  }
}

export { apiClient as default };
