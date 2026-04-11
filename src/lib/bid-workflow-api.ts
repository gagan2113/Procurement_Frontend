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

export interface BidVendorAiInsight {
  strengths: string[];
  risks: string[];
  recommendation: "Preferred" | "Consider" | "Avoid" | null;
  [key: string]: unknown;
}

export interface BidItem {
  bid_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  price: number | null;
  delivery_days: number | null;
  compliance_score: number | null;
  total_score: number | null;
  rank: number | null;
  [key: string]: unknown;
}

export interface BidSnapshot {
  rfq_id: string | null;
  rfq_number: string | null;
  rfq_status: string | null;
  bids: BidItem[];
  evaluation: JsonRecord | null;
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

export interface SubmitBidInput {
  vendor_ids?: string[];
  [key: string]: unknown;
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
};

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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toStringOrNull(entry))
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

function normalizeBidItem(raw: unknown): BidItem | null {
  if (!isObject(raw)) {
    return null;
  }

  const bid_id = toStringOrNull(raw.bid_id) || toStringOrNull(raw.id);
  const vendor_id = toStringOrNull(raw.vendor_id);
  const vendor_name = toStringOrNull(raw.vendor_name) || toStringOrNull(raw.name);

  return {
    ...raw,
    bid_id,
    vendor_id,
    vendor_name,
    price: toNumberOrNull(raw.price) ?? toNumberOrNull(raw.bid_price),
    delivery_days: toNumberOrNull(raw.delivery_days),
    compliance_score: toNumberOrNull(raw.compliance_score),
    total_score: toNumberOrNull(raw.total_score),
    rank: toNumberOrNull(raw.rank),
  };
}

function normalizeAiInsights(raw: unknown): Record<string, BidVendorAiInsight> {
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

function normalizeSnapshot(rawData: unknown, rfqIdFallback: string): BidSnapshot {
  const source = isObject(rawData) ? rawData : {};

  const bids = Array.isArray(source.bids)
    ? source.bids
      .map((item) => normalizeBidItem(item))
      .filter((item): item is BidItem => Boolean(item))
    : [];

  const evaluation = isObject(source.evaluation) ? source.evaluation : null;
  const ai_insights = normalizeAiInsights(source.ai_insights);

  return {
    rfq_id: toStringOrNull(source.rfq_id) || rfqIdFallback,
    rfq_number: toStringOrNull(source.rfq_number),
    rfq_status: toStringOrNull(source.rfq_status) || toStringOrNull(source.status),
    bids,
    evaluation,
    ai_insights,
    selected_vendor_id: toStringOrNull(source.selected_vendor_id),
    selected_vendor_name: toStringOrNull(source.selected_vendor_name),
    updated_at: toStringOrNull(source.updated_at),
    raw: isObject(rawData) ? rawData : null,
  };
}

async function requestSnapshot(path: string, rfqId: string, init: RequestInit = {}): Promise<BidWorkflowResult> {
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

  let message = "Success";
  let dataSource: unknown = payload;

  if (isObject(payload) && "success" in payload && "data" in payload) {
    const envelope = payload as ApiEnvelope<unknown>;
    if (!envelope.success) {
      throw new BidWorkflowApiError(envelope.message || "Request failed", response.status, payload);
    }

    message = envelope.message || message;
    dataSource = envelope.data;
  }

  return {
    message,
    snapshot: normalizeSnapshot(dataSource, rfqId),
  };
}

export function isRfqClosedStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "closed";
}

export function isRfqOpenStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && status.trim().toLowerCase() === "open";
}

export async function submitBidForRfq(rfqId: string, payload: SubmitBidInput = {}) {
  const vendorIds = Array.isArray(payload.vendor_ids)
    ? payload.vendor_ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];

  const bodyPayload: SubmitBidInput = {
    ...payload,
    vendor_ids: vendorIds,
  };

  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/submit`, rfqId, {
    method: "POST",
    body: JSON.stringify(bodyPayload),
  });
}

export async function evaluateBidForRfq(rfqId: string) {
  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/evaluate`, rfqId, {
    method: "POST",
  });
}

export async function getLiveBidSnapshot(rfqId: string) {
  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/live`, rfqId);
}

export async function selectBidWinner(rfqId: string, vendorId: string) {
  return requestSnapshot(`${API_PREFIX}/bid/rfq/${encodeURIComponent(rfqId)}/select`, rfqId, {
    method: "POST",
    body: JSON.stringify({ vendor_id: vendorId }),
  });
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
