import { useState, useEffect } from "react";
import { Order, DeviceStatus, DeviceEvent, SyncLog } from "./types";

export interface DemoStep {
  name: string;
  description: string;
  active: boolean;
  status: "idle" | "running" | "success" | "error";
}

export function useRuralSync() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isInternetAvailable, setIsInternetAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Demo State
  const [demoActive, setDemoActive] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>([
    { name: "Customer Portal", description: "Boot ESP32 & verify cloud connectivity online", active: false, status: "idle" },
    { name: "Supplier Portal", description: "Confirm supplier dashboard is live & ready", active: false, status: "idle" },
    { name: "ESP32 Connected", description: "Heartbeat sent — device registers ONLINE state", active: false, status: "idle" },
    { name: "Create Online Order", description: "Customer creates order — syncs directly to cloud", active: false, status: "idle" },
    { name: "Simulate Outage", description: "Fiber-cut injected — ESP32 detects OFFLINE state", active: false, status: "idle" },
    { name: "Buffer in LittleFS", description: "Customer order stored offline in /orders.txt", active: false, status: "idle" },
    { name: "Buffered Offline", description: "Dashboard shows Pending + ESP32 Local Buffer status", active: false, status: "idle" },
    { name: "Internet Restored", description: "Telecom link restored — handshake re-established", active: false, status: "idle" },
    { name: "Auto Sync", description: "ESP32 auto-uploads LittleFS buffer to Cloud", active: false, status: "idle" },
    { name: "Supplier Receives", description: "Supplier portal shows order as Pending Approval", active: false, status: "idle" },
    { name: "Supplier Approves", description: "Supplier approves — status: Payment Pending", active: false, status: "idle" },
    { name: "Customer Pays", description: "Customer pays — status: Paid", active: false, status: "idle" },
    { name: "Supplier Dispatches", description: "Supplier ships — status: In Transit", active: false, status: "idle" },
    { name: "Order Delivered", description: "Supplier confirms delivery — lifecycle complete", active: false, status: "idle" }
  ]);

  // Notification overlay system
  const [notifications, setNotifications] = useState<
    { id: string; message: string; type: "success" | "info" | "warning"; time: string }[]
  >([]);

  const addNotification = (message: string, type: "success" | "info" | "warning") => {
    const id = Math.random().toString(36).substring(2, 9);
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setNotifications(prev => [{ id, message, type, time }, ...prev].slice(0, 15));
  };

  // Fetch all server data
  const fetchData = async () => {
    try {
      const [ordersRes, statusRes, eventsRes, logsRes, netRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/device/status"),
        fetch("/api/device/events"),
        fetch("/api/sync/history"),
        fetch("/api/network-status")
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setDeviceStatus(data);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setSyncLogs(data.syncLogs);
      }
      if (netRes.ok) {
        const data = await netRes.json();
        setIsInternetAvailable(data.isInternetAvailable);
      }
    } catch (e) {
      console.error("Failed to sync backend state:", e);
    } finally {
      setLoading(false);
    }
  };

  // Set up polling intervals
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // ─── API Call Triggers ─────────────────────────────────────────────────────

  const addOrder = async (
    productName: string,
    quantity: number,
    retailerName: string,
    priority: "Low" | "Medium" | "High",
    proposed = false
  ) => {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, quantity, retailerName, priority, proposed })
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => [data.order, ...prev]);
        setDeviceStatus(data.deviceStatus);

        if (proposed) {
          addNotification(`New proposed order ${data.order.orderId} needs approval`, "info");
        } else if (isInternetAvailable) {
          addNotification(`Order Synced: ${data.order.orderId} uploaded directly to Cloud`, "success");
        } else {
          addNotification(`Order Offline: ${data.order.orderId} buffered inside LittleFS /orders.txt`, "warning");
        }
        fetchData();
        return data.order;
      }
    } catch (e) {
      console.error("Error creating order:", e);
    }
  };

  // Merchant approval (for ESP32 proposed orders)
  const approveOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addNotification(`Order Approved: ${data.order.orderId} is now synced to Cloud`, "success");
        fetchData();
      }
    } catch (e) {
      console.error("Error approving order:", e);
    }
  };

  const rejectOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/reject`, { method: "POST" });
      if (res.ok) {
        addNotification("Proposed order rejected and deleted", "info");
        fetchData();
      }
    } catch (e) {
      console.error("Error rejecting order:", e);
    }
  };

  // ─── Supplier Portal Actions ───────────────────────────────────────────────

  const supplierApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/supplier-approve`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addNotification(`Supplier Approved: ${data.order.orderId} — awaiting customer payment`, "success");
        fetchData();
        return data.order;
      }
    } catch (e) {
      console.error("Error supplier approving order:", e);
    }
  };

  const supplierReject = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/supplier-reject`, { method: "POST" });
      if (res.ok) {
        addNotification("Order rejected by supplier and cancelled", "warning");
        fetchData();
      }
    } catch (e) {
      console.error("Error supplier rejecting order:", e);
    }
  };

  const dispatchOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/dispatch`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addNotification(`Dispatched: ${data.order.orderId} — shipment is now In Transit`, "success");
        fetchData();
        return data.order;
      }
    } catch (e) {
      console.error("Error dispatching order:", e);
    }
  };

  const markDelivered = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/delivered`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addNotification(`Delivered: ${data.order.orderId} — order lifecycle complete ✓`, "success");
        fetchData();
        return data.order;
      }
    } catch (e) {
      console.error("Error marking delivered:", e);
    }
  };

  // ─── Customer Payment ──────────────────────────────────────────────────────

  const payOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/pay`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addNotification(`Payment Confirmed: ${data.order.orderId} — funds transferred ✓`, "success");
        fetchData();
        return data.order;
      }
    } catch (e) {
      console.error("Error paying order:", e);
    }
  };

  // ─── Network & Device Controls ─────────────────────────────────────────────

  const toggleNetworkState = async (available: boolean) => {
    try {
      const res = await fetch("/api/network-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available })
      });
      if (res.ok) {
        const data = await res.json();
        setIsInternetAvailable(data.isInternetAvailable);
        setDeviceStatus(data.deviceStatus);

        if (available) {
          addNotification("Internet Restored: ESP32 Edge Gateway handshake initialized", "success");
        } else {
          addNotification("Internet Connection Lost: ESP32 switched to local buffer storage Mode", "warning");
        }
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerSync = async () => {
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addNotification(`Queue Synced: ${data.ordersSynced} local buffer records migrated to Cloud — now Pending Approval`, "success");
        fetchData();
        return data;
      } else {
        addNotification(`Sync Failure: ${data.error || "Connection error"}`, "warning");
        fetchData();
        return { error: true, message: data.error };
      }
    } catch (e) {
      console.error(e);
      addNotification("Synchronization failed due to network timeout", "warning");
    }
  };

  const restartDevice = async () => {
    try {
      const res = await fetch("/api/device/restart", { method: "POST" });
      if (res.ok) {
        addNotification("System Command: ESP32 development kit restarting...", "info");
        setTimeout(() => {
          fetchData();
          addNotification("ESP32 Gateway Re-Booted: Core registers initialized", "success");
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetDemo = async () => {
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) {
        addNotification("Demo Database and logs reset to original state", "info");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── 14-Step Competition Demo ──────────────────────────────────────────────

  const runFullDemo = async () => {
    if (demoActive) return;
    setDemoActive(true);
    addNotification("Starting 14-Step RuralSync Competition Demo Sequence!", "info");

    const updateStep = (index: number, status: "idle" | "running" | "success" | "error") => {
      setDemoSteps(prev =>
        prev.map((step, idx) =>
          idx === index ? { ...step, status, active: status === "running" } : step
        )
      );
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Step 1: Customer Portal Open
      updateStep(0, "running");
      setDemoMessage("Opening Customer Portal — verifying cloud connectivity...");
      await toggleNetworkState(true);
      await sleep(1800);
      updateStep(0, "success");

      // Step 2: Supplier Portal Open
      updateStep(1, "running");
      setDemoMessage("Supplier Portal confirmed active — ready to receive orders...");
      await sleep(1500);
      updateStep(1, "success");

      // Step 3: ESP32 Connected — Heartbeat
      updateStep(2, "running");
      setDemoMessage("ESP32 Edge Gateway heartbeat transmitted — device registered ONLINE...");
      await sleep(2000);
      updateStep(2, "success");

      // Step 4: Customer Creates Online Order
      updateStep(3, "running");
      setDemoMessage("Customer creating online order — syncing directly to Cloud...");
      const onlineOrder = await addOrder("Solar Power Battery Charger", 3, "Rajesh Agri-Retail Co", "High");
      await sleep(2200);
      updateStep(3, "success");

      // Step 5: Internet Outage Simulated
      updateStep(4, "running");
      setDemoMessage("Simulating internet outage — fiber-cut injected on rural telecom segment...");
      await toggleNetworkState(false);
      await sleep(2500);
      updateStep(4, "success");

      // Step 6: ESP32 Stores Order in LittleFS
      updateStep(5, "running");
      setDemoMessage("ESP32 detects OFFLINE state — new order stored in LittleFS /orders.txt...");
      const offlineOrder = await addOrder("Deepwell Submersible Pump", 2, "Karan Agri-Services Ltd", "High");
      await sleep(1800);
      await addOrder("Organic Super-Phosphate Bags", 12, "Ram Prasad Fertilisers", "Medium");
      await sleep(2000);
      updateStep(5, "success");

      // Step 7: Website Shows Buffered Offline
      updateStep(6, "running");
      setDemoMessage("Dashboard showing Buffered Offline status — Orders Queue marked PENDING...");
      await sleep(2000);
      updateStep(6, "success");

      // Step 8: Internet Restored
      updateStep(7, "running");
      setDemoMessage("Telecom link restored — ESP32 re-establishing secure TLS handshake...");
      await toggleNetworkState(true);
      await sleep(2500);
      updateStep(7, "success");

      // Step 9: ESP32 Auto Synchronizes
      updateStep(8, "running");
      setDemoMessage("ESP32 automatically uploading buffered LittleFS cache to Cloud — clearing /orders.txt...");
      const syncResult = await triggerSync();
      await sleep(2500);
      updateStep(8, "success");

      // Step 10: Supplier Receives Order
      updateStep(9, "running");
      setDemoMessage("Supplier Portal: orders received with status Pending Approval...");
      await sleep(2000);
      updateStep(9, "success");

      // Step 11: Supplier Approves Order
      updateStep(10, "running");
      setDemoMessage("Supplier approving order — status changing to Payment Pending...");
      // Find first Pending Approval order and approve it
      const currentOrders = await fetch("/api/orders").then(r => r.json());
      const pendingApprovalOrder = currentOrders.orders.find((o: Order) => o.status === "Pending Approval");
      let approvedOrder: Order | undefined;
      if (pendingApprovalOrder) {
        approvedOrder = await supplierApprove(pendingApprovalOrder.id);
      }
      await sleep(2000);
      updateStep(10, "success");

      // Step 12: Customer Pays
      updateStep(11, "running");
      setDemoMessage("Customer paying — funds transferred, status: Paid...");
      const currentOrders2 = await fetch("/api/orders").then(r => r.json());
      const paymentPendingOrder = currentOrders2.orders.find((o: Order) => o.status === "Payment Pending");
      let paidOrder: Order | undefined;
      if (paymentPendingOrder) {
        paidOrder = await payOrder(paymentPendingOrder.id);
      }
      await sleep(2000);
      updateStep(11, "success");

      // Step 13: Supplier Dispatches
      updateStep(12, "running");
      setDemoMessage("Supplier dispatching shipment — status changing to In Transit...");
      const currentOrders3 = await fetch("/api/orders").then(r => r.json());
      const paidOrderCurrent = currentOrders3.orders.find((o: Order) => o.status === "Paid");
      if (paidOrderCurrent) {
        await dispatchOrder(paidOrderCurrent.id);
      }
      await sleep(2000);
      updateStep(12, "success");

      // Step 14: Order Delivered
      updateStep(13, "running");
      setDemoMessage("Supplier confirming delivery — full supply chain lifecycle complete!");
      const currentOrders4 = await fetch("/api/orders").then(r => r.json());
      const transitOrder = currentOrders4.orders.find((o: Order) => o.status === "In Transit");
      if (transitOrder) {
        await markDelivered(transitOrder.id);
      }
      await sleep(2000);
      updateStep(13, "success");

      addNotification("🎉 14-Step Demo Complete! Full IoT supply chain demonstrated successfully.", "success");
      setDemoMessage("Demo complete! ESP32 → Cloud → Supplier → Customer full lifecycle verified ✓");
    } catch (err) {
      console.error(err);
      addNotification("Interactive automation experienced a runtime error", "warning");
    } finally {
      setDemoActive(false);
      setTimeout(() => {
        setDemoSteps(prev => prev.map(s => ({ ...s, status: "idle", active: false })));
        setDemoMessage("");
      }, 8000);
    }
  };

  return {
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
  };
}
