import { 
  LayoutDashboard, 
  FolderKanban, 
  FileText, 
  Settings, 
  LogOut,
  HardHat
} from "lucide-react";

export interface Project {
  id: string;
  name: string;
  client: string;
  status: "Active" | "Submitted" | "Closed-Won" | "Closed-Lost";
  dueDate: string;
  value: number;
  progress: number;
}

export interface Stat {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
}

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Skyline Office Complex Renovation",
    client: "Apex Real Estate",
    status: "Active",
    dueDate: "2025-12-15",
    value: 1250000,
    progress: 45
  },
  {
    id: "2",
    name: "Harbor Bridge Maintenance",
    client: "City Infrastructure Dept",
    status: "Submitted",
    dueDate: "2025-11-30",
    value: 850000,
    progress: 100
  },
  {
    id: "3",
    name: "Tech Park Phase 2",
    client: "Innovate Corp",
    status: "Closed-Won",
    dueDate: "2025-10-15",
    value: 3400000,
    progress: 100
  },
  {
    id: "4",
    name: "Community Center Annex",
    client: "Local Council",
    status: "Closed-Lost",
    dueDate: "2025-09-01",
    value: 450000,
    progress: 100
  },
  {
    id: "5",
    name: "Industrial Warehouse B",
    client: "Logistics Giant",
    status: "Active",
    dueDate: "2026-01-20",
    value: 2100000,
    progress: 15
  }
];

export const mockStats: Stat[] = [
  { label: "Active Bids", value: "5", change: "+2 this week", trend: "up" },
  { label: "Win Rate", value: "68%", change: "+5% vs last Q", trend: "up" },
  { label: "Pipeline Value", value: "$4.2M", change: "-$0.5M vs last Q", trend: "down" },
  { label: "Proposals Due", value: "2", change: "Next 7 days", trend: "neutral" },
];

export const mockPipelineData = [
  { name: "Prospecting", value: 12 },
  { name: "Estimating", value: 8 },
  { name: "Review", value: 5 },
  { name: "Submitted", value: 3 },
  { name: "Won", value: 15 },
];

export const mockFiles = [
  { id: 1, name: "RFP_Skyline_Renovation.pdf", type: "pdf", size: "2.4 MB", date: "2025-12-01" },
  { id: 2, name: "Specs_v2.docx", type: "docx", size: "1.1 MB", date: "2025-12-01" },
  { id: 3, name: "Site_Photos.zip", type: "zip", size: "15.4 MB", date: "2025-12-02" },
  { id: 4, name: "Email_Thread_Client.msg", type: "msg", size: "45 KB", date: "2025-12-02" },
];

export const initialEditorContent = `
<h1>Bid Proposal: Skyline Office Complex Renovation</h1>
<p>Prepared for: <strong>Apex Real Estate</strong></p>
<p>Date: December 2, 2025</p>

<h2>1. Executive Summary</h2>
<p>BidForge Construction is pleased to submit this proposal for the renovation of the Skyline Office Complex. Our team brings over 15 years of experience in high-rise commercial renovations, ensuring minimal disruption to existing tenants while delivering modern, energy-efficient workspaces.</p>

<h2>2. Scope of Work</h2>
<p>The project scope includes the following key areas:</p>
<ul>
  <li>Demolition of existing interior partitions on floors 15-20.</li>
  <li>Installation of new HVAC systems with smart climate control.</li>
  <li>Electrical upgrades to support modern IT infrastructure.</li>
  <li>High-end finishes for lobby and common areas.</li>
</ul>

<h2>3. Project Timeline</h2>
<table>
  <thead>
    <tr>
      <th>Phase</th>
      <th>Duration</th>
      <th>Start Date</th>
      <th>End Date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Mobilization</td>
      <td>2 Weeks</td>
      <td>Jan 15, 2026</td>
      <td>Jan 29, 2026</td>
    </tr>
    <tr>
      <td>Demolition</td>
      <td>4 Weeks</td>
      <td>Jan 30, 2026</td>
      <td>Feb 27, 2026</td>
    </tr>
    <tr>
      <td>Construction</td>
      <td>12 Weeks</td>
      <td>Feb 28, 2026</td>
      <td>May 23, 2026</td>
    </tr>
     <tr>
      <td>Finishing</td>
      <td>4 Weeks</td>
      <td>May 24, 2026</td>
      <td>Jun 21, 2026</td>
    </tr>
  </tbody>
</table>

<h2>4. Cost Estimate</h2>
<p>Our total fixed-price bid for this project is <strong>$1,250,000</strong>. This includes all labor, materials, and project management fees.</p>
`;
