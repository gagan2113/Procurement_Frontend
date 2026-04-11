import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, FileText, Loader2, Mail, MapPin, ShieldCheck, Sparkles, Star, Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AiInsightPanel } from "@/components/shared/AiInsightPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVendorDetail } from "@/hooks/use-vendors";
import { getVendorApiErrorMessage } from "@/lib/vendor-service";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function toDisplayLabel(value: string) {
  return value
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDisplayNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toLocaleString();
    }

    return value;
  }

  return "Not available";
}

function toDisplayDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function getRecordString(source: unknown, keys: string[]) {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getRecordNumber(source: unknown, keys: string[]) {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getContactDetails(contactInfo: unknown) {
  if (typeof contactInfo === "string" && contactInfo.trim()) {
    return [contactInfo];
  }

  if (!isRecord(contactInfo)) {
    return [];
  }

  const preferredKeys = ["email", "phone", "primary_email", "primary_phone", "contact_name", "contact"];
  const preferredValues: string[] = [];

  for (const key of preferredKeys) {
    const value = contactInfo[key];
    if (typeof value === "string" && value.trim()) {
      preferredValues.push(value);
    }
  }

  if (preferredValues.length > 0) {
    return preferredValues;
  }

  return Object.entries(contactInfo)
    .map(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        return `${toDisplayLabel(key)}: ${value}`;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
}

function flattenScorecardMetrics(source: unknown, parentKey = ""): Array<{ key: string; value: string }> {
  if (!isRecord(source)) {
    return [];
  }

  const rows: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(source)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      rows.push({
        key: fullKey,
        value: value.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry))).join(", "),
      });
      continue;
    }

    if (isRecord(value)) {
      rows.push(...flattenScorecardMetrics(value, fullKey));
      continue;
    }

    if (value === null || value === undefined || value === "") {
      continue;
    }

    rows.push({
      key: fullKey,
      value: typeof value === "number" ? value.toLocaleString() : String(value),
    });
  }

  return rows;
}

export default function VendorDetailPage() {
  const navigate = useNavigate();
  const { vendorId } = useParams<{ vendorId: string }>();
  const detailQuery = useVendorDetail(vendorId ?? null);

  const profile = detailQuery.data;
  const vendorMaster = profile?.vendor_master;
  const summaryMetrics = profile?.summary_metrics;
  const pastDeals = profile?.past_deals?.recent_transactions ?? [];
  const scorecardMetrics = useMemo(
    () => flattenScorecardMetrics(profile?.performance_scorecard),
    [profile?.performance_scorecard],
  );
  const contracts = profile?.contracts?.items ?? [];
  const materials = profile?.materials?.items ?? [];
  const aiInsights = profile?.ai_insights;

  const contactDetails = useMemo(() => getContactDetails(vendorMaster?.contact_info), [vendorMaster?.contact_info]);

  const hasContent = Boolean(
    vendorMaster ||
      summaryMetrics ||
      pastDeals.length > 0 ||
      scorecardMetrics.length > 0 ||
      contracts.length > 0 ||
      materials.length > 0 ||
      (aiInsights?.strengths?.length ?? 0) > 0 ||
      (aiInsights?.risks?.length ?? 0) > 0 ||
      aiInsights?.recommendation,
  );

  if (!vendorId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vendor Details" description="A vendor ID is required to load details." />
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground">
          The vendor identifier is missing. Please return to Vendor Discovery and choose a vendor.
        </div>
      </div>
    );
  }

  const vendorName = vendorMaster?.vendor_name || `Vendor ${vendorId}`;
  const rating = vendorMaster?.rating !== null && vendorMaster?.rating !== undefined ? vendorMaster.rating.toFixed(1) : "Not available";
  const performancePct =
    vendorMaster?.performance_pct !== null && vendorMaster?.performance_pct !== undefined
      ? `${vendorMaster.performance_pct}%`
      : "Not available";
  const location = vendorMaster?.location || "Location not available";

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendorName}
        description="Vendor profile and performance details"
        actions={
          <div className="flex items-center gap-2">
            {summaryMetrics?.contract_available_for_skip_rfq && (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                Skip RFQ Eligible
              </Badge>
            )}
            <Button type="button" variant="outline" className="gap-2" onClick={() => navigate("/vendors")}>
              <ArrowLeft className="h-4 w-4" />
              Back to Vendors
            </Button>
          </div>
        }
      />

      {detailQuery.isLoading && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vendor details...
        </div>
      )}

      {detailQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getVendorApiErrorMessage(detailQuery.error)}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => detailQuery.refetch()}>
              Retry
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/vendors")}>Back</Button>
          </div>
        </div>
      )}

      {!detailQuery.isLoading && !detailQuery.isError && !hasContent && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground">
          No vendor detail data is available for this record.
        </div>
      )}

      {!detailQuery.isLoading && !detailQuery.isError && hasContent && (
        <>
          <div className="rounded-xl border bg-card p-5 card-shadow">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{vendorName}</h2>
                <div className="space-y-1">
                  <p className="text-sm flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{location}</p>
                  {contactDetails.length > 0 ? (
                    contactDetails.map((contact, index) => (
                      <p key={`${contact}-${index}`} className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {contact}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />Contact info unavailable</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-[220px]">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="text-sm font-semibold flex items-center gap-1 mt-1"><Star className="h-3.5 w-3.5 text-warning fill-warning" />{rating}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Performance</p>
                  <p className="text-sm font-semibold mt-1">{performancePct}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total Orders" value={toDisplayNumber(summaryMetrics?.total_orders)} icon={ClipboardList} />
            <StatsCard title="Active Contracts" value={toDisplayNumber(summaryMetrics?.active_contracts)} icon={FileText} iconColor="bg-info/10" />
            <StatsCard title="Materials Supplied" value={toDisplayNumber(summaryMetrics?.materials_supplied)} icon={Boxes} iconColor="bg-success/10" />
            <StatsCard title="AI Score" value={toDisplayNumber(summaryMetrics?.ai_score)} icon={Sparkles} iconColor="bg-ai/20" />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-5 gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="past-deals">Past Deals</TabsTrigger>
              <TabsTrigger value="performance-scorecard">Performance Scorecard</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-5 card-shadow">
                  <h3 className="text-sm font-semibold mb-4">Vendor Master</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendor Name</p>
                      <p className="font-medium">{vendorMaster?.vendor_name || "Not available"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rating</p>
                      <p className="font-medium">{rating}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Performance %</p>
                      <p className="font-medium">{performancePct}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium">{location}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Contact Info</p>
                      <p className="font-medium">{contactDetails[0] || "Not available"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-5 card-shadow">
                  <h3 className="text-sm font-semibold mb-4">Key Performance Summary</h3>
                  {scorecardMetrics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Performance scorecard data is not available.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {scorecardMetrics.slice(0, 8).map((metric) => (
                        <div key={metric.key} className="rounded-lg border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">{toDisplayLabel(metric.key)}</p>
                          <p className="font-medium mt-1">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="past-deals">
              <div className="rounded-xl border bg-card card-shadow overflow-hidden">
                {pastDeals.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">No recent transactions are available.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastDeals.map((deal, index) => {
                        const transactionName =
                          getRecordString(deal, ["transaction_id", "deal_id", "po_number", "id"]) ||
                          `Transaction ${index + 1}`;
                        const details =
                          getRecordString(deal, ["item_name", "material_name", "description", "deal_name", "transaction_type"]) ||
                          "No detail";
                        const amount = getRecordNumber(deal, ["amount", "value", "contract_value"]);
                        const status = getRecordString(deal, ["status", "deal_status"]) || "Unknown";
                        const date = getRecordString(deal, ["transaction_date", "date", "created_at"]);

                        return (
                          <TableRow key={`${transactionName}-${index}`}>
                            <TableCell className="font-medium">{transactionName}</TableCell>
                            <TableCell>{details}</TableCell>
                            <TableCell>{amount !== null ? amount.toLocaleString() : "Not available"}</TableCell>
                            <TableCell><StatusBadge status={status} /></TableCell>
                            <TableCell>{toDisplayDate(date)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="performance-scorecard">
              <div className="rounded-xl border bg-card p-5 card-shadow">
                {scorecardMetrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No performance metrics are available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {scorecardMetrics.map((metric) => (
                      <div key={metric.key} className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{toDisplayLabel(metric.key)}</p>
                        <p className="font-semibold mt-1">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contracts">
              <div className="rounded-xl border bg-card card-shadow overflow-hidden">
                {contracts.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">No contract records are available.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expiry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract, index) => {
                        const contractName =
                          getRecordString(contract, ["contract_name", "contract_id", "name", "title", "id"]) ||
                          `Contract ${index + 1}`;
                        const status = getRecordString(contract, ["status"]) || "Unknown";
                        const expiry = getRecordString(contract, ["expiry", "expiry_date", "end_date"]);

                        return (
                          <TableRow key={`${contractName}-${index}`}>
                            <TableCell className="font-medium">{contractName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                <StatusBadge status={status} />
                              </div>
                            </TableCell>
                            <TableCell>{toDisplayDate(expiry)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="materials">
              <div className="rounded-xl border bg-card card-shadow overflow-hidden">
                {materials.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">No material records are available.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Capacity Per Material</TableHead>
                        <TableHead>Lead Time (Days)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material, index) => {
                        const materialName =
                          getRecordString(material, ["material_name", "name", "material"]) ||
                          `Material ${index + 1}`;
                        const capacity = material.capacity_per_material;
                        const leadTime = material.lead_time_days;

                        return (
                          <TableRow key={`${materialName}-${index}`}>
                            <TableCell className="font-medium">{materialName}</TableCell>
                            <TableCell>
                              {capacity !== null && capacity !== undefined && String(capacity).trim()
                                ? String(capacity)
                                : "Not available"}
                            </TableCell>
                            <TableCell>
                              {typeof leadTime === "number" && Number.isFinite(leadTime)
                                ? leadTime
                                : "Not available"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <AiInsightPanel title="AI Insight">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ai/80">Strengths</p>
                {aiInsights?.strengths?.length ? (
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {aiInsights.strengths.map((strength, index) => (
                      <li key={`${strength}-${index}`}>{strength}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm mt-1">No strengths data available.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ai/80">Risks</p>
                {aiInsights?.risks?.length ? (
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {aiInsights.risks.map((risk, index) => (
                      <li key={`${risk}-${index}`}>{risk}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm mt-1">No risks data available.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ai/80">Recommendation</p>
                <p className="text-sm mt-1">{aiInsights?.recommendation || "No recommendation provided."}</p>
              </div>
            </div>
          </AiInsightPanel>
        </>
      )}
    </div>
  );
}
