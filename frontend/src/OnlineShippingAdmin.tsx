import { useEffect, useState, type FormEvent } from "react";

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

type RequestSummary = {
  requestId: string; method: "shipping" | "pickup"; status: string;
  contact: { fullName: string; email: string; phone: string };
  itemCount: number; expiresAt: string; createdAt: string;
};

type Option = {
  optionId: string; branchId: string; branchName: string; carrierCode: string;
  carrierName: string; serviceLevel: string; amount: string; currency: string;
  minimumDeliveryDays: number; maximumDeliveryDays: number; expiresAt: string;
};

type RequestDetail = RequestSummary & {
  address: Record<string, string | null> | null;
  options: Option[];
  eligibleBranches: Array<{ sucursal_id: number; sucursal_snapshot: { nombre: string; ciudad?: string }; elegible: boolean }>;
};

type ReservationSummary = {
  reservationId: string;
  requestId: string;
  branchName: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  releasedAt: string | null;
  lineCount: number;
  quantity: number;
  ownerType: string;
};

type Product = { producto_id: number; sku: string; nombre: string; categoria: string };

const card = { border: "1px solid #d7e0e7", background: "#fff", padding: 16 } as const;
const input = { width: "100%", padding: 9, border: "1px solid #bdcad4", background: "#fff", color: "#17212b" } as const;

export default function OnlineShippingAdmin({ isAdmin, products }: { isAdmin: boolean; products: Product[] }) {
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [configuration, setConfiguration] = useState<any>(null);
  const [view, setView] = useState<"queue" | "configuration">("queue");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState({ branchId: "", carrierCode: "dhl", otherCarrierName: "", serviceLevel: "", amount: "", minimumDeliveryDays: "1", maximumDeliveryDays: "3", zeroAuthorizationReason: "" });
  const [packageForm, setPackageForm] = useState({ active: false, packagingWeightGrams: "", paddingLengthMm: "", paddingWidthMm: "", paddingHeightMm: "", maximumWeightGrams: "", maximumLengthMm: "", maximumWidthMm: "", maximumHeightMm: "", costWeight: "0.60", speedWeight: "0.40", requestLifetimeHours: "48", quoteLifetimeHours: "24" });
  const [productForm, setProductForm] = useState({ productId: "", active: false, weightGrams: "", lengthMm: "", widthMm: "", heightMm: "", requiresIndividualPackage: false, compatibilityGroup: "general" });
  const [categoryForm, setCategoryForm] = useState({ category: "", active: false, weightGrams: "", lengthMm: "", widthMm: "", heightMm: "", requiresIndividualPackage: false, compatibilityGroup: "general" });

  async function loadRequests() {
    setLoading(true); setError("");
    try { const result = await staffFetch("/online-fulfillment/admin/v1/requests"); setRequests(result.requests || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }

  async function loadReservations() {
    try {
      const result = await staffFetch("/online-fulfillment/admin/v1/reservations");
      setReservations(result.reservations || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function releaseExpiredReservations() {
    setError(""); setNotice("");
    try {
      const result = await staffFetch("/online-fulfillment/admin/v1/reservations/release-expired", { method: "POST" });
      setNotice(`Reservas vencidas liberadas: ${result.releasedCount || 0}.`);
      await loadReservations();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function loadDetail(requestId: string) {
    setError("");
    try {
      const result = await staffFetch(`/online-fulfillment/admin/v1/requests/${requestId}`);
      setDetail(result);
      const first = result.eligibleBranches?.find((branch: any) => branch.elegible);
      setQuote((current) => ({ ...current, branchId: first ? String(first.sucursal_id) : "" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function loadConfiguration() {
    setError("");
    try {
      const result = await staffFetch("/online-fulfillment/admin/v1/configuration");
      setConfiguration(result);
      const p = result.packaging;
      setPackageForm({
        active: Boolean(p.activa), packagingWeightGrams: p.peso_empaque_gramos ?? "",
        paddingLengthMm: p.margen_largo_mm ?? "", paddingWidthMm: p.margen_ancho_mm ?? "",
        paddingHeightMm: p.margen_alto_mm ?? "", maximumWeightGrams: p.peso_maximo_gramos ?? "",
        maximumLengthMm: p.largo_maximo_mm ?? "", maximumWidthMm: p.ancho_maximo_mm ?? "",
        maximumHeightMm: p.alto_maximo_mm ?? "", costWeight: p.costo_weight,
        speedWeight: p.speed_weight, requestLifetimeHours: p.solicitud_vigencia_horas,
        quoteLifetimeHours: p.cotizacion_vigencia_horas,
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  useEffect(() => { void loadRequests(); void loadReservations(); void loadConfiguration(); }, []);

  function selectProduct(productId: string) {
    const current = configuration?.productShipping?.find((item: any) => String(item.producto_id) === productId);
    setProductForm({
      productId,
      active: Boolean(current?.activo),
      weightGrams: current?.peso_gramos ?? "",
      lengthMm: current?.largo_mm ?? "",
      widthMm: current?.ancho_mm ?? "",
      heightMm: current?.alto_mm ?? "",
      requiresIndividualPackage: Boolean(current?.requiere_paquete_individual),
      compatibilityGroup: current?.grupo_compatibilidad || "general",
    });
  }

  function selectCategory(category: string) {
    const current = configuration?.categoryFallbacks?.find((item: any) => item.categoria === category);
    setCategoryForm({
      category,
      active: Boolean(current?.activo),
      weightGrams: current?.peso_gramos ?? "",
      lengthMm: current?.largo_mm ?? "",
      widthMm: current?.ancho_mm ?? "",
      heightMm: current?.alto_mm ?? "",
      requiresIndividualPackage: Boolean(current?.requiere_paquete_individual),
      compatibilityGroup: current?.grupo_compatibilidad || "general",
    });
  }

  async function saveQuote(event: FormEvent) {
    event.preventDefault(); if (!detail) return; setError(""); setNotice("");
    try {
      const result = await staffFetch(`/online-fulfillment/admin/v1/requests/${detail.requestId}/quotes`, {
        method: "POST", body: JSON.stringify({
          branchId: Number(quote.branchId), carrierCode: quote.carrierCode,
          otherCarrierName: quote.otherCarrierName || null, serviceLevel: quote.serviceLevel,
          amount: Number(quote.amount), minimumDeliveryDays: Number(quote.minimumDeliveryDays),
          maximumDeliveryDays: Number(quote.maximumDeliveryDays),
          zeroAuthorizationReason: quote.zeroAuthorizationReason || null,
        }),
      });
      setDetail((current) => current ? { ...current, status: result.status, options: result.options } : current);
      setNotice("Cotización guardada como un registro nuevo. Las opciones anteriores se conservaron.");
      await loadRequests();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  const nullableNumber = (value: string) => value === "" ? null : Number(value);
  async function savePackaging(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      await staffFetch("/online-fulfillment/admin/v1/configuration/packaging", { method: "PUT", body: JSON.stringify({
        active: packageForm.active, packagingWeightGrams: nullableNumber(packageForm.packagingWeightGrams),
        paddingLengthMm: nullableNumber(packageForm.paddingLengthMm), paddingWidthMm: nullableNumber(packageForm.paddingWidthMm),
        paddingHeightMm: nullableNumber(packageForm.paddingHeightMm), maximumWeightGrams: nullableNumber(packageForm.maximumWeightGrams),
        maximumLengthMm: nullableNumber(packageForm.maximumLengthMm), maximumWidthMm: nullableNumber(packageForm.maximumWidthMm),
        maximumHeightMm: nullableNumber(packageForm.maximumHeightMm), costWeight: Number(packageForm.costWeight),
        speedWeight: Number(packageForm.speedWeight), requestLifetimeHours: Number(packageForm.requestLifetimeHours),
        quoteLifetimeHours: Number(packageForm.quoteLifetimeHours),
      }) });
      setNotice("Configuración de empaque actualizada y auditada."); await loadConfiguration();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function saveMeasurements(kind: "product" | "category") {
    const source = kind === "product" ? productForm : categoryForm;
    const path = kind === "product" ? `/online-fulfillment/admin/v1/products/${productForm.productId}` : `/online-fulfillment/admin/v1/categories/${categoryForm.category}`;
    setError(""); setNotice("");
    try {
      await staffFetch(path, { method: "PUT", body: JSON.stringify({
        active: source.active, weightGrams: nullableNumber(source.weightGrams), lengthMm: nullableNumber(source.lengthMm),
        widthMm: nullableNumber(source.widthMm), heightMm: nullableNumber(source.heightMm),
        requiresIndividualPackage: source.requiresIndividualPackage, compatibilityGroup: source.compatibilityGroup,
      }) });
      setNotice(kind === "product" ? "Medidas del producto actualizadas." : "Fallback de categoría actualizado.");
      await loadConfiguration();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function toggleCarrier(carrier: any) {
    setError(""); setNotice("");
    try {
      await staffFetch(`/online-fulfillment/admin/v1/carriers/${carrier.codigo}`, {
        method: "PUT",
        body: JSON.stringify({ name: carrier.nombre, active: !carrier.activo }),
      });
      setNotice(`Transportista ${carrier.activo ? "desactivado" : "activado"}.`);
      await loadConfiguration();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  const statusLabel: Record<string, string> = { pending: "Pendiente", quoted: "Cotizada", selected: "Seleccionada", expired: "Vencida", unavailable: "No disponible", cancelled: "Cancelada" };

  return <div style={{ display: "grid", gap: 14 }}>
    <section style={{ ...card, background: "linear-gradient(120deg,#f1f7f7,#fff8ec)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, color: "#263d3b" }}>Entregas en línea</h2><p style={{ margin: "5px 0 0", color: "#62736f" }}>Cotizaciones manuales para todas las sucursales elegibles. No crea órdenes ni reserva inventario.</p></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => { setView("queue"); void loadRequests(); }} style={{ padding: "9px 13px", border: "1px solid #315d58", background: view === "queue" ? "#315d58" : "#fff", color: view === "queue" ? "#fff" : "#315d58", fontWeight: 800 }}>Solicitudes</button>{isAdmin && <button onClick={() => { setView("configuration"); void loadConfiguration(); }} style={{ padding: "9px 13px", border: "1px solid #9a5b1f", background: view === "configuration" ? "#9a5b1f" : "#fff", color: view === "configuration" ? "#fff" : "#9a5b1f", fontWeight: 800 }}>Configuración</button>}</div></div>
    </section>
    {error && <div style={{ padding: 12, background: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3" }}>{error}</div>}
    {notice && <div style={{ padding: 12, background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0" }}>{notice}</div>}
    {view === "queue" && <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 14 }}>
      <section style={card}><div style={{ display: "flex", justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>Cola manual</h3><button onClick={() => void loadRequests()} disabled={loading}>Actualizar</button></div><div style={{ display: "grid", gap: 8, marginTop: 12 }}>{requests.map((request) => <button key={request.requestId} onClick={() => void loadDetail(request.requestId)} style={{ padding: 12, textAlign: "left", border: detail?.requestId === request.requestId ? "2px solid #315d58" : "1px solid #d7e0e7", background: "#fff" }}><strong>{request.contact.fullName}</strong><div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{statusLabel[request.status] || request.status} · {request.itemCount} artículos</div><div style={{ marginTop: 3, color: "#64748b", fontSize: 11 }}>{new Date(request.createdAt).toLocaleString("es-MX")}</div></button>)}{!loading && requests.length === 0 && <p style={{ color: "#64748b" }}>No hay solicitudes.</p>}</div></section>
      <section style={card}>{!detail ? <p style={{ color: "#64748b" }}>Selecciona una solicitud para revisar todas sus sucursales elegibles.</p> : <><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><h3 style={{ margin: 0 }}>{detail.contact.fullName}</h3><p style={{ margin: "4px 0", color: "#64748b" }}>{detail.contact.email} · {detail.contact.phone}</p></div><strong>{statusLabel[detail.status] || detail.status}</strong></div>{detail.address && <div style={{ marginTop: 12, padding: 10, background: "#f8fafc" }}>{detail.address.street} {detail.address.exteriorNumber}, {detail.address.neighborhood}, CP {detail.address.postalCode}, {detail.address.city}, {detail.address.state}</div>}<h4>Sucursales que pueden surtir todo el carrito</h4><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{detail.eligibleBranches.filter((branch) => branch.elegible).map((branch) => <span key={branch.sucursal_id} style={{ padding: "6px 9px", background: "#ecfdf5", color: "#166534" }}>{branch.sucursal_snapshot.nombre}</span>)}</div>{detail.method === "shipping" && detail.status !== "selected" && <form onSubmit={saveQuote} style={{ display: "grid", gap: 9, marginTop: 16 }}><h4 style={{ margin: 0 }}>Agregar cotización</h4><select required value={quote.branchId} onChange={(e) => setQuote({ ...quote, branchId: e.target.value })} style={input}><option value="">Sucursal</option>{detail.eligibleBranches.filter((branch) => branch.elegible).map((branch) => <option key={branch.sucursal_id} value={branch.sucursal_id}>{branch.sucursal_snapshot.nombre}</option>)}</select><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><select value={quote.carrierCode} onChange={(e) => setQuote({ ...quote, carrierCode: e.target.value })} style={input}>{(configuration?.carriers || [{ codigo: "dhl", nombre: "DHL" }, { codigo: "fedex", nombre: "FedEx" }, { codigo: "estafeta", nombre: "Estafeta" }, { codigo: "other", nombre: "Otro" }]).filter((carrier: any) => carrier.activo !== false).map((carrier: any) => <option key={carrier.codigo} value={carrier.codigo}>{carrier.nombre}</option>)}</select><input required placeholder="Nivel de servicio" value={quote.serviceLevel} onChange={(e) => setQuote({ ...quote, serviceLevel: e.target.value })} style={input} /></div>{quote.carrierCode === "other" && <input required placeholder="Nombre del transportista" value={quote.otherCarrierName} onChange={(e) => setQuote({ ...quote, otherCarrierName: e.target.value })} style={input} />}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><input required type="number" min="0" step="0.01" placeholder="Costo MXN" value={quote.amount} onChange={(e) => setQuote({ ...quote, amount: e.target.value })} style={input} /><input required type="number" min="0" placeholder="Días mín." value={quote.minimumDeliveryDays} onChange={(e) => setQuote({ ...quote, minimumDeliveryDays: e.target.value })} style={input} /><input required type="number" min="0" placeholder="Días máx." value={quote.maximumDeliveryDays} onChange={(e) => setQuote({ ...quote, maximumDeliveryDays: e.target.value })} style={input} /></div>{Number(quote.amount) === 0 && isAdmin && <textarea required placeholder="Razón de autorización de envío sin costo" value={quote.zeroAuthorizationReason} onChange={(e) => setQuote({ ...quote, zeroAuthorizationReason: e.target.value })} style={input} />}<button style={{ padding: 10, border: 0, background: "#315d58", color: "#fff", fontWeight: 900 }}>Guardar opción nueva</button></form>}<h4>Opciones guardadas</h4>{detail.options.map((option) => <div key={option.optionId} style={{ padding: 10, borderTop: "1px solid #e2e8f0" }}><strong>{option.carrierName} · {option.serviceLevel}</strong><span style={{ float: "right" }}>${option.amount} MXN</span><div style={{ color: "#64748b", fontSize: 12 }}>{option.branchName} · {option.minimumDeliveryDays}-{option.maximumDeliveryDays} días</div></div>)}</>}</section>
    </div>
    <section style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><h3 style={{ margin: 0 }}>Reservas temporales B2</h3><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Solo inventario reservado; no crea órdenes, pagos ni ventas.</p></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => void loadReservations()}>Actualizar reservas</button>{isAdmin && <button onClick={() => void releaseExpiredReservations()}>Liberar vencidas</button>}</div></div><div style={{ overflowX: "auto", marginTop: 12 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ textAlign: "left", borderBottom: "1px solid #d7e0e7" }}><th style={{ padding: 8 }}>Reserva</th><th style={{ padding: 8 }}>Sucursal</th><th style={{ padding: 8 }}>Estado</th><th style={{ padding: 8 }}>Artículos</th><th style={{ padding: 8 }}>Vence</th></tr></thead><tbody>{reservations.map((reservation) => <tr key={reservation.reservationId} style={{ borderBottom: "1px solid #eef2f4" }}><td style={{ padding: 8 }}><code>{reservation.reservationId.slice(0, 8)}</code><div style={{ color: "#64748b", fontSize: 11 }}>{reservation.ownerType} · solicitud {reservation.requestId.slice(0, 8)}</div></td><td style={{ padding: 8 }}>{reservation.branchName}</td><td style={{ padding: 8, color: reservation.status === "active" ? "#166534" : "#64748b", fontWeight: 700 }}>{reservation.status}</td><td style={{ padding: 8 }}>{reservation.lineCount} líneas · {reservation.quantity} unidades</td><td style={{ padding: 8 }}>{new Date(reservation.expiresAt).toLocaleString("es-MX")}</td></tr>)}</tbody></table>{reservations.length === 0 && <p style={{ color: "#64748b" }}>No hay reservas temporales.</p>}</div></section>
    </>}
    {view === "configuration" && isAdmin && configuration && <div style={{ display: "grid", gap: 14 }}><form onSubmit={savePackaging} style={card}><h3 style={{ marginTop: 0 }}>Empaque y vigencias</h3><p style={{ color: "#64748b" }}>Activa únicamente después de capturar valores reales aprobados.</p><label><input type="checkbox" checked={packageForm.active} onChange={(e) => setPackageForm({ ...packageForm, active: e.target.checked })} /> Configuración activa</label><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 12 }}>{([['packagingWeightGrams','Peso empaque (g)'],['paddingLengthMm','Margen largo (mm)'],['paddingWidthMm','Margen ancho (mm)'],['paddingHeightMm','Margen alto (mm)'],['maximumWeightGrams','Peso máximo (g)'],['maximumLengthMm','Largo máximo (mm)'],['maximumWidthMm','Ancho máximo (mm)'],['maximumHeightMm','Alto máximo (mm)'],['costWeight','Peso costo'],['speedWeight','Peso velocidad'],['requestLifetimeHours','Vigencia solicitud (h)'],['quoteLifetimeHours','Vigencia opción (h)']] as const).map(([key,label]) => <label key={key} style={{ fontSize: 12 }}>{label}<input type="number" step={key.includes('Weight') ? '0.01' : '1'} value={packageForm[key]} onChange={(e) => setPackageForm({ ...packageForm, [key]: e.target.value })} style={input} /></label>)}</div><button style={{ marginTop: 12, padding: 10, background: "#9a5b1f", color: "#fff", border: 0, fontWeight: 900 }}>Guardar configuración</button></form><section style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18 }}><div><h3>Medidas por producto</h3><select value={productForm.productId} onChange={(e) => selectProduct(e.target.value)} style={input}><option value="">Seleccionar producto</option>{products.map((product) => <option key={product.producto_id} value={product.producto_id}>{product.sku} · {product.nombre}</option>)}</select><MeasurementFields value={productForm} onChange={setProductForm} /><button type="button" onClick={() => void saveMeasurements("product")} disabled={!productForm.productId} style={{ marginTop: 10 }}>Guardar producto</button></div><div><h3>Fallback por categoría</h3><select value={categoryForm.category} onChange={(e) => selectCategory(e.target.value)} style={input}><option value="">Seleccionar categoría</option>{configuration.categoryFallbacks.map((category: any) => <option key={category.categoria} value={category.categoria}>{category.categoria}</option>)}</select><MeasurementFields value={categoryForm} onChange={setCategoryForm} /><button type="button" onClick={() => void saveMeasurements("category")} disabled={!categoryForm.category} style={{ marginTop: 10 }}>Guardar categoría</button></div></section><section style={card}><h3>Transportistas controlados</h3><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{configuration.carriers.map((carrier: any) => <button type="button" key={carrier.codigo} onClick={() => void toggleCarrier(carrier)} style={{ padding: 8, border: "1px solid #d7e0e7", background: carrier.activo ? "#ecfdf5" : "#f8fafc", color: carrier.activo ? "#166534" : "#64748b" }}>{carrier.nombre} · {carrier.activo ? "Activo" : "Inactivo"}</button>)}</div></section></div>}
  </div>;
}

function MeasurementFields({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 10 }}><label><input type="checkbox" checked={value.active} onChange={(e) => onChange({ ...value, active: e.target.checked })} /> Activo</label><label><input type="checkbox" checked={value.requiresIndividualPackage} onChange={(e) => onChange({ ...value, requiresIndividualPackage: e.target.checked })} /> Paquete individual</label>{([['weightGrams','Peso g'],['lengthMm','Largo mm'],['widthMm','Ancho mm'],['heightMm','Alto mm']] as const).map(([key,label]) => <input key={key} type="number" min="1" placeholder={label} value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} style={input} />)}<input value={value.compatibilityGroup} onChange={(e) => onChange({ ...value, compatibilityGroup: e.target.value })} placeholder="Grupo compatible" style={{ ...input, gridColumn: "1 / -1" }} /></div>;
}
