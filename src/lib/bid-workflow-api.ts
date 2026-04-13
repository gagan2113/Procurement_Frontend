const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
const API_PREFIX = "/api/v1";

type JsonRecord = Record<string, unknown>;
type FileCollection = File | File[] | FileList;

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: unknown;
}

export interface BidVendorAiInsight {
  strengths: string[];
  risks: string[];
  recommendation: "Preferred" | "Consider" | "Avoid" | null;
  [key: string]: unknown;
}

export interface BidEvaluationBreakdown {
  price: number | null;
  quality: number | null;
  delivery: number | null;
  reliability: number | null;
  capability: number | null;
  risk: number | null;
  [key: string]: unknown;
}

export interface BidEvaluationItem {
  vendor_id: string | null;
  vendor_name: string | null;
  score: number | null;
  rank: number | null;
  recommendation: "Preferred" | "Consider" | "Avoid" | null;
  breakdown: BidEvaluationBreakdown;
  raw: JsonRecord | null;
  [key: string]: unknown;
}

export interface BidDocumentLinks {
  quotation_pdf_url: string | null;
  technical_sheet_url: string | null;
  compliance_documents_urls: string[];
  certifications_urls: string[];
}

export interface BidItem {
  bid_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  price: number | null;
  currency: string | null;
  lead_time: number | null;
  delivery_schedule: string | null;
  delivery_terms: string | null;
  payment_terms: string | null;
  validity: string | null;
  specification_compliance: string | null;
  document_status: string | null;
  document_summary: string | null;
  extracted_values: JsonRecord | null;
  compliance_score: number | null;
  reliability_score: number | null;
  capability_score: number | null;
  manual_override: boolean | null;
  score: number | null;
  rank: number | null;
  document_links: BidDocumentLinks;
  [key: string]: unknown;
}

export interface BidSnapshot {
  rfq_id: string | null;
  rfq_number: string | null;
  rfq_status: string | null;
  submission_deadline: string | null;
  deadline_expired: boolean;
  bids: BidItem[];
  evaluation: BidEvaluationItem[];
  ai_insights: Record<string, BidVendorAiInsight>;
  selected_vendor_id: string | null;
  selected_vendor_name: string | null;
  updated_at: string | null;
  raw: JsonRecord | null;
}

export interface BidWorkflowResult {
  message: string;
  snapshot: BidSnapshot;
}

export interface BidSubmissionsResult {
  message: string;
  rfq_id: string | null;
  rfq_number: string | null;
  rfq_status: string | null;
  updated_at: string | null;
  bids: BidItem[];
  raw: JsonRecord | null;
}

export interface VendorBidSubmissionInput {
  vendor_id: string;
  price: number | string;
  currency: string;
  lead_time: number | string;
  delivery_schedule: string;
  delivery_terms: string;
  payment_terms: string;
  validity: string;
  specification_compliance: string;
  quotation_pdf: File;
  technical_sheet: File;
  compliance_documents: FileCollection;
  certifications: FileCollection;
}

export interface ManualOverrideInput {
  vendor_id: string;
  reason?: string;
}

export interface SendForApprovalInput {
  vendor_id?: string;
  note?: string;
}

export class BidWorkflowApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown = null) {
    super(message);
    this.name = "BidWorkflowApiError";
    this.status = status;
    this.payload = payload;
  }
}

export const bidWorkflowQueryKeys = {
  all: ["bid-workflow"] as const,
  live: (rfqId: string) => ["bid-workflow", "live", rfqId] as const,
  submissions: (rfqId: string) => ["bid-workflow", "submissions", rfqId] as const,
};

const INTERNAL_ACCESS_HEADER = "x-internal-access";
const INTERNAL_ACCESS_VALUE = "true";

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
    .map((entry) => toStringOrNull(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeFileUrlArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const direct = toStringOrNull(value);
    return direct ? [direct] : [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return toStringOrNull(entry);
      }

      if (isObject(entry)) {
        return toStringOrNull(entry.url) || toStringOrNull(entry.file_url) || toStringOrNull(entry.path);
      }

      return null;
    })
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeRecommendation(value: unknown): "Preferred" | "Consider" | "Avoid" | null {
  const raw = toStringOrNull(value);
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  if (normalized === "preferred") {
    return "Preferred";
  }

  if (normalized === "consider") {
    return "Consider";
  }

  if (normalized === "avoid") {
    return "Avoid";
  }

  return null;
}

function parsePayloadMessage(payload: unknown, status: number) {
  if (isObject(payload)) {
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }

    if (Array.isArray(payload.detail)) {
      const validationMessage = payload.detail
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }

          if (isObject(entry) && typeof entry.msg === "string") {
            return entry.msg;
          }

          return null;
        })
        .filter((entry): entry is string => Boolean(entry))
        .join("; ");

      if (validationMessage) {
        return validationMessage;
      }
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

async function parseError(response: Response): Promise<BidWorkflowApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => "");
  }

  return new BidWorkflowApiError(parsePayloadMessage(payload, response.status), response.status, payload);
}

function normalizeBreakdown(raw: unknown): BidEvaluationBreakdown {
  const source = isObject(raw) ? raw : {};

  return {
    ...source,
    price: toNumberOrNull(source.price) ?? toNumberOrNull(source.price_score),
    quality: toNumberOrNull(source.quality) ?? toNumberOrNull(source.quality_score),
    delivery: toNumberOrNull(source.delivery) ?? toNumberOrNull(source.delivery_score),
    reliability: toNumberOrNull(source.reliability) ?? toNumberOrNull(source.reliability_score),
    capability: toNumberOrNull(source.capability) ?? toNumberOrNull(source.capability_score),
    risk: toNumberOrNull(source.risk) ?? toNumberOrNull(source.risk_score),
  };
}

function normalizeBidItem(raw: unknown): BidItem | null {
  if (!isObject(raw)) {
    return null;
  }

  const bid_id = toStringOrNull(raw.bid_id) || toStringOrNull(raw.id);
  const vendor_id = toStringOrNull(raw.vendor_id) || toStringOrNull(raw.vendor);
  const vendor_name = toStringOrNull(raw.vendor_name) || toStringOrNull(raw.name);

  const compliance_documents_urls = normalizeFileUrlArray(raw.compliance_documents_urls);
  const certifications_urls = normalizeFileUrlArray(raw.certifications_urls);

  const document_links: BidDocumentLinks = {
    quotation_pdf_url: toStringOrNull(raw.quotation_pdf_url) || toStringOrNull(raw.quotation_pdf),
    technical_sheet_url: toStringOrNull(raw.technical_sheet_url) || toStringOrNull(raw.technical_sheet),
    compliance_documents_urls: compliance_documents_urls.length > 0
      ? compliance_documents_urls
      : normalizeFileUrlArray(raw.compliance_documents),
    certifications_urls: certifications_urls.length > 0
      ? certifications_urls
      : normalizeFileUrlArray(raw.certifications),
  };

  return {
    ...raw,
    bid_id,
    vendor_id,
    vendor_name,
    price: toNumberOrNull(raw.price) ?? toNumberOrNull(raw.bid_price),
    currency: toStringOrNull(raw.currency),
    lead_time:
      toNumberOrNull(raw.lead_time) ??
      toNumberOrNull(raw.lead_time_days) ??
      toNumberOrNull(raw.delivery_days),
    delivery_schedule: toStringOrNull(raw.delivery_schedule),
    delivery_terms: toStringOrNull(raw.delivery_terms),
    payment_terms: toStringOrNull(raw.payment_terms),
    validity: toStringOrNull(raw.validity),
    specification_compliance: toStringOrNull(raw.specification_compliance),
    document_status: toStringOrNull(raw.document_status) || toStringOrNull(raw.processing_status),
    document_summary: toStringOrNull(raw.document_summary) || toStringOrNull(raw.summary),
    extracted_values:
      (isObject(raw.extracted_values) ? raw.extracted_values : null) ||
      (isObject(raw.extracted_fields) ? raw.extracted_fields : null),
    compliance_score:
      toNumberOrNull(raw.compliance_score) ??
      toNumberOrNull(raw.document_compliance_score),
    reliability_score: toNumberOrNull(raw.reliability_score),
    capability_score: toNumberOrNull(raw.capability_score),
    manual_override: toBooleanOrNull(raw.manual_override),
    score: toNumberOrNull(raw.score) ?? toNumberOrNull(raw.total_score),
    rank: toNumberOrNull(raw.rank),
    document_links,
  };
}

function normalizeEvaluationItem(raw: unknown): BidEvaluationItem | null {
  if (!isObject(raw)) {
    return null;
  }

  return {
    ...raw,
    vendor_id: toStringOrNull(raw.vendor_id) || toStringOrNull(raw.vendor),
    vendor_name: toStringOrNull(raw.vendor_name),
    score: toNumberOrNull(raw.score) ?? toNumberOrNull(raw.total_score),
    rank: toNumberOrNull(raw.rank),
    recommendation: normalizeRecommendation(raw.recommendation),
    breakdown: normalizeBreakdown(raw.breakdown),
    raw,
  };
}

function normalizeEvaluation(raw: unknown): BidEvaluationItem[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => normalizeEvaluationItem(entry))
      .filter((entry): entry is BidEvaluationItem => Boolean(entry));
  }

  if (!isObject(raw)) {
    return [];
  }

  if (Array.isArray(raw.items)) {
    return raw.items
      .map((entry) => normalizeEvaluationItem(entry))
      .filter((entry): entry is BidEvaluationItem => Boolean(entry));
  }

  return Object.entries(raw)
    .map(([vendorId, value]) => {
      if (!isObject(value)) {
        return null;
      }

      return normalizeEvaluationItem({ vendor_id: vendorId, ...value });
    })
    .filter((entry): entry is BidEvaluationItem => Boolean(entry));
}

function normalizeAiInsights(raw: unknown): Record<string, BidVendorAiInsight> {
  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, BidVendorAiInsight>>((accumulator, entry) => {
      if (!isObject(entry)) {
        return accumulator;
      }

      const vendorId = toStringOrNull(entry.vendor_id);
      if (!vendorId) {
        return accumulator;
      }

      accumulator[vendorId] = {
        ...entry,
        strengths: toStringArray(entry.strengths),
        risks: toStringArray(entry.risks),
        recommendation: normalizeRecommendation(entry.recommendation),
      };

      return accumulator;
    }, {});
  }

  if (!isObject(raw)) {
    return {};
  }

  const insights: Record<string, BidVendorAiInsight> = {};

  for (const [vendorId, value] of Object.entries(raw)) {
    if (!isObject(value)) {
      continue;
    }

    insights[vendorId] = {
      ...value,
      strengths: toStringArray(value.strengths),
      risks: toStringArray(value.risks),
      recommendation: normalizeRecommendation(value.recommendation),
    };
  }

  return insights;
}

function extractSnapshotPayload(rawData: unknown): unknown {
  if (!isObject(rawData)) {
    return rawData;
  }

  if (isObject(rawData.snapshot)) {
    return rawData.snapshot;
  }

  return rawData;
}

function extractBids(rawData: unknown): BidItem[] {
  if (Array.isArray(rawData)) {
    return rawData
      .map((item) => normalizeBidItem(item))
      .filter((item): item is BidItem => Boolean(item));
  }

  if (!isObject(rawData)) {
    return [];
  }

  const source = Array.isArray(rawData.bids)
    ? rawData.bids
    : Array.isArray(rawData.items)
      ? rawData.items
      : Array.isArray(rawData.submissions)
        ? rawData.submissions
        : [];

  return source
    .map((item) => normalizeBidItem(item))
    .filter((item): item is BidItem => Boolean(item));
}

function normalizeSnapshot(rawData: unknown, rfqIdFallback: string): BidSnapshot {
  const source = isObject(rawData) ? rawData : {};
  const rfq = isObject(source.rfq) ? source.rfq : {};

  return {
    rfq_id: toStringOrNull(source.rfq_id) || toStringOrNull(rfq.rfq_id) || rfqIdFallback,
    rfq_number: toStringOrNull(source.rfq_number) || toStringOrNull(rfq.rfq_number),
    rfq_status: toStringOrNull(source.rfq_status) || toStringOrNull(source.status) || toStringOrNull(rfq.status),
    submission_deadline: toStringOrNull(source.submission_deadline) || toStringOrNull(rfq.submission_deadline),
    deadline_expired: toBooleanOrNull(source.deadline_expired) ?? toBooleanOrNull(rfq.deadline_expired) ?? false,
    bids: extractBids(source),
    evaluation: normalizeEvaluation(source.evaluation),
    ai_insights: normalizeAiInsights(source.ai_insights),
    selected_vendor_id: toStringOrNull(source.selected_vendor_id),
    selected_vendor_name: toStringOrNull(source.selected_vendor_name),
    updated_at: toStringOrNull(source.updated_at),
    raw: source,
  };
}

function normalizeSubmissions(rawData: unknown, rfqIdFallback: string, message: string): BidSubmissionsResult {
  const source = isObject(rawData) ? rawData : {};
  const rfq = isObject(source.rfq) ? source.rfq : {};

  return {
    message,
    rfq_id: toStringOrNull(source.rfq_id) || toStringOrNull(rfq.rfq_id) || rfqIdFallback,
    rfq_number: toStringOrNull(source.rfq_number) || toStringOrNull(rfq.rfq_number),
    rfq_status: toStringOrNull(source.rfq_status) || toStringOrNull(source.status) || toStringOrNull(rfq.status),
    updated_at: toStringOrNull(source.updated_at),
    bids: extractBids(source),
    raw: source,
  };
}

function withInternalHeader(headers: Headers, internalAccess: boolean) {
  if (internalAccess) {
    headers.set(INTERNAL_ACCESS_HEADER, INTERNAL_ACCESS_VALUE);
  }
}

async function requestData(path: string, init: RequestInit = {}, internalAccess = false): Promise<{ message: string; data: unknown }> {
  const headers = new Headers(init.headers);

  withInternalHeader(headers, internalAccess);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
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

  if (isObject(payload) && "success" in payload && "data" in payload) {
    const envelope = payload as ApiEnvelope<unknown>;
    if (!envelope.success) {
      throw new BidWorkflowApiError(envelope.message || "Request failed", response.status, payload);
    }

    return {
      message: envelope.message || "Success",
      data: envelope.data,
    };
  }

  return {
    message: "Success",
    data: payload,
  };
}

async function requestSnapshot(path: string, rfqId: string, init: RequestInit = {}, internalAccess = false): Promise<BidWorkflowResult> {
  const result = await requestData(path, init, internalAccess);
  const snapshotPayload = extractSnapshotPayload(result.data);

  return {
    message: result.message,
    snapshot: normalizeSnapshot(snapshotPayload, rfqId),
  };
}

async function requestSubmissions(path: string, rfqId: string, init: RequestInit = {}, internalAccess = false): Promise<BidSubmissionsResult> {
  const result = await requestData(path, init, internalAccess);

  if (Array.isArray(result.data)) {
    return normalizeSubmissions({ bids: result.data }, rfqId, result.message);
  }

  return normalizeSubmissions(result.data, rfqId, result.message);
}

function toFileArray(value: FileCollection): File[] {
  if (value instanceof File) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is File => entry instanceof File);
  }

  return Array.from(value).filter((entry): entry is File => entry instanceof File);
}

function appendRequiredFile(formData: FormData, fieldName: string, file: File | null | undefined) {
  if (file instanceof File) {
    formData.append(fieldName, file);
  }
}

function appendFileCollection(formData: FormData, fieldName: string, files: FileCollection) {
  toFileArray(files).forEach((file) => formData.append(fieldName, file));
}

function buildVendorBidFormData(input: VendorBidSubmissionInput): FormData {
  const formData = new FormData();

  formData.append("vendor_id", input.vendor_id.trim());
  formData.append("price", String(input.price));
  formData.append("currency", input.currency.trim());
  formData.append("lead_time", String(input.lead_time));
  formData.append("delivery_schedule", input.delivery_schedule.trim());
  formData.append("delivery_terms", input.delivery_terms.trim());
  formData.append("payment_terms", input.payment_terms.trim());
  formData.append("validity", input.validity.trim());
  formData.append("specification_compliance", input.specification_compliance.trim());

  appendRequiredFile(formData, "quotation_pdf", input.quotation_pdf);
  appendRequiredFile(formData, "technical_sheet", input.technical_sheet);
  appendFileCollection(formData, "compliance_documents", input.compliance_documents);
  appendFileCollection(formData, "certifications", input.certifications);

  return formData;
}

function normalizeActionPayload(payload: JsonRecord): JsonRecord {
  const next: JsonRecord = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    next[key] = value;
  }

  return next;
}

function hasDeadlineExpiredFlag(payload: unknown): boolean {
  if (!isObject(payload)) {
    return false;
  }

  if (toBooleanOrNull(payload.deadline_expired) === true) {
    return true;
  }

  if (isObject(payload.data) && toBooleanOrNull(payload.data.deadline_expired) === true) {
    return true;
  }

  return false;
}

function messageContains(error: BidWorkflowApiError, token: string): boolean {
  return error.message.toLowerCase().includes(token.toLowerCase());
}

export function isRfqClosedStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "closed";
}

export function isRfqOpenStatus(status: string | null | undefined): boolean {
  if (typeof status !== "string") {
    return false;
  }

  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "open" || normalized === "open_for_bidding";
}

export function isBidDeadlineExpiredError(error: unknown): boolean {
  if (!(error instanceof BidWorkflowApiError)) {
    return false;
  }

  if (hasDeadlineExpiredFlag(error.payload)) {
    return true;
  }

  return messageContains(error, "deadline") && (messageContains(error, "expired") || messageContains(error, "passed"));
}

export function isBidRfqNotOpenError(error: unknown): boolean {
  if (!(error instanceof BidWorkflowApiError)) {
    return false;
  }

  return messageContains(error, "open") && (messageContains(error, "rfq") || messageContains(error, "bidding"));
}

export function isBidInternalAccessError(error: unknown): boolean {
  if (!(error instanceof BidWorkflowApiError)) {
    return false;
  }

  if (error.status === 403) {
    return true;
  }

  return messageContains(error, "internal") || messageContains(error, "x-internal-access");
}

export async function submitVendorBidForRfq(rfqId: string, input: VendorBidSubmissionInput) {
  const formData = buildVendorBidFormData(input);

  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/submit`, rfqId, {
    method: "POST",
    body: formData,
  });
}

export async function listBidSubmissions(rfqId: string) {
  return requestSubmissions(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/submissions`, rfqId, {}, true);
}

export async function evaluateBidForRfq(rfqId: string) {
  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/evaluate`, rfqId, {
    method: "POST",
  }, true);
}

export async function getLiveBidSnapshot(rfqId: string) {
  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/live`, rfqId, {}, true);
}

export async function manualOverrideBidForRfq(rfqId: string, payload: ManualOverrideInput) {
  const bodyPayload = normalizeActionPayload({
    vendor_id: payload.vendor_id,
    reason: payload.reason,
  });

  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/manual-override`, rfqId, {
    method: "POST",
    body: JSON.stringify(bodyPayload),
  }, true);
}

export async function sendBidForApproval(rfqId: string, payload: SendForApprovalInput = {}) {
  const bodyPayload = normalizeActionPayload({
    vendor_id: payload.vendor_id,
    note: payload.note,
  });

  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/send-for-approval`, rfqId, {
    method: "POST",
    body: JSON.stringify(bodyPayload),
  }, true);
}

export async function selectBidWinner(rfqId: string, vendorId: string) {
  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/select`, rfqId, {
    method: "POST",
    body: JSON.stringify({ vendor_id: vendorId }),
  }, true);
}

export function getBidWorkflowApiErrorMessage(error: unknown): string {
  if (error instanceof BidWorkflowApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected bid workflow error";
}
