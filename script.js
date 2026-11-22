const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const STORAGE_KEY="paqsafe_state_v1";

const defaultParcels=[

 {id:"001",name:"Parcel #001",status:"safe",updated:"Demo"},

 {id:"002",name:"Parcel #002",status:"safe",updated:"Demo"},

 {id:"003",name:"Parcel #003",status:"warning",updated:"Demo"},

 {id:"004",name:"Parcel #004",status:"empty",updated:"Demo"}

];

let state={parcels:defaultParcels,events:[

 {type:"safe",text:"Parcel #001 detected",time:"Demo"},

 {type:"water",text:"Water sensor state: dry",time:"Demo"},

 {type:"warning",text:"Parcel #003: demo warning",time:"Demo"}

],settings:{theme:"system",reducedMotion:false,notifications:true,units:"cm",compact:false,demo:true}, readings:{distance:null,water:null}, connected:false, deviceCount:0,selected:"001",chartData:[]};

let serialReader,serialPort,serialLoopActive=false,toastTimer;

 

function loadState(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(saved){state.parcels=saved.parcels||defaultParcels;state.events=saved.events||[];state.settings={...state.settings,...saved.settings};}}catch(e){}}

function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({parcels:state.parcels,events:state.events,settings:state.settings}));}

function statusLabel(s){return({safe:"Safe",warning:"Warning",critical:"Critical",empty:"Empty",unknown:"Unknown"})[s]||s}

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2500)}

function navigate(page){$$(".page").forEach(p=>p.classList.remove("active"));$(`#page-${page}`)?.classList.add("active");$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));window.scrollTo({top:0,behavior:state.settings.reducedMotion?"auto":"smooth"});if(page==="analytics")drawChart($("#analyticsChart"));if(page==="home")drawChart($("#homeChart"))}

$$("[data-page]").forEach(el=>el.addEventListener("click",e=>{const p=e.currentTarget.dataset.page;if(p)navigate(p)}));

function parcelArt(){return `<div class="parcel-thumb"><div class="package"><div class="package-tape"></div><div class="package-label"></div></div></div>`}

function parcelCard(p){return `<article class="parcel-card" data-id="${p.id}">${parcelArt()}<div class="parcel-info"><strong>${escapeHTML(p.name)}</strong><small>${p.updated||"No readings yet"}</small></div><span class="status ${p.status}">${statusLabel(p.status)}</span></article>`}

function escapeHTML(str){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function counts(){const total=state.parcels.length,safe=state.parcels.filter(p=>p.status==="safe").length,warn=state.parcels.filter(p=>p.status==="warning").length,critical=state.parcels.filter(p=>p.status==="critical").length;return{total,safe,warn,critical,empty:state.parcels.filter(p=>p.status==="empty").length}}

function render(){const c=counts();$("#totalCount").textContent=c.total;$("#safeCount").textContent=c.safe;$("#riskCount").textContent=c.warn+c.critical;$("#deviceCount").textContent=state.connected?1:0;$("#homeParcelGrid").innerHTML=state.parcels.slice(0,4).map(parcelCard).join("")||"<p>No parcels registered yet.</p>";$("#legendSafe").textContent=c.safe;$("#legendWarn").textContent=c.warn;$("#legendCritical").textContent=c.critical;const pct=c.total?Math.round(c.safe/c.total*100):0;$("#safePercent").textContent=pct+"%";$("#riskCenterPercent").textContent=pct+"%";const gradient=`conic-gradient(var(--green) 0 ${pct}%,var(--orange) ${pct}% ${Math.min(pct+c.warn/c.total*100,100)}%,var(--red) ${Math.min(pct+c.warn/c.total*100,100)}% 100%)`;$("#riskDonut").style.background=gradient;$("#riskDonutBig").style.background=gradient;$("#riskCenterSafe").textContent=c.safe;$("#riskCenterWarn").textContent=c.warn;$("#riskCenterCritical").textContent=c.critical;

 renderActivity($("#homeActivity"),state.events.slice(0,3));renderActivity($("#riskAlerts"),state.events.filter(e=>e.type==="warning"||e.type==="critical").slice(0,5));renderActivity($("#fullActivity"),state.events);

 renderRegistry();renderSelect();renderMonitor();renderDiagnostics();drawChart($("#homeChart"));drawChart($("#analyticsChart"));$("#alertCount").textContent=c.warn+c.critical;$("#systemStatus").textContent=state.connected?"Connected":"Demo Mode";$("#sideConnection").textContent=state.connected?"USB Connected":"Demo mode";$("#sideDot").style.background=state.connected?"var(--green)":"#95a7bc";$("#systemDot").style.background=state.connected?"var(--green)":"#95a7bc";saveState()}

function renderActivity(el,events){if(!el)return;el.innerHTML=events.length?events.map(e=>`<div class="activity-row"><span class="activity-symbol ${e.type}">${e.type==="warning"||e.type==="critical"?"!":e.type==="water"?"♢":"✓"}</span><span class="event-text">${escapeHTML(e.text)}</span><small>${escapeHTML(e.time||"Now")}</small></div>`).join():"<p class='note'>No activity recorded.</p>"}

function renderRegistry(){const query=($("#registrySearch")?.value||"").toLowerCase(),filter=$("#registryFilter")?.value||"all";const items=state.parcels.filter(p=>(p.name.toLowerCase().includes(query)||p.id.toLowerCase().includes(query))&&(filter==="all"||p.status===filter));$("#registryList").innerHTML=items.length?items.map(p=>`<div class="registry-item">${parcelArt()}<div class="parcel-info"><strong>${escapeHTML(p.name)}</strong><small>ID: ${p.id} · ${p.updated||"Awaiting readings"}</small></div><span class="status ${p.status}">${statusLabel(p.status)}</span><div class="registry-actions"><button class="small-button" data-monitor="${p.id}">Monitor</button><button class="small-button danger" data-delete="${p.id}">Remove</button></div></div>`).join():"<p>No matching parcels.</p>";$$("[data-monitor]").forEach(b=>b.onclick=()=>{state.selected=b.dataset.monitor;renderSelect();navigate("monitor")});$$("[data-delete]").forEach(b=>b.onclick=()=>removeParcel(b.dataset.delete))}

function renderSelect(){const sel=$("#monitorParcelSelect");if(!sel)return;sel.innerHTML=state.parcels.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join();if(state.parcels.some(p=>p.id===state.selected))sel.value=state.selected;else state.selected=state.parcels[0]?.id||""}

function renderMonitor(){const p=state.parcels.find(p=>p.id===state.selected);if(!p){$("#monitorStatusText").textContent="Add a parcel in the registry to begin.";$("#distanceValue").textContent="— cm";$("#waterValue").textContent="—";$("#parcelStatusValue").textContent="—";return}const d=state.readings.distance;$("#distanceValue").textContent=d===null?"— cm":`${convertDistance(d)} ${state.settings.units}`;$("#waterValue").textContent=state.readings.water===null?"—":state.readings.water?"WET":"DRY";$("#parcelStatusValue").textContent=statusLabel(p.status);$("#monitorLastRead").textContent=state.connected?"Live":"Demo";$("#monitorStatusText").textContent=state.connected?`Live reading for ${p.name}.`:`${p.name} · Demo status. Connect the Arduino for live readings.`;$("#waterPageState").textContent=state.readings.water===null?"Awaiting data":state.readings.water?"WATER DETECTED":"DRY";$("#waterPageDescription").textContent=state.connected?"Latest serial sensor state.":"Connect your Arduino to begin."}

function convertDistance(cm){return state.settings.units==="in"?(cm/2.54).toFixed(1):cm.toFixed(1)}

function renderDiagnostics(){const supported="serial" in navigator;$("#diagBrowser").textContent=supported?"Web Serial supported":"Web Serial unavailable";$("#diagConnection").textContent=state.connected?"Connected":"Not connected";$("#diagUltrasonic").textContent=state.readings.distance===null?"Waiting":`${state.readings.distance} cm`;$("#diagWater").textContent=state.readings.water===null?"Waiting":state.readings.water?"Wet detected":"Dry";$("#diagFormat").textContent=state.connected?"Recognized":"Waiting";$("#diagLast").textContent=state.connected?"Recent":"—";$("#sensorDiagnostic").innerHTML=`<span class="status-dot ${state.connected?"":"gray"}"></span>${state.connected?"Receiving":"Not connected"}`;$("#connectionDiagnostic").textContent=state.connected?"USB Serial":"Demo";$("#lastCheck").textContent=state.connected?"Now":"—";$("#serialDiagnostic").textContent=state.connected?"Receiving":"Waiting";$("#deviceStatusText").textContent=state.connected?"Connected":"Not connected";$("#deviceStatusDot").style.background=state.connected?"var(--green)":"#95a7bc";$("#connectButton").disabled=state.connected;$("#disconnectButton").disabled=!state.connected}

function addEvent(type,text){state.events.unshift({type,text,time:state.connected?"Just now":"Demo"});state.events=state.events.slice(0,100)}

function addParcel(name,status){const id=String(Math.max(0,...state.parcels.map(p=>Number(p.id)||0))+1).padStart(3,"0");state.parcels.push({id,name:name||`Parcel #${id}`,status,updated:"Added just now"});state.selected=id;addEvent("safe",`${name||"Parcel #"+id} added to registry`);render();toast("Parcel added")}

function removeParcel(id){const p=state.parcels.find(p=>p.id===id);if(!p)return;if(!confirm(`Remove ${p.name}?`))return;state.parcels=state.parcels.filter(p=>p.id!==id);addEvent("warning",`${p.name} removed`);render();toast("Parcel removed")}

$("#addParcelButton").onclick=()=>$("#parcelDialog").showModal();

$("#parcelForm").addEventListener("submit",e=>{e.preventDefault();addParcel($("#newParcelName").value.trim(),$("#newParcelStatus").value);$("#parcelDialog").close();$("#newParcelName").value=""});

$("#registrySearch").addEventListener("input",renderRegistry);$("#registryFilter").addEventListener("change",renderRegistry);$("#monitorParcelSelect").addEventListener("change",e=>{state.selected=e.target.value;renderMonitor()});

$("#globalSearch").addEventListener("input",e=>{const q=e.target.value.trim();if(q){navigate("registry");$("#registrySearch").value=q;renderRegistry()}});

$("#activityExpand").onclick=()=>{$("#activityExpanded").classList.toggle("hidden");$("#expandArrow").textContent=$("#activityExpanded").classList.contains("hidden")?"⌄":"⌃"};

$("#clearActivity").onclick=()=>{if(confirm("Clear the locally stored activity log?")){state.events=[];render();toast("Activity log cleared")}};

$("#alertsButton").onclick=()=>navigate("risk");$("#profileButton").onclick=()=>navigate("settings");

$("#feedbackForm").onsubmit=e=>{e.preventDefault();const text=$("#feedbackText").value.trim();if(!text)return;const arr=JSON.parse(localStorage.getItem("paqsafe_feedback")||"[]");arr.push({text,date:new Date().toISOString()});localStorage.setItem("paqsafe_feedback",JSON.stringify(arr));$("#feedbackSaved").classList.remove("hidden");$("#feedbackText").value="";toast("Feedback saved locally")};

function applySettings(){const s=state.settings;document.body.classList.toggle("reduced-motion",s.reducedMotion);document.body.classList.toggle("compact",s.compact);$("#themeSetting").value=s.theme;$("#motionSetting").checked=s.reducedMotion;$("#notificationsSetting").checked=s.notifications;$("#unitsSetting").value=s.units;$("#compactSetting").checked=s.compact;$("#demoSetting").checked=s.demo;let dark=s.theme==="dark";if(s.theme==="system")dark=window.matchMedia?.("(prefers-color-scheme: dark)").matches||false;document.body.classList.toggle("dark",dark)}

$("#saveSettings").onclick=()=>{state.settings={theme:$("#themeSetting").value,reducedMotion:$("#motionSetting").checked,notifications:$("#notificationsSetting").checked,units:$("#unitsSetting").value,compact:$("#compactSetting").checked,demo:$("#demoSetting").checked};applySettings();render();toast("Settings saved")};

$("#resetSettings").onclick=()=>{if(confirm("Reset settings to defaults?")){state.settings={theme:"system",reducedMotion:false,notifications:true,units:"cm",compact:false,demo:true};applySettings();render();toast("Settings reset")}};

$("#diagnosticsRefresh").onclick=()=>{renderDiagnostics();toast("Diagnostics refreshed")};

$("#clearConsole").onclick=()=>$("#serialConsole").textContent="";

function logSerial(line){const el=$("#serialConsole");el.textContent=(el.textContent+"\n"+line).slice(-5000);el.scrollTop=el.scrollHeight}

function parseLine(line){let d=null,w=null;try{const obj=JSON.parse(line);d=Number(obj.distance??obj.distance_cm??obj.cm);const water=obj.water??obj.waterState??obj.water_sensor??obj.wet;if(water!==undefined)w=water===true||["wet","1","true","water"].includes(String(water).toLowerCase())}catch{const parts=line.trim().split(/[,\s;]+/);if(parts.length>=1&&Number.isFinite(Number(parts[0])))d=Number(parts[0]);if(parts.length>=2)w=["wet","1","true","water"].includes(parts[1].toLowerCase())}if(Number.isFinite(d)&&d>=0)state.readings.distance=d;if(w!==null)state.readings.water=w;if(state.readings.distance!==null){const p=state.parcels.find(p=>p.id===state.selected);if(p){const parcelPresent=state.readings.distance<15;const status=state.readings.water===true&&parcelPresent?"critical":state.readings.water===true?"warning":parcelPresent?"safe":"empty";if(p.status!==status){p.status=status;p.updated="Just now";addEvent(status==="warning"||status==="critical"?"warning":"safe",`${p.name} status changed to ${statusLabel(status)}`)}state.chartData.push(state.readings.distance);state.chartData=state.chartData.slice(-30)}}render()}

async function connectSerial(){if(!("serial" in navigator)){toast("Web Serial is not supported. Use Chrome or Edge.");return}try{serialPort=await navigator.serial.requestPort();await serialPort.open({baudRate:9600});state.connected=true;const decoder=new TextDecoderStream();serialPort.readable.pipeTo(decoder.writable).catch(()=>{});serialReader=decoder.readable.getReader();serialLoopActive=true;logSerial("Connected at 9600 baud.");while(serialLoopActive){const{value,done}=await serialReader.read();if(done)break;if(value){value.split(/\r?\n/).forEach(line=>{if(line.trim()){logSerial(line);parseLine(line)}})}}}catch(err){state.connected=false;logSerial("Connection error: "+err.message);toast(err.message||"Could not connect")}finally{state.connected=false;render();try{serialReader?.releaseLock()}catch{}try{await serialPort?.close()}catch{}}}

$("#connectButton").onclick=connectSerial;$("#disconnectButton").onclick=async()=>{serialLoopActive=false;try{await serialReader?.cancel()}catch{}try{await serialPort?.close()}catch{}state.connected=false;render();toast("Disconnected")};

function drawChart(canvas){if(!canvas)return;const rect=canvas.getBoundingClientRect();if(rect.width<10)return;const dpr=window.devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=(canvas.clientHeight||180)*dpr;const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);const w=rect.width,h=canvas.clientHeight||180;const pad={l:34,r:10,t:12,b:25};const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;ctx.clearRect(0,0,w,h);ctx.font="10px Inter";ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");ctx.strokeStyle="rgba(125,160,196,.25)";ctx.lineWidth=1;for(let i=0;i<=3;i++){const y=pad.t+ch*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(`${30-i*10}`,4,y+3)}let data=state.chartData.length?state.chartData:[14,18,16,22,20,17,24,21,25];const max=Math.max(30,...data);function plot(values,color){ctx.beginPath();values.forEach((v,i)=>{const x=pad.l+(values.length<=1?0:i/(values.length-1))*cw;const y=pad.t+ch-(v/max)*ch;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();values.forEach((v,i)=>{const x=pad.l+(values.length<=1?0:i/(values.length-1))*cw,y=pad.t+ch-(v/max)*ch;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()})}plot(data,"#399fe2");if(!state.connected){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");ctx.fillText("Illustrative layout · awaiting live readings",pad.l,h-5)}}

window.addEventListener("resize",()=>{drawChart($("#homeChart"));drawChart($("#analyticsChart"))});

loadState();applySettings();render();setTimeout(()=>{$("#splash").classList.add("hide");$("#appShell").classList.add("ready");setTimeout(()=>$("#splash").remove(),550)},900);

