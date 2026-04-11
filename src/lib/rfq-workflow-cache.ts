import { type RfqWorkflow } from "@/lib/rfq-workflow-api";

const STORAGE_KEY = "procureflow.rfq-workflows";
const UPDATE_EVENT = "procureflow:rfq-workflow-updated";

export interface RfqWorkflowCacheItem extends RfqWorkflow {
  updated_at: string;
  selected_vendor_id: string | null;
  selected_vendor_name: string | null;
}

interface UpsertRfqWorkflowInput {
  rfq_id: string;
  rfq_number?: string | null;
  status?: string | null;
  actions_available?: string[];
  public_link?: string | null;
  selected_vendor_id?: string | null;
  selected_vendor_name?: string | null;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toStringOrNull(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeCacheItem(raw: unknown): RfqWorkflowCacheItem | null {
  if (!isObject(raw)) {
    return null;
  }

  const rfq_id = toStringOrNull(raw.rfq_id);
  if (!rfq_id) {
    return null;
  }

  const updated_at = toStringOrNull(raw.updated_at) || new Date().toISOString();

  return {
    ...raw,
    rfq_id,
    rfq_number: toStringOrNull(raw.rfq_number),
    status: toStringOrNull(raw.status),
    actions_available: toStringArray(raw.actions_available),
    public_link: toStringOrNull(raw.public_link),
    selected_vendor_id: toStringOrNull(raw.selected_vendor_id),
    selected_vendor_name: toStringOrNull(raw.selected_vendor_name),
    updated_at,
  };
}

function readStorage(): RfqWorkflowCacheItem[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeCacheItem(item))
      .filter((item): item is RfqWorkflowCacheItem => Boolean(item));
  } catch {
    return [];
  }
}

function writeStorage(items: RfqWorkflowCacheItem[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent<RfqWorkflowCacheItem[]>(UPDATE_EVENT, { detail: items }));
}

export function getRfqWorkflowCache(): RfqWorkflowCacheItem[] {
  return readStorage();
}

export function upsertRfqWorkflowCache(input: UpsertRfqWorkflowInput) {
  if (!input.rfq_id) {
    return;
  }

  const current = readStorage();
  const index = current.findIndex((item) => item.rfq_id === input.rfq_id);
  const previous = index >= 0 ? current[index] : null;

  const next: RfqWorkflowCacheItem = {
    rfq_id: input.rfq_id,
    rfq_number: input.rfq_number ?? previous?.rfq_number ?? null,
    status: input.status ?? previous?.status ?? null,
    actions_available: input.actions_available ?? previous?.actions_available ?? [],
    public_link: input.public_link ?? previous?.public_link ?? null,
    selected_vendor_id: input.selected_vendor_id ?? previous?.selected_vendor_id ?? null,
    selected_vendor_name: input.selected_vendor_name ?? previous?.selected_vendor_name ?? null,
    updated_at: new Date().toISOString(),
  };

  if (index >= 0) {
    current[index] = next;
  } else {
    current.unshift(next);
  }

  writeStorage(current);
}

export function subscribeRfqWorkflowCache(listener: (items: RfqWorkflowCacheItem[]) => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<RfqWorkflowCacheItem[]>;
    listener(Array.isArray(customEvent.detail) ? customEvent.detail : readStorage());
  };

  window.addEventListener(UPDATE_EVENT, handler as EventListener);
  return () => window.removeEventListener(UPDATE_EVENT, handler as EventListener);
}
