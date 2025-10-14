import { useEffect, useMemo, useRef, useState } from "react";

/** ========= Estado & helpers ========= **/
const LS_KEY = "qrkit_data_v3";
const QRStylingClassRef = { current: null };
const QRCodePlainRef = { current: null }; // 'qrcode' fallback

function encodeVCard({ firstName, lastName, org, title, phone, email, url }) {
  return [
    "BEGIN:VCARD","VERSION:3.0",
    `N:${lastName || ""};${firstName || ""};;;`,
    `FN:${[firstName, lastName].filter(Boolean).join(" ")}`.trim(),
    org ? `ORG:${org}` : null,
    title ? `TITLE:${title}` : null,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    email ? `EMAIL:${email}` : null,
    url ? `URL:${url}` : null,
    "END:VCARD",
  ].filter(Boolean).join("\n");
}
function encodeWiFi({ ssid, password, security = "WPA", hidden = false }) {
  return `WIFI:T:${security.toUpperCase()};S:${ssid};P:${password || ""};H:${hidden ? "true" : "false"};;`;
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function presetNameFromMode(mode, payload){
  if (mode==="link")  return (payload.url || "Link").slice(0,50);
  if (mode==="wifi")  return `Wi-Fi: ${payload.ssid || "SSID"}`;
  if (mode==="vcard") return `vCard: ${[payload.firstName, payload.lastName].filter(Boolean).join(" ") || "Contacto"}`;
  return "Preset";
}
function buildDotsOptions(dotType, useGradient, darkA, darkB, rotationDeg) {
  const gradient = useGradient ? {
    type: "linear", rotation: (rotationDeg * Math.PI) / 180,
    colorStops: [{ offset: 0, color: darkA }, { offset: 1, color: darkB }],
  } : undefined;
  if (dotType === "dots")    return { type: "dots", color: darkA, gradient };
  if (dotType === "rounded") return { type: "square", color: darkA, gradient, round: 0.55 };
  return { type: "square", color: darkA, gradient };
}

/** ========= App ========= **/
export default function App({ onReady }) {
  const [data, setData] = useState({ presets: [] });
  const [view, setView] = useState("generate"); // generate | history | style

  // PWA install
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const h=(e)=>{e.preventDefault(); setDeferredPrompt(e);};
    window.addEventListener("beforeinstallprompt", h);
    return ()=>window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // Dynamic libs
  const [qrLibReady, setQrLibReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const mod = await import("qr-code-styling");
        QRStylingClassRef.current = mod.default;
        setQrLibReady(true);
      } catch (e) {
        console.warn("qr-code-styling no disponible, usando fallback:", e);
        try {
          const qmod = await import("qrcode");
          QRCodePlainRef.current = qmod.default || qmod;
          setFallbackMode(true);
          setQrLibReady(true);
        } catch (err2) {
          console.error("No se pudo cargar ninguna lib de QR:", err2);
          setQrLibReady(false);
        }
      }
    })();
  }, []);

  // Datos & estilo
  const [mode, setMode] = useState("link");
  const [payload, setPayload] = useState({ url: "" });

  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(10);

  const [useGradient, setUseGradient] = useState(true);
  const [darkA, setDarkA] = useState("#06b6d4");
  const [darkB, setDarkB] = useState("#7c3aed");
  const [gradientRotation, setGradientRotation] = useState(0);
  const [lightColor, setLightColor] = useState("#ffffff");

  const [dotType, setDotType] = useState("rounded");
  const [cornerSquareType, setCornerSquareType] = useState("extra-rounded");
  const [cornerDotType, setCornerDotType] = useState("dot");
  const [eyeColor, setEyeColor] = useState("#0b1220");

  const [logoDataUrl, setLogoDataUrl] = useState("");

  // refs
  const containerRef = useRef(null); // estilizado
  const canvasRef = useRef(null);    // fallback canvas
  const svgBoxRef = useRef(null);    // fallback svg
  const qrStyledRef = useRef(null);

  // load/save
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setData(JSON.parse(raw)); } catch {}
    setTimeout(()=>onReady?.(), 350);
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {} }, [data]);

  const content = useMemo(() => {
    if (mode === "link") return (payload.url || "").trim();
    if (mode === "vcard") return encodeVCard(payload);
    if (mode === "wifi") return encodeWiFi(payload);
    return "";
  }, [mode, payload]);

  /** Instancia QR estilizado */
  useEffect(() => {
    if (!qrLibReady || fallbackMode) return;
    if (!containerRef.current || qrStyledRef.current) return;
    const QRCodeStyling = QRStylingClassRef.current; if (!QRCodeStyling) return;

    qrStyledRef.current = new QRCodeStyling({
      data: content || "QRKit",
      width: size, height: size, margin, type: "svg",
      dotsOptions: buildDotsOptions(dotType, useGradient, darkA, darkB, gradientRotation),
      backgroundOptions: { color: lightColor },
      cornersSquareOptions: { type: cornerSquareType, color: eyeColor },
      cornersDotOptions: { type: cornerDotType, color: eyeColor },
      image: logoDataUrl || undefined,
      imageOptions: { imageSize: 0.22, margin: 4, hideBackgroundDots: true, crossOrigin: "anonymous" },
    });
    containerRef.current.innerHTML = "";
    qrStyledRef.current.append(containerRef.current);
  }, [qrLibReady, fallbackMode]);

  /** Update QR estilizado */
  useEffect(() => {
    if (!qrStyledRef.current || fallbackMode) return;
    qrStyledRef.current.update({
      data: content || " ",
      width: size, height: size, margin,
      dotsOptions: buildDotsOptions(dotType, useGradient, darkA, darkB, gradientRotation),
      backgroundOptions: { color: lightColor },
      cornersSquareOptions: { type: cornerSquareType, color: eyeColor },
      cornersDotOptions: { type: cornerDotType, color: eyeColor },
      image: logoDataUrl || undefined,
    });
  }, [fallbackMode, content, size, margin, dotType, useGradient, darkA, darkB, gradientRotation, lightColor, cornerSquareType, cornerDotType, eyeColor, logoDataUrl]);

  /** Fallback QR */
  useEffect(() => {
    if (!qrLibReady || !fallbackMode) return;
    const QR = QRCodePlainRef.current; if (!QR) return;

    if (canvasRef.current && content) {
      QR.toCanvas(canvasRef.current, content, {
        width: size, margin, color: { dark:"#000000", light:"#ffffff" }
      }).catch(console.error);
    }
    if (svgBoxRef.current && content) {
      QR.toString(content, { type:"svg", width:size, margin })
        .then((svg)=>{ svgBoxRef.current.innerHTML = svg; })
        .catch(console.error);
    }
  }, [qrLibReady, fallbackMode, content, size, margin]);

  /** Acciones */
  const addPreset = () => {
    if (!content) return;
    const preset = {
      id: crypto.randomUUID(), name: presetNameFromMode(mode, payload),
      mode, payload,
      style: { size, margin, useGradient, darkA, darkB, gradientRotation, lightColor, dotType, cornerSquareType, cornerDotType, eyeColor, logoDataUrl }
    };
    setData((s)=>({ ...s, presets: [preset, ...s.presets].slice(0,200) }));
  };
  const loadPreset = (p) => {
    setMode(p.mode); setPayload(p.payload);
    const st = p.style || {};
    setSize(st.size ?? 320); setMargin(st.margin ?? 10);
    setUseGradient(!!st.useGradient); setDarkA(st.darkA ?? "#06b6d4"); setDarkB(st.darkB ?? "#7c3aed");
    setGradientRotation(st.gradientRotation ?? 0); setLightColor(st.lightColor ?? "#ffffff");
    setDotType(st.dotType ?? "rounded"); setCornerSquareType(st.cornerSquareType ?? "extra-rounded");
    setCornerDotType(st.cornerDotType ?? "dot"); setEyeColor(st.eyeColor ?? "#0b1220");
    setLogoDataUrl(st.logoDataUrl || ""); setView("generate");
  };
  const removePreset = (id) => setData((s)=>({ ...s, presets: s.presets.filter(x=>x.id!==id) }));
  const exportPNG = async () => {
    if (qrStyledRef.current && !fallbackMode) {
      const blob = await qrStyledRef.current.getRawData("png"); return downloadBlob(`qrkit-${Date.now()}.png`, blob);
    }
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob)=> blob && downloadBlob(`qrkit-${Date.now()}.png`, blob));
    }
  };
  const exportSVG = async () => {
    if (qrStyledRef.current && !fallbackMode) {
      const blob = await qrStyledRef.current.getRawData("svg"); return downloadBlob(`qrkit-${Date.now()}.svg`, blob);
    }
    const svgEl = svgBoxRef.current?.querySelector("svg"); if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type:"image/svg+xml;charset=utf-8" });
    downloadBlob(`qrkit-${Date.now()}.svg`, blob);
  };

  /** ========= UI ========= **/
  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <div className="brand-badge">🔳</div>
          <div>
            <div className="brand-title">QRKit</div>
            <div className="brand-sub">{fallbackMode ? "Compatibilidad universal" : "Módulos redondeados & gradientes"}</div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${view==="generate"?"tab--active":""}`} onClick={()=>setView("generate")}>Generar</button>
          <button className={`tab ${view==="history" ?"tab--active":""}`} onClick={()=>setView("history")}>Historial</button>
          <button className={`tab ${view==="style"   ?"tab--active":""}`} onClick={()=>setView("style")}>Editor de estilo</button>
          {deferredPrompt && (
            <button className="install-btn hide-mobile" onClick={async()=>{ deferredPrompt.prompt(); setDeferredPrompt(null); }}>
              Instalar
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {view === "generate" && (
          <section className="card">
            <h2 className="h2">Generar</h2>

            <div className="row">
              <select className="input" value={mode} onChange={(e)=>{ setMode(e.target.value); setPayload({}); }}>
                <option value="link">Link</option>
                <option value="vcard">vCard</option>
                <option value="wifi">Wi-Fi</option>
              </select>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Tamaño</label>
                <input className="input" type="number" min="128" max="1024" value={size} onChange={(e)=>setSize(parseInt(e.target.value||"320"))}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Margen</label>
                <input className="input" type="number" min="0" max="24" value={margin} onChange={(e)=>setMargin(parseInt(e.target.value||"10"))}/>
              </div>
            </div>

            {/* Estilo rápido */}
            <div className="row" style={{marginTop:8}}>
              <div className="row" style={{gap:8}}>
                <label className="mini-label">Módulos</label>
                <select className="input" value={dotType} onChange={(e)=>setDotType(e.target.value)} disabled={fallbackMode}>
                  <option value="square">Cuadrados</option>
                  <option value="rounded">Redondeados</option>
                  <option value="dots">Puntos</option>
                </select>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Ojos</label>
                <select className="input" value={cornerSquareType} onChange={(e)=>setCornerSquareType(e.target.value)} disabled={fallbackMode}>
                  <option value="square">Cuadrado</option>
                  <option value="dots">Punteado</option>
                  <option value="extra-rounded">Extra redondeado</option>
                </select>
                <select className="input" value={cornerDotType} onChange={(e)=>setCornerDotType(e.target.value)} disabled={fallbackMode}>
                  <option value="square">Centro cuadrado</option>
                  <option value="dot">Centro punto</option>
                </select>
                <input className="color-input" type="color" value={eyeColor} onChange={(e)=>setEyeColor(e.target.value)} disabled={fallbackMode}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Gradiente</label>
                <label style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="checkbox" checked={useGradient} onChange={(e)=>setUseGradient(e.target.checked)} disabled={fallbackMode}/> Activar
                </label>
                <input className="color-input" type="color" value={darkA} onChange={(e)=>setDarkA(e.target.value)} disabled={fallbackMode}/>
                <input className="color-input" type="color" value={darkB} onChange={(e)=>setDarkB(e.target.value)} disabled={fallbackMode}/>
                <input className="input" type="number" min="0" max="360" value={gradientRotation} onChange={(e)=>setGradientRotation(parseInt(e.target.value||"0"))} disabled={fallbackMode}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Fondo</label>
                <input className="color-input" type="color" value={lightColor} onChange={(e)=>setLightColor(e.target.value)} disabled={fallbackMode}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Logo</label>
                <input className="input" type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setLogoDataUrl(String(r.result)); r.readAsDataURL(f); e.target.value=""; }} disabled={fallbackMode}/>
                {logoDataUrl && <button className="btn--ghost" onClick={()=>setLogoDataUrl("")} disabled={fallbackMode}>Quitar</button>}
              </div>
            </div>

            {/* Campos según modo */}
            {mode === "link" && (
              <div className="row" style={{marginTop:8}}>
                <input className="input" placeholder="https://tusitio.com" value={payload.url||""} onChange={(e)=>setPayload(p=>({...p, url:e.target.value}))}/>
              </div>
            )}
            {mode === "vcard" && (
              <div className="grid-form">
                <input className="input" placeholder="Nombre"   value={payload.firstName||""} onChange={(e)=>setPayload(p=>({...p, firstName:e.target.value}))}/>
                <input className="input" placeholder="Apellido" value={payload.lastName||""}  onChange={(e)=>setPayload(p=>({...p, lastName:e.target.value}))}/>
                <input className="input" placeholder="Empresa"  value={payload.org||""}      onChange={(e)=>setPayload(p=>({...p, org:e.target.value}))}/>
                <input className="input" placeholder="Puesto"   value={payload.title||""}    onChange={(e)=>setPayload(p=>({...p, title:e.target.value}))}/>
                <input className="input" placeholder="Teléfono" value={payload.phone||""}    onChange={(e)=>setPayload(p=>({...p, phone:e.target.value}))}/>
                <input className="input" placeholder="Email"    value={payload.email||""}    onChange={(e)=>setPayload(p=>({...p, email:e.target.value}))}/>
                <input className="input" placeholder="URL"      value={payload.url||""}      onChange={(e)=>setPayload(p=>({...p, url:e.target.value}))}/>
              </div>
            )}
            {mode === "wifi" && (
              <div className="grid-form">
                <input className="input" placeholder="SSID (nombre de red)" value={payload.ssid||""} onChange={(e)=>setPayload(p=>({...p, ssid:e.target.value}))}/>
                <input className="input" placeholder="Contraseña" value={payload.password||""} onChange={(e)=>setPayload(p=>({...p, password:e.target.value}))}/>
                <select className="input" value={payload.security||"WPA"} onChange={(e)=>setPayload(p=>({...p, security:e.target.value}))}>
                  <option>WPA</option><option>WEP</option><option value="nopass">Sin contraseña</option>
                </select>
                <label style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="checkbox" checked={!!payload.hidden} onChange={(e)=>setPayload(p=>({...p, hidden:e.target.checked}))}/> Red oculta
                </label>
              </div>
            )}

            {/* Preview */}
            <div className="preview">
              {!fallbackMode ? (
                <div ref={containerRef} className="svgbox"/>
              ) : (
                <div className="grid" style={{gridTemplateColumns:"1fr", gap:12}}>
                  <canvas ref={canvasRef} className="canvas"/>
                  <div ref={svgBoxRef} className="svgbox"/>
                </div>
              )}
            </div>

            <div className="row" style={{marginTop:8}}>
              <button className="btn" onClick={addPreset}>Guardar preset</button>
              <button className="btn" onClick={exportPNG}>Exportar PNG</button>
              <button className="btn" onClick={exportSVG}>Exportar SVG</button>
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="card">
            <h2 className="h2">Historial</h2>
            <div className="grid">
              {data.presets.length===0 && <p style={{opacity:.7}}>Aún no tienes presets.</p>}
              {data.presets.map((p)=>(
                <div key={p.id} className="preset">
                  <div style={{fontWeight:700}}>{p.name}</div>
                  <div style={{opacity:.7, fontSize:12}}>{p.mode.toUpperCase()}</div>
                  <div className="row" style={{marginTop:8}}>
                    <button className="btn--small" onClick={()=>loadPreset(p)}>Cargar</button>
                    <button className="btn--ghost" onClick={()=>removePreset(p.id)}>Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "style" && (
          <section className="card">
            <h2 className="h2">Editor de estilo</h2>
            <div className="grid-form">
              <div className="row" style={{gap:8}}>
                <label className="mini-label">Tamaño</label>
                <input className="input" type="number" min="128" max="1024" value={size} onChange={(e)=>setSize(parseInt(e.target.value||"320"))}/>
              </div>
              <div className="row" style={{gap:8}}>
                <label className="mini-label">Margen</label>
                <input className="input" type="number" min="0" max="24" value={margin} onChange={(e)=>setMargin(parseInt(e.target.value||"10"))}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Módulos</label>
                <select className="input" value={dotType} onChange={(e)=>setDotType(e.target.value)} disabled={fallbackMode}>
                  <option value="square">Cuadrados</option>
                  <option value="rounded">Redondeados</option>
                  <option value="dots">Puntos</option>
                </select>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Ojos</label>
                <select className="input" value={cornerSquareType} onChange={(e)=>setCornerSquareType(e.target.value)} disabled={fallbackMode}>
                  <option value="square">Cuadrado</option>
                  <option value="dots">Punteado</option>
                  <option value="extra-rounded">Extra redondeado</option>
                </select>
                <select className="input" value={cornerDotType} onChange={(e)=>setCornerDotType(e.target.value)} disabled={fallbackMode}>
                  <option value="square">Centro cuadrado</option>
                  <option value="dot">Centro punto</option>
                </select>
                <input className="color-input" type="color" value={eyeColor} onChange={(e)=>setEyeColor(e.target.value)} disabled={fallbackMode}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Gradiente</label>
                <label style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="checkbox" checked={useGradient} onChange={(e)=>setUseGradient(e.target.checked)} disabled={fallbackMode}/> Activar
                </label>
                <input className="color-input" type="color" value={darkA} onChange={(e)=>setDarkA(e.target.value)} disabled={fallbackMode}/>
                <input className="color-input" type="color" value={darkB} onChange={(e)=>setDarkB(e.target.value)} disabled={fallbackMode}/>
                <input className="input" type="number" min="0" max="360" value={gradientRotation} onChange={(e)=>setGradientRotation(parseInt(e.target.value||"0"))} disabled={fallbackMode}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Fondo</label>
                <input className="color-input" type="color" value={lightColor} onChange={(e)=>setLightColor(e.target.value)} disabled={fallbackMode}/>
              </div>

              <div className="row" style={{gap:8}}>
                <label className="mini-label">Logo</label>
                <input className="input" type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>setLogoDataUrl(String(r.result)); r.readAsDataURL(f); e.target.value=""; }} disabled={fallbackMode}/>
                {logoDataUrl && <button className="btn--ghost" onClick={()=>setLogoDataUrl("")} disabled={fallbackMode}>Quitar logo</button>}
              </div>
            </div>
            {fallbackMode && <p style={{opacity:.75, marginTop:8}}>Estilos avanzados deshabilitados por compatibilidad. Export y contenido siguen funcionando 👍</p>}
          </section>
        )}
      </main>

      <footer className="footer">
        Offline · PNG/SVG · Presets · {fallbackMode ? "Modo compatibilidad" : "QR estilizado"} ✨
      </footer>
    </div>
  );
}
