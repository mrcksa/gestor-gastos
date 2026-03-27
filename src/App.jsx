import { useState, useEffect, useRef } from "react";
import { load, save, STORAGE_KEY, BUDGETS_KEY, CATS_KEY } from "./storage";

const DEFAULT_CATS = [
  { id: "hogar", label: "Hogar", color: "#378ADD", bg: "#E6F1FB",
    keywords: ["alquiler","hipoteca","comunidad","mueble","electrodoméstico","limpieza","fontanero","electricista","pintura","reforma","bricolaje","ikea"] },
  { id: "coche", label: "Coche", color: "#BA7517", bg: "#FAEEDA",
    keywords: ["gasoil","gasolina","carburante","itv","seguro coche","parking","autopista","taller","rueda","neumático","revisión","multa","peaje","renting","leasing"] },
  { id: "alimentacion", label: "Alimentación", color: "#3B6D11", bg: "#EAF3DE",
    keywords: ["mercadona","carrefour","lidl","aldi","supermercado","frutería","panadería","carnicería","pescadería","compra","alimentación","restaurante","bar","café","comida","cena","almuerzo"] },
  { id: "suministros", label: "Suministros", color: "#534AB7", bg: "#EEEDFE",
    keywords: ["luz","electricidad","agua","gas","internet","wifi","fibra","teléfono","movil","móvil","endesa","iberdrola","naturgy","vodafone","movistar","orange"] },
  { id: "salud", label: "Salud", color: "#993556", bg: "#FBEAF0",
    keywords: ["farmacia","médico","médica","dentista","clínica","hospital","mutua","seguro salud","fisio","fisioterapeuta","óptica","gafas","medicamento","pastilla"] },
  { id: "ocio", label: "Ocio", color: "#0F6E56", bg: "#E1F5EE",
    keywords: ["netflix","spotify","amazon prime","hbo","disney","gimnasio","cine","teatro","concierto","viaje","hotel","vuelo","vacaciones","libro","juego","deporte"] },
  { id: "ropa", label: "Ropa", color: "#D4537E", bg: "#FBEAF0",
    keywords: ["zara","h&m","mango","primark","ropa","calzado","zapatos","zapatillas","abrigo","camiseta","pantalón"] },
  { id: "otros", label: "Otros", color: "#5F5E5A", bg: "#F1EFE8", keywords: [] },
];

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatEur(n) {
  return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n);
}

function detectCat(desc, cats) {
  const d = desc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  for (const c of cats) {
    if (c.id === "otros") continue;
    for (const kw of (c.keywords||[])) {
      const k = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      if (d.includes(k)) return c.id;
    }
  }
  return "otros";
}

function today() { return new Date().toISOString().slice(0,10); }
function addMonths(d, n) { const dt = new Date(d); dt.setMonth(dt.getMonth()+n); return dt; }

export default function App() {
  const [gastos, setGastos] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [cats, setCats] = useState(DEFAULT_CATS);
  const [view, setView] = useState("dashboard");
  const [form, setForm] = useState({ desc:"", importe:"", cat:"", fecha:today(), nota:"", recurrente:false, frecuencia:"mensual" });
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear] = useState(new Date().getFullYear());
  const [proxyMonths, setProxyMonths] = useState(1);
  const [alert, setAlert] = useState(null);
  const [newCatForm, setNewCatForm] = useState({ label:"", color:"#378ADD", keywords:"" });
  const [loaded, setLoaded] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const alertTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const [g, b, c] = await Promise.all([load(STORAGE_KEY,[]), load(BUDGETS_KEY,{}), load(CATS_KEY, DEFAULT_CATS)]);
      setGastos(g); setBudgets(b); setCats(c); setLoaded(true);
    })();
  }, []);

  function showAlert(msg, type="success") {
    setAlert({msg,type});
    clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(()=>setAlert(null),3000);
  }

  function handleDescChange(val) {
    const detected = val.length > 2 ? detectCat(val, cats) : "";
    setForm(f => ({...f, desc:val, cat: detected || f.cat}));
    setAutoDetected(detected && detected !== "otros" && val.length > 2);
  }

  async function addGasto() {
    if (!form.desc.trim() || !form.importe || isNaN(parseFloat(form.importe))) {
      showAlert("Rellena descripción e importe.", "error"); return;
    }
    const catId = form.cat || "otros";
    const nuevo = { id:Date.now(), desc:form.desc, importe:parseFloat(form.importe), cat:catId, fecha:form.fecha, nota:form.nota, recurrente:form.recurrente, frecuencia:form.frecuencia };
    const updated = [nuevo, ...gastos];
    setGastos(updated);
    await save(STORAGE_KEY, updated);
    setForm({ desc:"", importe:"", cat:"", fecha:today(), nota:"", recurrente:false, frecuencia:"mensual" });
    setAutoDetected(false);
    showAlert("Gasto añadido.");
    setView("dashboard");
  }

  async function deleteGasto(id) {
    const updated = gastos.filter(g=>g.id!==id);
    setGastos(updated); await save(STORAGE_KEY, updated);
    showAlert("Gasto eliminado.");
  }

  async function saveBudget(catId, val) {
    const updated = {...budgets,[catId]:parseFloat(val)||0};
    setBudgets(updated); await save(BUDGETS_KEY, updated);
  }

  async function addCat() {
    if (!newCatForm.label.trim()) { showAlert("Pon un nombre a la categoría.","error"); return; }
    const id = newCatForm.label.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"") + "-" + Date.now();
    const bg = newCatForm.color + "22";
    const keywords = newCatForm.keywords.split(",").map(k=>k.trim().toLowerCase()).filter(Boolean);
    const nueva = { id, label:newCatForm.label, color:newCatForm.color, bg, keywords };
    const updated = [...cats.filter(c=>c.id!=="otros"), nueva, cats.find(c=>c.id==="otros")];
    setCats(updated); await save(CATS_KEY, updated);
    setNewCatForm({label:"",color:"#378ADD",keywords:""});
    showAlert(`Categoría "${nueva.label}" creada.`);
  }

  async function deleteCat(id) {
    const updated = cats.filter(c=>c.id!==id);
    setCats(updated); await save(CATS_KEY, updated);
    showAlert("Categoría eliminada.");
  }

  const now = new Date();
  const gastosDelMes = gastos.filter(g => {
    const d = new Date(g.fecha);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });
  const gastosReales = gastosDelMes.filter(g => new Date(g.fecha) <= now);
  const totalMes = gastosReales.reduce((s,g)=>s+g.importe,0);
  const proximos = gastos.filter(g => new Date(g.fecha) > now).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));

  function getProyeccion(meses) {
    const hasta = addMonths(now, meses);
    let items = [];
    gastos.filter(g=>new Date(g.fecha)>now && new Date(g.fecha)<=hasta).forEach(g=>items.push({...g,origen:"registrado"}));
    gastos.filter(g=>g.recurrente && new Date(g.fecha)<=now).forEach(g => {
      let base = new Date(g.fecha);
      while (true) {
        let next = new Date(base);
        if (g.frecuencia==="semanal") next.setDate(next.getDate()+7);
        else if (g.frecuencia==="quincenal") next.setDate(next.getDate()+15);
        else if (g.frecuencia==="mensual") next.setMonth(next.getMonth()+1);
        else if (g.frecuencia==="trimestral") next.setMonth(next.getMonth()+3);
        else if (g.frecuencia==="anual") next.setFullYear(next.getFullYear()+1);
        else break;
        if (next > hasta) break;
        if (next > now) items.push({...g, id:g.id+"_"+next.getTime(), fecha:next.toISOString().slice(0,10), origen:"recurrente"});
        base = next;
      }
    });
    return items.sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  }

  const proyeccion = getProyeccion(proxyMonths);
  const totalProyeccion = proyeccion.reduce((s,g)=>s+g.importe,0);
  const gastosFiltered = (filterCat==="all" ? gastosDelMes : gastosDelMes.filter(g=>g.cat===filterCat))
    .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const porCategoria = cats.map(c => ({
    ...c,
    total: gastosReales.filter(g=>g.cat===c.id).reduce((s,g)=>s+g.importe,0),
    budget: budgets[c.id]||0,
  })).filter(c=>c.total>0||c.budget>0);
  const maxCat = Math.max(...porCategoria.map(c=>c.total),1);
  function getCatById(id) { return cats.find(c=>c.id===id)||cats[cats.length-1]||DEFAULT_CATS[7]; }

  const s = { // shared inline styles
    card: { background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"1rem 1.25rem" },
    badge: (bg, color) => ({ fontSize:10, padding:"1px 6px", borderRadius:10, flexShrink:0, background:bg, color }),
    avatar: (bg, color) => ({ width:32, height:32, borderRadius:"var(--border-radius-md)", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, color, flexShrink:0 }),
    row: { display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" },
  };

  if (!loaded) return <div style={{padding:"2rem",color:"var(--color-text-secondary)",fontSize:14}}>Cargando...</div>;

  return (
    <div style={{maxWidth:660,margin:"0 auto",padding:"0.5rem 0.75rem 2rem"}}>

      {alert && (
        <div style={{position:"sticky",top:8,zIndex:10,marginBottom:12,padding:"10px 16px",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,
          background:alert.type==="error"?"var(--color-background-danger)":"var(--color-background-success)",
          color:alert.type==="error"?"var(--color-text-danger)":"var(--color-text-success)",
          border:`0.5px solid ${alert.type==="error"?"var(--color-border-danger)":"var(--color-border-success)"}`}}>
          {alert.msg}
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontSize:18,fontWeight:500}}>Mis gastos</div>
          <div style={{fontSize:13,color:"var(--color-text-secondary)"}}>{MONTHS[filterMonth]} {filterYear}</div>
        </div>
        <button onClick={()=>setView(view==="add"?"dashboard":"add")} style={{
          padding:"8px 16px",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,cursor:"pointer",
          background:view==="add"?"var(--color-background-secondary)":"var(--color-text-primary)",
          color:view==="add"?"var(--color-text-primary)":"var(--color-background-primary)",
          border:"0.5px solid var(--color-border-secondary)"}}>
          {view==="add"?"Cancelar":"+ Añadir gasto"}
        </button>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["dashboard","Resumen"],["lista","Lista"],["proximos","Próximos"],["presupuesto","Presupuestos"],["categorias","Categorías"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{
            padding:"6px 12px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",
            background:view===v?"var(--color-text-primary)":"transparent",
            color:view===v?"var(--color-background-primary)":"var(--color-text-secondary)",
            border:"0.5px solid var(--color-border-secondary)",fontWeight:view===v?500:400}}>
            {l}
          </button>
        ))}
        <select value={filterMonth} onChange={e=>setFilterMonth(+e.target.value)} style={{marginLeft:"auto",fontSize:13,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m} {filterYear}</option>)}
        </select>
      </div>

      {/* ADD */}
      {view==="add" && (
        <div style={{...s.card,marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:500,marginBottom:14}}>Nuevo gasto</div>
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Descripción</div>
                <input placeholder="Ej: Gasoil Repsol" value={form.desc} onChange={e=>handleDescChange(e.target.value)} style={{width:"100%"}} />
                {autoDetected && <div style={{fontSize:11,marginTop:3,color:"var(--color-text-success)"}}>Detectado: {getCatById(form.cat).label}</div>}
              </div>
              <div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Importe (€)</div>
                <input type="number" placeholder="0.00" value={form.importe} onChange={e=>setForm({...form,importe:e.target.value})} style={{width:"100%"}} />
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Categoría</div>
                <select value={form.cat||"otros"} onChange={e=>setForm({...form,cat:e.target.value})} style={{width:"100%"}}>
                  {cats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Fecha</div>
                <input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={{width:"100%"}} />
              </div>
            </div>
            <div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Nota (opcional)</div>
              <input placeholder="Añade un detalle..." value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})} style={{width:"100%"}} />
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
              <input type="checkbox" id="recurrente" checked={form.recurrente} onChange={e=>setForm({...form,recurrente:e.target.checked})} style={{width:16,height:16}} />
              <label htmlFor="recurrente" style={{fontSize:13,cursor:"pointer"}}>Gasto recurrente</label>
              {form.recurrente && (
                <select value={form.frecuencia} onChange={e=>setForm({...form,frecuencia:e.target.value})} style={{marginLeft:"auto",fontSize:12,padding:"4px 8px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                </select>
              )}
            </div>
            <button onClick={addGasto} style={{padding:"10px",borderRadius:"var(--border-radius-md)",fontSize:14,fontWeight:500,background:"var(--color-text-primary)",color:"var(--color-background-primary)",border:"none",cursor:"pointer"}}>
              Guardar gasto
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {view==="dashboard" && (<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
          {[{label:"Total mes",val:formatEur(totalMes)},{label:"Nº gastos",val:gastosReales.length},{label:"Próximos",val:formatEur(proximos.reduce((s,g)=>s+g.importe,0))}].map(k=>(
            <div key={k.label} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"0.75rem 1rem"}}>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:18,fontWeight:500}}>{k.val}</div>
            </div>
          ))}
        </div>
        <div style={{...s.card,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Por categoría</div>
          {porCategoria.length===0&&<div style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin gastos este mes.</div>}
          {porCategoria.map(c=>{
            const pct=Math.min(100,(c.total/maxCat)*100);
            const over=c.budget>0&&c.total>c.budget;
            return (
              <div key={c.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}>
                  <span style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:10,height:10,borderRadius:2,background:c.color,display:"inline-block"}}></span>{c.label}
                  </span>
                  <span style={{color:over?"var(--color-text-danger)":"var(--color-text-primary)",fontWeight:500}}>
                    {formatEur(c.total)}{c.budget>0&&<span style={{color:"var(--color-text-secondary)",fontWeight:400}}> / {formatEur(c.budget)}</span>}
                  </span>
                </div>
                <div style={{height:6,background:"var(--color-background-secondary)",borderRadius:4,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:over?"#E24B4A":c.color,borderRadius:4}}></div>
                </div>
                {over&&<div style={{fontSize:11,color:"var(--color-text-danger)",marginTop:2}}>Superado en {formatEur(c.total-c.budget)}</div>}
              </div>
            );
          })}
        </div>
        <div style={s.card}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:10}}>Últimos gastos</div>
          {gastosReales.length===0&&<div style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin gastos este mes.</div>}
          {gastosReales.slice(0,6).map(g=>{
            const cat=getCatById(g.cat);
            return (
              <div key={g.id} style={s.row}>
                <div style={s.avatar(cat.bg,cat.color)}>{cat.label.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.desc}</div>
                  <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{g.fecha}{g.recurrente?` · ${g.frecuencia}`:""}</div>
                </div>
                <div style={{fontSize:14,fontWeight:500,flexShrink:0}}>{formatEur(g.importe)}</div>
              </div>
            );
          })}
        </div>
      </>)}

      {/* LISTA */}
      {view==="lista" && (
        <div style={s.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:14,fontWeight:500}}>{gastosFiltered.length} gastos · {formatEur(gastosFiltered.reduce((a,g)=>a+g.importe,0))}</div>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{fontSize:13,padding:"5px 10px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"}}>
              <option value="all">Todas</option>
              {cats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {gastosFiltered.length===0&&<div style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin gastos.</div>}
          {gastosFiltered.map(g=>{
            const cat=getCatById(g.cat);
            const esFuturo=new Date(g.fecha)>now;
            return (
              <div key={g.id} style={{...s.row,opacity:esFuturo?0.65:1}}>
                <div style={s.avatar(cat.bg,cat.color)}>{cat.label.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.desc}</span>
                    {esFuturo&&<span style={s.badge("var(--color-background-warning)","var(--color-text-warning)")}>futuro</span>}
                    {g.recurrente&&<span style={s.badge("var(--color-background-info)","var(--color-text-info)")}>{g.frecuencia}</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{g.fecha}{g.nota?` · ${g.nota}`:""}</div>
                </div>
                <div style={{fontSize:14,fontWeight:500,flexShrink:0,marginRight:8}}>{formatEur(g.importe)}</div>
                <button onClick={()=>deleteGasto(g.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:16,padding:2}}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* PRÓXIMOS */}
      {view==="proximos" && (
        <div style={{display:"grid",gap:14}}>
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:10}}>Proyección de gastos</div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>Próximos</span>
              {[1,2,3,6].map(m=>(
                <button key={m} onClick={()=>setProxyMonths(m)} style={{padding:"6px 14px",borderRadius:"var(--border-radius-md)",fontSize:13,cursor:"pointer",background:proxyMonths===m?"var(--color-text-primary)":"transparent",color:proxyMonths===m?"var(--color-background-primary)":"var(--color-text-secondary)",border:"0.5px solid var(--color-border-secondary)"}}>
                  {m} {m===1?"mes":"meses"}
                </button>
              ))}
            </div>
            <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
              {[{label:"Total proyectado",val:formatEur(totalProyeccion)},{label:"Nº de pagos",val:proyeccion.length}].map(k=>(
                <div key={k.label} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"0.75rem 1rem"}}>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:20,fontWeight:500}}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:10}}>Pagos previstos</div>
            {proyeccion.length===0&&<div style={{fontSize:13,color:"var(--color-text-secondary)"}}>Sin gastos próximos. Añade gastos futuros o marca gastos como recurrentes.</div>}
            {proyeccion.map(g=>{
              const cat=getCatById(g.cat);
              const diffDays=Math.ceil((new Date(g.fecha)-now)/(1000*60*60*24));
              return (
                <div key={g.id} style={s.row}>
                  <div style={s.avatar(cat.bg,cat.color)}>{cat.label.slice(0,2).toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.desc}</span>
                      <span style={s.badge(g.origen==="recurrente"?"var(--color-background-info)":"var(--color-background-warning)",g.origen==="recurrente"?"var(--color-text-info)":"var(--color-text-warning)")}>
                        {g.origen==="recurrente"?g.frecuencia:"programado"}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{g.fecha} · en {diffDays} {diffDays===1?"día":"días"}</div>
                  </div>
                  <div style={{fontSize:14,fontWeight:500,flexShrink:0}}>{formatEur(g.importe)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRESUPUESTO */}
      {view==="presupuesto" && (
        <div style={s.card}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Presupuesto mensual</div>
          <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14}}>Define el límite por categoría. Se guarda al salir del campo.</div>
          {cats.map(c=>{
            const spent=gastosReales.filter(g=>g.cat===c.id).reduce((a,g)=>a+g.importe,0);
            const bud=budgets[c.id]||0;
            const over=bud>0&&spent>bud;
            return (
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{...s.avatar(c.bg,c.color),width:28,height:28}}>{c.label.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,fontSize:13}}>{c.label}</div>
                <div style={{fontSize:12,color:over?"var(--color-text-danger)":"var(--color-text-secondary)",minWidth:70,textAlign:"right"}}>{formatEur(spent)}</div>
                <input type="number" placeholder="0" defaultValue={bud||""} onBlur={e=>saveBudget(c.id,e.target.value)} style={{width:80,textAlign:"right",padding:"5px 8px"}} />
                <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>€</span>
              </div>
            );
          })}
        </div>
      )}

      {/* CATEGORÍAS */}
      {view==="categorias" && (
        <div style={{display:"grid",gap:14}}>
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Categorías</div>
            {cats.map(c=>(
              <div key={c.id} style={s.row}>
                <div style={s.avatar(c.bg,c.color)}>{c.label.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500}}>{c.label}</div>
                  {c.keywords?.length>0&&<div style={{fontSize:11,color:"var(--color-text-secondary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.keywords.slice(0,5).join(", ")}{c.keywords.length>5?"…":""}</div>}
                </div>
                {!["hogar","coche","alimentacion","suministros","salud","ocio","ropa","otros"].includes(c.id)&&(
                  <button onClick={()=>deleteCat(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:15,padding:2}}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={s.card}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:12}}>Nueva categoría</div>
            <div style={{display:"grid",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
                <div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Nombre</div>
                  <input placeholder="Ej: Mascotas" value={newCatForm.label} onChange={e=>setNewCatForm({...newCatForm,label:e.target.value})} style={{width:"100%"}} />
                </div>
                <div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Color</div>
                  <input type="color" value={newCatForm.color} onChange={e=>setNewCatForm({...newCatForm,color:e.target.value})} style={{width:48,height:36,padding:2,borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",cursor:"pointer"}} />
                </div>
              </div>
              <div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4}}>Palabras clave (separadas por comas)</div>
                <input placeholder="Ej: veterinario, pienso, perro, gato" value={newCatForm.keywords} onChange={e=>setNewCatForm({...newCatForm,keywords:e.target.value})} style={{width:"100%"}} />
              </div>
              <button onClick={addCat} style={{padding:"9px",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,background:"var(--color-text-primary)",color:"var(--color-background-primary)",border:"none",cursor:"pointer"}}>
                Crear categoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
