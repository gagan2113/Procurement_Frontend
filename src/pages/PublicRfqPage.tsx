import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getRfqWorkflowApiErrorMessage,
  getPublicRfq,
  registerPublicRfqVendor,
  toRfqStatusLabel,
} from "@/lib/rfq-workflow-api";
import {
  getBidWorkflowApiErrorMessage,
  isBidDeadlineExpiredError,
  isBidRfqNotOpenError,
  submitVendorBidForRfq,
} from "@/lib/bid-workflow-api";
import { ArrowLeft, Loader2 } from "lucide-react";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return <p className="text-sm text-muted-foreground">Not available</p>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-sm whitespace-pre-wrap">{String(value)}</p>;
  }

  return <pre className="text-xs bg-muted/30 rounded-md p-3 overflow-auto">{JSON.stringify(value, null, 2)}</pre>;
}

function normalizeStatusKey(status: string | null | undefined) {
  if (!status) {
    return "unknown";
  }

  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export default function PublicRfqPage() {
  const { toast } = useToast();
  const { rfqId } = useParams<{ rfqId: string }>();

  const [registrationForm, setRegistrationForm] = useState({
    vendor_id: "",
    vendor_name: "",
    email: "",
    phone: "",
    company_name: "",
  });

  const [bidForm, setBidForm] = useState({
    vendor_id: "",
    price: "",
    currency: "INR",
    lead_time: "",
    delivery_schedule: "",
    delivery_terms: "",
    payment_terms: "",
    validity: "",
    specification_compliance: "",
    quotation_pdf: null as File | null,
    technical_sheet: null as File | null,
    compliance_documents: [] as File[],
    certifications: [] as File[],
  });

  const publicRfqQuery = useQuery({
    queryKey: ["rfq", "public", rfqId || "none"],
    enabled: Boolean(rfqId),
    queryFn: async () => {
      if (!rfqId) {
        throw new Error("RFQ id is required");
      }

      return getPublicRfq(rfqId);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!rfqId) {
        throw new Error("RFQ id is required");
      }

      return registerPublicRfqVendor(rfqId, {
        vendor_id: registrationForm.vendor_id,
        vendor_name: registrationForm.vendor_name,
        email: registrationForm.email,
        phone: registrationForm.phone,
        company_name: registrationForm.company_name,
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Registration successful",
        description: result.message,
      });
      publicRfqQuery.refetch();

      setBidForm((prev) => ({
        ...prev,
        vendor_id: registrationForm.vendor_id || prev.vendor_id,
      }));
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: getRfqWorkflowApiErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const submitBidMutation = useMutation({
    mutationFn: async () => {
      if (!rfqId) {
        throw new Error("RFQ id is required");
      }

      if (!bidForm.quotation_pdf || !bidForm.technical_sheet) {
        throw new Error("Upload quotation PDF and technical sheet before submitting.");
      }

      if (bidForm.compliance_documents.length === 0 || bidForm.certifications.length === 0) {
        throw new Error("Upload compliance documents and certifications before submitting.");
      }

      return submitVendorBidForRfq(rfqId, {
        vendor_id: bidForm.vendor_id,
        price: bidForm.price,
        currency: bidForm.currency,
        lead_time: bidForm.lead_time,
        delivery_schedule: bidForm.delivery_schedule,
        delivery_terms: bidForm.delivery_terms,
        payment_terms: bidForm.payment_terms,
        validity: bidForm.validity,
        specification_compliance: bidForm.specification_compliance,
        quotation_pdf: bidForm.quotation_pdf,
        technical_sheet: bidForm.technical_sheet,
        compliance_documents: bidForm.compliance_documents,
        certifications: bidForm.certifications,
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Bid submitted",
        description: result.message,
      });
      publicRfqQuery.refetch();

      setBidForm((prev) => ({
        ...prev,
        quotation_pdf: null,
        technical_sheet: null,
        compliance_documents: [],
        certifications: [],
      }));
    },
    onError: (error) => {
      const message = isBidDeadlineExpiredError(error)
        ? "Submission deadline has expired. No new bids can be submitted."
        : isBidRfqNotOpenError(error)
          ? "RFQ is not open for bidding. Wait until RFQ status is open."
          : getBidWorkflowApiErrorMessage(error);

      toast({
        title: "Bid submission failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleRegistrationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await registerMutation.mutateAsync();
  };

  const handleBidSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitBidMutation.mutateAsync();
  };

  if (!rfqId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Public RFQ" description="RFQ id is required" />
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground">
          No RFQ id was provided in the route.
        </div>
      </div>
    );
  }

  const rfq = publicRfqQuery.data;
  const statusKey = normalizeStatusKey(rfq?.status);
  const bidWindowOpen = statusKey === "open" || statusKey === "open_for_bidding";

  const registrationDisabled = (rfq?.deadline_expired ?? false) || rfq?.registration_open === false;
  const bidSubmissionDisabled = submitBidMutation.isPending || (rfq?.deadline_expired ?? false) || !bidWindowOpen;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public RFQ"
        description="View public RFQ details, register, and submit bid documents"
        actions={
          <Button asChild type="button" variant="outline" className="gap-2">
            <Link to="/vendor-portal">
              <ArrowLeft className="h-4 w-4" /> Back to Vendor Portal
            </Link>
          </Button>
        }
      />

      {publicRfqQuery.isLoading && (
        <div className="rounded-xl border bg-card p-6 card-shadow text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading public RFQ...
        </div>
      )}

      {publicRfqQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow space-y-3">
          <p className="text-sm text-destructive">{getRfqWorkflowApiErrorMessage(publicRfqQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => publicRfqQuery.refetch()}>Retry</Button>
        </div>
      )}

      {rfq && (
        <>
          <div className="rounded-xl border bg-card p-5 card-shadow space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{rfq.rfq_number || rfq.rfq_id}</h2>
                <p className="text-xs text-muted-foreground mt-1">rfq_id: {rfq.rfq_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={rfq.status || "open_for_bidding"} />
                <span className="text-xs text-muted-foreground">{toRfqStatusLabel(rfq.status)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              <p><span className="text-muted-foreground">material:</span> {rfq.material || "Not available"}</p>
              <p><span className="text-muted-foreground">category:</span> {rfq.category || "Not available"}</p>
              <p><span className="text-muted-foreground">quantity:</span> {rfq.quantity ?? "Not available"}</p>
              <p><span className="text-muted-foreground">submission_deadline:</span> {formatDateTime(rfq.submission_deadline)}</p>
              <p><span className="text-muted-foreground">deadline_expired:</span> {rfq.deadline_expired ? "Yes" : "No"}</p>
              <p><span className="text-muted-foreground">vendors_invited:</span> {rfq.vendors_invited ?? rfq.vendors_invited_count ?? "Not available"}</p>
            </div>

            {registrationDisabled && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                Registration is disabled because deadline has expired or registration is closed.
              </div>
            )}

            {!bidWindowOpen && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Bid submission is available only when RFQ status is open for bidding.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4 card-shadow">
              <h3 className="text-sm font-semibold mb-2">Full Specs</h3>
              {renderValue(rfq.full_specs)}
            </div>

            <div className="rounded-xl border bg-card p-4 card-shadow">
              <h3 className="text-sm font-semibold mb-2">Scope of Work</h3>
              {renderValue(rfq.scope_of_work)}
            </div>

            <div className="rounded-xl border bg-card p-4 card-shadow">
              <h3 className="text-sm font-semibold mb-2">Technical Specs</h3>
              {renderValue(rfq.technical_specs)}
            </div>

            <div className="rounded-xl border bg-card p-4 card-shadow">
              <h3 className="text-sm font-semibold mb-2">Payment Terms</h3>
              {renderValue(rfq.payment_terms)}
            </div>

            <div className="rounded-xl border bg-card p-4 card-shadow lg:col-span-2">
              <h3 className="text-sm font-semibold mb-2">Evaluation Criteria</h3>
              {renderValue(rfq.evaluation_criteria)}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-3">Register for This RFQ</h3>
              <form className="space-y-3" onSubmit={handleRegistrationSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vendor ID (optional)</p>
                    <Input
                      value={registrationForm.vendor_id}
                      onChange={(event) => setRegistrationForm((prev) => ({ ...prev, vendor_id: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vendor Name</p>
                    <Input
                      value={registrationForm.vendor_name}
                      onChange={(event) => setRegistrationForm((prev) => ({ ...prev, vendor_name: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <Input
                      type="email"
                      value={registrationForm.email}
                      onChange={(event) => setRegistrationForm((prev) => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <Input
                      value={registrationForm.phone}
                      onChange={(event) => setRegistrationForm((prev) => ({ ...prev, phone: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs text-muted-foreground">Company Name</p>
                    <Input
                      value={registrationForm.company_name}
                      onChange={(event) => setRegistrationForm((prev) => ({ ...prev, company_name: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="gap-2" disabled={registrationDisabled || registerMutation.isPending}>
                    {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Register
                  </Button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border bg-card p-5 card-shadow">
              <h3 className="text-sm font-semibold mb-1">Submit Quotation (Required Documents)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Sends multipart/form-data to /api/v1/bid/rfq/{rfq.rfq_id}/submit with all required fields and files.
              </p>

              <form className="space-y-3" onSubmit={handleBidSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Vendor ID</p>
                    <Input
                      value={bidForm.vendor_id}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, vendor_id: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bidForm.price}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, price: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Currency</p>
                    <Input
                      value={bidForm.currency}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, currency: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Lead Time (days)</p>
                    <Input
                      type="number"
                      min="0"
                      value={bidForm.lead_time}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, lead_time: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs text-muted-foreground">Validity</p>
                    <Input
                      value={bidForm.validity}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, validity: event.target.value }))}
                      placeholder="Example: 45 days from submission"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Delivery Schedule</p>
                  <Textarea
                    rows={2}
                    value={bidForm.delivery_schedule}
                    onChange={(event) => setBidForm((prev) => ({ ...prev, delivery_schedule: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Delivery Terms</p>
                  <Textarea
                    rows={2}
                    value={bidForm.delivery_terms}
                    onChange={(event) => setBidForm((prev) => ({ ...prev, delivery_terms: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Payment Terms</p>
                  <Textarea
                    rows={2}
                    value={bidForm.payment_terms}
                    onChange={(event) => setBidForm((prev) => ({ ...prev, payment_terms: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Specification Compliance</p>
                  <Textarea
                    rows={2}
                    value={bidForm.specification_compliance}
                    onChange={(event) => setBidForm((prev) => ({ ...prev, specification_compliance: event.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Quotation PDF</p>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={(event) => setBidForm((prev) => ({ ...prev, quotation_pdf: event.target.files?.[0] || null }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Technical Sheet</p>
                    <Input
                      type="file"
                      onChange={(event) => setBidForm((prev) => ({ ...prev, technical_sheet: event.target.files?.[0] || null }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Compliance Documents</p>
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => setBidForm((prev) => ({ ...prev, compliance_documents: Array.from(event.target.files || []) }))}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Certifications</p>
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => setBidForm((prev) => ({ ...prev, certifications: Array.from(event.target.files || []) }))}
                      required
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Selected compliance files: {bidForm.compliance_documents.length}</p>
                  <p>Selected certifications: {bidForm.certifications.length}</p>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="gap-2" disabled={bidSubmissionDisabled}>
                    {submitBidMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit Bid with Documents
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
