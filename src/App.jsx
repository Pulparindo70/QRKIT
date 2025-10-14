import { useEffect, useMemo, useRef, useState } from "react";

/** ========= Estado & helpers ========= **/
const LS_KEY = "qrkit_data_v3"; // bump por cambios
const QRStylingClassRef = { current: null };
const QRCodePlainRef = { current: null }; // 'qrcode' fallback

function encodeVCard({ firstName, lastName, org, title, phone, email, url }) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
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
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function presetNameFromMode(mode, payload){
  if (mode==="link")  return (payload.url || "Link").slice(0,50);
  if (mode==="wifi")  return `Wi-Fi: ${payload.ssid || "SSID"}`;
  if (mode==="vcard") return `vCard: ${[payload.firstName, payload.lastName].filter(Boolean).join(" ") || "Contacto"}`;
  return "Preset";
}
function buildDotsOptions(dotType, useGradient, darkA, darkB, rotationDeg) {
  const gradient = useGradient ? {
    type: "linear",
    rotation: (rotationDeg * Math.PI) / 180,
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

  // instalación PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const h=(e)=>{e.preventDefault(); setDeferredPrompt(e);};
    window.addEventListener("beforeinstallprompt", h);
    return ()=>window.removeEventListener("beforeinstallprompt", h);
  }, []);

  // carga dinámica de libs (robusto para Safari/Firefox/Edge/Android/iOS)
  const [qrLibReady, setQrLibReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false); // usa 'qrcode'
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
          QRCodePlainRef.current = qmod.default || qmod; // Vite puede exportar distinto
          setFallbackMode(true);
          setQrLibReady(true); // listo para fallback
        } catch (err2) {
          console.error("No se pudo cargar ninguna lib de QR:", err2);
          setQrLibReady(false);
        }
      }
    })();
  }, []);

  // datos y estilo
  const [mode, setMode] = useState("link"); // link | vcard | wifi
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
  const containerRef = useRef(null); // para QR estilizado (SVG)
  const canvasRef = useRef(null);    // para fallback
  const svgBoxRef = useRef(null);    // para fallback SVG
  const qrStyledRef = useRef(null);  // instancia de QRCodeStyling

  // load/save
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setData(JSON.parse(raw)); } catch {}
    setTimeout(()=>onReady?.(), 350);
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {} }, [data]);

  // string del QR
  const content = useMemo(() => {
    if (mode === "link") return (payload.url || "").trim();
    if (mode === "vcard") return encodeVCard(payload);
    if (mode === "wifi") return encodeWiFi(payload);
    return "";
  }, [mode, payload]);

  /** --- Instancia QR (estilizado) --- */
  useEffect(() => {
    if (!qrLibReady || fallbackMode) return;           // si fallback, este bloque no corre
    if (!containerRef.current || qrStyledRef.current) return;
    const QRCodeStyling = QRStylingClassRef.current;
    if (!QRCodeStyling) return;

    qrStyledRef.current = new QRCodeStyling({
      data: content || "QRKit",
      width: size,
      height: size,
      margin,
      type: "svg",
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

  /** --- Update QR (estilizado) --- */
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

  /** --- Render QR (fallback con 'qrcode') --- */
  useEffect(() => {
    if (!qrLibReady || !fallbackMode) return;
    const QR = QRCodePlainRef.current;
    if (!QR) return;

    // Canvas PNG
    if (canvasRef.current && content) {
      QR.toCanvas(canvasRef.current, content, {
        width: size,
        margin,
        color: { dark: "#000000", light: "#ffffff" } // fallback: colores planos por compatibilidad máxima
      }).catch(console.error);
    }
    // SVG
    if (svgBoxRef.current && content) {
      QR.toString(content, { type: "svg", width: size, margin })
        .then((svg) => { svgBoxRef.current.innerHTML = svg; })
        .catch(console.error);
    }
  }, [qrLibReady, fallbackMode, content, size, margin]);

  /** --- Acciones --- */
  const addPreset = () => {
    if (!content) return;
    const preset = {
      id: crypto.randomUUID(),
      name: presetNameFromMode(mode, payload),
      mode, payload,
      style: {
        size, margin, useGradient, darkA, darkB, gradientRotation, lightColor,
        dotType, cornerSquareType, cornerDotType, eyeColor, logoDataUrl
      }
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
    setLogoDataUrl(st.logoDataUrl || "");
    setView("generate");
  };

  const removePreset = (id) => setData((s)=>({ ...s, presets: s.presets.filter(x=>x.id!==id) }));

  const exportPNG = async () => {
    // estilizado
    if (qrStyledRef.current && !fallbackMode) {
      const blob = await qrStyledRef.current.getRawData("png");
      return downloadBlob(`qrkit-${Date.now()}.png`, blob);
    }
    // fallback canvas
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob)=> blob && downloadBlob(`qrkit-${Date.now()}.png`, blob));
    }
  };

  const exportSVG = async () => {
    if (qrStyledRef.current && !fallbackMode) {
      const blob = await qrStyledRef.current.getRawData("svg");
      return downloadBlob(`qrkit-${Date.now()}.svg`, blob);
    }
    const svgEl = svgBoxRef.current?.querySelector("svg");
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(`qrkit-${Date.now()}.svg`, blob);
  };

  /** ========= UI ========= **/
  return (
    <div style={styles.page}>
      <Header
        onInstall={deferredPrompt ? async () => { deferredPrompt.prompt(); setDeferredPrompt(null); } : null}
        view={view} setView={setView}
        fallbackMode={fallbackMode}
      />

      <main style={styles.main}>
        {view === "generate" && (
          <GenerateView
            mode={mode} setMode={setMode}
            payload={payload} setPayload={setPayload}
            size={size} setSize={setSize}
            margin={margin} setMargin={setMargin}
            useGradient={useGradient} setUseGradient={setUseGradient}
            darkA={darkA} setDarkA={setDarkA}
            darkB={darkB} setDarkB={setDarkB}
            gradientRotation={gradientRotation} setGradientRotation={setGradientRotation}
            lightColor={lightColor} setLightColor={setLightColor}
            dotType={dotType} setDotType={setDotType}
            cornerSquareType={cornerSquareType} setCornerSquareType={setCornerSquareType}
            cornerDotType={cornerDotType} setCornerDotType={setCornerDotType}
            eyeColor={eyeColor} setEyeColor={setEyeColor}
            logoDataUrl={logoDataUrl} setLogoDataUrl={setLogoDataUrl}
            containerRef={containerRef}
            canvasRef={canvasRef} svgBoxRef={svgBoxRef}
            fallbackMode={fallbackMode}
            onSavePreset={addPreset}
            onExportPNG={exportPNG}
            onExportSVG={exportSVG}
          />
        )}

        {view === "history" && (
          <HistoryView presets={data.presets} onLoad={loadPreset} onRemove={removePreset} />
        )}

        {view === "style" && (
          <StyleView
            size={size} setSize={setSize}
            margin={margin} setMargin={setMargin}
            useGradient={useGradient} setUseGradient={setUseGradient}
            darkA={darkA} setDarkA={setDarkA}
            darkB={darkB} setDarkB={setDarkB}
            gradientRotation={gradientRotation} setGradientRotation={setGradientRotation}
            lightColor={lightColor} setLightColor={setLightColor}
            dotType={dotType} setDotType={setDotType}
            cornerSquareType={cornerSquareType} setCornerSquareType={setCornerSquareType}
            cornerDotType={cornerDotType} setCornerDotType={setCornerDotType}
            eyeColor={eyeColor} setEyeColor={setEyeColor}
            logoDataUrl={logoDataUrl} setLogoDataUrl={setLogoDataUrl}
            fallbackMode={fallbackMode}
          />
        )}
      </main>

      <footer style={styles.footer}>
        <span style={{opacity:.75}}>
          Offline · PNG/SVG · Presets · {fallbackMode ? "Modo compatibilidad activado" : "QR estilizado activo"} ✨
        </span>
      </footer>
    </div>
  );
}

/** ========= Vistas ========= **/
function Header({ onInstall, view, setView, fallbackMode }) {
  return (
    <header style={styles.header}>
      <div style={styles.brand}>
        <div style={styles.brandBadge}>🔳</div>
        <div>
          <div style={styles.brandTitle}>QRKit</div>
          <div style={styles.brandSub}>{fallbackMode ? "Compatibilidad universal" : "Módulos redondeados & gradientes"}</div>
        </div>
      </div>

      <div style={styles.headerActions}>
        <NavTab label="Generar"  active={view==="generate"} onClick={()=>setView("generate")} />
        <NavTab label="Historial" active={view==="history"}  onClick={()=>setView("history")} />
        <NavTab label="Editor de estilo" active={view==="style"} onClick={()=>setView("style")} />
        {onInstall && <button style={styles.installBtn} onClick={onInstall}>Instalar</button>}
      </div>
    </header>
  );
}
function NavTab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding:"8px 12px", borderRadius:10,
        border:`1px solid ${active ? "rgba(6,182,212,.6)" : "rgba(148,163,184,.25)"}`,
        background: active ? "rgba(6,182,212,.15)" : "transparent",
        color: active ? "#e0f2fe" : "#e5e7eb", cursor:"pointer"
      }}>{label}</button>
  );
}

function GenerateView(props){
  const {
    mode,setMode,payload,setPayload,
    size,setSize, margin,setMargin,
    useGradient,setUseGradient, darkA,setDarkA, darkB,setDarkB, gradientRotation,setGradientRotation,
    lightColor,setLightColor, dotType,setDotType, cornerSquareType,setCornerSquareType, cornerDotType,setCornerDotType, eyeColor,setEyeColor,
    logoDataUrl,setLogoDataUrl,
    containerRef, canvasRef, svgBoxRef, fallbackMode,
    onSavePreset, onExportPNG, onExportSVG
  } = props;

  const onLogoPick = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setLogoDataUrl(String(r.result)); r.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>Generar</h2>

      <div style={styles.row}>
        <select style={styles.input} value={mode} onChange={(e)=>{ setMode(e.target.value); setPayload({}); }}>
          <option value="link">Link</option>
          <option value="vcard">vCard</option>
          <option value="wifi">Wi-Fi</option>
        </select>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Tamaño</label>
          <input type="number" min="128" max="1024" value={size} onChange={(e)=>setSize(parseInt(e.target.value||"320"))} style={{...styles.input, maxWidth:120}}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Margen</label>
          <input type="number" min="0" max="24" value={margin} onChange={(e)=>setMargin(parseInt(e.target.value||"10"))} style={{...styles.input, maxWidth:100}}/>
        </div>
      </div>

      {/* Estilo rápido (en fallback los módulos/ojos avanzados no aplican) */}
      <div style={styles.row}>
        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Módulos</label>
          <select style={styles.input} value={dotType} onChange={(e)=>setDotType(e.target.value)} disabled={fallbackMode}>
            <option value="square">Cuadrados</option>
            <option value="rounded">Redondeados</option>
            <option value="dots">Puntos</option>
          </select>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Ojos</label>
          <select style={styles.input} value={cornerSquareType} onChange={(e)=>setCornerSquareType(e.target.value)} disabled={fallbackMode}>
            <option value="square">Cuadrado</option>
            <option value="dots">Punteado</option>
            <option value="extra-rounded">Extra redondeado</option>
          </select>
          <select style={styles.input} value={cornerDotType} onChange={(e)=>setCornerDotType(e.target.value)} disabled={fallbackMode}>
            <option value="square">Centro cuadrado</option>
            <option value="dot">Centro punto</option>
          </select>
          <input type="color" value={eyeColor} onChange={(e)=>setEyeColor(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Gradiente</label>
          <label style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="checkbox" checked={useGradient} onChange={(e)=>setUseGradient(e.target.checked)} disabled={fallbackMode}/> Activar
          </label>
          <input type="color" value={darkA} onChange={(e)=>setDarkA(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
          <input type="color" value={darkB} onChange={(e)=>setDarkB(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
          <input type="number" min="0" max="360" value={gradientRotation} onChange={(e)=>setGradientRotation(parseInt(e.target.value||"0"))} style={{...styles.input, maxWidth:110}} disabled={fallbackMode}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Fondo</label>
          <input type="color" value={lightColor} onChange={(e)=>setLightColor(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Logo</label>
          <input type="file" accept="image/*" onChange={onLogoPick} style={{ ...styles.input, padding:"8px", maxWidth:240 }} disabled={fallbackMode}/>
          {logoDataUrl && <button style={styles.smallGhost} onClick={()=>setLogoDataUrl("")} disabled={fallbackMode}>Quitar</button>}
        </div>
      </div>

      {/* Campos según modo */}
      {mode === "link" && (
        <div style={styles.row}>
          <input style={styles.input} placeholder="https://tusitio.com" value={payload.url||""} onChange={(e)=>setPayload(p=>({...p, url:e.target.value}))}/>
        </div>
      )}
      {mode === "vcard" && (
        <div style={styles.gridForm}>
          <input style={styles.input} placeholder="Nombre"   value={payload.firstName||""} onChange={(e)=>setPayload(p=>({...p, firstName:e.target.value}))}/>
          <input style={styles.input} placeholder="Apellido" value={payload.lastName||""}  onChange={(e)=>setPayload(p=>({...p, lastName:e.target.value}))}/>
          <input style={styles.input} placeholder="Empresa"  value={payload.org||""}       onChange={(e)=>setPayload(p=>({...p, org:e.target.value}))}/>
          <input style={styles.input} placeholder="Puesto"   value={payload.title||""}     onChange={(e)=>setPayload(p=>({...p, title:e.target.value}))}/>
          <input style={styles.input} placeholder="Teléfono" value={payload.phone||""}     onChange={(e)=>setPayload(p=>({...p, phone:e.target.value}))}/>
          <input style={styles.input} placeholder="Email"    value={payload.email||""}     onChange={(e)=>setPayload(p=>({...p, email:e.target.value}))}/>
          <input style={styles.input} placeholder="URL"      value={payload.url||""}       onChange={(e)=>setPayload(p=>({...p, url:e.target.value}))}/>
        </div>
      )}
      {mode === "wifi" && (
        <div style={styles.gridForm}>
          <input style={styles.input} placeholder="SSID (nombre de red)" value={payload.ssid||""} onChange={(e)=>setPayload(p=>({...p, ssid:e.target.value}))}/>
          <input style={styles.input} placeholder="Contraseña" value={payload.password||""} onChange={(e)=>setPayload(p=>({...p, password:e.target.value}))}/>
          <select style={styles.input} value={payload.security||"WPA"} onChange={(e)=>setPayload(p=>({...p, security:e.target.value}))}>
            <option>WPA</option><option>WEP</option><option value="nopass">Sin contraseña</option>
          </select>
          <label style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" checked={!!payload.hidden} onChange={(e)=>setPayload(p=>({...p, hidden:e.target.checked}))}/> Red oculta
          </label>
        </div>
      )}

      {/* Preview */}
      <div style={styles.previewWrap}>
        {!fallbackMode ? (
          <div ref={containerRef} style={styles.svgBox}/>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,width:"100%"}}>
            <canvas ref={canvasRef} style={styles.canvas}/>
            <div ref={svgBoxRef} style={styles.svgBox}/>
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8 }}>
        <button style={styles.btn} onClick={onSavePreset}>Guardar preset</button>
        <button style={styles.btn} onClick={onExportPNG}>Exportar PNG</button>
        <button style={styles.btn} onClick={onExportSVG}>Exportar SVG</button>
      </div>
    </section>
  );
}

function HistoryView({ presets, onLoad, onRemove }){
  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>Historial</h2>
      <div style={styles.grid}>
        {presets.length===0 && <p style={{opacity:.7}}>Aún no tienes presets.</p>}
        {presets.map((p)=>(
          <div key={p.id} style={styles.presetItem}>
            <div style={{fontWeight:700}}>{p.name}</div>
            <div style={{opacity:.7, fontSize:12}}>{p.mode.toUpperCase()}</div>
            <div style={{display:"flex", gap:8, marginTop:8}}>
              <button style={styles.smallBtn} onClick={()=>onLoad(p)}>Cargar</button>
              <button style={styles.smallGhost} onClick={()=>onRemove(p.id)}>Borrar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StyleView({
  size,setSize, margin,setMargin,
  useGradient,setUseGradient, darkA,setDarkA, darkB,setDarkB, gradientRotation,setGradientRotation,
  lightColor,setLightColor, dotType,setDotType, cornerSquareType,setCornerSquareType, cornerDotType,setCornerDotType, eyeColor,setEyeColor,
  logoDataUrl,setLogoDataUrl, fallbackMode
}){
  const fileRef = useRef(null);
  const pickLogo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setLogoDataUrl(String(r.result)); r.readAsDataURL(f);
    e.target.value = "";
  };
  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>Editor de estilo</h2>
      <div style={styles.gridForm}>
        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Tamaño</label>
          <input type="number" min="128" max="1024" value={size} onChange={(e)=>setSize(parseInt(e.target.value||"320"))} style={{...styles.input, maxWidth:140}}/>
        </div>
        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Margen</label>
          <input type="number" min="0" max="24" value={margin} onChange={(e)=>setMargin(parseInt(e.target.value||"10"))} style={{...styles.input, maxWidth:120}}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Módulos</label>
          <select style={styles.input} value={dotType} onChange={(e)=>setDotType(e.target.value)} disabled={fallbackMode}>
            <option value="square">Cuadrados</option>
            <option value="rounded">Redondeados</option>
            <option value="dots">Puntos</option>
          </select>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Ojos</label>
          <select style={styles.input} value={cornerSquareType} onChange={(e)=>setCornerSquareType(e.target.value)} disabled={fallbackMode}>
            <option value="square">Cuadrado</option>
            <option value="dots">Punteado</option>
            <option value="extra-rounded">Extra redondeado</option>
          </select>
          <select style={styles.input} value={cornerDotType} onChange={(e)=>setCornerDotType(e.target.value)} disabled={fallbackMode}>
            <option value="square">Centro cuadrado</option>
            <option value="dot">Centro punto</option>
          </select>
          <input type="color" value={eyeColor} onChange={(e)=>setEyeColor(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Gradiente</label>
          <label style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="checkbox" checked={useGradient} onChange={(e)=>setUseGradient(e.target.checked)} disabled={fallbackMode}/> Activar
          </label>
          <input type="color" value={darkA} onChange={(e)=>setDarkA(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
          <input type="color" value={darkB} onChange={(e)=>setDarkB(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
          <input type="number" min="0" max="360" value={gradientRotation} onChange={(e)=>setGradientRotation(parseInt(e.target.value||"0"))} style={{...styles.input, maxWidth:110}} disabled={fallbackMode}/>
        </div>

        <div style={styles.colorWrap}>
          <label style={styles.miniLabel}>Fondo</label>
          <input type="color" value={lightColor} onChange={(e)=>setLightColor(e.target.value)} style={styles.colorInput} disabled={fallbackMode}/>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <label style={styles.miniLabel}>Logo</label>
          <input type="file" ref={fileRef} accept="image/*" onChange={pickLogo} style={{...styles.input, padding:"8px", maxWidth:240}} disabled={fallbackMode}/>
          {logoDataUrl && <button style={styles.smallGhost} onClick={()=>setLogoDataUrl("")} disabled={fallbackMode}>Quitar logo</button>}
        </div>
      </div>
      {fallbackMode && <p style={{opacity:.75, marginTop:8}}>Estilos avanzados deshabilitados por compatibilidad. Export y contenido siguen funcionando 👍</p>}
    </section>
  );
}

/** ========= Estilos ========= **/
const styles = {
  page:{minHeight:"100vh",display:"flex",flexDirection:"column"},
  header:{
    display:"flex",alignItems:"center",justifyContent:"space-between",
    padding:"14px 16px",borderBottom:"1px solid var(--border)",
    background:"linear-gradient(180deg, rgba(6,182,212,.12), transparent)"
  },
  brand:{display:"flex",alignItems:"center",gap:12},
  brandBadge:{
    width:36,height:36,borderRadius:10,display:"grid",placeItems:"center",
    background:"linear-gradient(145deg, rgba(6,182,212,.25), rgba(124,58,237,.25))",
    border:"1px solid rgba(148,163,184,.25)"
  },
  brandTitle:{fontWeight:800,letterSpacing:.3},
  brandSub:{fontSize:12,color:"var(--muted)"},
  headerActions:{display:"flex",gap:10,alignItems:"center"},
  installBtn:{
    padding:"8px 12px",borderRadius:10,cursor:"pointer",
    border:"1px solid rgba(148,163,184,.25)",background:"rgba(6,182,212,.15)",
    color:"#e0f2fe",fontWeight:700,backdropFilter:"blur(6px)"
  },

  main:{flex:1,display:"flex",justifyContent:"center",padding:16},
  card:{
    width:"100%",maxWidth:1100,background:"var(--panel)",border:"1px solid var(--border)",
    borderRadius:16,boxShadow:"0 10px 30px rgba(0,0,0,.35)",padding:16
  },
  h2:{margin:"6px 0 10px 0",letterSpacing:.2},

  row:{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"},
  input:{
    flex:1,minWidth:180,padding:"10px 12px",borderRadius:10,
    border:"1px solid #334155",background:"#0b1220",color:"#e5e7eb",outline:"none"
  },
  btn:{
    padding:"10px 14px",borderRadius:10,border:"1px solid #155e75",
    background:"linear-gradient(145deg, #06b6d4, #7c3aed)",color:"#0b0f14",
    fontWeight:800,cursor:"pointer"
  },
  smallBtn:{
    padding:"6px 10px",borderRadius:10,border:"1px solid rgba(148,163,184,.25)",
    background:"rgba(124,58,237,.2)",color:"#e5e7eb",cursor:"pointer"
  },
  smallGhost:{
    padding:"6px 10px",borderRadius:10,border:"1px solid rgba(148,163,184,.25)",
    background:"transparent",color:"#93c5fd",cursor:"pointer"
  },

  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))",gap:10,marginTop:8},
  presetItem:{padding:12,border:"1px solid var(--border)",borderRadius:12,background:"linear-gradient(180deg, rgba(2,6,23,.2), rgba(2,6,23,.35))"},

  gridForm:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))",gap:8,marginTop:8},
  colorWrap:{display:"flex",alignItems:"center",gap:8},
  miniLabel:{fontSize:12,opacity:.8},
  colorInput:{width:44,height:44,border:"1px solid rgba(148,163,184,.25)",borderRadius:10,background:"transparent",padding:0},

  previewWrap:{display:"grid",gridTemplateColumns:"1fr",gap:16,alignItems:"center",marginTop:12},
  svgBox:{width:"100%",maxWidth:520,background:"white",borderRadius:12,overflow:"hidden",display:"grid",placeItems:"center",padding:12},
  canvas:{width:"100%",maxWidth:520,background:"white",borderRadius:12}
};
