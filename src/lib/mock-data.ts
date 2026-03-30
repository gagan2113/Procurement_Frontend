// Mock data structured as if from APIs

export interface ProcurementRequest {
  id: string;
  item: string;
  category: string;
  quantity: number;
  budget: number;
  description: string;
  status: "Pending" | "Approved" | "Rejected" | "In Review";
  createdAt: string;
  requestedBy: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  performanceScore: number;
  pastOrders: number;
  isAiRecommended: boolean;
  location: string;
  contact: string;
}

export interface Bid {
  id: string;
  vendorId: string;
  vendorName: string;
  price: number;
  deliveryDays: number;
  complianceScore: number;
  rfqId: string;
}

export interface RFQ {
  id: string;
  title: string;
  status: "Draft" | "Sent" | "In Progress" | "Closed";
  vendors: string[];
  requirements: string;
  createdAt: string;
  deadline: string;
}

export interface PurchaseOrder {
  id: string;
  vendorName: string;
  items: { name: string; qty: number; unitPrice: number }[];
  totalCost: number;
  status: "Created" | "Sent" | "Acknowledged" | "Delivered";
  createdAt: string;
}

export interface Invoice {
  id: string;
  vendorName: string;
  amount: number;
  poId: string;
  status: "Pending" | "Matched" | "Mismatched" | "Ready for Payment" | "Flagged" | "Paid";
  items: { name: string; qty: number; unitPrice: number }[];
  receivedAt: string;
  poMatch: boolean;
  receiptMatch: boolean;
}

export interface Notification {
  id: string;
  type: "approval" | "alert" | "vendor" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export const procurementRequests: ProcurementRequest[] = [
  { id: "PR-001", item: "Dell Laptops", category: "IT Equipment", quantity: 50, budget: 75000, description: "Laptops for new hires Q2", status: "Approved", createdAt: "2025-03-10", requestedBy: "Sarah Chen" },
  { id: "PR-002", item: "Office Chairs", category: "Furniture", quantity: 100, budget: 25000, description: "Ergonomic chairs for HQ", status: "Pending", createdAt: "2025-03-12", requestedBy: "Mike Johnson" },
  { id: "PR-003", item: "Cloud Server Credits", category: "IT Services", quantity: 1, budget: 120000, description: "AWS credits for next quarter", status: "In Review", createdAt: "2025-03-14", requestedBy: "Aisha Patel" },
  { id: "PR-004", item: "Marketing Brochures", category: "Marketing", quantity: 5000, budget: 8000, description: "Product launch materials", status: "Approved", createdAt: "2025-03-08", requestedBy: "Tom Reed" },
  { id: "PR-005", item: "Safety Equipment", category: "Operations", quantity: 200, budget: 15000, description: "PPE for warehouse staff", status: "Rejected", createdAt: "2025-03-05", requestedBy: "Lisa Wang" },
  { id: "PR-006", item: "Standing Desks", category: "Furniture", quantity: 30, budget: 18000, description: "Adjustable desks for design team", status: "Pending", createdAt: "2025-03-15", requestedBy: "James Liu" },
  { id: "PR-007", item: "Software Licenses", category: "IT Services", quantity: 100, budget: 50000, description: "Annual Figma & Slack licenses", status: "In Review", createdAt: "2025-03-13", requestedBy: "Nina Torres" },
];

export const vendors: Vendor[] = [
  { id: "V-001", name: "TechWorld Supplies", category: "IT Equipment", rating: 4.8, performanceScore: 95, pastOrders: 32, isAiRecommended: true, location: "San Francisco, CA", contact: "sales@techworld.com" },
  { id: "V-002", name: "OfficeComfort Co.", category: "Furniture", rating: 4.5, performanceScore: 88, pastOrders: 15, isAiRecommended: false, location: "Austin, TX", contact: "orders@officecomfort.com" },
  { id: "V-003", name: "CloudFirst Inc.", category: "IT Services", rating: 4.9, performanceScore: 97, pastOrders: 8, isAiRecommended: true, location: "Seattle, WA", contact: "enterprise@cloudfirst.com" },
  { id: "V-004", name: "PrintPro Solutions", category: "Marketing", rating: 4.2, performanceScore: 82, pastOrders: 24, isAiRecommended: false, location: "Chicago, IL", contact: "info@printpro.com" },
  { id: "V-005", name: "SafeGuard Equipment", category: "Operations", rating: 4.6, performanceScore: 91, pastOrders: 12, isAiRecommended: true, location: "Houston, TX", contact: "supply@safeguard.com" },
  { id: "V-006", name: "ErgoSpace Design", category: "Furniture", rating: 4.7, performanceScore: 93, pastOrders: 6, isAiRecommended: true, location: "Portland, OR", contact: "hello@ergospace.com" },
];

export const rfqs: RFQ[] = [
  { id: "RFQ-001", title: "Laptop Procurement Q2", status: "In Progress", vendors: ["V-001", "V-003"], requirements: "50 units, i7 processor, 16GB RAM", createdAt: "2025-03-11", deadline: "2025-03-25" },
  { id: "RFQ-002", title: "Office Furniture Package", status: "Sent", vendors: ["V-002", "V-006"], requirements: "100 chairs + 30 desks", createdAt: "2025-03-13", deadline: "2025-03-28" },
  { id: "RFQ-003", title: "Cloud Infrastructure", status: "Closed", vendors: ["V-003"], requirements: "Annual AWS/Azure credits", createdAt: "2025-02-20", deadline: "2025-03-10" },
  { id: "RFQ-004", title: "Safety PPE Bulk Order", status: "Draft", vendors: ["V-005"], requirements: "200 units of safety gear", createdAt: "2025-03-15", deadline: "2025-04-01" },
];

export const bids: Bid[] = [
  { id: "B-001", vendorId: "V-001", vendorName: "TechWorld Supplies", price: 72000, deliveryDays: 14, complianceScore: 96, rfqId: "RFQ-001" },
  { id: "B-002", vendorId: "V-003", vendorName: "CloudFirst Inc.", price: 78000, deliveryDays: 10, complianceScore: 92, rfqId: "RFQ-001" },
  { id: "B-003", vendorId: "V-002", vendorName: "OfficeComfort Co.", price: 38000, deliveryDays: 21, complianceScore: 88, rfqId: "RFQ-002" },
  { id: "B-004", vendorId: "V-006", vendorName: "ErgoSpace Design", price: 42000, deliveryDays: 18, complianceScore: 94, rfqId: "RFQ-002" },
  { id: "B-005", vendorId: "V-005", vendorName: "SafeGuard Equipment", price: 13500, deliveryDays: 7, complianceScore: 90, rfqId: "RFQ-004" },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: "PO-001", vendorName: "TechWorld Supplies", items: [{ name: "Dell Latitude 5540", qty: 50, unitPrice: 1440 }], totalCost: 72000, status: "Delivered", createdAt: "2025-03-15" },
  { id: "PO-002", vendorName: "CloudFirst Inc.", items: [{ name: "AWS Credits Package", qty: 1, unitPrice: 115000 }], totalCost: 115000, status: "Sent", createdAt: "2025-03-18" },
  { id: "PO-003", vendorName: "PrintPro Solutions", items: [{ name: "Product Brochures A4", qty: 5000, unitPrice: 1.5 }], totalCost: 7500, status: "Acknowledged", createdAt: "2025-03-12" },
];

export const invoices: Invoice[] = [
  { id: "INV-001", vendorName: "TechWorld Supplies", amount: 72000, poId: "PO-001", status: "Ready for Payment", items: [{ name: "Dell Latitude 5540", qty: 50, unitPrice: 1440 }], receivedAt: "2025-03-20", poMatch: true, receiptMatch: true },
  { id: "INV-002", vendorName: "PrintPro Solutions", amount: 7800, poId: "PO-003", status: "Mismatched", items: [{ name: "Product Brochures A4", qty: 5000, unitPrice: 1.56 }], receivedAt: "2025-03-19", poMatch: false, receiptMatch: true },
  { id: "INV-003", vendorName: "CloudFirst Inc.", amount: 115000, poId: "PO-002", status: "Pending", items: [{ name: "AWS Credits Package", qty: 1, unitPrice: 115000 }], receivedAt: "2025-03-22", poMatch: true, receiptMatch: false },
];

export const notifications: Notification[] = [
  { id: "N-001", type: "approval", title: "PR-001 Approved", message: "Dell Laptops request has been approved by Finance", timestamp: "2025-03-15T10:30:00", read: false },
  { id: "N-002", type: "alert", title: "Budget Exceeded", message: "Cloud Server Credits request exceeds quarterly budget by 15%", timestamp: "2025-03-14T14:00:00", read: false },
  { id: "N-003", type: "vendor", title: "New Bid Received", message: "TechWorld Supplies submitted bid for RFQ-001", timestamp: "2025-03-13T09:15:00", read: true },
  { id: "N-004", type: "info", title: "RFQ-003 Closed", message: "Cloud Infrastructure RFQ deadline has passed", timestamp: "2025-03-10T18:00:00", read: true },
  { id: "N-005", type: "alert", title: "Delivery Delay", message: "PO-003 shipment delayed by 3 days", timestamp: "2025-03-18T11:45:00", read: false },
  { id: "N-006", type: "approval", title: "Invoice Mismatch", message: "INV-002 has price discrepancy with PO-003", timestamp: "2025-03-19T16:20:00", read: false },
];

export const recentActivity = [
  { action: "Request Created", detail: "PR-007 Software Licenses submitted", time: "2 hours ago", icon: "plus" },
  { action: "Bid Received", detail: "SafeGuard Equipment bid on RFQ-004", time: "4 hours ago", icon: "inbox" },
  { action: "PO Delivered", detail: "PO-001 Dell Laptops delivered", time: "1 day ago", icon: "check" },
  { action: "Invoice Flagged", detail: "INV-002 price mismatch detected", time: "1 day ago", icon: "alert" },
  { action: "Vendor Approved", detail: "ErgoSpace Design added to panel", time: "2 days ago", icon: "star" },
];

export const spendData = [
  { month: "Oct", spend: 85000, budget: 100000 },
  { month: "Nov", spend: 92000, budget: 100000 },
  { month: "Dec", spend: 78000, budget: 95000 },
  { month: "Jan", spend: 105000, budget: 100000 },
  { month: "Feb", spend: 88000, budget: 100000 },
  { month: "Mar", spend: 95000, budget: 110000 },
];

export const categorySpend = [
  { category: "IT Equipment", amount: 147000, color: "hsl(217, 91%, 50%)" },
  { category: "IT Services", amount: 170000, color: "hsl(160, 60%, 45%)" },
  { category: "Furniture", amount: 43000, color: "hsl(38, 92%, 50%)" },
  { category: "Marketing", amount: 8000, color: "hsl(258, 60%, 55%)" },
  { category: "Operations", amount: 15000, color: "hsl(0, 72%, 51%)" },
];
