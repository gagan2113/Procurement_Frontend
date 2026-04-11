const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
const API_PREFIX = "/api/v1";

type JsonRecord = Record<string, unknown>;

export interface VendorApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: unknown;
}

export interface VendorMaster {
  vendor_id: string | null;
  vendor_name: string | null;
  rating: number | null;
  performance_pct: number | null;
  location: string | null;
  contact_info: unknown;
  [key: string]: unknown;
}

export interface VendorSummaryMetrics {
  total_orders: number | null;
  active_contracts: number | null;
  materials_supplied: number | null;
  ai_score: number | null;
  contract_available_for_skip_rfq: boolean;
  [key: string]: unknown;
}

export interface VendorRecentTransaction {
  transaction_id?: string | null;
  deal_id?: string | null;
  po_number?: string | null;
  item_name?: string | null;
  material_name?: string | null;
  amount?: number | null;
  status?: string | null;
  transaction_date?: string | null;
  date?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface VendorPastDeals {
  recent_transactions: VendorRecentTransaction[];
  [key: string]: unknown;
}

export interface VendorPerformanceScorecard {
  [key: string]: unknown;
}

export interface VendorContractItem {
  contract_id?: string | null;
  contract_name?: string | null;
  status?: string | null;
  expiry?: string | null;
  [key: string]: unknown;
}

export interface VendorContracts {
  items: VendorContractItem[];
  [key: string]: unknown;
}

export interface VendorMaterialItem {
  material_name?: string | null;
  capacity_per_material?: number | string | null;
  lead_time_days?: number | null;
  [key: string]: unknown;
}

export interface VendorMaterials {
  items: VendorMaterialItem[];
  [key: string]: unknown;
}

export interface VendorAiInsights {
  strengths: string[];
  risks: string[];
  recommendation: string | null;
  [key: string]: unknown;
}

export interface VendorProfileData {
  vendor_master: VendorMaster | null;
  summary_metrics: VendorSummaryMetrics | null;
  past_deals: VendorPastDeals | null;
  performance_scorecard: VendorPerformanceScorecard | null;
  contracts: VendorContracts | null;
  materials: VendorMaterials | null;
  ai_insights: VendorAiInsights | null;
}

export interface VendorListItem {
  vendor_id: string;
  vendor_name: string | null;
  category: string | null;
  rating: number | null;
  performance_pct: number | null;
  location: string | null;
  contact_info: unknown;
  total_orders: number | null;
  is_ai_recommended: boolean | null;
  [key: string]: unknown;
}

export interface VendorListData {
  total: number;
  items: VendorListItem[];
}

export class VendorApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VendorApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
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

function unwrapApiPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  if (typeof payload.success === "boolean" && "data" in payload) {
    if (!payload.success) {
      const message = toStringOrNull(payload.message) || "Request failed";
      throw new VendorApiError(message, 500);
    }

    return payload.data;
  }

  return payload;
}

async function parseApiError(response: Response): Promise<VendorApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let payload: unknown = null;

  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => "");
  }

  if (isRecord(payload)) {
    const detailMessage = toStringOrNull(payload.detail);
    const message = detailMessage || toStringOrNull(payload.message) || `Request failed with status ${response.status}`;
    return new VendorApiError(message, response.status);
  }

  if (typeof payload === "string" && payload.trim()) {
    return new VendorApiError(payload.trim(), response.status);
  }

  return new VendorApiError(`Request failed with status ${response.status}`, response.status);
}

async function fetchVendorPayload(path: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const payload = (await response.json()) as unknown;
  return unwrapApiPayload(payload);
}

function normalizeVendorMaster(raw: unknown, fallback: JsonRecord): VendorMaster | null {
  const source = isRecord(raw) ? raw : fallback;

  const vendor_id = toStringOrNull(source.vendor_id);
  const vendor_name = toStringOrNull(source.vendor_name);
  const rating = toNumberOrNull(source.rating);
  const performance_pct = toNumberOrNull(source.performance_pct);
  const location = toStringOrNull(source.location);
  const contact_info = source.contact_info ?? null;

  const hasData = Boolean(vendor_id || vendor_name || rating !== null || performance_pct !== null || location || contact_info);
  if (!hasData) {
    return null;
  }

  return {
    ...source,
    vendor_id,
    vendor_name,
    rating,
    performance_pct,
    location,
    contact_info,
  };
}

function normalizeSummaryMetrics(raw: unknown, fallback: JsonRecord): VendorSummaryMetrics | null {
  const source = isRecord(raw) ? raw : fallback;

  const total_orders = toNumberOrNull(source.total_orders);
  const active_contracts = toNumberOrNull(source.active_contracts);
  const materials_supplied = toNumberOrNull(source.materials_supplied);
  const ai_score = toNumberOrNull(source.ai_score);
  const contract_available_for_skip_rfq = toBooleanOrNull(source.contract_available_for_skip_rfq) ?? false;

  const hasData = Boolean(
    total_orders !== null ||
    active_contracts !== null ||
    materials_supplied !== null ||
    ai_score !== null ||
    source.contract_available_for_skip_rfq !== undefined,
  );

  if (!hasData) {
    return null;
  }

  return {
    ...source,
    total_orders,
    active_contracts,
    materials_supplied,
    ai_score,
    contract_available_for_skip_rfq,
  };
}

function normalizePastDeals(raw: unknown, fallback: JsonRecord): VendorPastDeals | null {
  const source = isRecord(raw) ? raw : fallback;
  const recentTransactionsRaw = source.recent_transactions;

  if (!Array.isArray(recentTransactionsRaw)) {
    return null;
  }

  const recent_transactions = recentTransactionsRaw.filter(isRecord);

  return {
    ...source,
    recent_transactions,
  };
}

function normalizeContracts(raw: unknown, fallback: JsonRecord): VendorContracts | null {
  const source = isRecord(raw) ? raw : fallback;
  const itemsRaw = source.items;

  if (!Array.isArray(itemsRaw)) {
    return null;
  }

  const items = itemsRaw.filter(isRecord);

  return {
    ...source,
    items,
  };
}

function normalizeMaterials(raw: unknown, fallback: JsonRecord): VendorMaterials | null {
  const source = isRecord(raw) ? raw : fallback;
  const itemsRaw = source.items;

  if (!Array.isArray(itemsRaw)) {
    return null;
  }

  const items = itemsRaw.filter(isRecord);

  return {
    ...source,
    items,
  };
}

function normalizeAiInsights(raw: unknown, fallback: JsonRecord): VendorAiInsights | null {
  const source = isRecord(raw) ? raw : fallback;

  const strengths = toStringArray(source.strengths);
  const risks = toStringArray(source.risks);
  const recommendation = toStringOrNull(source.recommendation);
  const hasData = strengths.length > 0 || risks.length > 0 || Boolean(recommendation);

  if (!hasData) {
    return null;
  }

  return {
    ...source,
    strengths,
    risks,
    recommendation,
  };
}

function normalizeVendorProfile(payload: unknown): VendorProfileData {
  const unwrapped = unwrapApiPayload(payload);

  if (!isRecord(unwrapped)) {
    return {
      vendor_master: null,
      summary_metrics: null,
      past_deals: null,
      performance_scorecard: null,
      contracts: null,
      materials: null,
      ai_insights: null,
    };
  }

  const vendor_master = normalizeVendorMaster(unwrapped.vendor_master, unwrapped);
  const summary_metrics = normalizeSummaryMetrics(unwrapped.summary_metrics, unwrapped);
  const past_deals = normalizePastDeals(unwrapped.past_deals, unwrapped);
  const performance_scorecard = isRecord(unwrapped.performance_scorecard)
    ? unwrapped.performance_scorecard
    : null;
  const contracts = normalizeContracts(unwrapped.contracts, unwrapped);
  const materials = normalizeMaterials(unwrapped.materials, unwrapped);
  const ai_insights = normalizeAiInsights(unwrapped.ai_insights, unwrapped);

  return {
    vendor_master,
    summary_metrics,
    past_deals,
    performance_scorecard,
    contracts,
    materials,
    ai_insights,
  };
}

function normalizeVendorListItem(raw: unknown): VendorListItem | null {
  if (!isRecord(raw)) {
    return null;
  }

  const vendorMaster = isRecord(raw.vendor_master) ? raw.vendor_master : null;
  const summaryMetrics = isRecord(raw.summary_metrics) ? raw.summary_metrics : null;

  const vendor_id = toStringOrNull(raw.vendor_id) || toStringOrNull(vendorMaster?.vendor_id);
  if (!vendor_id) {
    return null;
  }

  const vendor_name = toStringOrNull(raw.vendor_name) || toStringOrNull(vendorMaster?.vendor_name);
  const category = toStringOrNull(raw.category) || toStringOrNull(vendorMaster?.category);
  const rating = toNumberOrNull(raw.rating) ?? toNumberOrNull(vendorMaster?.rating);
  const performance_pct = toNumberOrNull(raw.performance_pct) ?? toNumberOrNull(vendorMaster?.performance_pct);
  const location = toStringOrNull(raw.location) || toStringOrNull(vendorMaster?.location);
  const contact_info = raw.contact_info ?? vendorMaster?.contact_info ?? null;
  const total_orders = toNumberOrNull(raw.total_orders) ?? toNumberOrNull(summaryMetrics?.total_orders);
  const is_ai_recommended = toBooleanOrNull(raw.is_ai_recommended);

  return {
    ...raw,
    vendor_id,
    vendor_name,
    category,
    rating,
    performance_pct,
    location,
    contact_info,
    total_orders,
    is_ai_recommended,
  };
}

function normalizeVendorList(payload: unknown): VendorListData {
  const unwrapped = unwrapApiPayload(payload);

  if (Array.isArray(unwrapped)) {
    const items = unwrapped
      .map((entry) => normalizeVendorListItem(entry))
      .filter((entry): entry is VendorListItem => Boolean(entry));

    return {
      total: items.length,
      items,
    };
  }

  if (!isRecord(unwrapped)) {
    return {
      total: 0,
      items: [],
    };
  }

  const listSource = Array.isArray(unwrapped.items)
    ? unwrapped.items
    : Array.isArray(unwrapped.vendors)
      ? unwrapped.vendors
      : [];

  const items = listSource
    .map((entry) => normalizeVendorListItem(entry))
    .filter((entry): entry is VendorListItem => Boolean(entry));

  return {
    total: toNumberOrNull(unwrapped.total) ?? items.length,
    items,
  };
}

export async function listVendors(): Promise<VendorListData> {
  const payload = await fetchVendorPayload(`${API_PREFIX}/vendors`);
  return normalizeVendorList(payload);
}

export async function getVendorProfile(vendorId: string): Promise<VendorProfileData> {
  const encodedVendorId = encodeURIComponent(vendorId);

  try {
    const profilePayload = await fetchVendorPayload(`${API_PREFIX}/vendors/${encodedVendorId}/profile`);
    return normalizeVendorProfile(profilePayload);
  } catch {
    const fallbackPayload = await fetchVendorPayload(`${API_PREFIX}/vendors/${encodedVendorId}`);
    return normalizeVendorProfile(fallbackPayload);
  }
}

export function getVendorApiErrorMessage(error: unknown): string {
  if (error instanceof VendorApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected vendor API error";
}
