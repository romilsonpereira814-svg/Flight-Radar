import React, { useState, useEffect, useRef, useCallback } from "react";

const OPENSKY_URL = "https://opensky-network.org/api/states/all?lamin=-35&lomin=-75&lamax=15&lomax=55";

const MOCK_FLIGHTS = [
  { icao24: "tap201", callsign: "TAP201 ", origin_country: "Portugal", longitude: -28.4, latitude: 15.2, geo_altitude: 10668, velocity: 247, true_track: 220, on_ground: false, airline: "TAP Air Portugal", from: "LIS", to: "GRU", fromCity: "Lisboa", toCity: "São Paulo", progress: 62, departure: "08:45", arrival: "15:30", gate: "B14", status: "Em Voo", aircraft: "A330-900neo", delayed: false },
  { icao24: "la8084", callsign: "LA8084 ", origin_country: "Brazil", longitude: -52.1, latitude: -28.6, geo_altitude: 11278, velocity: 241, true_track: 195, on_ground: false, airline: "LATAM Airlines", from: "GRU", to: "EZE", fromCity: "São Paulo", toCity: "Buenos Aires", progress: 41, departure: "10:15", arrival: "12:45", gate: "D22", status: "Em Voo", aircraft: "B767-300", delayed: false },
  { icao24: "g3501", callsign: "GLO501 ", origin_country: "Brazil", longitude: -46.6, latitude: -23.6, geo_altitude: 0, velocity: 0, true_track: 0, on_ground: true, airline: "GOL Linhas Aéreas", from: "CGH", to: "SDU", fromCity: "São Paulo", toCity: "Rio de Janeiro", progress: 0, departure: "12:00", arrival: "13:05", gate: "A8", status: "Embarcando", aircraft: "B737-800", delayed: true, delayMin: 25 },
  { icao24: "ad4221", callsign: "AZU4221", origin_country: "Brazil", longitude: -38.7, latitude: -8.2, geo_altitude: 10972, velocity: 237, true_track: 340, on_ground: false, airline: "Azul Linhas Aéreas", from: "BSB", to: "FOR", fromCity: "Brasília", toCity: "Fortaleza", progress: 78, departure: "09:30", arrival: "12:00", gate: "C5", status: "Em Voo", aircraft: "E195-E2", delayed: false },
  { icao24: "ib6830", callsign: "IBE6830", origin_country: "Spain", longitude: -3.7, latitude: 40.4, geo_altitude: 0, velocity: 0, true_track: 0, on_ground: true, airline: "Iberia", from: "MAD", to: "GRU", fromCity: "Madrid", toCity: "São Paulo", progress: 0, departure: "13:45", arrival: "20:30", gate: "H23", status: "Atrasado", aircraft: "A350-900", delayed: true, delayMin: 55 },
  { icao24: "cm417", callsign: "CMP417 ", origin_country: "Panama", longitude: -79.5, latitude: 9.1, geo_altitude: 853, velocity: 86, true_track: 270, on_ground: false, airline: "Copa Airlines", from: "GRU", to: "PTY", fromCity: "São Paulo", toCity: "Cidade do Panamá", progress: 97, departure: "07:00", arrival: "11:45", gate: "G11", status: "Pousando", aircraft: "B737 MAX 9", delayed: false },
];

const STATUS_COLORS = {
  "Em Voo":     { bg: "#00ff9d18", border: "#00ff9d60", text: "#00ff9d", dot: "#00ff9d" },
  "Embarcando": { bg: "#ffd60018", border: "#ffd60060", text: "#ffd600", dot: "#ffd600" },
  "Atrasado":   { bg: "#ff4d4d18", border: "#ff4d4d60", text: "#ff4d4d", dot: "#ff4d4d" },
  "Pousando":   { bg: "#00c8ff18", border: "#00c8ff60", text: "#00c8ff", dot: "#00c8ff" },
  "Em Solo":    { bg: "#a0a0a018", border: "#a0a0a060", text: "#a0a0a0", dot: "#a0a0a0" },
};

function getStatus(f) {
  if (f.status) return f.status;
  if (f.on_ground) return "Em Solo";
  if (f.geo_altitude && f.geo_altitude < 1500) return "Pousando";
  return "Em Voo";
}

const altFt = (m) => m ? Math.round(m * 3.28084).toLocaleString() : "0";
const kmh = (ms) => ms ? Math.round(ms * 3.6) : 0;

const FlightMap = ({ flights, selectedFlight, onSelectFlight }) => {
  const [zoom, setZoom] = useState(1);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const lngToX = (lng) => ((lng + 180) / 360) * 360;
  const latToY = (lat) => ((90 - lat) / 180) * 180;
  const w = 360 / zoom, h = 180 / zoom;
  const vb = `${viewBox.x} ${viewBox.y} ${w} ${h}`;
  return (
    <div style={{ position: "relative", background: "#020810", borderRadius: 20, overflow: "hidden", border: "1px solid #0d2040" }}>
      <div style={{ position: "absolute", top: 10, left: 14, zIndex: 5 }}>
        <div style={{ fontSize: 9, color: "#00ff9d", fontFamily: "'Space Mono',monospace", letterSpacing: 2 }}>● MAPA AO VIVO</div>
      </div>
      <div style={{ position: "absolute", top: 8, right: 10, zIndex: 5, display: "flex", gap: 6 }}>
        <button onClick={() => setZoom(z => Math.min(8, z * 1.5))} style={{ background: "#0a1628", border: "1px solid #1a3050", color: "#7ab8d9", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.5, z / 1.5))} style={{ background: "#0a1628", border: "1px solid #1a3050", color: "#7ab8d9", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>−</button>
      </div>
      <svg viewBox={vb} style={{ width: "100%", height: 240, display: "block", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={e => { setDragging(true); setDragStart({ x: e.clientX, y: e.clientY, vb: { ...viewBox } }); }}
        onMouseMove={e => { if (!dragging || !dragStart) return; setViewBox({ x: dragStart.vb.x - (e.clientX - dragStart.x) / (zoom * 2), y: dragStart.vb.y - (e.clientY - dragStart.y) / (zoom * 2) }); }}
        onMouseUp={() => setDragging(false)}>
        <defs><filter id="glow"><feGaussianBlur stdDeviation="0.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <rect x="-100" y="-100" width="600" height="400" fill="#020810" />
        {[-60,-30,0,30,60].map(lat => <line key={lat} x1="0" y1={latToY(lat)} x2="360" y2={latToY(lat)} stroke="#0d2040" strokeWidth="0.3" />)}
        {[-120,-60,0,60,120].map(lng => <line key={lng} x1={lngToX(lng)} y1="0" x2={lngToX(lng)} y2="180" stroke="#0d2040" strokeWidth="0.3" />)}
        {["M183,100 L178,105 L175,112 L174,120 L172,128 L170,135 L168,142 L170,148 L175,152 L180,154 L186,153 L192,150 L198,145 L202,138 L204,130 L204,122 L203,115 L200,108 L196,103 Z","M170,60 L175,58 L182,56 L188,55 L195,54 L200,53 L206,54 L212,56 L218,58 L222,62 L220,67 L215,70 L208,72 L200,73 L193,72 L186,70 L180,67 L174,65 Z","M188,72 L195,70 L202,70 L210,72 L216,76 L220,82 L222,90 L222,99 L220,108 L216,115 L212,122 L208,128 L204,132 L199,133 L194,132 L190,127 L187,120 L185,112 L184,103 L184,94 L185,85 L186,78 Z","M80,62 L90,58 L100,55 L110,53 L120,52 L130,52 L138,55 L144,60 L148,66 L148,73 L144,80 L138,85 L130,88 L120,90 L110,90 L100,88 L92,84 L86,78 L82,72 Z","M222,54 L232,50 L245,48 L258,47 L270,48 L280,50 L288,54 L294,60 L296,68 L292,75 L284,80 L274,83 L262,85 L250,86 L238,85 L228,82 L220,78 L218,70 L218,62 Z","M278,118 L286,114 L295,114 L303,118 L308,125 L307,133 L302,140 L294,143 L285,141 L278,135 L275,126 Z"].map((d,i) => <path key={i} d={d} fill="#0a2035" stroke="#0d3050" strokeWidth="0.4" />)}
        {flights.filter(f => !f.on_ground && f.latitude && f.longitude).map(f => {
          const x = lngToX(f.longitude), y = latToY(f.latitude);
          const isSelected = selectedFlight?.icao24 === f.icao24;
          const st = STATUS_COLORS[getStatus(f)] || STATUS_COLORS["Em Voo"];
          return (
            <g key={f.icao24} onClick={() => onSelectFlight(f)} style={{ cursor: "pointer" }} filter={isSelected ? "url(#glow)" : ""}>
              {isSelected && <circle cx={x} cy={y} r="4" fill="none" stroke={st.dot} strokeWidth="0.8" opacity="0.5" />}
              <circle cx={x} cy={y} r={isSelected ? 2 : 1.2} fill={isSelected ? st.dot : "#4a7fa570"} />
              <g transform={`translate(${x},${y}) rotate(${f.true_track || 0})`}>
                <polygon points="0,-2.5 1,1 0,0.5 -1,1" fill={isSelected ? st.dot : "#7ab8d9"} opacity={isSelected ? 1 : 0.8} />
              </g>
            </g>
          );
        })}
        {selectedFlight && selectedFlight.latitude && !selectedFlight.on_ground && (
          <text x={lngToX(selectedFlight.longitude)+3} y={latToY(selectedFlight.latitude)-2} fill="#00ff9d" fontSize="3" fontFamily="monospace">{(selectedFlight.callsign||"").trim()}</text>
        )}
      </svg>
    </div>
  );
};

const NotificationBell = ({ notifications, onClear }) => {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "#0a1a2d", border: "1px solid #1a3050", borderRadius: 12, width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        {unread > 0 && <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "#ff4d4d", borderRadius: "50%", border: "1.5px solid #030d1a", animation: "blink 1s ease infinite" }} />}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 48, width: 280, zIndex: 200, background: "#071524", border: "1px solid #1a3050", borderRadius: 16, boxShadow: "0 20px 40px #000a", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #0d2040", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fff", fontSize: 13, fontFamily: "'Space Mono',monospace" }}>Notificações</span>
            <button onClick={onClear} style={{ background: "none", border: "none", color: "#4a7fa5", fontSize: 11, cursor: "pointer" }}>Limpar</button>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {notifications.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#4a7fa5", fontSize: 12 }}>Sem notificações</div>
            : notifications.map(n => (
              <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid #0a1a2d", background: n.read ? "transparent" : "#00ff9d05" }}>
                <div style={{ fontSize: 11, color: n.type==="alert"?"#ff4d4d":n.type==="update"?"#00ff9d":"#ffd600", marginBottom: 2, fontFamily: "'Space Mono',monospace" }}>
                  {n.type==="alert"?"⚠️":n.type==="update"?"✈️":"ℹ️"} {n.title}
                </div>
                <div style={{ fontSize: 11, color: "#7ab8d9" }}>{n.message}</div>
                <div style={{ fontSize: 10, color: "#2a5070", marginTop: 4 }}>{n.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FlightCard = ({ flight, onClick, isSelected }) => {
  const status = getStatus(flight);
  const st = STATUS_COLORS[status] || STATUS_COLORS["Em Voo"];
  const call = (flight.callsign || flight.icao24 || "").trim();
  return (
    <div onClick={() => onClick(flight)} style={{ background: isSelected?"linear-gradient(135deg,#0a1e38ee,#0d2a4aee)":"linear-gradient(135deg,#07111ecc,#0a1a2dcc)", border:`1px solid ${isSelected?st.border:"#1a3050"}`, borderRadius:16, padding:"14px 16px", marginBottom:10, cursor:"pointer", transition:"all 0.25s ease", backdropFilter:"blur(10px)", boxShadow:isSelected?`0 0 24px ${st.dot}28`:"none" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontFamily:"'Space Mono',monospace", fontSize:18, fontWeight:700, color:"#fff", letterSpacing:2 }}>{call}</div>
          <div style={{ fontSize:10, color:"#4a7fa5", marginTop:2 }}>{flight.origin_country} · {flight.airline||"—"}</div>
        </div>
        <div style={{ background:st.bg, border:`1px solid ${st.border}`, color:st.text, fontSize:9, fontWeight:700, padding:"4px 10px", borderRadius:20, letterSpacing:1, fontFamily:"'Space Mono',monospace" }}>
          ● {status}{flight.delayed&&flight.delayMin?` +${flight.delayMin}m`:""}
        </div>
      </div>
      {flight.from && flight.to ? (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <div style={{ textAlign:"center", minWidth:50 }}>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:20, fontWeight:700, color:"#fff" }}>{flight.from}</div>
            <div style={{ fontSize:9, color:"#4a7fa5" }}>{flight.departure||"—"}</div>
          </div>
          <div style={{ flex:1, position:"relative", padding:"0 6px" }}>
            <div style={{ height:1, background:`linear-gradient(90deg,#1a3050,${st.dot}50,#1a3050)` }} />
            <div style={{ position:"absolute", top:"50%", transform:"translate(-50%,-50%)", left:`${Math.max(4,Math.min(96,flight.progress||0))}%` }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={st.dot} style={{ transform:"rotate(45deg)" }}><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            {(flight.progress||0)>0 && <div style={{ position:"absolute", top:"50%", left:0, transform:"translateY(-50%)", height:2, width:`${flight.progress}%`, background:st.dot, maxWidth:"100%", borderRadius:1 }} />}
          </div>
          <div style={{ textAlign:"center", minWidth:50 }}>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:20, fontWeight:700, color:"#fff" }}>{flight.to}</div>
            <div style={{ fontSize:9, color:"#4a7fa5" }}>{flight.arrival||"—"}</div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom:10, fontFamily:"'Space Mono',monospace", fontSize:11, color:"#4a7fa5" }}>Lat {flight.latitude?.toFixed(2)} · Lng {flight.longitude?.toFixed(2)}</div>
      )}
      <div style={{ display:"flex", gap:12 }}>
        {flight.geo_altitude>0 && <div><div style={{ fontSize:9, color:"#2a5070" }}>ALT</div><div style={{ fontSize:11, color:"#7ab8d9", fontFamily:"'Space Mono',monospace" }}>{altFt(flight.geo_altitude)}ft</div></div>}
        {kmh(flight.velocity)>0 && <div><div style={{ fontSize:9, color:"#2a5070" }}>VEL</div><div style={{ fontSize:11, color:"#7ab8d9", fontFamily:"'Space Mono',monospace" }}>{kmh(flight.velocity)}km/h</div></div>}
        {flight.true_track!=null && <div><div style={{ fontSize:9, color:"#2a5070" }}>DIR</div><div style={{ fontSize:11, color:"#7ab8d9", fontFamily:"'Space Mono',monospace" }}>{Math.round(flight.true_track)}°</div></div>}
      </div>
    </div>
  );
};

const FlightDetail = ({ flight, onClose, onAddNotification }) => {
  const status = getStatus(flight);
  const st = STATUS_COLORS[status] || STATUS_COLORS["Em Voo"];
  const [tick, setTick] = useState(0);
  const [tracked, setTracked] = useState(false);
  const call = (flight.callsign || flight.icao24 || "").trim();
  useEffect(() => { const t = setInterval(() => setTick(x=>x+1), 1000); return () => clearInterval(t); }, []);
  const handleTrack = () => {
    setTracked(t=>!t);
    if (!tracked) onAddNotification({ id:Date.now(), type:"update", title:`Monitorando ${call}`, message:`Receberás alertas sobre ${call}`, time:new Date().toLocaleTimeString("pt-BR"), read:false });
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"#030d1a", zIndex:100, overflow:"auto", fontFamily:"'Space Mono',monospace" }}>
      <div style={{ background:"linear-gradient(180deg,#071524,#030d1a)", minHeight:"100vh", paddingBottom:40 }}>
        <div style={{ padding:"50px 20px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #0d2040", marginBottom:20 }}>
          <button onClick={onClose} style={{ background:"#0a1a2d", border:"1px solid #1a3050", color:"#7ab8d9", borderRadius:12, padding:"8px 16px", cursor:"pointer", fontSize:12, fontFamily:"'Space Mono',monospace" }}>← Voltar</button>
          <button onClick={handleTrack} style={{ background:tracked?"#00ff9d20":"#0a1a2d", border:`1px solid ${tracked?"#00ff9d":"#1a3050"}`, color:tracked?"#00ff9d":"#7ab8d9", borderRadius:12, padding:"8px 14px", cursor:"pointer", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
            {tracked?"🔔 Monitorando":"🔕 Monitorar"}
          </button>
        </div>
        <div style={{ padding:"0 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ fontSize:34, fontWeight:700, color:"#fff", letterSpacing:4 }}>{call}</div>
            <div style={{ background:st.bg, border:`1px solid ${st.border}`, color:st.text, fontSize:10, padding:"6px 12px", borderRadius:20 }}>{status}</div>
          </div>
          <div style={{ color:"#4a7fa5", fontSize:12, marginBottom:20 }}>{flight.airline||flight.origin_country}{flight.aircraft?` · ${flight.aircraft}`:""}</div>
          {flight.from && flight.to && (
            <div style={{ background:"linear-gradient(135deg,#0a1628,#0d2040)", border:"1px solid #1a3050", borderRadius:18, padding:18, marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div><div style={{ fontSize:30, fontWeight:700, color:"#fff" }}>{flight.from}</div><div style={{ fontSize:10, color:"#4a7fa5" }}>{flight.fromCity}</div><div style={{ fontSize:16, color:"#7ab8d9", marginTop:4 }}>{flight.departure}</div></div>
                <div style={{ flex:1, textAlign:"center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill={st.dot} style={{ transform:"rotate(45deg)" }}><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
                  <div style={{ height:2, background:`linear-gradient(90deg,#1a3050,${st.dot},#1a3050)`, borderRadius:1, marginTop:8 }} />
                </div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:30, fontWeight:700, color:"#fff" }}>{flight.to}</div><div style={{ fontSize:10, color:"#4a7fa5" }}>{flight.toCity}</div><div style={{ fontSize:16, color:"#7ab8d9", marginTop:4 }}>{flight.arrival}</div></div>
              </div>
              <div style={{ marginTop:14 }}>
                <div style={{ background:"#0d2040", borderRadius:6, height:6, overflow:"hidden" }}>
                  <div style={{ width:`${flight.progress||0}%`, height:"100%", background:`linear-gradient(90deg,#00c8ff,${st.dot})`, borderRadius:6 }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:10, color:"#2a5070" }}>
                  <span>{flight.from}</span><span style={{ color:st.text }}>{flight.progress||0}%</span><span>{flight.to}</span>
                </div>
              </div>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { label:"ALTITUDE", value:flight.geo_altitude?`${altFt(flight.geo_altitude)} ft`:"Em solo", icon:"↑", color:"#00c8ff" },
              { label:"VELOCIDADE", value:`${kmh(flight.velocity)} km/h`, icon:"⚡", color:"#00ff9d" },
              { label:"DIREÇÃO", value:`${Math.round(flight.true_track||0)}°`, icon:"🧭", color:"#ffd600" },
              { label:"PAÍS", value:flight.origin_country||"—", icon:"🌍", color:"#a78bfa" },
            ].map(s => (
              <div key={s.label} style={{ background:"linear-gradient(135deg,#0a1628,#0d2040)", border:"1px solid #1a3050", borderRadius:14, padding:14, textAlign:"center" }}>
                <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:16, fontWeight:700, color:s.color, marginBottom:3 }}>{s.value}</div>
                <div style={{ fontSize:9, color:"#4a7fa5", letterSpacing:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"linear-gradient(135deg,#0a1628,#0d2040)", border:`1px solid ${st.border}30`, borderRadius:16, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:10, color:st.text, letterSpacing:2 }}>● POSIÇÃO GPS</div>
              <div style={{ fontSize:10, color:"#2a5070" }}>{new Date().toLocaleTimeString("pt-BR")}</div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-around" }}>
              <div style={{ textAlign:"center" }}><div style={{ fontSize:9, color:"#4a7fa5", marginBottom:4 }}>LATITUDE</div><div style={{ fontSize:14, color:"#7ab8d9" }}>{((flight.latitude||0)+Math.sin(tick/15)*0.002).toFixed(4)}°</div></div>
              <div style={{ textAlign:"center" }}><div style={{ fontSize:9, color:"#4a7fa5", marginBottom:4 }}>LONGITUDE</div><div style={{ fontSize:14, color:"#7ab8d9" }}>{((flight.longitude||0)+Math.cos(tick/15)*0.002).toFixed(4)}°</div></div>
              {flight.geo_altitude>0 && <div style={{ textAlign:"center" }}><div style={{ fontSize:9, color:"#4a7fa5", marginBottom:4 }}>TEMP EXT.</div><div style={{ fontSize:14, color:"#7ab8d9" }}>-{53+Math.round(Math.sin(tick/20)*2)}°C</div></div>}
            </div>
          </div>
          {flight.delayed && <div style={{ marginTop:16, background:"#ff4d4d10", border:"1px solid #ff4d4d40", borderRadius:12, padding:"12px 16px", display:"flex", gap:10, alignItems:"center" }}><span style={{ fontSize:20 }}>⚠️</span><div><div style={{ color:"#ff4d4d", fontWeight:700, fontSize:12 }}>Voo com atraso</div><div style={{ color:"#ff8080", fontSize:11, marginTop:2 }}>Estimativa de {flight.delayMin} minutos</div></div></div>}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [flights, setFlights] = useState(MOCK_FLIGHTS);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [tab, setTab] = useState("list");
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("mock");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [notifications, setNotifications] = useState([
    { id:1, type:"alert", title:"GLO501 com atraso", message:"Congonhas→Rio atrasado 25min", time:"12:00", read:false },
    { id:2, type:"update", title:"IBE6830 atrasado", message:"Madrid→São Paulo +55min", time:"11:45", read:false },
  ]);

  const addNotification = useCallback((n) => setNotifications(prev => [n,...prev].slice(0,20)), []);

  const fetchLiveFlights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(OPENSKY_URL);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.states && data.states.length > 0) {
        const live = data.states.filter(s=>s[5]&&s[6]&&s[2]).slice(0,60).map(s=>({
          icao24:s[0], callsign:(s[1]||"").trim(), origin_country:s[2],
          longitude:s[5], latitude:s[6], geo_altitude:s[7],
          on_ground:s[8], velocity:s[9], true_track:s[10], progress:0,
        }));
        setFlights(live);
        setApiStatus("live");
        addNotification({ id:Date.now(), type:"update", title:"Dados ao vivo!", message:`${live.length} aeronaves detectadas`, time:new Date().toLocaleTimeString("pt-BR"), read:false });
      }
    } catch { setApiStatus("error"); }
    finally { setLoading(false); setLastUpdate(new Date()); }
  }, [addNotification]);

  useEffect(() => { fetchLiveFlights(); const i=setInterval(fetchLiveFlights,30000); return ()=>clearInterval(i); }, [fetchLiveFlights]);

  useEffect(() => {
    if (apiStatus !== "live") {
      const t = setInterval(() => { setFlights(prev=>prev.map(f=>getStatus(f)==="Em Voo"?{...f,progress:Math.min(100,(f.progress||0)+Math.random()*0.3)}:f)); setLastUpdate(new Date()); }, 3000);
      return () => clearInterval(t);
    }
  }, [apiStatus]);

  const filters = ["Todos","Em Voo","Em Solo","Pousando"];
  const filtered = flights.filter(f => {
    const call=(f.callsign||f.icao24||"").toLowerCase();
    const s=search.toLowerCase();
    const matchSearch=!s||call.includes(s)||(f.from||"").toLowerCase().includes(s)||(f.to||"").toLowerCase().includes(s)||(f.origin_country||"").toLowerCase().includes(s);
    return matchSearch&&(filter==="Todos"||getStatus(f)===filter);
  });

  return (
    <div style={{ background:"#030d1a", minHeight:"100vh", fontFamily:"'Space Mono',monospace", maxWidth:430, margin:"0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slidein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{display:none}
        input::placeholder{color:#2a5070}
      `}</style>
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", backgroundImage:"linear-gradient(#0d304808 1px,transparent 1px),linear-gradient(90deg,#0d304808 1px,transparent 1px)", backgroundSize:"40px 40px" }} />
      {selected && <FlightDetail flight={selected} onClose={()=>setSelected(null)} onAddNotification={addNotification} />}
      <div style={{ position:"relative", zIndex:1, paddingBottom:24 }}>
        <div style={{ padding:"52px 16px 16px", background:"linear-gradient(180deg,#071524f0,transparent)", backdropFilter:"blur(10px)", borderBottom:"1px solid #0d2040" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#fff", letterSpacing:4 }}>FLIGHT RADAR</h1>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:apiStatus==="live"?"#00ff9d":apiStatus==="error"?"#ff4d4d":"#ffd600", animation:"blink 2s infinite" }} />
                <div style={{ fontSize:9, color:"#4a7fa5", letterSpacing:2 }}>{apiStatus==="live"?"DADOS AO VIVO · OpenSky":apiStatus==="error"?"USANDO DADOS DEMO":"CARREGANDO..."}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={fetchLiveFlights} disabled={loading} style={{ background:"#0a1a2d", border:"1px solid #1a3050", color:"#7ab8d9", borderRadius:12, width:40, height:40, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:16, display:"inline-block", animation:loading?"spin 1s linear infinite":"none" }}>⟳</span>
              </button>
              <NotificationBell notifications={notifications} onClear={()=>setNotifications(p=>p.map(n=>({...n,read:true})))} />
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {[["EM VOO",flights.filter(f=>getStatus(f)==="Em Voo").length,"#00ff9d"],["TOTAL",flights.length,"#ffd600"],["EM SOLO",flights.filter(f=>f.on_ground).length,"#a78bfa"]].map(([l,v,c])=>(
              <div key={l} style={{ flex:1, background:`${c}10`, border:`1px solid ${c}30`, borderRadius:12, padding:"10px 12px" }}>
                <div style={{ fontSize:22, fontWeight:700, color:c }}>{v}</div>
                <div style={{ fontSize:8, color:"#4a7fa5", letterSpacing:1 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ position:"relative", marginBottom:12 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar voo, país, origem..." style={{ width:"100%", background:"#0a1a2d", border:"1px solid #1a3050", borderRadius:12, padding:"11px 16px 11px 42px", color:"#fff", fontSize:12, outline:"none", fontFamily:"'Space Mono',monospace" }} />
            <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15 }}>🔍</div>
            {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#4a7fa5", cursor:"pointer", fontSize:16 }}>×</button>}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ display:"flex", background:"#0a1a2d", border:"1px solid #1a3050", borderRadius:10, overflow:"hidden" }}>
              {[["list","☰"],["map","🗺"]].map(([t,icon])=>(
                <button key={t} onClick={()=>setTab(t)} style={{ background:tab===t?"#00ff9d":"none", border:"none", color:tab===t?"#030d1a":"#4a7fa5", padding:"8px 14px", cursor:"pointer", fontSize:14, fontWeight:tab===t?700:400 }}>{icon}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6, overflowX:"auto", flex:1 }}>
              {filters.map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?"#00ff9d":"#0a1a2d", border:`1px solid ${filter===f?"#00ff9d":"#1a3050"}`, color:filter===f?"#030d1a":"#7ab8d9", borderRadius:20, padding:"6px 12px", fontSize:9, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Space Mono',monospace", fontWeight:filter===f?700:400 }}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding:"14px 14px 0" }}>
          {tab==="map" ? (
            <div>
              <FlightMap flights={filtered} selectedFlight={selected} onSelectFlight={setSelected} />
              <div style={{ marginTop:12 }}>{filtered.slice(0,8).map(f=><FlightCard key={f.icao24} flight={f} onClick={setSelected} isSelected={selected?.icao24===f.icao24} />)}</div>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize:10, color:"#4a7fa5" }}>{filtered.length} AERONAVES</div>
                <div style={{ fontSize:9, color:"#2a5070", animation:"blink 3s infinite" }}>● {lastUpdate.toLocaleTimeString("pt-BR")}</div>
              </div>
              {loading && flights.length===0 ? (
                <div style={{ textAlign:"center", padding:50, color:"#4a7fa5" }}>
                  <div style={{ fontSize:30, marginBottom:12, animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</div>
                  <div style={{ fontSize:12 }}>Carregando voos...</div>
                </div>
              ) : filtered.map(f=><FlightCard key={f.icao24} flight={f} onClick={setSelected} isSelected={selected?.icao24===f.icao24} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
