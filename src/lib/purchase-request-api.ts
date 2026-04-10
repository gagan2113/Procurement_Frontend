const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
const API_PREFIX = "/api/v1";

export type PurchaseRequestStatus = "pending" | "active" | "approved" | "rejected" | "closed";
export type PurchaseRequestAiStatus = "valid" | "needs_review" | "pending";

export interface PurchaseRequest {
  id: string;
  pr_number: string;
  item_name: string;
  category: string;
  quantity: number;
  budget: number;
  budget_per_unit: number;
  description: string;
  expected_delivery_date: string;
  rewritten_description?: string;
  missing_details?: string[];
  improved_description?: string;
  missing_fields?: string[];
  budget_feedback?: string;
  ai_status?: PurchaseRequestAiStatus;
  status: PurchaseRequestStatus;
  pdf_path: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestListData {
  total: number;
  items: PurchaseRequest[];
}

export interface CreatePurchaseRequestInput {
  item_name: string;
  category: string;
  quantity: number;
  budget: number;
  description: string;
  expected_delivery_date: string;
}

export interface UpdatePurchaseRequestInput {
  item_name?: string;
  category?: string;
  quantity?: number;
  budget?: number;
  description?: string;
  expected_delivery_date?: string;
  status?: PurchaseRequestStatus;
}

export interface RewriteDescriptionInput {
  description: string;
  item_name?: string;
  category?: string;
  quantity?: number;
  budget?: number;
  expected_delivery_date?: string;
}

export interface RewriteDescriptionData {
  rewritten_description: string;
  missing_details: string[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: unknown;
}

export interface FastApiValidationError {
  type: string;
  loc: Array<string | number>;
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  status: number;
  validationErrors: FastApiValidationError[];

  constructor(message: string, status: number, validationErrors: FastApiValidationError[] = []) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

interface ListPurchaseRequestParams {
  skip?: number;
  limit?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseValidationErrors(errors: unknown): FastApiValidationError[] {
  if (Array.isArray(errors)) {
    return errors
      .filter(isObject)
      .map((item) => ({
        type: String(item.type ?? "validation_error"),
        loc: Array.isArray(item.loc) ? item.loc.map((entry) => (typeof entry === "number" ? entry : String(entry))) : [],
        msg: String(item.msg ?? item.message ?? "Validation error"),
        input: item.input,
        ctx: isObject(item.ctx) ? item.ctx : undefined,
      }));
  }

  if (isObject(errors)) {
    const validationErrors: FastApiValidationError[] = [];

    for (const [field, value] of Object.entries(errors)) {
      if (Array.isArray(value)) {
        for (const message of value) {
          if (typeof message === "string") {
            validationErrors.push({
              type: "validation_error",
              loc: ["body", field],
              msg: message,
            });
          }
        }
      } else if (typeof value === "string") {
        validationErrors.push({
          type: "validation_error",
          loc: ["body", field],
          msg: value,
        });
      }
    }

    return validationErrors;
  }

  return [];
}

function getErrorMessage(payload: unknown): { message: string; validationErrors: FastApiValidationError[] } {
  if (isObject(payload) && "errors" in payload) {
    const validationErrors = parseValidationErrors(payload.errors);
    const message = typeof payload.message === "string" ? payload.message : "Validation error";
    if (validationErrors.length > 0) {
      return { message, validationErrors };
    }
  }

  if (isObject(payload) && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") {
      return { message: detail, validationErrors: [] };
    }

    if (Array.isArray(detail)) {
      const validationErrors = parseValidationErrors(detail);

      const combinedMessage = validationErrors.map((item) => item.msg).join("; ") || "Validation error";
      return { message: combinedMessage, validationErrors };
    }
  }

  if (isObject(payload) && typeof payload.message === "string") {
    return { message: payload.message, validationErrors: [] };
  }

  if (typeof payload === "string" && payload.trim()) {
    return { message: payload, validationErrors: [] };
  }

  return { message: "Request failed", validationErrors: [] };
}

async function parseError(response: Response): Promise<ApiClientError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  let payload: unknown = null;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => "");
  }

  const { message, validationErrors } = getErrorMessage(payload);
  return new ApiClientError(message, response.status, validationErrors);
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

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.success) {
    throw new ApiClientError(payload.message || "Request failed", response.status || 500, parseValidationErrors(payload.errors));
  }

  return payload;
}

function extractFilename(contentDisposition: string | null, fallbackName: string): string {
  if (!contentDisposition) {
    return fallbackName;
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (!match?.[1]) {
    return fallbackName;
  }

  return match[1];
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export function getApiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiClientError)) {
    return {};
  }

  return error.validationErrors.reduce<Record<string, string>>((acc, item) => {
    const field = item.loc[item.loc.length - 1];
    if (typeof field === "string" && !acc[field]) {
      acc[field] = item.msg;
    }
    return acc;
  }, {});
}

export async function createPurchaseRequest(payload: CreatePurchaseRequestInput) {
  return requestJson<PurchaseRequest>(`${API_PREFIX}/purchase-request`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rewritePurchaseRequestDescription(payload: RewriteDescriptionInput) {
  return requestJson<RewriteDescriptionData>(`${API_PREFIX}/purchase-request/rewrite-description`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listPurchaseRequests(params: ListPurchaseRequestParams = {}) {
  const query = new URLSearchParams({
    skip: String(params.skip ?? 0),
    limit: String(params.limit ?? 50),
  });

  return requestJson<PurchaseRequestListData>(`${API_PREFIX}/purchase-requests?${query.toString()}`);
}

export async function getPurchaseRequestById(prId: string) {
  return requestJson<PurchaseRequest>(`${API_PREFIX}/purchase-request/${encodeURIComponent(prId)}`);
}

export async function updatePurchaseRequest(prId: string, payload: UpdatePurchaseRequestInput) {
  return requestJson<PurchaseRequest>(`${API_PREFIX}/purchase-request/${encodeURIComponent(prId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function downloadPurchaseRequestPdf(prId: string) {
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/purchase-request/${encodeURIComponent(prId)}/pdf`);

  if (!response.ok) {
    throw await parseError(response);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition");
  const filename = extractFilename(contentDisposition, `${prId}.pdf`);

  return { blob, filename };
}
