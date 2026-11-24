const $ = (id) => document.getElementById(id);
const state = {
  port: null, reader: null, keepReading: false, connected: false,
  lastReadAt: null, distance: null, water: null, waterDetected: null,
  distanceHistory: [], waterHistory: [], activities: [],
  threshold: 500, compact: false, showDemo: true, startedAt: Date.now()
};

const parcels = [
  {id:'001', name:'Parcel #001', source:'ARDUINO', status:'Not connected', detail:'Live hardware parcel'},
  {id:'002', name:'Parcel #002', source:'DEMO', status:'Safe', detail:'Illustrative demo parcel'},
  {id:'003', name:'Parcel #003', source:'DEMO', status:'Warning', detail:'Illustrative demo parcel'},
  {id:'004', name:'Parcel #004', source:'EMPTY', status:'Empty', detail:'No parcel registered'}
];

function toast(message){
  const el=$('toast'); el.textContent=message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2800);
}
function addActivity(message, symbol='✓'){
  const item={message,symbol,time:new Date()};
  state.activities.unshift(item); state.activities=state.activities.slice(0,30);
  renderActivity();
}
function timeAgo(date){
  const seconds=Math.max(0,Math.floor((Date.now()-date.getTime())/1000));
  if(seconds<60)return `${seconds} sec ago`;
  if(seconds<3600)return `${Math.floor(seconds/60)} min ago`;
  return `${Math.floor(seconds/3600)} hr ago`;
}
function renderActivity(){
  const html=state.activities.length ? state.activities.map(a=>`<div class="activity-item"><span class="activity-symbol">${escapeHTML(a.symbol)}</span><span>${escapeHTML(a.message)}</span><small>${timeAgo(a.time)}</small></div>`).join('') : '<p class="muted">No activity recorded in this browser session.</p>';
  $('activityPreview').innerHTML=html; $('fullActivity').innerHTML=html;
}
function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function parcelMarkup(p){
  let badge = p.id==='001' ? (state.connected?'Connected':'Not connected') : p.status;
  let badgeClass = p.id==='003'?'warn-badge':(p.id==='004'?'empty-badge':'safe-badge');
  return `<article class="parcel-card ${p.id==='002'||p.id==='003'?'demo-parcel':''}" data-parcel="${p.id}" tabindex="0">
    <div class="parcel-thumb">${p.id==='004'?'＋':'<div class="parcel-illustration"><span></span></div>'}</div>

    <div class="parcel-info"><b>${p.name}${p.source==='DEMO'?'<span class="demo-badge">DEMO</span>':''}</b><small>${p.id==='001'?(state.lastReadAt?'Last update: '+timeAgo(state.lastReadAt):'Waiting for Arduino'):(p.id==='004'?'No parcel added':'Sample parcel')}</small></div>
    <span class="status-badge ${badgeClass}">${badge}</span></article>`;
}
function renderParcels(){
  $('parcelGrid').innerHTML=parcels.map(parcelMarkup).join('');
  $('registryList').innerHTML=parcels.map(p=>`<article class="registry-card"><h3>${p.name} ${p.source==='DEMO'?'<span class="demo-badge">DEMO</span>':''}</h3><p>${p.detail}</p><span class="status-badge ${p.id==='003'?'warn-badge':p.id==='004'?'empty-badge':'safe-badge'}">${p.id==='001'?(state.connected?'Connected':'Not connected'):p.status}</span></article>`).join('');
  document.querySelectorAll('[data-parcel]').forEach(card=>{
    const open=()=>{const id=card.dataset.parcel; if(id==='001')navigate('monitor'); else toast(`Parcel #${id} is ${id==='004'?'empty':'a demo record'}.`);};
    card.addEventListener('click',open); card.addEventListener('keydown',e=>{if(e.key==='Enter')open();});
  });
  document.querySelectorAll('.demo-parcel').forEach(el=>el.classList.toggle('hidden-demo',!state.showDemo));
}
function updateDashboard(){
  const live=state.connected;
  $('totalCount').textContent='4';
  $('protectedCount').textContent=live?'1':'0';
  $('riskCount').textContent=state.waterDetected===true?'1':(live?'0':'—');
  $('deviceCount').textContent=live?'1':'0';
  $('safeLegend').textContent=live?'1':'0';
  $('warningLegend').textContent=state.waterDetected===true?'1':'0';
  $('criticalLegend').textContent='0';
  $('safePercent').textContent=live?(state.waterDetected===true?'0%':'100%'):'—';
  $('riskDonut').style.background=live?(state.waterDetected===true?'conic-gradient(#f2bd91 0deg 360deg)':'conic-gradient(#46b7a6 0deg 360deg)'):'conic-gradient(#c8d8ec 0deg 360deg)';
  $('systemStatus').textContent=live?'System Online':'System Ready';
  $('systemDot').style.background=live?'#22a879':'#8aa6c8';
  $('sensorStatus').textContent=live?'Receiving':'Waiting';
  $('connectionStatus').textContent=live?'Connected':'Not connected';
  $('lastCheck').textContent=state.lastReadAt?timeAgo(state.lastReadAt):'—';
  $('uptime').textContent=live?formatUptime(Date.now()-state.startedAt):'—';
  $('alertCount').textContent=state.waterDetected===true?'1':'0';
  $('connectionState').textContent='Status: '+(live?'Connected to Arduino':'Not connected');
  $('connectButton').disabled=live; $('disconnectButton').disabled=!live;
  $('monitorConnect').textContent=live?'Arduino Connected':'Connect Arduino →';
  $('p1Badge').textContent=live?'Connected':'Not connected';
  $('p1Badge').className='status-badge '+(live?'safe-badge':'empty-badge');
  $('liveMessage').textContent=live?'Receiving serial data from Arduino UNO R3.':'Connect the Arduino by USB, then choose its port in the browser prompt.';
  $('analyticsDistance').textContent=state.distance==null?'—':`${state.distance} cm`;
  $('analyticsWater').textContent=state.water==null?'—':state.water;
  $('analyticsUpdate').textContent=state.lastReadAt?timeAgo(state.lastReadAt):'—';
  renderParcels();
}
function formatUptime(ms){

  const mins=Math.floor(ms/60000), hrs=Math.floor(mins/60);
  return hrs?`${hrs} h ${mins%60} min`:`${mins} min`;
}
function setSensorReadings(){
  $('distanceValue').textContent=state.distance==null?'—':`${state.distance} cm`;
  $('waterValue').textContent=state.water==null?'—':state.water;
  const detected=state.waterDetected;
  $('waterDetected').textContent=detected===null?'Awaiting data':detected?'Water indicated':'No water indicated';
  $('waterDetailValue').textContent=state.water==null?'—':state.water;
  $('waterDetailState').textContent=detected===null?'Awaiting Arduino data':detected?'Water indicated':'No water indicated';
  $('lastCheck').textContent=state.lastReadAt?timeAgo(state.lastReadAt):'—';
  $('chartNote').textContent=state.distanceHistory.length?'Trend uses readings received during this browser session only.':'Trend appears when live sensor data is received. No historical readings are invented.';
  updateChart();
}
function updateChart(){
  const makePath=(arr)=>{
    if(arr.length<2)return '';
    const vals=arr.slice(-9), min=Math.min(...vals), max=Math.max(...vals), span=max-min||1;
    return vals.map((v,i)=>`${i?'L':'M'}${42+i*(543/(vals.length-1))} ${135-((v-min)/span)*85}`).join(' ');
  };
  if(state.distanceHistory.length>1)$('distancePath').setAttribute('d',makePath(state.distanceHistory));
  if(state.waterHistory.length>1)$('waterPath').setAttribute('d',makePath(state.waterHistory));
}
function normalizeKey(k){return String(k).toLowerCase().replace(/[^a-z0-9]/g,'');}
function findValue(obj, names){
  if(!obj||typeof obj!=='object')return undefined;
  const entries=Object.entries(obj).map(([k,v])=>[normalizeKey(k),v]);
  for(const name of names){const hit=entries.find(([k])=>k===normalizeKey(name));if(hit)return hit[1];}
  return undefined;
}
function toNumber(v){
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'){const m=v.replace(',','.').match(/-?\d+(?:\.\d+)?/);if(m)return Number(m[0]);}
  return null;
}
function applyReading(data){
  let distance=null, water=null, detected=null;
  if(typeof data==='string'){
    const d=data.match(/distance\s*:\s*(-?\d+(?:[.,]\d+)?)\s*cm/i);
    const w=data.match(/water(?:\s+reading|\s+level)?\s*:\s*(-?\d+)/i);
    if(d)distance=toNumber(d[1]); if(w)water=toNumber(w[1]);
    if(/distance\s*:\s*no\s*echo/i.test(data))distance=null;

  }else if(data&&typeof data==='object'){
    distance=toNumber(findValue(data,['distance','distanceCm','ultrasonicDistance','distanceReading']));
    water=toNumber(findValue(data,['water','waterLevel','waterReading','waterValue','analogValue']));
    const flag=findValue(data,['waterDetected','isWaterDetected','waterAlert']);
    if(typeof flag==='boolean')detected=flag;
    else if(typeof flag==='string' && /^(true|false|yes|no|1|0)$/i.test(flag))detected=/^(true|yes|1)$/i.test(flag);
  }
  let changed=false;
  if(distance!==null){state.distance=distance;state.distanceHistory.push(distance);state.distanceHistory=state.distanceHistory.slice(-30);changed=true;}
  if(water!==null){state.water=water;state.waterHistory.push(water);state.waterHistory=state.waterHistory.slice(-30);changed=true;}
  if(detected!==null)state.waterDetected=detected;
  else if(water!==null)state.waterDetected=water>=state.threshold;
  if(changed){
    state.lastReadAt=new Date();
    $('diagnosticDetail').textContent='Valid sensor data received from Parcel #001.';
    setSensorReadings(); updateDashboard();
  }
}
function parseSerialLine(line){
  const clean=line.trim(); if(!clean)return;
  try{const parsed=JSON.parse(clean);applyReading(parsed);return;}catch(_){}
  applyReading(clean);
}
async function connectArduino(){
  if(!('serial' in navigator)){toast('Web Serial is not supported here. Use desktop Chrome or Edge over HTTPS.');return;}
  try{
    state.port=await navigator.serial.requestPort();
    await state.port.open({baudRate:9600});
    state.connected=true; state.keepReading=true;
    updateDashboard(); addActivity('Arduino UNO R3 connected to Parcel #001','✓');
    toast('Arduino connected. Waiting for sensor readings.');
    const decoder=new TextDecoderStream();
    state.port.readable.pipeTo(decoder.writable).catch(()=>{});
    state.reader=decoder.readable.getReader();
    let buffer='';
    while(state.keepReading){
      const {value,done}=await state.reader.read();
      if(done)break;
      buffer+=value;
      let newline;
      while((newline=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,newline).replace(/\r/g,'');

        buffer=buffer.slice(newline+1);
        parseSerialLine(line);
      }
      if(buffer.length>4000){parseSerialLine(buffer);buffer='';}
    }
  }catch(err){
    if(err&&err.name==='NotFoundError'){toast('No serial port was selected.');}
    else{console.error(err);toast('Connection could not be opened. Check the USB cable and port.');}
    state.connected=false; updateDashboard();
  }
}
async function disconnectArduino(){
  state.keepReading=false;
  try{if(state.reader){await state.reader.cancel();state.reader.releaseLock();}}catch(_){}
  state.reader=null;
  try{if(state.port){await state.port.close();}}catch(_){}
  state.port=null;state.connected=false;
  updateDashboard();addActivity('Arduino disconnected from Parcel #001','↔');toast('Arduino disconnected.');
}
function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const target=$(`page-${page}`);if(target)target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
$('connectButton').addEventListener('click',connectArduino);
$('monitorConnect').addEventListener('click',connectArduino);
$('disconnectButton').addEventListener('click',disconnectArduino);
$('mobileMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
$('alertButton').addEventListener('click',()=>navigate('risk'));
$('profileButton').addEventListener('click',()=>navigate('settings'));
$('clearActivity').addEventListener('click',()=>{state.activities=[];renderActivity();toast('Browser activity cleared.');});
$('globalSearch').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q)return;
  const match=parcels.find(p=>(p.name+' '+p.source+' '+p.status).toLowerCase().includes(q));
  if(match){navigate(match.id==='001'?'monitor':'registry');}
});
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{

  document.querySelectorAll('[data-range]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');
  $('chartNote').textContent='Selected range: '+b.dataset.range+'. Only current-session readings are plotted; no historical values are generated.';
}));
$('saveSettings').addEventListener('click',()=>{
  state.compact=$('compactSetting').checked;state.showDemo=$('demoSetting').checked;
  const n=Number($('thresholdSetting').value);
  if(Number.isFinite(n)&&n>=1&&n<=1023)state.threshold=n;
  document.body.classList.toggle('compact',state.compact);
  localStorage.setItem('paqSafeSettings',JSON.stringify({compact:state.compact,showDemo:state.showDemo,threshold:state.threshold}));
  if(state.water!==null&&state.waterDetected===null)state.waterDetected=state.water>=state.threshold;
  renderParcels();updateDashboard();$('settingsStatus').textContent='Settings saved in this browser.';toast('Settings saved.');
});
(function loadSettings(){
  try{const s=JSON.parse(localStorage.getItem('paqSafeSettings')||'{}');
    state.compact=!!s.compact;state.showDemo=s.showDemo!==false;state.threshold=Number(s.threshold)||500;
    $('compactSetting').checked=state.compact;$('demoSetting').checked=state.showDemo;$('thresholdSetting').value=state.threshold;
    document.body.classList.toggle('compact',state.compact);
  }catch(_){}
})();
$('feedbackForm').addEventListener('submit',e=>{
  if(!e.currentTarget.reportValidity())return;
  $('feedbackStatus').textContent='Opening the feedback submission. If this is the first submission, verify the receiving email with FormSubmit.';
});
if('serial' in navigator){
  navigator.serial.addEventListener('disconnect',()=>{
    state.keepReading=false;state.connected=false;state.port=null;state.reader=null;
    updateDashboard();addActivity('Arduino serial device disconnected','!');toast('Arduino device disconnected.');
  });
}
renderActivity();renderParcels();updateDashboard();setSensorReadings();

