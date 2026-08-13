import { useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  || (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  || "http://127.0.0.1:8000";

async function staffFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail;
    throw new Error(typeof detail === "object" ? detail.message : detail || "No se pudo completar la operación.");
  }
  return payload;
}

type Branch = { sucursal_id: number; nombre: string };
type Job = {
  trabajoPublicId: string; origen: string; referencia: string;
  ventaId: number | null; configuracionRef: string | null;
  sucursal: { id: number; nombre: string }; usoVisual: string | null;
  comportamientoAbasto: string; estadoReceta: string; estadoPago: string;
  estadoCosto: string; estadoProduccion: string; precioVenta: string;
  costoLaboratorioEstimado: string | null; estimacionCostoCompleta: boolean;
  costoLaboratorioConfirmado: string | null; moneda: string; notas: string | null;
  version: number; bloqueos: string[]; accionesPermitidas: string[];
  createdAt: string; updatedAt: string;
  componentes?: Array<{ tipo: string; sku: string; nombre: string; variante: string | null; precioAjuste: string; costoEstimado: string | null; estadoFuenteCosto: string }>;
  eventos?: Array<{ tipo: string; actor: string; rol: string | null; notas: string | null; createdAt: string }>;
};

const productionLabels: Record<string, string> = {
  pendiente_requisitos: "Pendiente de requisitos", listo_para_produccion: "Listo para producción",
  enviado_laboratorio: "Enviado al laboratorio", en_fabricacion: "En fabricación",
  recibido: "Recibido", entregado: "Entregado", cancelado: "Cancelado",
};
const actionLabels: Record<string, string> = {
  listo_para_produccion: "Marcar listo", enviado_laboratorio: "Enviar al laboratorio",
  en_fabricacion: "Iniciar fabricación", recibido: "Marcar recibido", entregado: "Marcar entregado",
};
const input = { padding: 9, border: "1px solid #cbd5e1", background: "#fff", color: "#1f2937" } as const;
const button = { padding: "8px 11px", border: "1px solid #9fb2c5", background: "#fff", color: "#23415f", fontWeight: 800, cursor: "pointer" } as const;

export default function OpticalOperationsAdmin({ branches, activeBranchId }: { branches: Branch[]; activeBranchId: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [detail, setDetail] = useState<Job | null>(null);
  const [filters, setFilters] = useState({ production: "", prescription: "", payment: "", origin: "", branch: String(activeBranchId), from: "", to: "", search: "", cancelled: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  async function loadJobs(branchOverride?: string) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (filters.production) params.set("estado_produccion", filters.production);
      if (filters.prescription) params.set("estado_receta", filters.prescription);
      if (filters.payment) params.set("estado_pago", filters.payment);
      if (filters.origin) params.set("origen", filters.origin);
      const selectedBranch = branchOverride ?? filters.branch;
      if (selectedBranch) params.set("sucursal_id", selectedBranch);
      if (filters.from) params.set("fecha_desde", filters.from);
      if (filters.to) params.set("fecha_hasta", filters.to);
      if (filters.search) params.set("buscar", filters.search);
      if (filters.cancelled) params.set("incluir_cancelados", "true");
      const result = await staffFetch(`/operaciones/optica/trabajos?${params}`);
      setJobs(result.trabajos || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }

  async function openJob(id: string) {
    setError("");
    try {
      const result = await staffFetch(`/operaciones/optica/trabajos/${id}`);
      setDetail(result); setCost(result.costoLaboratorioConfirmado || ""); setNotes(result.notas || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function mutate(path: string, method: "PATCH" | "POST", body: Record<string, unknown>) {
    if (!detail) return;
    setError(""); setNotice("");
    try {
      const result = await staffFetch(`/operaciones/optica/trabajos/${detail.trabajoPublicId}${path}`, { method, body: JSON.stringify(body) });
      setDetail(result); setCost(result.costoLaboratorioConfirmado || ""); setNotes(result.notas || "");
      setNotice("Cambio guardado y auditado."); await loadJobs();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  useEffect(() => {
    const branch = String(activeBranchId);
    setFilters((current) => ({ ...current, branch }));
    void loadJobs(branch);
  }, [activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div style={{ display: "grid", gap: 14 }}>
    <div>
      <h3 style={{ margin: 0, color: "#173b61" }}>Componentes ópticos — bajo pedido</h3>
      <p style={{ margin: "5px 0 0", color: "#64748b" }}>Trabajos configurados para laboratorio o producción. No son existencias de anaquel.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      <select style={input} value={filters.production} onChange={(e) => setFilters({ ...filters, production: e.target.value })}><option value="">Todos los estados</option>{Object.entries(productionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select style={input} value={filters.prescription} onChange={(e) => setFilters({ ...filters, prescription: e.target.value })}><option value="">Toda receta</option><option value="pendiente">Pendiente</option><option value="proporcionada">Proporcionada</option><option value="no_requerida">No requerida</option></select>
      <select style={input} value={filters.payment} onChange={(e) => setFilters({ ...filters, payment: e.target.value })}><option value="">Todo pago</option><option value="sin_pago">Sin pago</option><option value="anticipo">Anticipo</option><option value="pago_parcial">Pago parcial</option><option value="pagada">Pagada</option><option value="reembolsada">Reembolsada</option></select>
      <select style={input} value={filters.origin} onChange={(e) => setFilters({ ...filters, origin: e.target.value })}><option value="">Todo origen</option><option value="pedido_online">Pedido online</option><option value="venta_fisica">Venta física</option></select>
      <select style={input} value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })}><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.sucursal_id} value={branch.sucursal_id}>{branch.nombre}</option>)}</select>
      <input style={input} type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="Fecha inicial" />
      <input style={input} type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="Fecha final" />
      <input style={input} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Referencia o SKU" />
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button style={{ ...button, background: "#174ea6", color: "#fff" }} onClick={() => void loadJobs()} disabled={loading}>{loading ? "Cargando..." : "Aplicar filtros"}</button><label style={{ color: "#526579", fontSize: 13 }}><input type="checkbox" checked={filters.cancelled} onChange={(e) => setFilters({ ...filters, cancelled: e.target.checked })} /> Incluir cancelados</label></div>
    {error && <div style={{ padding: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c" }}>{error}</div>}
    {notice && <div style={{ padding: 10, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857" }}>{notice}</div>}
    <div style={{ overflowX: "auto", border: "1px solid #d8e3ef" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}><thead><tr style={{ background: "#edf4fa", color: "#40566c", textAlign: "left" }}>{["Creado", "Referencia", "Origen", "Sucursal", "Configuración", "Receta", "Pago", "Producción", "Acción"].map((label) => <th key={label} style={{ padding: 9 }}>{label}</th>)}</tr></thead><tbody>{jobs.map((job) => <tr key={job.trabajoPublicId} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 9 }}>{new Date(job.createdAt).toLocaleString("es-MX")}</td><td style={{ padding: 9 }}>{job.origen === "venta_fisica" && job.ventaId ? <><strong>Venta #{job.ventaId}</strong><small style={{ display: "block", color: "#64748b" }}>{job.configuracionRef}</small></> : <span style={{ fontFamily: "monospace" }}>{job.referencia.slice(0, 12)}…</span>}</td><td style={{ padding: 9 }}>{job.origen === "pedido_online" ? "Online" : "Venta física"}</td><td style={{ padding: 9 }}>{job.sucursal.nombre}</td><td style={{ padding: 9 }}>{job.usoVisual || "—"}</td><td style={{ padding: 9 }}>{job.estadoReceta}</td><td style={{ padding: 9 }}>{job.estadoPago}</td><td style={{ padding: 9 }}><strong>{productionLabels[job.estadoProduccion] || job.estadoProduccion}</strong>{job.bloqueos.map((item) => <div key={item} style={{ color: "#b45309", fontSize: 12 }}>{item}</div>)}</td><td style={{ padding: 9 }}><button style={button} onClick={() => void openJob(job.trabajoPublicId)}>Ver detalle</button></td></tr>)}{!loading && jobs.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>No hay trabajos con estos filtros.</td></tr>}</tbody></table></div>
    {detail && <div style={{ border: "1px solid #9fbad3", background: "#f8fbff", padding: 16, display: "grid", gap: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><h4 style={{ margin: 0, color: "#173b61" }}>Trabajo {detail.referencia}</h4><div style={{ color: "#64748b", marginTop: 3 }}>{productionLabels[detail.estadoProduccion]} · versión {detail.version}</div></div><button style={button} onClick={() => setDetail(null)}>Cerrar</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>{[["Precio de venta", `$${detail.precioVenta} ${detail.moneda}`], ["Costo lab estimado", detail.costoLaboratorioEstimado ? `$${detail.costoLaboratorioEstimado}` : "No disponible"], ["Estado del costo", detail.estadoCosto], ["Costo lab confirmado", detail.costoLaboratorioConfirmado ? `$${detail.costoLaboratorioConfirmado}` : "Pendiente"]].map(([label, value]) => <div key={label} style={{ background: "#fff", border: "1px solid #d8e3ef", padding: 10 }}><small style={{ color: "#64748b" }}>{label}</small><div style={{ fontWeight: 900, marginTop: 3 }}>{value}</div></div>)}</div>
      <div><strong>Componentes</strong>{detail.componentes?.map((item) => <div key={item.tipo} style={{ display: "grid", gridTemplateColumns: "110px 1fr 150px", gap: 8, padding: "7px 0", borderBottom: "1px solid #e2e8f0" }}><span>{item.tipo}</span><span>{item.nombre}{item.variante ? ` — ${item.variante}` : ""}<small style={{ display: "block", color: "#64748b" }}>{item.sku}</small></span><span>{item.costoEstimado ? `$${item.costoEstimado}` : "Costo pendiente"}</span></div>)}</div>
      {detail.bloqueos.length > 0 && <div style={{ padding: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" }}><strong>Bloqueos:</strong> {detail.bloqueos.join(" · ")}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{detail.accionesPermitidas.map((action) => <button key={action} style={{ ...button, background: "#0f766e", color: "#fff" }} onClick={() => void mutate("/estado", "PATCH", { estado: action, version: detail.version })}>{actionLabels[action] || action}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,.35fr) minmax(220px,1fr) auto", gap: 8, alignItems: "end" }}><label style={{ fontSize: 12, fontWeight: 800 }}>COSTO REAL DEL LABORATORIO<input style={{ ...input, width: "100%", boxSizing: "border-box", marginTop: 4 }} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></label><label style={{ fontSize: 12, fontWeight: 800 }}>NOTA DEL COSTO<input style={{ ...input, width: "100%", boxSizing: "border-box", marginTop: 4 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button style={button} onClick={() => void mutate("/costo-laboratorio", "PATCH", { costo: cost, version: detail.version, notas: notes || null })}>Confirmar costo</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}><label style={{ fontSize: 12, fontWeight: 800 }}>NOTAS OPERATIVAS<textarea style={{ ...input, width: "100%", boxSizing: "border-box", marginTop: 4, minHeight: 65 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button style={button} onClick={() => void mutate("/notas", "PATCH", { notas: notes || null, version: detail.version })}>Guardar notas</button></div>
      {detail.origen === "venta_fisica" && detail.estadoProduccion !== "cancelado" && <div style={{ padding: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }}>Cancela desde la venta #{detail.ventaId} para conservar pagos, inventario y auditoría sincronizados.</div>}
      {detail.origen !== "venta_fisica" && detail.estadoProduccion !== "cancelado" && detail.estadoProduccion !== "entregado" && <button style={{ ...button, color: "#b91c1c", borderColor: "#fca5a5", justifySelf: "start" }} onClick={() => { const reason = window.prompt("Motivo de cancelación (obligatorio):"); if (reason) void mutate("/cancelar", "POST", { motivo: reason, version: detail.version }); }}>Cancelar trabajo</button>}
      <div><strong>Historial</strong>{detail.eventos?.map((event, index) => <div key={`${event.createdAt}-${index}`} style={{ padding: "7px 0", borderBottom: "1px solid #e2e8f0" }}><span style={{ fontWeight: 800 }}>{event.tipo}</span> · {event.actor} · {new Date(event.createdAt).toLocaleString("es-MX")}{event.notas && <div style={{ color: "#64748b" }}>{event.notas}</div>}</div>)}</div>
    </div>}
  </div>;
}
