/* PAQSAFE complete prototype
   Parcel #001 = actual Arduino serial readings only.
   Parcel #002 and #003 = labelled demo records; never treated as live.
*/
const $ = (id) => document.getElementById(id);
const FEEDBACK_EMAIL = "lavenderhaz246@gmail.com"; // User-configured inbox; FormSubmit activation is required.
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`;

let port = null, reader = null, connected = false, lineBuffer = "";
let lastDistance = null, lastWater = null, lastReadingTime = null;
let threshold = Number(localStorage.getItem("paq_threshold") || 500);
let readings = [];
let activity = [];
let parcels = [
  { id: "001", name: "Monitored Parcel", reference: "LIVE DEVICE", kind: "live", created: "Primary monitoring parcel" },
  { id: "002", name: "Sample Parcel", reference: "DEMO RECORD", kind: "demo", created: "Illustrative example only" },
  { id: "003", name: "Sample Parcel", reference: "DEMO RECORD", kind: "demo", created: "Illustrative example only" }
];

function setConnectionState(on, message = "") {
  connected = on;
  $("sideDot").classList.toggle("on", on);
  $("topDot").classList.toggle("on", on);
  $("sideConnection").textContent = on ? "Device connected" : "Device offline";
  $("topConnection").textContent = on ? "Device connected" : "Device offline";
  $("overviewConnection").textContent = on ? "Connected" : "Offline";
  $("overviewConnectionHint").textContent = on ? "Arduino UNO · USB serial" : "Connect Arduino by USB";
  $("homeDeviceStatus").textContent = on ? "Arduino connected" : "Not connected";
  $("homeDeviceDescription").textContent = on ? "Receiving serial data for Parcel #001." : "Connect the Arduino UNO to begin receiving sensor readings.";
  $("monitorConnectionDetail").textContent = on ? "Connected" : "Disconnected";
  $("analyticsConnection").textContent = on ? "Connected" : "Offline";
  $("devicePageStatus").textContent = on ? "Arduino connected" : "Not connected";
  $("monitorStatus").textContent = on ? "DEVICE CONNECTED" : "NOT CONNECTED";
  $("monitorDeviceDot").style.background = on ? "#36a979" : "#aab8bd";
  $("deviceConnectBtn").disabled = on;
  $("deviceDisconnectBtn").disabled = !on;
  $("devicePageMessage").textContent = message || (on ? "Serial connection active. Waiting for readings…" : "Ready to connect. Close Arduino Serial Monitor first.");
  $("homeDeviceStatus").textContent = on ? "Arduino connected" : "Not connected";
  renderHomeParcels();
  renderRegistry();
}

function showEmptyLiveValues() {
  ["overviewDistance","monitorDistance","analyticsDistance"].forEach(id => $(id).textContent = "—");
  ["overviewWater","monitorWaterRaw","analyticsWater"].forEach(id => $(id).textContent = "—");
  $("overviewWaterHint").textContent = "Waiting for readings";
  $("monitorWaterStatus").textContent = "Waiting for sensor data";
  $("monitorRisk").textContent = "Unknown";
  $("monitorRisk").style.color = "";
  $("monitorLastReading").textContent = "No reading received";
  $("overviewUpdated").textContent = "Waiting for device data";
  $("monitorThreshold").textContent = String(threshold);
  $("riskHeadline").textContent = "Waiting for sensor data";
  $("riskDescription").textContent = "Connect the Arduino to assess water sensor readings for Parcel #001.";
  $("analyticsCount").textContent = "0";
  $("distanceEmpty").style.display = "grid";
  $("waterEmpty").style.display = "grid";
  drawCharts();
}

function addActivity(title, detail, isAlert = false) {
  activity.unshift({ title, detail, isAlert, time: new Date() });
  activity = activity.slice(0, 50);
  renderActivity();
}

function handleSensorData(obj) {
  const distance = Number(obj.distance_cm);
  const water = Number(obj.water_raw);
  if (!Number.isFinite(distance) || !Number.isFinite(water) || water < 0 || water > 1023) return;

  if (distance >= 0 && distance <= 450) {
    lastDistance = distance;
    $("overviewDistance").textContent = distance.toFixed(1);
    $("monitorDistance").textContent = distance.toFixed(1);
    $("analyticsDistance").textContent = distance.toFixed(1);
  } else {
    lastDistance = null;
    $("overviewDistance").textContent = "—";
    $("monitorDistance").textContent = "—";
    $("analyticsDistance").textContent = "—";
  }

  lastWater = Math.round(water);
  $("overviewWater").textContent = lastWater >= threshold ? "Detected" : "No water";
  $("overviewWaterHint").textContent = `Raw value: ${lastWater}`;
  $("monitorWaterRaw").textContent = String(lastWater);
  $("analyticsWater").textContent = String(lastWater);

  const wet = lastWater >= threshold;
  $("monitorRisk").textContent = wet ? "Water detected" : "No water detected";
  $("monitorRisk").style.color = wet ? "#bd7048" : "#268b65";
  $("monitorWaterStatus").textContent = wet ? "Above configured threshold" : "Below configured threshold";
  $("monitorWaterStatus").style.color = wet ? "#bd7048" : "#268b65";
  $("riskHeadline").textContent = wet ? "Water threshold exceeded" : "No water detected";
  $("riskDescription").textContent = wet
    ? `Parcel #001 water sensor reading (${lastWater}) is at or above the configured threshold (${threshold}).`
    : `Parcel #001 water sensor reading (${lastWater}) is below the configured threshold (${threshold}).`;

  lastReadingTime = new Date();
  $("monitorLastReading").textContent = lastReadingTime.toLocaleTimeString();
  $("overviewUpdated").textContent = `Updated ${lastReadingTime.toLocaleTimeString()}`;
  readings.push({ time: lastReadingTime, distance: lastDistance, water: lastWater });
  if (readings.length > 60) readings.shift();
  $("analyticsCount").textContent = String(readings.length);
  $("distanceEmpty").style.display = readings.some(r => r.distance !== null) ? "none" : "grid";
  $("waterEmpty").style.display = "none";
  renderCharts();

  const previous = activity[0];
  if (!previous || (wet !== previous.isAlert)) {
    addActivity(wet ? "Water threshold exceeded" : "Water reading below threshold",
      `Parcel #001 · Raw value ${lastWater} · Threshold ${threshold}`, wet);
  }
}

function parseSerialLine(line) {
  const clean = line.trim();
  if (!clean) return;
  try {
    const obj = JSON.parse(clean);
    handleSensorData(obj);
  } catch (error) {
    console.warn("PAQSAFE ignored non-JSON serial line:", clean);
  }
}

async function connectArduino() {
  if (!("serial" in navigator)) {
    $("devicePageMessage").textContent = "Web Serial is unavailable. Open this HTTPS site in Chrome or Edge.";
    return;
  }
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    connected = true;
    setConnectionState(true, "Connected. Waiting for the first valid sensor reading…");
    addActivity("Arduino connected", "USB serial connection opened for Parcel #001.", false);
    reader = port.readable.getReader();
    const decoder = new TextDecoder();
    while (connected && reader) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || "";
        lines.forEach(parseSerialLine);
      }
    }
  } catch (error) {
    console.error(error);
    const message = error.name === "NotFoundError" ? "No serial device was selected." :
      error.name === "SecurityError" ? "Serial access was blocked. Use HTTPS and allow serial permissions." :
      "Connection failed. Check the USB cable and close Arduino Serial Monitor.";
    $("devicePageMessage").textContent = message;
    if (connected) await disconnectArduino(false);
    else setConnectionState(false, message);
  }
}

async function disconnectArduino(logEvent = true) {
  const wasConnected = connected;
  connected = false;
  try {
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      reader = null;
    }
  } catch (e) { console.warn(e); }
  try {
    if (port) {
      await port.close();
      port = null;
    }
  } catch (e) { console.warn(e); }
  lineBuffer = "";
  lastDistance = null;
  lastWater = null;
  showEmptyLiveValues();
  setConnectionState(false, "Disconnected. Parcel #001 is waiting for the Arduino.");
  if (logEvent && wasConnected) addActivity("Arduino disconnected", "No live readings are currently being received.", false);
}

function navigate(page) {
  const valid = ["home","registry","monitor","risk","analytics","discover","about","device","feedback","settings"];
  if (!valid.includes(page)) page = "home";
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  const labels = {home:"Overview",registry:"Parcel Registry",monitor:"Parcel Monitor",risk:"Risk Center",analytics:"Analytics",discover:"Discover",about:"About Us",device:"Device Connection",feedback:"Feedback",settings:"Settings"};
  $("pageCrumb").textContent = labels[page];
  $("sidebar").classList.remove("open");
  if (page === "analytics") renderCharts();
  if (page === "registry") renderRegistry();
  if (page === "home") renderHomeParcels();
}
window.addEventListener("hashchange", () => navigate(location.hash.replace("#","") || "home"));
document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click", () => navigate(a.dataset.page)));
document.querySelectorAll('a[href^="#"]').forEach(a => {
  if (!a.dataset.page && a.getAttribute("href").length > 1) a.addEventListener("click", () => {
    const target = a.getAttribute("href").slice(1);
    if (document.getElementById(`page-${target}`)) navigate(target);
  });
});

function renderHomeParcels() {
  const host = $("homeParcelList");
  if (!host) return;
  host.innerHTML = parcels.slice(0, 5).map(p => {
    const isLive = p.kind === "live";
    const label = isLive ? (connected ? "DEVICE CONNECTED" : "NOT CONNECTED") : "DEMO VERSION";
    return `<div class="home-parcel-row"><div class="parcel-thumb ${isLive ? "" : "demo"}">${p.id}</div><div class="parcel-row-main"><b>Parcel #${p.id} · ${escapeHTML(p.name)}</b><small>${isLive ? "Arduino UNO · Real sensor data only" : "Sample record · No sensor connected"}</small></div><span class="row-state ${isLive && connected ? "live" : ""}">${label}</span></div>`;
  }).join("");
  $("parcelCount").textContent = String(parcels.length);
}

function renderRegistry() {
  const host = $("registryGrid");
  if (!host) return;
  const query = ($("parcelSearch")?.value || "").toLowerCase();
  const shown = parcels.filter(p => `${p.id} ${p.name} ${p.reference}`.toLowerCase().includes(query));
  host.innerHTML = shown.map(p => {
    const live = p.kind === "live";
    const status = live ? (connected ? "DEVICE CONNECTED" : "NOT CONNECTED") : "DEMO VERSION";
    return `<article class="registry-card ${live ? "live-record" : ""}"><div class="card-top"><span class="parcel-id">PARCEL #${p.id}</span><span class="${live ? "status-pill" : "soft-tag"}">${status}</span></div><div class="parcel-thumb ${live ? "" : "demo"}" style="width:48px;height:48px;margin-top:18px">${p.id}</div><h3>${escapeHTML(p.name)}</h3><p>${live ? "Assigned to Arduino UNO. Actual readings appear in Parcel Monitor when connected." : "Registry/demo record only. No physical sensor is assigned and no live values are shown."}</p><div class="card-actions"><span class="row-state">${escapeHTML(p.reference)}</span>${p.id !== "001" ? `<button class="tiny-btn danger" data-remove="${p.id}">Remove</button>` : `<a class="tiny-btn" href="#device">Device settings →</a>`}</div></article>`;
  }).join("") || `<div class="empty-state">No matching parcel records.</div>`;
  host.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.remove;
    parcels = parcels.filter(p => p.id !== id);
    renderRegistry(); renderHomeParcels();
  }));
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

$("addParcelBtn").addEventListener("click", () => {
  $("parcelModal").classList.add("open");
  $("parcelModal").setAttribute("aria-hidden","false");
});
function closeModal() {
  $("parcelModal").classList.remove("open");
  $("parcelModal").setAttribute("aria-hidden","true");
}
$("modalClose").addEventListener("click", closeModal);
$("parcelModal").addEventListener("click", e => { if (e.target === $("parcelModal")) closeModal(); });
$("addParcelForm").addEventListener("submit", e => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const id = String(Math.max(3, ...parcels.map(p => Number(p.id))) + 1).padStart(3,"0");
  parcels.push({id, name:fd.get("name").trim(), reference:fd.get("reference").trim() || "REGISTRY ONLY", kind:"demo", created:"Registry-only record"});
  e.currentTarget.reset(); closeModal(); renderRegistry(); renderHomeParcels();
});

function renderActivity() {
  const host = $("activityLog");
  if (!activity.length) {
    host.innerHTML = `<div class="empty-state">No device events recorded yet.</div>`;
    return;
  }
  host.innerHTML = activity.map(item => `<div class="log-row"><span class="log-dot ${item.isAlert ? "alert" : ""}"></span><div class="log-main"><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.detail)} · ${item.time.toLocaleTimeString()}</small></div></div>`).join("");
}
$("clearLogBtn").addEventListener("click", () => { activity = []; renderActivity(); });

function drawOneChart(canvasId, key, thresholdLine = null) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(260, rect.width || 500);
  const height = 210;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr; canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,width,height);
  const vals = readings.map(r => r[key]).filter(v => v !== null && Number.isFinite(v));
  if (!vals.length) return;
  const pad = {l:32,r:12,t:15,b:25};
  const max = key === "water" ? 1023 : Math.max(10, Math.ceil(Math.max(...vals) / 10) * 10);
  const min = 0;
  const plotW = width-pad.l-pad.r, plotH = height-pad.t-pad.b;
  ctx.strokeStyle = "#e8eff1"; ctx.lineWidth = 1;
  for (let i=0;i<4;i++) {
    const y = pad.t + plotH*i/3;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();
  }
  ctx.fillStyle = "#94a5ac";ctx.font="9px DM Sans";
  for (let i=0;i<4;i++) {
    const val = max - max*i/3;
    ctx.fillText(String(Math.round(val)),2,pad.t+plotH*i/3+3);
  }
  if (thresholdLine !== null && thresholdLine <= max) {
    const y = pad.t + plotH*(1-thresholdLine/max);
    ctx.setLineDash([4,4]);ctx.strokeStyle="#d69a75";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.setLineDash([]);
  }
  const points = readings.map((r,i)=>({i,v:r[key]})).filter(p=>p.v!==null&&Number.isFinite(p.v));
  if (points.length === 1) {
    const x=pad.l+plotW/2, y=pad.t+plotH*(1-points[0].v/max);
    ctx.fillStyle="#278da1";ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();return;
  }
  ctx.strokeStyle="#278da1";ctx.lineWidth=2;ctx.lineJoin="round";ctx.beginPath();
  points.forEach((p,j)=>{const x=pad.l+plotW*(p.i/Math.max(1,readings.length-1));const y=pad.t+plotH*(1-p.v/max);if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.stroke();
  points.forEach(p=>{const x=pad.l+plotW*(p.i/Math.max(1,readings.length-1));const y=pad.t+plotH*(1-p.v/max);ctx.fillStyle="#fff";ctx.strokeStyle="#278da1";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.stroke();});
}
function renderCharts() {
  drawOneChart("distanceChart","distance");
  drawOneChart("waterChart","water",threshold);
}
function drawCharts(){ renderCharts(); }
window.addEventListener("resize", () => { if ($("page-analytics").classList.contains("active")) renderCharts(); });

$("parcelSearch").addEventListener("input", renderRegistry);
$("deviceConnectBtn").addEventListener("click", connectArduino);
$("disconnectBtn").addEventListener("click", () => disconnectArduino());
$("deviceDisconnectBtn").addEventListener("click", () => disconnectArduino());
$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));

$("themeSelect").value = localStorage.getItem("paq_theme") || "light";
function applyTheme(theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("paq_theme", theme);
}
$("themeSelect").addEventListener("change", e => applyTheme(e.target.value));
applyTheme($("themeSelect").value);
$("reducedMotion").checked = localStorage.getItem("paq_reduced_motion") === "true";
document.body.classList.toggle("reduced-motion", $("reducedMotion").checked);
$("reducedMotion").addEventListener("change", e => {
  document.body.classList.toggle("reduced-motion", e.target.checked);
  localStorage.setItem("paq_reduced_motion", String(e.target.checked));
});
$("thresholdInput").value = threshold;
$("thresholdMessage").textContent = `Current threshold: ${threshold}`;
$("monitorThreshold").textContent = String(threshold);
$("saveThresholdBtn").addEventListener("click", () => {
  const n = Number($("thresholdInput").value);
  if (!Number.isInteger(n) || n < 0 || n > 1023) {
    $("thresholdMessage").textContent = "Enter a whole number from 0 to 1023.";
    return;
  }
  threshold = n; localStorage.setItem("paq_threshold", String(n));
  $("thresholdMessage").textContent = `Threshold saved: ${threshold}`;
  $("monitorThreshold").textContent = String(threshold);
  if (lastWater !== null) {
    // Re-evaluate the latest received reading against the updated threshold.
    const wet = lastWater >= threshold;
    $("monitorRisk").textContent = wet ? "Water detected" : "No water detected";
    $("monitorRisk").style.color = wet ? "#bd7048" : "#268b65";
    $("overviewWater").textContent = wet ? "Detected" : "No water";
    $("monitorWaterStatus").textContent = wet ? "Above configured threshold" : "Below configured threshold";
    $("riskHeadline").textContent = wet ? "Water threshold exceeded" : "No water detected";
    $("riskDescription").textContent = `Parcel #001 raw reading ${lastWater}; configured threshold ${threshold}.`;
  }
  renderCharts();
});

$("feedbackForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("feedbackSubmit"), msg = $("feedbackMessage");
  btn.disabled = true; btn.textContent = "Sending…"; msg.textContent = "Sending your feedback…";
  const formData = new FormData(e.currentTarget);
  formData.append("_subject","PAQSAFE website feedback");
  formData.append("_template","table");
  try {
    const response = await fetch(FORM_ENDPOINT, {
      method:"POST",
      headers:{"Accept":"application/json"},
      body:formData
    });
    const result = await response.json();
    if (response.ok && (result.success === "true" || result.success === true)) {
      msg.textContent = "Feedback submitted. If this is the first submission, check the inbox for a FormSubmit activation email.";
      e.currentTarget.reset();
    } else {
      msg.textContent = "The service did not confirm delivery. Check the inbox activation email and try again.";
    }
  } catch (error) {
    msg.textContent = "Could not send from this browser. Check your internet connection and FormSubmit activation.";
  } finally {
    btn.disabled = false; btn.textContent = "Send feedback";
  }
});

window.addEventListener("beforeunload", () => { try { if (reader) reader.cancel(); } catch(e){} });
renderHomeParcels();
renderRegistry();
renderActivity();
showEmptyLiveValues();
setConnectionState(false, "Ready to connect. Close Arduino Serial Monitor first.");
navigate(location.hash.replace("#","") || "home");

