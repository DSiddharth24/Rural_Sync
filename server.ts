import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
let esp32Commands: { id: string; type: string; payload?: any }[] = [];

// Interfaces mimicking Database tables
interface Order {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  retailerName: string;
  priority: "Low" | "Medium" | "High";
  timestamp: string;
  status:
    | "Pending"
    | "Synced"
    | "Failed"
    | "Proposed"
    | "Pending Approval"
    | "Payment Pending"
    | "Paid"
    | "In Transit"
    | "Delivered";
  storageLocation: "Cloud" | "ESP32 Local Buffer";
}

interface DeviceStatus {
  deviceId: string;
  signalStrength: number; // dBm
  memoryUsage: number; // percentage
  cpuUsage: number; // percentage
  uptime: number; // seconds
  status: "ONLINE" | "OFFLINE" | "SYNCING" | "DISCONNECTED";
  lastHeartbeat: string;
  ordersStoredLocally: number;
  ordersSynced: number;
  failedSyncAttempts: number;
}

interface DeviceEvent {
  id: string;
  event: string;
  timestamp: string;
}

interface SyncLog {
  id: string;
  timestamp: string;
  ordersSynced: number;
  result: string;
}

// ─── In-Memory Database Storage ───────────────────────────────────────────────
let orders: Order[] = [
  {
    id: "ord-1",
    orderId: "RS-1021",
    productName: "Solar Irrigation Pump Controller",
    quantity: 2,
    retailerName: "AgriTech Rural Solutions",
    priority: "High",
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    status: "Delivered",
    storageLocation: "Cloud"
  },
  {
    id: "ord-2",
    orderId: "RS-1022",
    productName: "High-Yield Seed Kits (Wheat)",
    quantity: 50,
    retailerName: "Bhoomi Fertilizer Hub",
    priority: "Medium",
    timestamp: new Date(Date.now() - 3600000 * 7).toISOString(),
    status: "In Transit",
    storageLocation: "Cloud"
  },
  {
    id: "ord-3",
    orderId: "RS-1023",
    productName: "Drip Irrigation Pipe Bundle (100m)",
    quantity: 8,
    retailerName: "GreenValley Co-operative",
    priority: "Low",
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    status: "Paid",
    storageLocation: "Cloud"
  },
  {
    id: "ord-4",
    orderId: "RS-1024",
    productName: "LoRa 915MHz Gateway Module",
    quantity: 1,
    retailerName: "Krishna Kalyan Bhandar",
    priority: "High",
    timestamp: new Date(Date.now() - 3600000 * 5.5).toISOString(),
    status: "Payment Pending",
    storageLocation: "Cloud"
  },
  {
    id: "ord-5",
    orderId: "RS-1025",
    productName: "Organic Super-Phosphate (25kg)",
    quantity: 20,
    retailerName: "Maa Durga Fertilisers",
    priority: "Medium",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: "Pending Approval",
    storageLocation: "Cloud"
  },
  {
    id: "ord-6",
    orderId: "RS-1026",
    productName: "Off-Grid Deep Cycle Battery 200Ah",
    quantity: 3,
    retailerName: "Agrikart Cooperative",
    priority: "High",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: "Pending Approval",
    storageLocation: "Cloud"
  },
  {
    id: "ord-7",
    orderId: "RS-1027",
    productName: "Smart Ferti-Meter v3 Probe",
    quantity: 5,
    retailerName: "Farms Depot",
    priority: "Low",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    status: "Synced",
    storageLocation: "Cloud"
  },
  {
    id: "ord-8",
    orderId: "RS-1028",
    productName: "E-Paper Retail Label Tags (Pack of 10)",
    quantity: 4,
    retailerName: "Balaji Agrotech Co-op",
    priority: "Low",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: "Synced",
    storageLocation: "Cloud"
  },
  {
    id: "ord-9",
    orderId: "RS-1029",
    productName: "Soil Moisture Sensors v2.1",
    quantity: 12,
    retailerName: "Ram Prasad Fertilisers",
    priority: "Medium",
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    status: "Pending",
    storageLocation: "ESP32 Local Buffer"
  },
  {
    id: "ord-10",
    orderId: "RS-1030",
    productName: "Smart Drip-Irrig V2 Controller",
    quantity: 1,
    retailerName: "Karan Agri-Services Ltd",
    priority: "High",
    timestamp: new Date(Date.now() - 3600000 * 0.25).toISOString(),
    status: "Proposed",
    storageLocation: "ESP32 Local Buffer"
  }
];

let deviceStatus: DeviceStatus = {
  deviceId: "ESP32-RuralSync-001",
  signalStrength: -64, // dBm
  memoryUsage: 38, // 38% used of 320KB
  cpuUsage: 14,
  uptime: 4850, // seconds
  status: "ONLINE",
  lastHeartbeat: new Date().toISOString(),
  ordersStoredLocally: 2,
  ordersSynced: 8,
  failedSyncAttempts: 0
};

let deviceEvents: DeviceEvent[] = [
  {
    id: "evt-1",
    event: "Device Booted Success - Firmware v1.2.0",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: "evt-2",
    event: "WiFi Network Connected (RuralNet_AM2)",
    timestamp: new Date(Date.now() - 3600000 * 3.9).toISOString()
  },
  {
    id: "evt-3",
    event: "Heartbeat Established with Cloud Server",
    timestamp: new Date(Date.now() - 3600000 * 3.8).toISOString()
  },
  {
    id: "evt-4",
    event: "Initial Sync Completed: 3 historically verified",
    timestamp: new Date(Date.now() - 3600000 * 3.5).toISOString()
  }
];

let syncLogs: SyncLog[] = [
  {
    id: "sync-1",
    timestamp: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    ordersSynced: 3,
    result: "Success: Verified and migrated to Cloud"
  }
];

// Global simulation control
let isInternetAvailable = true;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Event logger helper
  const addEvent = (msg: string) => {
    const newEvent: DeviceEvent = {
      id: "evt-" + Math.random().toString(36).substring(2, 9),
      event: msg,
      timestamp: new Date().toISOString()
    };
    deviceEvents.unshift(newEvent);
    if (deviceEvents.length > 100) deviceEvents.pop();
    return newEvent;
  };

  // Helper to add order
  const createNewOrder = (
    productName: string,
    quantity: number,
    retailerName: string,
    priority: "Low" | "Medium" | "High",
    proposed = false
  ) => {
    const orderIndex = orders.length + 1;
    const orderId = `RS-${1020 + orderIndex}`;
    const id = "ord-" + Math.random().toString(36).substring(2, 9);

    let status: Order["status"] = isInternetAvailable ? "Synced" : "Pending";
    let storageLocation: "Cloud" | "ESP32 Local Buffer" = isInternetAvailable ? "Cloud" : "ESP32 Local Buffer";

    if (proposed) {
      status = "Proposed";
      storageLocation = "ESP32 Local Buffer";
    }

    const newOrder: Order = {
      id,
      orderId,
      productName,
      quantity,
      retailerName,
      priority,
      timestamp: new Date().toISOString(),
      status,
      storageLocation
    };

    orders.unshift(newOrder);

    if (proposed) {
      addEvent(`Order Proposal Created: ${orderId} (${productName}) from edge, awaiting merchant approval`);
    } else if (!isInternetAvailable) {
      deviceStatus.ordersStoredLocally += 1;
      addEvent(`Order Buffered: ${orderId} (${productName}) stored in LittleFS /orders.txt`);
    } else {
      deviceStatus.ordersSynced += 1;
      addEvent(`Order Synced: ${orderId} (${productName}) uploaded directly to Cloud database`);
    }

    return newOrder;
  };

  // ─── API ROUTES ────────────────────────────────────────────────────────────

  // Get all orders
  app.get("/api/orders", (req, res) => {
    res.json({ orders });
  });

  // Create new order
  app.post("/api/orders", (req, res) => {
    const { productName, quantity, retailerName, priority, proposed } = req.body;
    if (!productName || !quantity || !retailerName || !priority) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const order = createNewOrder(productName, Number(quantity), retailerName, priority, !!proposed);
    // Queue a buzzer command for the ESP32
    esp32Commands.push({
      id: "cmd-" + Math.random().toString(36).substring(2, 9),
      type: "beep",
      payload: { orderId: order.orderId }
    });
    addEvent(`Buzzer command queued for order ${order.orderId}`);
    res.json({ order, deviceStatus });
  });

  // ─── Merchant (ESP32 Proposed) order approval / rejection ─────────────────
  app.post("/api/orders/:id/approve", (req, res) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "Synced";
    order.storageLocation = "Cloud";
    deviceStatus.ordersSynced += 1;
    addEvent(`Order Proposal Approved: ${order.orderId} (${order.productName}) accepted by merchant`);
    res.json({ success: true, order, deviceStatus });
  });

  app.post("/api/orders/:id/reject", (req, res) => {
    const { id } = req.params;
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return res.status(404).json({ error: "Order not found" });

    const order = orders[orderIndex];
    orders.splice(orderIndex, 1);
    addEvent(`Order Proposal Rejected: ${order.orderId} (${order.productName}) declined by merchant`);
    res.json({ success: true, deviceStatus });
  });

  // ─── Supplier Portal Actions ───────────────────────────────────────────────

  // Supplier approves a synced order → Payment Pending
  app.post("/api/orders/:id/supplier-approve", (req, res) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "Payment Pending";
    addEvent(`Supplier Approved: ${order.orderId} (${order.productName}) — awaiting customer payment`);
    res.json({ success: true, order, deviceStatus });
  });

  // Supplier rejects a synced order → removed
  app.post("/api/orders/:id/supplier-reject", (req, res) => {
    const { id } = req.params;
    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return res.status(404).json({ error: "Order not found" });

    const order = orders[orderIndex];
    orders.splice(orderIndex, 1);
    addEvent(`Supplier Rejected: ${order.orderId} (${order.productName}) — order cancelled`);
    res.json({ success: true, deviceStatus });
  });

  // Supplier dispatches a paid order → In Transit
  app.post("/api/orders/:id/dispatch", (req, res) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "In Transit";
    addEvent(`Supplier Dispatched: ${order.orderId} (${order.productName}) — shipment In Transit`);
    res.json({ success: true, order, deviceStatus });
  });

  // Supplier marks delivery complete → Delivered
  app.post("/api/orders/:id/delivered", (req, res) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "Delivered";
    addEvent(`Order Delivered: ${order.orderId} (${order.productName}) — delivery confirmed`);
    res.json({ success: true, order, deviceStatus });
  });

  // ─── Customer Payment Action ───────────────────────────────────────────────

  // Customer pays → Paid
  app.post("/api/orders/:id/pay", (req, res) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "Paid";
    addEvent(`Payment Received: ${order.orderId} (${order.productName}) — payment confirmed by customer`);
    // Queue a buzzer command for ESP32 as payment confirmation
    esp32Commands.push({
      id: "cmd-" + Math.random().toString(36).substring(2, 9),
      type: "payment_beep",
      payload: { orderId: order.orderId }
    });
    res.json({ success: true, order, deviceStatus });
  });

  // ─── Device Status ─────────────────────────────────────────────────────────

  app.get("/api/device/status", (req, res) => {
    deviceStatus.uptime += 10;
    if (deviceStatus.status === "ONLINE") {
      deviceStatus.signalStrength = -60 - Math.floor(Math.random() * 10);
      deviceStatus.cpuUsage = 10 + Math.floor(Math.random() * 10);
    } else if (deviceStatus.status === "OFFLINE") {
      deviceStatus.signalStrength = -110;
      deviceStatus.cpuUsage = 4 + Math.floor(Math.random() * 5);
    }
    deviceStatus.lastHeartbeat = new Date().toISOString();
    res.json(deviceStatus);
  });

  app.post("/api/device/status", (req, res) => {
    const { status, signalStrength, memoryUsage, cpuUsage, uptime, ordersStoredLocally } = req.body;

    if (status) deviceStatus.status = status;
    if (signalStrength !== undefined) deviceStatus.signalStrength = signalStrength;
    if (memoryUsage !== undefined) deviceStatus.memoryUsage = memoryUsage;
    if (cpuUsage !== undefined) deviceStatus.cpuUsage = cpuUsage;
    if (uptime !== undefined) deviceStatus.uptime = uptime;
    if (ordersStoredLocally !== undefined) deviceStatus.ordersStoredLocally = ordersStoredLocally;

    deviceStatus.lastHeartbeat = new Date().toISOString();
    res.json({ message: "Status updated successfully", deviceStatus });
  });

  // ─── Device Events ─────────────────────────────────────────────────────────

  app.get("/api/device/events", (req, res) => {
    res.json({ events: deviceEvents });
  });

  app.post("/api/device/events", (req, res) => {
    const { event } = req.body;
    if (!event) return res.status(400).json({ error: 'Missing "event" field' });
    const evt = addEvent(event);
    res.json({ success: true, event: evt });
  });

  // ─── ESP32 Command Queue ───────────────────────────────────────────────────

  app.get("/api/esp32/commands", (req, res) => {
    const cmds = [...esp32Commands];
    esp32Commands = [];
    res.json({ commands: cmds });
  });

  // ─── Sync ──────────────────────────────────────────────────────────────────

  app.get("/api/sync/history", (req, res) => {
    res.json({ syncLogs });
  });

  app.post("/api/sync", (req, res) => {
    if (!isInternetAvailable) {
      deviceStatus.failedSyncAttempts += 1;
      addEvent("Sync Attempt Failed: No cloud connectivity");
      return res.status(400).json({
        error: "Sync Failed: Cloud backend is currently unreachable from Edge Gateway."
      });
    }

    const pendingOrders = orders.filter(o => o.status === "Pending");
    const count = pendingOrders.length;

    if (count === 0) {
      return res.json({ message: "No orders to synchronize.", ordersSynced: 0, deviceStatus });
    }

    deviceStatus.status = "SYNCING";
    addEvent(`Synchronization Started: Scanning LittleFS queue containing ${count} buffer files...`);

    pendingOrders.forEach(o => {
      o.status = "Pending Approval";
      o.storageLocation = "Cloud";
    });

    deviceStatus.ordersStoredLocally = 0;
    deviceStatus.ordersSynced += count;
    deviceStatus.status = "ONLINE";

    addEvent(`Synchronization Completed: Uploaded ${count} orders successfully. LittleFS buffer cleared.`);

    const newLog: SyncLog = {
      id: "sync-" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ordersSynced: count,
      result: `Success: Transferred ${count} pending orders to cloud. Now awaiting supplier approval.`
    };
    syncLogs.unshift(newLog);

    res.json({ success: true, ordersSynced: count, deviceStatus, syncLogs });
  });

  // ─── Network Simulation ────────────────────────────────────────────────────

  app.get("/api/network-status", (req, res) => {
    res.json({ isInternetAvailable });
  });

  app.post("/api/network-status", (req, res) => {
    const { available } = req.body;
    if (available === undefined) return res.status(400).json({ error: "Missing available boolean field" });

    isInternetAvailable = available;

    if (isInternetAvailable) {
      deviceStatus.status = "ONLINE";
      addEvent("WiFi Connected - Internet Restored");
    } else {
      deviceStatus.status = "OFFLINE";
      addEvent("WiFi Connected but Internet Outage Detected");
    }

    res.json({ isInternetAvailable, deviceStatus });
  });

  // ─── Device Control ────────────────────────────────────────────────────────

  app.post("/api/device/restart", (req, res) => {
    deviceStatus.uptime = 0;
    deviceStatus.cpuUsage = 95;
    deviceStatus.memoryUsage = 15;

    addEvent("System Command: ESP32 manual safe restart initiated...");
    addEvent("Hardware restarting...");

    setTimeout(() => {
      deviceStatus.cpuUsage = 14;
      deviceStatus.memoryUsage = 38;
      addEvent("Device Booted Success - Firmware v1.2.0");
      if (isInternetAvailable) {
        addEvent("WiFi Network Connected (RuralNet_AM2)");
        addEvent("Heartbeat established with Cloud server");
      } else {
        addEvent("WiFi connected but Internet Outage Detected");
      }
    }, 1500);

    res.json({ success: true, deviceStatus });
  });

  // ─── Demo Reset ────────────────────────────────────────────────────────────

  app.post("/api/demo/reset", (req, res) => {
    orders = [
      {
        id: "ord-1",
        orderId: "RS-1021",
        productName: "Solar Irrigation Pump Controller",
        quantity: 2,
        retailerName: "AgriTech Rural Solutions",
        priority: "High",
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        status: "Delivered",
        storageLocation: "Cloud"
      },
      {
        id: "ord-2",
        orderId: "RS-1022",
        productName: "High-Yield Seed Kits (Wheat)",
        quantity: 50,
        retailerName: "Bhoomi Fertilizer Hub",
        priority: "Medium",
        timestamp: new Date(Date.now() - 3600000 * 7).toISOString(),
        status: "In Transit",
        storageLocation: "Cloud"
      },
      {
        id: "ord-3",
        orderId: "RS-1023",
        productName: "Drip Irrigation Pipe Bundle (100m)",
        quantity: 8,
        retailerName: "GreenValley Co-operative",
        priority: "Low",
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        status: "Paid",
        storageLocation: "Cloud"
      },
      {
        id: "ord-4",
        orderId: "RS-1024",
        productName: "LoRa 915MHz Gateway Module",
        quantity: 1,
        retailerName: "Krishna Kalyan Bhandar",
        priority: "High",
        timestamp: new Date(Date.now() - 3600000 * 5.5).toISOString(),
        status: "Payment Pending",
        storageLocation: "Cloud"
      },
      {
        id: "ord-5",
        orderId: "RS-1025",
        productName: "Organic Super-Phosphate (25kg)",
        quantity: 20,
        retailerName: "Maa Durga Fertilisers",
        priority: "Medium",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        status: "Pending Approval",
        storageLocation: "Cloud"
      },
      {
        id: "ord-6",
        orderId: "RS-1026",
        productName: "Off-Grid Deep Cycle Battery 200Ah",
        quantity: 3,
        retailerName: "Agrikart Cooperative",
        priority: "High",
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        status: "Pending Approval",
        storageLocation: "Cloud"
      },
      {
        id: "ord-7",
        orderId: "RS-1027",
        productName: "Smart Ferti-Meter v3 Probe",
        quantity: 5,
        retailerName: "Farms Depot",
        priority: "Low",
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        status: "Synced",
        storageLocation: "Cloud"
      },
      {
        id: "ord-8",
        orderId: "RS-1028",
        productName: "E-Paper Retail Label Tags (Pack of 10)",
        quantity: 4,
        retailerName: "Balaji Agrotech Co-op",
        priority: "Low",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        status: "Synced",
        storageLocation: "Cloud"
      },
      {
        id: "ord-9",
        orderId: "RS-1029",
        productName: "Soil Moisture Sensors v2.1",
        quantity: 12,
        retailerName: "Ram Prasad Fertilisers",
        priority: "Medium",
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        status: "Pending",
        storageLocation: "ESP32 Local Buffer"
      },
      {
        id: "ord-10",
        orderId: "RS-1030",
        productName: "Smart Drip-Irrig V2 Controller",
        quantity: 1,
        retailerName: "Karan Agri-Services Ltd",
        priority: "High",
        timestamp: new Date(Date.now() - 3600000 * 0.25).toISOString(),
        status: "Proposed",
        storageLocation: "ESP32 Local Buffer"
      }
    ];

    deviceStatus = {
      deviceId: "ESP32-RuralSync-001",
      signalStrength: -65,
      memoryUsage: 38,
      cpuUsage: 12,
      uptime: 4850,
      status: "ONLINE",
      lastHeartbeat: new Date().toISOString(),
      ordersStoredLocally: 2,
      ordersSynced: 8,
      failedSyncAttempts: 0
    };

    deviceEvents = [
      {
        id: "evt-1",
        event: "Device Reset To Default Configuration",
        timestamp: new Date().toISOString()
      },
      {
        id: "evt-2",
        event: "Initial Sync Completed: All records clean",
        timestamp: new Date().toISOString()
      }
    ];

    syncLogs = [
      {
        id: "sync-init",
        timestamp: new Date().toISOString(),
        ordersSynced: 3,
        result: "Demo Database initialized successfully"
      }
    ];

    isInternetAvailable = true;
    esp32Commands = [];

    res.json({ success: true, message: "Demo reset to default state" });
  });

  // ─── Vite / Static Serving ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RuralSync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
