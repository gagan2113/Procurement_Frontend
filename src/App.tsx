import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import RaiseRequestPage from "./pages/RaiseRequestPage";
import DemandValidationPage from "./pages/DemandValidationPage";
import RequestsPage from "./pages/RequestsPage";
import FinanceReviewPage from "./pages/FinanceReviewPage";
import VendorsPage from "./pages/VendorsPage";
import VendorDetailPage from "./pages/VendorDetailPage";
import RFQPage from "./pages/RFQPage";
import BidsPage from "./pages/BidsPage";
import ShortlistingPage from "./pages/ShortlistingPage";
import ApprovalPage from "./pages/ApprovalPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import DeliveryPage from "./pages/DeliveryPage";
import InvoicesPage from "./pages/InvoicesPage";
import PaymentPage from "./pages/PaymentPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/raise-request" element={<RaiseRequestPage />} />
            <Route path="/demand-validation" element={<DemandValidationPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/finance-review" element={<FinanceReviewPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendors/:vendorId" element={<VendorDetailPage />} />
            <Route path="/rfq" element={<RFQPage />} />
            <Route path="/bids" element={<BidsPage />} />
            <Route path="/shortlisting" element={<ShortlistingPage />} />
            <Route path="/approval" element={<ApprovalPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/delivery" element={<DeliveryPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
