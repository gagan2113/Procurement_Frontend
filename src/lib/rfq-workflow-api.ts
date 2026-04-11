const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
const API_PREFIX = "/api/v1";

type JsonRecord = Record<string, unknown>;

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: unknown;
}

export interface RfqWorkflow {
  rfq_id: string;
  rfq_number: string | null;
  status: string | null;
  actions_available: string[];
  public_link: string | null;
  [key: string]: unknown;
}

export interface RfqRecommendedVendor {
  vendor_id: string | null;
  vendor_name: string | null;
  performance_score: number | null;
  past_orders_count: number | null;
  preferred_tag: boolean | null;
  active_vendor: boolean | null;
  [key: string]: unknown;
}

export interface RfqDistributionStatus {
  vendor_id: string | null;
  vendor_name: string | null;
  email: string | null;
  email_status: string | null;
  portal_notification: string | null;
  sent_at: string | null;
  [key: string]: unknown;
}

export interface RfqListItem {
  rfq_id: string;
  rfq_number: string | null;
  status: string | null;
  actions_available: string[];
  pr_number: string | null;
  material: string | null;
  category: string | null;
  quantity: number | null;
  delivery_date: string | null;
  submission_deadline: string | null;
  vendors_invited_count: number | null;
  last_sent_at: string | null;
  public_link: string | null;
  pdf_available: boolean | null;
  pdf_download_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  [key: string]: unknown;
}

export interface RfqListData {
  count: number;
  rfqs: RfqListItem[];
}

export interface RfqDetailData extends RfqListItem {
  full_specs: unknown;
  scope_of_work: unknown;
  technical_specs: unknown;
  payment_terms: unknown;
  evaluation_criteria: unknown;
}

export interface RfqPublishResult {
  rfq_id: string | null;
  rfq_number: string | null;
  status: string | null;
  public_link: string | null;
  actions_available: string[];
  already_published: boolean;
  lifecycle_details: Array<{ label: string; value: string }>;
  raw: JsonRecord | null;
}

export interface RfqSendResult {
  rfq_id: string | null;
  status: string | null;
  distribution_statuses: RfqDistributionStatus[];
  raw: JsonRecord | null;
}

export class RfqWorkflowApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown = null) {
    super(message);
    this.name = "RfqWorkflowApiError";
    this.status = status;
    this.payload = payload;
  }
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toStringOrNull(item))
    .filter((item): item is string => Boolean(item));
}

function resolveUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }

  return `${API_BASE_URL}/${value}`;
}

function toStatusLabel(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readPayloadMessage(payload: unknown, status: number): string {
  if (isObject(payload)) {
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return `Request failed with status ${status}`;
}

function parseEnvelopePayload<T>(payload: unknown): ApiEnvelope<T> {
  if (isObject(payload) && "success" in payload && "data" in payload) {
    const success = Boolean(payload.success);
    return {
      success,
      message: typeof payload.message === "string" ? payload.message : success ? "Success" : "Request failed",
      data: payload.data as T,
      errors: payload.errors ?? null,
    };
  }

  return {
    success: true,
    message: "Success",
    data: payload as T,
    errors: null,
  };
}

async function parseError(response: Response): Promise<RfqWorkflowApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => "");
  }

  return new RfqWorkflowApiError(readPayloadMessage(payload, response.status), response.status, payload);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as unknown;
  const envelope = parseEnvelopePayload<T>(payload);

  if (!envelope.success) {
    throw new RfqWorkflowApiError(envelope.message || "Request failed", response.status, payload);
  }

  return envelope;
}

function extractPayloadData(payload: unknown): unknown {
  if (isObject(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
}

export function normalizeRfqWorkflowFromUnknown(raw: unknown, fallback: Partial<RfqWorkflow> | null = null): RfqWorkflow | null {
  const source = isObject(raw) ? raw : {};
  const fallbackSource = isObject(fallback) ? fallback : {};

  const rfq_id = toStringOrNull(source.rfq_id) || toStringOrNull(fallbackSource.rfq_id);
  if (!rfq_id) {
    return null;
  }

  const rfq_number = toStringOrNull(source.rfq_number) || toStringOrNull(fallbackSource.rfq_number);
  const status = toStringOrNull(source.status) || toStringOrNull(fallbackSource.status);

  const actions_available = [
    ...toStringArray(source.actions_available),
    ...toStringArray(source.actionsAvailable),
  ];

  const fallbackActions = toStringArray(fallbackSource.actions_available);
  const mergedActions = actions_available.length > 0 ? actions_available : fallbackActions;

  const public_link =
    toStringOrNull(source.public_link) ||
    toStringOrNull(source.publicUrl) ||
    toStringOrNull(fallbackSource.public_link) ||
    null;

  return {
    ...fallbackSource,
    ...source,
    rfq_id,
    rfq_number,
    status,
    actions_available: mergedActions,
    public_link,
  };
}

function normalizeRecommendedVendor(raw: unknown): RfqRecommendedVendor | null {
  if (!isObject(raw)) {
    return null;
  }

  const vendor_id = toStringOrNull(raw.vendor_id) || toStringOrNull(raw.id);
  const vendor_name = toStringOrNull(raw.vendor_name) || toStringOrNull(raw.name);
  const performance_score = toNumberOrNull(raw.performance_score);
  const past_orders_count = toNumberOrNull(raw.past_orders_count);
  const preferred_tag = toBooleanOrNull(raw.preferred_tag);
  const active_vendor = toBooleanOrNull(raw.active_vendor);

  return {
    ...raw,
    vendor_id,
    vendor_name,
    performance_score,
    past_orders_count,
    preferred_tag,
    active_vendor,
  };
}

function normalizeDistributionStatus(raw: unknown): RfqDistributionStatus | null {
  if (!isObject(raw)) {
    return null;
  }

  const vendor_id = toStringOrNull(raw.vendor_id) || toStringOrNull(raw.id);
  const vendor_name = toStringOrNull(raw.vendor_name) || toStringOrNull(raw.name);
  const email = toStringOrNull(raw.email);
  const email_status = toStringOrNull(raw.email_status);
  const portal_notification = toStringOrNull(raw.portal_notification);
  const sent_at = toStringOrNull(raw.sent_at) || toStringOrNull(raw.created_at) || toStringOrNull(raw.updated_at);

  return {
    ...raw,
    vendor_id,
    vendor_name,
    email,
    email_status,
    portal_notification,
    sent_at,
  };
}

function normalizeRfqListItem(raw: unknown, fallbackRfqId: string | null = null): RfqListItem | null {
  if (!isObject(raw)) {
    return null;
  }

  const rfq_id = toStringOrNull(raw.rfq_id) || fallbackRfqId;
  if (!rfq_id) {
    return null;
  }

  const actions_available = [
    ...toStringArray(raw.actions_available),
    ...toStringArray(raw.actionsAvailable),
  ];

  return {
    ...raw,
    rfq_id,
    rfq_number: toStringOrNull(raw.rfq_number),
    status: toStringOrNull(raw.status),
    actions_available,
    pr_number: toStringOrNull(raw.pr_number),
    material: toStringOrNull(raw.material),
    category: toStringOrNull(raw.category),
    quantity: toNumberOrNull(raw.quantity),
    delivery_date: toStringOrNull(raw.delivery_date),
    submission_deadline: toStringOrNull(raw.submission_deadline),
    vendors_invited_count: toNumberOrNull(raw.vendors_invited_count),
    last_sent_at: toStringOrNull(raw.last_sent_at),
    public_link: toStringOrNull(raw.public_link),
    pdf_available: toBooleanOrNull(raw.pdf_available),
    pdf_download_url: toStringOrNull(raw.pdf_download_url),
    created_at: toStringOrNull(raw.created_at),
    updated_at: toStringOrNull(raw.updated_at),
  };
}

function normalizeRfqListData(raw: unknown): RfqListData {
  if (Array.isArray(raw)) {
    const rfqs = raw
      .map((item) => normalizeRfqListItem(item))
      .filter((item): item is RfqListItem => Boolean(item));

    return {
      count: rfqs.length,
      rfqs,
    };
  }

  if (!isObject(raw)) {
    return {
      count: 0,
      rfqs: [],
    };
  }

  const rfqSource = Array.isArray(raw.rfqs)
    ? raw.rfqs
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  const rfqs = rfqSource
    .map((item) => normalizeRfqListItem(item))
    .filter((item): item is RfqListItem => Boolean(item));

  return {
    count: toNumberOrNull(raw.count) ?? rfqs.length,
    rfqs,
  };
}

function normalizeRfqDetailData(raw: unknown, fallbackRfqId: string): RfqDetailData {
  const source = isObject(raw) ? raw : {};

  const mergedSource = isObject(source.rfq)
    ? ({
      ...source.rfq,
      ...source,
    } as JsonRecord)
    : source;

  const base = normalizeRfqListItem(mergedSource, fallbackRfqId);

  if (!base) {
    return {
      rfq_id: fallbackRfqId,
      rfq_number: null,
      status: null,
      actions_available: [],
      pr_number: null,
      material: null,
      category: null,
      quantity: null,
      delivery_date: null,
      submission_deadline: null,
      vendors_invited_count: null,
      last_sent_at: null,
      public_link: null,
      pdf_available: null,
      pdf_download_url: null,
      created_at: null,
      updated_at: null,
      full_specs: null,
      scope_of_work: null,
      technical_specs: null,
      payment_terms: null,
      evaluation_criteria: null,
    };
  }

  const full_specs = mergedSource.full_specs ?? mergedSource.full_specifications ?? mergedSource.specs ?? null;
  const scope_of_work = mergedSource.scope_of_work ?? mergedSource.scope ?? null;
  const technical_specs = mergedSource.technical_specs ?? mergedSource.technical_specifications ?? null;
  const payment_terms = mergedSource.payment_terms ?? mergedSource.payment_term ?? null;
  const evaluation_criteria = mergedSource.evaluation_criteria ?? mergedSource.evaluation ?? null;

  return {
    ...base,
    full_specs,
    scope_of_work,
    technical_specs,
    payment_terms,
    evaluation_criteria,
  };
}

function extractLifecycleDetails(source: JsonRecord): Array<{ label: string; value: string }> {
  const details = new Map<string, string>();

  const addEntry = (label: string, value: unknown) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "string" && !value.trim()) {
      return;
    }

    const stringValue = typeof value === "string" ? value : String(value);
    details.set(label, stringValue);
  };

  const lifecycleSource = isObject(source.lifecycle_transition)
    ? source.lifecycle_transition
    : isObject(source.lifecycle)
      ? source.lifecycle
      : null;

  if (lifecycleSource) {
    for (const [key, value] of Object.entries(lifecycleSource)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        addEntry(toStatusLabel(key), value);
      }
    }
  }

  const directKeys = [
    "from_status",
    "to_status",
    "previous_status",
    "next_status",
    "transition",
    "published_at",
    "published_by",
  ];

  for (const key of directKeys) {
    addEntry(toStatusLabel(key), source[key]);
  }

  return Array.from(details.entries()).map(([label, value]) => ({ label, value }));
}

function normalizePublishResult(raw: unknown, alreadyPublished: boolean, currentWorkflow: RfqWorkflow | null = null): RfqPublishResult {
  const source = isObject(raw) ? raw : {};
  const fallbackWorkflow = currentWorkflow ?? null;

  const mergedWorkflow = normalizeRfqWorkflowFromUnknown(source.rfq_workflow ?? source, fallbackWorkflow);

  const status =
    toStringOrNull(source.status) ||
    mergedWorkflow?.status ||
    fallbackWorkflow?.status ||
    (alreadyPublished ? "open" : "draft");

  const public_link =
    toStringOrNull(source.public_link) ||
    mergedWorkflow?.public_link ||
    fallbackWorkflow?.public_link ||
    null;

  const actions_available =
    mergedWorkflow?.actions_available.length
      ? mergedWorkflow.actions_available
      : fallbackWorkflow?.actions_available ?? [];

  return {
    rfq_id: mergedWorkflow?.rfq_id || fallbackWorkflow?.rfq_id || null,
    rfq_number: mergedWorkflow?.rfq_number || fallbackWorkflow?.rfq_number || null,
    status,
    public_link,
    actions_available,
    already_published: alreadyPublished,
    lifecycle_details: extractLifecycleDetails(source),
    raw: isObject(raw) ? raw : null,
  };
}

function extractRecommendedVendors(raw: unknown): RfqRecommendedVendor[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeRecommendedVendor(item))
      .filter((item): item is RfqRecommendedVendor => Boolean(item));
  }

  if (!isObject(raw)) {
    return [];
  }

  const source = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.vendors)
      ? raw.vendors
      : Array.isArray(raw.recommended_vendors)
        ? raw.recommended_vendors
        : [];

  return source
    .map((item) => normalizeRecommendedVendor(item))
    .filter((item): item is RfqRecommendedVendor => Boolean(item));
}

function extractDistributionStatuses(raw: unknown): RfqDistributionStatus[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeDistributionStatus(item))
      .filter((item): item is RfqDistributionStatus => Boolean(item));
  }

  if (!isObject(raw)) {
    return [];
  }

  const source = Array.isArray(raw.distribution_statuses)
    ? raw.distribution_statuses
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.distributions)
        ? raw.distributions
        : [];

  return source
    .map((item) => normalizeDistributionStatus(item))
    .filter((item): item is RfqDistributionStatus => Boolean(item));
}

export function isRfqOpenStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "open";
}

export function toRfqStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return "Unknown";
  }

  const normalized = status.trim().toLowerCase();
  if (normalized === "open") {
    return "Open for Bidding";
  }

  if (normalized === "draft") {
    return "Draft";
  }

  return toStatusLabel(status);
}

interface ListRfqsParams {
  status?: string;
  search?: string;
}

export async function listRfqs(params: ListRfqsParams = {}): Promise<RfqListData> {
  const query = new URLSearchParams();

  if (params.status?.trim()) {
    query.set("status", params.status.trim());
  }

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await requestJson<unknown>(`${API_PREFIX}/rfq${suffix}`);
  return normalizeRfqListData(response.data);
}

export async function getRfqDetail(rfqId: string): Promise<RfqDetailData> {
  const response = await requestJson<unknown>(`${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}`);
  return normalizeRfqDetailData(response.data, rfqId);
}

export function getRfqPdfDownloadUrl(rfqId: string, pdfDownloadUrl: string | null | undefined): string {
  const candidate = toStringOrNull(pdfDownloadUrl) || `${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}/pdf`;
  return resolveUrl(candidate) || `${API_BASE_URL}${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}/pdf`;
}

export function getRfqPublicLink(publicLink: string | null | undefined): string | null {
  return resolveUrl(toStringOrNull(publicLink));
}

export async function getRfqRecommendedVendors(rfqId: string): Promise<RfqRecommendedVendor[]> {
  const response = await requestJson<unknown>(`${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}/vendors/recommended`);
  return extractRecommendedVendors(response.data);
}

export async function publishRfq(rfqId: string, currentWorkflow: RfqWorkflow | null = null): Promise<RfqPublishResult> {
  try {
    const response = await requestJson<unknown>(`${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}/publish`, {
      method: "POST",
    });

    return normalizePublishResult(response.data, false, currentWorkflow);
  } catch (error) {
    if (error instanceof RfqWorkflowApiError && error.status === 409) {
      return normalizePublishResult(extractPayloadData(error.payload), true, currentWorkflow);
    }

    throw error;
  }
}

export async function sendRfqToVendors(rfqId: string, vendorIds: string[]): Promise<RfqSendResult> {
  const response = await requestJson<unknown>(`${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}/send`, {
    method: "POST",
    body: JSON.stringify({ vendor_ids: vendorIds }),
  });

  const source = isObject(response.data) ? response.data : {};
  const statuses = extractDistributionStatuses(source);

  return {
    rfq_id: toStringOrNull(source.rfq_id) || rfqId,
    status: toStringOrNull(source.status),
    distribution_statuses: statuses,
    raw: isObject(response.data) ? response.data : null,
  };
}

export async function getRfqDistributionHistory(rfqId: string): Promise<RfqDistributionStatus[]> {
  const response = await requestJson<unknown>(`${API_PREFIX}/rfq/${encodeURIComponent(rfqId)}/distributions`);
  return extractDistributionStatuses(response.data);
}

export function getRfqWorkflowApiErrorMessage(error: unknown): string {
  if (error instanceof RfqWorkflowApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected RFQ workflow error";
}
