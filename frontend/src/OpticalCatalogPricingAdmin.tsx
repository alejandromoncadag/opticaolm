import { useCallback, useEffect, useMemo, useState } from "react";


type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

type OpticalVariant = {
  variante_id: number;
  producto_id: number;
  codigo: string;
  nombre: string;
  ajuste_venta_override: string | null;
  costo_laboratorio_estimado: string | null;
  costo_confirmado: boolean;
  costo_confirmado_at: string | null;
  costo_confirmado_referencia: string | null;
  costo_vigente_desde: string | null;
  activo: boolean;
  revision: string;
};

type OpticalComponent = {
  producto_id: number;
  sku: string;
  nombre: string;
  subcategoria: "diseno" | "tratamiento";
  ajuste_venta: string;
  costo_laboratorio_estimado: string | null;
  costo_confirmado: boolean;
  costo_confirmado_at: string | null;
  costo_confirmado_referencia: string | null;
  costo_vigente_desde: string | null;
  comportamiento_abasto_default: string;
  unidad_medida: string;
  activo: boolean;
  revision: string;
  variantes: OpticalVariant[];
};

type Draft = {
  adjustment: string;
  cost: string;
  confirmed: boolean;
  reference: string;
  effectiveFrom: string;
  active: boolean;
  reason: string;
};

type Props = {
  apiFetch: ApiFetch;
  canEdit: boolean;
};


async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return String(payload?.detail || payload?.message || `Error ${response.status}`);
  } catch {
    return `Error ${response.status}`;
  }
}

function initialDraft(item: OpticalComponent | OpticalVariant): Draft {
  return {
    adjustment: "ajuste_venta" in item
      ? item.ajuste_venta
      : item.ajuste_venta_override ?? "",
    cost: item.costo_laboratorio_estimado ?? "",
    confirmed: item.costo_confirmado,
    reference: item.costo_confirmado_referencia ?? "",
    effectiveFrom: item.costo_vigente_desde ?? "",
    active: item.activo,
    reason: "",
  };
}

function moneyIsValid(value: string, nullable = false): boolean {
  if (nullable && value.trim() === "") return true;
  return /^\d+(?:\.\d{0,2})?$/.test(value.trim()) && Number(value) >= 0;
}

export default function OpticalCatalogPricingAdmin({ apiFetch, canEdit }: Props) {
  const [components, setComponents] = useState<OpticalComponent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/catalogo/optica/precios-costos");
      if (!response.ok) throw new Error(await errorMessage(response));
      const payload = await response.json();
      const next: OpticalComponent[] = payload.componentes ?? [];
      setComponents(next);
      const nextDrafts: Record<string, Draft> = {};
      next.forEach((component) => {
        nextDrafts[`p-${component.producto_id}`] = initialDraft(component);
        component.variantes.forEach((variant) => {
          nextDrafts[`v-${variant.variante_id}`] = initialDraft(variant);
        });
      });
      setDrafts(nextDrafts);
    } catch (caught: any) {
      setError(caught?.message ?? String(caught));
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => ({
    diseno: components.filter((item) => item.subcategoria === "diseno"),
    tratamiento: components.filter((item) => item.subcategoria === "tratamiento"),
  }), [components]);

  function updateDraft(key: string, patch: Partial<Draft>) {
    setDrafts((previous) => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  }

  async function saveComponent(component: OpticalComponent) {
    const key = `p-${component.producto_id}`;
    const draft = drafts[key];
    if (!draft || !moneyIsValid(draft.adjustment) || !moneyIsValid(draft.cost, true)) {
      setError("Los importes deben ser positivos y usar máximo dos decimales.");
      return;
    }
    if (draft.confirmed && draft.cost === "") {
      setError("Un costo confirmado necesita un importe estimado.");
      return;
    }
    setSaving(key);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/catalogo/optica/componentes/${component.producto_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          expected_revision: component.revision,
          ajuste_venta: Number(draft.adjustment),
          costo_laboratorio_estimado: draft.cost === "" ? null : Number(draft.cost),
          costo_confirmado: draft.confirmed,
          costo_confirmado_referencia: draft.reference.trim() || null,
          costo_vigente_desde: draft.effectiveFrom || null,
          activo: draft.active,
          motivo: draft.reason.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setSuccess(`${component.nombre} se actualizó. Los pedidos existentes conservaron sus valores.`);
      await load();
    } catch (caught: any) {
      setError(caught?.message ?? String(caught));
    } finally {
      setSaving(null);
    }
  }

  async function saveVariant(variant: OpticalVariant) {
    const key = `v-${variant.variante_id}`;
    const draft = drafts[key];
    if (!draft || !moneyIsValid(draft.adjustment, true) || !moneyIsValid(draft.cost, true)) {
      setError("Los importes deben ser positivos y usar máximo dos decimales.");
      return;
    }
    if (draft.confirmed && draft.cost === "") {
      setError("Un costo confirmado necesita un importe estimado.");
      return;
    }
    setSaving(key);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/catalogo/optica/variantes/${variant.variante_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          expected_revision: variant.revision,
          ajuste_venta_override: draft.adjustment === "" ? null : Number(draft.adjustment),
          costo_laboratorio_estimado: draft.cost === "" ? null : Number(draft.cost),
          costo_confirmado: draft.confirmed,
          costo_confirmado_referencia: draft.reference.trim() || null,
          costo_vigente_desde: draft.effectiveFrom || null,
          activo: draft.active,
          motivo: draft.reason.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setSuccess(`${variant.nombre} se actualizó. Los pedidos existentes conservaron sus valores.`);
      await load();
    } catch (caught: any) {
      setError(caught?.message ?? String(caught));
    } finally {
      setSaving(null);
    }
  }

  function editor(
    key: string,
    item: OpticalComponent | OpticalVariant,
    onSave: () => void,
    variant = false,
  ) {
    const draft = drafts[key];
    if (!draft) return null;
    const confirmedAt = item.costo_confirmado_at
      ? new Date(item.costo_confirmado_at).toLocaleString("es-MX")
      : null;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(130px, .8fr) minmax(150px, 1fr) minmax(125px, .8fr) minmax(140px, .9fr) auto", gap: 9, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#40566c" }}>
          {variant ? "AJUSTE PROPIO" : "AJUSTE DE VENTA"}
          <input
            disabled={!canEdit}
            inputMode="decimal"
            value={draft.adjustment}
            placeholder={variant ? "Heredar" : "0.00"}
            onChange={(event) => updateDraft(key, { adjustment: event.target.value })}
            style={{ padding: "8px 9px", border: "1px solid #9db8d4", background: canEdit ? "#fff" : "#f1f5f9" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#40566c" }}>
          COSTO LAB. ESTIMADO
          <input
            disabled={!canEdit}
            inputMode="decimal"
            value={draft.cost}
            placeholder="Sin estimar"
            onChange={(event) => updateDraft(key, { cost: event.target.value })}
            style={{ padding: "8px 9px", border: "1px solid #80b3aa", background: canEdit ? "#fff" : "#f1f5f9" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#40566c" }}>
          VIGENTE DESDE
          <input
            type="date"
            disabled={!canEdit || !draft.confirmed}
            value={draft.effectiveFrom}
            onChange={(event) => updateDraft(key, { effectiveFrom: event.target.value })}
            style={{ padding: "7px 8px", border: "1px solid #c4b5d9", background: canEdit ? "#fff" : "#f1f5f9" }}
          />
        </label>
        <div style={{ display: "grid", gap: 6, alignSelf: "center" }}>
          <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 850, color: "#173b61" }}>
            <input type="checkbox" disabled={!canEdit} checked={draft.confirmed} onChange={(event) => updateDraft(key, { confirmed: event.target.checked })} />
            Costo confirmado
          </label>
          <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, fontWeight: 850, color: "#173b61" }}>
            <input type="checkbox" disabled={!canEdit} checked={draft.active} onChange={(event) => updateDraft(key, { active: event.target.checked })} />
            Activo
          </label>
        </div>
        <button
          type="button"
          disabled={!canEdit || saving === key}
          onClick={onSave}
          style={{ padding: "9px 13px", border: "1px solid #0f766e", background: !canEdit || saving === key ? "#dbe4ec" : "#0f766e", color: !canEdit || saving === key ? "#64748b" : "#fff", fontWeight: 900, cursor: !canEdit || saving === key ? "not-allowed" : "pointer" }}
        >
          {canEdit ? saving === key ? "Guardando..." : "Guardar" : "Solo lectura"}
        </button>
        <label style={{ gridColumn: "1 / span 2", display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#40566c" }}>
          REFERENCIA DE CONFIRMACIÓN (OPCIONAL)
          <input disabled={!canEdit || !draft.confirmed} maxLength={250} value={draft.reference} onChange={(event) => updateDraft(key, { reference: event.target.value })} style={{ padding: "8px 9px", border: "1px solid #c4b5d9", background: canEdit ? "#fff" : "#f1f5f9" }} />
        </label>
        <label style={{ gridColumn: "3 / span 3", display: "grid", gap: 4, fontSize: 11, fontWeight: 800, color: "#40566c" }}>
          MOTIVO DEL CAMBIO (OPCIONAL)
          <input disabled={!canEdit} maxLength={500} value={draft.reason} onChange={(event) => updateDraft(key, { reason: event.target.value })} style={{ padding: "8px 9px", border: "1px solid #cbd5e1", background: canEdit ? "#fff" : "#f1f5f9" }} />
        </label>
        <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#6b7f93" }}>
          {variant && draft.adjustment === "" ? "El precio hereda el ajuste del tratamiento. " : ""}
          {draft.cost === "" ? "Costo desconocido; no se sustituirá por el costo del tratamiento. " : ""}
          {confirmedAt ? `Última confirmación: ${confirmedAt}.` : "Costo todavía no confirmado."}
        </div>
      </div>
    );
  }

  function section(title: string, items: OpticalComponent[]) {
    return (
      <section style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0, color: "#173b61" }}>{title}</h3>
        {items.map((component) => (
          <article key={component.producto_id} style={{ border: "1px solid #c9d9e8", background: "#fff", padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
              <div>
                <strong style={{ color: "#173b61" }}>{component.nombre}</strong>
                <div style={{ marginTop: 2, color: "#6b7f93", fontSize: 11 }}>{component.sku} · {component.unidad_medida.replaceAll("_", " ")}</div>
              </div>
              <span style={{ padding: "4px 8px", background: "#eef6f5", color: "#0f766e", fontSize: 11, fontWeight: 850 }}>
                {component.comportamiento_abasto_default.replaceAll("_", " ")}
              </span>
            </div>
            {editor(`p-${component.producto_id}`, component, () => void saveComponent(component))}
            {component.variantes.length > 0 && (
              <div style={{ display: "grid", gap: 8, marginTop: 12, padding: 10, background: "#f7f9fc", borderLeft: "3px solid #6d4b9c" }}>
                <strong style={{ color: "#5b3f7f", fontSize: 12 }}>VARIANTES</strong>
                {component.variantes.map((variant) => (
                  <div key={variant.variante_id} style={{ padding: 10, border: "1px solid #ddd4ea", background: "#fff" }}>
                    <div style={{ marginBottom: 9, color: "#46325f", fontWeight: 850 }}>{variant.nombre} <span style={{ color: "#8a789d", fontSize: 11 }}>({variant.codigo})</span></div>
                    {editor(`v-${variant.variante_id}`, variant, () => void saveVariant(variant), true)}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    );
  }

  if (loading) return <div style={{ padding: 16, color: "#6b7f93" }}>Cargando precios ópticos...</div>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ padding: 13, border: "1px solid #b9d7d2", background: "#f3faf8" }}>
        <strong style={{ color: "#0f5f59" }}>Precios ópticos y costos estimados</strong>
        <div style={{ marginTop: 4, color: "#526b68", fontSize: 12, lineHeight: 1.45 }}>
          Los cambios aplican solo a configuraciones futuras. Ventas, borradores y trabajos existentes conservan sus snapshots. El costo real confirmado del trabajo se registra por separado.
        </div>
        {!canEdit && <div style={{ marginTop: 7, color: "#7c5b15", fontWeight: 800, fontSize: 12 }}>Vista de contador: solo lectura.</div>}
      </div>
      {error && <div style={{ padding: 11, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b" }}>{error}</div>}
      {success && <div style={{ padding: 11, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#065f46" }}>{success}</div>}
      {section("Diseños de mica", groups.diseno)}
      {section("Tratamientos y variantes", groups.tratamiento)}
    </div>
  );
}
