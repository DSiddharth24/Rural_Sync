/*
 * RuralSync - ESP32 Offline-First Edge Gateway Firmware
 * Developed for Engineering Innovation Competition
 * 
 * Hardware Requirements:
 * - ESP32 Development Board (e.g., ESP32-WROOM-32E)
 * - I2C SSD1306 128x64 OLED Display (SDA = GPIO 21, SCL = GPIO 22) [OPTIONAL - Will not freeze if missing]
 * - Physical Push Button connected to GPIO 12 (with internal PULLUP) [OPTIONAL - Serial 'g' triggers orders]
 * - Internet router / Mobile hotspot (to simulate WiFi connection & outage)
 * 
 * Required Arduino Libraries (Install via Library Manager):
 * - Adafruit SSD1306 & Adafruit GFX Library
 * - ArduinoJson (v6 or v7)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

// --- USER CONFIGURATION ---
const char* WIFI_SSID     = "pocof7";
const char* WIFI_PASSWORD = "1234567890";

// REPLACE WITH YOUR BACKEND CLOUD URL OR YOUR CONTAINER RUN URL
// Important: Ensure it ends with / inside the quotes
const String SERVER_URL  = "https://rural-sync-sable.vercel.app/"; 

// Pin Definitions
#define BUTTON_PIN      12 // Push Button (Low when pressed)
#define BUZZER_PIN      13 // Active buzzer / LED (HIGH = ON)
#define OLED_RESET      -1 // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_ADDRESS  0x3C // 128x64 OLED I2C Address

Adafruit_SSD1306 display(128, 64, &Wire, OLED_RESET);

// State Management
enum SystemState { STATE_BOOT, STATE_ONLINE, STATE_OFFLINE, STATE_SYNCING };
SystemState currentState = STATE_BOOT;

// Heartbeat & Timer Configs
unsigned long lastHeartbeatTime = 0;
const unsigned long HEARTBEAT_INTERVAL = 10000; // 10 seconds

// Command Poll Timer (buzzer feedback)
unsigned long lastCommandPollTime = 0;
const unsigned long COMMAND_POLL_INTERVAL = 5000; // Poll every 5 seconds

// Button Debounce 
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_DELAY = 300; // ms

// --- DEMO CONFIGURATION ---
const bool AUTO_DEMO_MODE = true;  // If true, automatically generates a dummy order every 20 seconds
const unsigned long AUTO_ORDER_INTERVAL = 20000; // 20 seconds
unsigned long lastAutoOrderTime = 0;

String deviceId = "ESP32-RuralSync-001";
int localBufferCount = 0;
int successfulSyncs = 0;
bool hasDisplay = true; // Set to false if display is missing or fails to initialize

// Draw custom icons on OLED
void drawWiFiIcon(bool connected) {
  if (!hasDisplay) return;
  if (connected) {
    display.drawCircle(115, 8, 8, SSD1306_WHITE);
    display.drawCircle(115, 8, 4, SSD1306_WHITE);
    display.fillCircle(115, 8, 1, SSD1306_WHITE);
  } else {
    display.drawLine(107, 0, 123, 16, SSD1306_WHITE);
    display.drawLine(123, 0, 107, 16, SSD1306_WHITE);
  }
}

// Global update display function
void updateOLED(const String& line1, const String& line2, const String& line3) {
  // Always log status updates to Serial Monitor for debugging/headless use
  Serial.println("\n>>> [OLED Update Redirect] <<<");
  Serial.print("  Line 1: "); Serial.println(line1);
  Serial.print("  Line 2: "); Serial.println(line2);
  Serial.print("  Line 3: "); Serial.println(line3);
  Serial.println("----------------------------");

  if (!hasDisplay) return;

  display.clearDisplay();
  
  // Header Bar
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.print("RuralSync ");
  display.print(deviceId.substring(16)); // print short ID
  
  // Custom Wifi indicators
  drawWiFiIcon(currentState == STATE_ONLINE || currentState == STATE_SYNCING);
  display.drawLine(0, 12, 127, 12, SSD1306_WHITE);

  // Body text
  display.setCursor(0, 18);
  display.setTextSize(1);
  display.print("ST: ");
  if (currentState == STATE_ONLINE) display.print("ONLINE (Cloud)");
  else if (currentState == STATE_OFFLINE) display.print("OFFLINE (LittleFS)");
  else if (currentState == STATE_SYNCING) display.print("SYNCING...");
  else display.print("BOOTING...");

  display.setCursor(0, 32);
  display.print(line1);

  display.setCursor(0, 44);
  display.print(line2);

  // Status footer block
  display.setCursor(0, 56);
  display.print("Buff: ");
  display.print(localBufferCount);
  display.print(" | Synced: ");
  display.print(successfulSyncs);
  
  display.display();
}

// Read the buffered file size / item count
void recountLocalBuffer() {
  if (!LittleFS.exists("/orders.txt")) {
    localBufferCount = 0;
    Serial.println("[LittleFS] Buffer file (/orders.txt) does not exist yet.");
    return;
  }
  
  File file = LittleFS.open("/orders.txt", "r");
  if (!file) {
    localBufferCount = 0;
    Serial.println("[LittleFS] Failed to open /orders.txt for reading.");
    return;
  }

  int count = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.length() > 5) {
      count++;
    }
  }
  file.close();
  localBufferCount = count;
  Serial.print("[LittleFS] Current local buffer queue size: ");
  Serial.println(localBufferCount);
}

// Poll /api/esp32/commands and execute buzzer feedback
void pollCommandQueue() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = SERVER_URL + "api/esp32/commands";
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err) {
      JsonArray cmds = doc["commands"].as<JsonArray>();
      for (JsonObject cmd : cmds) {
        String type = cmd["type"].as<String>();
        Serial.print("[CMD] Executing command: "); Serial.println(type);

        int beeps = 0;
        if (type == "beep")         beeps = 2; // 2 beeps = new order confirmed
        if (type == "payment_beep") beeps = 3; // 3 beeps = payment confirmed

        for (int i = 0; i < beeps; i++) {
          digitalWrite(BUZZER_PIN, HIGH);
          delay(150);
          digitalWrite(BUZZER_PIN, LOW);
          if (i < beeps - 1) delay(100);
        }
        if (hasDisplay) {
          updateOLED("[CMD] " + type, cmd["payload"]["orderId"] | "Unknown", "Buzzer fired x" + String(beeps));
        }
      }
    }
  } else if (httpCode > 0) {
    Serial.print("[CMD POLL] HTTP code: "); Serial.println(httpCode);
  }
  http.end();
}

// POST event logs to backend API
void logEventToCloud(String message) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = SERVER_URL + "api/device/events";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["event"] = message;
  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  http.end();
}

// Push system telemetries to API
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    currentState = STATE_OFFLINE;
    recountLocalBuffer();
    updateOLED("WiFi Lost", "Hotspot unreachable", "Checking signal...");
    return;
  }

  HTTPClient http;
  String url = SERVER_URL + "api/device/status";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Get ESP32 internal statistics
  int signalStrength = WiFi.RSSI();
  uint32_t freeHeap = ESP.getFreeHeap();
  int memoryUsagePercentage = 100 - ((freeHeap * 100) / 320000); // roughly 320KB RAM
  int cpuUsage = random(10, 22); // Simulated core processing
  unsigned long uptime = millis() / 1000;

  StaticJsonDocument<250> doc;
  doc["deviceId"] = deviceId;
  doc["status"] = (currentState == STATE_ONLINE) ? "ONLINE" : "SYNCING";
  doc["signalStrength"] = signalStrength;
  doc["memoryUsage"] = memoryUsagePercentage;
  doc["cpuUsage"] = cpuUsage;
  doc["uptime"] = uptime;
  doc["ordersStoredLocally"] = localBufferCount;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode > 0) {
    currentState = STATE_ONLINE;
    recountLocalBuffer();
  } else {
    currentState = STATE_OFFLINE;
    Serial.print("[HEARTBEAT] Connection failed. HTTP Code: ");
    Serial.println(httpCode);
  }
  http.end();
}

// Append new order to LittleFS local buffer file
void bufferOrderLocally(String productName, String retailer, String priority) {
  File file = LittleFS.open("/orders.txt", "a");
  if (!file) {
    Serial.println("[LittleFS ERROR] SPIFFS / LittleFS write failure!");
    updateOLED("LittleFS Error", "Flash mounting failed", "Check flash map");
    return;
  }

  // Save compact line format for easy parsing later
  file.print(productName);
  file.print(",");
  file.print(retailer);
  file.print(",");
  file.println(priority);
  file.close();

  Serial.println("[LOCAL BUFFER] Successfully appended order to /orders.txt");
  recountLocalBuffer();
  updateOLED("Buffered order!", "Stored in /orders.txt", priority + " priority");
}

// Submit single order to server
bool uploadOrder(String productName, String retailer, String priority) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[UPLOAD] WiFi not connected. Cannot upload directly.");
    return false;
  }

  HTTPClient http;
  String url = SERVER_URL + "api/orders";
  Serial.print("[HTTP] POSTing to: "); Serial.println(url);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<250> doc;
  doc["productName"] = productName;
  doc["quantity"] = 1;
  doc["retailerName"] = retailer;
  doc["priority"] = priority;
  doc["proposed"] = true;

  String requestBody;
  serializeJson(doc, requestBody);
  Serial.print("[HTTP] Payload: "); Serial.println(requestBody);

  int httpCode = http.POST(requestBody);
  Serial.print("[HTTP] Response code: "); Serial.println(httpCode);
  if (httpCode > 0) {
    String payload = http.getString();
    Serial.print("[HTTP] Response body: "); Serial.println(payload);
  } else {
    Serial.print("[HTTP] Error: "); Serial.println(http.errorToString(httpCode).c_str());
  }
  http.end();

  return (httpCode == 200 || httpCode == 201);
}

// Generate a random demo order
void generateDemoOrder() {
  // Rotate sample products for demonstration variety
  String sample_products[] = {"Smart Drip-Irrig V2", "Fibre Backhaul Link", "Off-Grid Battery Hub", "Soil Probe Sensor"};
  String sample_retailers[] = {"Agrikart Cooperative", "Maa Durga Fertilisers", "Krishi Kalyan Bhandar", "Farms Depot"};
  String sample_priorities[] = {"High", "Medium", "Low"};
  
  int index = random(0, 4);
  String prod = sample_products[index];
  String ret = sample_retailers[random(0,4)];
  String pri = sample_priorities[random(0,3)];

  Serial.println("\n==========================================");
  Serial.println("[NEW ORDER GENERATED]");
  Serial.print("  Product:  "); Serial.println(prod);
  Serial.print("  Retailer: "); Serial.println(ret);
  Serial.print("  Priority: "); Serial.println(pri);
  Serial.println("==========================================");

  if (WiFi.status() == WL_CONNECTED && currentState == STATE_ONLINE) {
    Serial.println("[STATUS] Device ONLINE. Sending directly to Cloud...");
    updateOLED("Creating Order...", prod, "Uploading directly");
    if (uploadOrder(prod, ret, pri)) {
      successfulSyncs++;
      Serial.println("[SUCCESS] Direct Cloud upload succeeded!");
      updateOLED("Order Synced!", "Directly uploaded", "to Cloud Database");
    } else {
      Serial.println("[FALLBACK] Cloud upload failed. Buffering locally...");
      bufferOrderLocally(prod, ret, pri);
    }
  } else {
    Serial.println("[STATUS] Device OFFLINE. Buffering locally...");
    bufferOrderLocally(prod, ret, pri);
  }
}

// Print a randomly selected order preset from the available choices
void printRandomPresetPreview() {
  String sample_products[] = {"Smart Drip-Irrig V2", "Fibre Backhaul Link", "Off-Grid Battery Hub", "Soil Probe Sensor"};
  String sample_retailers[] = {"Agrikart Cooperative", "Maa Durga Fertilisers", "Krishi Kalyan Bhandar", "Farms Depot"};
  String sample_priorities[] = {"High", "Medium", "Low"};
  
  int index = random(0, 4);
  String prod = sample_products[index];
  String ret = sample_retailers[random(0,4)];
  String pri = sample_priorities[random(0,3)];

  Serial.println("\n----------------------------------------");
  Serial.println("  [PRESET ORDER PREVIEW]");
  Serial.print("  Product:  "); Serial.println(prod);
  Serial.print("  Retailer: "); Serial.println(ret);
  Serial.print("  Priority: "); Serial.println(pri);
  Serial.println("----------------------------------------");
}

// Print Serial Menu Instructions
void printSerialMenu() {
  Serial.println("\n----------------------------------------");
  Serial.println("      RuralSync ESP32 Console Menu      ");
  Serial.println("----------------------------------------");
  Serial.println(" Commands:");
  Serial.println("   'g' or 'o' : Generate a random dummy order");
  Serial.println("   's'        : Trigger buffer sync to cloud");
  Serial.println("   'p'        : Show a random order preset preview");
  Serial.println("   'h'        : Show this help menu");
  Serial.println();
  Serial.println(" Available Order Presets:");
  Serial.println("   Products:  Smart Drip-Irrig V2, Fibre Backhaul Link, Off-Grid Battery Hub, Soil Probe Sensor");
  Serial.println("   Retailers: Agrikart Cooperative, Maa Durga Fertilisers, Krishi Kalyan Bhandar, Farms Depot");
  Serial.println("   Priorities: High, Medium, Low");
  Serial.println();
  Serial.print(" WiFi SSID: "); Serial.println(WIFI_SSID);
  Serial.print(" Backend:   "); Serial.println(SERVER_URL);
  Serial.print(" Auto-Demo Order Generation (20s): ");
  Serial.println(AUTO_DEMO_MODE ? "ENABLED" : "DISABLED");
  Serial.println("----------------------------------------\n");
}

// Pull records from LittleFS and push to cloud once network is restored
void synchronizeBuffer() {
  recountLocalBuffer();
  if (localBufferCount == 0) {
    Serial.println("[SYNC] Local buffer is empty. Nothing to sync.");
    return;
  }
  
  currentState = STATE_SYNCING;
  updateOLED("Starting Sync...", "Reading LittleFS", "Uploading to cloud");
  logEventToCloud("Synchronization Started: ESP32 automatic upload initiated");

  Serial.println("\n[SYNC] Starting synchronization of LittleFS buffer...");
  File file = LittleFS.open("/orders.txt", "r");
  if (!file) {
    Serial.println("[LittleFS ERROR] Failed to open /orders.txt for sync reading.");
    currentState = STATE_ONLINE;
    return;
  }

  // Read all records into dynamic buffer array
  std::vector<String> lines;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.length() > 5) {
      lines.push_back(line);
    }
  }
  file.close();

  int successfulUploads = 0;
  Serial.print("[SYNC] Found "); Serial.print(lines.size()); Serial.println(" orders in queue. Uploading sequentially...");

  // Post records sequentially
  for (size_t i = 0; i < lines.size(); i++) {
    String currentLine = lines[i];
    
    // Simple CSV parser
    int firstComma = currentLine.indexOf(',');
    int secondComma = currentLine.indexOf(',', firstComma + 1);
    
    if (firstComma != -1 && secondComma != -1) {
      String productName = currentLine.substring(0, firstComma);
      String retailer = currentLine.substring(firstComma + 1, secondComma);
      String priority = currentLine.substring(secondComma + 1);
      priority.trim(); // strip newline characters

      Serial.print("\n[SYNC] Syncing order "); Serial.print(i + 1); Serial.print("/"); Serial.println(lines.size());
      Serial.print("  Product:  "); Serial.println(productName);
      
      if (hasDisplay) {
        display.clearDisplay();
        display.setCursor(0, 0);
        display.print("Uploading: ");
        display.print(i + 1);
        display.print("/");
        display.print(lines.size());
        display.setCursor(0, 20);
        display.print(productName);
        display.display();
      }

      if (uploadOrder(productName, retailer, priority)) {
        successfulUploads++;
        successfulSyncs++;
        delay(300); // small delay to appreciate animation frames
      } else {
        Serial.println("[SYNC ERROR] Failed to upload order. Aborting sync sequence.");
        break; // Stop sync if one fails to preserve sequence & retry later
      }
    }
  }

  // Rewrite remaining lines back to file if sync didn't finish completely
  if (successfulUploads < lines.size()) {
    Serial.println("[SYNC] Sync was partial. Rewriting remaining queue back to LittleFS...");
    File fileWrite = LittleFS.open("/orders.txt", "w");
    if (fileWrite) {
      for (size_t i = successfulUploads; i < lines.size(); i++) {
        fileWrite.println(lines[i]);
      }
      fileWrite.close();
    }
  } else {
    // Clear current LittleFS local queue file
    LittleFS.remove("/orders.txt");
    Serial.println("[SYNC SUCCESS] All orders synced! LittleFS queue cleared.");
  }
  
  recountLocalBuffer();

  if (hasDisplay) {
    display.clearDisplay();
    display.setCursor(0, 20);
    display.setTextSize(1);
    display.print("Uploaded ");
    display.print(successfulUploads);
    display.print(" orders!");
    display.display();
  }
  delay(1500);

  currentState = STATE_ONLINE;
  logEventToCloud("Synchronization Completed: " + String(successfulUploads) + " orders synced. Local buffer cleared.");
  sendHeartbeat();
}

void setup() {
  Serial.begin(115200);
  delay(1000); // Wait for serial monitor to connect

  Serial.println("\n==========================================");
  Serial.println("  RuralSync Offline-First Edge Gateway    ");
  Serial.println("==========================================");

  // Initialize GPIO Pins
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Ensure buzzer is off on boot

  // Mount SSD1306 OLED Display (OPTIONAL)
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("WARNING: SSD1306 display hardware allocation failed. Continuing HEADLESS (Serial-only)."));
    hasDisplay = false;
  }
  
  if (hasDisplay) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 10);
    display.print("RuralSync Bootloader");
    display.setCursor(0, 30);
    display.print("Mounting LittleFS...");
    display.display();
  }

  // Initialize File System Partition and seed dummy data if empty
  Serial.println("[LittleFS] Mounting file system...");
  if (!LittleFS.begin(true)) {
    Serial.println("[LittleFS ERROR] Partition mount failed!");
  } else {
    Serial.println("[LittleFS] Mounted successfully.");
    
    // Dummy orders removed - starting with clean slate
    recountLocalBuffer();
  }

  if (hasDisplay) {
    display.setCursor(0, 45);
    display.print("Connecting WiFi...");
    display.display();
  }

  // Connect to Local Access WiFi Hotspot
  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int connCounter = 0;
  while (WiFi.status() != WL_CONNECTED && connCounter < 15) {
    delay(500);
    Serial.print(".");
    connCounter++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    currentState = STATE_ONLINE;
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: "); Serial.println(WiFi.localIP());
    logEventToCloud("Device Booted Success - Firmware v1.2.0");
    sendHeartbeat();
  } else {
    currentState = STATE_OFFLINE;
    Serial.println("\n[WiFi] Connection timed out. Booting in OFFLINE fail-safe mode.");
  }
  
  updateOLED("System Ready", "Press physical button", "to generate order");
  printSerialMenu();
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. WiFi Status Check & Heartbeat loop (every 10 seconds)
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = currentMillis;

    // Detect recovery from outage
    if (WiFi.status() == WL_CONNECTED && currentState == STATE_OFFLINE) {
      Serial.println("\n[WiFi] Network connection restored! Starting sync...");
      synchronizeBuffer();
    } else {
      sendHeartbeat();
    }
  }

  // 2. Poll ESP32 command queue for buzzer feedback (every 5 seconds)
  if (currentMillis - lastCommandPollTime >= COMMAND_POLL_INTERVAL) {
    lastCommandPollTime = currentMillis;
    pollCommandQueue();
  }

  // 3. Physical Button Click trigger (creates a fresh order)
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (currentMillis - lastButtonPress > DEBOUNCE_DELAY) {
      lastButtonPress = currentMillis;
      Serial.println("\n[BUTTON] Physical button clicked!");
      generateDemoOrder();
    }
  }

  // 4. Serial commands trigger (simulates orders/syncs from console)
  if (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    // Consume extra chars (like \n, \r)
    while (Serial.available() > 0) {
      Serial.read();
    }
    
    if (inChar == 'g' || inChar == 'G' || inChar == 'o' || inChar == 'O') {
      Serial.println("\n[SERIAL COMMAND] Generating dummy order...");
      generateDemoOrder();
    } else if (inChar == 's' || inChar == 'S') {
      Serial.println("\n[SERIAL COMMAND] Manual Sync Triggered!");
      synchronizeBuffer();
    } else if (inChar == 'p' || inChar == 'P') {
      printRandomPresetPreview();
    } else if (inChar == 'h' || inChar == 'H') {
      printSerialMenu();
    }
  }

  // 5. Automatic periodic order generation (if enabled)
  if (AUTO_DEMO_MODE && (currentMillis - lastAutoOrderTime >= AUTO_ORDER_INTERVAL)) {
    lastAutoOrderTime = currentMillis;
    generateDemoOrder();
  }
}
