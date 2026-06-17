import React, { useState } from "react";
import {
  Cpu,
  Wifi,
  WifiOff,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  PlusCircle,
  Layers,
  Database,
  BarChart3,
  ListOrdered,
  Activity,
  History,
  Settings as SettingsIcon,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Clock,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  X,
  Server,
  Store,
  CreditCard,
  Truck,
  Package,
  PackageCheck,
  ThumbsUp,
  ThumbsDown,
  Banknote,
  MapPin,
  User
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRuralSync, DemoStep } from "./useRuralSync";
import ESP32Mockup from "./components/ESP32Mockup";
import { SidebarTab, Order } from "./types";

// ─── Status badge helper ───────────────────────────────────────────────────────
function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const cfg: Record<Order["status"], { cls: string; label: string }> = {
    Pending:          { cls: "bg-amber-400 text-slate-950 font-black animate-pulse",                label: "BUFFERED OFFLINE" },
    Synced:           { cls: "bg-blue-500/20 text-blue-300 border border-blue-500/30",              label: "SYNCED" },
    Failed:           { cls: "bg-red-500/20 text-red-400 border border-red-500/30",                 label: "FAILED" },
    Proposed:         { cls: "bg-orange-500/20 text-orange-400 border border-orange-500/30",        label: "PROPOSED" },
    "Pending Approval": { cls: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",      label: "PENDING APPROVAL" },
    "Payment Pending":  { cls: "bg-violet-500/20 text-violet-300 border border-violet-500/30",      label: "PAYMENT PENDING" },
    Paid:             { cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",     label: "PAID" },
    "In Transit":     { cls: "bg-sky-500/20 text-sky-300 border border-sky-500/30",                 label: "IN TRANSIT" },
    Delivered:        { cls: "bg-teal-500/20 text-teal-300 border border-teal-500/30",              label: "DELIVERED ✓" },
  };
  const { cls, label } = cfg[status] ?? { cls: "bg-slate-700 text-slate-300", label: status.toUpperCase() };
  return (
    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] tracking-wide inline-block ${cls}`}>
      {label}
    </span>
  );
}

// ─── Architecture flow diagram ─────────────────────────────────────────────────
function ArchitectureFlow({ isInternetAvailable }: { isInternetAvailable: boolean }) {
  const nodes = [
    { icon: User,        label: "Rural Customer",  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
    { icon: Smartphone,  label: "Customer Portal", color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20" },
    { icon: Cpu,         label: "ESP32 Gateway",   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
    { icon: Database,    label: "Cloud Database",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { icon: Store,       label: "Supplier Portal", color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {nodes.map((node, i) => {
        const Icon = node.icon;
        const isGateway = i === 2;
        return (
          <React.Fragment key={node.label}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${node.bg} text-xs font-semibold ${node.color} ${isGateway && !isInternetAvailable ? "ring-2 ring-red-500/50" : ""}`}>
              <Icon className="w-3 h-3" />
              <span className="hidden sm:block">{node.label}</span>
            </div>
            {i < nodes.length - 1 && (
              <ArrowRight className={`w-3 h-3 shrink-0 ${isInternetAvailable ? "text-emerald-500" : i === 1 ? "text-red-500 animate-pulse" : "text-slate-700"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function App() {
  const {
    orders,
    deviceStatus,
    events,
    syncLogs,
    isInternetAvailable,
    loading,
    notifications,
    demoActive,
    demoMessage,
    demoSteps,
    addOrder,
    approveOrder,
    rejectOrder,
    supplierApprove,
    supplierReject,
    dispatchOrder,
    markDelivered,
    payOrder,
    toggleNetworkState,
    triggerSync,
    restartDevice,
    resetDemo,
    runFullDemo,
    addNotification
  } = useRuralSync();

  const [activeTab, setActiveTab] = useState<SidebarTab>("dashboard");
  const [settingsSubTab, setSettingsSubTab] = useState<"general" | "esp32">("general");
  const [copiedCode, setCopiedCode] = useState(false);
  const [orderForm, setOrderForm] = useState({
    productName: "",
    quantity: 1,
    retailerName: "",
    priority: "Medium" as "Low" | "Medium" | "High"
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Order["status"]>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "Low" | "Medium" | "High">("All");
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const sampleProducts = [
    { name: "Solar Irrigation Controller V2",  prefix: "Agtech" },
    { name: "LittleFS Expansion SD Module",    prefix: "IoT-Edge" },
    { name: "Soil Humidity Multi-Probe",        prefix: "Sensor" },
    { name: "High-Yield Wheat Seed Case",       prefix: "BioCorp" },
    { name: "Off-Grid Deep Cycle Battery v4",   prefix: "SolarIsle" },
    { name: "E-Paper Retail Label Tag",         prefix: "EdgeSign" }
  ];

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.productName || !orderForm.retailerName) {
      addNotification("Please fill in all order properties", "warning");
      return;
    }
    setIsSubmitLoading(true);
    await addOrder(orderForm.productName, orderForm.quantity, orderForm.retailerName, orderForm.priority);
    setIsSubmitLoading(false);
    setOrderForm(prev => ({ ...prev, productName: "", quantity: 1 }));
  };

  const fillQuickOrder = (name: string) => {
    setOrderForm(prev => ({ ...prev, productName: name, retailerName: prev.retailerName || "Balaji Agrotech Co-op" }));
  };

  const handleHardwareGPIONode = async () => {
    const products = ["ESP32 Probe Node", "Smart Flowmeter", "Autonomous Seed Injector", "LoRa Retail Node"];
    const retailers = ["Anand Farms Store", "Devi Agri-Supply Ltd", "Sai Baba Agro", "Himalayan Co-op"];
    const priorities: ("Low" | "Medium" | "High")[] = ["Low", "Medium", "High"];
    addNotification("ESP32 GPIO 12 Tactile Click Registering...", "info");
    await addOrder(
      products[Math.floor(Math.random() * products.length)],
      1,
      retailers[Math.floor(Math.random() * retailers.length)],
      priorities[Math.floor(Math.random() * priorities.length)],
      true
    );
  };

  // Filtered orders list
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || order.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || order.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Computed counts
  const totalOrdersCount    = orders.length;
  const syncedOrdersCount   = orders.filter(o => o.status === "Synced" || o.status === "Delivered" || o.status === "In Transit" || o.status === "Paid" || o.status === "Payment Pending" || o.status === "Pending Approval").length;
  const pendingOrdersCount  = orders.filter(o => o.status === "Pending").length;
  const ordersOnESP32       = orders.filter(o => o.storageLocation === "ESP32 Local Buffer").length;
  const supplierQueueCount  = orders.filter(o => o.status === "Pending Approval").length;
  const paymentPendingCount = orders.filter(o => o.status === "Payment Pending").length;
  const inTransitCount      = orders.filter(o => o.status === "In Transit").length;
  const deliveredCount      = orders.filter(o => o.status === "Delivered").length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden relative">

      {/* Ambient Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-950/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[35%] h-[35%] rounded-full bg-purple-900/5 blur-[120px] pointer-events-none" />

      <div className="flex w-full min-h-screen relative z-10">

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/60 p-6 flex flex-col justify-between">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3.5 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                ⚡
              </div>
              <div>
                <span className="text-xs text-blue-400 font-mono font-bold tracking-widest leading-none block">EDGE COMPUTING</span>
                <h1 className="text-xl font-bold tracking-tight text-white leading-tight">RuralSync</h1>
              </div>
            </div>

            <div className="space-y-1.5">
              {/* Core Workspace */}
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block px-3 mb-2.5">Core Workspace</span>
              {[
                { id: "dashboard", label: "Dashboard",            icon: Layers },
                { id: "orders",   label: "Orders Queue",          icon: ListOrdered, badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined },
                { id: "sync",     label: "Synchronization Center", icon: RefreshCw },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as SidebarTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer ${isActive ? "bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20 shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent"}`}>
                    <span className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </span>
                    {tab.badge && (
                      <span className="bg-amber-400 text-slate-950 font-bold font-mono text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{tab.badge}</span>
                    )}
                  </button>
                );
              })}

              {/* Portals */}
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block px-3 pt-5 mb-2.5">Portals</span>
              {[
                { id: "supplier", label: "Supplier Portal",  icon: Store,      badge: supplierQueueCount > 0 ? supplierQueueCount : undefined, badgeColor: "bg-rose-400" },
                { id: "customer", label: "Customer Portal",  icon: CreditCard, badge: paymentPendingCount > 0 ? paymentPendingCount : undefined, badgeColor: "bg-violet-400" },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as SidebarTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer ${isActive ? "bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20" : "text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent"}`}>
                    <span className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </span>
                    {tab.badge && (
                      <span className={`${tab.badgeColor} text-slate-950 font-bold font-mono text-[10px] px-1.5 py-0.5 rounded-full animate-pulse`}>{tab.badge}</span>
                    )}
                  </button>
                );
              })}

              {/* IoT Edge System */}
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block px-3 pt-5 mb-2.5">IoT Edge System</span>
              {[
                { id: "monitoring", label: "ESP32 Device Monitor",  icon: Cpu },
                { id: "control",    label: "IoT Control Center",    icon: Smartphone },
                { id: "analytics",  label: "Analytics Suite",       icon: BarChart3 },
                { id: "history",    label: "Sync History Logs",     icon: History },
                { id: "settings",   label: "System Setup",          icon: SettingsIcon }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as SidebarTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer ${isActive ? "bg-blue-600/10 text-blue-400 font-medium border border-blue-500/20" : "text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent"}`}>
                    <span className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="space-y-4 pt-6 border-t border-slate-800/60">
            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Signal & Latency</span>
                <span className={`w-2.5 h-2.5 rounded-full ${isInternetAvailable ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-mono">{deviceStatus?.deviceId ?? "ESP32-RuralSync"}</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded">{isInternetAvailable ? "52ms" : "Offline"}</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Buffer Pool</span>
                <span className="text-amber-400 font-bold font-mono">{pendingOrdersCount} orders waiting</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 text-center font-mono leading-relaxed">
              RuralSync Edge Platform v1.2.0<br/>Safe Fail-Safe Protocol Enabled
            </div>
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-h-screen bg-slate-950 relative overflow-y-auto">

          {/* Top Navbar */}
          <header className="h-20 border-b border-slate-900/80 bg-slate-950/40 backdrop-blur-md shrink-0 flex items-center justify-between px-8 z-20">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">
                {activeTab.toUpperCase()} FRAMEWORK
              </span>
              <div className="h-4 w-px bg-slate-800" />
              <div className={`text-[11px] px-3 py-1 rounded-full font-bold border flex items-center gap-2 select-none ${isInternetAvailable ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10" : "text-red-400 bg-red-500/5 border-red-500/10"}`}>
                <Wifi className="w-3.5 h-3.5" />
                <span>{isInternetAvailable ? "CLOUD ENDPOINT ONLINE • STABLE" : "OUTAGE PROTOCOL INJECTED • LOCAL STORAGE ONLY"}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={resetDemo} className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-all">
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                Reset Demo DB
              </button>
              <button onClick={runFullDemo} disabled={demoActive}
                className={`bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-blue-900/30 tracking-wide flex items-center gap-2 transition-all ${demoActive ? "opacity-50 cursor-not-allowed" : ""}`}>
                <Play className="w-3.5 h-3.5 fill-current" />
                {demoActive ? "Demo Running..." : "Run 14-Step Demo"}
              </button>
            </div>
          </header>

          {/* Architecture Flow Banner */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/40 to-slate-950 border-b border-slate-900 px-8 py-3 flex items-center justify-between gap-4">
            <ArchitectureFlow isInternetAvailable={isInternetAvailable} />
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 select-none">IoT Entry #4829</div>
          </div>

          <div className="flex-1 p-8 space-y-8 z-10 max-w-7xl w-full mx-auto">

            {/* ── KPI Grid ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              {[
                { label: "Total Orders",        value: totalOrdersCount,    color: "text-white",         sub: "All records" },
                { label: "Cloud Synced",         value: syncedOrdersCount,   color: "text-emerald-400",   sub: "In Cloud DB" },
                { label: "Offline Buffer",        value: pendingOrdersCount,  color: "text-amber-400",     sub: "LittleFS pending", pulse: pendingOrdersCount > 0 },
                { label: "ESP32 Local",           value: ordersOnESP32,       color: "text-orange-400",    sub: "/orders.txt" },
                { label: "Supplier Queue",        value: supplierQueueCount,  color: "text-yellow-300",    sub: "Pending Approval", pulse: supplierQueueCount > 0 },
                { label: "Awaiting Payment",      value: paymentPendingCount, color: "text-violet-400",    sub: "Pay Now", pulse: paymentPendingCount > 0 },
                { label: "In Transit",            value: inTransitCount,      color: "text-sky-400",       sub: "Being shipped" },
                { label: "Delivered",             value: deliveredCount,       color: "text-teal-400",      sub: "Completed" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-medium leading-tight">{kpi.label}</span>
                  <p className={`text-2xl font-bold mt-1 ${kpi.color} ${kpi.pulse ? "animate-pulse" : ""}`}>{kpi.value}</p>
                  <div className="mt-1 text-[10px] text-slate-500 font-mono">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Demo Steps Banner */}
            <AnimatePresence>
              {demoActive && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-900/80 rounded-2xl p-5 border border-blue-500/20">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <span className="text-xs text-blue-400 font-bold flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                      14-STEP COMPETITION DEMO IN PROGRESS
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">IoT Edge Gateway Sequence Active</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    ⚡ {demoMessage}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                    {demoSteps.map((step, idx) => (
                      <div key={step.name}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          step.status === "running"  ? "bg-blue-600/20 border-blue-500 shadow-md text-white animate-pulse"
                        : step.status === "success" ? "bg-emerald-600/5 border-emerald-500/30 text-emerald-400"
                        : "bg-slate-950/40 border-slate-800/80 text-slate-500"}`}>
                        <span className="text-[9px] text-slate-400 font-mono block mb-0.5">{String(idx + 1).padStart(2, "0")}</span>
                        <p className="text-[9px] leading-tight font-semibold">{step.name}</p>
                        {step.status === "success" && <span className="text-[8px] text-emerald-400">✓ Done</span>}
                        {step.status === "running"  && <span className="text-[8px] text-blue-300">● Active</span>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Tab Content ──────────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">

              {/* ── TAB: DASHBOARD ─────────────────────────────────────────── */}
              {activeTab === "dashboard" && (
                <motion.div key="tab-dashboard" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  <div className="col-span-1 space-y-6">
                    <ESP32Mockup
                      status={deviceStatus ?? { deviceId: "ESP32-RuralSync-001", signalStrength: -65, memoryUsage: 38, cpuUsage: 12, uptime: 4850, status: "ONLINE", lastHeartbeat: new Date().toISOString(), ordersStoredLocally: 0, ordersSynced: 3, failedSyncAttempts: 0 }}
                      events={events} orders={orders} isInternetAvailable={isInternetAvailable}
                      onRestart={restartDevice} onHardwareButtonOrder={handleHardwareGPIONode} />

                    <div className="bg-slate-900/20 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Hardware Jitter Tool</h3>
                        <span className="text-[11px] text-blue-400 font-mono">Edge Control</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Outage Injector State:</span>
                          <span className={`font-mono ${isInternetAvailable ? "text-emerald-400" : "text-red-400"}`}>
                            {isInternetAvailable ? "INTERNET_UP" : "INTERNET_OUTAGE"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => toggleNetworkState(false)} className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold py-2 rounded-xl transition-all cursor-pointer">Kill Internet</button>
                          <button onClick={() => toggleNetworkState(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-2 rounded-xl transition-all cursor-pointer">Restore Internet</button>
                        </div>
                        <button onClick={triggerSync} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl border border-slate-700/60 transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer mt-2">
                          <RefreshCw className="w-3.5 h-3.5" />Initiate Cloud Synchronization
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 space-y-6">
                    {/* Order Form */}
                    <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-850">
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Fast Merchant Terminal</h3>
                        <span className="text-xs bg-blue-950 text-blue-400 px-2.5 py-0.5 rounded font-mono">GPIO 04 Map</span>
                      </div>
                      <form onSubmit={handleOrderSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Retailer Shop Name</label>
                            <input type="text" required placeholder="e.g. Anand Rural Cooperatives" value={orderForm.retailerName}
                              onChange={(e) => setOrderForm(prev => ({ ...prev, retailerName: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Product Description</label>
                            <input type="text" required placeholder="e.g. Solar Pump Inverter Kit" value={orderForm.productName}
                              onChange={(e) => setOrderForm(prev => ({ ...prev, productName: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Quantity</label>
                            <input type="number" min="1" max="1000" required value={orderForm.quantity}
                              onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-mono" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Priority</label>
                            <select value={orderForm.priority} onChange={(e) => setOrderForm(prev => ({ ...prev, priority: e.target.value as any }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer">
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] text-slate-500 font-mono flex items-center pt-1 pr-1">Q-Stock:</span>
                          {sampleProducts.map((p) => (
                            <button key={p.name} type="button" onClick={() => fillQuickOrder(p.name)}
                              className="text-[9px] bg-slate-900 hover:bg-slate-800 text-slate-300 px-2 py-1 rounded transition-colors border border-slate-800">
                              + {p.name}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-[10px] text-slate-400 max-w-sm">
                            <span className="text-amber-500 font-bold">INFO:</span> If offline, order routes to LittleFS and is marked{" "}
                            <span className="bg-amber-400 text-slate-950 px-1 rounded text-[9px] font-bold">PENDING</span>.
                          </p>
                          <button type="submit" disabled={isSubmitLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer">
                            <PlusCircle className="w-4 h-4" />
                            {isSubmitLoading ? "Saving..." : "Place Order"}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Activity Feed + Live Orders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-5 border border-slate-800/80 flex flex-col h-[320px]">
                        <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-850 pb-2">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />Live Activity Feed
                          </span>
                          <span className="text-[9px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono animate-pulse">STREAM LOGS</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                          {events.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-10 italic">Listening for hardware status events...</p>
                          ) : (
                            events.slice(0, 10).map((evt) => {
                              const text = evt.event.toLowerCase();
                              let colorClass = "bg-blue-500";
                              if (text.includes("lost") || text.includes("outage") || text.includes("fail") || text.includes("reject")) colorClass = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
                              else if (text.includes("restored") || text.includes("completed") || text.includes("booted") || text.includes("success") || text.includes("delivered") || text.includes("paid")) colorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
                              else if (text.includes("buffered") || text.includes("restart") || text.includes("pending") || text.includes("payment")) colorClass = "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]";
                              else if (text.includes("dispatch") || text.includes("transit")) colorClass = "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]";
                              return (
                                <div key={evt.id} className="flex gap-3 text-xs">
                                  <div className="w-px bg-slate-800 relative left-1.5 my-1 shrink-0">
                                    <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${colorClass}`} />
                                  </div>
                                  <div className="pl-3.5">
                                    <p className="font-semibold text-slate-200 leading-snug">{evt.event}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{new Date(evt.timestamp).toLocaleTimeString()}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-5 border border-slate-800/80 flex flex-col h-[320px]">
                        <div className="flex items-center justify-between mb-4 shrink-0 border-b border-slate-850 pb-2">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                            <ListOrdered className="w-4 h-4 text-emerald-400" />Live Orders Queue
                          </span>
                          <button onClick={() => setActiveTab("orders")} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer">
                            Full Queue <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                          {orders.slice(0, 6).map((order) => (
                            <div key={order.id} className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${order.status === "Pending" ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-950/60 border-slate-800/80"}`}>
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">{order.orderId}</span>
                                  <span className="font-semibold text-slate-200 text-xs truncate max-w-[100px]">{order.productName}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 truncate block mt-0.5">{order.retailerName}</span>
                              </div>
                              <OrderStatusBadge status={order.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: ORDERS QUEUE ───────────────────────────────────────── */}
              {activeTab === "orders" && (
                <motion.div key="tab-orders" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-850">
                      <div>
                        <h3 className="text-lg font-bold text-white">Retailer Orders Queue Database</h3>
                        <p className="text-xs text-slate-400 mt-1">Full order lifecycle from creation to delivery.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input type="text" placeholder="Search Order, Retailer..." value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono" />
                        </div>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer">
                          <option value="All">All Statuses</option>
                          <option value="Pending">Buffered Offline</option>
                          <option value="Synced">Synced</option>
                          <option value="Pending Approval">Pending Approval</option>
                          <option value="Payment Pending">Payment Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="In Transit">In Transit</option>
                          <option value="Delivered">Delivered</option>
                        </select>
                        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer">
                          <option value="All">All Priorities</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-850">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900/60 text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800">
                            <th className="px-4 py-3 font-semibold text-center w-12">#</th>
                            <th className="px-4 py-3 font-semibold">Order ID</th>
                            <th className="px-4 py-3 font-semibold">Product</th>
                            <th className="px-4 py-3 font-semibold">Retailer</th>
                            <th className="px-4 py-3 font-semibold text-center">Qty</th>
                            <th className="px-4 py-3 font-semibold">Priority</th>
                            <th className="px-4 py-3 font-semibold">Timestamp</th>
                            <th className="px-4 py-3 font-semibold text-center">Status</th>
                            <th className="px-4 py-3 font-semibold text-right">Storage</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-850">
                          {filteredOrders.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-10 italic text-slate-500">No records match filters.</td></tr>
                          ) : (
                            filteredOrders.map((order, idx) => (
                              <tr key={order.id} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-4 py-4 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                                <td className="px-4 py-4 font-mono font-bold text-slate-200">{order.orderId}</td>
                                <td className="px-4 py-4 font-semibold text-slate-100">{order.productName}</td>
                                <td className="px-4 py-4 text-slate-300">{order.retailerName}</td>
                                <td className="px-4 py-4 text-center font-mono text-slate-300">{order.quantity}</td>
                                <td className="px-4 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${order.priority === "High" ? "bg-red-500/10 text-red-400" : order.priority === "Medium" ? "bg-blue-500/15 text-blue-300" : "bg-slate-800 text-slate-400"}`}>
                                    {order.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-slate-400 font-mono text-[10px]">{new Date(order.timestamp).toLocaleString()}</td>
                                <td className="px-4 py-4 text-center"><OrderStatusBadge status={order.status} /></td>
                                <td className="px-4 py-4 text-right font-mono text-[11px] font-bold uppercase">
                                  <span className={order.storageLocation === "Cloud" ? "text-blue-400" : "text-amber-400 italic"}>
                                    {order.storageLocation}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: SUPPLIER PORTAL ─────────────────────────────────────── */}
              {activeTab === "supplier" && (
                <motion.div key="tab-supplier" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">

                  {/* Header card */}
                  <div className="bg-gradient-to-br from-rose-950/30 to-slate-900/20 border border-rose-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center">
                        <Store className="w-6 h-6 text-rose-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Supplier Portal</h2>
                        <p className="text-xs text-slate-400">Urban supplier dashboard — manage incoming rural orders</p>
                      </div>
                      <div className="ml-auto flex gap-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-300">{supplierQueueCount}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Needs Review</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-sky-400">{inTransitCount}</div>
                          <div className="text-[10px] text-slate-400 font-mono">In Transit</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-teal-400">{deliveredCount}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Delivered</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pending Approval Section */}
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-yellow-500/10">
                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
                      <div className="w-8 h-8 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center">
                        <ThumbsUp className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Orders Awaiting Supplier Approval</h3>
                        <p className="text-[11px] text-slate-400">Review and approve or reject incoming rural orders</p>
                      </div>
                      <span className="ml-auto bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">{supplierQueueCount} pending</span>
                    </div>

                    {orders.filter(o => o.status === "Pending Approval").length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8 italic">No orders pending approval. Orders will appear here after ESP32 sync.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orders.filter(o => o.status === "Pending Approval").map((order) => (
                          <div key={order.id} className="bg-slate-950 border border-yellow-500/15 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-300">{order.orderId}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.priority === "High" ? "bg-red-500/10 text-red-400" : order.priority === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>{order.priority}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white leading-tight">{order.productName}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{order.retailerName}</p>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                              <span>Qty: <span className="text-slate-300 font-bold">{order.quantity}</span></span>
                              <span>{new Date(order.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => supplierReject(order.id)}
                                className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 text-[11px] font-bold py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1">
                                <ThumbsDown className="w-3.5 h-3.5" /> Reject
                              </button>
                              <button onClick={() => supplierApprove(order.id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow shadow-emerald-900/30">
                                <ThumbsUp className="w-3.5 h-3.5" /> Approve
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Paid — Ready to Dispatch */}
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-emerald-500/10">
                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
                      <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Truck className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Paid Orders — Ready to Dispatch</h3>
                        <p className="text-[11px] text-slate-400">Payment confirmed by customer. Dispatch to ship.</p>
                      </div>
                    </div>
                    {orders.filter(o => o.status === "Paid").length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8 italic">No paid orders ready to dispatch.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orders.filter(o => o.status === "Paid").map((order) => (
                          <div key={order.id} className="bg-slate-950 border border-emerald-500/15 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-300">{order.orderId}</span>
                              <OrderStatusBadge status={order.status} />
                            </div>
                            <p className="text-sm font-semibold text-white">{order.productName}</p>
                            <p className="text-[11px] text-slate-400">{order.retailerName} • Qty: {order.quantity}</p>
                            <button onClick={() => dispatchOrder(order.id)}
                              className="w-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow shadow-sky-900/30">
                              <Truck className="w-3.5 h-3.5" /> Dispatch Order
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* In Transit — Confirm Delivery */}
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-sky-500/10">
                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
                      <div className="w-8 h-8 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-sky-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">In Transit — Confirm Delivery</h3>
                        <p className="text-[11px] text-slate-400">Shipments currently on the road. Mark as delivered when received.</p>
                      </div>
                    </div>
                    {orders.filter(o => o.status === "In Transit").length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8 italic">No shipments currently in transit.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orders.filter(o => o.status === "In Transit").map((order) => (
                          <div key={order.id} className="bg-slate-950 border border-sky-500/15 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-300">{order.orderId}</span>
                              <OrderStatusBadge status={order.status} />
                            </div>
                            <p className="text-sm font-semibold text-white">{order.productName}</p>
                            <p className="text-[11px] text-slate-400">{order.retailerName} • Qty: {order.quantity}</p>
                            <button onClick={() => markDelivered(order.id)}
                              className="w-full bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow shadow-teal-900/30">
                              <PackageCheck className="w-3.5 h-3.5" /> Mark Delivered
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── TAB: CUSTOMER PORTAL ─────────────────────────────────────── */}
              {activeTab === "customer" && (
                <motion.div key="tab-customer" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">

                  {/* Header */}
                  <div className="bg-gradient-to-br from-violet-950/30 to-slate-900/20 border border-violet-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-violet-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Customer Portal</h2>
                        <p className="text-xs text-slate-400">Track your orders and complete pending payments</p>
                      </div>
                      <div className="ml-auto flex gap-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-violet-400">{paymentPendingCount}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Pay Now</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-sky-400">{inTransitCount}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Shipping</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-teal-400">{deliveredCount}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Received</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Pending — Pay Now */}
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-violet-500/10">
                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
                      <div className="w-8 h-8 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center">
                        <Banknote className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Payment Pending — Pay Now</h3>
                        <p className="text-[11px] text-slate-400">Supplier has approved your orders. Complete payment to proceed.</p>
                      </div>
                      {paymentPendingCount > 0 && (
                        <span className="ml-auto bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono font-bold text-xs px-2.5 py-1 rounded-lg animate-pulse">{paymentPendingCount} awaiting</span>
                      )}
                    </div>

                    {orders.filter(o => o.status === "Payment Pending").length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8 italic">No payments pending. Your orders are either being processed or already paid.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orders.filter(o => o.status === "Payment Pending").map((order) => (
                          <div key={order.id} className="bg-slate-950 border border-violet-500/20 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full translate-x-8 -translate-y-8 blur-xl pointer-events-none" />
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-300">{order.orderId}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.priority === "High" ? "bg-red-500/10 text-red-400" : order.priority === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>{order.priority}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white leading-tight">{order.productName}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{order.retailerName}</p>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                              <span>Qty: <span className="text-slate-300 font-bold">{order.quantity}</span></span>
                              <span>{new Date(order.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-2.5 flex items-center justify-between">
                              <span className="text-[11px] text-slate-400">Supplier approved ✓</span>
                              <span className="text-xs text-violet-300 font-bold">Ready to pay</span>
                            </div>
                            <button onClick={() => payOrder(order.id)}
                              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-violet-900/30">
                              <Banknote className="w-3.5 h-3.5" /> Pay Now
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* All Orders Timeline */}
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <h3 className="text-sm font-bold text-white mb-5 pb-3 border-b border-slate-800">All My Orders — Status Timeline</h3>
                    <div className="space-y-3">
                      {orders.filter(o => !["Proposed", "Synced"].includes(o.status)).slice(0, 12).map((order) => {
                        const steps: Order["status"][] = ["Pending", "Pending Approval", "Payment Pending", "Paid", "In Transit", "Delivered"];
                        const currentIdx = steps.indexOf(order.status);
                        return (
                          <div key={order.id} className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-300">{order.orderId}</span>
                                <span className="text-xs text-slate-200 font-semibold truncate max-w-[200px]">{order.productName}</span>
                              </div>
                              <OrderStatusBadge status={order.status} />
                            </div>
                            <div className="flex items-center gap-1">
                              {steps.map((step, i) => {
                                const isPast    = i < currentIdx;
                                const isCurrent = i === currentIdx;
                                return (
                                  <React.Fragment key={step}>
                                    <div className={`h-1.5 flex-1 rounded-full transition-all ${isPast ? "bg-emerald-500" : isCurrent ? "bg-blue-500 animate-pulse" : "bg-slate-800"}`} />
                                    {i < steps.length - 1 && (
                                      <div className={`w-2 h-2 rounded-full shrink-0 ${isPast || isCurrent ? "bg-emerald-500" : "bg-slate-700"}`} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                            <div className="flex justify-between mt-1.5">
                              {steps.map((s, i) => (
                                <span key={s} className={`text-[8px] font-mono ${i === currentIdx ? "text-blue-400 font-bold" : i < currentIdx ? "text-emerald-400" : "text-slate-600"}`}>
                                  {s === "Pending" ? "Buffered" : s === "Pending Approval" ? "Supplier" : s === "Payment Pending" ? "Pay" : s}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: SYNCHRONIZATION CENTER ─────────────────────────────── */}
              {activeTab === "sync" && (
                <motion.div key="tab-sync" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="pb-4 mb-5 border-b border-slate-850">
                      <h3 className="text-lg font-bold text-white">ESP32 Synchronization Engine</h3>
                      <p className="text-xs text-slate-400 mt-1">Configure connection failover constraints, buffer uploads, and handshake policies.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                            <Database className="w-4 h-4 text-blue-400" />Transmission Pool
                          </span>
                          <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono">QUEUED STATES</span>
                        </div>
                        <div className="text-center py-6">
                          <span className="text-5xl font-bold text-amber-400 block">{pendingOrdersCount}</span>
                          <span className="text-xs text-slate-400 mt-1.5 block font-mono">Pending Orders in Local Buffer</span>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Auto Sync Protocol Status:</span>
                            <span className="text-emerald-400 font-bold font-mono">Active (10s Cycle)</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Last Synchronization:</span>
                            <span className="text-slate-200 font-mono">{syncLogs[0] ? new Date(syncLogs[0].timestamp).toLocaleTimeString() : "No history"}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>After Sync Status:</span>
                            <span className="text-yellow-300 font-mono">→ Pending Approval</span>
                          </div>
                        </div>
                        <button onClick={triggerSync}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/30">
                          <RefreshCw className="w-4 h-4" />Initiate Out-Of-Cycle Synced Upload
                        </button>
                      </div>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-900 mb-4">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Protocol Log Information</span>
                            <span className="text-[10px] text-amber-500 font-bold uppercase">Failover Guard</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            When outages are captured, the edge device halts TCP uploads and routes to LittleFS. On restore, the heartbeat protocol re-establishes handshake and uploads buffered orders as <span className="text-yellow-300 font-semibold">"Pending Approval"</span> — ready for supplier review.
                          </p>
                          <div className="mt-4 p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/80 text-[11px] space-y-1.5 text-slate-300 font-mono">
                            <div>✔ 1. State detector poll latency: &lt;100ms</div>
                            <div>✔ 2. Flash Sector write speed: ~150KB/s</div>
                            <div>✔ 3. Auto handshake backoff timeout: 5s</div>
                            <div>✔ 4. Transport Payload Encryption: TLS v1.3</div>
                            <div>✔ 5. Post-sync routing: → Pending Approval</div>
                          </div>
                        </div>
                        <div className="pt-4 text-xs text-slate-400 italic">"Durable local storage combined with automated cloud uploading enables resilient offline systems."</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: ESP32 DEVICE MONITORING ────────────────────────────── */}
              {activeTab === "monitoring" && (
                <motion.div key="tab-monitoring" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="pb-4 mb-5 border-b border-slate-850 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">Hardware Edge Node Diagnostics</h3>
                        <p className="text-xs text-slate-400 mt-1">Real-time telemetry from SoC registers via POST /api/device/status every 10s.</p>
                      </div>
                      <span className="bg-blue-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded shadow">COMM PORT: COM 4</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: "MCU Uptime",         value: deviceStatus ? `${deviceStatus.uptime}s` : "4850s", sub: "Auto Heartbeat: Every 10s", icon: Clock,        color: "text-blue-400" },
                        { label: "Memory Allocation",  value: deviceStatus ? `${deviceStatus.memoryUsage}%` : "38%", sub: "LittleFS Partition Active", icon: HardDrive,  color: "text-emerald-400" },
                        { label: "Firmware Version",   value: "v1.2.0-STABLE", sub: "ESP-IDF v5.1 + LittleFS API",   icon: Cpu,        color: "text-amber-400" },
                      ].map((card) => {
                        const Icon = card.icon;
                        return (
                          <div key={card.label} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">{card.label}</span>
                              <Icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                            <p className="text-2xl font-mono text-white font-bold">{card.value}</p>
                            <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500 font-mono">{card.sub}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-5">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">State Machine Status Trace</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                        {[
                          { label: "RSSI Core:",          value: isInternetAvailable ? "-64 dBm (Excellent)" : "-110 dBm (Outage Cut)", color: isInternetAvailable ? "text-emerald-400" : "text-red-400" },
                          { label: "Device State:",       value: deviceStatus?.status ?? "ONLINE",                                       color: "text-emerald-400" },
                          { label: "Buffered Files:",     value: `${pendingOrdersCount} files`,                                           color: "text-amber-300" },
                          { label: "Failed Handshakes:",  value: String(deviceStatus?.failedSyncAttempts ?? 0),                           color: "text-red-400" },
                        ].map((item) => (
                          <div key={item.label} className="bg-slate-900 p-3 rounded-xl border border-slate-850">
                            <span className="text-slate-400 block mb-1">{item.label}</span>
                            <span className={`font-bold ${item.color}`}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: IoT CONTROL CENTER ──────────────────────────────────── */}
              {activeTab === "control" && (
                <motion.div key="tab-control" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="pb-4 mb-5 border-b border-slate-850">
                      <h3 className="text-lg font-bold text-white">IoT Edge Sandbox & Simulation Controls</h3>
                      <p className="text-xs text-slate-400 mt-1">Hardware engineering evaluation tools for demonstrating failover edge behavior.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block mb-1.5">Telecom Outage Simulation</span>
                          <p className="text-xs text-slate-400 leading-relaxed mb-4">Simulate cutting or re-establishing connectivity to inspect backup queue transitions.</p>
                        </div>
                        <div className="space-y-2">
                          <button onClick={() => toggleNetworkState(false)} className="w-full bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white font-bold py-2 px-3 rounded-xl text-xs transition-all border border-red-500/20 cursor-pointer">Simulate Internet Outage</button>
                          <button onClick={() => toggleNetworkState(true)} className="w-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold py-2 px-3 rounded-xl text-xs transition-all border border-emerald-500/20 cursor-pointer">Restore Internet Link</button>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block mb-1.5">Tactile GPIO Order Clicker</span>
                          <p className="text-xs text-slate-400 leading-relaxed mb-4">Creates a demo order mimicking a merchant pressing a physical push-button on GPIO pin 12.</p>
                        </div>
                        <button onClick={handleHardwareGPIONode} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold py-3 px-3 rounded-xl text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <PlusCircle className="w-4 h-4 text-amber-400" />Simulate Hard Press GPIO 12
                        </button>
                      </div>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block mb-1.5">System Safe Restart EN</span>
                          <p className="text-xs text-slate-400 leading-relaxed mb-4">Triggers a chip powercycle. Clearing active states, re-initializing registers, checking LittleFS.</p>
                        </div>
                        <button onClick={restartDevice} className="w-full bg-slate-900 hover:bg-red-900/20 text-red-400 font-bold py-3 px-3 rounded-xl text-xs border border-slate-800 hover:border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <RotateCcw className="w-4 h-4 text-red-500" />Simulate Hardware Safe Restart
                        </button>
                      </div>
                    </div>
                    <div className="mt-8 bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                      <span className="text-xs font-bold text-slate-300 uppercase block mb-3">Competition Judge Instructions — 14-Step Demo</span>
                      <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
                        <li>Click <span className="text-white font-semibold">Run 14-Step Demo</span> in the top bar to see the fully automated competition sequence.</li>
                        <li>Or manually: Toggle <span className="text-white font-semibold">Simulate Internet Outage</span> → Create orders → Toggle <span className="text-white font-semibold">Restore Internet Link</span>.</li>
                        <li>Watch the ESP32 auto-sync orders from LittleFS to Cloud as <span className="text-yellow-300 font-semibold">Pending Approval</span>.</li>
                        <li>Go to <span className="text-rose-400 font-semibold">Supplier Portal</span> → Approve orders → Customer pays → Supplier dispatches → Delivered!</li>
                      </ol>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: ANALYTICS ───────────────────────────────────────────── */}
              {activeTab === "analytics" && (
                <motion.div key="tab-analytics" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="pb-4 mb-5 border-b border-slate-850">
                      <h3 className="text-lg font-bold text-white">Performance Analytics Dashboard</h3>
                      <p className="text-xs text-slate-400 mt-1">High-precision SVG charts analyzing packet delivery rates, queue trends, and network reliability.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Order Synced Trends (Daily)</span>
                            <span className="text-[10px] text-slate-500 font-mono">Accumulated Sales Volumes</span>
                          </div>
                          <span className="text-emerald-400 text-xs font-bold font-mono">+12.5%</span>
                        </div>
                        <div className="h-44 w-full flex items-end justify-between pt-4 pb-2 border-b border-slate-800 px-2">
                          {[
                            { label: "Mon", val: 40 }, { label: "Tue", val: 55 }, { label: "Wed", val: 32 },
                            { label: "Thu", val: 84 }, { label: "Fri", val: 68 }, { label: "Sat", val: 95 }, { label: "Sun", val: 120 }
                          ].map((bar) => (
                            <div key={bar.label} className="flex flex-col items-center gap-2 flex-1 group">
                              <div className="w-8 bg-blue-600/20 hover:bg-blue-600 rounded-t-md transition-all duration-300 relative" style={{ height: `${(bar.val / 120) * 110}px` }}>
                                <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 bg-slate-800 text-white font-mono text-[9px] py-0.5 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{bar.val} items</div>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">{bar.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Outage & Sync Success Rate</span>
                            <span className="text-[10px] text-slate-500 font-mono">Last 7 Calendar Days</span>
                          </div>
                          <span className="text-blue-400 text-xs font-bold font-mono">98.4%</span>
                        </div>
                        <div className="h-44 w-full relative pt-4 flex items-end">
                          <svg className="w-full h-32 text-blue-500" viewBox="0 0 100 30" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                              </linearGradient>
                            </defs>
                            <path d="M 0 25 Q 15 20, 30 22 T 60 10 T 90 2 T 100 5 L 100 30 L 0 30 Z" fill="url(#chartGradient)" />
                            <path d="M 0 25 Q 15 20, 30 22 T 60 10 T 90 2 T 100 5" fill="none" stroke="#3b82f6" strokeWidth="1.2" />
                          </svg>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-3.5 pt-2 border-t border-slate-900">
                          <span>06/10</span><span>06/12</span><span>06/14</span><span>Today</span>
                        </div>
                      </div>

                      {/* Order Lifecycle Distribution */}
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 col-span-1 md:col-span-2">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-4">Order Lifecycle Distribution</span>
                        <div className="flex gap-3 flex-wrap">
                          {[
                            { label: "Buffered", value: pendingOrdersCount,  color: "bg-amber-400" },
                            { label: "Pending Approval", value: supplierQueueCount,   color: "bg-yellow-400" },
                            { label: "Payment Pending",  value: paymentPendingCount,  color: "bg-violet-400" },
                            { label: "Paid",             value: orders.filter(o => o.status === "Paid").length,       color: "bg-emerald-400" },
                            { label: "In Transit",       value: inTransitCount,       color: "bg-sky-400" },
                            { label: "Delivered",        value: deliveredCount,        color: "bg-teal-400" },
                            { label: "Synced",           value: orders.filter(o => o.status === "Synced").length,     color: "bg-blue-400" },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                              <span className="text-[11px] text-slate-400">{item.label}</span>
                              <span className="text-xs font-bold text-white font-mono">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: SYNC HISTORY ────────────────────────────────────────── */}
              {activeTab === "history" && (
                <motion.div key="tab-history" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="pb-4 mb-5 border-b border-slate-850">
                      <h3 className="text-lg font-bold text-white">Synchronisation Ledger Mappings</h3>
                      <p className="text-xs text-slate-400 mt-1">Ledger of synchronization transactions converted from edge gateways since boot.</p>
                    </div>
                    <div className="space-y-3.5">
                      {syncLogs.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-10 italic">No historic sync files. Run a synchronization session to generate logs.</p>
                      ) : (
                        syncLogs.map((log) => (
                          <div key={log.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 shrink-0">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-mono text-xs font-bold text-slate-200">ID Tag: {log.id}</span>
                                <p className="text-xs text-slate-400 mt-1">{log.result}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="bg-emerald-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">+{log.ordersSynced} SYNCED</span>
                              <p className="text-[10px] text-slate-500 font-mono mt-1.5">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB: SYSTEM SETTINGS ─────────────────────────────────────── */}
              {activeTab === "settings" && (
                <motion.div key="tab-settings" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="bg-slate-900/10 backdrop-blur-md rounded-3xl p-6 border border-slate-800/80">
                    <div className="pb-4 mb-5 border-b border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">System Configuration Panel</h3>
                        <p className="text-xs text-slate-400 mt-1">Control hardware parameters or export production ESP32 firmware.</p>
                      </div>
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 self-start shrink-0">
                        <button onClick={() => setSettingsSubTab("general")}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${settingsSubTab === "general" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>
                          General Configuration
                        </button>
                        <button onClick={() => setSettingsSubTab("esp32")}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${settingsSubTab === "esp32" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>
                          ESP32 C++ Code
                        </button>
                      </div>
                    </div>

                    {settingsSubTab === "general" ? (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                            <label className="text-xs font-bold text-slate-300 block">Heartbeat Polling Interval (ms)</label>
                            <input type="number" defaultValue="10000" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none" />
                            <p className="text-[10px] text-slate-500 leading-normal">Frequency of POST heartbeats sent to server. Lower values = real-time but higher CPU on low RAM nodes.</p>
                          </div>
                          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                            <label className="text-xs font-bold text-slate-300 block">Backup Storage Partition Type</label>
                            <select className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white cursor-pointer focus:outline-none">
                              <option>LittleFS Flash Sector Mapping (Preferred)</option>
                              <option>FatFS SD Card Array Partition</option>
                              <option>EEPROM Direct Byte Map (No partition)</option>
                            </select>
                            <p className="text-[10px] text-slate-500 leading-normal">LittleFS ensures wear-leveling algorithms on ESP32 flash matrices.</p>
                          </div>
                        </div>
                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-850 space-y-4">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Critical Engineering Maintenance</h4>
                          <div className="flex gap-4">
                            <button onClick={resetDemo} className="bg-red-950 hover:bg-red-900/40 text-red-400 border border-red-500/25 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer">
                              Erase Flash / Zero Out Database Mocks
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500">WARNING: Erases all order tables and resets mock device state back to initial parameters.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-blue-950/20 border border-blue-500/20 p-5 rounded-2xl text-blue-300 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] px-2 py-0.5 bg-blue-900/40 border border-blue-500/30 rounded-full font-bold">RECOMMENDED DEMO CONFIGURATION</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 rounded-full font-bold">JUDGE-PROOF</span>
                          </div>
                          <h4 className="text-sm font-semibold">Demonstrating Unshakable Failover to Competition Judges</h4>
                          <p className="text-xs leading-relaxed text-slate-300">
                            This C++ sketch compiles inside <strong className="text-white">Arduino IDE</strong>. Hook a tactile button to <strong className="text-white">GPIO 12</strong>. Turn off your router. Press button to buffer orders in LittleFS. Re-enable WiFi — device auto-syncs within 10 seconds, then posts events and polls for buzzer commands.
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-400">File: ESP32_RuralSync.ino (Root Workspace)</span>
                          <button onClick={() => {
                            const targetUrl = window.location.origin;
                            navigator.clipboard.writeText(`// ESP32_RuralSync.ino — copy from root workspace file`);
                            setCopiedCode(true);
                            addNotification("ESP32 Arduino Sketch path copied! Open ESP32_RuralSync.ino in root.", "success");
                            setTimeout(() => setCopiedCode(false), 2000);
                          }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer">
                            {copiedCode ? "Copied!" : "Copy Sketch Reference"}
                          </button>
                        </div>
                        <div className="bg-slate-950 rounded-2xl border border-slate-850 p-5 font-mono text-[11px] leading-relaxed text-slate-300 h-96 overflow-y-auto">
                          <pre className="whitespace-pre">{`#include <WiFi.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const String SERVER_URL  = "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/";

#define BUTTON_PIN   12   // Push button pulls GPIO 12 to GND
#define BUZZER_PIN   13   // Active buzzer / LED on GPIO 13

// ── State Machine ──────────────────────────────────
enum SystemState { STATE_BOOT, STATE_ONLINE, STATE_OFFLINE, STATE_SYNCING };
SystemState currentState = STATE_BOOT;

unsigned long lastHeartbeatTime  = 0;
unsigned long lastCommandPoll    = 0;
const unsigned long HEARTBEAT_INTERVAL = 10000;  // 10s
const unsigned long COMMAND_POLL_INTERVAL = 5000; // 5s

String deviceId = "ESP32-RuralSync-001";
int localBufferCount = 0;

// ── Command Polling (Buzzer Feedback) ──────────────
void pollCommandQueue() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(SERVER_URL + "api/esp32/commands");
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, payload);
    JsonArray cmds = doc["commands"];
    for (JsonObject cmd : cmds) {
      String type = cmd["type"].as<String>();
      if (type == "beep" || type == "payment_beep") {
        // Beep buzzer: 2 short beeps for order, 3 for payment
        int beeps = (type == "payment_beep") ? 3 : 2;
        for (int i = 0; i < beeps; i++) {
          digitalWrite(BUZZER_PIN, HIGH);
          delay(150);
          digitalWrite(BUZZER_PIN, LOW);
          delay(100);
        }
        Serial.println("[BUZZER] Command: " + type);
      }
    }
  }
  http.end();
}

// ── Heartbeat ──────────────────────────────────────
void sendHeartbeat() { /* ... as per full firmware */ }

// ── LittleFS Buffer ────────────────────────────────
void bufferOrderLocally(String product, String retailer, String priority) {
  File file = LittleFS.open("/orders.txt", "a");
  file.print(product); file.print(",");
  file.print(retailer); file.print(",");
  file.println(priority);
  file.close();
}

// ── Auto Sync ──────────────────────────────────────
void synchronizeBuffer() { /* Reads /orders.txt, POSTs to /api/orders */ }

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  LittleFS.begin(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  // ... connect and send heartbeat
}

void loop() {
  unsigned long now = millis();

  // Heartbeat + Auto-sync check every 10s
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;
    if (WiFi.status() == WL_CONNECTED && currentState == STATE_OFFLINE)
      synchronizeBuffer();
    else
      sendHeartbeat();
  }

  // Poll buzzer commands every 5s
  if (now - lastCommandPoll >= COMMAND_POLL_INTERVAL) {
    lastCommandPoll = now;
    pollCommandQueue();
  }

  // GPIO 12 button → create order
  if (digitalRead(BUTTON_PIN) == LOW) { /* ... createOrder() */ }
}`}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer */}
          <footer className="h-14 border-t border-slate-900/80 bg-slate-950/60 backdrop-blur-md shrink-0 flex items-center justify-between px-8 text-xs text-slate-500 select-none z-10">
            <div className="flex gap-6">
              <span>Device: <span className="text-slate-300 font-mono">{deviceStatus?.status ?? "ONLINE"}</span></span>
              <span>Heap: <span className="text-slate-300">184KB Free</span></span>
              <span>Signal: <span className="text-slate-300 font-mono">{isInternetAvailable ? `${deviceStatus?.signalStrength ?? -64} dBm` : "Disconnected"}</span></span>
              <span>Orders: <span className="text-slate-300 font-mono">{totalOrdersCount} total</span></span>
            </div>
            <div className="text-[10px] text-blue-500 uppercase tracking-wider font-bold italic">
              ENGINEERING INNOVATION COMPETITION • IoT RETAILING CATEGORY
            </div>
          </footer>
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 space-y-2.5 z-50 max-w-sm pointer-events-none">
        <AnimatePresence>
          {notifications.slice(0, 4).map((toast) => (
            <motion.div key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className={`p-4 rounded-xl shadow-2xl backdrop-blur-md border text-xs pointer-events-auto flex gap-3 ${
                toast.type === "success" ? "bg-slate-900/90 border-emerald-500/30 text-emerald-300"
                : toast.type === "warning" ? "bg-slate-900/90 border-amber-500/30 text-amber-300"
                : "bg-slate-900/90 border-blue-500/30 text-blue-300"}`}>
              <div className="flex-1">
                <span className="text-[9px] text-slate-500 block mb-0.5 font-mono">{toast.time} SYSTEM NOTIFICATION</span>
                <p className="font-medium text-slate-100">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Proposed Order Approval Modal */}
      <AnimatePresence>
        {orders.some(o => o.status === "Proposed") && (() => {
          const proposed = orders.find(o => o.status === "Proposed")!;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-slate-850">
                  <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 font-bold shadow-lg">⚠️</div>
                  <div>
                    <span className="text-[10px] text-amber-400 font-mono font-bold tracking-widest block">GPIO 12 — ORDER REQUEST</span>
                    <h2 className="text-lg font-bold text-white leading-tight">Merchant Approval Required</h2>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">Physical push button or simulation trigger received from <strong className="text-white">ESP32 Edge Gateway</strong>. Review the proposed order:</p>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 space-y-3 font-mono text-xs">
                  {[
                    { label: "Proposal ID", value: proposed.orderId, cls: "text-slate-300 font-bold" },
                    { label: "Product",     value: proposed.productName, cls: "text-slate-100 font-bold" },
                    { label: "Retailer",    value: proposed.retailerName, cls: "text-slate-300" },
                    { label: "Quantity",    value: `${proposed.quantity} unit(s)`, cls: "text-slate-300" },
                    { label: "Priority",    value: proposed.priority, cls: `font-bold px-2 py-0.5 rounded text-[10px] ${proposed.priority === "High" ? "bg-red-500/10 text-red-400" : proposed.priority === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"}` },
                    { label: "Gateway",     value: "GPIO_12_BUTTON", cls: "text-slate-400" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-slate-500">{row.label}:</span>
                      <span className={row.cls}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => rejectOrder(proposed.id)}
                    className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-bold py-3 rounded-xl transition-all cursor-pointer text-center">
                    Decline Order
                  </button>
                  <button onClick={() => approveOrder(proposed.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer text-center shadow-lg shadow-emerald-900/30">
                    Accept Order
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
