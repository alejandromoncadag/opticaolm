
import { useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker.css";
import logoOlm from "./assets/optica.png";



type Paciente = {
  paciente_id: number;
  primer_nombre: string;
  segundo_nombre: string | null;
  apellido_paterno: string;
  apellido_materno: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  correo: string | null;
  calle?: string | null;
  numero?: string | null;
  colonia?: string | null;
  codigo_postal?: string | null;
  municipio?: string | null;
  estado_direccion?: string | null;
  pais?: string | null;
  como_nos_conocio?: string | null;
  ocupacion?: string | null;
  alergias?: string | null;
  fumador_tabaco?: boolean | null;
  fumador_marihuana?: boolean | null;
  consumidor_alcohol?: boolean | null;
  creado_en?: string | null;
  estado_paciente?: "nuevo" | "intermedio" | "estrella" | string | null;
};

type PacienteCreate = {
  sucursal_id?: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  apellido_paterno: string;
  apellido_materno?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  telefono?: string | null;
  correo?: string | null;
  como_nos_conocio?: string | null;
  calle?: string | null;
  numero?: string | null;
  colonia?: string | null;
  codigo_postal?: string | null;
  municipio?: string | null;
  estado_direccion?: string | null;
  pais?: string | null;
};

type Consulta = {
  consulta_id: number;
  fecha_hora: string | null;
  agenda_inicio?: string | null;
  agenda_fin?: string | null;
  tipo_consulta: string | null;
  etapa_consulta?: string | null;
  motivo_consulta?: string | null;
  doctor_primer_nombre: string | null;
  doctor_apellido_paterno: string | null;
  motivo: string | null;
  diagnostico: string | null;
  notas: string | null;
  paciente_id: number;
  paciente_nombre: string;
  estado_paciente?: "nuevo" | "intermedio" | "estrella" | string | null;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  como_nos_conocio?: string | null;
};

type ConsultaCreate = {
  paciente_id: number;
  sucursal_id?: number | null;
  tipo_consulta?: string | null;
  etapa_consulta?: string | null;
  motivo_consulta?: string | null;
  doctor_primer_nombre?: string | null;
  doctor_apellido_paterno?: string | null;
  motivo?: string | null;
  diagnostico?: string | null;
  notas?: string | null;
  agendar_en_calendario?: boolean | null;
  agenda_inicio?: string | null;
  agenda_fin?: string | null;
};

type VentaMetodoPago =
  | "efectivo"
  | "tarjeta_credito"
  | "tarjeta_debito"
  | "transferencia_spei"
  | "deposito_bancario"
  | "cheque";

type VentaFormaLiquidacion =
  | "pago_completo"
  | "adelanto_apartado"
  | "pago_mixto"
  | "meses_sin_intereses"
  | "meses_con_intereses";

type Venta = {
  venta_id: number;
  fecha_hora: string | null;
  compra: string | null;
  subtotal?: number;
  descuento_porcentaje?: number;
  descuento_motivo?: string | null;
  cupon_tipo?: string | null;
  monto_total: number;
  metodo_pago: string;
  forma_liquidacion?: VentaFormaLiquidacion;
  adelanto_aplica?: boolean;
  adelanto_monto?: number | null;
  adelanto_metodo?: VentaMetodoPago | null;
  como_nos_conocio?: string | null;
  notas: string | null;
  paciente_id: number;
  paciente_nombre: string;
  estado_paciente?: "nuevo" | "intermedio" | "estrella" | string | null;
  sucursal_id: number | null;
  sucursal_nombre?: string | null;
};

type VentaCreate = {
  paciente_id: number;
  sucursal_id?: number | null;
  compra: string;
  subtotal?: number;
  descuento_porcentaje?: number;
  descuento_motivo?: string | null;
  cupon_tipo?: string | null;
  monto_total: number;
  metodo_pago: string;
  forma_liquidacion?: VentaFormaLiquidacion;
  adelanto_aplica?: boolean;
  adelanto_monto?: number | null;
  adelanto_metodo?: VentaMetodoPago | null;
  como_nos_conocio?: string | null;
  notas?: string | null;
  productos?: Array<{
    producto_id: number;
    cantidad: number;
  }>;
};

type InventarioProducto = {
  producto_id: number;
  sucursal_id: number;
  sku: string;
  categoria: string;
  subcategoria: string | null;
  nombre: string;
  modelo: string | null;
  color: string | null;
  tipo_mica: string | null;
  descripcion: string | null;
  imagen_url: string | null;
  precio: number;
  costo_unitario: number | null;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  controla_stock: boolean;
  orden_catalogo: number;
};

type VentaCarritoItem = {
  producto_id: number;
  cantidad: number;
};

type StatsSerie = {
  dia: string;
  total: number;
};

type StatsBucket = {
  etiqueta: string;
  total: number;
};

type StatsProducto = {
  producto: string;
  total: number;
};

type StatsTopPaciente = {
  paciente_id: number;
  paciente_nombre: string;
  total_ventas: number;
  monto_total: number;
};

type StatsTopPacienteConsultas = {
  paciente_id: number;
  paciente_nombre: string;
  total_consultas: number;
};

type StatsPacientesSerie = {
  etiqueta: string;
  total: number;
};

type StatsAnualMesSerie = {
  mes: number;
  etiqueta: string;
  total: number;
};

type StatsComparativoTotalSucursal = {
  sucursal_id: number;
  sucursal_nombre: string;
  total: number;
};

type StatsComparativoSucursalSeries = {
  sucursal_id: number;
  sucursal_nombre: string;
  serie: StatsAnualMesSerie[];
};

type StatsComparativoSucursales = {
  anio: number;
  consultas_periodo_label: string;
  consultas_periodo_por_sucursal: StatsComparativoTotalSucursal[];
  ventas_por_mes_por_sucursal: StatsComparativoSucursalSeries[];
  pacientes_por_mes_por_sucursal: StatsComparativoSucursalSeries[];
};

type StatsResumen = {
  sucursal_id: number;
  periodo: {
    modo: "hoy" | "ayer" | "dia" | "semana" | "mes" | "anio" | "rango" | string;
    fecha_desde: string;
    fecha_hasta: string;
    label: string;
  };
  consultas: {
    total: number;
    por_dia: StatsSerie[];
    por_tipo: StatsBucket[];
  };
  ventas: {
    total: number;
    monto_total: number;
    por_dia: StatsSerie[];
    por_metodo_pago: StatsBucket[];
  };
  productos_top: StatsProducto[];
  top_productos_mes?: StatsProducto[];
  filtro_paciente?: string | null;
  top_pacientes_mes_actual?: {
    label: string;
    fecha_desde: string;
    fecha_hasta: string;
    rows: StatsTopPaciente[];
  };
  top_pacientes_consultas?: {
    label: string;
    fecha_desde: string;
    fecha_hasta: string;
    rows: StatsTopPacienteConsultas[];
  };
  pacientes_creados?: {
    modo: "dia" | "mes" | "rango" | string;
    label: string;
    serie: StatsPacientesSerie[];
  };
  anual_mensual?: {
    anio: number;
    ingresos_por_mes: StatsAnualMesSerie[];
    consultas_por_mes: StatsAnualMesSerie[];
    ventas_por_mes: StatsAnualMesSerie[];
  };
  comparativo_sucursales?: StatsComparativoSucursales | null;
};

type AgendaSlot = {
  inicio: string;
  fin: string;
  label: string;
};

type Sucursal = {
  sucursal_id: number;
  nombre: string;
  codigo: string | null;
  ciudad: string | null;
  estado: string | null;
  activa: boolean;
};

type AddressSelection = {
  calle: string;
  numero: string;
  colonia: string;
  codigo_postal: string;
  municipio: string;
  estado_direccion: string;
  pais: string;
};

type GoogleMapsDiagnostic = {
  phase: string;
  scriptRequestStarted: boolean;
  windowGoogleExists: boolean;
  googleMapsExists: boolean;
  googleMapsPlacesExists: boolean;
  errorMessage: string | null;
};

let googlePlacesLoader: Promise<any> | null = null;
let googleMapsBootstrapPromise: Promise<void> | null = null;

function getGoogleMapsDiagnostic(
  phase: string,
  scriptRequestStarted: boolean,
  errorMessage: string | null = null,
): GoogleMapsDiagnostic {
  const googleWindow = window as any;
  return {
    phase,
    scriptRequestStarted,
    windowGoogleExists: Boolean(googleWindow.google),
    googleMapsExists: Boolean(googleWindow.google?.maps),
    googleMapsPlacesExists: Boolean(googleWindow.google?.maps?.places),
    errorMessage,
  };
}

function loadGooglePlaces(
  apiKey: string,
  onDiagnostic: (diagnostic: GoogleMapsDiagnostic) => void,
): Promise<any> {
  const googleWindow = window as any;
  onDiagnostic(getGoogleMapsDiagnostic("Comprobando Google Maps", false));

  if (googlePlacesLoader) {
    onDiagnostic(getGoogleMapsDiagnostic("Esperando una solicitud de Google Maps existente", true));
    return googlePlacesLoader;
  }

  if (
    googleWindow.google?.maps
    && typeof googleWindow.google.maps.importLibrary !== "function"
  ) {
    document
      .querySelectorAll<HTMLScriptElement>("script[data-olm-google-maps]")
      .forEach((script) => script.remove());
    delete googleWindow.google;
  }

  const google = (googleWindow.google ||= {});
  const maps = (google.maps ||= {});

  if (typeof maps.importLibrary !== "function") {
    const requestedLibraries = new Set<string>();

    const loadScriptOnce = () => {
      if (googleMapsBootstrapPromise) return googleMapsBootstrapPromise;

      googleMapsBootstrapPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        const params = new URLSearchParams();

        params.set("key", apiKey);
        params.set("v", "weekly");
        params.set("libraries", [...requestedLibraries].join(","));
        params.set("language", "es");
        params.set("region", "MX");
        params.set("callback", "google.maps.__ib__");

        maps.__ib__ = resolve;
        script.async = true;
        script.dataset.olmGoogleMaps = "dynamic";
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
        script.onerror = () => {
          const error = new Error("La solicitud del script de Google Maps falló.");
          onDiagnostic(getGoogleMapsDiagnostic("Falló la solicitud del script", true, error.message));
          reject(error);
        };

        onDiagnostic(getGoogleMapsDiagnostic("Solicitud Dynamic Library Import iniciada", true));
        document.head.appendChild(script);
      });

      return googleMapsBootstrapPromise;
    };

    maps.importLibrary = (libraryName: string, ...args: any[]) => {
      requestedLibraries.add(libraryName);
      return loadScriptOnce().then(() => maps.importLibrary(libraryName, ...args));
    };
  } else {
    onDiagnostic(getGoogleMapsDiagnostic("Dynamic Library Import ya estaba instalado", false));
  }

  googlePlacesLoader = (async () => {
    try {
      onDiagnostic(getGoogleMapsDiagnostic("Importando Places", true));
      const placesLibrary = await googleWindow.google.maps.importLibrary("places");
      onDiagnostic(getGoogleMapsDiagnostic("Places importado correctamente", true));
      return placesLibrary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onDiagnostic(getGoogleMapsDiagnostic("Falló la importación de Places", true, message));
      throw error;
    }
  })();

  return googlePlacesLoader;
}

function GoogleAddressFinder({ onSelect }: { onSelect: (address: AddressSelection) => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [, setDiagnostic] = useState<GoogleMapsDiagnostic>(() =>
    getGoogleMapsDiagnostic("Inicializando", false),
  );
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? "";

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (!apiKey) {
      setStatus("unavailable");
      setDiagnostic(getGoogleMapsDiagnostic("Clave no configurada", false, "VITE_GOOGLE_MAPS_API_KEY no está configurada."));
      return;
    }

    let disposed = false;
    let autocomplete: any = null;

    loadGooglePlaces(apiKey, setDiagnostic)
      .then(({ PlaceAutocompleteElement }) => {
        if (disposed || !mountRef.current) return;

        autocomplete = new PlaceAutocompleteElement({
          includedPrimaryTypes: ["street_address"],
          includedRegionCodes: ["mx"],
          requestedLanguage: "es",
          requestedRegion: "mx",
        });
        autocomplete.placeholder = "Empieza a escribir una dirección real...";
        autocomplete.className = "olm-google-address";
        autocomplete.addEventListener("gmp-select", async (event: any) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: ["addressComponents"] });
            const components = place.addressComponents ?? [];
            const byType = (type: string) => {
              const component = components.find((item: any) => item.types?.includes(type));
              return String(component?.longText ?? "").trim();
            };

            onSelectRef.current({
              calle: byType("route") || byType("street_address"),
              numero: byType("street_number"),
              colonia: byType("neighborhood") || byType("sublocality_level_1") || byType("sublocality"),
              codigo_postal: byType("postal_code"),
              municipio: byType("locality") || byType("administrative_area_level_2") || byType("sublocality_level_1"),
              estado_direccion: byType("administrative_area_level_1"),
              pais: byType("country"),
            });
          } catch {
            setStatus("error");
          }
        });

        mountRef.current.replaceChildren(autocomplete);
        setStatus("ready");
        setDiagnostic(getGoogleMapsDiagnostic("Autocomplete listo", true));
      })
      .catch((error) => {
        if (!disposed) {
          const message = error instanceof Error ? error.message : String(error);
          setStatus("error");
          setDiagnostic((current) => ({
            ...getGoogleMapsDiagnostic(current.phase || "Error de carga", current.scriptRequestStarted, message),
          }));
        }
      });

    return () => {
      disposed = true;
      autocomplete?.remove();
    };
  }, [apiKey]);

  return (
    <div className="olm-address-finder">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontWeight: 850, color: "#24485b" }}>Buscar dirección con Google</span>
        {status === "ready" && <span className="olm-address-status">Direcciones verificadas</span>}
      </div>
      <div ref={mountRef} />
      {status === "loading" && <div className="olm-address-help">Cargando buscador de direcciones…</div>}
      {status === "unavailable" && (
        <div className="olm-address-help">Buscador pendiente de configuración. Los campos manuales siguen disponibles.</div>
      )}
      {status === "error" && (
        <div className="olm-address-help olm-address-help-error">
          Google no pudo cargar. Puedes completar la dirección manualmente.
        </div>
      )}
      {status === "ready" && (
        <div className="olm-address-help">Selecciona una sugerencia para completar automáticamente los campos.</div>
      )}
    </div>
  );
}

type ExportCsvTipo =
  | "consultas"
  | "ventas"
  | "pacientes"
  | "historias_clinicas"
  | "historias_ml"
  | "sucursales"
  | "diccionario_columnas_fisico";


const API =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  || (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  || "https://opticaolm-production.up.railway.app";

function parseUiScale(raw: string | undefined): number {
  const fallback = 1;
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(1.25, parsed));
}

const APP_UI_SCALE = parseUiScale((import.meta.env.VITE_UI_SCALE as string | undefined)?.trim());
const HISTORIA_MODAL_SCALE: number = 1;
const FIXED_SUCURSAL_LABELS: Record<number, string> = {
  1: "EdoMex",
  2: "Playa",
};

const LOGIN_SCALE_STYLE: CSSProperties = APP_UI_SCALE === 1
  ? {}
  : {
      zoom: APP_UI_SCALE,
      width: `calc(100vw / ${APP_UI_SCALE})`,
      minHeight: `calc(100vh / ${APP_UI_SCALE})`,
    };

const MAIN_SCALE_STYLE: CSSProperties = APP_UI_SCALE === 1
  ? {}
  : {
      zoom: APP_UI_SCALE,
      width: `calc((100vw - 24px) / ${APP_UI_SCALE})`,
      minHeight: `calc((100vh - 24px) / ${APP_UI_SCALE})`,
    };

const HISTORIA_LAYOUT_SCALE_STYLE: CSSProperties = HISTORIA_MODAL_SCALE === 1
  ? {}
  : {
      transform: `scale(${HISTORIA_MODAL_SCALE})`,
      transformOrigin: "top center",
      boxSizing: "border-box",
      width: `calc(100% / ${HISTORIA_MODAL_SCALE})`,
      margin: "0 auto",
    };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toReadableNetworkError(path: string, original: unknown): Error {
  const msg = String((original as any)?.message ?? original ?? "").trim();
  const lower = msg.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return new Error(
      `No se pudo conectar con el backend (${API}${path}). Verifica deploy de Railway y recarga la página.`
    );
  }
  return original instanceof Error ? original : new Error(msg || "Error de red inesperado.");
}

async function fetchWithRetry(url: string, init: RequestInit, pathForError: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastError = e;
      if (attempt === 0) await sleep(250);
    }
  }
  throw toReadableNetworkError(pathForError, lastError);
}

  
const EXPORT_TIPOS_POR_FECHA: ExportCsvTipo[] = [
  "consultas",
  "ventas",
  "pacientes",
  "historias_clinicas",
  "historias_ml",
];

const EXPORT_TIPOS_CON_PACIENTE: ExportCsvTipo[] = [
  "consultas",
  "ventas",
  "pacientes",
  "historias_clinicas",
  "historias_ml",
];

type PhoneCountryOption = {
  iso: string;
  flag: string;
  name: string;
  dial: string;
};

const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { iso: "MX", flag: "🇲🇽", name: "Mexico", dial: "+52" },
  { iso: "AR", flag: "🇦🇷", name: "Argentina", dial: "+54" },
  { iso: "VE", flag: "🇻🇪", name: "Venezuela", dial: "+58" },
  { iso: "CO", flag: "🇨🇴", name: "Colombia", dial: "+57" },
  { iso: "PE", flag: "🇵🇪", name: "Peru", dial: "+51" },
  { iso: "CL", flag: "🇨🇱", name: "Chile", dial: "+56" },
  { iso: "EC", flag: "🇪🇨", name: "Ecuador", dial: "+593" },
  { iso: "US", flag: "🇺🇸", name: "Estados Unidos", dial: "+1" },
];

const DEFAULT_PHONE_COUNTRY = "MX";
const PHONE_LOCAL_MIN_DIGITS = 7;
const PHONE_LOCAL_MAX_DIGITS = 10;

type LoginResponse = {
  access_token: string;
  token_type: string;
};

type MeResponse = {
  username: string;
  rol: "admin" | "recepcion" | "doctor";
  sucursal_id: number | null;
};



function getToken() {
  return localStorage.getItem("token");
}

function setToken(t: string) {
  localStorage.setItem("token", t);
}

function clearToken() {
  localStorage.removeItem("token");
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const r = await fetchWithRetry(`${API}${path}`, { ...init, headers }, path);

  // si se venció o no hay login
  if (r.status === 401) {
    clearToken();
    throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
  }
  return r;
}








function TabButton({
  active,
  variant,
  children,
  onClick,
}: {
  active: boolean;
  variant: "pacientes" | "consultas" | "ventas" | "estadisticas" | "historia_clinica" | "inventario";
  children: ReactNode;
  onClick: () => void;
}) {
  const activeAccent =
    variant === "pacientes"
      ? "#16a085"
      : variant === "consultas"
        ? "#f59e0b"
        : variant === "ventas"
          ? "#3b82f6"
          : variant === "inventario"
            ? "#2563eb"
          : variant === "historia_clinica"
            ? "#0d9488"
            : "#8b5cf6";
  const icon =
    variant === "pacientes"
      ? "◇"
      : variant === "consultas"
        ? "◷"
        : variant === "ventas"
          ? "⊕"
          : variant === "inventario"
            ? "▦"
          : variant === "historia_clinica"
            ? "✦"
            : "⌁";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "11px 18px",
        borderRadius: 13,
        border: active ? "1px solid rgba(255,255,255,.16)" : "1px solid transparent",
        background: active ? "#ffffff" : "transparent",
        color: active ? "#102a43" : "#60758a",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: active ? "0 8px 24px rgba(15, 23, 42, 0.12)" : "none",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          display: "inline-grid",
          placeItems: "center",
          color: active ? "#fff" : activeAccent,
          background: active ? activeAccent : `${activeAccent}18`,
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const out: any = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

function normalizeForSearch(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildPacienteDisplayName(p: Paciente): string {
  const nombre = [p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno]
    .filter(Boolean)
    .join(" ");
  return nombre || `Paciente #${p.paciente_id}`;
}

function rankPacientesByQuery(source: Paciente[], query: string): Paciente[] {
  const q = normalizeForSearch(query);
  if (!q) return source;

  return source
    .map((p) => {
      const nombreCompleto = [p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno]
        .filter(Boolean)
        .join(" ");
      const nombre = normalizeForSearch(nombreCompleto);
      const nombreTokens = nombre.split(/\s+/).filter(Boolean);
      const id = String(p.paciente_id);
      const tel = normalizeForSearch(p.telefono ?? "");
      const correo = normalizeForSearch(p.correo ?? "");

      let score = 99;
      if (id === q) score = 0;
      else if (nombreTokens.some((tok) => tok.startsWith(q))) score = 1;
      else if (nombre.startsWith(q)) score = 2;
      else if (tel.startsWith(q) || correo.startsWith(q)) score = 3;
      else if (nombre.includes(q)) score = 4;
      else if (id.includes(q) || tel.includes(q) || correo.includes(q)) score = 5;

      return { p, score, nombre };
    })
    .filter((row) => row.score < 99)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.nombre.localeCompare(b.nombre, "es");
    })
    .map((row) => row.p);
}

function toPacienteOptions(source: Paciente[]): Array<{ id: number; label: string }> {
  return source.map((p) => ({ id: p.paciente_id, label: buildPacienteDisplayName(p) }));
}

function formatDateYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateYYYYMMDD(value: string | null | undefined): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const [yy, mm, dd] = parts.map((x) => Number(x));
  if (!Number.isInteger(yy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return null;
  const date = new Date(yy, mm - 1, dd);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

type DateInputProProps = {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  minWidth?: number;
  style?: CSSProperties;
};

function DateInputPro({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "MM/DD/YYYY",
  minWidth,
  style,
}: DateInputProProps) {
  return (
    <div style={{ minWidth, ...style }}>
      <DatePicker
        selected={parseDateYYYYMMDD(value)}
        onChange={(date: Date | null) => onChange(date ? formatDateYYYYMMDD(date) : "")}
        dateFormat="MM/dd/yyyy"
        placeholderText={placeholder}
        className="olm-date-input"
        wrapperClassName="olm-date-input-wrapper"
        popperClassName="olm-date-popper"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        disabled={disabled}
        required={required}
      />
    </div>
  );
}

function formatDateTimePretty(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const month = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const hour24 = d.getHours();
  const hour12 = hour24 % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  const ampm = hour24 >= 12 ? "PM" : "AM";

  return `${month}/${day}/${year} ${hour12}:${minute} ${ampm}`;
}

function formatDateTimeHistoria(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const day = d.getDate();
  const month = meses[d.getMonth()];
  const year = d.getFullYear();
  const hour24 = d.getHours();
  const hour12 = hour24 % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  const ampm = hour24 >= 12 ? "pm" : "am";
  return `${day}/${month}/${year}_${hour12}:${minute}${ampm}`;
}

function calcAge(fechaNacimiento: string | null | undefined): string {
  if (!fechaNacimiento) return "";
  const birth = new Date(fechaNacimiento);
  if (Number.isNaN(birth.getTime())) return "";

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return String(age);
}

function parseBoolSelect(v: string): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function formatMetodoPagoLabel(value: string | null | undefined): string {
  if (!value) return "";
  const labels: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta_credito: "Tarjeta de crédito",
    tarjeta_debito: "Tarjeta de débito",
    transferencia_spei: "Transferencia bancaria / SPEI",
    deposito_bancario: "Depósito bancario",
    cheque: "Cheque",
  };
  return value
    .split("|")
    .map((token) => labels[token] ?? token.replace(/_/g, " "))
    .join(" + ");
}

function formatFormaLiquidacionLabel(value: string | null | undefined): string {
  if (!value) return "";
  const labels: Record<string, string> = {
    pago_completo: "Pago completo",
    adelanto_apartado: "Adelanto / apartado",
    pago_mixto: "Pago mixto",
    meses_sin_intereses: "Meses sin intereses",
    meses_con_intereses: "Meses con intereses",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function formatComoNosConocioLabel(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim().toLowerCase();
  if (v === "linkedln" || v === "linkedin") return "LinkedIn";
  if (v === "fb" || v === "facebook") return "Facebook";
  if (v === "instagram") return "Instagram";
  if (v === "tiktok") return "TikTok";
  if (v === "google" || v === "google_maps") return "Google / Google Maps";
  if (v === "whatsapp") return "WhatsApp";
  if (v === "pagina_web") return "Página web";
  if (v === "paso_sucursal") return "Pasó por la sucursal";
  if (v === "referencia" || v === "referencia_familiar_amigo") return "Referencia de familiar o amigo";
  if (v === "cliente_anterior") return "Cliente anterior";
  if (v === "campana_evento") return "Campaña o evento";
  if (v === "publicidad_impresa") return "Publicidad impresa";
  if (v === "otro") return "Otro";
  return value;
}

function pacienteEmailErrorMessage(value: string | null | undefined): string | null {
  const email = String(value ?? "").trim();
  if (!email) return null;
  const validFormat = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
  return validFormat ? null : "Email no existe.";
}

function formatEstadoPacienteLabel(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "estrella") return "Estrella";
  if (v === "intermedio") return "Intermedio";
  return "Nuevo";
}

function estadoPacienteBadgeStyle(value: string | null | undefined) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "estrella") {
    return {
      border: "1px solid #c89c3a",
      background: "#fff5d8",
      color: "#6b4f12",
    } as const;
  }
  if (v === "intermedio") {
    return {
      border: "1px solid #63a7c9",
      background: "#e8f6ff",
      color: "#1f5875",
    } as const;
  }
  return {
    border: "1px solid #b8d3a2",
    background: "#edf7e2",
    color: "#395f1d",
  } as const;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function splitPhoneForUi(value: string | null | undefined): { countryIso: string; local: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { countryIso: DEFAULT_PHONE_COUNTRY, local: "" };

  const countriesByDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const found = countriesByDial.find((c) => raw === c.dial || raw.startsWith(`${c.dial} `) || raw.startsWith(c.dial));
  if (!found) return { countryIso: DEFAULT_PHONE_COUNTRY, local: onlyDigits(raw).slice(0, PHONE_LOCAL_MAX_DIGITS) };

  let local = onlyDigits(raw.slice(found.dial.length).trim());
  if (local.startsWith("-")) local = local.slice(1).trim();
  return { countryIso: found.iso, local: local.slice(0, PHONE_LOCAL_MAX_DIGITS) };
}

function composeInternationalPhone(countryIso: string, local: string): string {
  const localDigits = onlyDigits(local);
  if (!localDigits) return "";
  if (local.trim().startsWith("+")) return local.trim();
  const country = PHONE_COUNTRIES.find((c) => c.iso === countryIso) ?? PHONE_COUNTRIES[0];
  return `${country.dial} ${localDigits}`;
}

function formatStatsEtiqueta(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim().toLowerCase();
  if (v === "tarjeta_credito" || v === "tarjeta_debito" || v === "efectivo") {
    return formatMetodoPagoLabel(v);
  }
  return v.replace(/_/g, " ");
}

const ANTECEDENTE_OPTIONS = [
  "glaucoma",
  "miopia",
  "hipermetropia",
  "cataratas",
  "otro",
];

const DEPORTE_FRECUENCIA_OPTIONS = [
  { value: "0", label: "0 dias/semana" },
  { value: "1", label: "1 dia/semana" },
  { value: "2", label: "2 dias/semana" },
  { value: "3", label: "3 dias/semana" },
  { value: "4_5", label: "4-5 dias/semana" },
  { value: "6_7", label: "6-7 dias/semana" },
];

const SINTOMAS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ojo_seco", label: "Ojo seco" },
  { value: "ardor", label: "Ardor" },
  { value: "vision_borrosa", label: "Visión borrosa" },
  { value: "cefalea", label: "Cefalea" },
  { value: "fotofobia", label: "Fotofobia" },
  { value: "moscas_volantes", label: "Moscas volantes" },
  { value: "lagrimeo", label: "Lagrimeo" },
  { value: "cansancio_visual", label: "Cansancio visual" },
  { value: "mareos", label: "Mareos" },
  { value: "pestaneo_continuo", label: "Pestañeo continuo" },
  { value: "vista_borrosa_lejos_ambos", label: "Vista borrosa de lejos en ambos ojos" },
  { value: "vista_borrosa_cerca_ambos", label: "Vista borrosa de cerca en ambos ojos" },
  { value: "vista_borrosa_cerca_oi", label: "Vista borrosa de cerca (solo ojo izquierdo)" },
  { value: "vista_borrosa_cerca_od", label: "Vista borrosa de cerca (solo ojo derecho)" },
  { value: "vista_borrosa_lejos_oi", label: "Vista borrosa de lejos (solo ojo izquierdo)" },
  { value: "vista_borrosa_lejos_od", label: "Vista borrosa de lejos (solo ojo derecho)" },
];

const DROGAS_TIPOS_OPTIONS = ["estimulantes", "sedantes", "alucinogenos", "opioides", "otras"];
const DIABETES_TRATAMIENTO_OPTIONS = ["dieta_ejercicio", "pastillas", "insulina", "no_sabe", "otro"];
const DIABETES_TRATAMIENTO_LABELS: Record<string, string> = {
  dieta_ejercicio: "Dieta y ejercicio",
  pastillas: "Pastillas",
  insulina: "Insulina",
  no_sabe: "No sabe",
  otro: "Otro",
};
const FLOTADORES_DESTELLOS_OPTIONS = [
  { value: "ninguno", label: "Ninguno" },
  { value: "flotadores_solos", label: "Flotadores solos (moscas volantes)" },
  { value: "destellos_solos", label: "Destellos solos (flashes)" },
  { value: "flotadores_y_destellos", label: "Flotadores y destellos" },
  { value: "cortina_sombra", label: "Cortina/sombra" },
] as const;
const FLOTADORES_LATERALIDAD_OPTIONS = [
  { value: "un_ojo", label: "Un ojo" },
  { value: "ambos_ojos", label: "Ambos ojos" },
] as const;
const USO_LENTES_SOL_DIAS_SEMANA_OPTIONS = [
  { value: "0_dias", label: "0 días" },
  { value: "1_2_dias", label: "1-2 días" },
  { value: "3_4_dias", label: "3-4 días" },
  { value: "5_6_dias", label: "5-6 días" },
  { value: "7_dias", label: "7 días" },
] as const;
const TIEMPO_USO_ANTIBLUERAY_DIA_OPTIONS = [
  { value: "0", label: "0" },
  { value: "lt_30min", label: "<30 minutos" },
  { value: "30min_1h", label: "30 minutos - 1 hora" },
  { value: "2h_4h", label: "2 horas - 4 horas" },
  { value: "4h_6h", label: "4 horas - 6 horas" },
  { value: "6h_8h", label: "6 horas - 8 horas" },
  { value: "8h_plus", label: "+8 horas" },
] as const;
const DURACION_CONSUMO_UNIDAD_OPTIONS = [
  { value: "anios", label: "Años" },
  { value: "meses", label: "Meses" },
] as const;
const ESTADO_CONSUMO_OPTIONS = [
  { value: "nunca", label: "Nunca" },
  { value: "exconsumidor", label: "Ex consumidor" },
  { value: "consumidor_actual", label: "Consumidor actual" },
] as const;
const HORAS_EXTERIOR_DIA_OPTIONS = [
  { value: "0_30min", label: "0-30 min" },
  { value: "30_60min", label: "30-60 min" },
  { value: "1_2h", label: "1-2 h" },
  { value: "2_4h", label: "2-4 h" },
  { value: "4h_mas", label: "4 h o más" },
] as const;
const USO_LENTES_SOL_HORAS_DIA_OPTIONS = [
  { value: "0_min", label: "0 minutos" },
  { value: "0_60min", label: "0 a 60 minutos" },
  { value: "1_2h", label: "60 minutos a 2 horas" },
  { value: "2_4h", label: "2 a 4 horas" },
  { value: "4h_plus", label: "+4 horas" },
] as const;
const TIPO_LENTES_MANEJAR_OPTIONS = [
  { value: "sol", label: "Sol" },
  { value: "opticos", label: "Ópticos" },
] as const;
const TRATAMIENTOS_LENTES_MANEJAR_OPTIONS = [
  { value: "antirreflejantes", label: "Antirreflejantes" },
  { value: "fotocromaticos", label: "Fotocromáticos" },
  { value: "antiblueray", label: "Antiblueray" },
  { value: "progresivos", label: "Progresivos" },
  { value: "monofocal", label: "Monofocal" },
  { value: "bifocal", label: "Bifocal" },
  { value: "sin_graduacion", label: "Sin graduación" },
  { value: "polarizados", label: "Polarizados" },
  { value: "espejeados", label: "Espejeados" },
  { value: "tintados", label: "Tintados" },
] as const;
const HORAS_LECTURA_SEMANA_OPTIONS = [
  { value: "0", label: "0" },
  { value: "0_2h", label: "0-2 horas" },
  { value: "2_5h", label: "2-5 horas" },
  { value: "5_10h", label: "5-10 horas" },
  { value: "10h_plus", label: "10+ horas" },
] as const;
const NIVEL_EDUCATIVO_OPTIONS = [
  { value: "ninguno", label: "Ninguno" },
  { value: "primaria", label: "Primaria" },
  { value: "secundaria", label: "Secundaria" },
  { value: "preparatoria", label: "Preparatoria" },
  { value: "universidad", label: "Universidad" },
  { value: "posgrado", label: "Posgrado" },
] as const;
const CEFALEA_FRECUENCIA_OPTIONS = [
  { value: "nunca", label: "Nunca" },
  { value: "mensual", label: "Mensual" },
  { value: "semanal", label: "Semanal" },
  { value: "diaria", label: "Diaria" },
] as const;
const ILUMINACION_TRABAJO_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
] as const;
const SINTOMAS_AL_DESPERTAR_OPTIONS = [
  { value: "ojos_rojos", label: "Ojos rojos" },
  { value: "resequedad", label: "Resequedad" },
  { value: "dolor", label: "Dolor" },
  { value: "vision_borrosa", label: "Visión borrosa" },
  { value: "mareo", label: "Mareo" },
  { value: "ninguno", label: "Ninguno" },
  { value: "otro", label: "Otro" },
] as const;
const CONVIVE_MASCOTAS_OPTIONS = [
  { value: "perro", label: "Perro" },
  { value: "gato", label: "Gato" },
  { value: "ave", label: "Ave" },
  { value: "otro", label: "Otro" },
  { value: "ninguno", label: "Ninguno" },
] as const;
const FRECUENCIA_AMBIENTE_OPTIONS = [
  { value: "nunca", label: "Nunca" },
  { value: "a_veces", label: "A veces" },
  { value: "frecuente", label: "Frecuente" },
  { value: "diario", label: "Diario" },
] as const;
const CAFEINA_POR_DIA_OPTIONS = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2_3", label: "2-3" },
  { value: "4_5", label: "4-5" },
  { value: "6_8", label: "6-8" },
  { value: "10_plus", label: "10+" },
] as const;
const CONDUCCION_NOCTURNA_OPTIONS = [
  { value: "0", label: "0" },
  { value: "lt_1h", label: "<1h" },
  { value: "1_3h", label: "1-3h" },
  { value: "4_plus_h", label: "4+h" },
] as const;
const USO_PANTALLA_OSCURIDAD_UNIDAD_OPTIONS = [
  { value: "lt_30min", label: "0-30 minutos" },
  { value: "30min_1h", label: "30 minutos - 1 hora" },
  { value: "2h_4h", label: "2 horas - 4 horas" },
  { value: "4h_6h", label: "4 horas - 6 horas" },
  { value: "6h_plus", label: "+6 horas" },
] as const;
const DIAGNOSTICO_PRINCIPAL_OPTIONS = [
  { value: "miopia", label: "Miopía" },
  { value: "hipermetropia", label: "Hipermetropía" },
  { value: "astigmatismo", label: "Astigmatismo" },
  { value: "presbicia", label: "Presbicia" },
  { value: "ojo_seco", label: "Ojo seco" },
  { value: "conjuntivitis_alergica", label: "Conjuntivitis alérgica" },
  { value: "blefaritis_mgd", label: "Blefaritis / MGD" },
  { value: "pterigion_pinguecula", label: "Pterigión / Pinguécula" },
  { value: "catarata", label: "Catarata" },
  { value: "glaucoma", label: "Glaucoma" },
  { value: "queratocono", label: "Queratocono" },
  { value: "patologia_retiniana", label: "Patología retiniana" },
  { value: "otro", label: "Otro" },
] as const;
const DIAGNOSTICO_SECUNDARIO_OPTIONS = [
  { value: "anisometropia", label: "Anisometropía" },
  { value: "astenopia", label: "Astenopía" },
  { value: "insuficiencia_convergencia", label: "Insuficiencia de convergencia" },
  { value: "disfuncion_acomodativa", label: "Disfunción acomodativa" },
  { value: "intolerancia_lentes_contacto", label: "Intolerancia a lentes de contacto" },
  { value: "chalazion_orzuelo", label: "Chalazión / Orzuelo" },
  { value: "ojo_rojo", label: "Ojo rojo" },
  { value: "moscas_volantes", label: "Moscas volantes" },
  { value: "cefalea_asociada", label: "Cefalea asociada" },
  { value: "otro_secundario", label: "Otro secundario" },
] as const;
const CONSULTA_ETAPA_OPTIONS = [
  "primera_vez_en_clinica",
  "seguimiento",
] as const;
const CONSULTA_MOTIVO_OPTIONS = [
  "revision_visual_general",
  "cambio_actualizacion_graduacion",
  "sintomas_visuales",
  "molestia_ocular",
  "accidente_lesion_ocular",
  "lentes_contacto",
  "seguimiento_revaloracion",
  "otro",
] as const;
const CONSULTA_LABELS: Record<string, string> = {
  primera_vez_en_clinica: "Primera vez en clínica",
  seguimiento: "Seguimiento",
  revision_visual_general: "Revisión visual general",
  cambio_actualizacion_graduacion: "Cambio o actualización de graduación",
  sintomas_visuales: "Síntomas visuales",
  molestia_ocular: "Molestia ocular",
  accidente_lesion_ocular: "Accidente o lesión ocular",
  lentes_contacto: "Lentes de contacto",
  seguimiento_revaloracion: "Seguimiento o revaloración",
  otro: "Otro",
  revision_general: "Revisión general",
  graduacion_lentes: "Graduación de lentes",
  molestia: "Molestia",
};
const VENTA_COMPRA_OPTIONS = [
  "examen_de_la_vista",
  "armazon_solo",
  "micas_base",
  "micas_monofocales",
  "micas_bifocales",
  "micas_progresivas",
  "micas_sin_graduacion",
  "micas_tinte",
  "tinte_grado_1",
  "tinte_grado_2",
  "tinte_grado_3",
  "micas_solas_sin_tratamiento",
  "micas_antirreflejante",
  "micas_fotocromaticas",
  "micas_antiblueray",
  "lentes_de_contacto",
  "armazon_con_micas_sin_tratamiento",
  "armazon_con_micas_antirreflejante",
  "armazon_con_micas_fotocromaticas",
  "armazon_con_micas_antiblueray",
  "estuche_para_armazon",
  "accesorios_y_refacciones",
  "lentes_de_sol_sin_graduacion",
  "lentes_de_sol_con_graduacion",
  "soluciones_y_cuidado",
] as const;
const VENTA_COMPRA_OPTION_ALIASES: Record<string, string> = {
  armazon: "armazon_solo",
  micas: "micas_solas_sin_tratamiento",
  lentes_contacto: "lentes_de_contacto",
};

type VentaCategoria =
  | "lentes_opticos"
  | "lentes_de_sol"
  | "micas"
  | "examen_de_la_vista"
  | "lentes_de_contacto"
  | "estuche_accesorios"
  | "soluciones_y_cuidado";

const VENTA_COMPRA_LABELS: Record<string, string> = {
  examen_de_la_vista: "Examen de la vista",
  armazon_solo: "Armazón solo",
  micas_base: "Par de micas estándar",
  micas_monofocales: "Diseño monofocal",
  micas_bifocales: "Diseño bifocal",
  micas_progresivas: "Diseño progresivo",
  micas_sin_graduacion: "Micas sin graduación",
  micas_tinte: "Micas con tinte",
  tinte_grado_1: "Tinte grado 1",
  tinte_grado_2: "Tinte grado 2",
  tinte_grado_3: "Tinte grado 3",
  micas_solas_sin_tratamiento: "Micas solas sin tratamiento",
  micas_antirreflejante: "Micas antirreflejantes",
  micas_fotocromaticas: "Micas fotocromáticas",
  micas_antiblueray: "Micas antiblueray",
  lentes_de_contacto: "Lentes de contacto",
  armazon_con_micas_sin_tratamiento: "Armazón con micas sin tratamiento",
  armazon_con_micas_antirreflejante: "Armazón con micas antirreflejantes",
  armazon_con_micas_fotocromaticas: "Armazón con micas fotocromáticas",
  armazon_con_micas_antiblueray: "Armazón con micas antiblueray",
  estuche_para_armazon: "Estuche para armazón",
  accesorios_y_refacciones: "Accesorios y refacciones",
  lentes_de_sol_sin_graduacion: "Lentes de sol sin graduación",
  lentes_de_sol_con_graduacion: "Lentes de sol con graduación",
  soluciones_y_cuidado: "Soluciones y cuidado",
  otro: "Otro",
};

const VENTA_METODO_PAGO_OPTIONS: Array<{ value: VentaMetodoPago; label: string }> = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "tarjeta_debito", label: "Tarjeta de débito" },
  { value: "transferencia_spei", label: "Transferencia bancaria / SPEI" },
  { value: "deposito_bancario", label: "Depósito bancario" },
  { value: "cheque", label: "Cheque" },
];

const VENTA_FORMA_LIQUIDACION_OPTIONS: Array<{ value: VentaFormaLiquidacion; label: string }> = [
  { value: "pago_completo", label: "Pago completo" },
  { value: "adelanto_apartado", label: "Adelanto / apartado" },
  { value: "pago_mixto", label: "Pago mixto" },
  { value: "meses_sin_intereses", label: "Meses sin intereses" },
  { value: "meses_con_intereses", label: "Meses con intereses" },
];

const VENTA_DESCUENTO_MOTIVO_OPTIONS = [
  { value: "familiar", label: "Familiar" },
  { value: "cliente_referido", label: "Cliente referido" },
  { value: "promocion_especial", label: "Promoción especial" },
  { value: "convenio_empresa_escuela_otra", label: "Convenio con empresa / escuela u otra" },
  { value: "cortesia", label: "Cortesía" },
] as const;

const VENTA_CUPON_TIPO_OPTIONS = [
  { value: "cupon_online", label: "Cupón online" },
  { value: "cupon_fisico", label: "Cupón físico" },
  { value: "sin_cupon", label: "Sin cupón" },
] as const;

function formatDescuentoMotivoLabel(value: string | null | undefined): string {
  return VENTA_DESCUENTO_MOTIVO_OPTIONS.find((opcion) => opcion.value === value)?.label || "—";
}

function formatCuponTipoLabel(value: string | null | undefined): string {
  return VENTA_CUPON_TIPO_OPTIONS.find((opcion) => opcion.value === value)?.label || "—";
}

const VENTA_TINTE_COLORES: Record<string, string> = {
  Gris: "#737b86",
  Café: "#7a4d32",
  Verde: "#317a55",
  Azul: "#316cb8",
  Rosa: "#d87d9d",
  Ámbar: "#c98a21",
  Vino: "#7b2944",
  Morado: "#704c9b",
  Negro: "#20242a",
  Naranja: "#df6d24",
};

type VentaTinteGrado = "" | "grado_1" | "grado_2" | "grado_3";

const VENTA_CATEGORIAS: Array<{
  value: VentaCategoria;
  label: string;
  detail: string;
  icon: string;
}> = [
  { value: "lentes_opticos", label: "Lentes ópticos", detail: "Armazón y tipo de micas", icon: "◉" },
  { value: "lentes_de_sol", label: "Lentes de sol", detail: "Modelos reales y graduación", icon: "☀" },
  { value: "micas", label: "Micas", detail: "Diseño, tratamiento y color", icon: "◌" },
  { value: "examen_de_la_vista", label: "Examen de la vista", detail: "Servicio de revisión visual", icon: "◎" },
  { value: "lentes_de_contacto", label: "Lentes de contacto", detail: "Productos con precio", icon: "◍" },
  { value: "estuche_accesorios", label: "Accesorios", detail: "Estuches, taza y refacciones", icon: "▣" },
  { value: "soluciones_y_cuidado", label: "Soluciones y cuidado", detail: "Limpieza y mantenimiento", icon: "✦" },
];

function formatVentaCompraLabel(value: string): string {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  if (clean.toLowerCase().startsWith("otro:")) {
    return `Otro: ${clean.slice(5).trim()}`;
  }
  const canonical = canonicalVentaCompraOption(clean);
  return VENTA_COMPRA_LABELS[canonical] ?? clean.replace(/_/g, " ");
}

function inferVentaCategoria(tokens: string[]): VentaCategoria | "" {
  if (tokens.some((x) => x.startsWith("armazon_con_micas_"))) return "lentes_opticos";
  if (tokens.includes("armazon_solo")) return "lentes_opticos";
  if (tokens.some((x) => x.startsWith("micas_"))) return "micas";
  if (tokens.some((x) => x.startsWith("lentes_de_sol_"))) return "lentes_de_sol";
  if (tokens.includes("examen_de_la_vista")) return "examen_de_la_vista";
  if (tokens.includes("lentes_de_contacto")) return "lentes_de_contacto";
  if (tokens.includes("estuche_para_armazon") || tokens.includes("accesorios_y_refacciones")) return "estuche_accesorios";
  if (tokens.includes("soluciones_y_cuidado")) return "soluciones_y_cuidado";
  return "";
}

function canonicalVentaCompraOption(value: string): string {
  const clean = String(value ?? "").trim().toLowerCase();
  return VENTA_COMPRA_OPTION_ALIASES[clean] ?? clean;
}

function splitPipeTokens(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split("|")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function resolveConsultaEtapa(c: Pick<Consulta, "etapa_consulta" | "tipo_consulta">): string {
  const direct = String(c.etapa_consulta ?? "").trim().toLowerCase();
  if (CONSULTA_ETAPA_OPTIONS.includes(direct as (typeof CONSULTA_ETAPA_OPTIONS)[number])) return direct;
  const legacy = splitPipeTokens(c.tipo_consulta);
  const found = legacy.find((x) => CONSULTA_ETAPA_OPTIONS.includes(x as (typeof CONSULTA_ETAPA_OPTIONS)[number]));
  return found ?? "";
}

function resolveConsultaMotivos(c: Pick<Consulta, "motivo_consulta" | "tipo_consulta">): string[] {
  const direct = splitPipeTokens(c.motivo_consulta).filter((x) =>
    CONSULTA_MOTIVO_OPTIONS.includes(x as (typeof CONSULTA_MOTIVO_OPTIONS)[number])
  );
  if (direct.length > 0) return Array.from(new Set(direct));

  const legacy = splitPipeTokens(c.tipo_consulta).filter((x) =>
    CONSULTA_MOTIVO_OPTIONS.includes(x as (typeof CONSULTA_MOTIVO_OPTIONS)[number])
  );
  return Array.from(new Set(legacy));
}

function consultaTokensForUi(c: Pick<Consulta, "etapa_consulta" | "motivo_consulta" | "tipo_consulta">): string[] {
  const etapa = resolveConsultaEtapa(c);
  const motivos = resolveConsultaMotivos(c);
  const tokens = [etapa, ...motivos].filter(Boolean);
  if (tokens.length > 0) return Array.from(new Set(tokens));
  return splitPipeTokens(c.tipo_consulta);
}

function formatConsultaTokenLabel(token: string): string {
  const clean = String(token ?? "").trim().toLowerCase();
  if (!clean) return "";
  return CONSULTA_LABELS[clean] ?? clean.replace(/_/g, " ");
}

function splitConsultaOtroNota(value: string | null | undefined): { razon: string; notas: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return { razon: "", notas: "" };
  const match = raw.match(/^Razon \(otro\):\s*([^|]+?)(?:\s*\|\s*(.*))?$/i);
  if (!match) return { razon: "", notas: raw };
  return {
    razon: (match[1] ?? "").trim(),
    notas: (match[2] ?? "").trim(),
  };
}

function composeDoctorAtencion(
  primerNombre: string | null | undefined,
  apellidoPaterno: string | null | undefined
): string {
  return [primerNombre ?? "", apellidoPaterno ?? ""]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" ");
}

function splitDoctorAtencion(value: string | null | undefined): {
  doctor_primer_nombre: string;
  doctor_apellido_paterno: string;
} {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!clean) {
    return { doctor_primer_nombre: "", doctor_apellido_paterno: "" };
  }
  const [primer, ...rest] = clean.split(" ");
  return {
    doctor_primer_nombre: primer ?? "",
    doctor_apellido_paterno: rest.join(" "),
  };
}

function composeAntecedentesOtro(
  general: string | null | undefined,
  familiar: string | null | undefined
): string {
  const g = String(general ?? "").trim();
  const f = String(familiar ?? "").trim();
  const parts: string[] = [];
  if (g) parts.push(`General: ${g}`);
  if (f) parts.push(`Familiar: ${f}`);
  return parts.join("\n");
}

function splitAntecedentesOtro(value: string | null | undefined): {
  antecedentes_otro_general: string;
  antecedentes_otro_familiar: string;
} {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { antecedentes_otro_general: "", antecedentes_otro_familiar: "" };
  }

  const generalLines: string[] = [];
  const familiarLines: string[] = [];
  let activeSection: "general" | "familiar" | null = null;

  for (const line of raw.split(/\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    const lowered = clean.toLowerCase();
    if (lowered.startsWith("general:")) {
      activeSection = "general";
      const valuePart = clean.slice(clean.indexOf(":") + 1).trim();
      if (valuePart) generalLines.push(valuePart);
      continue;
    }
    if (lowered.startsWith("familiar:")) {
      activeSection = "familiar";
      const valuePart = clean.slice(clean.indexOf(":") + 1).trim();
      if (valuePart) familiarLines.push(valuePart);
      continue;
    }

    if (activeSection === "general") {
      generalLines.push(clean);
      continue;
    }
    if (activeSection === "familiar") {
      familiarLines.push(clean);
      continue;
    }
    generalLines.push(clean);
  }

  let general = generalLines.join("\n").trim();
  const familiar = familiarLines.join("\n").trim();

  if (!general && !familiar) {
    general = raw;
  }

  return {
    antecedentes_otro_general: general,
    antecedentes_otro_familiar: familiar,
  };
}

function splitTiempoUsoLentes(value: string | null | undefined): {
  anios: string;
} {
  const raw = String(value ?? "").trim();
  if (!raw) return { anios: "" };

  const yearsMatch = raw.match(/(\d+)\s*(?:ano|anos|año|años)/i);
  return {
    anios: yearsMatch ? yearsMatch[1] : "",
  };
}

function composeTiempoUsoLentes(anios: unknown): string {
  const yearsRaw = String(anios ?? "").trim();
  const years = yearsRaw === "" ? null : Math.max(0, Math.floor(Number(yearsRaw)));
  if (years === null || !Number.isFinite(years)) {
    return "";
  }
  return years === 1 ? "1 año" : `${years} años`;
}

function normalizeDurationValue(value: unknown): string {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return "";
  if (!/^\d+(\.\d+)?$/.test(raw)) return "";
  return raw;
}

function splitDurationWithUnit(
  value: unknown,
  defaultUnit: "anios" | "meses" = "anios",
): { valor: string; unidad: "anios" | "meses" } {
  const raw = String(value ?? "").trim();
  if (!raw) return { valor: "", unidad: defaultUnit };

  const pipeMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\|\s*(anios|meses)$/i);
  if (pipeMatch) {
    return {
      valor: normalizeDurationValue(pipeMatch[1]),
      unidad: pipeMatch[2].toLowerCase() === "meses" ? "meses" : "anios",
    };
  }

  const wordMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:a(?:n|ñ)o?s?|mes(?:es)?)$/i);
  if (wordMatch) {
    const lower = raw.toLowerCase();
    return {
      valor: normalizeDurationValue(wordMatch[1]),
      unidad: lower.includes("mes") ? "meses" : "anios",
    };
  }

  return { valor: normalizeDurationValue(raw), unidad: defaultUnit };
}

function composeDurationWithUnit(
  valor: unknown,
  unidad: unknown,
): string {
  const normalizedValue = normalizeDurationValue(valor);
  if (!normalizedValue) return "";
  const normalizedUnit = String(unidad ?? "").trim().toLowerCase() === "meses" ? "meses" : "anios";
  return `${normalizedValue}|${normalizedUnit}`;
}

function tryParseJsonObject(value: unknown): Record<string, any> | null {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    return null;
  }
  return null;
}

type LentesActualesDetalle = {
  tipo: string;
  tratamientos: string[];
  color_tinte: string;
  grado_tinte: string;
};

function parseLentesActualesDetalle(value: unknown): LentesActualesDetalle[] {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      tipo: String(item?.tipo ?? "") === "armazon" ? "opticos" : String(item?.tipo ?? ""),
      tratamientos: Array.isArray(item?.tratamientos) ? item.tratamientos.map(String) : [],
      color_tinte: String(item?.color_tinte ?? ""),
      grado_tinte: String(item?.grado_tinte ?? ""),
    }));
  }
  try {
    const parsed = JSON.parse(String(value ?? ""));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      tipo: String(item?.tipo ?? "") === "armazon" ? "opticos" : String(item?.tipo ?? ""),
      tratamientos: Array.isArray(item?.tratamientos) ? item.tratamientos.map(String) : [],
      color_tinte: String(item?.color_tinte ?? ""),
      grado_tinte: String(item?.grado_tinte ?? ""),
    }));
  } catch {
    return [];
  }
}

function normalizeLegacyNumericValue(
  value: unknown,
  mapping: Record<string, string>,
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+(\.\d+)?$/.test(raw)) return raw;
  const lowered = raw.toLowerCase();
  return mapping[lowered] ?? "";
}

function normalizeOneDecimalInput(value: string): string {
  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  const [intPartRaw, ...rest] = cleaned.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  if (rest.length === 0) return intPart;
  const decimals = rest.join("").replace(/\./g, "").slice(0, 1);
  return decimals ? `${intPart}.${decimals}` : intPart;
}

function normalizeIntegerInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(?=\d)/, "") || "0";
}

function normalizeUsoLentesSolFrecuencia(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const allowed = new Set<string>(USO_LENTES_SOL_DIAS_SEMANA_OPTIONS.map((opt) => opt.value));
  if (allowed.has(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (allowed.has(normalized)) return normalized;

  // Compatibilidad con valores legacy usados antes (rango por horas)
  const legacyMap: Record<string, string> = {
    lt_30min: "1_2_dias",
    "30min_1h": "3_4_dias",
    "2h_4h": "5_6_dias",
    "4h_6h": "7_dias",
    "6h_plus": "7_dias",
  };
  if (legacyMap[normalized]) return legacyMap[normalized];

  const num = Number(raw.replace(",", "."));
  if (!Number.isFinite(num)) return "";
  if (num <= 0) return "0_dias";
  if (num <= 2) return "1_2_dias";
  if (num <= 4) return "3_4_dias";
  if (num <= 6) return "5_6_dias";
  return "7_dias";
}

function normalizeTiempoRango6(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const allowed = new Set<string>(TIEMPO_USO_ANTIBLUERAY_DIA_OPTIONS.map((opt) => opt.value));
  if (allowed.has(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (allowed.has(normalized)) return normalized;
  const num = Number(raw.replace(",", "."));
  if (!Number.isFinite(num)) return "";
  if (num <= 0) return "0";
  if (num < 0.5) return "lt_30min";
  if (num <= 1) return "30min_1h";
  if (num <= 4) return "2h_4h";
  if (num <= 6) return "4h_6h";
  if (num <= 8) return "6h_8h";
  return "8h_plus";
}

function splitPipeList(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinPipeList(values: string[]): string {
  return values
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join("|");
}

function togglePipeValue(value: string | null | undefined, item: string, checked: boolean): string {
  const set = new Set(splitPipeList(value));
  if (checked) set.add(item);
  else set.delete(item);
  return joinPipeList(Array.from(set));
}

function splitCantidadYTexto(value: string | null | undefined): {
  cantidad: number | null;
  texto: string;
} {
  const raw = String(value ?? "").trim();
  if (!raw) return { cantidad: null, texto: "" };

  let cantidad: number | null = null;
  let texto = raw;

  let match = raw.match(/^\[(\d+)\]\s*(.*)$/s);
  if (match) {
    cantidad = Number(match[1]);
    texto = match[2] ?? "";
  } else {
    match = raw.match(/^cantidad:\s*(\d+)\s*(?:\n|$)([\s\S]*)$/i);
    if (match) {
      cantidad = Number(match[1]);
      texto = match[2] ?? "";
    }
  }

  if (cantidad !== null && (!Number.isFinite(cantidad) || cantidad < 0)) {
    cantidad = null;
  }

  return {
    cantidad,
    texto: texto.trim(),
  };
}

function composeCantidadYTexto(cantidad: number | null | undefined, texto: string | null | undefined): string {
  const txt = String(texto ?? "").trim();
  const count = typeof cantidad === "number" && Number.isFinite(cantidad) && cantidad > 0 ? Math.floor(cantidad) : null;
  if (count === null) return txt;
  return txt ? `Cantidad: ${count}\n${txt}` : `Cantidad: ${count}`;
}

function clampHistoriaCantidad(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return null;
  if (normalized > 15) return 15;
  return normalized;
}

function splitHistoriaItems(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/\n+/)
    .map((x) => x.replace(/\r/g, ""))
    .filter((x) => x !== "");
}

function joinHistoriaItems(items: string[]): string {
  return items
    .map((x) => String(x ?? ""))
    .filter((x) => x !== "")
    .join("\n");
}

function resizeHistoriaItems(items: string[], count: number): string[] {
  return Array.from({ length: count }, (_, idx) => items[idx] ?? "");
}

function splitSintomasForUi(value: string | null | undefined): {
  seleccionados: string[];
  otros: string[];
} {
  const known = new Set(SINTOMAS_OPTIONS.map((opt) => opt.value));
  const seleccionados: string[] = [];
  const otros: string[] = [];

  for (const raw of splitPipeList(value)) {
    const item = raw.trim();
    if (!item) continue;
    if (known.has(item)) {
      seleccionados.push(item);
      continue;
    }
    if (item.toLowerCase().startsWith("otro:")) {
      const otherValue = item.slice(item.indexOf(":") + 1).trim();
      if (otherValue) otros.push(otherValue);
      continue;
    }
    otros.push(item);
  }

  return {
    seleccionados: joinPipeList(seleccionados).split("|").filter(Boolean),
    otros,
  };
}

function joinSintomasForStorage(seleccionados: string[], otros: string[]): string {
  const serializedOtros = otros
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `otro:${item}`);
  return joinPipeList([...seleccionados, ...serializedOtros]);
}

type DireccionLike = {
  calle?: string | null;
  numero?: string | null;
  colonia?: string | null;
  municipio?: string | null;
  codigo_postal?: string | null;
  estado_direccion?: string | null;
  estado?: string | null;
  paciente_estado?: string | null;
  pais?: string | null;
};

function formatDireccionPaciente(p: DireccionLike | null | undefined): string {
  if (!p) return "";
  const estado = p.estado_direccion ?? p.estado ?? p.paciente_estado ?? null;
  const parts = [p.calle, p.numero, p.colonia, p.municipio, p.codigo_postal, estado, p.pais]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

function pickMostCompleteAddress(...values: Array<string | null | undefined>): string {
  const candidates = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (candidates.length === 0) return "";
  return candidates.sort((a, b) => {
    const aParts = a.split(",").map((x) => x.trim()).filter(Boolean).length;
    const bParts = b.split(",").map((x) => x.trim()).filter(Boolean).length;
    if (aParts !== bParts) return bParts - aParts;
    return b.length - a.length;
  })[0];
}

function formatDireccionHistoriaSnapshot(historia: any): string {
  return formatDireccionPaciente({
    calle: historia?.paciente_calle ?? null,
    numero: historia?.paciente_numero ?? null,
    colonia: historia?.paciente_colonia ?? null,
    municipio: historia?.paciente_municipio ?? null,
    codigo_postal: historia?.paciente_codigo_postal ?? null,
    estado_direccion: historia?.paciente_estado ?? null,
    pais: historia?.paciente_pais ?? null,
  });
}

function normalizeHistoriaForUi(data: any, fallbackDoctor: string) {
  const doctorBase = String(data?.doctor_atencion ?? fallbackDoctor ?? "").trim();
  const doctorParts = splitDoctorAtencion(doctorBase);
  const antecedentesOtroParts = splitAntecedentesOtro(data?.antecedentes_otro ?? "");
  const alergiasParts = splitCantidadYTexto(data?.alergias ?? "");
  const enfermedadesParts = splitCantidadYTexto(data?.enfermedades ?? "");
  const cirugiasParts = splitCantidadYTexto(data?.cirugias ?? "");
  const puestoLaboralParts = splitCantidadYTexto(data?.puesto_laboral ?? "");
  const medicamentosParts = splitCantidadYTexto(data?.medicamentos ?? "");
  const diagnosticoGeneralParts = splitCantidadYTexto(data?.diagnostico_general ?? "");
  const recomendacionTratamientoParts = splitCantidadYTexto(data?.recomendacion_tratamiento ?? "");
  const antecedentesOtroGeneralParts = splitCantidadYTexto(antecedentesOtroParts.antecedentes_otro_general ?? "");
  const antecedentesOcularesFamiliaresOtroParts = splitCantidadYTexto(data?.antecedentes_oculares_familiares_otro ?? "");
  const deporteTiposParts = splitCantidadYTexto(data?.deporte_tipos ?? "");
  const sintomasParts = splitSintomasForUi(data?.sintomas ?? "");
  const tiempoUsoLentesParts = splitTiempoUsoLentes(data?.tiempo_uso_lentes ?? "");
  const diagnosticoGeneralItems = splitHistoriaItems(diagnosticoGeneralParts.texto);
  const puestoLaboralItems = splitHistoriaItems(puestoLaboralParts.texto);
  const deporteTiposItems = splitHistoriaItems(deporteTiposParts.texto);
  const antecedentesOtroGeneralItems = splitHistoriaItems(antecedentesOtroGeneralParts.texto);
  const antecedentesOcularesFamiliaresOtroItems = splitHistoriaItems(antecedentesOcularesFamiliaresOtroParts.texto);
  const recomendacionTratamientoItems = splitHistoriaItems(recomendacionTratamientoParts.texto);
  const diagnosticoGeneralCantidad =
    clampHistoriaCantidad(diagnosticoGeneralParts.cantidad) ??
    (diagnosticoGeneralItems.length > 0 ? Math.min(diagnosticoGeneralItems.length, 15) : null);
  const puestoLaboralCantidad =
    clampHistoriaCantidad(puestoLaboralParts.cantidad) ??
    (puestoLaboralItems.length > 0 ? Math.min(puestoLaboralItems.length, 15) : null);
  const deporteTiposCantidad =
    clampHistoriaCantidad(deporteTiposParts.cantidad) ??
    (deporteTiposItems.length > 0 ? Math.min(deporteTiposItems.length, 15) : null);
  const antecedentesOtroGeneralCantidad =
    clampHistoriaCantidad(antecedentesOtroGeneralParts.cantidad) ??
    (antecedentesOtroGeneralItems.length > 0 ? Math.min(antecedentesOtroGeneralItems.length, 15) : null);
  const antecedentesOcularesFamiliaresOtroCantidad =
    clampHistoriaCantidad(antecedentesOcularesFamiliaresOtroParts.cantidad) ??
    (antecedentesOcularesFamiliaresOtroItems.length > 0
      ? Math.min(antecedentesOcularesFamiliaresOtroItems.length, 15)
      : null);
  const recomendacionTratamientoCantidad =
    clampHistoriaCantidad(recomendacionTratamientoParts.cantidad) ??
    (recomendacionTratamientoItems.length > 0 ? Math.min(recomendacionTratamientoItems.length, 15) : null);
  const diagnosticoGeneralTexto = joinHistoriaItems(
    resizeHistoriaItems(diagnosticoGeneralItems, diagnosticoGeneralCantidad ?? 0)
  );
  const puestoLaboralTexto = joinHistoriaItems(
    resizeHistoriaItems(puestoLaboralItems, puestoLaboralCantidad ?? 0)
  );
  const deporteTiposTexto = joinHistoriaItems(
    resizeHistoriaItems(deporteTiposItems, deporteTiposCantidad ?? 0)
  );
  const antecedentesOtroGeneralTexto = joinHistoriaItems(
    resizeHistoriaItems(antecedentesOtroGeneralItems, antecedentesOtroGeneralCantidad ?? 0)
  );
  const antecedentesOcularesFamiliaresOtroTexto = joinHistoriaItems(
    resizeHistoriaItems(antecedentesOcularesFamiliaresOtroItems, antecedentesOcularesFamiliaresOtroCantidad ?? 0)
  );
  const recomendacionTratamientoTexto = joinHistoriaItems(
    resizeHistoriaItems(recomendacionTratamientoItems, recomendacionTratamientoCantidad ?? 0)
  );
  const normalizeDiagToken = (value: string): string =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  const principalKnown = new Set<string>(DIAGNOSTICO_PRINCIPAL_OPTIONS.map((opt) => opt.value));
  const secundarioKnown = new Set<string>(DIAGNOSTICO_SECUNDARIO_OPTIONS.map((opt) => opt.value));
  const legacyDiagnosticoTokens = diagnosticoGeneralItems
    .flatMap((line) => line.split(/[|,]/))
    .map((token) => token.replace(/^principal:\s*/i, "").replace(/^secundarios?:\s*/i, "").trim())
    .filter(Boolean)
    .map((token) => normalizeDiagToken(token));
  const diagnosticoPrincipalTokensRaw = splitPipeList(data?.diagnostico_principal ?? "");
  let diagnosticoPrincipalTokens = diagnosticoPrincipalTokensRaw.filter((t) => principalKnown.has(t));
  if (diagnosticoPrincipalTokens.length === 0 && diagnosticoPrincipalTokensRaw.length > 1 && diagnosticoPrincipalTokensRaw.every((t) => t.length === 1)) {
    const compact = normalizeDiagToken(diagnosticoPrincipalTokensRaw.join(""));
    if (principalKnown.has(compact)) diagnosticoPrincipalTokens = [compact];
  }
  let diagnosticoPrincipal = joinPipeList(diagnosticoPrincipalTokens);
  let diagnosticoPrincipalOtro = String(data?.diagnostico_principal_otro ?? "").trim();
  const diagnosticosSecundariosTokensRaw = splitPipeList(data?.diagnosticos_secundarios ?? "");
  let diagnosticosSecundariosTokens = diagnosticosSecundariosTokensRaw.filter((t) => secundarioKnown.has(t));
  if (diagnosticosSecundariosTokens.length === 0 && diagnosticosSecundariosTokensRaw.length > 1 && diagnosticosSecundariosTokensRaw.every((t) => t.length === 1)) {
    const compact = normalizeDiagToken(diagnosticosSecundariosTokensRaw.join(""));
    if (secundarioKnown.has(compact)) {
      diagnosticosSecundariosTokens = [compact];
    }
  }
  let diagnosticosSecundarios = joinPipeList(diagnosticosSecundariosTokens);
  let diagnosticosSecundariosOtro = String(data?.diagnosticos_secundarios_otro ?? "").trim();
  if (!diagnosticoPrincipal && !diagnosticosSecundarios && legacyDiagnosticoTokens.length > 0) {
    const principalSet = new Set<string>();
    const secundarioSet = new Set<string>();
    const principalOtros: string[] = [];
    for (const token of legacyDiagnosticoTokens) {
      if (!token) continue;
      if (principalKnown.has(token)) {
        principalSet.add(token);
        continue;
      }
      if (secundarioKnown.has(token)) {
        secundarioSet.add(token);
        continue;
      }
      principalOtros.push(token.replace(/_/g, " "));
    }
    const principalList = Array.from(principalSet);
    diagnosticoPrincipal = joinPipeList(principalList);
    diagnosticosSecundarios = joinPipeList(Array.from(secundarioSet));
    diagnosticoPrincipalOtro = diagnosticoPrincipalOtro || principalOtros.join(", ");
  }
  if (!splitPipeList(diagnosticoPrincipal).includes("otro")) {
    diagnosticoPrincipalOtro = "";
  }
  if (!splitPipeList(diagnosticosSecundarios).includes("otro_secundario")) {
    diagnosticosSecundariosOtro = "";
  }
  const seguimientoValorRaw = String(data?.seguimiento_valor ?? "").trim();
  const seguimientoValorFecha = /^\d{4}-\d{2}-\d{2}$/.test(seguimientoValorRaw) ? seguimientoValorRaw : "";
  let diabetesEstado = String(data?.diabetes_estado ?? "").trim();
  if (!diabetesEstado) {
    const tipoDiabetes = String(data?.tipo_diabetes ?? "").trim().toLowerCase();
    if (data?.diabetes === false) diabetesEstado = "no";
    else if (tipoDiabetes.includes("tipo_1") || tipoDiabetes.includes("tipo1")) diabetesEstado = "tipo_1";
    else if (tipoDiabetes.includes("tipo_2") || tipoDiabetes.includes("tipo2")) diabetesEstado = "tipo_2";
    else if (tipoDiabetes.includes("pre")) diabetesEstado = "prediabetes";
  }
  let tabaquismoEstado = String(data?.tabaquismo_estado ?? "").trim();
  if (!tabaquismoEstado) {
    if (data?.fumador_tabaco === true) tabaquismoEstado = "fumador_actual";
    if (data?.fumador_tabaco === false) tabaquismoEstado = "nunca";
  }
  const tabaquismoAniosLegacy = normalizeLegacyNumericValue(data?.tabaquismo_anios ?? "", {
    lt_1: "0.5",
    "1_5": "3",
    "6_10": "8",
    "11_20": "15",
    "21_plus": "21",
  });
  const tabaquismoDesdeDejoLegacy = normalizeLegacyNumericValue(data?.tabaquismo_anios_desde_dejo ?? "", {
    lt_1: "0.5",
    "1_3": "2",
    "4_10": "7",
    "10_plus": "10",
  });
  const tabaquismoTiempoConsumo = splitDurationWithUnit(
    (tabaquismoAniosLegacy || data?.tabaquismo_anios) ?? "",
    "anios",
  );
  const tabaquismoTiempoDesdeDejo = splitDurationWithUnit(
    (tabaquismoDesdeDejoLegacy || data?.tabaquismo_anios_desde_dejo) ?? "",
    "anios",
  );

  const alcoholMeta = tryParseJsonObject(data?.alcohol_frecuencia ?? "");
  let alcoholEstado = String(alcoholMeta?.estado ?? "").trim().toLowerCase();
  let alcoholBebidasDia = normalizeDurationValue(alcoholMeta?.bebidas_semana ?? alcoholMeta?.bebidas_dia ?? "");
  const alcoholFrecuenciaNivel = String(alcoholMeta?.frecuencia_semana ?? "").trim();
  let alcoholTiempoValor = normalizeDurationValue(alcoholMeta?.tiempo_valor ?? "");
  let alcoholTiempoUnidad: "anios" | "meses" =
    String(alcoholMeta?.tiempo_unidad ?? "").trim().toLowerCase() === "meses" ? "meses" : "anios";
  let alcoholFrecuenciaLegacy = normalizeLegacyNumericValue(data?.alcohol_frecuencia ?? "", {
    nunca: "0",
    "1_mes_o_menos": "0.25",
    "2_4_mes": "0.75",
    "2_3_semana": "2.5",
    "4_6_semana": "5",
    diario: "7",
  });
  if (!alcoholEstado) {
    if (data?.consumidor_alcohol === true) alcoholEstado = "consumidor_actual";
    else if (data?.consumidor_alcohol === false) alcoholEstado = "nunca";
    else if (alcoholFrecuenciaLegacy && Number(alcoholFrecuenciaLegacy) > 0) alcoholEstado = "consumidor_actual";
    else alcoholEstado = "nunca";
  }
  if (!alcoholBebidasDia && alcoholFrecuenciaLegacy) alcoholBebidasDia = alcoholFrecuenciaLegacy;
  const alcoholQueTomaba = String(data?.alcohol_copas ?? "").trim();

  const marihuanaMeta = tryParseJsonObject(data?.marihuana_frecuencia ?? "");
  let marihuanaEstado = String(marihuanaMeta?.estado ?? "").trim().toLowerCase();
  let marihuanaFrecuencia = normalizeDurationValue(
    marihuanaMeta?.veces_semana ?? marihuanaMeta?.frecuencia_semana ?? "",
  );
  let marihuanaTiempoValor = normalizeDurationValue(marihuanaMeta?.tiempo_valor ?? "");
  let marihuanaTiempoUnidad: "anios" | "meses" =
    String(marihuanaMeta?.tiempo_unidad ?? "").trim().toLowerCase() === "meses" ? "meses" : "anios";
  const marihuanaFrecuenciaLegacy = normalizeLegacyNumericValue(data?.marihuana_frecuencia ?? "", {
    nunca: "0",
    "1_mes_o_menos": "0.25",
    "2_4_mes": "0.75",
    "2_3_semana": "2.5",
    "4_6_semana": "5",
    diario: "7",
  });
  if (!marihuanaEstado) {
    if (data?.fumador_marihuana === true) marihuanaEstado = "consumidor_actual";
    else if (data?.fumador_marihuana === false) marihuanaEstado = "nunca";
    else if (marihuanaFrecuenciaLegacy && Number(marihuanaFrecuenciaLegacy) > 0) marihuanaEstado = "consumidor_actual";
    else marihuanaEstado = "nunca";
  }
  if (!marihuanaFrecuencia) {
    marihuanaFrecuencia = marihuanaFrecuenciaLegacy;
  }
  if (!marihuanaFrecuencia) {
    if (data?.fumador_marihuana === true) marihuanaFrecuencia = "2.5";
    if (data?.fumador_marihuana === false) marihuanaFrecuencia = "0";
  }

  const drogasMeta = tryParseJsonObject(data?.drogas_frecuencia ?? "");
  const drogasLegacyConsumo = String(data?.drogas_consumo ?? "").trim().toLowerCase();
  let drogasConsumoEstado = String(drogasMeta?.estado ?? "").trim().toLowerCase();
  if (!drogasConsumoEstado) {
    if (drogasLegacyConsumo === "actual") drogasConsumoEstado = "consumidor_actual";
    else if (drogasLegacyConsumo === "pasado") drogasConsumoEstado = "exconsumidor";
    else if (drogasLegacyConsumo === "consumidor_actual" || drogasLegacyConsumo === "exconsumidor" || drogasLegacyConsumo === "nunca") {
      drogasConsumoEstado = drogasLegacyConsumo;
    } else {
      drogasConsumoEstado = "nunca";
    }
  }
  let drogasFrecuenciaSemana = normalizeDurationValue(
    drogasMeta?.frecuencia_semana ?? drogasMeta?.veces_semana ?? "",
  );
  if (!drogasFrecuenciaSemana) {
    drogasFrecuenciaSemana = normalizeLegacyNumericValue(data?.drogas_frecuencia ?? "", {
      nunca: "0",
      "1_mes_o_menos": "0.25",
      "2_4_mes": "0.75",
      "2_3_semana": "2.5",
      "4_6_semana": "5",
      diario: "7",
    });
  }
  const drogasTiempo = splitDurationWithUnit(drogasMeta?.tiempo ?? "", "anios");

  let deporteFrecuencia = String(data?.deporte_frecuencia ?? "").trim();
  if (!deporteFrecuencia) {
    if (data?.deportista === true) deporteFrecuencia = "2";
    if (data?.deportista === false) deporteFrecuencia = "0";
  }

  return {
    ...data,
    avsinrixoi: data?.avsinrixoi ?? data?.avsinrxoi ?? "",
    paciente_calle: data?.paciente_calle ?? "",
    paciente_numero: data?.paciente_numero ?? "",
    paciente_colonia: data?.paciente_colonia ?? "",
    paciente_codigo_postal: data?.paciente_codigo_postal ?? "",
    paciente_municipio: data?.paciente_municipio ?? "",
    paciente_estado: data?.paciente_estado ?? "",
    paciente_pais: data?.paciente_pais ?? "",
    doctor_atencion: doctorBase,
    doctor_primer_nombre: doctorParts.doctor_primer_nombre,
    doctor_apellido_paterno: doctorParts.doctor_apellido_paterno,
    puesto_laboral: puestoLaboralTexto,
    puesto_laboral_cantidad: puestoLaboralCantidad,
    subjeod: data?.subjeod ?? "",
    tabaquismo_estado: tabaquismoEstado,
    tabaquismo_intensidad: normalizeLegacyNumericValue(data?.tabaquismo_intensidad ?? "", {
      "1_2": "2",
      "3_5": "4",
      "6_10": "8",
      "11_20": "15",
      "21_plus": "21",
    }),
    tabaquismo_anios: composeDurationWithUnit(tabaquismoTiempoConsumo.valor, tabaquismoTiempoConsumo.unidad),
    tabaquismo_tiempo_consumo_valor: tabaquismoTiempoConsumo.valor,
    tabaquismo_tiempo_consumo_unidad: tabaquismoTiempoConsumo.unidad,
    tabaquismo_anios_desde_dejo: composeDurationWithUnit(tabaquismoTiempoDesdeDejo.valor, tabaquismoTiempoDesdeDejo.unidad),
    tabaquismo_tiempo_desde_dejo_valor: tabaquismoTiempoDesdeDejo.valor,
    tabaquismo_tiempo_desde_dejo_unidad: tabaquismoTiempoDesdeDejo.unidad,
    alcohol_estado: alcoholEstado,
    alcohol_bebidas_dia: alcoholBebidasDia,
    alcohol_frecuencia_nivel: alcoholFrecuenciaNivel,
    alcohol_tiempo_valor: alcoholTiempoValor,
    alcohol_tiempo_unidad: alcoholTiempoUnidad,
    alcohol_que_tomaba: alcoholQueTomaba,
    alcohol_frecuencia: String(data?.alcohol_frecuencia ?? ""),
    alcohol_copas: alcoholQueTomaba,
    marihuana_estado: marihuanaEstado,
    marihuana_frecuencia: marihuanaFrecuencia,
    marihuana_frecuencia_semana: marihuanaFrecuencia,
    marihuana_tiempo_valor: marihuanaTiempoValor,
    marihuana_tiempo_unidad: marihuanaTiempoUnidad,
    marihuana_forma: data?.marihuana_forma ?? "",
    drogas_consumo_estado: drogasConsumoEstado,
    drogas_consumo: drogasConsumoEstado,
    drogas_tipos: data?.drogas_tipos ?? "",
    drogas_frecuencia: String(data?.drogas_frecuencia ?? ""),
    drogas_frecuencia_semana: drogasFrecuenciaSemana,
    drogas_tiempo_valor: drogasTiempo.valor,
    drogas_tiempo_unidad: drogasTiempo.unidad,
    deporte_frecuencia: deporteFrecuencia,
    deporte_duracion: data?.deporte_duracion ?? "",
    deporte_horas_dia: data?.deporte_duracion ?? "",
    deporte_tipos: deporteTiposTexto,
    deporte_tipos_cantidad: deporteTiposCantidad,
    hipertension: data?.hipertension ?? null,
    medicamentos: medicamentosParts.texto,
    medicamentos_cantidad: medicamentosParts.cantidad,
    diabetes_estado: diabetesEstado,
    diabetes_control: data?.diabetes_control ?? "",
    diabetes_anios: normalizeLegacyNumericValue(data?.diabetes_anios ?? "", {
      lt_1: "0.5",
      "1_3": "2",
      "4_7": "5.5",
      "8_15": "11.5",
      "16_plus": "16",
    }),
    diabetes_tratamiento: data?.diabetes_tratamiento ?? "",
    diabetes_tratamiento_otro: data?.diabetes_tratamiento_otro ?? "",
    usa_lentes: data?.usa_lentes ?? null,
    tipo_lentes_actual: data?.tipo_lentes_actual ?? "",
    lentes_pares: parseLentesActualesDetalle(data?.lentes_actuales_detalle),
    tiempo_uso_lentes: data?.tiempo_uso_lentes ?? "",
    tiempo_uso_lentes_anios: tiempoUsoLentesParts.anios,
    lentes_contacto_horas_dia: data?.lentes_contacto_horas_dia ?? null,
    lentes_contacto_dias_semana: data?.lentes_contacto_dias_semana ?? null,
    sintomas: joinPipeList(sintomasParts.seleccionados),
    sintomas_otros: joinHistoriaItems(sintomasParts.otros),
    sintomas_otros_cantidad: sintomasParts.otros.length > 0 ? sintomasParts.otros.length : null,
    horas_pantalla_dia: normalizeLegacyNumericValue(data?.horas_pantalla_dia ?? "", {}),
    conduccion_nocturna_horas: normalizeLegacyNumericValue(data?.conduccion_nocturna_horas ?? "", {}),
    exposicion_uv: data?.exposicion_uv ?? "",
    alergias: alergiasParts.texto,
    alergias_cantidad: alergiasParts.cantidad,
    enfermedades: enfermedadesParts.texto,
    enfermedades_cantidad: enfermedadesParts.cantidad,
    cirugias: cirugiasParts.texto,
    cirugias_cantidad: cirugiasParts.cantidad,
    antecedentes_oculares_familiares: data?.antecedentes_oculares_familiares ?? "",
    antecedentes_oculares_familiares_otro: antecedentesOcularesFamiliaresOtroTexto,
    antecedentes_oculares_familiares_otro_cantidad: antecedentesOcularesFamiliaresOtroCantidad,
    diagnostico_general: diagnosticoGeneralTexto,
    diagnostico_general_cantidad: diagnosticoGeneralCantidad,
    diagnostico_principal: diagnosticoPrincipal,
    diagnostico_principal_otro: diagnosticoPrincipalOtro,
    diagnosticos_secundarios: diagnosticosSecundarios,
    diagnosticos_secundarios_otro: diagnosticosSecundariosOtro,
    recomendacion_tratamiento: recomendacionTratamientoTexto,
    recomendacion_tratamiento_cantidad: recomendacionTratamientoCantidad,
    fotofobia_escala: data?.fotofobia_escala ?? "",
    dolor_ocular_escala: data?.dolor_ocular_escala ?? "",
    cefalea_frecuencia: data?.cefalea_frecuencia ?? "",
    trabajo_cerca_horas_dia: normalizeLegacyNumericValue(data?.trabajo_cerca_horas_dia ?? "", {}),
    distancia_promedio_pantalla_cm: normalizeLegacyNumericValue(data?.distancia_promedio_pantalla_cm ?? "", {}),
    iluminacion_trabajo: data?.iluminacion_trabajo ?? "",
    flotadores_destellos: data?.flotadores_destellos ?? "",
    flotadores_lateralidad: data?.flotadores_lateralidad ?? "",
    uso_lentes_proteccion_uv: normalizeTiempoRango6(data?.uso_lentes_proteccion_uv ?? ""),
    uso_lentes_sol_frecuencia: normalizeUsoLentesSolFrecuencia(data?.uso_lentes_sol_frecuencia ?? ""),
    horas_exterior_dia: data?.horas_exterior_dia ?? "",
    uso_lentes_sol_horas_dia: data?.uso_lentes_sol_horas_dia ?? "",
    usa_lentes_manejar_dia: data?.usa_lentes_manejar_dia ?? null,
    tipo_lentes_manejar_dia: data?.tipo_lentes_manejar_dia ?? "",
    tratamientos_lentes_manejar_dia: data?.tratamientos_lentes_manejar_dia ?? "",
    usa_lentes_manejar_noche: data?.usa_lentes_manejar_noche ?? null,
    tipo_lentes_manejar_noche: data?.tipo_lentes_manejar_noche ?? "",
    tratamientos_lentes_manejar_noche: data?.tratamientos_lentes_manejar_noche ?? "",
    nivel_educativo: data?.nivel_educativo ?? "",
    horas_lectura_dia: data?.horas_lectura_dia ?? "",
    lee_libros: data?.lee_libros ?? null,
    horas_sueno_promedio: normalizeLegacyNumericValue(data?.horas_sueno_promedio ?? "", {}),
    estres_nivel: normalizeLegacyNumericValue(data?.estres_nivel ?? "", {}),
    peso_kg: normalizeOneDecimalInput(String(data?.peso_kg ?? "")),
    altura_cm: normalizeIntegerInput(String(data?.altura_cm ?? "")),
    sintomas_al_despertar: data?.sintomas_al_despertar ?? "",
    sintomas_al_despertar_otro: data?.sintomas_al_despertar_otro ?? "",
    convive_mascotas: data?.convive_mascotas ?? "",
    convive_mascotas_otro: data?.convive_mascotas_otro ?? "",
    uso_aire_acondicionado_frecuencia: data?.uso_aire_acondicionado_frecuencia ?? "",
    uso_aire_acondicionado_horas_dia: normalizeLegacyNumericValue(data?.uso_aire_acondicionado_horas_dia ?? "", {}),
    uso_calefaccion_frecuencia: data?.uso_calefaccion_frecuencia ?? "",
    uso_calefaccion_horas_dia: normalizeLegacyNumericValue(data?.uso_calefaccion_horas_dia ?? "", {}),
    uso_pantalla_en_oscuridad: data?.uso_pantalla_en_oscuridad ?? "",
    cafeina_por_dia: data?.cafeina_por_dia === "6_mas" || data?.cafeina_por_dia === "6_plus" ? "6_8" : (data?.cafeina_por_dia ?? ""),
    seguimiento_requerido: data?.seguimiento_requerido ?? null,
    seguimiento_tipo: data?.seguimiento_requerido === true ? "fecha" : "",
    seguimiento_valor: data?.seguimiento_requerido === true ? seguimientoValorFecha : "",
    antecedentes_otro: composeAntecedentesOtro(
      antecedentesOtroParts.antecedentes_otro_general,
      antecedentesOtroParts.antecedentes_otro_familiar
    ),
    antecedentes_otro_general: antecedentesOtroGeneralTexto,
    antecedentes_otro_general_cantidad: antecedentesOtroGeneralCantidad,
    antecedentes_otro_familiar: antecedentesOtroParts.antecedentes_otro_familiar,
  };
}

export default function App() {
  const [tab, setTab] = useState<"pacientes" | "consultas" | "ventas" | "estadisticas" | "historia_clinica" | "inventario">("pacientes");

  // ---- Estado de sesión y búsqueda ----
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingPacienteId, setEditingPacienteId] = useState<number | null>(null);
  const [qPaciente, setQPaciente] = useState("");
  const [loadingPacienteBusqueda, setLoadingPacienteBusqueda] = useState(false);
  const [pacientesBusqueda, setPacientesBusqueda] = useState<Paciente[] | null>(null);
  const [historiaEstadoPaciente, setHistoriaEstadoPaciente] = useState<Record<number, "loading" | "exists" | "missing">>({});
  const [qConsulta, setQConsulta] = useState("");
  const [pacienteFiltroOpen, setPacienteFiltroOpen] = useState(false);
  const [pacienteFiltroModo, setPacienteFiltroModo] = useState<"hoy" | "rango" | "mes" | "anio">("mes");
  const [pacienteFechaDesde, setPacienteFechaDesde] = useState("");
  const [pacienteFechaHasta, setPacienteFechaHasta] = useState("");
  const [pacienteMes, setPacienteMes] = useState(String(new Date().getMonth() + 1));
  const [pacienteAnio, setPacienteAnio] = useState(String(new Date().getFullYear()));
  const [pacienteFiltroLabel, setPacienteFiltroLabel] = useState("Mes actual");
  const [consultaFiltroOpen, setConsultaFiltroOpen] = useState(false);
  const [consultaFiltroModo, setConsultaFiltroModo] = useState<"hoy" | "rango" | "mes" | "anio">("hoy");
  const [consultaFechaDesde, setConsultaFechaDesde] = useState("");
  const [consultaFechaHasta, setConsultaFechaHasta] = useState("");
  const [consultaMes, setConsultaMes] = useState("");
  const [consultaAnio, setConsultaAnio] = useState(String(new Date().getFullYear()));
  const [consultaFiltroLabel, setConsultaFiltroLabel] = useState("Hoy");
  const [ventaFiltroOpen, setVentaFiltroOpen] = useState(false);
  const [ventaFiltroModo, setVentaFiltroModo] = useState<"hoy" | "rango" | "mes" | "anio">("hoy");
  const [ventaFechaDesde, setVentaFechaDesde] = useState("");
  const [ventaFechaHasta, setVentaFechaHasta] = useState("");
  const [ventaMes, setVentaMes] = useState("");
  const [ventaAnio, setVentaAnio] = useState(String(new Date().getFullYear()));
  const [ventaFiltroLabel, setVentaFiltroLabel] = useState("Hoy");
  const [qVenta, setQVenta] = useState("");
  const [statsData, setStatsData] = useState<StatsResumen | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsFiltroModo, setStatsFiltroModo] = useState<"hoy" | "ayer" | "dia" | "semana" | "mes" | "anio" | "rango">("hoy");
  const [statsFecha, setStatsFecha] = useState(formatDateYYYYMMDD(new Date()));
  const [statsFechaDesde, setStatsFechaDesde] = useState(formatDateYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [statsFechaHasta, setStatsFechaHasta] = useState(formatDateYYYYMMDD(new Date()));
  const [statsMes, setStatsMes] = useState(String(new Date().getMonth() + 1));
  const [statsAnio, setStatsAnio] = useState(String(new Date().getFullYear()));
  const [statsFiltroLabel, setStatsFiltroLabel] = useState("Hoy");
  const [statsPacientesModo, setStatsPacientesModo] = useState<"dia" | "mes" | "anio" | "rango">("mes");
  const [statsPacientesAnio, setStatsPacientesAnio] = useState(String(new Date().getFullYear()));
  const [statsPacientesMes, setStatsPacientesMes] = useState(String(new Date().getMonth() + 1));
  const [statsPacientesFecha, setStatsPacientesFecha] = useState(formatDateYYYYMMDD(new Date()));
  const [statsPacientesFechaDesde, setStatsPacientesFechaDesde] = useState(formatDateYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [statsPacientesFechaHasta, setStatsPacientesFechaHasta] = useState(formatDateYYYYMMDD(new Date()));
  const [statsSeriesAnio, setStatsSeriesAnio] = useState(String(new Date().getFullYear()));
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTiposSeleccionados, setExportTiposSeleccionados] = useState<ExportCsvTipo[]>([]);
  const [exportSucursalId, setExportSucursalId] = useState<string>("all");
  const [exportDesde, setExportDesde] = useState(formatDateYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [exportHasta, setExportHasta] = useState(formatDateYYYYMMDD(new Date()));
  const [exportPacienteTexto, setExportPacienteTexto] = useState("");
  const [exportPacienteId, setExportPacienteId] = useState<string>("");
  const [exportPacienteOpciones, setExportPacienteOpciones] = useState<Array<{ id: number; label: string }>>([]);
  const [loadingExportPaciente, setLoadingExportPaciente] = useState(false);
  const [exportPacienteFocused, setExportPacienteFocused] = useState(false);
  const [exportDelimiter, setExportDelimiter] = useState<"comma" | "semicolon">("comma");
  const [exportLoading, setExportLoading] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);





  // Historial por paciente
  const [histPacienteId, setHistPacienteId] = useState<number | null>(null);
  const [histConsultas, setHistConsultas] = useState<Consulta[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [pacientePerfil, setPacientePerfil] = useState<Paciente | null>(null);
  const [perfilConsultas, setPerfilConsultas] = useState<Consulta[]>([]);
  const [perfilVentas, setPerfilVentas] = useState<Venta[]>([]);
  const [loadingPacientePerfil, setLoadingPacientePerfil] = useState(false);
  const [selectedConsultaDetalle, setSelectedConsultaDetalle] = useState<Consulta | null>(null);
  const [selectedVentaDetalle, setSelectedVentaDetalle] = useState<Venta | null>(null);


  const [savingPaciente, setSavingPaciente] = useState(false);
  const [successPacienteMsg, setSuccessPacienteMsg] = useState<string | null>(null);
  const [savingConsulta, setSavingConsulta] = useState(false);
  const [savingVenta, setSavingVenta] = useState(false);
  const [successVentaMsg, setSuccessVentaMsg] = useState<string | null>(null);
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null);
  const [inventario, setInventario] = useState<InventarioProducto[]>([]);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [inventarioError, setInventarioError] = useState<string | null>(null);
  const [inventarioStockDraft, setInventarioStockDraft] = useState<Record<number, number>>({});
  const [inventarioPrecioDraft, setInventarioPrecioDraft] = useState<Record<number, number>>({});
  const [inventarioCostoDraft, setInventarioCostoDraft] = useState<Record<number, number>>({});
  const [savingInventarioId, setSavingInventarioId] = useState<number | null>(null);
  const [inventarioBusqueda, setInventarioBusqueda] = useState("");
  const [inventarioCategoriaFiltro, setInventarioCategoriaFiltro] = useState("todos");
  const [inventarioVista, setInventarioVista] = useState<"existencias" | "costos">("existencias");
  const [inventarioMetricaAyuda, setInventarioMetricaAyuda] = useState<"valor" | "ganancia" | null>(null);
  const [inventarioImagenAmpliada, setInventarioImagenAmpliada] = useState<InventarioProducto | null>(null);
  const [ventaCategoria, setVentaCategoria] = useState<VentaCategoria | "">("");
  const [ventaCarrito, setVentaCarrito] = useState<VentaCarritoItem[]>([]);
  const [ventaDescuentoPorcentaje, setVentaDescuentoPorcentaje] = useState(0);
  const [ventaMetodosPago, setVentaMetodosPago] = useState<VentaMetodoPago[]>(["efectivo"]);
  const [ventaLentesPaso, setVentaLentesPaso] = useState(1);
  const [ventaAgregarTinte, setVentaAgregarTinte] = useState(false);
  const [ventaMostrarAntiblue, setVentaMostrarAntiblue] = useState(false);
  const [ventaTinteGrado, setVentaTinteGrado] = useState<VentaTinteGrado>("");
  const [successConsultaMsg, setSuccessConsultaMsg] = useState<string | null>(null);
  const [successHistoriaMsg, setSuccessHistoriaMsg] = useState<string | null>(null);
  const [editingConsultaId, setEditingConsultaId] = useState<number | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActivaId, setSucursalActivaId] = useState<number>(1);

  const [historiaPacienteId, setHistoriaPacienteId] = useState<number | null>(null);
  const [historiaPacienteInfo, setHistoriaPacienteInfo] = useState<Paciente | null>(null);
  const [historiaSucursalId, setHistoriaSucursalId] = useState<number | null>(null);
  const [historiaData, setHistoriaData] = useState<any | null>(null);
  const [loadingHistoria, setLoadingHistoria] = useState(false);
  const [deletingHistoria, setDeletingHistoria] = useState(false);
  const [deletingHistoriaRowId, setDeletingHistoriaRowId] = useState<number | null>(null);
  const [historiaMissingSummary, setHistoriaMissingSummary] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = useState<"paciente" | "consulta" | "venta" | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmBusy, setDeleteConfirmBusy] = useState(false);
  const historiaSearchInputRef = useRef<HTMLInputElement | null>(null);
  const historiaOpenSeqRef = useRef(0);
  const pacienteBusquedaSeqRef = useRef(0);
  const pacienteConsultaBusquedaSeqRef = useRef(0);
  const pacienteVentaBusquedaSeqRef = useRef(0);
  const pacienteExportBusquedaSeqRef = useRef(0);







  const [formPaciente, setFormPaciente] = useState<PacienteCreate>({
    sucursal_id: 1,
    primer_nombre: "",
    segundo_nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    fecha_nacimiento: "",
    sexo: "",
    telefono: "",
    correo: "",
    como_nos_conocio: "",
    calle: "",
    numero: "",
    colonia: "",
    codigo_postal: "",
    municipio: "",
    estado_direccion: "",
    pais: "",
  });
  const [pacienteTelefonoPais, setPacienteTelefonoPais] = useState<string>(DEFAULT_PHONE_COUNTRY);
  const [pacienteTelefonoLocal, setPacienteTelefonoLocal] = useState<string>("");
  const [pacienteEmailError, setPacienteEmailError] = useState<string | null>(null);

  const [formConsulta, setFormConsulta] = useState<ConsultaCreate>({
    paciente_id: 0,
    sucursal_id: 1,
    tipo_consulta: "",
    etapa_consulta: "",
    motivo_consulta: "",
    doctor_primer_nombre: "",
    doctor_apellido_paterno: "",
    motivo: "",
    diagnostico: "",
    notas: "",
  });
  const [tipoConsultaOtro, setTipoConsultaOtro] = useState("");
  const [motivosConsultaSeleccionados, setMotivosConsultaSeleccionados] = useState<string[]>([]);
  const [agendaFecha, setAgendaFecha] = useState(formatDateYYYYMMDD(new Date()));
  const [agendaSlots, setAgendaSlots] = useState<AgendaSlot[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaTimezone, setAgendaTimezone] = useState<string>("");
  const [agendaCalendarError, setAgendaCalendarError] = useState<string>("");
  const [agendaSlotSeleccionado, setAgendaSlotSeleccionado] = useState<AgendaSlot | null>(null);
  const [qPacienteConsulta, setQPacienteConsulta] = useState("");
  const [loadingPacienteConsulta, setLoadingPacienteConsulta] = useState(false);
  const [pacientesConsultaOpciones, setPacientesConsultaOpciones] = useState<Array<{ id: number; label: string }>>([]);
  const [qPacienteVenta, setQPacienteVenta] = useState("");
  const [loadingPacienteVenta, setLoadingPacienteVenta] = useState(false);
  const [pacientesVentaOpciones, setPacientesVentaOpciones] = useState<Array<{ id: number; label: string }>>([]);
  const [ventasSeleccionadas, setVentasSeleccionadas] = useState<string[]>([]);
  const [formVenta, setFormVenta] = useState<VentaCreate>({
    paciente_id: 0,
    sucursal_id: 1,
    compra: "",
    subtotal: 0,
    descuento_porcentaje: 0,
    descuento_motivo: null,
    cupon_tipo: null,
    monto_total: 0,
    metodo_pago: "efectivo",
    forma_liquidacion: "pago_completo",
    adelanto_aplica: false,
    adelanto_monto: null,
    adelanto_metodo: null,
    como_nos_conocio: "",
    notas: "",
  });

  const pacientesOpciones = useMemo(() => {
    const ordered = [...pacientes].sort((a, b) => a.paciente_id - b.paciente_id);
    return toPacienteOptions(ordered);
  }, [pacientes]);

  useEffect(() => {
    if (!qPacienteConsulta.trim()) {
      setPacientesConsultaOpciones(pacientesOpciones);
    }
  }, [pacientesOpciones, qPacienteConsulta]);

  useEffect(() => {
    if (!qPacienteVenta.trim()) {
      setPacientesVentaOpciones(pacientesOpciones);
    }
  }, [pacientesOpciones, qPacienteVenta]);

  useEffect(() => {
    if (editingConsultaId !== null) return;
    setFormConsulta((prev) => {
      if (pacientesConsultaOpciones.length === 0) {
        return prev.paciente_id === 0 ? prev : { ...prev, paciente_id: 0 };
      }
      if (pacientesConsultaOpciones.some((op) => op.id === prev.paciente_id)) {
        return prev;
      }
      return { ...prev, paciente_id: pacientesConsultaOpciones[0].id };
    });
  }, [pacientesConsultaOpciones, editingConsultaId]);

  useEffect(() => {
    if (editingVentaId !== null) return;
    setFormVenta((prev) => {
      if (pacientesVentaOpciones.length === 0) {
        return prev.paciente_id === 0 ? prev : { ...prev, paciente_id: 0 };
      }
      if (pacientesVentaOpciones.some((op) => op.id === prev.paciente_id)) {
        return prev;
      }
      return { ...prev, paciente_id: pacientesVentaOpciones[0].id };
    });
  }, [pacientesVentaOpciones, editingVentaId]);

  const consultasFiltradas = useMemo(() => {
  const q = qConsulta.trim().toLowerCase();
  if (!q) return consultas;

  return consultas.filter((c) => {
    const doctor = [c.doctor_primer_nombre, c.doctor_apellido_paterno].filter(Boolean).join(" ");
    const texto = [
      c.consulta_id,
      c.fecha_hora,
      c.paciente_nombre,
      c.estado_paciente,
      c.tipo_consulta,
      c.etapa_consulta,
      c.motivo_consulta,
      doctor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return texto.includes(q);
  });
}, [consultas, qConsulta]);

  const ventasFiltradas = useMemo(() => {
    const q = qVenta.trim().toLowerCase();
    if (!q) return ventas;
    return ventas.filter((v) => {
      const texto = [
        v.venta_id,
        v.fecha_hora,
        v.paciente_nombre,
        v.estado_paciente,
        v.compra,
        v.monto_total,
        v.como_nos_conocio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return texto.includes(q);
    });
  }, [ventas, qVenta]);




  const pacientesFiltrados = useMemo(() => {
    const q = normalizeForSearch(qPaciente);
    if (!q) return pacientes;
    if (pacientesBusqueda !== null) {
      return pacientesBusqueda;
    }

    const merged = new Map<number, Paciente>();
    for (const p of pacientes) merged.set(p.paciente_id, p);
    const source = Array.from(merged.values());

    const ranked = source
      .map((p) => {
        const nombreCompleto = [
          p.primer_nombre,
          p.segundo_nombre,
          p.apellido_paterno,
          p.apellido_materno,
        ]
          .filter(Boolean)
          .join(" ");
        const nombre = normalizeForSearch(nombreCompleto);
        const nombreTokens = nombre.split(/\s+/).filter(Boolean);
        const id = String(p.paciente_id);
        const tel = normalizeForSearch(p.telefono ?? "");
        const correo = normalizeForSearch(p.correo ?? "");

        let score = 99;
        if (id === q) score = 0;
        else if (nombreTokens.some((tok) => tok.startsWith(q))) score = 1;
        else if (nombre.startsWith(q)) score = 2;
        else if (tel.startsWith(q) || correo.startsWith(q)) score = 3;
        else if (nombre.includes(q)) score = 4;
        else if (id.includes(q) || tel.includes(q) || correo.includes(q)) score = 5;

        return { p, score, nombre };
      })
      .filter((row) => row.score < 99)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.nombre.localeCompare(b.nombre, "es");
      });

    return ranked.map((row) => row.p);
  }, [pacientes, pacientesBusqueda, qPaciente]);




  // ---- Carga de datos principales ----
  function loadPacientes(override?: {
    modo?: "hoy" | "rango" | "mes" | "anio";
    fechaDesde?: string;
    fechaHasta?: string;
    mes?: string;
    anio?: string;
  }) {
    setError(null);

    const modo = override?.modo ?? pacienteFiltroModo;
    const fechaDesde = override?.fechaDesde ?? pacienteFechaDesde;
    const fechaHasta = override?.fechaHasta ?? pacienteFechaHasta;
    const mes = override?.mes ?? pacienteMes;
    const anio = override?.anio ?? pacienteAnio;

    const params = new URLSearchParams();
    params.set("limit", "200");
    params.set("sucursal_id", String(sucursalActivaId));

    if (modo === "rango") {
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      setPacienteFiltroLabel(`Rango: ${fechaDesde || "..."} a ${fechaHasta || "..."}`);
    } else if (modo === "mes") {
      if (anio) params.set("anio", anio);
      if (mes) params.set("mes", mes);
      setPacienteFiltroLabel(`Mes: ${mes || "?"}/${anio || "?"}`);
    } else if (modo === "anio") {
      if (anio) params.set("anio", anio);
      setPacienteFiltroLabel(`Año: ${anio || "?"}`);
    } else {
      setPacienteFiltroLabel("Hoy");
    }

    apiFetch(`/pacientes?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la lista de pacientes.");
        return r.json();
      })
      .then((data) => {
        setPacientes(data);
        setFormConsulta((prev) => {
          if (data.length === 0) return { ...prev, paciente_id: 0 };
          return { ...prev, paciente_id: data[0].paciente_id };
        });
        setFormVenta((prev) => {
          if (data.length === 0) return { ...prev, paciente_id: 0 };
          return { ...prev, paciente_id: data[0].paciente_id };
        });
      })
      .catch((e) => setError(e?.message ?? String(e)));
  }



  function loadConsultas(override?: {
    modo?: "hoy" | "rango" | "mes" | "anio";
    fechaDesde?: string;
    fechaHasta?: string;
    mes?: string;
    anio?: string;
    q?: string;
  }) {
    setError(null);

    const modo = override?.modo ?? consultaFiltroModo;
    const fechaDesde = override?.fechaDesde ?? consultaFechaDesde;
    const fechaHasta = override?.fechaHasta ?? consultaFechaHasta;
    const mes = override?.mes ?? consultaMes;
    const anio = override?.anio ?? consultaAnio;
    const q = override?.q ?? "";

    const params = new URLSearchParams();
    params.set("limit", "200");
    params.set("sucursal_id", String(sucursalActivaId));

    if (modo === "rango") {
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      setConsultaFiltroLabel(`Rango: ${fechaDesde || "..."} a ${fechaHasta || "..."}`);
    } else if (modo === "mes") {
      if (anio) params.set("anio", anio);
      if (mes) params.set("mes", mes);
      setConsultaFiltroLabel(`Mes: ${mes || "?"}/${anio || "?"}`);
    } else if (modo === "anio") {
      if (anio) params.set("anio", anio);
      setConsultaFiltroLabel(`Año: ${anio || "?"}`);
    } else {
      setConsultaFiltroLabel("Hoy");
    }

    if (q.trim()) {
      params.set("q", q.trim());
    }
    // modo "hoy": backend ya filtra por fecha actual por defecto

    apiFetch(`/consultas?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la lista de consultas.");
        return r.json();
      })
      .then(setConsultas)
      .catch((e) => setError(e?.message ?? String(e)));
  }

  function loadVentas(override?: {
    modo?: "hoy" | "rango" | "mes" | "anio";
    fechaDesde?: string;
    fechaHasta?: string;
    mes?: string;
    anio?: string;
    q?: string;
  }) {
    setError(null);

    const modo = override?.modo ?? ventaFiltroModo;
    const fechaDesde = override?.fechaDesde ?? ventaFechaDesde;
    const fechaHasta = override?.fechaHasta ?? ventaFechaHasta;
    const mes = override?.mes ?? ventaMes;
    const anio = override?.anio ?? ventaAnio;
    const q = override?.q ?? "";

    const params = new URLSearchParams();
    params.set("limit", "200");
    params.set("sucursal_id", String(sucursalActivaId));

    if (modo === "rango") {
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      setVentaFiltroLabel(`Rango: ${fechaDesde || "..."} a ${fechaHasta || "..."}`);
    } else if (modo === "mes") {
      if (anio) params.set("anio", anio);
      if (mes) params.set("mes", mes);
      setVentaFiltroLabel(`Mes: ${mes || "?"}/${anio || "?"}`);
    } else if (modo === "anio") {
      if (anio) params.set("anio", anio);
      setVentaFiltroLabel(`Año: ${anio || "?"}`);
    } else {
      setVentaFiltroLabel("Hoy");
    }

    if (q.trim()) {
      params.set("q", q.trim());
    }

    apiFetch(`/ventas?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la lista de ventas.");
        return r.json();
      })
      .then(setVentas)
      .catch((e) => setError(e?.message ?? String(e)));
  }

  async function loadInventario() {
    if (!me) return;
    setLoadingInventario(true);
    setInventarioError(null);
    try {
      const r = await apiFetch(`/inventario?sucursal_id=${sucursalActivaId}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: InventarioProducto[] = await r.json();
      setInventario(data);
      setInventarioStockDraft(
        Object.fromEntries(data.map((producto) => [producto.producto_id, Number(producto.stock || 0)]))
      );
      setInventarioPrecioDraft(
        Object.fromEntries(data.map((producto) => [producto.producto_id, Number(producto.precio || 0)]))
      );
      setInventarioCostoDraft(
        Object.fromEntries(data.map((producto) => [producto.producto_id, Number(producto.costo_unitario || 0)]))
      );
    } catch (e: any) {
      setInventario([]);
      setInventarioError(e?.message ?? String(e));
    } finally {
      setLoadingInventario(false);
    }
  }

  async function guardarStockInventario(producto: InventarioProducto) {
    const stock = Math.max(0, Math.trunc(Number(inventarioStockDraft[producto.producto_id] ?? producto.stock)));
    setSavingInventarioId(producto.producto_id);
    setInventarioError(null);
    try {
      const r = await apiFetch(
        `/inventario/${producto.producto_id}/stock?sucursal_id=${sucursalActivaId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ stock, expected_stock: producto.stock }),
        }
      );
      if (!r.ok) throw new Error(await readErrorMessage(r));
      setInventario((prev) =>
        prev.map((item) =>
          item.producto_id === producto.producto_id ? { ...item, stock } : item
        )
      );
      setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: stock }));
    } catch (e: any) {
      setInventarioError(e?.message ?? String(e));
    } finally {
      setSavingInventarioId(null);
    }
  }

  async function guardarProductoInventario(producto: InventarioProducto) {
    const stock = producto.controla_stock
      ? Math.max(0, Math.trunc(Number(inventarioStockDraft[producto.producto_id] ?? producto.stock)))
      : null;
    const precio = Math.max(0, Number(inventarioPrecioDraft[producto.producto_id] ?? producto.precio));
    const costoUnitario = Math.max(0, Number(inventarioCostoDraft[producto.producto_id] ?? producto.costo_unitario ?? 0));
    if (!Number.isFinite(precio) || !Number.isFinite(costoUnitario)) {
      setInventarioError("Precio de venta y costo unitario deben ser números válidos.");
      return;
    }
    setSavingInventarioId(producto.producto_id);
    setInventarioError(null);
    try {
      const r = await apiFetch(
        `/inventario/${producto.producto_id}?sucursal_id=${sucursalActivaId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            stock,
            expected_stock: stock === null ? null : producto.stock,
            precio,
            costo_unitario: costoUnitario,
          }),
        },
      );
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const actualizado = await r.json();
      setInventario((prev) =>
        prev.map((item) =>
          item.producto_id === producto.producto_id
            ? {
                ...item,
                stock: Number(actualizado.stock || 0),
                precio: Number(actualizado.precio || 0),
                costo_unitario: Number(actualizado.costo_unitario || 0),
              }
            : item
        )
      );
      setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: Number(actualizado.stock || 0) }));
      setInventarioPrecioDraft((prev) => ({ ...prev, [producto.producto_id]: Number(actualizado.precio || 0) }));
      setInventarioCostoDraft((prev) => ({ ...prev, [producto.producto_id]: Number(actualizado.costo_unitario || 0) }));
    } catch (e: any) {
      setInventarioError(e?.message ?? String(e));
    } finally {
      setSavingInventarioId(null);
    }
  }

  function resetVentaWizard() {
    setVentaCategoria("");
    setVentaCarrito([]);
    setVentaDescuentoPorcentaje(0);
    setVentaMetodosPago(["efectivo"]);
    setVentaLentesPaso(1);
    setVentaAgregarTinte(false);
    setVentaMostrarAntiblue(false);
    setVentaTinteGrado("");
    setVentasSeleccionadas([]);
  }

  function seleccionarVentaCategoria(categoria: VentaCategoria) {
    setVentaCategoria(categoria);
  }

  function agregarProductoCarrito(
    producto: InventarioProducto,
    modo: "sumar" | "unico" | "reemplazar_subcategoria" = "sumar",
  ) {
    if (producto.controla_stock && producto.stock <= 0) return;
    setVentaCarrito((prev) => {
      if (prev.some((item) => item.producto_id === producto.producto_id)) {
        return prev.filter((item) => item.producto_id !== producto.producto_id);
      }

      let next = [...prev];
      if (modo === "reemplazar_subcategoria") {
        const idsMismoGrupo = new Set(
          inventario
            .filter(
              (item) =>
                item.categoria === producto.categoria
                && item.subcategoria === producto.subcategoria,
            )
            .map((item) => item.producto_id),
        );
        next = next.filter((item) => !idsMismoGrupo.has(item.producto_id));
      }

      const existente = next.find((item) => item.producto_id === producto.producto_id);
      if (existente) {
        if (modo !== "sumar") return next;
        const maximo = producto.controla_stock ? producto.stock : 99;
        return next.map((item) =>
          item.producto_id === producto.producto_id
            ? { ...item, cantidad: Math.min(maximo, item.cantidad + 1) }
            : item,
        );
      }
      return [...next, { producto_id: producto.producto_id, cantidad: 1 }];
    });
  }

  function prepararMicasConDefaults() {
    const productosDefault = [
      inventario.find((item) => item.sku === "MIC-BASE-001"),
      inventario.find((item) => item.sku === "MIC-MONO-001"),
      inventario.find((item) => item.sku === "MIC-SINTRAT-001"),
    ].filter((item): item is InventarioProducto => Boolean(item));
    productosDefault.forEach((producto) =>
      agregarProductoCarrito(producto, "reemplazar_subcategoria"),
    );
  }

  function seleccionarArmazonFlujoOptico(producto: InventarioProducto) {
    const yaSeleccionado = ventaCarrito.some((item) => item.producto_id === producto.producto_id);
    const idsFlujoOptico = new Set(
      inventario
        .filter((item) => item.categoria === "lentes_opticos" || item.categoria === "micas")
        .map((item) => item.producto_id),
    );
    if (yaSeleccionado) {
      setVentaCarrito((prev) => prev.filter((item) => !idsFlujoOptico.has(item.producto_id)));
      setVentaLentesPaso(1);
      setVentaAgregarTinte(false);
      setVentaMostrarAntiblue(false);
      setVentaTinteGrado("");
      return;
    }

    const micaBase = inventario.find((item) => item.sku === "MIC-BASE-001");
    setVentaCarrito((prev) => [
      ...prev.filter((item) => !idsFlujoOptico.has(item.producto_id)),
      { producto_id: producto.producto_id, cantidad: 1 },
      ...(micaBase ? [{ producto_id: micaBase.producto_id, cantidad: 1 }] : []),
    ]);
    setVentaLentesPaso(2);
    setVentaAgregarTinte(false);
    setVentaMostrarAntiblue(false);
    setVentaTinteGrado("");
  }

  function seleccionarDisenoFlujoOptico(producto: InventarioProducto) {
    const yaSeleccionado = ventaCarrito.some((item) => item.producto_id === producto.producto_id);
    agregarProductoCarrito(producto, "reemplazar_subcategoria");
    setVentaLentesPaso(yaSeleccionado ? 2 : 3);
  }

  function seleccionarTratamientoFlujoOptico(
    producto: InventarioProducto,
    opciones?: { mantenerAbierto?: boolean; esTinte?: boolean },
  ) {
    const yaSeleccionado = ventaCarrito.some((item) => item.producto_id === producto.producto_id);
    agregarProductoCarrito(producto, "reemplazar_subcategoria");
    if (yaSeleccionado) {
      setVentaLentesPaso(3);
      if (producto.tipo_mica === "tinte") setVentaTinteGrado("");
      return;
    }
    setVentaMostrarAntiblue(false);
    setVentaAgregarTinte(Boolean(opciones?.esTinte));
    if (!opciones?.esTinte) setVentaTinteGrado("");
    setVentaLentesPaso(opciones?.mantenerAbierto ? 3 : 0);
  }

  function actualizarCantidadCarrito(producto: InventarioProducto, cantidad: number) {
    const maximo = producto.controla_stock ? Math.max(1, producto.stock) : 99;
    const cantidadSegura = Math.min(Math.max(1, Math.trunc(cantidad || 1)), maximo);
    setVentaCarrito((prev) =>
      prev.map((item) =>
        item.producto_id === producto.producto_id
          ? { ...item, cantidad: cantidadSegura }
          : item,
      ),
    );
  }

  function quitarProductoCarrito(productoId: number) {
    setVentaCarrito((prev) => prev.filter((item) => item.producto_id !== productoId));
  }

  function compraTokensDesdeCarrito(carrito: VentaCarritoItem[]): string[] {
    const productos = carrito
      .map((item) => inventario.find((producto) => producto.producto_id === item.producto_id))
      .filter((item): item is InventarioProducto => Boolean(item));
    const tokens = new Set<string>();
    const solarConGraduacion = productos.some(
      (producto) =>
        producto.categoria === "lentes_de_sol"
        && producto.subcategoria === "graduacion",
    );

    productos.forEach((producto) => {
      if (producto.categoria === "lentes_opticos") {
        tokens.add("armazon_solo");
      } else if (producto.categoria === "micas") {
        const tokenPorTipo: Record<string, string> = {
          base: "micas_base",
          monofocal: "micas_monofocales",
          bifocal: "micas_bifocales",
          progresivo: "micas_progresivas",
          sin_graduacion: "micas_sin_graduacion",
          sin_tratamiento: "micas_solas_sin_tratamiento",
          antirreflejante: "micas_antirreflejante",
          fotocromatico: "micas_fotocromaticas",
          antiblueray: "micas_antiblueray",
          tinte: "micas_tinte",
        };
        const token = tokenPorTipo[producto.tipo_mica || ""];
        if (token) tokens.add(token);
      } else if (producto.categoria === "lentes_de_sol") {
        tokens.add(
          solarConGraduacion
            ? "lentes_de_sol_con_graduacion"
            : "lentes_de_sol_sin_graduacion",
        );
      } else if (producto.categoria === "examen_de_la_vista") {
        tokens.add("examen_de_la_vista");
      } else if (producto.categoria === "lentes_de_contacto") {
        tokens.add("lentes_de_contacto");
      } else if (producto.categoria === "accesorios_y_refacciones") {
        tokens.add(
          producto.subcategoria === "estuche"
            ? "estuche_para_armazon"
            : "accesorios_y_refacciones",
        );
      } else if (producto.categoria === "soluciones_y_cuidado") {
        tokens.add("soluciones_y_cuidado");
      }
    });
    return Array.from(tokens);
  }

  function loadStats(override?: {
    modo?: "hoy" | "ayer" | "dia" | "semana" | "mes" | "anio" | "rango";
    fecha?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    mes?: string;
    anio?: string;
    pacientesModo?: "dia" | "mes" | "anio" | "rango";
    pacientesAnio?: string;
    pacientesMes?: string;
    pacientesFecha?: string;
    pacientesFechaDesde?: string;
    pacientesFechaHasta?: string;
    seriesAnio?: string;
  }) {
    setLoadingStats(true);
    setError(null);

    const modo = override?.modo ?? statsFiltroModo;
    const fecha = override?.fecha ?? statsFecha;
    const fechaDesde = override?.fechaDesde ?? statsFechaDesde;
    const fechaHasta = override?.fechaHasta ?? statsFechaHasta;
    const mes = override?.mes ?? statsMes;
    const anio = override?.anio ?? statsAnio;
    const pacientesModo = override?.pacientesModo ?? statsPacientesModo;
    const pacientesAnio = override?.pacientesAnio ?? statsPacientesAnio;
    const pacientesMes = override?.pacientesMes ?? statsPacientesMes;
    const pacientesFecha = override?.pacientesFecha ?? statsPacientesFecha;
    const pacientesFechaDesde = override?.pacientesFechaDesde ?? statsPacientesFechaDesde;
    const pacientesFechaHasta = override?.pacientesFechaHasta ?? statsPacientesFechaHasta;
    const seriesAnio = override?.seriesAnio ?? statsSeriesAnio;

    const params = new URLSearchParams();
    params.set("sucursal_id", String(sucursalActivaId));
    params.set("modo", modo);
    params.set("pacientes_modo", pacientesModo);
    if ((pacientesModo === "mes" || pacientesModo === "anio") && pacientesAnio) params.set("pacientes_anio", pacientesAnio);
    if (pacientesModo === "mes" && pacientesMes) params.set("pacientes_mes", pacientesMes);
    if (pacientesModo === "dia" && pacientesFecha) params.set("pacientes_fecha", pacientesFecha);
    if (pacientesModo === "rango" && pacientesFechaDesde) params.set("pacientes_fecha_desde", pacientesFechaDesde);
    if (pacientesModo === "rango" && pacientesFechaHasta) params.set("pacientes_fecha_hasta", pacientesFechaHasta);
    if (seriesAnio) params.set("series_anio", seriesAnio);

    if (modo === "dia") {
      if (fecha) params.set("fecha", fecha);
      setStatsFiltroLabel(`Día ${fecha || ""}`.trim());
    } else if (modo === "ayer") {
      setStatsFiltroLabel("Ayer");
    } else if (modo === "mes") {
      if (mes) params.set("mes", mes);
      if (anio) params.set("anio", anio);
      setStatsFiltroLabel(`Mes ${mes || "?"}/${anio || "?"}`);
    } else if (modo === "anio") {
      if (anio) params.set("anio", anio);
      setStatsFiltroLabel(`Año ${anio || "?"}`);
    } else if (modo === "rango") {
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      setStatsFiltroLabel(`Rango ${fechaDesde || "?"} a ${fechaHasta || "?"}`);
    } else if (modo === "semana") {
      setStatsFiltroLabel("Semana actual");
    } else {
      setStatsFiltroLabel("Hoy");
    }

    apiFetch(`/estadisticas/resumen?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar estadísticas.");
        return r.json();
      })
      .then((data: StatsResumen) => {
        setStatsData(data);
        if (data?.periodo?.label) setStatsFiltroLabel(data.periodo.label);
      })
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoadingStats(false));
  }

  function openExportModal() {
    setExportModalOpen(true);
    setExportTiposSeleccionados([]);
    setExportPacienteTexto("");
    setExportPacienteId("");
    setExportPacienteFocused(false);
    setExportPacienteOpciones(pacientesOpciones);
    setLoadingExportPaciente(false);
    setExportDelimiter("comma");
    setExportSucursalId("all");
    const from = formatDateYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const to = formatDateYYYYMMDD(new Date());
    setExportDesde(from);
    setExportHasta(to);
  }

  function toggleExportTipo(tipo: ExportCsvTipo) {
    setExportTiposSeleccionados((prev) => {
      if (prev.includes(tipo)) return prev.filter((x) => x !== tipo);
      return [...prev, tipo];
    });
  }

  async function downloadExportCsv() {
    if (!isAdmin) return;
    if (exportTiposSeleccionados.length === 0) {
      setError("Selecciona al menos un tipo de exportación.");
      return;
    }
    const requiereRango = exportTiposSeleccionados.some((t) => EXPORT_TIPOS_POR_FECHA.includes(t));
    const aplicaPaciente = exportTiposSeleccionados.some((t) => EXPORT_TIPOS_CON_PACIENTE.includes(t));
    if (requiereRango) {
      if (!exportDesde || !exportHasta) {
        setError("Selecciona fecha desde y fecha hasta.");
        return;
      }
      if (exportHasta < exportDesde) {
        setError("Rango inválido: fecha hasta debe ser mayor o igual a fecha desde.");
        return;
      }
    }

    try {
      setExportLoading(true);
      setError(null);
      for (const tipo of exportTiposSeleccionados) {
        const reqParams = new URLSearchParams();
        reqParams.set("delimiter", exportDelimiter);
        if (tipo !== "sucursales" && tipo !== "diccionario_columnas_fisico") {
          reqParams.set("sucursal_id", exportSucursalId || "all");
        }
        if (EXPORT_TIPOS_POR_FECHA.includes(tipo)) {
          reqParams.set("desde", exportDesde);
          reqParams.set("hasta", exportHasta);
        }
        if (aplicaPaciente && exportPacienteId.trim() && EXPORT_TIPOS_CON_PACIENTE.includes(tipo)) {
          reqParams.set("paciente_id", exportPacienteId.trim());
        }
        const r = await apiFetch(`/export/${tipo}.csv?${reqParams.toString()}`);
        if (!r.ok) throw new Error(await readErrorMessage(r));

        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const disposition = r.headers.get("content-disposition") || "";
        const m = disposition.match(/filename=\"?([^\";]+)\"?/i);
        const filename = m?.[1] ?? `${tipo}.csv`;
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      setExportModalOpen(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setExportLoading(false);
    }
  }

  function aplicarFiltroRapido(tipo: "ayer" | "ultimos7" | "semana_pasada" | "mes_pasado") {
    const now = new Date();

    if (tipo === "ayer") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const f = formatDateYYYYMMDD(y);
      setConsultaFiltroModo("rango");
      setConsultaFechaDesde(f);
      setConsultaFechaHasta(f);
      loadConsultas({ modo: "rango", fechaDesde: f, fechaHasta: f });
      setConsultaFiltroOpen(false);
      return;
    }

    if (tipo === "ultimos7") {
      const desde = new Date(now);
      desde.setDate(desde.getDate() - 6);
      const fDesde = formatDateYYYYMMDD(desde);
      const fHasta = formatDateYYYYMMDD(now);
      setConsultaFiltroModo("rango");
      setConsultaFechaDesde(fDesde);
      setConsultaFechaHasta(fHasta);
      loadConsultas({ modo: "rango", fechaDesde: fDesde, fechaHasta: fHasta });
      setConsultaFiltroOpen(false);
      return;
    }

    if (tipo === "semana_pasada") {
      const mondayIndex = (now.getDay() + 6) % 7;
      const inicioSemanaActual = new Date(now);
      inicioSemanaActual.setDate(now.getDate() - mondayIndex);

      const inicioSemanaPasada = new Date(inicioSemanaActual);
      inicioSemanaPasada.setDate(inicioSemanaActual.getDate() - 7);

      const finSemanaPasada = new Date(inicioSemanaActual);
      finSemanaPasada.setDate(inicioSemanaActual.getDate() - 1);

      const fDesde = formatDateYYYYMMDD(inicioSemanaPasada);
      const fHasta = formatDateYYYYMMDD(finSemanaPasada);
      setConsultaFiltroModo("rango");
      setConsultaFechaDesde(fDesde);
      setConsultaFechaHasta(fHasta);
      loadConsultas({ modo: "rango", fechaDesde: fDesde, fechaHasta: fHasta });
      setConsultaFiltroOpen(false);
      return;
    }

    const mesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const anio = String(mesPasado.getFullYear());
    const mes = String(mesPasado.getMonth() + 1);
    setConsultaFiltroModo("mes");
    setConsultaAnio(anio);
    setConsultaMes(mes);
    loadConsultas({ modo: "mes", anio, mes });
    setConsultaFiltroOpen(false);
  }

  function aplicarFiltroRapidoVenta(tipo: "ayer" | "ultimos7" | "semana_pasada" | "mes_pasado") {
    const now = new Date();

    if (tipo === "ayer") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const f = formatDateYYYYMMDD(y);
      setVentaFiltroModo("rango");
      setVentaFechaDesde(f);
      setVentaFechaHasta(f);
      loadVentas({ modo: "rango", fechaDesde: f, fechaHasta: f });
      setVentaFiltroOpen(false);
      return;
    }
    if (tipo === "ultimos7") {
      const desde = new Date(now);
      desde.setDate(desde.getDate() - 6);
      const fDesde = formatDateYYYYMMDD(desde);
      const fHasta = formatDateYYYYMMDD(now);
      setVentaFiltroModo("rango");
      setVentaFechaDesde(fDesde);
      setVentaFechaHasta(fHasta);
      loadVentas({ modo: "rango", fechaDesde: fDesde, fechaHasta: fHasta });
      setVentaFiltroOpen(false);
      return;
    }
    if (tipo === "semana_pasada") {
      const mondayIndex = (now.getDay() + 6) % 7;
      const inicioSemanaActual = new Date(now);
      inicioSemanaActual.setDate(now.getDate() - mondayIndex);
      const inicioSemanaPasada = new Date(inicioSemanaActual);
      inicioSemanaPasada.setDate(inicioSemanaActual.getDate() - 7);
      const finSemanaPasada = new Date(inicioSemanaActual);
      finSemanaPasada.setDate(inicioSemanaActual.getDate() - 1);
      const fDesde = formatDateYYYYMMDD(inicioSemanaPasada);
      const fHasta = formatDateYYYYMMDD(finSemanaPasada);
      setVentaFiltroModo("rango");
      setVentaFechaDesde(fDesde);
      setVentaFechaHasta(fHasta);
      loadVentas({ modo: "rango", fechaDesde: fDesde, fechaHasta: fHasta });
      setVentaFiltroOpen(false);
      return;
    }
    const mesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const anio = String(mesPasado.getFullYear());
    const mes = String(mesPasado.getMonth() + 1);
    setVentaFiltroModo("mes");
    setVentaAnio(anio);
    setVentaMes(mes);
    loadVentas({ modo: "mes", anio, mes });
    setVentaFiltroOpen(false);
  }


  function aplicarFiltroRapidoPaciente(tipo: "ayer" | "ultimos7" | "semana_pasada" | "mes_pasado") {
    const now = new Date();

    if (tipo === "ayer") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const f = formatDateYYYYMMDD(y);
      setPacienteFiltroModo("rango");
      setPacienteFechaDesde(f);
      setPacienteFechaHasta(f);
      loadPacientes({ modo: "rango", fechaDesde: f, fechaHasta: f });
      setPacienteFiltroOpen(false);
      return;
    }

    if (tipo === "ultimos7") {
      const desde = new Date(now);
      desde.setDate(desde.getDate() - 6);
      const fDesde = formatDateYYYYMMDD(desde);
      const fHasta = formatDateYYYYMMDD(now);
      setPacienteFiltroModo("rango");
      setPacienteFechaDesde(fDesde);
      setPacienteFechaHasta(fHasta);
      loadPacientes({ modo: "rango", fechaDesde: fDesde, fechaHasta: fHasta });
      setPacienteFiltroOpen(false);
      return;
    }

    if (tipo === "semana_pasada") {
      const mondayIndex = (now.getDay() + 6) % 7;
      const inicioSemanaActual = new Date(now);
      inicioSemanaActual.setDate(now.getDate() - mondayIndex);
      const inicioSemanaPasada = new Date(inicioSemanaActual);
      inicioSemanaPasada.setDate(inicioSemanaActual.getDate() - 7);
      const finSemanaPasada = new Date(inicioSemanaActual);
      finSemanaPasada.setDate(inicioSemanaActual.getDate() - 1);
      const fDesde = formatDateYYYYMMDD(inicioSemanaPasada);
      const fHasta = formatDateYYYYMMDD(finSemanaPasada);
      setPacienteFiltroModo("rango");
      setPacienteFechaDesde(fDesde);
      setPacienteFechaHasta(fHasta);
      loadPacientes({ modo: "rango", fechaDesde: fDesde, fechaHasta: fHasta });
      setPacienteFiltroOpen(false);
      return;
    }

    const mesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const anio = String(mesPasado.getFullYear());
    const mes = String(mesPasado.getMonth() + 1);
    setPacienteFiltroModo("mes");
    setPacienteAnio(anio);
    setPacienteMes(mes);
    loadPacientes({ modo: "mes", anio, mes });
    setPacienteFiltroOpen(false);
  }

  async function loadAgendaDisponibilidad() {
    if (!me) return;
    setAgendaLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("fecha", agendaFecha);
      params.set("sucursal_id", String(sucursalActivaId));
      params.set("duracion_min", "45");
      const r = await apiFetch(`/agenda/disponibilidad?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data = await r.json();
      const slots = Array.isArray(data?.slots) ? data.slots : [];
      setAgendaSlots(slots);
      setAgendaTimezone(data?.timezone ?? "");
      setAgendaCalendarError(typeof data?.calendar_error === "string" ? data.calendar_error : "");
      setAgendaSlotSeleccionado((prev) => {
        if (!prev) return null;
        const found = slots.find((s: AgendaSlot) => s.inicio === prev.inicio && s.fin === prev.fin);
        return found ?? null;
      });
    } catch (e: any) {
      setAgendaSlots([]);
      setAgendaSlotSeleccionado(null);
      setAgendaCalendarError("");
      setError(e?.message ?? String(e));
    } finally {
      setAgendaLoading(false);
    }
  }

  async function buscarPacientesParaConsulta(query?: string) {
    const q = (query ?? qPacienteConsulta).trim();
    if (!q) {
      pacienteConsultaBusquedaSeqRef.current += 1;
      setLoadingPacienteConsulta(false);
      setPacientesConsultaOpciones(pacientesOpciones);
      return;
    }
    const localFiltrados = rankPacientesByQuery(pacientes, q);
    const localOps = toPacienteOptions(localFiltrados);
    setPacientesConsultaOpciones(localOps);

    const seq = ++pacienteConsultaBusquedaSeqRef.current;
    setLoadingPacienteConsulta(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "120");
      params.set("sucursal_id", String(sucursalActivaId));
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: Paciente[] = await r.json();
      if (seq !== pacienteConsultaBusquedaSeqRef.current) return;
      const ops = toPacienteOptions(data);
      setPacientesConsultaOpciones(ops.length > 0 ? ops : localOps);
    } catch (e: any) {
      if (seq !== pacienteConsultaBusquedaSeqRef.current) return;
      setError(e?.message ?? String(e));
      setPacientesConsultaOpciones(localOps);
    } finally {
      if (seq === pacienteConsultaBusquedaSeqRef.current) {
        setLoadingPacienteConsulta(false);
      }
    }
  }

  async function buscarPacientesParaVenta(query?: string) {
    const q = (query ?? qPacienteVenta).trim();
    if (!q) {
      pacienteVentaBusquedaSeqRef.current += 1;
      setLoadingPacienteVenta(false);
      setPacientesVentaOpciones(pacientesOpciones);
      return;
    }
    const localFiltrados = rankPacientesByQuery(pacientes, q);
    const localOps = toPacienteOptions(localFiltrados);
    setPacientesVentaOpciones(localOps);

    const seq = ++pacienteVentaBusquedaSeqRef.current;
    setLoadingPacienteVenta(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "120");
      params.set("sucursal_id", String(sucursalActivaId));
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: Paciente[] = await r.json();
      if (seq !== pacienteVentaBusquedaSeqRef.current) return;
      const ops = toPacienteOptions(data);
      setPacientesVentaOpciones(ops.length > 0 ? ops : localOps);
    } catch (e: any) {
      if (seq !== pacienteVentaBusquedaSeqRef.current) return;
      setError(e?.message ?? String(e));
      setPacientesVentaOpciones(localOps);
    } finally {
      if (seq === pacienteVentaBusquedaSeqRef.current) {
        setLoadingPacienteVenta(false);
      }
    }
  }

  async function buscarPacientesParaExport(query?: string) {
    const q = (query ?? exportPacienteTexto).trim();
    if (!q) {
      pacienteExportBusquedaSeqRef.current += 1;
      setLoadingExportPaciente(false);
      setExportPacienteOpciones(pacientesOpciones);
      return;
    }

    const localFiltrados = rankPacientesByQuery(pacientes, q);
    const localOps = toPacienteOptions(localFiltrados);
    setExportPacienteOpciones(localOps);

    const seq = ++pacienteExportBusquedaSeqRef.current;
    setLoadingExportPaciente(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "120");
      if (exportSucursalId !== "all") {
        params.set("sucursal_id", exportSucursalId);
      }
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: Paciente[] = await r.json();
      if (seq !== pacienteExportBusquedaSeqRef.current) return;
      const ops = toPacienteOptions(data);
      setExportPacienteOpciones(ops.length > 0 ? ops : localOps);
    } catch (e: any) {
      if (seq !== pacienteExportBusquedaSeqRef.current) return;
      setError(e?.message ?? String(e));
      setExportPacienteOpciones(localOps);
    } finally {
      if (seq === pacienteExportBusquedaSeqRef.current) {
        setLoadingExportPaciente(false);
      }
    }
  }

  async function buscarPacientesParaTabla(query?: string) {
    const q = (query ?? qPaciente).trim();
    if (!q) {
      pacienteBusquedaSeqRef.current += 1;
      setLoadingPacienteBusqueda(false);
      setPacientesBusqueda(null);
      return;
    }
    const seq = ++pacienteBusquedaSeqRef.current;
    setLoadingPacienteBusqueda(true);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "200");
      params.set("sucursal_id", String(sucursalActivaId));
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: Paciente[] = await r.json();
      if (seq !== pacienteBusquedaSeqRef.current) return;
      setPacientesBusqueda(data);
    } catch (e: any) {
      if (seq !== pacienteBusquedaSeqRef.current) return;
      setPacientesBusqueda([]);
      setError(e?.message ?? String(e));
    } finally {
      if (seq === pacienteBusquedaSeqRef.current) {
        setLoadingPacienteBusqueda(false);
      }
    }
  }


  useEffect(() => {
    if (getToken()) loadMe();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      buscarPacientesParaConsulta(qPacienteConsulta);
    }, 300);
    return () => clearTimeout(t);
  }, [qPacienteConsulta, sucursalActivaId]);

  useEffect(() => {
    const t = setTimeout(() => {
      buscarPacientesParaVenta(qPacienteVenta);
    }, 300);
    return () => clearTimeout(t);
  }, [qPacienteVenta, sucursalActivaId]);

  useEffect(() => {
    if (!exportModalOpen || me?.rol !== "admin") return;
    const t = setTimeout(() => {
      buscarPacientesParaExport(exportPacienteTexto);
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportModalOpen, exportPacienteTexto, exportSucursalId, me?.rol, sucursalActivaId]);

  useEffect(() => {
    const q = qPaciente.trim();
    if (!q) {
      buscarPacientesParaTabla("");
      return;
    }
    const t = setTimeout(() => {
      buscarPacientesParaTabla(q);
    }, 120);
    return () => clearTimeout(t);
  }, [qPaciente, sucursalActivaId]);

  useEffect(() => {
    setHistoriaEstadoPaciente({});
  }, [sucursalActivaId]);

  useEffect(() => {
    if (!me || tab !== "historia_clinica") return;
    if (pacientesFiltrados.length === 0) return;

    const candidatos = pacientesFiltrados;
    const faltantes = candidatos.filter((p) => historiaEstadoPaciente[p.paciente_id] === undefined);
    if (faltantes.length === 0) return;

    let cancelled = false;
    setHistoriaEstadoPaciente((prev) => {
      const next = { ...prev };
      for (const p of faltantes) {
        next[p.paciente_id] = "loading";
      }
      return next;
    });

    (async () => {
      const timeout = window.setTimeout(() => {
        if (cancelled) return;
        setHistoriaEstadoPaciente((prev) => {
          const next = { ...prev };
          for (const p of faltantes) {
            if (next[p.paciente_id] === "loading") {
              next[p.paciente_id] = "missing";
            }
          }
          return next;
        });
      }, 10000);
      try {
        const r = await apiFetch(`/historias/estado?sucursal_id=${sucursalActivaId}`, {
          method: "POST",
          body: JSON.stringify({
            paciente_ids: faltantes.map((p) => p.paciente_id),
          }),
        });
        if (!r.ok) throw new Error(await readErrorMessage(r));
        const data = await r.json();
        const estadoMap = new Map<number, "exists" | "missing">();
        for (const item of Array.isArray(data?.items) ? data.items : []) {
          const pid = Number(item?.paciente_id || 0);
          if (!Number.isFinite(pid) || pid <= 0) continue;
          const estado = String(item?.estado || "").toLowerCase() === "exists" ? "exists" : "missing";
          estadoMap.set(pid, estado);
        }
        if (cancelled) return;
        setHistoriaEstadoPaciente((prev) => {
          const next = { ...prev };
          for (const p of faltantes) {
            next[p.paciente_id] = estadoMap.get(p.paciente_id) ?? "missing";
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setHistoriaEstadoPaciente((prev) => {
          const next = { ...prev };
          for (const p of faltantes) {
            next[p.paciente_id] = "missing";
          }
          return next;
        });
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, tab, pacientesFiltrados, sucursalActivaId]);



  useEffect(() => {
    if (!me) return;
    setFormPaciente((prev) => ({ ...prev, sucursal_id: sucursalActivaId }));
    setFormConsulta((prev) => ({ ...prev, sucursal_id: sucursalActivaId, paciente_id: 0 }));
    setFormVenta((prev) => ({ ...prev, sucursal_id: sucursalActivaId, paciente_id: 0 }));
    setEditingVentaId(null);
    setSuccessVentaMsg(null);
    resetVentaWizard();
    loadPacientes();
    loadConsultas();
    loadVentas();
  }, [sucursalActivaId, me]);

  useEffect(() => {
    if (!me) return;
    loadSucursales();
  }, [me]);

  useEffect(() => {
    if (me?.rol !== "admin") setInventarioVista("existencias");
  }, [me?.rol]);

  useEffect(() => {
    if (!me || tab !== "consultas") return;
    if (editingConsultaId !== null) return;
    loadAgendaDisponibilidad();
  }, [me, tab, agendaFecha, sucursalActivaId, editingConsultaId]);

  useEffect(() => {
    if (!me || tab !== "estadisticas") return;
    loadStats();
  }, [me, tab, sucursalActivaId]);

  useEffect(() => {
    if (!me) return;
    if (tab === "ventas" && me.rol !== "admin") return;
    if (tab !== "ventas" && tab !== "inventario") return;
    loadInventario();
  }, [me, tab, sucursalActivaId]);

  useEffect(() => {
    if (!me || tab !== "consultas") return;
    const t = setTimeout(() => {
      loadConsultas({ q: qConsulta.trim() });
    }, 220);
    return () => clearTimeout(t);
  }, [
    me,
    tab,
    qConsulta,
    sucursalActivaId,
    consultaFiltroModo,
    consultaFechaDesde,
    consultaFechaHasta,
    consultaMes,
    consultaAnio,
  ]);

  useEffect(() => {
    if (!me || tab !== "ventas") return;
    const t = setTimeout(() => {
      loadVentas({ q: qVenta.trim() });
    }, 220);
    return () => clearTimeout(t);
  }, [
    me,
    tab,
    qVenta,
    sucursalActivaId,
    ventaFiltroModo,
    ventaFechaDesde,
    ventaFechaHasta,
    ventaMes,
    ventaAnio,
  ]);

  useEffect(() => {
    if (!me) return;
    if ((me.rol === "recepcion") && tab === "historia_clinica") {
      setTab("pacientes");
    }
    if (me.rol !== "admin" && tab === "inventario") {
      setTab("pacientes");
    }
  }, [me, tab]);

  useEffect(() => {
    if (!historiaPacienteId) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        closeHistoriaModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historiaPacienteId]);





  function loadSucursales() {
    setError(null);
    apiFetch(`/sucursales`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la lista de sucursales.");
        return r.json();
      })
      .then((data: Sucursal[]) => {
        const allowedOrder = [1, 2];
        const normalized = allowedOrder
          .map((id) => {
            const row = data.find((s) => s.sucursal_id === id);
            if (!row) return null;
            return {
              ...row,
              nombre: FIXED_SUCURSAL_LABELS[id] ?? row.nombre,
              ciudad: null,
              estado: null,
            } as Sucursal;
          })
          .filter((x): x is Sucursal => x !== null);
        const effective = normalized.length > 0 ? normalized : data;
        setSucursales(effective);
        if (effective.length > 0 && !effective.find((s) => s.sucursal_id === sucursalActivaId)) {
          setSucursalActivaId(effective[0].sucursal_id);
        }
      })
      .catch((e) => setError(e?.message ?? String(e)));
  }




  
  function startEditPaciente(p: Paciente) {
    setSuccessPacienteMsg(null);
    setPacienteEmailError(null);
    const phoneUi = splitPhoneForUi(p.telefono);
    setPacienteTelefonoPais(phoneUi.countryIso);
    setPacienteTelefonoLocal(phoneUi.local);
    setEditingPacienteId(p.paciente_id);
    setFormPaciente({
      sucursal_id: sucursalActivaId,
      primer_nombre: p.primer_nombre ?? "",
      segundo_nombre: p.segundo_nombre ?? "",
      apellido_paterno: p.apellido_paterno ?? "",
      apellido_materno: p.apellido_materno ?? "",
      fecha_nacimiento: p.fecha_nacimiento ?? "",
      sexo: p.sexo ?? "",
      telefono: p.telefono ?? "",
      correo: p.correo ?? "",
      como_nos_conocio: p.como_nos_conocio === "linkedln" ? "linkedin" : (p.como_nos_conocio ?? ""),
      calle: p.calle ?? "",
      numero: p.numero ?? "",
      colonia: p.colonia ?? "",
      codigo_postal: p.codigo_postal ?? "",
      municipio: p.municipio ?? "",
      estado_direccion: p.estado_direccion ?? "",
      pais: p.pais ?? "",
    });
    setTab("pacientes");
  }

  function cancelEditPaciente() {
    setEditingPacienteId(null);
    setPacienteEmailError(null);
    setPacienteTelefonoPais(DEFAULT_PHONE_COUNTRY);
    setPacienteTelefonoLocal("");
    setFormPaciente({
      sucursal_id: sucursalActivaId,
      primer_nombre: "",
      segundo_nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      fecha_nacimiento: "",
      sexo: "",
      telefono: "",
      correo: "",
      como_nos_conocio: "",
      calle: "",
      numero: "",
      colonia: "",
      codigo_postal: "",
      municipio: "",
      estado_direccion: "",
      pais: "",
    });
  }

  function resetPacienteForm() {
    cancelEditPaciente();
    setSuccessPacienteMsg(null);
    setError(null);
  }

  async function openPacientePerfil(paciente: Paciente) {
    setPacientePerfil(paciente);
    setPerfilConsultas([]);
    setPerfilVentas([]);
    setLoadingPacientePerfil(true);
    setError(null);

    try {
      const [consultasResponse, ventasResponse] = await Promise.all([
        apiFetch(`/pacientes/${paciente.paciente_id}/consultas?sucursal_id=${sucursalActivaId}&limit=200`),
        apiFetch(`/pacientes/${paciente.paciente_id}/ventas?sucursal_id=${sucursalActivaId}&limit=200`),
      ]);
      if (!consultasResponse.ok) throw new Error(await readErrorMessage(consultasResponse));
      if (!ventasResponse.ok) throw new Error(await readErrorMessage(ventasResponse));
      setPerfilConsultas(await consultasResponse.json());
      setPerfilVentas(await ventasResponse.json());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingPacientePerfil(false);
    }
  }

  // ---- Acciones de formularios ----
  async function onSubmitPaciente(e: FormEvent) {
    e.preventDefault();
    setSavingPaciente(true);
    setSuccessPacienteMsg(null);
    setError(null);

    try {
      if (!formPaciente.primer_nombre?.trim()) throw new Error("Primer nombre es obligatorio.");
      if (!formPaciente.apellido_paterno?.trim()) throw new Error("Apellido paterno es obligatorio.");
      if (!formPaciente.fecha_nacimiento?.trim()) throw new Error("Fecha de nacimiento es obligatoria.");
      if (!formPaciente.sexo?.trim()) throw new Error("Sexo es obligatorio.");
      const emailError = pacienteEmailErrorMessage(formPaciente.correo);
      setPacienteEmailError(emailError);
      if (emailError) throw new Error(emailError);
      const telefonoDigits = onlyDigits(pacienteTelefonoLocal);
      if (telefonoDigits.length < PHONE_LOCAL_MIN_DIGITS || telefonoDigits.length > PHONE_LOCAL_MAX_DIGITS) {
        throw new Error(`Teléfono debe tener entre ${PHONE_LOCAL_MIN_DIGITS} y ${PHONE_LOCAL_MAX_DIGITS} dígitos.`);
      }
      const telefonoFinal = composeInternationalPhone(pacienteTelefonoPais, telefonoDigits);
      if (editingPacienteId === null && !formPaciente.como_nos_conocio?.trim()) {
        throw new Error("Selecciona cómo nos conoció.");
      }

      const payload = cleanPayload({
        ...formPaciente,
        sucursal_id: sucursalActivaId,
        telefono: telefonoFinal,
      });

      const path =
        editingPacienteId === null ? "/pacientes" : `/pacientes/${editingPacienteId}`;

      const method = editingPacienteId === null ? "POST" : "PUT";
      const wasEditing = editingPacienteId !== null;
      const editingId = editingPacienteId;

      const r = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await readErrorMessage(r));
      const result = await r.json();

      if (editingId !== null) {
        setPacientes((prev) =>
          prev.map((item) =>
            item.paciente_id === editingId
              ? {
                  ...item,
                  primer_nombre: formPaciente.primer_nombre ?? "",
                  segundo_nombre: formPaciente.segundo_nombre ?? "",
                  apellido_paterno: formPaciente.apellido_paterno ?? "",
                  apellido_materno: formPaciente.apellido_materno ?? "",
                  fecha_nacimiento: formPaciente.fecha_nacimiento ?? "",
                  sexo: formPaciente.sexo ?? "",
                  telefono: telefonoFinal,
                  correo: formPaciente.correo ?? "",
                  como_nos_conocio: formPaciente.como_nos_conocio ?? item.como_nos_conocio ?? null,
                  calle: formPaciente.calle ?? "",
                  numero: formPaciente.numero ?? "",
                  colonia: formPaciente.colonia ?? "",
                  codigo_postal: formPaciente.codigo_postal ?? "",
                  municipio: formPaciente.municipio ?? "",
                  estado_direccion: formPaciente.estado_direccion ?? "",
                  pais: formPaciente.pais ?? "",
                }
              : item
          )
        );
        setPacientesBusqueda((prev) =>
          prev
            ? prev.map((item) =>
                item.paciente_id === editingId
                  ? {
                      ...item,
                      primer_nombre: formPaciente.primer_nombre ?? "",
                      segundo_nombre: formPaciente.segundo_nombre ?? "",
                      apellido_paterno: formPaciente.apellido_paterno ?? "",
                      apellido_materno: formPaciente.apellido_materno ?? "",
                      fecha_nacimiento: formPaciente.fecha_nacimiento ?? "",
                      sexo: formPaciente.sexo ?? "",
                      telefono: telefonoFinal,
                      correo: formPaciente.correo ?? "",
                      como_nos_conocio: formPaciente.como_nos_conocio ?? item.como_nos_conocio ?? null,
                      calle: formPaciente.calle ?? "",
                      numero: formPaciente.numero ?? "",
                      colonia: formPaciente.colonia ?? "",
                      codigo_postal: formPaciente.codigo_postal ?? "",
                      municipio: formPaciente.municipio ?? "",
                      estado_direccion: formPaciente.estado_direccion ?? "",
                      pais: formPaciente.pais ?? "",
                    }
                  : item
              )
            : prev
        );
      }

      cancelEditPaciente();
      loadPacientes();
      if (qPaciente.trim()) {
        buscarPacientesParaTabla(qPaciente.trim());
      } else {
        setPacientesBusqueda(null);
      }
      setTab("pacientes");
      setSuccessPacienteMsg(
        wasEditing
          ? "Edición guardada con éxito."
          : `Paciente creado con éxito (ID ${result?.paciente_id ?? "nuevo"}).`
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingPaciente(false);
    }
  }

  async function openHistoria(paciente: Paciente) {
    const paciente_id = paciente.paciente_id;
    const sucursalTarget = sucursalActivaId;
    const requestSeq = ++historiaOpenSeqRef.current;
    setHistoriaPacienteId(paciente_id);
    setHistoriaPacienteInfo(paciente);
    setHistoriaSucursalId(sucursalTarget);
    setLoadingHistoria(true);
    setHistoriaData(null);
    setHistoriaMissingSummary(null);
    setSuccessHistoriaMsg(null);
    setError(null);

    try {
      const r = await apiFetch(
        `/pacientes/${paciente_id}/historia?sucursal_id=${sucursalTarget}`
      );

      if (requestSeq !== historiaOpenSeqRef.current) return;

      if (r.status === 404) {
        setHistoriaData(null); // no existe todavía
        return;
      }

      if (!r.ok) throw new Error(await readErrorMessage(r));

      const data = await r.json();
      setHistoriaData(normalizeHistoriaForUi(data, ""));
    } catch (e: any) {
      if (requestSeq !== historiaOpenSeqRef.current) return;
      setError(e?.message ?? String(e));
    } finally {
      if (requestSeq !== historiaOpenSeqRef.current) return;
      setLoadingHistoria(false);
    }
  }

  function closeHistoriaModal() {
    historiaOpenSeqRef.current += 1;
    setHistoriaPacienteId(null);
    setHistoriaPacienteInfo(null);
    setHistoriaSucursalId(null);
    setHistoriaMissingSummary(null);
    setError(null);
  }

  async function deleteHistoriaClinicaByPaciente(pacienteId: number, pacienteLabel: string, closeAfterDelete: boolean) {
    const ok = window.confirm(`¿Seguro que quieres borrar la historia clínica del paciente ${pacienteLabel}?`);
    if (!ok) return;

    setDeletingHistoria(true);
    setDeletingHistoriaRowId(pacienteId);
    setError(null);
    try {
      const targetSucursalId =
        closeAfterDelete && historiaPacienteId === pacienteId
          ? (historiaSucursalId ?? sucursalActivaId)
          : sucursalActivaId;
      const r = await apiFetch(
        `/pacientes/${pacienteId}/historia?sucursal_id=${targetSucursalId}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error(await readErrorMessage(r));

      setHistoriaEstadoPaciente((prev) => ({ ...prev, [pacienteId]: "missing" }));
      if (closeAfterDelete && historiaPacienteId === pacienteId) {
        closeHistoriaModal();
      }
      loadPacientes();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDeletingHistoria(false);
      setDeletingHistoriaRowId(null);
    }
  }

  async function deleteHistoriaClinica() {
    if (!historiaPacienteId) return;
    const pacienteLabel = historiaPacienteNombreCompleto || `#${historiaPacienteId}`;
    await deleteHistoriaClinicaByPaciente(historiaPacienteId, pacienteLabel, true);
  }

  async function deleteHistoriaClinicaDesdeTabla(paciente: Paciente) {
    const pacienteLabel =
      [paciente.primer_nombre, paciente.segundo_nombre, paciente.apellido_paterno, paciente.apellido_materno]
        .filter(Boolean)
        .join(" ")
        .trim() || `#${paciente.paciente_id}`;
    await deleteHistoriaClinicaByPaciente(paciente.paciente_id, pacienteLabel, false);
  }






  async function deleteConsulta(consulta_id: number) {
    setError(null);
    try {
      const r = await apiFetch(
        `/consultas/${consulta_id}?sucursal_id=${sucursalActivaId}`,
        { method: "DELETE" }
      );


      if (!r.ok) throw new Error(await readErrorMessage(r));

      loadConsultas();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function deleteVenta(venta_id: number) {
    setError(null);
    try {
      const r = await apiFetch(`/ventas/${venta_id}?sucursal_id=${sucursalActivaId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await readErrorMessage(r));
      loadVentas();
      if (me?.rol === "admin") {
        loadInventario();
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }


  async function deletePaciente(paciente_id: number) {
  setError(null);
  try {
    const r = await apiFetch(
      `/pacientes/${paciente_id}?sucursal_id=${sucursalActivaId}`,
      { method: "DELETE" }
    );


    if (!r.ok) {
      const msg = await readErrorMessage(r)

      // Mensaje más amigable para el caso 409
      if (r.status === 409) {
        throw new Error("No se puede eliminar: el paciente tiene consultas activas.");
      }

      throw new Error(msg);
    }

    // Si estabas editando ese paciente, cancelar edición
    if (editingPacienteId === paciente_id) {
      cancelEditPaciente();
    }

    // Si estabas viendo historial de ese paciente, cerrar historial
    if (histPacienteId === paciente_id) {
      setHistPacienteId(null);
      setHistConsultas([]);
    }

    // recargar pacientes (y opcionalmente consultas)
    loadPacientes();
    loadConsultas();
  } catch (e: any) {
    setError(e?.message ?? String(e));
  }
}

  function askDeletePaciente(paciente_id: number) {
    setDeleteConfirmType("paciente");
    setDeleteConfirmId(paciente_id);
    setDeleteConfirmOpen(true);
  }

  function askDeleteConsulta(consulta_id: number) {
    setDeleteConfirmType("consulta");
    setDeleteConfirmId(consulta_id);
    setDeleteConfirmOpen(true);
  }

  function askDeleteVenta(venta_id: number) {
    setDeleteConfirmType("venta");
    setDeleteConfirmId(venta_id);
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteAction() {
    if (!deleteConfirmType || deleteConfirmId === null) return;
    setDeleteConfirmBusy(true);
    try {
      if (deleteConfirmType === "paciente") {
        await deletePaciente(deleteConfirmId);
      } else if (deleteConfirmType === "venta") {
        await deleteVenta(deleteConfirmId);
      } else {
        await deleteConsulta(deleteConfirmId);
      }
      setDeleteConfirmOpen(false);
      setDeleteConfirmType(null);
      setDeleteConfirmId(null);
    } finally {
      setDeleteConfirmBusy(false);
    }
  }

  function startEditConsulta(c: Consulta) {
    setEditingConsultaId(c.consulta_id);
    const etapa = resolveConsultaEtapa(c);
    const motivos = resolveConsultaMotivos(c);
    const notaInfo = splitConsultaOtroNota(c.notas ?? "");
    setMotivosConsultaSeleccionados(motivos);
    setTipoConsultaOtro(motivos.includes("otro") ? notaInfo.razon : "");
    setFormConsulta({
      paciente_id: c.paciente_id,
      sucursal_id: sucursalActivaId,
      tipo_consulta: c.tipo_consulta ?? "",
      etapa_consulta: etapa,
      motivo_consulta: motivos.join("|"),
      doctor_primer_nombre: c.doctor_primer_nombre ?? "",
      doctor_apellido_paterno: c.doctor_apellido_paterno ?? "",
      motivo: "",
      diagnostico: "",
      notas: notaInfo.notas,
    });
    setAgendaSlotSeleccionado(null);
    setTab("consultas");
    setSuccessConsultaMsg(null);
  }

  function cancelEditConsulta() {
    setEditingConsultaId(null);
    setMotivosConsultaSeleccionados([]);
    setTipoConsultaOtro("");
    setFormConsulta((prev) => ({
      ...prev,
      tipo_consulta: "",
      etapa_consulta: "",
      motivo_consulta: "",
      doctor_primer_nombre: "",
      doctor_apellido_paterno: "",
      notas: "",
    }));
    setQPacienteConsulta("");
    setPacientesConsultaOpciones(pacientesOpciones);
  }

  function resetConsultaForm() {
    setEditingConsultaId(null);
    setMotivosConsultaSeleccionados([]);
    setTipoConsultaOtro("");
    setFormConsulta({
      paciente_id: 0,
      sucursal_id: sucursalActivaId,
      tipo_consulta: "",
      etapa_consulta: "",
      motivo_consulta: "",
      doctor_primer_nombre: "",
      doctor_apellido_paterno: "",
      motivo: "",
      diagnostico: "",
      notas: "",
    });
    setQPacienteConsulta("");
    setPacientesConsultaOpciones(pacientesOpciones);
    setAgendaFecha(formatDateYYYYMMDD(new Date()));
    setAgendaSlots([]);
    setAgendaSlotSeleccionado(null);
    setAgendaTimezone("");
    setAgendaCalendarError("");
    setSuccessConsultaMsg(null);
    setError(null);
    window.setTimeout(() => loadAgendaDisponibilidad(), 0);
  }







  async function onSubmitConsulta(e: FormEvent) {
    e.preventDefault();
    setSavingConsulta(true);
    setError(null);
    setSuccessConsultaMsg(null);

    try {
      if (!formConsulta.paciente_id || formConsulta.paciente_id === 0) {
        throw new Error("Selecciona un paciente.");
      }
      if (!formConsulta.etapa_consulta?.trim()) {
        throw new Error("Selecciona la etapa de la consulta.");
      }
      if (motivosConsultaSeleccionados.length === 0) {
        throw new Error("Selecciona al menos un motivo de consulta.");
      }
      if (motivosConsultaSeleccionados.includes("otro") && !tipoConsultaOtro.trim()) {
        throw new Error("Escribe la razón cuando seleccionas 'otro'.");
      }
      if (!formConsulta.doctor_primer_nombre?.trim() || !formConsulta.doctor_apellido_paterno?.trim()) {
        throw new Error("Nombre y apellido del doctor son obligatorios.");
      }
      const etapaConsultaTexto = formConsulta.etapa_consulta.trim().toLowerCase();
      const motivoConsultaTexto = motivosConsultaSeleccionados.join("|");
      const tipoConsultaTexto = [etapaConsultaTexto, ...motivosConsultaSeleccionados].join("|");

      let notasFinal = (formConsulta.notas ?? "").trim();
      if (motivosConsultaSeleccionados.includes("otro") && tipoConsultaOtro.trim()) {
        const razon = `Razon (otro): ${tipoConsultaOtro.trim()}`;
        notasFinal = notasFinal ? `${razon} | ${notasFinal}` : razon;
      }
      const usarAgenda = editingConsultaId === null;
      if (usarAgenda && !agendaSlotSeleccionado) {
        throw new Error("Selecciona un horario disponible para agendar la consulta.");
      }

      const payload = cleanPayload({
        ...formConsulta,
        sucursal_id: sucursalActivaId,
        etapa_consulta: etapaConsultaTexto,
        motivo_consulta: motivoConsultaTexto,
        tipo_consulta: tipoConsultaTexto,
        motivo: null,
        diagnostico: null,
        notas: notasFinal,
        agendar_en_calendario: usarAgenda,
        agenda_inicio: usarAgenda ? agendaSlotSeleccionado?.inicio ?? null : null,
        agenda_fin: usarAgenda ? agendaSlotSeleccionado?.fin ?? null : null,
      });
      console.log("POST /consultas payload:", payload);
      
      const endpoint = editingConsultaId === null ? "/consultas" : `/consultas/${editingConsultaId}`;
      const method = editingConsultaId === null ? "POST" : "PUT";
      const r = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await readErrorMessage(r));


      // limpiar form (pero mantener paciente y doctor si quieres)
      setFormConsulta((prev) => ({
        ...prev,
        tipo_consulta: "",
        etapa_consulta: "",
        motivo_consulta: "",
        notas: "",
      }));
      setTipoConsultaOtro("");
      setMotivosConsultaSeleccionados([]);
      setEditingConsultaId(null);
      setAgendaSlotSeleccionado(null);

      loadConsultas();
      if (usarAgenda) {
        loadAgendaDisponibilidad();
      }
      setTab("consultas");
      setSuccessConsultaMsg(editingConsultaId === null ? "Consulta guardada con éxito." : "Consulta actualizada con éxito.");
      setTimeout(() => setSuccessConsultaMsg(null), 3500);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingConsulta(false);
    }
  }

  function startEditVenta(v: Venta) {
    setEditingVentaId(v.venta_id);
    const comprasRaw = (v.compra ?? "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    const compras = comprasRaw
      .map((x) => (x.toLowerCase().startsWith("otro:") ? "otro" : canonicalVentaCompraOption(x)))
      .filter(Boolean);
    const metodosPago = String(v.metodo_pago || "efectivo")
      .split("|")
      .map((item) => item.trim())
      .filter((item): item is VentaMetodoPago =>
        VENTA_METODO_PAGO_OPTIONS.some((opcion) => opcion.value === item),
      );
    const gradoTinte = compras.find((item) => /^tinte_grado_[123]$/.test(item));
    setVentasSeleccionadas(Array.from(new Set(compras)));
    setVentaCategoria(inferVentaCategoria(compras));
    setVentaCarrito([]);
    setVentaDescuentoPorcentaje(Number(v.descuento_porcentaje || 0));
    setVentaMetodosPago(metodosPago.length > 0 ? metodosPago : ["efectivo"]);
    setVentaTinteGrado((gradoTinte?.replace("tinte_", "") || "") as VentaTinteGrado);
    setVentaAgregarTinte(compras.includes("micas_tinte"));
    setVentaMostrarAntiblue(compras.includes("micas_antiblueray"));
    setVentaLentesPaso(0);
    setFormVenta({
      paciente_id: v.paciente_id,
      sucursal_id: sucursalActivaId,
      compra: v.compra ?? "",
      subtotal: Number(v.subtotal ?? v.monto_total ?? 0),
      descuento_porcentaje: Number(v.descuento_porcentaje || 0),
      descuento_motivo: v.descuento_motivo ?? null,
      cupon_tipo: v.cupon_tipo ?? null,
      monto_total: Number(v.monto_total ?? 0),
      metodo_pago: v.metodo_pago ?? "efectivo",
      forma_liquidacion: v.forma_liquidacion ?? "pago_completo",
      adelanto_aplica: Boolean(v.adelanto_aplica),
      adelanto_monto: v.adelanto_monto ?? null,
      adelanto_metodo: v.adelanto_metodo ?? null,
      como_nos_conocio: v.como_nos_conocio === "linkedln" ? "linkedin" : (v.como_nos_conocio ?? ""),
      notas: v.notas ?? "",
    });
    setTab("ventas");
    setSuccessVentaMsg(null);
  }

  function cancelEditVenta() {
    setEditingVentaId(null);
    resetVentaWizard();
    setFormVenta({
      paciente_id: 0,
      sucursal_id: sucursalActivaId,
      compra: "",
      subtotal: 0,
      descuento_porcentaje: 0,
      descuento_motivo: null,
      cupon_tipo: null,
      monto_total: 0,
      metodo_pago: "efectivo",
      forma_liquidacion: "pago_completo",
      adelanto_aplica: false,
      adelanto_monto: null,
      adelanto_metodo: null,
      como_nos_conocio: "",
      notas: "",
    });
    setQPacienteVenta("");
    setPacientesVentaOpciones(pacientesOpciones);
  }

  async function onSubmitVenta(e: FormEvent) {
    e.preventDefault();
    setSavingVenta(true);
    setError(null);
    setSuccessVentaMsg(null);

    try {
      if (!formVenta.paciente_id || formVenta.paciente_id === 0) throw new Error("Selecciona un paciente.");
      if (ventaMetodosPago.length === 0) {
        throw new Error("Selecciona al menos un método de pago.");
      }
      const formaLiquidacion = formVenta.forma_liquidacion ?? "pago_completo";
      const requiereAdelanto = ["adelanto_apartado", "pago_mixto"].includes(formaLiquidacion);
      if (requiereAdelanto) {
        if (!formVenta.adelanto_monto || Number(formVenta.adelanto_monto) <= 0) {
          throw new Error("Adelanto debe ser mayor a 0.");
        }
        if (!formVenta.adelanto_metodo) {
          throw new Error("Selecciona método de pago del adelanto.");
        }
      }
      const carritoDetalle = ventaCarrito
        .map((item) => {
          const producto = inventario.find((row) => row.producto_id === item.producto_id);
          return producto ? { ...item, producto } : null;
        })
        .filter((item): item is VentaCarritoItem & { producto: InventarioProducto } => Boolean(item));
      if (editingVentaId === null && me?.rol === "admin" && carritoDetalle.length === 0) {
        throw new Error("Agrega al menos un producto al carrito.");
      }
      carritoDetalle.forEach(({ producto, cantidad }) => {
        if (producto.controla_stock && cantidad > producto.stock) {
          throw new Error(`Solo quedan ${producto.stock} unidades de ${producto.nombre}.`);
        }
      });
      const tieneMicasBase = carritoDetalle.some(({ producto }) => producto.sku === "MIC-BASE-001");
      if (tieneMicasBase) {
        const tieneDiseno = carritoDetalle.some(({ producto }) => producto.categoria === "micas" && producto.subcategoria === "diseno");
        const tieneTratamiento = carritoDetalle.some(({ producto }) => producto.categoria === "micas" && producto.subcategoria === "tratamiento");
        if (!tieneDiseno || !tieneTratamiento) {
          throw new Error("Completa el diseño y tratamiento de las micas.");
        }
      }
      const tieneTinte = carritoDetalle.some(({ producto }) => producto.tipo_mica === "tinte")
        || ventasSeleccionadas.includes("micas_tinte");
      if (tieneTinte && !ventaTinteGrado) {
        throw new Error("Selecciona el grado del tinte.");
      }

      const compraTokensBase = editingVentaId === null && me?.rol === "admin"
        ? compraTokensDesdeCarrito(ventaCarrito)
        : ventasSeleccionadas;
      const compraTokens = [
        ...compraTokensBase.filter((token) => !token.startsWith("tinte_grado_")),
        ...(tieneTinte && ventaTinteGrado ? [`tinte_${ventaTinteGrado}`] : []),
      ];
      if (compraTokens.length === 0) throw new Error("Selecciona al menos un producto.");

      const subtotalCarrito = carritoDetalle.reduce(
        (total, { producto, cantidad }) => total + Number(producto.precio || 0) * cantidad,
        0,
      );
      const subtotalVenta = editingVentaId === null && me?.rol === "admin"
        ? subtotalCarrito
        : Number(formVenta.subtotal || formVenta.monto_total || 0);
      const descuento = editingVentaId === null && me?.rol === "admin"
        ? ventaDescuentoPorcentaje
        : Number(formVenta.descuento_porcentaje || 0);
      if (descuento > 0 && !formVenta.descuento_motivo) {
        throw new Error("Selecciona el motivo del descuento.");
      }
      if (descuento > 0 && !formVenta.cupon_tipo) {
        throw new Error("Selecciona el tipo de cupón.");
      }
      const montoTotal = Number((subtotalVenta * (1 - descuento / 100)).toFixed(2));
      if (subtotalVenta <= 0) throw new Error("El carrito debe tener un subtotal mayor a 0.");
      if (requiereAdelanto && Number(formVenta.adelanto_monto || 0) > montoTotal) {
        throw new Error("El adelanto no puede ser mayor al total.");
      }

      const payload = cleanPayload({
        ...formVenta,
        sucursal_id: sucursalActivaId,
        compra: compraTokens.join("|"),
        subtotal: subtotalVenta,
        descuento_porcentaje: descuento,
        monto_total: montoTotal,
        metodo_pago: ventaMetodosPago.join("|"),
        forma_liquidacion: formaLiquidacion,
        adelanto_aplica: requiereAdelanto,
        adelanto_monto: requiereAdelanto ? Number(formVenta.adelanto_monto) : null,
        adelanto_metodo: requiereAdelanto ? formVenta.adelanto_metodo : null,
        ...(editingVentaId === null && me?.rol === "admin"
          ? {
              productos: ventaCarrito,
            }
          : {}),
      });

      const endpoint = editingVentaId === null ? "/ventas" : `/ventas/${editingVentaId}`;
      const method = editingVentaId === null ? "POST" : "PUT";
      const r = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await readErrorMessage(r));

      setFormVenta((prev) => ({
        ...prev,
        compra: "",
        subtotal: 0,
        descuento_porcentaje: 0,
        descuento_motivo: null,
        cupon_tipo: null,
        monto_total: 0,
        metodo_pago: "efectivo",
        forma_liquidacion: "pago_completo",
        adelanto_aplica: false,
        adelanto_monto: null,
        adelanto_metodo: null,
        como_nos_conocio: "",
        notas: "",
      }));
      resetVentaWizard();
      setEditingVentaId(null);
      loadVentas();
      if (me?.rol === "admin") {
        loadInventario();
      }
      setTab("ventas");
      setSuccessVentaMsg(editingVentaId === null ? "Venta guardada con éxito." : "Venta actualizada con éxito.");
      setTimeout(() => setSuccessVentaMsg(null), 3500);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingVenta(false);
    }
  }


  async function readErrorMessage(r: Response) {
    // Intenta JSON: {"detail": "..."}
    try {
      const data = await r.json();
      if (data && typeof data.detail === "string") return data.detail;
      return JSON.stringify(data);
    } catch {
      // Si no es JSON, regresa texto plano
      try {
        return await r.text();
      } catch {
        return `Error HTTP ${r.status}`;
      }
    }
  }




  async function verHistorial(paciente_id: number) {
    setHistPacienteId(paciente_id);
    setLoadingHist(true);
    setError(null);

    try {
      const r = await apiFetch(
        `/pacientes/${paciente_id}/consultas?sucursal_id=${sucursalActivaId}&limit=200`
      );


      if (!r.ok) throw new Error(await readErrorMessage(r));
      
      const data = await r.json();
      setHistConsultas(data);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setHistConsultas([]);
    } finally {
      setLoadingHist(false);
    }
  }

  async function loadMe() {
    try {
      const r = await apiFetch("/me");
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data = (await r.json()) as MeResponse;
      setMe(data);

      if (data.rol !== "admin" && data.sucursal_id) {
        setSucursalActivaId(data.sucursal_id);
      }
    } catch (e: any) {
      setMe(null);
      // 👇 No mostrar este error al arrancar (solo limpió token viejo)
      if (String(e?.message ?? e).includes("Tu sesión expiró")) {
        setError(null);
        return;
      }
      setError(e?.message ?? String(e));
    }
  }

  async function saveHistoriaClinica() {
    try {
      if (!historiaPacienteId) {
        throw new Error("No se encontró el paciente para guardar historia clínica.");
      }
      setError(null);
      const targetSucursalId = historiaSucursalId ?? sucursalActivaId;
      const doctorAtencion =
        composeDoctorAtencion(
          historiaData?.doctor_primer_nombre,
          historiaData?.doctor_apellido_paterno
        ) || String(historiaData?.doctor_atencion ?? "").trim();
      const puestoLaboralPayload = composeCantidadYTexto(
        historiaData?.puesto_laboral_cantidad,
        historiaData?.puesto_laboral
      );
      const antecedentesOtroGeneralPayload = composeCantidadYTexto(
        historiaData?.antecedentes_otro_general_cantidad,
        historiaData?.antecedentes_otro_general
      );
      const antecedentesOcularesFamiliaresOtroPayload = composeCantidadYTexto(
        historiaData?.antecedentes_oculares_familiares_otro_cantidad,
        historiaData?.antecedentes_oculares_familiares_otro
      );
      const recomendacionTratamientoPayload = composeCantidadYTexto(
        historiaData?.recomendacion_tratamiento_cantidad,
        historiaData?.recomendacion_tratamiento
      );
      const diagnosticoPrincipalSeleccionados = splitPipeList(historiaData?.diagnostico_principal ?? "");
      const diagnosticoPrincipal = joinPipeList(diagnosticoPrincipalSeleccionados);
      const diagnosticoPrincipalOtroRaw = String(historiaData?.diagnostico_principal_otro ?? "").trim();
      if (diagnosticoPrincipalSeleccionados.length === 0) {
        throw new Error("Diagnóstico principal es obligatorio (elige al menos una opción).");
      }
      if (diagnosticoPrincipalSeleccionados.includes("otro") && !diagnosticoPrincipalOtroRaw) {
        throw new Error("Escribe el detalle en 'Otro diagnóstico principal'.");
      }
      const diagnosticoPrincipalOtro = diagnosticoPrincipalSeleccionados.includes("otro") ? diagnosticoPrincipalOtroRaw : "";
      const diagnosticoSecundarioSeleccionados = splitPipeList(historiaData?.diagnosticos_secundarios ?? "");
      const diagnosticoSecundarioOtro = String(historiaData?.diagnosticos_secundarios_otro ?? "").trim();
      const diagnosticoPrincipalResumen = joinPipeList([
        ...diagnosticoPrincipalSeleccionados,
        ...(diagnosticoPrincipalOtro ? [`otro:${diagnosticoPrincipalOtro}`] : []),
      ]);
      const diagnosticoSecundarioResumen = joinPipeList([
        ...diagnosticoSecundarioSeleccionados,
        ...(diagnosticoSecundarioOtro ? [`otro_secundario:${diagnosticoSecundarioOtro}`] : []),
      ]);
      const diagnosticoGeneralPayload = joinHistoriaItems([
        diagnosticoPrincipalResumen ? `principal: ${diagnosticoPrincipalResumen}` : "",
        diagnosticoSecundarioResumen ? `secundarios: ${diagnosticoSecundarioResumen}` : "",
      ]);
      const antecedentesOtro = composeAntecedentesOtro(
        antecedentesOtroGeneralPayload,
        ""
      );
      const tabaquismoEstado = String(historiaData?.tabaquismo_estado ?? "").trim();
      const tabaquismoUnidadTiempo =
        String(historiaData?.tabaquismo_tiempo_consumo_unidad ?? "").trim().toLowerCase() === "meses"
          ? "meses"
          : "anios";
      const tabaquismoUnidadDesdeDejo =
        String(historiaData?.tabaquismo_tiempo_desde_dejo_unidad ?? "").trim().toLowerCase() === "meses"
          ? "meses"
          : "anios";
      const tabaquismoTiempoConsumoPayload = composeDurationWithUnit(
        historiaData?.tabaquismo_tiempo_consumo_valor,
        tabaquismoUnidadTiempo,
      );
      const tabaquismoTiempoDesdeDejoPayload = composeDurationWithUnit(
        tabaquismoEstado === "ex_fumador" ? historiaData?.tabaquismo_tiempo_desde_dejo_valor : "",
        tabaquismoUnidadDesdeDejo,
      );
      const alcoholEstado = String(historiaData?.alcohol_estado ?? "nunca").trim() || "nunca";
      const alcoholBebidasDia = normalizeDurationValue(historiaData?.alcohol_bebidas_dia ?? "");
      const alcoholTiempoValor = normalizeDurationValue(historiaData?.alcohol_tiempo_valor ?? "");
      const alcoholTiempoUnidad = String(historiaData?.alcohol_tiempo_unidad ?? "").trim().toLowerCase() === "meses" ? "meses" : "anios";
      const alcoholFrecuenciaPayload = JSON.stringify({
        estado: alcoholEstado,
        frecuencia_semana: String(historiaData?.alcohol_frecuencia_nivel ?? "").trim() || null,
        bebidas_semana: alcoholBebidasDia || null,
        tiempo_valor: alcoholTiempoValor || null,
        tiempo_unidad: alcoholTiempoUnidad,
      });
      const marihuanaEstado = String(historiaData?.marihuana_estado ?? "nunca").trim() || "nunca";
      const marihuanaFrecuencia = normalizeDurationValue(
        historiaData?.marihuana_frecuencia_semana ?? historiaData?.marihuana_frecuencia ?? "",
      );
      const marihuanaTiempoValor = normalizeDurationValue(historiaData?.marihuana_tiempo_valor ?? "");
      const marihuanaTiempoUnidad = String(historiaData?.marihuana_tiempo_unidad ?? "").trim().toLowerCase() === "meses" ? "meses" : "anios";
      const marihuanaFrecuenciaPayload = JSON.stringify({
        estado: marihuanaEstado,
        veces_semana: marihuanaFrecuencia || null,
        tiempo_valor: marihuanaTiempoValor || null,
        tiempo_unidad: marihuanaTiempoUnidad,
      });
      const drogasEstado = String(historiaData?.drogas_consumo_estado ?? historiaData?.drogas_consumo ?? "nunca").trim() || "nunca";
      const drogasEstadoDb =
        drogasEstado === "consumidor_actual"
          ? "actual"
          : drogasEstado === "exconsumidor"
            ? "pasado"
            : "nunca";
      const drogasFrecuenciaSemana = normalizeDurationValue(
        historiaData?.drogas_frecuencia_semana ?? historiaData?.drogas_frecuencia ?? "",
      );
      const drogasTiempoValor = normalizeDurationValue(historiaData?.drogas_tiempo_valor ?? "");
      const drogasTiempoUnidad = String(historiaData?.drogas_tiempo_unidad ?? "").trim().toLowerCase() === "meses" ? "meses" : "anios";
      const drogasFrecuenciaPayload = JSON.stringify({
        estado: drogasEstado,
        frecuencia_semana: drogasFrecuenciaSemana || null,
        tiempo: composeDurationWithUnit(drogasTiempoValor, drogasTiempoUnidad) || null,
      });
      const deporteFrecuencia = String(historiaData?.deporte_frecuencia ?? "").trim();
      const deporteTiposPayload = composeCantidadYTexto(
        historiaData?.deporte_tipos_cantidad,
        historiaData?.deporte_tipos
      );
      const deporteHorasDia = String(historiaData?.deporte_horas_dia ?? "").trim();
      const diabetesEstado = String(historiaData?.diabetes_estado ?? "").trim();
      const diabetesLegacy = ["tipo_1", "tipo_2", "prediabetes"].includes(diabetesEstado);
      const tipoDiabetesLegacy = diabetesLegacy ? diabetesEstado : (diabetesEstado === "no_sabe" ? "no_sabe" : "no_aplica");
      const usaLentes = historiaData?.usa_lentes === true;
      const tipoLentesActual = usaLentes ? String(historiaData?.tipo_lentes_actual ?? "").trim() : "";
      const tiempoUsoLentesPayload = composeTiempoUsoLentes(historiaData?.tiempo_uso_lentes_anios);
      const seguimientoRequerido = historiaData?.seguimiento_requerido === true;
      const seguimientoTipo = seguimientoRequerido ? "fecha" : "";
      const seguimientoValor = seguimientoRequerido
        ? String(historiaData?.seguimiento_valor ?? "").trim()
        : "";
      const sintomasSeleccionados = splitPipeList(historiaData?.sintomas ?? "");
      const sintomasOtrosCount = clampHistoriaCantidad(historiaData?.sintomas_otros_cantidad) ?? 0;
      const sintomasOtrosItems = resizeHistoriaItems(
        splitHistoriaItems(historiaData?.sintomas_otros ?? ""),
        sintomasOtrosCount
      );
      const sintomasPayload = joinSintomasForStorage(sintomasSeleccionados, sintomasOtrosItems);
      const payload = {
        paciente_id: historiaPacienteId,
        od_esfera: historiaData.od_esfera,
        od_cilindro: historiaData.od_cilindro,
        od_eje: historiaData.od_eje,
        od_add: historiaData.od_add,
        oi_esfera: historiaData.oi_esfera,
        oi_cilindro: historiaData.oi_cilindro,
        oi_eje: historiaData.oi_eje,
        oi_add: historiaData.oi_add,
        dp: historiaData.dp,
        queratometria_od: historiaData.queratometria_od,
        queratometria_oi: historiaData.queratometria_oi,
        presion_od: historiaData.presion_od,
        presion_oi: historiaData.presion_oi,
        paciente_fecha_nacimiento: historiaPacienteInfo?.fecha_nacimiento ?? null,
        paciente_edad: (() => {
          const edad = calcAge(historiaPacienteInfo?.fecha_nacimiento ?? null);
          return edad ? Number(edad) : null;
        })(),
        paciente_primer_nombre: historiaPacienteInfo?.primer_nombre ?? null,
        paciente_segundo_nombre: historiaPacienteInfo?.segundo_nombre ?? null,
        paciente_apellido_paterno: historiaPacienteInfo?.apellido_paterno ?? null,
        paciente_apellido_materno: historiaPacienteInfo?.apellido_materno ?? null,
        paciente_telefono: historiaPacienteInfo?.telefono ?? null,
        paciente_correo: historiaPacienteInfo?.correo ?? null,
        paciente_calle: historiaPacienteInfo?.calle ?? null,
        paciente_numero: historiaPacienteInfo?.numero ?? null,
        paciente_colonia: historiaPacienteInfo?.colonia ?? null,
        paciente_codigo_postal: historiaPacienteInfo?.codigo_postal ?? null,
        paciente_municipio: historiaPacienteInfo?.municipio ?? null,
        paciente_estado: historiaPacienteInfo?.estado_direccion ?? null,
        paciente_pais: historiaPacienteInfo?.pais ?? null,
        puesto_laboral: puestoLaboralPayload || null,
        doctor_atencion: doctorAtencion || null,
        historia: historiaData.historia,
        antecedentes: null,
        antecedentes_generales: historiaData.antecedentes_generales,
        antecedentes_familiares: null,
        antecedentes_otro: antecedentesOtro || null,
        antecedentes_oculares_familiares: historiaData.antecedentes_oculares_familiares,
        antecedentes_oculares_familiares_otro: antecedentesOcularesFamiliaresOtroPayload || null,
        alergias: composeCantidadYTexto(historiaData.alergias_cantidad, historiaData.alergias),
        enfermedades: composeCantidadYTexto(historiaData.enfermedades_cantidad, historiaData.enfermedades),
        cirugias: composeCantidadYTexto(historiaData.cirugias_cantidad, historiaData.cirugias),
        fumador_tabaco: tabaquismoEstado === "fumador_actual",
        fumador_marihuana: marihuanaEstado === "consumidor_actual",
        consumidor_alcohol: alcoholEstado === "consumidor_actual",
        diabetes: diabetesLegacy,
        tipo_diabetes: tipoDiabetesLegacy,
        deportista: Boolean(deporteFrecuencia && deporteFrecuencia !== "0"),
        horas_pantalla_dia: historiaData.horas_pantalla_dia,
        conduccion_nocturna_horas: historiaData.conduccion_nocturna_horas,
        exposicion_uv: historiaData.exposicion_uv,
        tabaquismo_estado: historiaData.tabaquismo_estado,
        tabaquismo_intensidad: historiaData.tabaquismo_intensidad,
        tabaquismo_anios: tabaquismoTiempoConsumoPayload || null,
        tabaquismo_anios_desde_dejo: tabaquismoTiempoDesdeDejoPayload || null,
        alcohol_frecuencia: alcoholFrecuenciaPayload,
        alcohol_copas: null,
        marihuana_frecuencia: marihuanaFrecuenciaPayload,
        marihuana_forma: historiaData.marihuana_forma,
        drogas_consumo: drogasEstadoDb,
        drogas_tipos: joinPipeList(splitPipeList(historiaData.drogas_tipos)),
        drogas_frecuencia: drogasFrecuenciaPayload,
        deporte_frecuencia: historiaData.deporte_frecuencia,
        deporte_duracion: deporteHorasDia || null,
        deporte_tipos: deporteTiposPayload || null,
        hipertension: historiaData.hipertension,
        medicamentos: composeCantidadYTexto(historiaData.medicamentos_cantidad, historiaData.medicamentos),
        diabetes_estado: historiaData.diabetes_estado,
        diabetes_control: historiaData.diabetes_control,
        diabetes_anios: historiaData.diabetes_anios,
        diabetes_tratamiento: joinPipeList(splitPipeList(historiaData.diabetes_tratamiento)),
        diabetes_tratamiento_otro: splitPipeList(historiaData.diabetes_tratamiento).includes("otro")
          ? String(historiaData.diabetes_tratamiento_otro ?? "").trim()
          : "",
        trabajo_cerca_horas_dia: historiaData.trabajo_cerca_horas_dia,
        distancia_promedio_pantalla_cm: historiaData.distancia_promedio_pantalla_cm,
        iluminacion_trabajo: historiaData.iluminacion_trabajo,
        fotofobia_escala: historiaData.fotofobia_escala,
        dolor_ocular_escala: historiaData.dolor_ocular_escala,
        cefalea_frecuencia: historiaData.cefalea_frecuencia,
        flotadores_destellos: historiaData.flotadores_destellos,
        flotadores_lateralidad: historiaData.flotadores_lateralidad,
        usa_lentes: historiaData.usa_lentes,
        tipo_lentes_actual: usaLentes ? (tipoLentesActual || null) : null,
        lentes_actuales_detalle: usaLentes
          ? JSON.stringify(
              parseLentesActualesDetalle(historiaData.lentes_pares).length
                ? parseLentesActualesDetalle(historiaData.lentes_pares)
                : [{ tipo: "", tratamientos: [], color_tinte: "", grado_tinte: "" }]
            )
          : null,
        tiempo_uso_lentes: usaLentes ? (tiempoUsoLentesPayload || null) : null,
        lentes_contacto_horas_dia: usaLentes ? historiaData.lentes_contacto_horas_dia : null,
        lentes_contacto_dias_semana: null,
        uso_lentes_proteccion_uv: historiaData.uso_lentes_proteccion_uv,
        uso_lentes_sol_frecuencia: historiaData.uso_lentes_sol_frecuencia,
        horas_exterior_dia: historiaData.horas_exterior_dia,
        uso_lentes_sol_horas_dia: historiaData.uso_lentes_sol_horas_dia,
        usa_lentes_manejar_dia: historiaData.usa_lentes_manejar_dia,
        tipo_lentes_manejar_dia: historiaData.usa_lentes_manejar_dia ? historiaData.tipo_lentes_manejar_dia : "",
        tratamientos_lentes_manejar_dia: historiaData.usa_lentes_manejar_dia
          ? joinPipeList(splitPipeList(historiaData.tratamientos_lentes_manejar_dia))
          : "",
        usa_lentes_manejar_noche: historiaData.usa_lentes_manejar_noche,
        tipo_lentes_manejar_noche: historiaData.usa_lentes_manejar_noche ? historiaData.tipo_lentes_manejar_noche : "",
        tratamientos_lentes_manejar_noche: historiaData.usa_lentes_manejar_noche
          ? joinPipeList(splitPipeList(historiaData.tratamientos_lentes_manejar_noche))
          : "",
        nivel_educativo: historiaData.nivel_educativo,
        horas_lectura_dia: historiaData.horas_lectura_dia,
        lee_libros: historiaData.lee_libros,
        horas_sueno_promedio: historiaData.horas_sueno_promedio,
        estres_nivel: historiaData.estres_nivel,
        peso_kg: historiaData.peso_kg === "" || historiaData.peso_kg == null ? null : Number(historiaData.peso_kg),
        altura_cm: historiaData.altura_cm === "" || historiaData.altura_cm == null ? null : Number(historiaData.altura_cm),
        sintomas_al_despertar: joinPipeList(splitPipeList(historiaData.sintomas_al_despertar)),
        sintomas_al_despertar_otro: historiaData.sintomas_al_despertar_otro,
        convive_mascotas: joinPipeList(splitPipeList(historiaData.convive_mascotas)),
        convive_mascotas_otro: historiaData.convive_mascotas_otro,
        uso_aire_acondicionado_frecuencia: historiaData.uso_aire_acondicionado_frecuencia,
        uso_aire_acondicionado_horas_dia: historiaData.uso_aire_acondicionado_horas_dia,
        uso_calefaccion_frecuencia: historiaData.uso_calefaccion_frecuencia,
        uso_calefaccion_horas_dia: historiaData.uso_calefaccion_horas_dia,
        uso_pantalla_en_oscuridad: historiaData.uso_pantalla_en_oscuridad,
        cafeina_por_dia: historiaData.cafeina_por_dia,
        sintomas: sintomasPayload,
        ppc: historiaData.ppc,
        lejos: historiaData.lejos,
        cerca: historiaData.cerca,
        tension: historiaData.tension,
        mmhg: historiaData.mmhg,
        di: historiaData.di,
        avsinrxod: historiaData.avsinrxod,
        avsinrixoi: historiaData.avsinrixoi,
        capvisualod: historiaData.capvisualod,
        capvisualoi: historiaData.capvisualoi,
        avrxantod: historiaData.avrxantod,
        avrxantoi: historiaData.avrxantoi,
        queraod: historiaData.queraod,
        queraoi: historiaData.queraoi,
        retinosod: historiaData.retinosod,
        retinosoi: historiaData.retinosoi,
        subjeod: historiaData.subjeod,
        subjeoi: historiaData.subjeoi,
        adicionod: historiaData.adicionod,
        adicionoi: historiaData.adicionoi,
        papila: historiaData.papila,
        biomicroscopia: historiaData.biomicroscopia,
        diagnostico_general: diagnosticoGeneralPayload || null,
        diagnostico_principal: diagnosticoPrincipal,
        diagnostico_principal_otro: diagnosticoPrincipalOtro || null,
        diagnosticos_secundarios: joinPipeList(diagnosticoSecundarioSeleccionados),
        diagnosticos_secundarios_otro: diagnosticoSecundarioOtro || null,
        recomendacion_tratamiento: recomendacionTratamientoPayload || null,
        seguimiento_requerido: historiaData.seguimiento_requerido,
        seguimiento_tipo: seguimientoTipo || null,
        seguimiento_valor: seguimientoValor || null,
        observaciones: historiaData.observaciones,
      };
      const isExistingHistoria = Number(historiaData?.historia_id) > 0;
      const endpoint = `/pacientes/${historiaPacienteId}/historia?sucursal_id=${targetSucursalId}`;

      let r = await apiFetch(endpoint, {
        method: isExistingHistoria ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      if (!r.ok && isExistingHistoria && r.status === 404) {
        r = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data = await r.json();
      setHistoriaData(normalizeHistoriaForUi(data, ""));
      if (historiaPacienteId) {
        setHistoriaEstadoPaciente((prev) => ({
          ...prev,
          [historiaPacienteId]: "exists",
        }));
      }
      closeHistoriaModal();
      setSuccessHistoriaMsg("Historia clínica guardada con éxito.");
      setTimeout(() => setSuccessHistoriaMsg(null), 3500);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }




  async function doLogin(e: FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setError(null);

    try {
      const r = await fetchWithRetry(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      }, "/login");
      if (!r.ok) throw new Error(await readErrorMessage(r));

      const data = (await r.json()) as LoginResponse;
      setToken(data.access_token);

      setLoginPass("");

      await loadMe(); // llena me
      loadSucursales();

    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    clearToken();
    setMe(null);
    setLoginUser("");
    setLoginPass("");
  }




  if (!me) {
    return (
      <div
        className="olm-login-page"
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "linear-gradient(145deg, #eef7f6 0%, #f8fafc 48%, #edf3fa 100%)",
          ...LOGIN_SCALE_STYLE,
        }}
      >
        <div style={{ width: "100%", maxWidth: 460, fontFamily: "system-ui" }}>
          <div style={{ display: "grid", justifyItems: "center", gap: 8, marginBottom: 12 }}>
            <img
              src={logoOlm}
              alt="Óptica OLM"
              style={{
                height: "clamp(90px, 11vw, 150px)",
                width: "auto",
                maxWidth: "80vw",
                objectFit: "contain",
                mixBlendMode: "multiply",
                filter: "contrast(1.08) saturate(1.06)",
              }}
            />
            <div style={{ opacity: 0.8 }}>Inicia sesión</div>
          </div>

          <form className="olm-login-card" onSubmit={doLogin} style={{ border: "1px solid #dbe7ec", borderRadius: 24, background: "rgba(255,255,255,.92)", padding: 28 }}>
            <label style={{ display: "block", marginBottom: 10 }}>
              Usuario
              <input
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                autoFocus
              />
            </label>

            <label style={{ display: "block", marginBottom: 10 }}>
              Contraseña
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <button
              type="submit"
              disabled={loggingIn}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #0f766e",
                background: loggingIn ? "#dfe9e8" : "linear-gradient(135deg, #0f766e, #15978d)",
                color: loggingIn ? "#526b7b" : "#fff",
                fontWeight: 800,
                boxShadow: loggingIn ? "none" : "0 10px 24px rgba(15, 118, 110, .24)",
                cursor: loggingIn ? "not-allowed" : "pointer",
              }}
            >
              {loggingIn ? "Entrando..." : "Entrar"}
            </button>
          </form>



          {error && (
            <div style={{ marginTop: 14, padding: 12, border: "1px solid #f00", borderRadius: 10 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isAdmin = me.rol === "admin";
  const isRecep = me.rol === "recepcion";
  const isDoctor = me.rol === "doctor";
  const sessionUser = String(me.username || "").trim().toLowerCase();
  const hideVentasTabUsers = new Set(["edomex_doc", "playa_doc"]);
  const hideVentasMetodoPieUsers = new Set(["edomex_doc", "playa_doc"]);
  const hideVentasPeriodoKpiUsers = new Set(["edomex_doc", "playa_doc"]);
  const hideMoneyMonthlyChartUsers = new Set(["edomex_doc", "playa_doc", "playa_recep", "edomex_recep"]);
  const hideTopPacientesUsers = new Set(["edomex_doc", "playa_doc"]);
  const canViewVentasTab = !hideVentasTabUsers.has(sessionUser);
  const canViewVentasMetodoPie = !hideVentasMetodoPieUsers.has(sessionUser);
  const canViewVentasPeriodoKpi = !hideVentasPeriodoKpiUsers.has(sessionUser);
  const canViewMoneyMonthlyChart = !hideMoneyMonthlyChartUsers.has(sessionUser);
  const canViewTopPacientesMes = !hideTopPacientesUsers.has(sessionUser);
  const canViewVentasCantidadMensualChart = isAdmin || isRecep;
  const canViewHistoriaTab = isAdmin || isDoctor;

  const canCreatePaciente = isAdmin || isRecep || isDoctor;
  const canEditPaciente = isAdmin || isRecep || isDoctor;
  const canDeletePaciente = isAdmin;

  const canCreateConsulta = isAdmin || isDoctor || isRecep;
  const canEditConsulta = isAdmin || isDoctor || isRecep;
  const canDeleteConsulta = isAdmin || isDoctor || isRecep;
  const canCreateVenta = canViewVentasTab && (isAdmin || isDoctor || isRecep);
  const canEditVenta = canViewVentasTab && (isAdmin || isDoctor || isRecep);
  const canDeleteVenta = canViewVentasTab && isAdmin;
  const productosPor = (categoria: string, subcategoria?: string) =>
    inventario.filter(
      (producto) =>
        producto.categoria === categoria
        && (subcategoria === undefined || producto.subcategoria === subcategoria),
    );
  const ventaArmazonesOpticos = productosPor("lentes_opticos", "armazon");
  const ventaLentesSol = productosPor("lentes_de_sol", "armazon");
  const ventaGraduacionSol = productosPor("lentes_de_sol", "graduacion");
  const ventaMicasBase = productosPor("micas", "base");
  const ventaMicasDisenos = productosPor("micas", "diseno");
  const ventaMicasTratamientos = productosPor("micas", "tratamiento");
  const ventaTratamientoSin = ventaMicasTratamientos.find((producto) => producto.tipo_mica === "sin_tratamiento");
  const ventaTratamientoAntirreflejante = ventaMicasTratamientos.find((producto) => producto.tipo_mica === "antirreflejante");
  const ventaTratamientoFotocromatico = ventaMicasTratamientos.find((producto) => producto.tipo_mica === "fotocromatico");
  const ventaTratamientosAntiblue = ventaMicasTratamientos.filter((producto) => producto.tipo_mica === "antiblueray");
  const ventaTratamientosTinte = ventaMicasTratamientos.filter((producto) => producto.tipo_mica === "tinte");
  const ventaExamenes = productosPor("examen_de_la_vista");
  const ventaContactos = productosPor("lentes_de_contacto");
  const ventaAccesorios = productosPor("accesorios_y_refacciones");
  const ventaCuidados = productosPor("soluciones_y_cuidado");
  const ventaCarritoDetalle = ventaCarrito
    .map((item) => {
      const producto = inventario.find((row) => row.producto_id === item.producto_id);
      return producto ? { ...item, producto } : null;
    })
    .filter((item): item is VentaCarritoItem & { producto: InventarioProducto } => Boolean(item));
  const ventaCarritoIds = new Set(ventaCarrito.map((item) => item.producto_id));
  const ventaArmazonSeleccionado = ventaArmazonesOpticos.find((producto) => ventaCarritoIds.has(producto.producto_id));
  const ventaDisenoSeleccionado = ventaMicasDisenos.find((producto) => ventaCarritoIds.has(producto.producto_id));
  const ventaTratamientoSeleccionado = ventaMicasTratamientos.find((producto) => ventaCarritoIds.has(producto.producto_id));
  const ventaTinteSeleccionado = ventaTratamientoSeleccionado?.tipo_mica === "tinte"
    ? ventaTratamientoSeleccionado
    : undefined;
  const ventaAntiblueSeleccionado = ventaTratamientoSeleccionado?.tipo_mica === "antiblueray"
    ? ventaTratamientoSeleccionado
    : undefined;
  const ventaSubtotalCarrito = ventaCarritoDetalle.reduce(
    (total, item) => total + Number(item.producto.precio || 0) * item.cantidad,
    0,
  );
  const ventaSubtotalResumen = editingVentaId !== null
    ? Number(formVenta.subtotal ?? formVenta.monto_total ?? 0)
    : ventaSubtotalCarrito;
  const ventaDescuentoMonto = Number(
    (ventaSubtotalResumen * ventaDescuentoPorcentaje / 100).toFixed(2),
  );
  const ventaTotalCarrito = Number(
    Math.max(0, ventaSubtotalResumen - ventaDescuentoMonto).toFixed(2),
  );
  const ventaDeposito = formVenta.adelanto_aplica
    ? Math.max(0, Number(formVenta.adelanto_monto || 0))
    : 0;
  const ventaSaldo = Math.max(0, ventaTotalCarrito - ventaDeposito);
  const inventarioVisible = inventario.filter(
    (producto) => producto.categoria !== "micas",
  );
  const inventarioStockBajo = inventarioVisible.filter(
    (producto) => producto.controla_stock && producto.stock <= producto.stock_minimo
  ).length;
  const inventarioCategorias = Array.from(
    new Set(inventarioVisible.map((producto) => producto.categoria)),
  );
  const inventarioFiltrado = inventarioVisible.filter((producto) => {
    if (
      inventarioCategoriaFiltro !== "todos"
      && producto.categoria !== inventarioCategoriaFiltro
    ) return false;
    const q = normalizeForSearch(inventarioBusqueda);
    if (!q) return true;
    return normalizeForSearch(
      [
        producto.producto_id,
        producto.sku,
        producto.nombre,
        producto.modelo,
        producto.color,
        producto.categoria,
        producto.subcategoria,
        producto.tipo_mica,
      ].join(" "),
    ).includes(q);
  });
  const inventarioGrupos = inventarioCategorias
    .map((categoria) => ({
      categoria,
      productos: inventarioFiltrado.filter((producto) => producto.categoria === categoria),
    }))
    .filter((grupo) => grupo.productos.length > 0);

  const renderVentaProductoButton = (
    producto: InventarioProducto,
    onClick: () => void,
    selected = ventaCarritoIds.has(producto.producto_id),
  ) => {
    const agotado = producto.controla_stock && producto.stock <= 0;
    const esMica = producto.categoria === "micas";
    return (
      <button
        key={producto.producto_id}
        type="button"
        disabled={agotado || editingVentaId !== null}
        onClick={onClick}
        aria-pressed={selected}
        style={{
          display: "grid",
          gridTemplateColumns: esMica ? "minmax(0, 1fr)" : "82px minmax(0, 1fr)",
          gap: 10,
          alignItems: "center",
          minHeight: esMica ? 70 : 102,
          padding: esMica ? "10px 12px" : 9,
          border: selected ? "2px solid #1677d2" : "1px solid #cdddeb",
          background: selected ? "#edf6ff" : agotado ? "#f4f5f6" : "#fff",
          textAlign: "left",
          cursor: agotado || editingVentaId !== null ? "not-allowed" : "pointer",
          opacity: agotado ? 0.62 : 1,
          boxShadow: selected ? "0 8px 20px rgba(37,99,235,.12)" : "none",
        }}
      >
        {!esMica && (
          <span style={{ width: 82, height: 82, overflow: "hidden", background: "#f5f7f9", border: "1px solid #e2e8ee" }}>
            {producto.imagen_url ? (
              <img
                src={producto.imagen_url}
                alt={producto.nombre}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8aa0b2", fontSize: 26 }}>◇</span>
            )}
          </span>
        )}
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", color: "#173b61", lineHeight: 1.2 }}>{producto.nombre}</strong>
          <span style={{ display: "block", marginTop: 3, color: "#6b7f93", fontSize: 11 }}>
            {producto.modelo || producto.sku}
            {producto.color ? ` · ${producto.color}` : ""}
          </span>
          <strong style={{ display: "block", marginTop: 6, color: "#0e5fa8" }}>
            {Number(producto.precio || 0) === 0 ? "+$0" : `+$${Number(producto.precio).toFixed(2)}`}
          </strong>
          {!esMica && (
            <span style={{ display: "block", marginTop: 3, fontSize: 10, fontWeight: 800, color: agotado ? "#991b1b" : "#547087" }}>
              {producto.controla_stock
                ? (agotado ? "AGOTADO" : `${producto.stock} EN EXISTENCIA`)
                : "SERVICIO / ADICIONAL"}
            </span>
          )}
        </span>
      </button>
    );
  };

  const renderVentaPagoLiquidacion = () => (
    <section style={{ display: "grid", gap: 12, marginTop: 12, padding: 12, border: "1px solid #cbdcf0", background: "#fff" }}>
      <div>
        <div style={{ marginBottom: 7, fontWeight: 900, color: "#16385d" }}>Método de pago *</div>
        <div role="group" aria-label="Métodos de pago" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {VENTA_METODO_PAGO_OPTIONS.map((opcion) => {
            const seleccionado = ventaMetodosPago.includes(opcion.value);
            return (
              <button
                key={opcion.value}
                type="button"
                aria-pressed={seleccionado}
                onClick={() => {
                  setVentaMetodosPago((prev) => {
                    const next = seleccionado
                      ? prev.filter((item) => item !== opcion.value)
                      : [...prev, opcion.value];
                    setFormVenta((curr) => ({ ...curr, metodo_pago: next.join("|") }));
                    return next;
                  });
                }}
                style={{
                  padding: "8px 11px",
                  borderRadius: 999,
                  border: seleccionado ? "1px solid #1667ba" : "1px solid #cbd8e4",
                  background: seleccionado ? "#1677d2" : "#f7fafc",
                  color: seleccionado ? "#fff" : "#31475d",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {seleccionado ? "✓ " : ""}{opcion.label}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 5, color: "#718397", fontSize: 11 }}>
          Puedes seleccionar más de un método.
        </div>
      </div>

      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 6, fontWeight: 900, color: "#16385d" }}>Forma de liquidación *</span>
        <select
          value={formVenta.forma_liquidacion ?? "pago_completo"}
          onChange={(e) => {
            const forma = e.target.value as VentaFormaLiquidacion;
            const aplica = forma === "adelanto_apartado" || forma === "pago_mixto";
            setFormVenta({
              ...formVenta,
              forma_liquidacion: forma,
              adelanto_aplica: aplica,
              adelanto_monto: aplica ? formVenta.adelanto_monto ?? null : null,
              adelanto_metodo: aplica ? formVenta.adelanto_metodo ?? "efectivo" : null,
            });
          }}
          style={{ width: "100%", padding: 10, border: "1px solid #b9cce0", background: "#fff" }}
        >
          {VENTA_FORMA_LIQUIDACION_OPTIONS.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
          ))}
        </select>
      </label>

      {formVenta.adelanto_aplica && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 800, color: "#40566c" }}>Monto adelanto (MXN) *</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={formVenta.adelanto_monto ?? ""}
              onChange={(e) =>
                setFormVenta({
                  ...formVenta,
                  adelanto_monto: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              style={{ width: "100%", padding: 10, border: "1px solid #b9cce0" }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 800, color: "#40566c" }}>Método adelanto *</span>
            <select
              value={formVenta.adelanto_metodo ?? "efectivo"}
              onChange={(e) =>
                setFormVenta({
                  ...formVenta,
                  adelanto_metodo: e.target.value as VentaMetodoPago,
                })
              }
              style={{ width: "100%", padding: 10, border: "1px solid #b9cce0", background: "#fff" }}
            >
              {VENTA_METODO_PAGO_OPTIONS.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );

  const renderVentaResumenProductos = () => (
    <section style={{ position: "sticky", top: 12, padding: 14, border: "1px solid #b8d3ec", background: "#f8fbff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 900, color: "#16385d" }}>Resumen de productos</div>
          <div style={{ fontSize: 12, color: "#6b7f93" }}>{ventaCarritoDetalle.length} producto(s) diferente(s)</div>
        </div>
        {ventaCarritoDetalle.length > 0 && (
          <button
            type="button"
            onClick={() => setVentaCarrito([])}
            style={{ ...actionBtnStyle, padding: "7px 10px" }}
          >
            Vaciar carrito
          </button>
        )}
      </div>

      {(ventaArmazonSeleccionado || ventaDisenoSeleccionado || ventaTratamientoSeleccionado) && (
        <div style={{ display: "grid", gap: 5, marginBottom: 10, padding: 10, border: "1px solid #dbe6ef", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
            <span style={{ color: "#6b7f93" }}>Armazón</span>
            <strong style={{ textAlign: "right", color: "#31475d" }}>
              {ventaArmazonSeleccionado
                ? `${ventaArmazonSeleccionado.nombre} · $${Number(ventaArmazonSeleccionado.precio).toFixed(2)}`
                : "Pendiente"}
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
            <span style={{ color: "#6b7f93" }}>Diseño</span>
            <strong style={{ textAlign: "right", color: "#31475d" }}>
              {ventaDisenoSeleccionado
                ? `${ventaDisenoSeleccionado.nombre} · +$${Number(ventaDisenoSeleccionado.precio).toFixed(2)}`
                : "Pendiente"}
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
            <span style={{ color: "#6b7f93" }}>Tratamiento / tinte</span>
            <strong style={{ textAlign: "right", color: "#31475d" }}>
              {ventaTratamientoSeleccionado
                ? `${ventaTratamientoSeleccionado.nombre}${ventaTinteGrado ? ` · ${ventaTinteGrado.replace("_", " ")}` : ""} · +$${Number(ventaTratamientoSeleccionado.precio).toFixed(2)}`
                : "Pendiente"}
            </strong>
          </div>
        </div>
      )}

      {ventaCarritoDetalle.length === 0 ? (
        <div style={{ padding: 18, border: "1px dashed #b9cde0", background: "#fff", color: "#6b7f93", textAlign: "center" }}>
          Selecciona productos del catálogo para comenzar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 7 }}>
          {ventaCarritoDetalle.map(({ producto, cantidad }) => {
            const esMica = producto.categoria === "micas";
            return (
              <div
                key={producto.producto_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: esMica
                    ? "minmax(0, 1fr) 66px 92px 32px"
                    : "52px minmax(0, 1fr) 66px 92px 32px",
                  gap: 8,
                  alignItems: "center",
                  padding: 8,
                  border: "1px solid #dbe6ef",
                  background: "#fff",
                }}
              >
                {!esMica && (
                  <div style={{ width: 52, height: 46, overflow: "hidden", border: "1px solid #e3e9ee", background: "#f5f7f9" }}>
                    {producto.imagen_url ? (
                      <img src={producto.imagen_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8aa0b2" }}>◇</span>
                    )}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", color: "#173b61", lineHeight: 1.2 }}>{producto.nombre}</strong>
                  <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "#6b7f93" }}>{producto.sku}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={producto.controla_stock ? producto.stock : 99}
                  value={cantidad}
                  onChange={(e) => actualizarCantidadCarrito(producto, Number(e.target.value))}
                  aria-label={`Cantidad de ${producto.nombre}`}
                  style={{ width: "100%", padding: 7, border: "1px solid #b9cce0" }}
                />
                <strong style={{ textAlign: "right", color: "#174ea6" }}>
                  ${(Number(producto.precio || 0) * cantidad).toFixed(2)}
                </strong>
                <button
                  type="button"
                  onClick={() => quitarProductoCarrito(producto.producto_id)}
                  aria-label={`Quitar ${producto.nombre}`}
                  title="Quitar"
                  style={{ width: 30, height: 30, border: "1px solid #fecaca", background: "#fff5f5", color: "#b91c1c", cursor: "pointer", fontWeight: 900 }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {renderVentaPagoLiquidacion()}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, alignItems: "end" }}>
        <label style={{ display: "block", fontWeight: 800, color: "#31475d" }}>
          Cupón / descuento (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={ventaDescuentoPorcentaje}
            onChange={(e) => {
              const next = Math.min(100, Math.max(0, Number(e.target.value) || 0));
              setVentaDescuentoPorcentaje(next);
              setFormVenta((curr) => ({
                ...curr,
                descuento_porcentaje: next,
                descuento_motivo: next > 0 ? curr.descuento_motivo : null,
                cupon_tipo: next > 0 ? curr.cupon_tipo : null,
              }));
            }}
            style={{ width: "100%", marginTop: 5, padding: 9, border: "1px solid #b9cce0" }}
          />
          <span style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
            {[0, 5, 10, 15, 20, 25, 50].map((porcentaje) => (
              <button
                key={porcentaje}
                type="button"
                onClick={() => {
                  setVentaDescuentoPorcentaje(porcentaje);
                  setFormVenta((curr) => ({
                    ...curr,
                    descuento_porcentaje: porcentaje,
                    descuento_motivo: porcentaje > 0 ? curr.descuento_motivo : null,
                    cupon_tipo: porcentaje > 0 ? curr.cupon_tipo : null,
                  }));
                }}
                style={{
                  padding: "5px 8px",
                  border: ventaDescuentoPorcentaje === porcentaje ? "1px solid #1677d2" : "1px solid #cfdbe6",
                  background: ventaDescuentoPorcentaje === porcentaje ? "#ddebff" : "#fff",
                  color: "#174ea6",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                {porcentaje}%
              </button>
            ))}
          </span>
          {ventaDescuentoPorcentaje > 0 && (
            <span style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <span>
                <span style={{ display: "block", marginBottom: 6, color: "#40566c", fontSize: 12 }}>
                  Motivo del descuento *
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {VENTA_DESCUENTO_MOTIVO_OPTIONS.map((opcion) => {
                    const activo = formVenta.descuento_motivo === opcion.value;
                    return (
                      <button
                        key={opcion.value}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setFormVenta((curr) => ({ ...curr, descuento_motivo: opcion.value }))}
                        style={{
                          padding: "7px 10px",
                          border: activo ? "1px solid #1565c0" : "1px solid #cbd8e4",
                          background: activo ? "#1565c0" : "#fff",
                          color: activo ? "#fff" : "#40566c",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {opcion.label}
                      </button>
                    );
                  })}
                </span>
              </span>
              <span>
                <span style={{ display: "block", marginBottom: 6, color: "#40566c", fontSize: 12 }}>
                  Tipo de cupón *
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {VENTA_CUPON_TIPO_OPTIONS.map((opcion) => {
                    const activo = formVenta.cupon_tipo === opcion.value;
                    return (
                      <button
                        key={opcion.value}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setFormVenta((curr) => ({ ...curr, cupon_tipo: opcion.value }))}
                        style={{
                          padding: "7px 10px",
                          border: activo ? "1px solid #0f766e" : "1px solid #cbd8e4",
                          background: activo ? "#0f766e" : "#fff",
                          color: activo ? "#fff" : "#40566c",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {opcion.label}
                      </button>
                    );
                  })}
                </span>
              </span>
            </span>
          )}
        </label>
        <div style={{ padding: 12, background: "#102f50", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
            <span>Subtotal</span><strong>${ventaSubtotalResumen.toFixed(2)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 13, color: "#a9d5ff" }}>
            <span>Descuento ({ventaDescuentoPorcentaje}%)</span><strong>−${ventaDescuentoMonto.toFixed(2)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 13, color: "#cbdff3" }}>
            <span>Adelanto</span><strong>−${ventaDeposito.toFixed(2)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 13, color: "#fff" }}>
            <span>Saldo pendiente</span><strong>${ventaSaldo.toFixed(2)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,.22)", fontSize: 19 }}>
            <span>Total</span><strong>${ventaTotalCarrito.toFixed(2)} MXN</strong>
          </div>
        </div>
      </div>
    </section>
  );

  const renderFlujoLentesOpticos = () => {
    const precioTratamientoAzul = Number(ventaTratamientosAntiblue[0]?.precio || 0);
    const tratamientoEsSinOTinte = ventaTratamientoSeleccionado?.tipo_mica === "sin_tratamiento"
      || ventaTratamientoSeleccionado?.tipo_mica === "tinte";
    const resumenPaso = (
      etiqueta: string,
      producto: InventarioProducto | undefined,
      paso: number,
      detalle?: string,
    ) => (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 10, background: "#f4f8fc" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ display: "block", color: "#6b7f93", fontSize: 11, fontWeight: 900 }}>{etiqueta}</span>
          <strong style={{ display: "block", marginTop: 2, color: "#173b61" }}>
            {producto?.nombre || "Pendiente"}
          </strong>
          {producto && (
            <span style={{ display: "block", marginTop: 2, color: "#0e5fa8", fontSize: 12 }}>
              {Number(producto.precio || 0) === 0 ? "+$0" : `+$${Number(producto.precio).toFixed(2)}`}
              {detalle ? ` · ${detalle}` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setVentaLentesPaso(paso)}
          style={{ ...actionBtnStyle, padding: "7px 10px", flex: "0 0 auto" }}
        >
          Editar
        </button>
      </div>
    );

    return (
      <div style={{ display: "grid", gap: 8 }}>
        <section style={{ border: ventaLentesPaso === 1 ? "2px solid #1677d2" : "1px solid #cbd8e4", background: "#fff" }}>
          {ventaLentesPaso === 1 ? (
            <div style={{ padding: 11 }}>
              <div style={{ marginBottom: 8, fontWeight: 900, color: "#173b61" }}>1. Selecciona el armazón</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 7 }}>
                {ventaArmazonesOpticos.map((producto) =>
                  renderVentaProductoButton(
                    producto,
                    () => seleccionarArmazonFlujoOptico(producto),
                  ),
                )}
              </div>
            </div>
          ) : (
            resumenPaso("PASO 1 · ARMAZÓN", ventaArmazonSeleccionado, 1)
          )}
        </section>

        {ventaArmazonSeleccionado && (
          <section style={{ border: ventaLentesPaso === 2 ? "2px solid #1677d2" : "1px solid #cbd8e4", background: "#fff" }}>
            {ventaLentesPaso === 2 ? (
              <div style={{ padding: 11 }}>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#173b61" }}>2. Selecciona el diseño de la mica</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 7 }}>
                  {ventaMicasDisenos.map((producto) =>
                    renderVentaProductoButton(
                      producto,
                      () => seleccionarDisenoFlujoOptico(producto),
                    ),
                  )}
                </div>
              </div>
            ) : (
              resumenPaso("PASO 2 · DISEÑO", ventaDisenoSeleccionado, 2)
            )}
          </section>
        )}

        {ventaDisenoSeleccionado && (
          <section style={{ border: ventaLentesPaso === 3 ? "2px solid #1677d2" : "1px solid #cbd8e4", background: "#fff" }}>
            {ventaLentesPaso === 3 ? (
              <div style={{ padding: 11 }}>
                <div style={{ marginBottom: 3, fontWeight: 900, color: "#173b61" }}>3. Selecciona un tratamiento</div>
                <div style={{ marginBottom: 9, color: "#718397", fontSize: 11 }}>Solo puedes seleccionar una opción.</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 7 }}>
                  {ventaTratamientoSin && renderVentaProductoButton(
                    ventaTratamientoSin,
                    () => {
                      seleccionarTratamientoFlujoOptico(ventaTratamientoSin);
                      setVentaAgregarTinte(false);
                      setVentaTinteGrado("");
                    },
                    tratamientoEsSinOTinte,
                  )}
                  {ventaTratamientoAntirreflejante && renderVentaProductoButton(
                    ventaTratamientoAntirreflejante,
                    () => seleccionarTratamientoFlujoOptico(ventaTratamientoAntirreflejante),
                  )}
                  {ventaTratamientoFotocromatico && renderVentaProductoButton(
                    ventaTratamientoFotocromatico,
                    () => seleccionarTratamientoFlujoOptico(ventaTratamientoFotocromatico),
                  )}
                  {ventaTratamientosAntiblue[0] && renderVentaProductoButton(
                    {
                      ...ventaTratamientosAntiblue[0],
                      nombre: "Filtro de luz azul",
                      color: null,
                    },
                    () => {
                      const idsTratamientos = new Set(
                        ventaMicasTratamientos.map((producto) => producto.producto_id),
                      );
                      setVentaCarrito((prev) =>
                        prev.filter((item) => !idsTratamientos.has(item.producto_id)),
                      );
                      setVentaMostrarAntiblue(true);
                      setVentaAgregarTinte(false);
                      setVentaTinteGrado("");
                      setVentaLentesPaso(3);
                    },
                    ventaMostrarAntiblue || Boolean(ventaAntiblueSeleccionado),
                  )}
                </div>

                {(ventaMostrarAntiblue || ventaAntiblueSeleccionado) && (
                  <div style={{ marginTop: 10, padding: 10, border: "1px solid #cfe0f0", background: "#f7fbff" }}>
                    <div style={{ marginBottom: 7, fontWeight: 900, color: "#31475d" }}>Color del reflejo</div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {ventaTratamientosAntiblue.map((producto) => {
                        const selected = ventaCarritoIds.has(producto.producto_id);
                        return (
                          <button
                            key={producto.producto_id}
                            type="button"
                            onClick={() => {
                              seleccionarTratamientoFlujoOptico(producto);
                              setVentaMostrarAntiblue(false);
                            }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 999,
                              border: selected ? "2px solid #1677d2" : "1px solid #cbd8e4",
                              background: selected ? "#e7f2ff" : "#fff",
                              color: "#173b61",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ display: "inline-block", width: 12, height: 12, marginRight: 6, borderRadius: 999, background: producto.color === "Verde" ? "#35a56a" : "#3478cf", verticalAlign: -1 }} />
                            {producto.color} · +${precioTratamientoAzul.toFixed(2)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {tratamientoEsSinOTinte && (
                  <div style={{ marginTop: 10 }}>
                    {!ventaAgregarTinte && !ventaTinteSeleccionado ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVentaAgregarTinte(true);
                          setVentaLentesPaso(3);
                        }}
                        style={{ padding: "9px 13px", border: "1px solid #8a5a24", background: "#fff8ed", color: "#784718", fontWeight: 900, cursor: "pointer" }}
                      >
                        + Agregar tinte
                      </button>
                    ) : (
                      <div style={{ padding: 10, border: "1px solid #ead4b7", background: "#fffaf3" }}>
                        <div style={{ marginBottom: 7, fontWeight: 900, color: "#5f4326" }}>Color del tinte</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 6 }}>
                          {ventaTratamientosTinte.map((producto) => {
                            const selected = ventaCarritoIds.has(producto.producto_id);
                            const color = VENTA_TINTE_COLORES[producto.color || ""] || "#8b95a1";
                            return (
                              <button
                                key={producto.producto_id}
                                type="button"
                                onClick={() => {
                                  seleccionarTratamientoFlujoOptico(
                                    producto,
                                    { mantenerAbierto: true, esTinte: true },
                                  );
                                  setVentaTinteGrado("");
                                }}
                                style={{
                                  padding: 8,
                                  border: selected ? "2px solid #1677d2" : "1px solid #d6c7b7",
                                  background: selected ? "#edf6ff" : "#fff",
                                  color: "#31475d",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ display: "block", width: 22, height: 22, margin: "0 auto 5px", borderRadius: 999, background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)" }} />
                                {producto.color}
                              </button>
                            );
                          })}
                        </div>

                        {ventaTinteSeleccionado && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ marginBottom: 6, fontWeight: 900, color: "#5f4326" }}>Grado del tinte</div>
                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                              {(["grado_1", "grado_2", "grado_3"] as VentaTinteGrado[]).map((grado) => (
                                <button
                                  key={grado}
                                  type="button"
                                  onClick={() => {
                                    setVentaTinteGrado(grado);
                                    setVentaLentesPaso(0);
                                  }}
                                  style={{
                                    padding: "8px 13px",
                                    borderRadius: 999,
                                    border: ventaTinteGrado === grado ? "2px solid #1677d2" : "1px solid #cbd8e4",
                                    background: ventaTinteGrado === grado ? "#1677d2" : "#fff",
                                    color: ventaTinteGrado === grado ? "#fff" : "#31475d",
                                    fontWeight: 900,
                                    cursor: "pointer",
                                  }}
                                >
                                  {grado.replace("_", " ")}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {resumenPaso(
                  ventaTinteSeleccionado ? "PASO 3 · TINTE" : "PASO 3 · TRATAMIENTO",
                  ventaTratamientoSeleccionado,
                  3,
                  ventaTinteGrado ? ventaTinteGrado.replace("_", " ") : undefined,
                )}
                {ventaTratamientoSeleccionado?.tipo_mica === "sin_tratamiento" && (
                  <div style={{ padding: "0 10px 10px", background: "#f4f8fc" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setVentaAgregarTinte(true);
                        setVentaLentesPaso(3);
                      }}
                      style={{ padding: "7px 10px", border: "1px solid #8a5a24", background: "#fff8ed", color: "#784718", fontWeight: 900, cursor: "pointer" }}
                    >
                      + Agregar tinte
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    );
  };

  const softCard = {
    border: "1px solid #e7d7c7",
    borderRadius: 16,
    background: "#fffaf4",
    boxShadow: "0 10px 24px rgba(103, 78, 55, 0.08)",
  } as const;

  const actionBtnStyle = {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #d9c7b3",
    background: "#fff",
    color: "#4a3828",
    fontWeight: 700,
    cursor: "pointer",
  } as const;

  const historiaInputStyle = {
    width: "100%",
    padding: 8,
    borderRadius: 0,
    border: "1px solid #d9c7b3",
    background: "#fff",
  } as const;

  const historiaItemInputStyle = {
    ...historiaInputStyle,
    maxWidth: 360,
    padding: "8px 10px",
  } as const;

  const historiaItemsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 320px))",
    gap: 8,
    marginTop: 8,
  } as const;

  const antecedentesGeneralesSeleccionados = String(historiaData?.antecedentes_generales ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);
  const antecedentesOcularesFamiliaresSeleccionados = String(historiaData?.antecedentes_oculares_familiares ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);
  const diagnosticoPrincipalSeleccionados = splitPipeList(historiaData?.diagnostico_principal ?? "");
  const diagnosticoSecundarioSeleccionados = String(historiaData?.diagnosticos_secundarios ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);
  const sintomasAlDespertarSeleccionados = String(historiaData?.sintomas_al_despertar ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);
  const conviveMascotasSeleccionados = String(historiaData?.convive_mascotas ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);
  const horasPantallaRaw = String(historiaData?.horas_pantalla_dia ?? "").trim();
  const trabajoCercaRaw = String(historiaData?.trabajo_cerca_horas_dia ?? "").trim();
  const horasPantallaEsCero = horasPantallaRaw !== "" && Number(horasPantallaRaw) === 0;
  const trabajoCercaEsCero = trabajoCercaRaw !== "" && Number(trabajoCercaRaw) === 0;
  const mostrarDistanciaPantalla = !horasPantallaEsCero && !trabajoCercaEsCero;

  const statsTopPacientesMesActual = statsData?.top_pacientes_mes_actual?.rows ?? [];
  const statsTopPacientesConsultas = statsData?.top_pacientes_consultas?.rows ?? [];
  const statsPacientesCreadosSerie = statsData?.pacientes_creados?.serie ?? [];
  const statsIngresosPorMes = statsData?.anual_mensual?.ingresos_por_mes ?? [];
  const statsConsultasPorMes = statsData?.anual_mensual?.consultas_por_mes ?? [];
  const statsVentasPorMes = statsData?.anual_mensual?.ventas_por_mes ?? [];
  const statsComparativo = statsData?.comparativo_sucursales ?? null;
  const statsConsultasComparativo = statsComparativo?.consultas_periodo_por_sucursal ?? [];
  const statsVentasComparativo = statsComparativo?.ventas_por_mes_por_sucursal ?? [];
  const statsPacientesComparativo = statsComparativo?.pacientes_por_mes_por_sucursal ?? [];
  const statsComparativoColors = ["#4D7A9B", "#CC842D", "#5B8A72", "#8A5B9B", "#3F6C51"];
  const exportRequiereRango = exportTiposSeleccionados.some((t) => EXPORT_TIPOS_POR_FECHA.includes(t));

  const historiaPacienteNombreCompleto = [
    historiaPacienteInfo?.primer_nombre ?? historiaData?.paciente_primer_nombre ?? "",
    historiaPacienteInfo?.segundo_nombre ?? historiaData?.paciente_segundo_nombre ?? "",
    historiaPacienteInfo?.apellido_paterno ?? historiaData?.paciente_apellido_paterno ?? "",
    historiaPacienteInfo?.apellido_materno ?? historiaData?.paciente_apellido_materno ?? "",
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ");

  function requestSubmitHistoriaForm() {
    const form = document.getElementById("historia-clinica-form") as HTMLFormElement | null;
    form?.requestSubmit();
  }

  return (
    <div
      className="olm-app-shell"
      style={{
        maxWidth: "none",
        width: "calc(100vw - 28px)",
        margin: "14px auto",
        padding: "18px clamp(18px, 2vw, 34px) 34px",
        fontFamily: "Inter, Avenir Next, Avenir, Segoe UI, sans-serif",
        minHeight: "calc(100vh - 28px)",
        color: "#172b3a",
        background: "rgba(248, 251, 252, .96)",
        border: "1px solid rgba(203, 216, 224, .8)",
        borderRadius: 22,
        boxShadow: "0 28px 80px rgba(24, 50, 71, .13)",
        ...MAIN_SCALE_STYLE,
      }}
    >
      <style>{`
        input, select, textarea {
          box-sizing: border-box;
        }
        button {
          transition: transform 0.16s ease, box-shadow 0.2s ease, filter 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
        }
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(24, 50, 71, 0.16);
          filter: saturate(1.04);
        }
        button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(24, 50, 71, 0.14);
        }
      `}</style>

      <div
        style={{
          display: "grid",
          justifyItems: "center",
          textAlign: "center",
          gap: 4,
          marginBottom: 8,
          padding: "0 20px",
        }}
      >
        <img
          src={logoOlm}
          alt="Óptica OLM"
          style={{
            height: "clamp(72px, 6vw, 104px)",
            width: "auto",
            maxWidth: "62vw",
            objectFit: "contain",
            mixBlendMode: "multiply",
            filter: "contrast(1.08) saturate(1.06)",
          }}
        />

        <div style={{ textAlign: "center", fontWeight: 900, fontSize: "clamp(13px, 1.2vw, 17px)", letterSpacing: 4, color: "#638092", marginTop: -4 }}>
          GESTIÓN CLÍNICA
        </div>
      </div>

      {/* Barra superior: sesión */}
      <div
        className="olm-session-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #d7e5e8",
              background: "#edf8f6",
              color: "#176b65",
              fontWeight: 800,
            }}
          >
            ✅ Sesión: {me.username} ({me.rol})
            {me.rol === "admin" && me.sucursal_id ? ` — Sucursal ${me.sucursal_id}` : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #d9e3e8",
            background: "#fff",
            color: "#526b7b",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>






      <div className="olm-branch-row" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 800, color: "#526b7b" }}>Sucursal</div>
        <select
          value={sucursalActivaId}
          disabled={me?.rol !== "admin"}
          onChange={(e) => setSucursalActivaId(Number(e.target.value))}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d6e1e6",
            background: "#fff",
            minWidth: 280,
          }}
        >
          {sucursales.length === 0 ? (
            <option value={sucursalActivaId}>Cargando...</option>
          ) : (
            sucursales.map((s) => (
              <option key={s.sucursal_id} value={s.sucursal_id}>
                {s.nombre}
              </option>
            ))
          )}
        </select>
      </div>


      <div className="olm-main-tabs" style={{ display: "flex", gap: 6, marginBottom: 22 }}>
        <TabButton variant="pacientes" active={tab === "pacientes"} onClick={() => setTab("pacientes")}>
          Pacientes
        </TabButton>
        {canViewHistoriaTab && (
          <TabButton
            variant="historia_clinica"
            active={tab === "historia_clinica"}
            onClick={() => setTab("historia_clinica")}
          >
            Historia clínica
          </TabButton>
        )}
        <TabButton variant="consultas" active={tab === "consultas"} onClick={() => setTab("consultas")}>
          Consultas
        </TabButton>
        {canViewVentasTab && (
          <TabButton variant="ventas" active={tab === "ventas"} onClick={() => setTab("ventas")}>
            Ventas
          </TabButton>
        )}
        <TabButton variant="estadisticas" active={tab === "estadisticas"} onClick={() => setTab("estadisticas")}>
          Estadísticas
        </TabButton>
        {(isAdmin || isDoctor || isRecep) && (
          <TabButton variant="inventario" active={tab === "inventario"} onClick={() => setTab("inventario")}>
            Inventario
          </TabButton>
        )}
      </div>




      {/* ========================= HISTORIA CLINICA ========================= */}
      {tab === "historia_clinica" && (
        <div style={{ ...softCard, padding: 14, overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: "#1f4f4a" }}>Historia clínica</span>
              <span style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid #9fd3cd", background: "#e9fbf8", color: "#0f766e", fontSize: 12, fontWeight: 800 }}>
                Solo doctor/admin
              </span>
              <span style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid #d7c4b0", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}>
                Pacientes en sucursal: {pacientesFiltrados.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  if (historiaSearchInputRef.current) {
                    historiaSearchInputRef.current.focus();
                    historiaSearchInputRef.current.select();
                  }
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #0f766e",
                  background: "#0f766e",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                CREAR HISTORIA CLÍNICA
              </button>
              <button
                type="button"
                onClick={() => setPacienteFiltroOpen(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #0B5E59",
                  background: "#fff",
                  color: "#0F766E",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                BUSCAR PACIENTE
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              ref={historiaSearchInputRef}
              value={qPaciente}
              onChange={(e) => setQPaciente(e.target.value)}
              placeholder="Escribe nombre, apellido, ID, teléfono o correo..."
              style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <button
              type="button"
              onClick={() => setQPaciente("")}
              style={{ ...actionBtnStyle, padding: "10px 12px" }}
            >
              Limpiar
            </button>
          </div>

          {qPaciente.trim() && (
            <div style={{ marginBottom: 10, fontSize: 12, color: "#6a5138" }}>
              {loadingPacienteBusqueda
                ? "Buscando pacientes en toda la sucursal..."
                : `Búsqueda activa (${pacientesFiltrados.length} resultado${pacientesFiltrados.length === 1 ? "" : "s"})`}
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ background: "#f4fffd" }}>
                <th align="left" style={{ padding: 10 }}>ID</th>
                <th align="left" style={{ padding: 10 }}>Nombre</th>
                <th align="left" style={{ padding: 10 }}>Teléfono</th>
                <th align="left" style={{ padding: 10 }}>Correo</th>
                <th align="left" style={{ padding: 10 }}>Estado</th>
                <th align="left" style={{ padding: 10 }}>Historia</th>
                <th align="left" style={{ padding: 10 }}>Acción</th>
                {isAdmin && <th align="left" style={{ padding: 10 }}>Borrar</th>}
              </tr>
            </thead>
            <tbody>
              {pacientesFiltrados.map((p) => {
                const historiaStatus = historiaEstadoPaciente[p.paciente_id];
                const isLoadingHistoria = historiaStatus === "loading";
                const hasHistoria = historiaStatus === "exists";
                const deletingThisHistoria = deletingHistoria && deletingHistoriaRowId === p.paciente_id;

                return (
                  <tr key={`hist-tab-${p.paciente_id}`} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 10 }}>{p.paciente_id}</td>
                    <td style={{ padding: 10 }}>
                      {[p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td style={{ padding: 10 }}>{p.telefono ?? ""}</td>
                    <td style={{ padding: 10 }}>{p.correo ?? ""}</td>
                    <td style={{ padding: 10 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          ...estadoPacienteBadgeStyle(p.estado_paciente),
                        }}
                      >
                        {formatEstadoPacienteLabel(p.estado_paciente)}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          border: hasHistoria ? "1px solid #8fd4c8" : "1px solid #e2c7a8",
                          background: hasHistoria ? "#e8fffb" : "#fff8ee",
                          color: hasHistoria ? "#0f766e" : "#7c4a1d",
                        }}
                      >
                        {isLoadingHistoria ? "Verificando..." : hasHistoria ? "Existente" : "Sin historia"}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <button
                        type="button"
                        disabled={isLoadingHistoria}
                        onClick={() => openHistoria(p)}
                        style={{
                          ...actionBtnStyle,
                          border: hasHistoria ? "1px solid #0f766e" : "1px solid #6b4f37",
                          color: hasHistoria ? "#0f766e" : "#6b4f37",
                          opacity: isLoadingHistoria ? 0.65 : 1,
                          cursor: isLoadingHistoria ? "not-allowed" : "pointer",
                        }}
                      >
                        {isLoadingHistoria ? "Verificando..." : hasHistoria ? "Ver historia existente" : "Crear historia clínica"}
                      </button>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: 10 }}>
                        <button
                          type="button"
                          disabled={isLoadingHistoria || !hasHistoria || deletingHistoria}
                          onClick={() => deleteHistoriaClinicaDesdeTabla(p)}
                          style={{
                            ...actionBtnStyle,
                            border: "1px solid #a93226",
                            color: "#a93226",
                            opacity: isLoadingHistoria || !hasHistoria || deletingHistoria ? 0.55 : 1,
                            cursor: isLoadingHistoria || !hasHistoria || deletingHistoria ? "not-allowed" : "pointer",
                          }}
                        >
                          {deletingThisHistoria ? "Eliminando..." : hasHistoria ? "Borrar historia" : "Sin historia"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {pacientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} style={{ padding: 12 }}>
                    Sin pacientes para esta búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================= PACIENTES ========================= */}
      {tab === "pacientes" && (
        pacientePerfil ? (
          <div style={{ display: "grid", gap: 16, width: "100%" }}>
            <div style={{ ...softCard, padding: 18 }}>
              <button
                type="button"
                onClick={() => {
                  setPacientePerfil(null);
                  setPerfilConsultas([]);
                  setPerfilVentas([]);
                  setError(null);
                }}
                style={{ ...actionBtnStyle, marginBottom: 16 }}
              >
                ← Volver a pacientes
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
                    Perfil del paciente #{pacientePerfil.paciente_id}
                  </div>
                  <h2 style={{ margin: "5px 0 4px" }}>
                    {[pacientePerfil.primer_nombre, pacientePerfil.segundo_nombre, pacientePerfil.apellido_paterno, pacientePerfil.apellido_materno]
                      .filter(Boolean)
                      .join(" ")}
                  </h2>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      ...estadoPacienteBadgeStyle(pacientePerfil.estado_paciente),
                    }}
                  >
                    {formatEstadoPacienteLabel(pacientePerfil.estado_paciente)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {canEditPaciente && (
                    <button
                      type="button"
                      onClick={() => {
                        startEditPaciente(pacientePerfil);
                        setPacientePerfil(null);
                      }}
                      style={actionBtnStyle}
                    >
                      Editar datos
                    </button>
                  )}
                  {(isDoctor || isAdmin) && (
                    <button type="button" onClick={() => openHistoria(pacientePerfil)} style={actionBtnStyle}>
                      Ver historia clínica completa
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 18 }}>
                {[
                  ["Fecha de nacimiento", pacientePerfil.fecha_nacimiento || "Sin registrar"],
                  ["Sexo", pacientePerfil.sexo || "Sin registrar"],
                  ["Teléfono", pacientePerfil.telefono || "Sin registrar"],
                  ["Correo", pacientePerfil.correo || "Sin registrar"],
                  ["Cómo nos conoció", formatComoNosConocioLabel(pacientePerfil.como_nos_conocio)],
                  ["Fecha de registro", formatDateTimePretty(pacientePerfil.creado_en)],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{label}</div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Dirección</div>
                <div style={{ marginTop: 4, fontWeight: 700 }}>
                  {[
                    [pacientePerfil.calle, pacientePerfil.numero].filter(Boolean).join(" "),
                    pacientePerfil.colonia,
                    pacientePerfil.municipio,
                    pacientePerfil.estado_direccion,
                    pacientePerfil.codigo_postal,
                    pacientePerfil.pais,
                  ].filter(Boolean).join(", ") || "Sin registrar"}
                </div>
              </div>
            </div>

            {loadingPacientePerfil ? (
              <div style={{ ...softCard, padding: 18 }}>Cargando expediente del paciente...</div>
            ) : (
              <>
                <div style={{ ...softCard, padding: 18, overflowX: "auto" }}>
                  <h3 style={{ marginTop: 0 }}>Consultas ({perfilConsultas.length})</h3>
                  {perfilConsultas.length === 0 ? (
                    <div>Este paciente no tiene consultas registradas en esta sucursal.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th align="left" style={{ padding: 10 }}>Fecha y hora</th>
                          <th align="left" style={{ padding: 10 }}>Tipo</th>
                          <th align="left" style={{ padding: 10 }}>Doctor</th>
                          <th align="left" style={{ padding: 10 }}>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfilConsultas.map((consulta) => (
                          <tr key={consulta.consulta_id} style={{ borderTop: "1px solid #e2e8f0" }}>
                            <td style={{ padding: 10 }}>{formatDateTimePretty(consulta.agenda_inicio ?? consulta.fecha_hora)}</td>
                            <td style={{ padding: 10 }}>{consultaTokensForUi(consulta).map(formatConsultaTokenLabel).join(" | ")}</td>
                            <td style={{ padding: 10 }}>{[consulta.doctor_primer_nombre, consulta.doctor_apellido_paterno].filter(Boolean).join(" ") || "Sin registrar"}</td>
                            <td style={{ padding: 10 }}>{consulta.notas?.trim() || "Sin notas"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ ...softCard, padding: 18, overflowX: "auto" }}>
                  <h3 style={{ marginTop: 0 }}>Compras ({perfilVentas.length})</h3>
                  {perfilVentas.length === 0 ? (
                    <div>Este paciente no tiene compras registradas en esta sucursal.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th align="left" style={{ padding: 10 }}>Fecha y hora</th>
                          <th align="left" style={{ padding: 10 }}>Compra</th>
                          <th align="left" style={{ padding: 10 }}>Monto</th>
                          <th align="left" style={{ padding: 10 }}>Método de pago</th>
                          <th align="left" style={{ padding: 10 }}>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfilVentas.map((venta) => (
                          <tr key={venta.venta_id} style={{ borderTop: "1px solid #e2e8f0" }}>
                            <td style={{ padding: 10 }}>{formatDateTimePretty(venta.fecha_hora)}</td>
                            <td style={{ padding: 10 }}>{venta.compra || "Sin detalle"}</td>
                            <td style={{ padding: 10 }}>${Number(venta.monto_total || 0).toFixed(2)}</td>
                            <td style={{ padding: 10 }}>{String(venta.metodo_pago || "").replaceAll("_", " ")}</td>
                            <td style={{ padding: 10 }}>{venta.notas?.trim() || "Sin notas"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, alignItems: "start" }}>
          <form
            onSubmit={onSubmitPaciente}
            noValidate
            style={{ ...softCard, padding: 16 }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              {editingPacienteId ? `Editando paciente #${editingPacienteId}` : "Nuevo paciente"}
            </div>
            {successPacienteMsg && (
              <div
                style={{
                  marginBottom: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #2ecc71",
                  background: "#e8f8f2",
                  color: "#1e8449",
                  fontWeight: 700,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span>✔ {successPacienteMsg}</span>
                <button
                  type="button"
                  onClick={() => setSuccessPacienteMsg(null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #2ecc71",
                    background: "#2ecc71",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Edición guardada con éxito
                </button>
              </div>
            )}

            <label style={{ display: "block", marginBottom: 8 }}>
              Primer nombre *
              <input
                value={formPaciente.primer_nombre ?? ""}
                onChange={(e) => {
                  setFormPaciente({ ...formPaciente, primer_nombre: e.target.value });
                  if (error === "Primer nombre es obligatorio.") setError(null);
                }}
                required
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Segundo nombre
              <input
                value={formPaciente.segundo_nombre ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, segundo_nombre: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Apellido paterno *
              <input
                value={formPaciente.apellido_paterno ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, apellido_paterno: e.target.value })}
                required
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Apellido materno
              <input
                value={formPaciente.apellido_materno ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, apellido_materno: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Fecha de nacimiento *
                <DateInputPro
                  value={formPaciente.fecha_nacimiento ?? ""}
                  onChange={(next) => setFormPaciente({ ...formPaciente, fecha_nacimiento: next })}
                  required
                />
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Sexo *
                <select
                  value={formPaciente.sexo ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, sexo: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                  }}
                >
                  <option value="">Seleccionar</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </label>
            </div>

            <label style={{ display: "block", marginBottom: 8 }}>
              Teléfono *
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8 }}>
                <select
                  value={pacienteTelefonoPais}
                  onChange={(e) => setPacienteTelefonoPais(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  {PHONE_COUNTRIES.map((country) => (
                    <option key={country.iso} value={country.iso}>
                      {`${country.flag} ${country.name} (${country.dial})`}
                    </option>
                  ))}
                </select>
                <input
                  value={pacienteTelefonoLocal}
                  onChange={(e) => setPacienteTelefonoLocal(onlyDigits(e.target.value).slice(0, PHONE_LOCAL_MAX_DIGITS))}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{7,10}"
                  maxLength={PHONE_LOCAL_MAX_DIGITS}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Correo
              {pacienteEmailError && (
                <div style={{ margin: "4px 0 5px", color: "#b42318", fontSize: 12, fontWeight: 800 }}>
                  {pacienteEmailError}
                </div>
              )}
              <input
                type="email"
                value={formPaciente.correo ?? ""}
                onChange={(e) => {
                  const correo = e.target.value;
                  setFormPaciente({ ...formPaciente, correo });
                  if (pacienteEmailError) setPacienteEmailError(pacienteEmailErrorMessage(correo));
                }}
                onBlur={() => setPacienteEmailError(pacienteEmailErrorMessage(formPaciente.correo))}
                aria-invalid={Boolean(pacienteEmailError)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: pacienteEmailError ? "1px solid #b42318" : "1px solid #ddd",
                }}
              />
            </label>

            <GoogleAddressFinder
              onSelect={(address) =>
                setFormPaciente((current) => ({
                  ...current,
                  ...address,
                }))
              }
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Calle
                <input
                  value={formPaciente.calle ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, calle: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Numero
                <input
                  value={formPaciente.numero ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, numero: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Colonia
                <input
                  value={formPaciente.colonia ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, colonia: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Municipio
                <input
                  value={formPaciente.municipio ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, municipio: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Código postal
                <input
                  value={formPaciente.codigo_postal ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, codigo_postal: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                Estado
                <input
                  value={formPaciente.estado_direccion ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, estado_direccion: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                País
                <input
                  value={formPaciente.pais ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, pais: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            {editingPacienteId === null && (
              <label style={{ display: "block", marginBottom: 8 }}>
                Cómo nos conoció *
                <select
                  value={formPaciente.como_nos_conocio ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, como_nos_conocio: e.target.value })}
                  required
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  <option value="">Seleccionar</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="google_maps">Google / Google Maps</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="pagina_web">Página web</option>
                  <option value="paso_sucursal">Pasó por la sucursal</option>
                  <option value="referencia_familiar_amigo">Referencia de familiar o amigo</option>
                  <option value="cliente_anterior">Cliente anterior</option>
                  <option value="campana_evento">Campaña o evento</option>
                  <option value="publicidad_impresa">Publicidad impresa</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
            )}

            <button
              type="submit"
              disabled={
                savingPaciente ||
                (editingPacienteId === null && !canCreatePaciente) ||
                (editingPacienteId !== null && !canEditPaciente)
              }
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #5f7734",
                background: savingPaciente ? "#e9f0de" : "#6F8A3C",
                color: savingPaciente ? "#3f2f20" : "#fff",
                fontWeight: 700,
                cursor: savingPaciente ? "not-allowed" : "pointer",
              }}
            >
              {savingPaciente ? "Guardando..." : "Guardar paciente"}
            </button>

            <button
              type="button"
              onClick={resetPacienteForm}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #99c9c2",
                background: "#f2fbf9",
                color: "#0f6f66",
                fontWeight: 800,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Resetear formato
            </button>

            {/* 👇 ESTE ES EL NUEVO BOTÓN (solo aparece si estás editando) */}
            {editingPacienteId !== null && (
              <button
                type="button"
                onClick={cancelEditPaciente}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                Cancelar edición
              </button>
            )}

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>* obligatorio</div>
          </form>






          <div style={{ ...softCard, overflowX: "auto", padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800 }}>Pacientes</span>
                <span style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid #d7c4b0", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}>
                  Filtro: {pacienteFiltroLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPacienteFiltroModo("hoy");
                    setPacienteFechaDesde("");
                    setPacienteFechaHasta("");
                    setPacienteMes("");
                    setPacienteAnio(String(new Date().getFullYear()));
                    loadPacientes({ modo: "hoy" });
                  }}
                  style={{ ...actionBtnStyle, padding: "6px 10px" }}
                >
                  Quitar filtro
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPacienteFiltroOpen(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #5f4a32",
                  background: "#5f4a32",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: 0.2,
                }}
              >
                BUSCAR PACIENTE
              </button>
            </div>

            <input
                value={qPaciente}
                onChange={(e) => setQPaciente(e.target.value)}
                placeholder="Búsqueda inteligente: inicial, nombre, apellido, ID, teléfono o correo..."
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  marginBottom: 10,
                }}
              />
            {qPaciente.trim() && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#6a5138" }}>
                {loadingPacienteBusqueda
                  ? "Buscando pacientes en toda la sucursal..."
                  : `Búsqueda global activa (${pacientesFiltrados.length} resultado${pacientesFiltrados.length === 1 ? "" : "s"})`}
              </div>
            )}


            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th align="left" style={{ padding: 10 }}>ID</th>
                  <th align="left" style={{ padding: 10 }}>Nombre</th>
                  <th align="left" style={{ padding: 10 }}>Apellidos</th>
                  <th align="left" style={{ padding: 10 }}>Nacimiento</th>
                  <th align="left" style={{ padding: 10 }}>Teléfono</th>
                  <th align="left" style={{ padding: 10 }}>Correo</th>
                  <th align="left" style={{ padding: 10 }}>Estado de paciente</th>
                  <th align="left" style={{ padding: 10 }}>Acciones</th>

                </tr>
              </thead>


              <tbody>
                {pacientesFiltrados.map((p) => (
                  <tr
                    key={p.paciente_id}
                    onClick={() => openPacientePerfil(p)}
                    title="Abrir perfil completo del paciente"
                    style={{ borderTop: "1px solid #eee", cursor: "pointer" }}
                  >
                    <td style={{ padding: 10 }}>{p.paciente_id}</td>

                    <td style={{ padding: 10 }}>
                      {p.primer_nombre}{p.segundo_nombre ? ` ${p.segundo_nombre}` : ""}
                    </td>

                    <td style={{ padding: 10 }}>
                      {p.apellido_paterno}{p.apellido_materno ? ` ${p.apellido_materno}` : ""}
                    </td>

                    <td style={{ padding: 10 }}>{p.fecha_nacimiento ?? ""}</td>
                    <td style={{ padding: 10 }}>{p.telefono ?? ""}</td>
                    <td style={{ padding: 10 }}>{p.correo ?? ""}</td>
                    <td style={{ padding: 10 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          ...estadoPacienteBadgeStyle(p.estado_paciente),
                        }}
                      >
                        {formatEstadoPacienteLabel(p.estado_paciente)}
                      </span>
                    </td>

                    {/* ACCIONES */}
                    <td style={{ padding: 10 }} onClick={(event) => event.stopPropagation()}>
                      <div style={{ display: "flex", gap: 12, rowGap: 12, flexWrap: "wrap" }}>
                        {canEditPaciente && (
                          <button
                            type="button"
                            onClick={() => startEditPaciente(p)}
                            style={actionBtnStyle}
                          >
                            Editar
                          </button>
                        )}

                        {canDeletePaciente && (
                          <button
                            type="button"
                            onClick={() => askDeletePaciente(p.paciente_id)}
                            style={{ ...actionBtnStyle, background: "#fff1ea", border: "1px solid #e4bda5" }}
                          >
                            Eliminar
                          </button>
                        )}

                        {(isDoctor || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => openHistoria(p)}
                            style={actionBtnStyle}
                          >
                            Historia clínica
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => verHistorial(p.paciente_id)}
                          style={actionBtnStyle}
                        >
                          Ver historial de consultas
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {pacientesFiltrados.length === 0 && (
                  <tr>
                    <td style={{ padding: 10 }} colSpan={8}>
                      {qPaciente.trim() ? "Sin pacientes para esa búsqueda" : "Sin pacientes (filtro)"}
                    </td>
                  </tr>
                )}
              </tbody>





                    
            </table>
          


            {/* HISTORIAL (va aquí, dentro del mismo contenedor) */}
            {histPacienteId && (
              <div style={{ padding: 14, borderTop: "1px solid #eee" }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  Historial del paciente #{histPacienteId}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHistPacienteId(null);
                    setHistConsultas([]);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 10,
                  }}
                >
                  Cerrar historial
                </button>


                {loadingHist ? (
                  <div>Cargando...</div>
                ) : histConsultas.length === 0 ? (
                  <div>Sin consultas para este paciente en esta sucursal.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th align="left" style={{ padding: 10 }}>ID</th>
                        <th align="left" style={{ padding: 10 }}>Fecha y hora de Registro</th>
                        <th align="left" style={{ padding: 10 }}>Fecha y hora de consulta</th>
                        <th align="left" style={{ padding: 10 }}>Tipo</th>
                        <th align="left" style={{ padding: 10 }}>Doctor</th>
                        <th align="left" style={{ padding: 10 }}>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histConsultas.map((c) => (
                        <tr key={c.consulta_id} style={{ borderTop: "1px solid #eee" }}>
                          <td style={{ padding: 10 }}>{c.consulta_id}</td>
                          <td style={{ padding: 10 }}>{formatDateTimePretty(c.fecha_hora)}</td>
                          <td style={{ padding: 10 }}>
                            {formatDateTimePretty(c.agenda_inicio ?? c.fecha_hora)}
                          </td>
                          <td style={{ padding: 10 }}>
                            {consultaTokensForUi(c).map(formatConsultaTokenLabel).join(" | ")}
                          </td>
                          <td style={{ padding: 10 }}>
                            {[c.doctor_primer_nombre, c.doctor_apellido_paterno].filter(Boolean).join(" ")}
                          </td>
                          <td style={{ padding: 10 }}>{c.notas?.trim() ? c.notas : "Sin notas"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
        )
      )}


      {/* ========================= CONSULTAS ========================= */}
      {
        tab === "consultas" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start", width: "100%" }}>
            <form onSubmit={onSubmitConsulta} style={{ ...softCard, padding: 18, background: "linear-gradient(180deg, #fffdf9 0%, #fff7ee 100%)", flex: "1 1 700px", minWidth: 520 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: "#4a2f14" }}>
                  {editingConsultaId === null ? "Nueva consulta" : `Editando consulta #${editingConsultaId}`}
                </div>
                {editingConsultaId !== null && (
                  <button
                    type="button"
                    onClick={cancelEditConsulta}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #d8b488",
                      background: "#fff",
                      color: "#5a3a1f",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Nueva consulta (mostrar agenda)
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, marginBottom: 12, color: "#715638" }}>
                Agenda y captura clínica con validación de paciente por sucursal.
              </div>
              {editingConsultaId !== null && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid #e8d3b8", background: "#fff8ef", color: "#6c4a2a", fontSize: 13 }}>
                  Estás editando una consulta existente. El bloque de Google Calendar solo se muestra al crear una consulta nueva.
                </div>
              )}
              {successConsultaMsg && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #2ecc71", background: "#eafaf1", color: "#1e8449", fontWeight: 700 }}>
                  {successConsultaMsg}
                </div>
              )}

              <label style={{ display: "block", marginBottom: 8 }}>
                Buscar paciente
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    value={qPacienteConsulta}
                    onChange={(e) => setQPacienteConsulta(e.target.value)}
                    placeholder="Nombre, ID, teléfono o correo..."
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setQPacienteConsulta("");
                      setPacientesConsultaOpciones(pacientesOpciones);
                    }}
                    style={{ ...actionBtnStyle, padding: "10px 12px" }}
                  >
                    Limpiar
                  </button>
                </div>
                {loadingPacienteConsulta && (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>Buscando...</div>
                )}
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Paciente *
                <select
                  value={formConsulta.paciente_id}
                  onChange={(e) => setFormConsulta({ ...formConsulta, paciente_id: Number(e.target.value) })}
                  required
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  {pacientesConsultaOpciones.length === 0 ? (
                    <option value={0}>No hay pacientes</option>
                  ) : (
                    pacientesConsultaOpciones.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {editingConsultaId === null && (
                <div style={{ marginBottom: 12, border: "1px solid #dfcfbd", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, color: "#4a2f14" }}>
                    Agenda de consulta · duración de 45 minutos
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 8, flexWrap: "wrap" }}>
                    <label style={{ display: "block" }}>
                      Fecha *
                      <DateInputPro
                        value={agendaFecha}
                        onChange={setAgendaFecha}
                        minWidth={180}
                        style={{ display: "block" }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={loadAgendaDisponibilidad}
                      style={{ ...actionBtnStyle, padding: "9px 12px" }}
                    >
                      Ver horarios
                    </button>
                    {agendaTimezone && <span style={{ fontSize: 12, opacity: 0.75 }}>Zona: {agendaTimezone}</span>}
                  </div>
                  {!!agendaCalendarError && (
                    <div style={{ marginBottom: 8, fontSize: 12, color: "#9a3412" }}>
                      Aviso Google Calendar: {agendaCalendarError}
                    </div>
                  )}

                  {agendaLoading ? (
                    <div style={{ fontSize: 13 }}>Cargando horarios...</div>
                  ) : agendaSlots.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.85 }}>No hay horarios disponibles para ese día.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 }}>
                      {agendaSlots.map((slot) => {
                        const selected = agendaSlotSeleccionado?.inicio === slot.inicio && agendaSlotSeleccionado?.fin === slot.fin;
                        return (
                          <button
                            key={slot.inicio}
                            type="button"
                            onClick={() => setAgendaSlotSeleccionado(slot)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: selected ? "1px solid #1d6fd8" : "1px solid #d7c6b2",
                              background: selected ? "#eaf3ff" : "#fff8ef",
                              color: "#3f2f20",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <label style={{ display: "block", marginBottom: 10 }}>
                Etapa de consulta *
                <select
                  value={formConsulta.etapa_consulta ?? ""}
                  onChange={(e) =>
                    setFormConsulta((curr) => ({
                      ...curr,
                      etapa_consulta: e.target.value,
                    }))
                  }
                  required
                  style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  <option value="">Seleccionar</option>
                  {CONSULTA_ETAPA_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatConsultaTokenLabel(opt)}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "block", marginBottom: 10 }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Motivo de consulta *</div>
                <div style={{ display: "grid", gap: 6, padding: 10, border: "1px solid #ddd", borderRadius: 10, background: "#fff" }}>
                  {CONSULTA_MOTIVO_OPTIONS.map((opt) => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={motivosConsultaSeleccionados.includes(opt)}
                        onChange={(e) => {
                          setMotivosConsultaSeleccionados((prev) => {
                            const next = e.target.checked ? [...prev, opt] : prev.filter((x) => x !== opt);
                            if (!next.includes("otro")) setTipoConsultaOtro("");
                            setFormConsulta((curr) => ({ ...curr, motivo_consulta: next.join("|") }));
                            return next;
                          });
                        }}
                      />
                      <span>{formatConsultaTokenLabel(opt)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {motivosConsultaSeleccionados.includes("otro") && (
                <label style={{ display: "block", marginBottom: 8 }}>
                  Razón (otro) *
                  <input
                    value={tipoConsultaOtro}
                    onChange={(e) => setTipoConsultaOtro(e.target.value)}
                    required
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Doctor (nombre) *
                  <input
                    value={formConsulta.doctor_primer_nombre ?? ""}
                    onChange={(e) => setFormConsulta({ ...formConsulta, doctor_primer_nombre: e.target.value })}
                    required
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: 8 }}>
                  Doctor (apellido) *
                  <input
                    value={formConsulta.doctor_apellido_paterno ?? ""}
                    onChange={(e) => setFormConsulta({ ...formConsulta, doctor_apellido_paterno: e.target.value })}
                    required
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>
              </div>

              <label style={{ display: "block", marginBottom: 8 }}>
                Notas
                <textarea
                  value={formConsulta.notas ?? ""}
                  onChange={(e) => setFormConsulta({ ...formConsulta, notas: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <button
                type="submit"
                disabled={
                  savingConsulta ||
                  !formConsulta.paciente_id ||
                  (editingConsultaId === null ? !canCreateConsulta : !canEditConsulta)
                }
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #b37225",
                background: savingConsulta ? "#f7ebdd" : "linear-gradient(90deg, #cc842d 0%, #b96f1f 100%)",
                color: savingConsulta ? "#3f2f20" : "#fff",
                fontWeight: 700,
                cursor: savingConsulta ? "not-allowed" : "pointer",
              }}
              >
                {savingConsulta ? "Guardando..." : (editingConsultaId === null ? "Guardar consulta" : "Actualizar consulta")}
              </button>

              {editingConsultaId !== null && (
                <button
                  type="button"
                  onClick={cancelEditConsulta}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                >
                  Cancelar edición
                </button>
              )}

              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={resetConsultaForm}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Resetear consulta
                </button>

                <button
                  type="button"
                  onClick={() => loadPacientes()}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Recargar pacientes
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>* obligatorio</div>
            </form>

            <div style={{ ...softCard, overflow: "hidden", background: "#fff", flex: "1 1 620px", minWidth: 360 }}>
              <div
                style={{
                  padding: 16,
                  fontWeight: 700,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: "1px solid #eedecb",
                  background: "linear-gradient(180deg, #fff9ef 0%, #fff 100%)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#4a2f14" }}>Consultas</span>
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: "1px solid #d7c4b0",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#5a4633",
                    }}
                  >
                    Total: {consultasFiltradas.length}
                  </span>
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: "1px solid #d7c4b0",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#5a4633",
                    }}
                  >
                    Filtro: {consultaFiltroLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConsultaFiltroModo("hoy");
                      setConsultaFechaDesde("");
                      setConsultaFechaHasta("");
                      setConsultaMes("");
                      setConsultaAnio(String(new Date().getFullYear()));
                      loadConsultas({ modo: "hoy" });
                    }}
                    style={{ ...actionBtnStyle, padding: "6px 10px" }}
                  >
                    Quitar filtro
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultaFiltroOpen(true)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #5f4a32",
                    background: "linear-gradient(90deg, #5f4a32 0%, #755639 100%)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                    letterSpacing: 0.2,
                  }}
                >
                  BUSCAR CONSULTA
                </button>
              </div>

              <div style={{ padding: 14 }}>
                <input
                  value={qConsulta}
                  onChange={(e) => setQConsulta(e.target.value)}
                  placeholder="Buscar por ID, paciente, doctor o tipo..."
                  style={{
                    width: "100%",
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #d8c7b4",
                  }}
                />
              </div>

              <div style={{ overflowX: "auto", borderTop: "1px solid #f0e1cf" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 930 }}>
                <thead>
                  <tr style={{ background: "#fdf5ea" }}>
                    <th align="left" style={{ padding: 10 }}>ID</th>
                    <th align="left" style={{ padding: 10 }}>Registro</th>
                    <th align="left" style={{ padding: 10 }}>Consulta</th>
                    <th align="left" style={{ padding: 10 }}>Paciente</th>
                    <th align="left" style={{ padding: 10 }}>Estado</th>
                    <th align="left" style={{ padding: 10 }}>Tipo</th>
                    <th align="left" style={{ padding: 10 }}>Doctor</th>
                    <th align="left" style={{ padding: 10 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consultasFiltradas.map((c) => (
                    <tr key={c.consulta_id} style={{ borderTop: "1px solid #f0e4d7" }}>
                      <td style={{ padding: 10 }}>{c.consulta_id}</td>
                      <td style={{ padding: 10 }}>{formatDateTimePretty(c.fecha_hora)}</td>
                      <td style={{ padding: 10 }}>{formatDateTimePretty(c.agenda_inicio ?? c.fecha_hora)}</td>
                      <td style={{ padding: 10 }}>{c.paciente_nombre}</td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "5px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            ...estadoPacienteBadgeStyle(c.estado_paciente),
                          }}
                        >
                          {formatEstadoPacienteLabel(c.estado_paciente)}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {consultaTokensForUi(c).map((tipo) => (
                              <span
                                key={`${c.consulta_id}-${tipo}`}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  border: "1px solid #d9c7b3",
                                  background: "#fff",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#5a4633",
                                }}
                              >
                                {formatConsultaTokenLabel(tipo)}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td style={{ padding: 10 }}>
                        {[c.doctor_primer_nombre, c.doctor_apellido_paterno].filter(Boolean).join(" ")}
                      </td>
                      <td style={{ padding: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedConsultaDetalle(c)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                          marginRight: 8,
                        }}
                      >
                        Ver
                      </button>
                      {canEditConsulta && (
                        <button
                          type="button"
                          onClick={() => startEditConsulta(c)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                            marginRight: 8,
                          }}
                        >
                          Editar
                        </button>
                      )}
                      
                      {canDeleteConsulta ? (
                        <button
                          type="button"
                          onClick={() => askDeleteConsulta(c.consulta_id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Eliminar
                        </button>
                      ) : null}
                      </td>
                    </tr>
                  ))}
                  {consultasFiltradas.length === 0 && (
                    <tr>
                      <td style={{ padding: 10 }} colSpan={8}>Sin consultas</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )
      }


      {/* ========================= VENTAS ========================= */}
      {canViewVentasTab && tab === "ventas" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 16, alignItems: "start" }}>
          <form onSubmit={onSubmitVenta} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              {editingVentaId === null ? "Nueva venta" : `Editando venta #${editingVentaId}`}
            </div>
            {successVentaMsg && (
              <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: "1px solid #2ecc71", background: "#eafaf1", color: "#1e8449", fontWeight: 700 }}>
                {successVentaMsg}
              </div>
            )}

            <label style={{ display: "block", marginBottom: 8 }}>
              Buscar paciente
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  value={qPacienteVenta}
                  onChange={(e) => setQPacienteVenta(e.target.value)}
                  placeholder="Nombre, ID, teléfono o correo..."
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setQPacienteVenta("");
                    setPacientesVentaOpciones(pacientesOpciones);
                  }}
                  style={{ ...actionBtnStyle, padding: "10px 12px" }}
                >
                  Limpiar
                </button>
              </div>
              {loadingPacienteVenta && (
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>Buscando...</div>
              )}
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Paciente *
              <select
                value={formVenta.paciente_id}
                onChange={(e) => setFormVenta({ ...formVenta, paciente_id: Number(e.target.value) })}
                required
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
              >
                {pacientesVentaOpciones.length === 0 ? (
                  <option value={0}>No hay pacientes</option>
                ) : (
                  pacientesVentaOpciones.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div style={{ display: "block", marginBottom: 12 }}>
              {isAdmin ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {editingVentaId !== null && (
                    <div style={{ padding: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", fontSize: 13, fontWeight: 700 }}>
                      Estás editando la información de la venta. El inventario no se descuenta nuevamente.
                    </div>
                  )}

                  <section style={{ padding: 14, border: "1px solid #dbe7f4", background: "#f8fbff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                      <span style={{ width: 26, height: 26, display: "inline-grid", placeItems: "center", borderRadius: 999, background: "#2563eb", color: "#fff", fontWeight: 900 }}>1</span>
                      <div>
                        <div style={{ fontWeight: 900, color: "#16385d" }}>¿Qué compró el cliente?</div>
                        <div style={{ fontSize: 12, color: "#6b7f93" }}>Elige una categoría para continuar.</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8 }}>
                      {VENTA_CATEGORIAS.map((categoria) => {
                        const active = ventaCategoria === categoria.value;
                        return (
                          <button
                            key={categoria.value}
                            type="button"
                            onClick={() => seleccionarVentaCategoria(categoria.value)}
                            aria-pressed={active}
                            style={{
                              minHeight: 92,
                              padding: 11,
                              border: active ? "2px solid #2563eb" : "1px solid #d8e3ef",
                              background: active ? "#eaf2ff" : "#fff",
                              color: active ? "#174ea6" : "#31475d",
                              textAlign: "left",
                              cursor: "pointer",
                              boxShadow: active ? "0 8px 20px rgba(37,99,235,.13)" : "none",
                            }}
                          >
                            <span style={{ display: "block", color: "#2563eb", fontSize: 21, lineHeight: 1, marginBottom: 7 }}>{categoria.icon}</span>
                            <span style={{ display: "block", fontWeight: 900, lineHeight: 1.15 }}>{categoria.label}</span>
                            <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "#718397", lineHeight: 1.25 }}>{categoria.detail}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {ventaCategoria && (
                    <section style={{ padding: 14, border: "1px solid #cbdcf0", background: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                        <span style={{ width: 26, height: 26, display: "inline-grid", placeItems: "center", borderRadius: 999, background: "#0f766e", color: "#fff", fontWeight: 900 }}>2</span>
                        <div>
                          <div style={{ fontWeight: 900, color: "#16385d" }}>Elige productos y opciones</div>
                          <div style={{ fontSize: 12, color: "#6b7f93" }}>Cada selección se agrega al resumen de la venta.</div>
                        </div>
                      </div>

                      {editingVentaId !== null ? (
                        <div style={{ padding: 12, border: "1px dashed #9db6cf", color: "#526b7b", background: "#f8fafc" }}>
                          Conservaremos los productos y el movimiento de inventario original de esta venta.
                        </div>
                      ) : loadingInventario ? (
                        <div style={{ padding: 16, color: "#526b7b" }}>Cargando catálogo...</div>
                      ) : inventarioError ? (
                        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
                          No se pudo cargar el inventario: {inventarioError}
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 14 }}>
                          {ventaCategoria === "lentes_opticos" && (
                            renderFlujoLentesOpticos()
                          )}

                          {ventaCategoria === "micas" && (
                            <div>
                              <div style={{ marginBottom: 8, fontWeight: 900, color: "#31475d" }}>1. Par de micas</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                                {ventaMicasBase.map((producto) =>
                                  renderVentaProductoButton(producto, () => {
                                    const yaSeleccionado = ventaCarritoIds.has(producto.producto_id);
                                    agregarProductoCarrito(producto, "reemplazar_subcategoria");
                                    if (!yaSeleccionado) prepararMicasConDefaults();
                                  }),
                                )}
                              </div>
                            </div>
                          )}

                          {ventaCategoria === "micas" && (
                            <>
                              <div>
                                <div style={{ marginBottom: 8, fontWeight: 900, color: "#31475d" }}>
                                  2. Diseño de la mica
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                                  {ventaMicasDisenos.map((producto) =>
                                    renderVentaProductoButton(
                                      producto,
                                      () => agregarProductoCarrito(producto, "reemplazar_subcategoria"),
                                    ),
                                  )}
                                </div>
                              </div>
                              <div>
                                <div style={{ marginBottom: 8, fontWeight: 900, color: "#31475d" }}>3. Tratamiento, antiblueray o tinte</div>
                                <div style={{ marginBottom: 8, fontSize: 12, color: "#6b7f93" }}>
                                  Antiblueray está disponible en verde o azul. Los tintes incluyen 10 colores.
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                                  {ventaMicasTratamientos.map((producto) =>
                                    renderVentaProductoButton(
                                      producto,
                                      () => agregarProductoCarrito(producto, "reemplazar_subcategoria"),
                                    ),
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                          {ventaCategoria === "lentes_de_sol" && (
                            <>
                              <div>
                                <div style={{ marginBottom: 8, fontWeight: 900, color: "#31475d" }}>1. Modelo de lentes de sol</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                                  {ventaLentesSol.map((producto) =>
                                    renderVentaProductoButton(
                                      producto,
                                      () => agregarProductoCarrito(producto, "reemplazar_subcategoria"),
                                    ),
                                  )}
                                </div>
                              </div>
                              <div>
                                <div style={{ marginBottom: 8, fontWeight: 900, color: "#31475d" }}>2. Graduación</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const idsGraduacion = new Set(ventaGraduacionSol.map((producto) => producto.producto_id));
                                      setVentaCarrito((prev) => prev.filter((item) => !idsGraduacion.has(item.producto_id)));
                                    }}
                                    style={{
                                      minHeight: 76,
                                      padding: 12,
                                      border: ventaGraduacionSol.some((producto) => ventaCarritoIds.has(producto.producto_id))
                                        ? "1px solid #cdddeb"
                                        : "2px solid #1677d2",
                                      background: ventaGraduacionSol.some((producto) => ventaCarritoIds.has(producto.producto_id))
                                        ? "#fff"
                                        : "#edf6ff",
                                      color: "#173b61",
                                      fontWeight: 900,
                                      cursor: "pointer",
                                      textAlign: "left",
                                    }}
                                  >
                                    Sin graduación
                                    <span style={{ display: "block", marginTop: 6, color: "#0e5fa8" }}>+$0</span>
                                  </button>
                                  {ventaGraduacionSol.map((producto) =>
                                    renderVentaProductoButton(
                                      producto,
                                      () => agregarProductoCarrito(producto, "reemplazar_subcategoria"),
                                    ),
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                          {ventaCategoria === "examen_de_la_vista" && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                              {ventaExamenes.map((producto) =>
                                renderVentaProductoButton(producto, () => agregarProductoCarrito(producto, "unico")),
                              )}
                            </div>
                          )}

                          {ventaCategoria === "lentes_de_contacto" && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                              {ventaContactos.map((producto) =>
                                renderVentaProductoButton(producto, () => agregarProductoCarrito(producto, "sumar")),
                              )}
                            </div>
                          )}

                          {ventaCategoria === "estuche_accesorios" && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                              {ventaAccesorios.map((producto) =>
                                renderVentaProductoButton(producto, () => agregarProductoCarrito(producto, "sumar")),
                              )}
                            </div>
                          )}

                          {ventaCategoria === "soluciones_y_cuidado" && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                              {ventaCuidados.map((producto) =>
                                renderVentaProductoButton(producto, () => agregarProductoCarrito(producto, "sumar")),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 6, fontWeight: 700 }}>Compra *</div>
                  <div style={{ display: "grid", gap: 6, padding: 10, border: "1px solid #ddd", borderRadius: 10, background: "#fff" }}>
                    {VENTA_COMPRA_OPTIONS.map((opt) => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={ventasSeleccionadas.includes(opt)}
                          onChange={(e) => {
                            setVentasSeleccionadas((prev) => {
                              const next = e.target.checked ? [...prev, opt] : prev.filter((x) => x !== opt);
                              setFormVenta((curr) => ({ ...curr, compra: next.join("|") }));
                              return next;
                            });
                          }}
                        />
                        <span>{formatVentaCompraLabel(opt)}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {!isAdmin && (
              <label style={{ display: "block", marginBottom: 8 }}>
              Monto total (MXN) *
              <input
                type="number"
                min={0}
                step="0.01"
                value={
                  formVenta.monto_total === 0 || Number.isNaN(Number(formVenta.monto_total))
                    ? ""
                    : String(formVenta.monto_total)
                }
                onChange={(e) =>
                  setFormVenta({
                    ...formVenta,
                    monto_total: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                required
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
              </label>
            )}

            {!isAdmin && renderVentaPagoLiquidacion()}

            <label style={{ display: "block", marginBottom: 8 }}>
              Notas
              <textarea
                value={formVenta.notas ?? ""}
                onChange={(e) => setFormVenta({ ...formVenta, notas: e.target.value })}
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <button
              type="submit"
              disabled={savingVenta || !formVenta.paciente_id || (editingVentaId === null ? !canCreateVenta : !canEditVenta)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #3f6784",
                background: savingVenta ? "#e7eff6" : "#4D7A9B",
                color: savingVenta ? "#2b3f4f" : "#fff",
                fontWeight: 700,
                cursor: savingVenta ? "not-allowed" : "pointer",
              }}
            >
              {savingVenta ? "Guardando..." : editingVentaId === null ? "Guardar venta" : "Actualizar venta"}
            </button>

            <button
              type="button"
              onClick={cancelEditVenta}
              disabled={savingVenta}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #b9c9d8",
                background: "#f8fafc",
                color: "#40566c",
                fontWeight: 800,
                cursor: savingVenta ? "not-allowed" : "pointer",
                marginTop: 8,
              }}
            >
              Resetear venta
            </button>

            {editingVentaId !== null && (
              <button
                type="button"
                onClick={cancelEditVenta}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                Cancelar edición
              </button>
            )}
          </form>

          <div style={{ display: "grid", gap: 16, alignSelf: "start", minWidth: 0 }}>
            <div style={{ ...softCard, overflowX: "auto" }}>
            <div
              style={{
                padding: 14,
                fontWeight: 700,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>Ventas</span>
                <span style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid #d7c4b0", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}>
                  Filtro: {ventaFiltroLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVentaFiltroModo("hoy");
                    setVentaFechaDesde("");
                    setVentaFechaHasta("");
                    setVentaMes("");
                    setVentaAnio(String(new Date().getFullYear()));
                    loadVentas({ modo: "hoy" });
                  }}
                  style={{ ...actionBtnStyle, padding: "6px 10px" }}
                >
                  Quitar filtro
                </button>
                <button type="button" onClick={() => aplicarFiltroRapidoVenta("ayer")} style={{ ...actionBtnStyle, padding: "6px 10px" }}>Ayer</button>
                <button type="button" onClick={() => aplicarFiltroRapidoVenta("ultimos7")} style={{ ...actionBtnStyle, padding: "6px 10px" }}>Últimos 7 días</button>
                <button type="button" onClick={() => aplicarFiltroRapidoVenta("semana_pasada")} style={{ ...actionBtnStyle, padding: "6px 10px" }}>Semana pasada</button>
                <button type="button" onClick={() => aplicarFiltroRapidoVenta("mes_pasado")} style={{ ...actionBtnStyle, padding: "6px 10px" }}>Mes pasado</button>
              </div>
              <button
                type="button"
                onClick={() => setVentaFiltroOpen(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #5f4a32",
                  background: "linear-gradient(90deg, #5f4a32 0%, #755639 100%)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: 0.2,
                }}
              >
                BUSCAR VENTA
              </button>
            </div>

            <div style={{ padding: 14, paddingTop: 0 }}>
              <input
                value={qVenta}
                onChange={(e) => setQVenta(e.target.value)}
                placeholder="Buscar por ID, fecha, paciente, compra o monto..."
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th align="left" style={{ padding: 10 }}>ID</th>
                  <th align="left" style={{ padding: 10 }}>Fecha</th>
                  <th align="left" style={{ padding: 10 }}>Paciente</th>
                  <th align="left" style={{ padding: 10 }}>Estado</th>
                  <th align="left" style={{ padding: 10 }}>Compra</th>
                  <th align="left" style={{ padding: 10 }}>Monto</th>
                  <th align="left" style={{ padding: 10 }}>Método</th>
                  <th align="left" style={{ padding: 10 }}>Adelanto</th>
                  <th align="left" style={{ padding: 10 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((v) => (
                  <tr key={v.venta_id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 10 }}>{v.venta_id}</td>
                    <td style={{ padding: 10 }}>{formatDateTimePretty(v.fecha_hora)}</td>
                    <td style={{ padding: 10 }}>{v.paciente_nombre}</td>
                    <td style={{ padding: 10 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          ...estadoPacienteBadgeStyle(v.estado_paciente),
                        }}
                      >
                        {formatEstadoPacienteLabel(v.estado_paciente)}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(v.compra ?? "")
                          .split("|")
                          .map((x) => x.trim())
                          .filter(Boolean)
                          .map((item) => (
                            <span key={`${v.venta_id}-${item}`} style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #d9c7b3", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}>
                              {formatVentaCompraLabel(item)}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td style={{ padding: 10 }}>${Number(v.monto_total || 0).toFixed(2)}</td>
                    <td style={{ padding: 10 }}>
                      <div>{formatMetodoPagoLabel(v.metodo_pago)}</div>
                      <div style={{ marginTop: 3, color: "#718397", fontSize: 11 }}>
                        {formatFormaLiquidacionLabel(v.forma_liquidacion)}
                      </div>
                    </td>
                    <td style={{ padding: 10 }}>
                      {v.adelanto_aplica
                        ? `$${Number(v.adelanto_monto || 0).toFixed(2)} (${v.adelanto_metodo || ""})`
                        : "no"}
                    </td>
                    <td style={{ padding: 10 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedVentaDetalle(v)}
                        style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", marginRight: 8 }}
                      >
                        Ver
                      </button>
                      {canEditVenta && (
                        <button
                          type="button"
                          onClick={() => startEditVenta(v)}
                          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer", marginRight: 8 }}
                        >
                          Editar
                        </button>
                      )}
                      {canDeleteVenta ? (
                        <button
                          type="button"
                          onClick={() => askDeleteVenta(v.venta_id)}
                          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {ventasFiltradas.length === 0 && (
                  <tr>
                    <td style={{ padding: 10 }} colSpan={9}>Sin ventas</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {isAdmin && renderVentaResumenProductos()}
          </div>
        </div>
      )}

      {/* ========================= INVENTARIO ========================= */}
      {(isAdmin || isDoctor || isRecep) && tab === "inventario" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ ...softCard, padding: 18, background: "#f8fbff", borderColor: "#cfdef0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: "#173b61" }}>Inventario</h2>
                  <span style={{ padding: "5px 10px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 900 }}>
                    {isAdmin ? "Administrador" : "Consulta de existencias"}
                  </span>
                </div>
                <div style={{ marginTop: 5, color: "#6b7f93" }}>
                  Productos de la sucursal #{sucursalActivaId}, usando el mismo catálogo y las existencias actuales.
                </div>
              </div>
              <button
                type="button"
                onClick={loadInventario}
                disabled={loadingInventario}
                style={{
                  ...actionBtnStyle,
                  padding: "10px 14px",
                  borderColor: "#8fb1d5",
                  color: "#174ea6",
                  cursor: loadingInventario ? "wait" : "pointer",
                }}
              >
                {loadingInventario ? "Cargando..." : "Actualizar inventario"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, paddingBottom: 14, borderBottom: "1px solid #d8e3ef" }}>
              <button
                type="button"
                onClick={() => setInventarioVista("existencias")}
                aria-pressed={inventarioVista === "existencias"}
                style={{
                  padding: "9px 14px",
                  border: inventarioVista === "existencias" ? "1px solid #174ea6" : "1px solid #b9cce0",
                  background: inventarioVista === "existencias" ? "#174ea6" : "#fff",
                  color: inventarioVista === "existencias" ? "#fff" : "#40566c",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Existencias
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setInventarioVista("costos")}
                  aria-pressed={inventarioVista === "costos"}
                  style={{
                    padding: "9px 14px",
                    border: inventarioVista === "costos" ? "1px solid #0f766e" : "1px solid #b9cce0",
                    background: inventarioVista === "costos" ? "#0f766e" : "#fff",
                    color: inventarioVista === "costos" ? "#fff" : "#40566c",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Costos y rentabilidad
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <div style={{ minWidth: 150, padding: 12, border: "1px solid #d8e3ef", background: "#fff" }}>
                <div style={{ fontSize: 12, color: "#6b7f93", fontWeight: 800 }}>PRODUCTOS</div>
                <div style={{ marginTop: 2, fontSize: 25, fontWeight: 900, color: "#173b61" }}>{inventarioVisible.length}</div>
              </div>
              <div style={{ minWidth: 150, padding: 12, border: "1px solid #fed7aa", background: inventarioStockBajo > 0 ? "#fff7ed" : "#fff" }}>
                <div style={{ fontSize: 12, color: "#9a4c0e", fontWeight: 800 }}>STOCK BAJO</div>
                <div style={{ marginTop: 2, fontSize: 25, fontWeight: 900, color: inventarioStockBajo > 0 ? "#c2410c" : "#173b61" }}>{inventarioStockBajo}</div>
              </div>
              <div style={{ minWidth: 150, padding: 12, border: "1px solid #d8e3ef", background: "#fff" }}>
                <div style={{ fontSize: 12, color: "#6b7f93", fontWeight: 800 }}>UNIDADES</div>
                <div style={{ marginTop: 2, fontSize: 25, fontWeight: 900, color: "#173b61" }}>
                  {inventarioVisible.reduce(
                    (total, producto) => total + (producto.controla_stock ? Number(producto.stock || 0) : 0),
                    0,
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(200px, .45fr)", gap: 10, marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#40566c" }}>
                BUSCAR PRODUCTO
                <input
                  value={inventarioBusqueda}
                  onChange={(e) => setInventarioBusqueda(e.target.value)}
                  placeholder="Nombre, ID, SKU, modelo, color..."
                  style={{ width: "100%", marginTop: 5, padding: 10, border: "1px solid #b9cce0", background: "#fff" }}
                />
              </label>
              <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#40566c" }}>
                CATEGORÍA
                <select
                  value={inventarioCategoriaFiltro}
                  onChange={(e) => setInventarioCategoriaFiltro(e.target.value)}
                  style={{ width: "100%", marginTop: 5, padding: 10, border: "1px solid #b9cce0", background: "#fff" }}
                >
                  <option value="todos">Todas</option>
                  {inventarioCategorias.map((categoria) => (
                    <option key={categoria} value={categoria}>{formatVentaCompraLabel(categoria)}</option>
                  ))}
                </select>
              </label>
            </div>
            </div>

          {inventarioError && (
            <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>
              {inventarioError}
            </div>
          )}

          {inventarioVista === "existencias" && (
            <>
          <div
            style={{
              position: "sticky",
              top: 8,
              zIndex: 5,
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
              padding: 9,
              border: "1px solid #c9daeb",
              background: "rgba(248,251,255,.96)",
              boxShadow: "0 5px 14px rgba(36,72,105,.08)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#31475d", fontSize: 12, fontWeight: 900 }}>
              IR A:
              <select
                defaultValue=""
                aria-label="Ir a una categoría del inventario"
                onChange={(e) => {
                  const categoria = e.currentTarget.value;
                  if (!categoria) return;
                  document
                    .getElementById(`inventario-seccion-${categoria}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  e.currentTarget.value = "";
                }}
                style={{
                  minWidth: 250,
                  padding: "8px 34px 8px 10px",
                  border: "1px solid #9ebbd7",
                  background: "#fff",
                  color: "#174ea6",
                  fontWeight: 850,
                  cursor: "pointer",
                }}
              >
                <option value="">Seleccionar categoría...</option>
                {inventarioGrupos.map((grupo) => (
                  <option key={`nav-${grupo.categoria}`} value={grupo.categoria}>
                    {formatVentaCompraLabel(grupo.categoria)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingInventario && inventarioVisible.length === 0 ? (
            <div style={{ ...softCard, padding: 28, textAlign: "center", color: "#526b7b" }}>Cargando inventario...</div>
          ) : inventarioVisible.length === 0 ? (
            <div style={{ ...softCard, padding: 28, textAlign: "center" }}>
              <div style={{ fontWeight: 900, color: "#31475d" }}>No hay productos registrados en esta sucursal.</div>
              <div style={{ marginTop: 5, color: "#718397" }}>Cuando haya productos activos, aparecerán aquí con su imagen y existencias.</div>
            </div>
          ) : inventarioFiltrado.length === 0 ? (
            <div style={{ ...softCard, padding: 28, textAlign: "center", color: "#526b7b" }}>
              No hay productos que coincidan con la búsqueda.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {inventarioGrupos.map((grupo) => (
                <section
                  key={grupo.categoria}
                  id={`inventario-seccion-${grupo.categoria}`}
                  style={{ scrollMarginTop: 86 }}
                >
                  <div style={{ padding: "9px 12px", background: "#dceaff", border: "1px solid #b8cfe8", color: "#173b61" }}>
                    <strong style={{ fontSize: 15 }}>{formatVentaCompraLabel(grupo.categoria)}</strong>
                    <span style={{ marginLeft: 8, color: "#5d7690", fontSize: 12 }}>
                      {grupo.productos.length} producto(s)
                    </span>
                  </div>
                  <div style={{ ...softCard, overflowX: "auto", borderColor: "#c6d8ea", borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                    <table style={{ width: "100%", minWidth: 1220, tableLayout: "fixed", borderCollapse: "collapse", background: "#fff", fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: 390 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 95 }} />
                  <col style={{ width: 105 }} />
                  <col style={{ width: 240 }} />
                </colgroup>
                <thead>
                  <tr style={{ color: "#fff" }}>
                    <th align="left" style={{ padding: "9px 8px", background: "#173b61", color: "#fff", fontWeight: 900 }}>PRODUCTO</th>
                    <th align="left" style={{ padding: "9px 8px", background: "#0f766e", color: "#fff", fontWeight: 900 }}>CATEGORÍA</th>
                    <th align="left" style={{ padding: "9px 8px", background: "#315f89", color: "#fff", fontWeight: 900 }}>MODELO</th>
                    <th align="left" style={{ padding: "9px 8px", background: "#6d4b9c", color: "#fff", fontWeight: 900 }}>COLOR</th>
                    <th align="right" style={{ padding: "9px 8px", background: "#2563a6", color: "#fff", fontWeight: 900 }}>PRECIO</th>
                    <th align="center" style={{ padding: "9px 8px", background: "#b46516", color: "#fff", fontWeight: 900 }}>STOCK</th>
                    <th align="left" style={{ padding: "9px 8px", background: "#357d55", color: "#fff", fontWeight: 900 }}>{isAdmin ? "AJUSTAR STOCK" : "ACCESO"}</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.productos.map((producto) => {
                    const stockDraft = Math.max(
                      0,
                      Math.trunc(Number(inventarioStockDraft[producto.producto_id] ?? producto.stock)),
                    );
                    const stockBajo = producto.controla_stock && producto.stock <= producto.stock_minimo;
                    const guardando = savingInventarioId === producto.producto_id;
                    return (
                      <tr key={producto.producto_id} style={{ borderTop: "1px solid #dce6ef", background: stockBajo ? "#fffaf4" : "#fff" }}>
                        <td style={{ padding: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "58px minmax(160px, 1fr)", gap: 8, alignItems: "center" }}>
                            <button
                              type="button"
                              disabled={!producto.imagen_url}
                              onClick={() => producto.imagen_url && setInventarioImagenAmpliada(producto)}
                              title={producto.imagen_url ? "Ver imagen grande" : "Producto sin imagen"}
                              aria-label={producto.imagen_url ? `Ampliar imagen de ${producto.nombre}` : undefined}
                              style={{
                                width: 58,
                                height: 50,
                                padding: 0,
                                overflow: "hidden",
                                border: "1px solid #dbe5ed",
                                background: "#f5f7f9",
                                cursor: producto.imagen_url ? "zoom-in" : "default",
                              }}
                            >
                              {producto.imagen_url ? (
                                <img src={producto.imagen_url} alt={producto.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              ) : (
                                <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8aa0b2" }}>◇</span>
                              )}
                            </button>
                            <div>
                              <strong style={{ display: "block", color: "#173b61" }}>{producto.nombre}</strong>
                              <span style={{ display: "block", marginTop: 3, color: "#6b7f93", fontSize: 11 }}>
                                ID {producto.producto_id} · {producto.sku}
                              </span>
                              {producto.descripcion && (
                                <span style={{ display: "block", marginTop: 3, maxWidth: 310, color: "#7b8da0", fontSize: 11, lineHeight: 1.25 }}>
                                  {producto.descripcion}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: 8, background: "#effaf8" }}>
                          <strong style={{ display: "block", color: "#31475d" }}>{formatVentaCompraLabel(producto.categoria)}</strong>
                          <span style={{ display: "block", marginTop: 3, color: "#718397", fontSize: 11 }}>{producto.subcategoria || "—"}</span>
                        </td>
                        <td style={{ padding: 8, color: "#40566c", background: "#f1f7fb" }}>
                          {producto.modelo || "—"}
                        </td>
                        <td style={{ padding: 8, color: "#4c3b65", background: "#f8f5ff" }}>
                          {producto.color || producto.tipo_mica || "—"}
                        </td>
                        <td align="right" style={{ padding: 8, color: "#174ea6", background: "#eff6ff", fontWeight: 900, whiteSpace: "nowrap" }}>
                          ${Number(producto.precio || 0).toFixed(2)}
                        </td>
                        <td align="center" style={{ padding: 8, background: "#fff8ed" }}>
                          <span
                            style={{
                              display: "inline-block",
                              minWidth: 92,
                              padding: "6px 9px",
                              borderRadius: 999,
                              background: !producto.controla_stock ? "#eaf2ff" : producto.stock <= 0 ? "#fee2e2" : stockBajo ? "#ffedd5" : "#dcfce7",
                              color: !producto.controla_stock ? "#174ea6" : producto.stock <= 0 ? "#991b1b" : stockBajo ? "#9a3412" : "#166534",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            {!producto.controla_stock ? "SERVICIO" : producto.stock <= 0 ? "AGOTADO" : `${producto.stock} UNIDADES`}
                          </span>
                        </td>
                        <td style={{ padding: 8 }}>
                          {isAdmin && producto.controla_stock ? (
                            <div style={{ display: "grid", gridTemplateColumns: "32px 62px 32px auto", gap: 5, minWidth: 225 }}>
                              <button
                                type="button"
                                onClick={() => setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: Math.max(0, stockDraft - 1) }))}
                                style={{ border: "1px solid #b9c9d8", background: "#f8fafc", color: "#31475d", fontSize: 17, fontWeight: 900, cursor: "pointer" }}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={0}
                                value={stockDraft}
                                onChange={(e) => setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: Math.max(0, Number(e.target.value || 0)) }))}
                                style={{ width: "100%", padding: 7, border: "1px solid #b9c9d8", textAlign: "center", fontWeight: 900 }}
                              />
                              <button
                                type="button"
                                onClick={() => setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: stockDraft + 1 }))}
                                style={{ border: "1px solid #b9c9d8", background: "#f8fafc", color: "#31475d", fontSize: 17, fontWeight: 900, cursor: "pointer" }}
                              >
                                +
                              </button>
                              <button
                                type="button"
                                disabled={guardando || stockDraft === producto.stock}
                                onClick={() => guardarStockInventario(producto)}
                                style={{
                                  padding: "7px 10px",
                                  border: "1px solid #1d4ed8",
                                  background: guardando || stockDraft === producto.stock ? "#dbe4ee" : "#2563eb",
                                  color: guardando || stockDraft === producto.stock ? "#60758a" : "#fff",
                                  fontWeight: 900,
                                  cursor: guardando || stockDraft === producto.stock ? "not-allowed" : "pointer",
                                }}
                              >
                                {guardando ? "Guardando..." : "Guardar"}
                              </button>
                            </div>
                          ) : producto.controla_stock ? (
                            <span style={{ color: "#526b7b", fontSize: 12, fontWeight: 800 }}>Solo lectura</span>
                          ) : (
                            <span style={{ color: "#718397", fontSize: 12 }}>No descuenta existencias</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
            </>
          )}

          {isAdmin && inventarioVista === "costos" && (
            <>
              {inventarioMetricaAyuda && (
                <div style={{ padding: 12, border: "1px solid #c4b5d9", background: "#faf7ff", color: "#46325f", lineHeight: 1.45 }}>
                  <strong>{inventarioMetricaAyuda === "valor" ? "Valor del inventario" : "Ganancia potencial total"}</strong>
                  <div style={{ marginTop: 3 }}>
                    {inventarioMetricaAyuda === "valor"
                      ? "Es el dinero invertido en las unidades que tienes actualmente: costo unitario × stock. No representa ventas ni ganancias."
                      : "Es la ganancia bruta estimada si vendieras todo el stock al precio actual: (precio de venta − costo unitario) × stock. No descuenta gastos, impuestos, cupones, devoluciones ni otros costos."}
                  </div>
                </div>
              )}
            <div style={{ ...softCard, overflowX: "auto", borderColor: "#b9d7d2" }}>
              <table style={{ width: "100%", minWidth: 1540, tableLayout: "fixed", borderCollapse: "collapse", background: "#fff", fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: 190 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 125 }} />
                  <col style={{ width: 125 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 135 }} />
                  <col style={{ width: 145 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
                <thead>
                  <tr style={{ color: "#fff", whiteSpace: "nowrap" }}>
                    <th align="left" style={{ padding: "10px 8px", background: "#173b61", color: "#fff" }}>PRODUCTO</th>
                    <th align="left" style={{ padding: "10px 8px", background: "#244f78", color: "#fff" }}>SKU</th>
                    <th align="left" style={{ padding: "10px 8px", background: "#315f89", color: "#fff" }}>MODELO</th>
                    <th align="left" style={{ padding: "10px 8px", background: "#3f6f99", color: "#fff" }}>COLOR</th>
                    <th align="right" style={{ padding: "10px 8px", background: "#2563a6", color: "#fff" }}>PRECIO VENTA</th>
                    <th align="right" style={{ padding: "10px 8px", background: "#0f766e", color: "#fff" }}>COSTO UNITARIO</th>
                    <th align="right" style={{ padding: "10px 8px", background: "#357d55", color: "#fff" }}>GANANCIA / UNIDAD</th>
                    <th align="right" style={{ padding: "10px 8px", background: "#438b62", color: "#fff" }}>MARGEN</th>
                    <th align="center" style={{ padding: "10px 8px", background: "#b46516", color: "#fff" }}>STOCK ACTUAL</th>
                    <th align="right" style={{ padding: "7px 8px", background: "#6d4b9c", color: "#fff" }}>
                      <button
                        type="button"
                        onClick={() => setInventarioMetricaAyuda((prev) => prev === "valor" ? null : "valor")}
                        style={{ padding: 0, border: 0, background: "transparent", color: "#fff", font: "inherit", fontWeight: 900, cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                      >
                        VALOR INVENTARIO ?
                      </button>
                    </th>
                    <th align="right" style={{ padding: "7px 8px", background: "#7c3c82", color: "#fff" }}>
                      <button
                        type="button"
                        onClick={() => setInventarioMetricaAyuda((prev) => prev === "ganancia" ? null : "ganancia")}
                        style={{ padding: 0, border: 0, background: "transparent", color: "#fff", font: "inherit", fontWeight: 900, cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                      >
                        GANANCIA POTENCIAL ?
                      </button>
                    </th>
                    <th align="center" style={{ padding: "10px 8px", background: "#374151", color: "#fff" }}>GUARDAR</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioFiltrado.map((producto) => {
                    const costo = Math.max(0, Number(inventarioCostoDraft[producto.producto_id] ?? producto.costo_unitario ?? 0));
                    const precio = Math.max(0, Number(inventarioPrecioDraft[producto.producto_id] ?? producto.precio));
                    const stock = producto.controla_stock
                      ? Math.max(0, Math.trunc(Number(inventarioStockDraft[producto.producto_id] ?? producto.stock)))
                      : 0;
                    const ganancia = precio - costo;
                    const margen = precio > 0 ? (ganancia / precio) * 100 : 0;
                    const sinCambios =
                      stock === Number(producto.stock || 0)
                      && precio === Number(producto.precio || 0)
                      && costo === Number(producto.costo_unitario || 0);
                    const guardando = savingInventarioId === producto.producto_id;
                    return (
                      <tr key={`rentabilidad-${producto.producto_id}`} style={{ borderTop: "1px solid #dce6ef" }}>
                        <td style={{ padding: "9px 8px", background: "#f7faff", fontWeight: 850, color: "#173b61" }}>{producto.nombre}</td>
                        <td style={{ padding: "9px 8px", background: "#f4f8fc", color: "#40566c", whiteSpace: "nowrap" }}>{producto.sku}</td>
                        <td style={{ padding: "9px 8px", background: "#f1f7fb", color: "#40566c" }}>{producto.modelo || "—"}</td>
                        <td style={{ padding: "9px 8px", background: "#eef5fa", color: "#40566c" }}>{producto.color || "—"}</td>
                        <td align="right" style={{ padding: "7px 6px", background: "#eff6ff" }}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={precio}
                            onChange={(e) => setInventarioPrecioDraft((prev) => ({ ...prev, [producto.producto_id]: Number(e.target.value || 0) }))}
                            aria-label={`Precio de venta de ${producto.nombre}`}
                            style={{ width: "100%", padding: "7px 6px", border: "1px solid #8cb4df", textAlign: "right", fontWeight: 850 }}
                          />
                        </td>
                        <td align="right" style={{ padding: "7px 6px", background: "#effaf8" }}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={costo}
                            onChange={(e) => setInventarioCostoDraft((prev) => ({ ...prev, [producto.producto_id]: Number(e.target.value || 0) }))}
                            aria-label={`Costo unitario de ${producto.nombre}`}
                            style={{ width: "100%", padding: "7px 6px", border: "1px solid #75aaa3", textAlign: "right", fontWeight: 850 }}
                          />
                        </td>
                        <td align="right" style={{ padding: "9px 8px", background: ganancia >= 0 ? "#f0fdf4" : "#fef2f2", color: ganancia >= 0 ? "#166534" : "#991b1b", fontWeight: 900, whiteSpace: "nowrap" }}>
                          ${ganancia.toFixed(2)}
                        </td>
                        <td align="right" style={{ padding: "9px 8px", background: "#f2fbf5", color: margen >= 0 ? "#166534" : "#991b1b", fontWeight: 900, whiteSpace: "nowrap" }}>{margen.toFixed(1)}%</td>
                        <td align="center" style={{ padding: "7px 6px", background: "#fff8ed", color: "#92400e", fontWeight: 900 }}>
                          {producto.controla_stock ? (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={stock}
                              onChange={(e) => setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: Math.max(0, Math.trunc(Number(e.target.value || 0))) }))}
                              aria-label={`Stock de ${producto.nombre}`}
                              style={{ width: "100%", padding: "7px 5px", border: "1px solid #d9a45e", textAlign: "center", fontWeight: 900 }}
                            />
                          ) : "Servicio"}
                        </td>
                        <td align="right" style={{ padding: "9px 8px", background: "#f8f5ff", fontWeight: 850, whiteSpace: "nowrap" }}>${(costo * stock).toFixed(2)}</td>
                        <td align="right" style={{ padding: "9px 8px", background: "#fbf4fc", color: ganancia >= 0 ? "#5b2166" : "#991b1b", fontWeight: 900, whiteSpace: "nowrap" }}>${(ganancia * stock).toFixed(2)}</td>
                        <td align="center" style={{ padding: "7px 6px", background: "#f9fafb" }}>
                          <button
                            type="button"
                            disabled={guardando || sinCambios}
                            onClick={() => guardarProductoInventario(producto)}
                            style={{
                              width: "100%",
                              padding: "8px 7px",
                              border: "1px solid #1d4ed8",
                              background: guardando || sinCambios ? "#e2e8f0" : "#2563eb",
                              color: guardando || sinCambios ? "#64748b" : "#fff",
                              fontWeight: 900,
                              cursor: guardando || sinCambios ? "not-allowed" : "pointer",
                            }}
                          >
                            {guardando ? "Guardando..." : "Guardar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {tab === "estadisticas" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ ...softCard, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>
                Estadísticas de sucursal #{sucursalActivaId}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openExportModal}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #0d7a6f",
                      background: "#0f9a8d",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Exportar CSV
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => loadStats()}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #5346a8",
                    background: "#6A5ACD",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Actualizar estadísticas
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => { setStatsFiltroModo("hoy"); loadStats({ modo: "hoy" }); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "hoy" ? "#111" : "#fff", color: statsFiltroModo === "hoy" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Hoy</button>
              <button type="button" onClick={() => { setStatsFiltroModo("ayer"); loadStats({ modo: "ayer" }); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "ayer" ? "#111" : "#fff", color: statsFiltroModo === "ayer" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Ayer</button>
              <button type="button" onClick={() => { setStatsFiltroModo("dia"); loadStats({ modo: "dia", fecha: statsFecha }); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "dia" ? "#111" : "#fff", color: statsFiltroModo === "dia" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Día</button>
              <button type="button" onClick={() => { setStatsFiltroModo("semana"); loadStats({ modo: "semana" }); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "semana" ? "#111" : "#fff", color: statsFiltroModo === "semana" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Semana</button>
              <button type="button" onClick={() => setStatsFiltroModo("mes")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "mes" ? "#111" : "#fff", color: statsFiltroModo === "mes" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Mes</button>
              <button type="button" onClick={() => setStatsFiltroModo("anio")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "anio" ? "#111" : "#fff", color: statsFiltroModo === "anio" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Año</button>
              <button type="button" onClick={() => setStatsFiltroModo("rango")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "rango" ? "#111" : "#fff", color: statsFiltroModo === "rango" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Rango</button>
            </div>

            {statsFiltroModo === "dia" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                <DateInputPro value={statsFecha} onChange={setStatsFecha} />
                <button
                  type="button"
                  onClick={() => loadStats({ modo: "dia", fecha: statsFecha })}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  Aplicar
                </button>
              </div>
            )}

            {(statsFiltroModo === "mes" || statsFiltroModo === "anio") && (
              <div style={{ display: "grid", gridTemplateColumns: statsFiltroModo === "mes" ? "1fr 1fr auto" : "1fr auto", gap: 10, alignItems: "end" }}>
                <input type="number" min={2020} max={2100} value={statsAnio} onChange={(e) => setStatsAnio(e.target.value)} placeholder="Año" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                {statsFiltroModo === "mes" && (
                  <select value={statsMes} onChange={(e) => setStatsMes(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                    <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option><option value="4">Abril</option>
                    <option value="5">Mayo</option><option value="6">Junio</option><option value="7">Julio</option><option value="8">Agosto</option>
                    <option value="9">Septiembre</option><option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => loadStats({ modo: statsFiltroModo, mes: statsMes, anio: statsAnio })}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  Aplicar
                </button>
              </div>
            )}

            {statsFiltroModo === "rango" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Fecha de</span>
                  <DateInputPro value={statsFechaDesde} onChange={setStatsFechaDesde} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Fecha hasta</span>
                  <DateInputPro value={statsFechaHasta} onChange={setStatsFechaHasta} />
                </label>
                <button
                  type="button"
                  onClick={() => loadStats({ modo: "rango", fechaDesde: statsFechaDesde, fechaHasta: statsFechaHasta })}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  Aplicar
                </button>
              </div>
            )}

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Filtro actual: {statsData?.periodo?.label ?? statsFiltroLabel}
            </div>
          </div>

          {isAdmin && exportModalOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "grid",
                placeItems: "center",
                zIndex: 1200,
                padding: 16,
              }}
            >
              <div style={{ ...softCard, width: "min(860px, 96vw)", padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Reportes / Exportar CSV</div>
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(false)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                  >
                    Cerrar
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Tipo</span>
                    <div style={{ display: "grid", gap: 6, padding: 8, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.length === 7}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExportTiposSeleccionados([
                                "consultas",
                                "ventas",
                                "pacientes",
                                "historias_clinicas",
                                "historias_ml",
                                "sucursales",
                                "diccionario_columnas_fisico",
                              ]);
                            }
                            else setExportTiposSeleccionados([]);
                          }}
                        />
                        <span>Todas</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("consultas")}
                          onChange={() => toggleExportTipo("consultas")}
                        />
                        <span>Consultas</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("ventas")}
                          onChange={() => toggleExportTipo("ventas")}
                        />
                        <span>Ventas</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("pacientes")}
                          onChange={() => toggleExportTipo("pacientes")}
                        />
                        <span>Pacientes</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("historias_clinicas")}
                          onChange={() => toggleExportTipo("historias_clinicas")}
                        />
                        <span>Historias clínicas</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("historias_ml")}
                          onChange={() => toggleExportTipo("historias_ml")}
                        />
                        <span>Historias ML (base)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("sucursales")}
                          onChange={() => toggleExportTipo("sucursales")}
                        />
                        <span>Sucursales</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={exportTiposSeleccionados.includes("diccionario_columnas_fisico")}
                          onChange={() => toggleExportTipo("diccionario_columnas_fisico")}
                        />
                        <span>Diccionario (físico)</span>
                      </label>
                    </div>
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Sucursal</span>
                    <select
                      value={exportSucursalId}
                      onChange={(e) => setExportSucursalId(e.target.value)}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                    >
                      <option value="all">Ambas</option>
                      {sucursales.map((s) => (
                        <option key={`export-suc-${s.sucursal_id}`} value={String(s.sucursal_id)}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Desde</span>
                    <DateInputPro value={exportDesde} onChange={setExportDesde} />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Hasta</span>
                    <DateInputPro value={exportHasta} onChange={setExportHasta} />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Paciente (opcional, por nombre o ID)</span>
                    <div style={{ position: "relative" }}>
                      <input
                        value={exportPacienteTexto}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setExportPacienteTexto(raw);
                          const m = raw.match(/^\s*(\d+)\s*-/);
                          setExportPacienteId(m ? m[1] : "");
                        }}
                        onFocus={() => setExportPacienteFocused(true)}
                        onBlur={() => {
                          setTimeout(() => setExportPacienteFocused(false), 130);
                        }}
                        placeholder="Escribe nombre, teléfono, correo o ID"
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                      />
                      {exportPacienteFocused && (exportPacienteTexto.trim() || exportPacienteOpciones.length > 0) && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "calc(100% + 4px)",
                            zIndex: 30,
                            maxHeight: 220,
                            overflowY: "auto",
                            border: "1px solid #ddd",
                            borderRadius: 10,
                            background: "#fff",
                            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                          }}
                        >
                          {loadingExportPaciente ? (
                            <div style={{ padding: "8px 10px", fontSize: 13, opacity: 0.75 }}>
                              Buscando pacientes...
                            </div>
                          ) : exportPacienteOpciones.length === 0 ? (
                            <div style={{ padding: "8px 10px", fontSize: 13, opacity: 0.75 }}>
                              Sin coincidencias.
                            </div>
                          ) : (
                            exportPacienteOpciones.slice(0, 20).map((op) => (
                              <button
                                key={`export-paciente-opt-${op.id}`}
                                type="button"
                                onClick={() => {
                                  setExportPacienteTexto(`${op.id} - ${op.label}`);
                                  setExportPacienteId(String(op.id));
                                  setExportPacienteFocused(false);
                                }}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  border: "none",
                                  borderBottom: "1px solid #f0f0f0",
                                  background: "#fff",
                                  padding: "9px 10px",
                                  cursor: "pointer",
                                }}
                              >
                                {op.id} - {op.label}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, opacity: 0.72 }}>
                      Déjalo vacío para exportar todos los pacientes.
                    </span>
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Delimitador</span>
                    <select
                      value={exportDelimiter}
                      onChange={(e) => setExportDelimiter(e.target.value as "comma" | "semicolon")}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                    >
                      <option value="comma">Coma</option>
                      <option value="semicolon">Punto y coma</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(false)}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={downloadExportCsv}
                    disabled={
                      exportLoading ||
                      exportTiposSeleccionados.length === 0 ||
                      (exportRequiereRango && (!exportDesde || !exportHasta || exportHasta < exportDesde))
                    }
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #0d7a6f",
                      background: exportLoading ? "#9ad5cf" : "#0f9a8d",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: exportLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {exportLoading ? "Descargando..." : "Descargar CSV"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loadingStats ? (
            <div style={{ ...softCard, padding: 14 }}>Cargando estadísticas...</div>
          ) : !statsData ? (
            <div style={{ ...softCard, padding: 14 }}>Sin datos de estadísticas.</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div style={{ ...softCard, padding: 14 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Consultas (periodo)</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{statsData.consultas.total}</div>
                </div>
                {canViewVentasPeriodoKpi && (
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Ventas (periodo)</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{statsData.ventas.total}</div>
                  </div>
                )}
                {isAdmin && (
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Monto ventas (periodo)</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>${Number(statsData.ventas.monto_total || 0).toFixed(2)}</div>
                  </div>
                )}
              </div>

              <div style={{ ...softCard, padding: 14, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>Pacientes creados</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{statsData.pacientes_creados?.label ?? "Sin datos"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setStatsPacientesModo("dia")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: statsPacientesModo === "dia" ? "#111" : "#fff", color: statsPacientesModo === "dia" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Día</button>
                  <button type="button" onClick={() => setStatsPacientesModo("mes")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: statsPacientesModo === "mes" ? "#111" : "#fff", color: statsPacientesModo === "mes" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Mes</button>
                  <button type="button" onClick={() => setStatsPacientesModo("anio")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: statsPacientesModo === "anio" ? "#111" : "#fff", color: statsPacientesModo === "anio" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Año</button>
                  <button type="button" onClick={() => setStatsPacientesModo("rango")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: statsPacientesModo === "rango" ? "#111" : "#fff", color: statsPacientesModo === "rango" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Rango</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: statsPacientesModo === "mes" ? "1fr 1fr auto" : statsPacientesModo === "anio" || statsPacientesModo === "dia" ? "1fr auto" : "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  {statsPacientesModo === "mes" && (
                    <select value={statsPacientesMes} onChange={(e) => setStatsPacientesMes(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                      {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((label, idx) => (
                        <option key={label} value={String(idx + 1)}>{label}</option>
                      ))}
                    </select>
                  )}
                  {(statsPacientesModo === "mes" || statsPacientesModo === "anio") && (
                    <input type="number" min={2020} max={2100} value={statsPacientesAnio} onChange={(e) => setStatsPacientesAnio(e.target.value)} placeholder="Año" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                  )}
                  {statsPacientesModo === "dia" && (
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Fecha</span>
                      <DateInputPro value={statsPacientesFecha} onChange={setStatsPacientesFecha} />
                    </label>
                  )}
                  {statsPacientesModo === "rango" && (
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Fecha de</span>
                      <DateInputPro value={statsPacientesFechaDesde} onChange={setStatsPacientesFechaDesde} />
                    </label>
                  )}
                  {statsPacientesModo === "rango" && (
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Fecha hasta</span>
                      <DateInputPro value={statsPacientesFechaHasta} onChange={setStatsPacientesFechaHasta} />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      loadStats({
                        pacientesModo: statsPacientesModo,
                        pacientesAnio: statsPacientesAnio,
                        pacientesMes: statsPacientesMes,
                        pacientesFecha: statsPacientesFecha,
                        pacientesFechaDesde: statsPacientesFechaDesde,
                        pacientesFechaHasta: statsPacientesFechaHasta,
                      })
                    }
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                  >
                    Aplicar
                  </button>
                </div>
                {statsPacientesCreadosSerie.length === 0 ? (
                  <div>Sin pacientes creados para este filtro.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(Math.max(statsPacientesCreadosSerie.length, 1), 62)}, minmax(26px, 1fr))`, gap: 8, alignItems: "end", minHeight: 220, borderTop: "1px solid #f0e7dc", paddingTop: 12 }}>
                    {(() => {
                      const maxValue = Math.max(1, ...statsPacientesCreadosSerie.map((x) => x.total));
                      return statsPacientesCreadosSerie.map((item, idx) => (
                        <div key={`pacientes-serie-${idx}-${item.etiqueta}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{item.total}</div>
                          <div style={{ width: "100%", height: Math.max(6, Math.round((item.total / maxValue) * 150)), borderRadius: 8, background: "#6F8A3C" }} />
                          <div style={{ fontSize: 10, opacity: 0.8, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{item.etiqueta}</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {canViewVentasMetodoPie && (
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>Pie chart: ventas por método de pago</div>
                    {statsData.ventas.por_metodo_pago.length === 0 ? (
                      <div>Sin ventas en el periodo.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 14, alignItems: "center" }}>
                        {(() => {
                          const colors = ["#4D7A9B", "#6A5ACD", "#6F8A3C", "#C9822B", "#9E5F40", "#8A5B2C"];
                          const total = statsData.ventas.por_metodo_pago.reduce((acc, x) => acc + x.total, 0) || 1;
                          let acc = 0;
                          const parts = statsData.ventas.por_metodo_pago.map((item, idx) => {
                            const startPct = (acc / total) * 100;
                            acc += item.total;
                            const endPct = (acc / total) * 100;
                            return `${colors[idx % colors.length]} ${startPct}% ${endPct}%`;
                          });
                          return <div style={{ width: 170, height: 170, borderRadius: "50%", border: "1px solid #ddd", background: `conic-gradient(${parts.join(", ")})` }} />;
                        })()}
                        <div style={{ display: "grid", gap: 8 }}>
                          {(() => {
                            const total = statsData.ventas.por_metodo_pago.reduce((acc, x) => acc + x.total, 0) || 1;
                            return statsData.ventas.por_metodo_pago.map((item) => (
                              <div key={`metodo-${item.etiqueta}`} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0e7dc", paddingBottom: 4 }}>
                                <span>{formatStatsEtiqueta(item.etiqueta)}</span>
                                <strong>{item.total} ({Math.round((item.total / total) * 100)}%)</strong>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ ...softCard, padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>Pie chart: consultas por tipo</div>
                  {statsData.consultas.por_tipo.length === 0 ? (
                    <div>Sin consultas en el periodo.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 14, alignItems: "center" }}>
                      {(() => {
                        const colors = ["#C9822B", "#6A5ACD", "#4D7A9B", "#6F8A3C", "#9E5F40", "#8A5B2C", "#4E5D6A"];
                        const total = statsData.consultas.por_tipo.reduce((acc, x) => acc + x.total, 0) || 1;
                        let acc = 0;
                        const parts = statsData.consultas.por_tipo.map((item, idx) => {
                          const startPct = (acc / total) * 100;
                          acc += item.total;
                          const endPct = (acc / total) * 100;
                          return `${colors[idx % colors.length]} ${startPct}% ${endPct}%`;
                        });
                        return <div style={{ width: 170, height: 170, borderRadius: "50%", border: "1px solid #ddd", background: `conic-gradient(${parts.join(", ")})` }} />;
                      })()}
                      <div style={{ display: "grid", gap: 8 }}>
                        {(() => {
                          const total = statsData.consultas.por_tipo.reduce((acc, x) => acc + x.total, 0) || 1;
                          return statsData.consultas.por_tipo.map((item) => (
                            <div key={`tipo-${item.etiqueta}`} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0e7dc", paddingBottom: 4 }}>
                              <span>{formatStatsEtiqueta(item.etiqueta)}</span>
                              <strong>{item.total} ({Math.round((item.total / total) * 100)}%)</strong>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...softCard, padding: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Pie chart: productos más comprados (periodo)</div>
                {statsData.productos_top.length === 0 ? (
                  <div>Sin ventas de productos en el periodo.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 14, alignItems: "center" }}>
                    {(() => {
                      const colors = ["#C9822B", "#4D7A9B", "#6A5ACD", "#6F8A3C", "#9E5F40", "#8A5B2C", "#4E5D6A"];
                      const total = statsData.productos_top.reduce((acc, x) => acc + x.total, 0) || 1;
                      let acc = 0;
                      const parts = statsData.productos_top.map((item, idx) => {
                        const startPct = (acc / total) * 100;
                        acc += item.total;
                        const endPct = (acc / total) * 100;
                        return `${colors[idx % colors.length]} ${startPct}% ${endPct}%`;
                      });
                      return <div style={{ width: 170, height: 170, borderRadius: "50%", border: "1px solid #ddd", background: `conic-gradient(${parts.join(", ")})` }} />;
                    })()}
                    <div style={{ display: "grid", gap: 8 }}>
                      {(() => {
                        const total = statsData.productos_top.reduce((acc, x) => acc + x.total, 0) || 1;
                        return statsData.productos_top.map((item) => (
                          <div key={`prod-${item.producto}`} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f0e7dc", paddingBottom: 4 }}>
                            <span>{formatStatsEtiqueta(item.producto)}</span>
                            <strong>{item.total} ({Math.round((item.total / total) * 100)}%)</strong>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {canViewTopPacientesMes && (
                <div style={{ ...softCard, padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>
                    {statsData.top_pacientes_mes_actual?.label ?? "Top 10 pacientes por compra total (mes actual)"}
                  </div>
                  {statsTopPacientesMesActual.length === 0 ? (
                    <div>Sin ventas de pacientes en el mes actual.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {statsTopPacientesMesActual.map((item, idx) => (
                        <div
                          key={`top-paciente-${item.paciente_id}-${idx}`}
                          style={{ display: "grid", gridTemplateColumns: "40px 1fr 120px 140px", gap: 10, alignItems: "center", borderBottom: "1px solid #f0e7dc", paddingBottom: 6 }}
                        >
                          <div style={{ fontWeight: 800, color: "#6b4f37" }}>#{idx + 1}</div>
                          <div style={{ fontSize: 13 }}>{item.paciente_nombre || `Paciente #${item.paciente_id}`}</div>
                          <div style={{ textAlign: "right", fontSize: 13 }}>{item.total_ventas} ventas</div>
                          <div style={{ textAlign: "right", fontWeight: 800 }}>${Number(item.monto_total || 0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...softCard, padding: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  {statsData.top_pacientes_consultas?.label ?? "Top 10 pacientes con más consultas (periodo)"}
                </div>
                {statsTopPacientesConsultas.length === 0 ? (
                  <div>Sin consultas de pacientes en el periodo seleccionado.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {statsTopPacientesConsultas.map((item, idx) => (
                      <div
                        key={`top-consultas-paciente-${item.paciente_id}-${idx}`}
                        style={{ display: "grid", gridTemplateColumns: "40px 1fr 160px", gap: 10, alignItems: "center", borderBottom: "1px solid #f0e7dc", paddingBottom: 6 }}
                      >
                        <div style={{ fontWeight: 800, color: "#6b4f37" }}>#{idx + 1}</div>
                        <div style={{ fontSize: 13 }}>{item.paciente_nombre || `Paciente #${item.paciente_id}`}</div>
                        <div style={{ textAlign: "right", fontWeight: 800 }}>{item.total_consultas} consultas</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ ...softCard, padding: 14, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>Series mensuales (enero a diciembre)</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Año</span>
                      <input type="number" min={2020} max={2100} value={statsSeriesAnio} onChange={(e) => setStatsSeriesAnio(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 120 }} />
                    </label>
                    <button
                      type="button"
                      onClick={() => loadStats({ seriesAnio: statsSeriesAnio })}
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 12 }}>
                  {canViewMoneyMonthlyChart && (
                    <div style={{ ...softCard, padding: 12 }}>
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>Dinero entrante mes con mes ({statsData.anual_mensual?.anio ?? statsSeriesAnio})</div>
                      {statsIngresosPorMes.length === 0 ? (
                        <div>Sin datos.</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(26px, 1fr))", gap: 8, alignItems: "end", minHeight: 220 }}>
                          {(() => {
                            const maxValue = Math.max(1, ...statsIngresosPorMes.map((x) => Number(x.total || 0)));
                            return statsIngresosPorMes.map((item) => (
                              <div key={`ingreso-mes-${item.mes}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                                <div style={{ fontWeight: 700, fontSize: 11 }}>${Number(item.total || 0).toFixed(0)}</div>
                                <div style={{ width: "100%", height: Math.max(6, Math.round((Number(item.total || 0) / maxValue) * 150)), borderRadius: 8, background: "#5B8A72" }} />
                                <div style={{ fontSize: 10, opacity: 0.85 }}>{item.etiqueta}</div>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ ...softCard, padding: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Consultas mes con mes ({statsData.anual_mensual?.anio ?? statsSeriesAnio})</div>
                    {statsConsultasPorMes.length === 0 ? (
                      <div>Sin datos.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(26px, 1fr))", gap: 8, alignItems: "end", minHeight: 220 }}>
                        {(() => {
                          const maxValue = Math.max(1, ...statsConsultasPorMes.map((x) => Number(x.total || 0)));
                          return statsConsultasPorMes.map((item) => (
                            <div key={`consulta-mes-${item.mes}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                              <div style={{ fontWeight: 700, fontSize: 11 }}>{Number(item.total || 0)}</div>
                              <div style={{ width: "100%", height: Math.max(6, Math.round((Number(item.total || 0) / maxValue) * 150)), borderRadius: 8, background: "#4D7A9B" }} />
                              <div style={{ fontSize: 10, opacity: 0.85 }}>{item.etiqueta}</div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div style={{ ...softCard, padding: 14, display: "grid", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>Comparativo entre sucursales (solo admin)</div>

                  <div style={{ ...softCard, padding: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>
                      Consultas por sucursal ({statsComparativo?.consultas_periodo_label ?? statsData.periodo.label})
                    </div>
                    {statsConsultasComparativo.length === 0 ? (
                      <div>Sin datos.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${statsConsultasComparativo.length}, minmax(120px, 1fr))`, gap: 10, alignItems: "end", minHeight: 220 }}>
                        {(() => {
                          const maxValue = Math.max(1, ...statsConsultasComparativo.map((x) => Number(x.total || 0)));
                          return statsConsultasComparativo.map((item, idx) => (
                            <div key={`comparativo-consultas-${item.sucursal_id}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                              <div style={{ fontWeight: 800 }}>{Number(item.total || 0)}</div>
                              <div
                                style={{
                                  width: "70%",
                                  height: Math.max(8, Math.round((Number(item.total || 0) / maxValue) * 150)),
                                  borderRadius: 10,
                                  background: statsComparativoColors[idx % statsComparativoColors.length],
                                }}
                              />
                              <div style={{ fontSize: 12, textAlign: "center", opacity: 0.85 }}>{item.sucursal_nombre}</div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  <div style={{ ...softCard, padding: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>
                      Ventas mes con mes por sucursal ({statsComparativo?.anio ?? statsSeriesAnio})
                    </div>
                    {statsVentasComparativo.length === 0 ? (
                      <div>Sin datos.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {statsVentasComparativo.map((s, idx) => (
                            <div key={`legend-ventas-${s.sucursal_id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                              <span style={{ width: 12, height: 12, borderRadius: 3, display: "inline-block", background: statsComparativoColors[idx % statsComparativoColors.length] }} />
                              <span>{s.sucursal_nombre}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(52px, 1fr))", gap: 10, alignItems: "end", minHeight: 280, padding: "18px 10px 8px", borderRadius: 14, background: "repeating-linear-gradient(to top, #f8fafc 0, #f8fafc 49px, #e2e8f0 50px)" }}>
                          {(() => {
                            const maxValue = Math.max(
                              1,
                              ...statsVentasComparativo.flatMap((s) => s.serie.map((m) => Number(m.total || 0))),
                            );
                            return Array.from({ length: 12 }, (_, monthIdx) => (
                              <div key={`comparativo-ventas-mes-${monthIdx + 1}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                                <div style={{ display: "flex", gap: 5, alignItems: "end", width: "100%", justifyContent: "center", height: 215 }}>
                                  {statsVentasComparativo.map((s, sIdx) => {
                                    const value = Number(s.serie[monthIdx]?.total || 0);
                                    return (
                                      <div
                                        key={`comparativo-ventas-${s.sucursal_id}-${monthIdx + 1}`}
                                        title={`${s.sucursal_nombre}: $${value.toFixed(2)}`}
                                        style={{
                                          width: Math.max(18, Math.floor(58 / Math.max(statsVentasComparativo.length, 1))),
                                          height: "100%",
                                          display: "flex",
                                          flexDirection: "column",
                                          justifyContent: "flex-end",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span style={{ fontSize: 10, fontWeight: 900, color: "#334155", whiteSpace: "nowrap", marginBottom: 4 }}>
                                          ${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                                        </span>
                                        <span
                                          style={{
                                            display: "block",
                                            width: "100%",
                                            height: Math.max(6, Math.round((value / maxValue) * 170)),
                                            borderRadius: "7px 7px 3px 3px",
                                            background: `linear-gradient(180deg, ${statsComparativoColors[sIdx % statsComparativoColors.length]}, ${statsComparativoColors[sIdx % statsComparativoColors.length]}cc)`,
                                            boxShadow: "0 4px 10px rgba(15, 23, 42, .12)",
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>{statsVentasComparativo[0]?.serie[monthIdx]?.etiqueta ?? "-"}</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ ...softCard, padding: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>
                      Pacientes creados mes con mes por sucursal ({statsComparativo?.anio ?? statsSeriesAnio})
                    </div>
                    {statsPacientesComparativo.length === 0 ? (
                      <div>Sin datos.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {statsPacientesComparativo.map((s, idx) => (
                            <div key={`legend-pacientes-${s.sucursal_id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                              <span style={{ width: 12, height: 12, borderRadius: 3, display: "inline-block", background: statsComparativoColors[idx % statsComparativoColors.length] }} />
                              <span>{s.sucursal_nombre}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(52px, 1fr))", gap: 10, alignItems: "end", minHeight: 280, padding: "18px 10px 8px", borderRadius: 14, background: "repeating-linear-gradient(to top, #f8fafc 0, #f8fafc 49px, #e2e8f0 50px)" }}>
                          {(() => {
                            const maxValue = Math.max(
                              1,
                              ...statsPacientesComparativo.flatMap((s) => s.serie.map((m) => Number(m.total || 0))),
                            );
                            return Array.from({ length: 12 }, (_, monthIdx) => (
                              <div key={`comparativo-pacientes-mes-${monthIdx + 1}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                                <div style={{ display: "flex", gap: 5, alignItems: "end", width: "100%", justifyContent: "center", height: 215 }}>
                                  {statsPacientesComparativo.map((s, sIdx) => {
                                    const value = Number(s.serie[monthIdx]?.total || 0);
                                    return (
                                      <div
                                        key={`comparativo-pacientes-${s.sucursal_id}-${monthIdx + 1}`}
                                        title={`${s.sucursal_nombre}: ${value}`}
                                        style={{
                                          width: Math.max(18, Math.floor(58 / Math.max(statsPacientesComparativo.length, 1))),
                                          height: "100%",
                                          display: "flex",
                                          flexDirection: "column",
                                          justifyContent: "flex-end",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span style={{ fontSize: 11, fontWeight: 900, color: "#334155", marginBottom: 4 }}>{value}</span>
                                        <span
                                          style={{
                                            display: "block",
                                            width: "100%",
                                            height: Math.max(6, Math.round((value / maxValue) * 170)),
                                            borderRadius: "7px 7px 3px 3px",
                                            background: `linear-gradient(180deg, ${statsComparativoColors[sIdx % statsComparativoColors.length]}, ${statsComparativoColors[sIdx % statsComparativoColors.length]}cc)`,
                                            boxShadow: "0 4px 10px rgba(15, 23, 42, .12)",
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>{statsPacientesComparativo[0]?.serie[monthIdx]?.etiqueta ?? "-"}</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {canViewVentasCantidadMensualChart && (
                <div style={{ ...softCard, padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Ventas mes con mes (número de ventas) ({statsData.anual_mensual?.anio ?? statsSeriesAnio})
                  </div>
                  {statsVentasPorMes.length === 0 ? (
                    <div>Sin datos.</div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(12, minmax(26px, 1fr))",
                        gap: 8,
                        alignItems: "end",
                        minHeight: 220,
                      }}
                    >
                      {(() => {
                        const maxValue = Math.max(1, ...statsVentasPorMes.map((x) => Number(x.total || 0)));
                        return statsVentasPorMes.map((item) => (
                          <div key={`ventas-cantidad-mes-${item.mes}`} style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                            <div style={{ fontWeight: 700, fontSize: 11 }}>{Number(item.total || 0)}</div>
                            <div
                              style={{
                                width: "100%",
                                height: Math.max(6, Math.round((Number(item.total || 0) / maxValue) * 150)),
                                borderRadius: 8,
                                background: "#C9822B",
                              }}
                            />
                            <div style={{ fontSize: 10, opacity: 0.85 }}>{item.etiqueta}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}


      {selectedConsultaDetalle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 760,
              maxWidth: "96vw",
              borderRadius: 14,
              border: "1px solid #ddd",
              boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: "#3b2a1c" }}>
                Detalle de consulta #{selectedConsultaDetalle.consulta_id}
              </div>
              <button type="button" onClick={() => setSelectedConsultaDetalle(null)} style={{ ...actionBtnStyle, padding: "8px 12px" }}>
                Cerrar
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><b>Fecha y hora de registro:</b> {formatDateTimePretty(selectedConsultaDetalle.fecha_hora)}</div>
              <div><b>Fecha y hora de consulta:</b> {formatDateTimePretty(selectedConsultaDetalle.agenda_inicio ?? selectedConsultaDetalle.fecha_hora)}</div>
              <div><b>Paciente:</b> {selectedConsultaDetalle.paciente_nombre}</div>
              <div><b>Doctor:</b> {[selectedConsultaDetalle.doctor_primer_nombre, selectedConsultaDetalle.doctor_apellido_paterno].filter(Boolean).join(" ")}</div>
              <div><b>Sucursal:</b> {selectedConsultaDetalle.sucursal_nombre ?? ""}</div>
              <div style={{ gridColumn: "1 / -1" }}>
                <b>Tipo de consulta:</b>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {consultaTokensForUi(selectedConsultaDetalle).map((tipo) => (
                      <span
                        key={`modal-consulta-${selectedConsultaDetalle.consulta_id}-${tipo}`}
                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #d9c7b3", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}
                      >
                        {formatConsultaTokenLabel(tipo)}
                      </span>
                    ))}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <b>Notas:</b>
                <div style={{ marginTop: 6, minHeight: 56, border: "1px solid #ddd", borderRadius: 10, background: "#fffdf9", padding: 10 }}>
                  {selectedConsultaDetalle.notas?.trim() ? selectedConsultaDetalle.notas : "Sin notas"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {inventarioImagenAmpliada && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen de ${inventarioImagenAmpliada.nombre}`}
          onClick={() => setInventarioImagenAmpliada(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(8, 25, 43, .78)",
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "min(860px, 94vw)",
              maxHeight: "92vh",
              padding: 16,
              background: "#fff",
              boxShadow: "0 24px 70px rgba(0,0,0,.35)",
              cursor: "default",
            }}
          >
            <button
              type="button"
              onClick={() => setInventarioImagenAmpliada(null)}
              aria-label="Cerrar imagen"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 1,
                width: 38,
                height: 38,
                border: "1px solid #cbd7e2",
                borderRadius: 999,
                background: "rgba(255,255,255,.94)",
                color: "#173b61",
                fontSize: 22,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ×
            </button>
            <img
              src={inventarioImagenAmpliada.imagen_url ?? ""}
              alt={inventarioImagenAmpliada.nombre}
              style={{ display: "block", width: "100%", maxHeight: "75vh", objectFit: "contain", background: "#f4f7f9" }}
            />
            <div style={{ paddingTop: 12 }}>
              <strong style={{ display: "block", color: "#173b61", fontSize: 18 }}>{inventarioImagenAmpliada.nombre}</strong>
              <span style={{ display: "block", marginTop: 3, color: "#6b7f93", fontSize: 12 }}>
                {inventarioImagenAmpliada.modelo || inventarioImagenAmpliada.sku}
                {inventarioImagenAmpliada.color ? ` · ${inventarioImagenAmpliada.color}` : ""}
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedVentaDetalle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 760,
              maxWidth: "96vw",
              borderRadius: 14,
              border: "1px solid #ddd",
              boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: "#3b2a1c" }}>
                Detalle de venta #{selectedVentaDetalle.venta_id}
              </div>
              <button type="button" onClick={() => setSelectedVentaDetalle(null)} style={{ ...actionBtnStyle, padding: "8px 12px" }}>
                Cerrar
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><b>Fecha:</b> {formatDateTimePretty(selectedVentaDetalle.fecha_hora)}</div>
              <div><b>Paciente:</b> {selectedVentaDetalle.paciente_nombre}</div>
              <div><b>Subtotal:</b> ${Number(selectedVentaDetalle.subtotal ?? selectedVentaDetalle.monto_total ?? 0).toFixed(2)}</div>
              <div><b>Descuento:</b> {Number(selectedVentaDetalle.descuento_porcentaje || 0).toFixed(2)}%</div>
              {Number(selectedVentaDetalle.descuento_porcentaje || 0) > 0 && (
                <>
                  <div><b>Motivo del descuento:</b> {formatDescuentoMotivoLabel(selectedVentaDetalle.descuento_motivo)}</div>
                  <div><b>Tipo de cupón:</b> {formatCuponTipoLabel(selectedVentaDetalle.cupon_tipo)}</div>
                </>
              )}
              <div><b>Monto total:</b> ${Number(selectedVentaDetalle.monto_total || 0).toFixed(2)}</div>
              <div><b>Método de pago:</b> {formatMetodoPagoLabel(selectedVentaDetalle.metodo_pago)}</div>
              <div><b>Forma de liquidación:</b> {formatFormaLiquidacionLabel(selectedVentaDetalle.forma_liquidacion)}</div>
              <div><b>Cómo nos conoció:</b> {formatComoNosConocioLabel(selectedVentaDetalle.como_nos_conocio)}</div>
              <div style={{ gridColumn: "1 / -1" }}>
                <b>Compra:</b>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(selectedVentaDetalle.compra ?? "")
                    .split("|")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((item) => (
                      <span
                        key={`modal-venta-${selectedVentaDetalle.venta_id}-${item}`}
                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #d9c7b3", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}
                      >
                        {item}
                      </span>
                    ))}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <b>Adelanto:</b>{" "}
                {selectedVentaDetalle.adelanto_aplica
                  ? `$${Number(selectedVentaDetalle.adelanto_monto || 0).toFixed(2)} (${formatMetodoPagoLabel(selectedVentaDetalle.adelanto_metodo || "")})`
                  : "No"}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <b>Notas:</b>
                <div style={{ marginTop: 6, minHeight: 56, border: "1px solid #ddd", borderRadius: 10, background: "#fffdf9", padding: 10 }}>
                  {selectedVentaDetalle.notas?.trim() ? selectedVentaDetalle.notas : "Sin notas"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pacienteFiltroOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 998,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 820,
              maxWidth: "96vw",
              borderRadius: 14,
              border: "1px solid #ddd",
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 14 }}>Buscar paciente</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => setPacienteFiltroModo("hoy")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: pacienteFiltroModo === "hoy" ? "#111" : "#fff", color: pacienteFiltroModo === "hoy" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Hoy</button>
              <button type="button" onClick={() => setPacienteFiltroModo("rango")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: pacienteFiltroModo === "rango" ? "#111" : "#fff", color: pacienteFiltroModo === "rango" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Rango</button>
              <button type="button" onClick={() => setPacienteFiltroModo("mes")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: pacienteFiltroModo === "mes" ? "#111" : "#fff", color: pacienteFiltroModo === "mes" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Mes</button>
              <button type="button" onClick={() => setPacienteFiltroModo("anio")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: pacienteFiltroModo === "anio" ? "#111" : "#fff", color: pacienteFiltroModo === "anio" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Año</button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => aplicarFiltroRapidoPaciente("ayer")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Ayer</button>
              <button type="button" onClick={() => aplicarFiltroRapidoPaciente("ultimos7")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Últimos 7 días</button>
              <button type="button" onClick={() => aplicarFiltroRapidoPaciente("semana_pasada")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Semana pasada</button>
              <button type="button" onClick={() => aplicarFiltroRapidoPaciente("mes_pasado")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Mes pasado</button>
            </div>

            {pacienteFiltroModo === "rango" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <DateInputPro value={pacienteFechaDesde} onChange={setPacienteFechaDesde} />
                <DateInputPro value={pacienteFechaHasta} onChange={setPacienteFechaHasta} />
              </div>
            )}

            {(pacienteFiltroModo === "mes" || pacienteFiltroModo === "anio") && (
              <div style={{ display: "grid", gridTemplateColumns: pacienteFiltroModo === "mes" ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 14 }}>
                <input type="number" min={2020} max={2100} value={pacienteAnio} onChange={(e) => setPacienteAnio(e.target.value)} placeholder="Año" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                {pacienteFiltroModo === "mes" && (
                  <select value={pacienteMes} onChange={(e) => setPacienteMes(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                    <option value="">Seleccionar mes</option>
                    <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option><option value="4">Abril</option>
                    <option value="5">Mayo</option><option value="6">Junio</option><option value="7">Julio</option><option value="8">Agosto</option>
                    <option value="9">Septiembre</option><option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setPacienteFiltroModo("hoy");
                  setPacienteFechaDesde("");
                  setPacienteFechaHasta("");
                  setPacienteMes("");
                  setPacienteAnio(String(new Date().getFullYear()));
                  loadPacientes({ modo: "hoy" });
                  setPacienteFiltroOpen(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  loadPacientes();
                  setPacienteFiltroOpen(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}


      {consultaFiltroOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 820,
              maxWidth: "96vw",
              borderRadius: 14,
              border: "1px solid #ddd",
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 14 }}>Buscar consulta</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => setConsultaFiltroModo("hoy")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: consultaFiltroModo === "hoy" ? "#111" : "#fff", color: consultaFiltroModo === "hoy" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Hoy</button>
              <button type="button" onClick={() => setConsultaFiltroModo("rango")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: consultaFiltroModo === "rango" ? "#111" : "#fff", color: consultaFiltroModo === "rango" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Rango</button>
              <button type="button" onClick={() => setConsultaFiltroModo("mes")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: consultaFiltroModo === "mes" ? "#111" : "#fff", color: consultaFiltroModo === "mes" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Mes</button>
              <button type="button" onClick={() => setConsultaFiltroModo("anio")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: consultaFiltroModo === "anio" ? "#111" : "#fff", color: consultaFiltroModo === "anio" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Año</button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => aplicarFiltroRapido("ayer")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Ayer</button>
              <button type="button" onClick={() => aplicarFiltroRapido("ultimos7")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Últimos 7 días</button>
              <button type="button" onClick={() => aplicarFiltroRapido("semana_pasada")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Semana pasada</button>
              <button type="button" onClick={() => aplicarFiltroRapido("mes_pasado")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Mes pasado</button>
            </div>

            {consultaFiltroModo === "rango" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <DateInputPro value={consultaFechaDesde} onChange={setConsultaFechaDesde} />
                <DateInputPro value={consultaFechaHasta} onChange={setConsultaFechaHasta} />
              </div>
            )}

            {(consultaFiltroModo === "mes" || consultaFiltroModo === "anio") && (
              <div style={{ display: "grid", gridTemplateColumns: consultaFiltroModo === "mes" ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 14 }}>
                <input type="number" min={2020} max={2100} value={consultaAnio} onChange={(e) => setConsultaAnio(e.target.value)} placeholder="Año" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                {consultaFiltroModo === "mes" && (
                  <select value={consultaMes} onChange={(e) => setConsultaMes(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                    <option value="">Seleccionar mes</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                  </select>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setConsultaFiltroModo("hoy");
                  setConsultaFechaDesde("");
                  setConsultaFechaHasta("");
                  setConsultaMes("");
                  setConsultaAnio(String(new Date().getFullYear()));
                  loadConsultas();
                  setConsultaFiltroOpen(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  loadConsultas();
                  setConsultaFiltroOpen(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}

      {ventaFiltroOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 820,
              maxWidth: "96vw",
              borderRadius: 14,
              border: "1px solid #ddd",
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 14 }}>Buscar venta</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => setVentaFiltroModo("hoy")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: ventaFiltroModo === "hoy" ? "#111" : "#fff", color: ventaFiltroModo === "hoy" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Hoy</button>
              <button type="button" onClick={() => setVentaFiltroModo("rango")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: ventaFiltroModo === "rango" ? "#111" : "#fff", color: ventaFiltroModo === "rango" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Rango</button>
              <button type="button" onClick={() => setVentaFiltroModo("mes")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: ventaFiltroModo === "mes" ? "#111" : "#fff", color: ventaFiltroModo === "mes" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Mes</button>
              <button type="button" onClick={() => setVentaFiltroModo("anio")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: ventaFiltroModo === "anio" ? "#111" : "#fff", color: ventaFiltroModo === "anio" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Año</button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" onClick={() => aplicarFiltroRapidoVenta("ayer")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Ayer</button>
              <button type="button" onClick={() => aplicarFiltroRapidoVenta("ultimos7")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Últimos 7 días</button>
              <button type="button" onClick={() => aplicarFiltroRapidoVenta("semana_pasada")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Semana pasada</button>
              <button type="button" onClick={() => aplicarFiltroRapidoVenta("mes_pasado")} style={{ padding: "7px 11px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Mes pasado</button>
            </div>

            {ventaFiltroModo === "rango" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <DateInputPro value={ventaFechaDesde} onChange={setVentaFechaDesde} />
                <DateInputPro value={ventaFechaHasta} onChange={setVentaFechaHasta} />
              </div>
            )}

            {(ventaFiltroModo === "mes" || ventaFiltroModo === "anio") && (
              <div style={{ display: "grid", gridTemplateColumns: ventaFiltroModo === "mes" ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 14 }}>
                <input type="number" min={2020} max={2100} value={ventaAnio} onChange={(e) => setVentaAnio(e.target.value)} placeholder="Año" style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                {ventaFiltroModo === "mes" && (
                  <select value={ventaMes} onChange={(e) => setVentaMes(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                    <option value="">Seleccionar mes</option>
                    <option value="1">Enero</option><option value="2">Febrero</option><option value="3">Marzo</option><option value="4">Abril</option>
                    <option value="5">Mayo</option><option value="6">Junio</option><option value="7">Julio</option><option value="8">Agosto</option>
                    <option value="9">Septiembre</option><option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setVentaFiltroModo("hoy");
                  setVentaFechaDesde("");
                  setVentaFechaHasta("");
                  setVentaMes("");
                  setVentaAnio(String(new Date().getFullYear()));
                  loadVentas({ modo: "hoy" });
                  setVentaFiltroOpen(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => {
                  loadVentas();
                  setVentaFiltroOpen(false);
                }}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}


      {deleteConfirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: "94vw",
              background: "#fffdf9",
              border: "1px solid #e2cfba",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 16px 40px rgba(68, 49, 33, 0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#5f4a32", marginBottom: 8 }}>
              Confirmar eliminación
            </div>
            <div style={{ color: "#5f4a32", marginBottom: 14 }}>
              {deleteConfirmType === "paciente"
                ? `¿Seguro que quieres eliminar el paciente #${deleteConfirmId}?`
                : deleteConfirmType === "consulta"
                ? `¿Seguro que quieres eliminar la consulta #${deleteConfirmId}?`
                : `¿Seguro que quieres eliminar la venta #${deleteConfirmId}?`}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmType(null);
                  setDeleteConfirmId(null);
                }}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d7c4b0", background: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteConfirmBusy}
                onClick={confirmDeleteAction}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #8c2d2d", background: "#8c2d2d", color: "#fff", fontWeight: 700, cursor: deleteConfirmBusy ? "not-allowed" : "pointer" }}
              >
                {deleteConfirmBusy ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= MODAL HISTORIA CLINICA ================= */}
      {historiaPacienteId && createPortal((
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(33, 24, 16, 0.56)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, #fffdf9 0%, #fff7ed 100%)",
              borderRadius: 0,
              border: "none",
              width: "100%",
              height: "100%",
              maxWidth: "100%",
              maxHeight: "100%",
              overflow: "hidden",
              boxShadow: "0 30px 70px rgba(35, 24, 15, 0.38)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
          >
            <div
              className="historia-modal-header"
              style={{
                padding: "10px 12px",
                background: "linear-gradient(180deg, #fffdf9 0%, #fff7ed 100%)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                borderBottom: "1px solid #ead9c8",
                position: "relative",
                zIndex: 20,
              }}
            >
              <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 23, lineHeight: 1.05, color: "#3f2d1d", letterSpacing: 0.2 }}>
                  Historia clínica paciente {historiaPacienteNombreCompleto || `#${historiaPacienteId}`}
                </h2>
                <div style={{ marginTop: 2, fontSize: 11, color: "#6b4f37", fontWeight: 700 }}>
                  Registro clínico integral
                </div>
              </div>
              <div className="historia-header-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", flex: "0 1 auto", maxWidth: "100%" }}>
                {canEditPaciente && historiaPacienteInfo && historiaData && (
                  <button
                    type="button"
                    onClick={() => {
                      startEditPaciente(historiaPacienteInfo);
                      closeHistoriaModal();
                    }}
                    style={{ ...actionBtnStyle, padding: "7px 10px" }}
                  >
                    Editar paciente
                  </button>
                )}
                {historiaData && (
                  <button
                    type="button"
                    onClick={requestSubmitHistoriaForm}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 10,
                      border: "1px solid #5f4a32",
                      background: "#5f4a32",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Guardar
                  </button>
                )}
                {isAdmin && historiaData && (
                  <button
                    type="button"
                    onClick={deleteHistoriaClinica}
                    disabled={deletingHistoria}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 10,
                      border: "1px solid #a93226",
                      background: deletingHistoria ? "#f4d7d3" : "#c0392b",
                      color: deletingHistoria ? "#6d1f17" : "#fff",
                      fontWeight: 800,
                      cursor: deletingHistoria ? "not-allowed" : "pointer",
                    }}
                  >
                    {deletingHistoria ? "Eliminando..." : "Borrar historia"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeHistoriaModal}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 10,
                    border: "1px solid #d8c5b0",
                    background: "#fff",
                    color: "#5f4a32",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={closeHistoriaModal}
                  aria-label="Cerrar historia clínica"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    border: "1px solid #d8c5b0",
                    background: "#fff",
                    color: "#5f4a32",
                    fontWeight: 900,
                    cursor: "pointer",
                    lineHeight: 1,
                    fontSize: 16,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <style>{`
              .historia-layout { position: relative; min-height: 0; height: 100%; width: min(100%, 1680px); margin: 0 auto; padding: 8px 8px 10px; font-size: 12px; box-sizing: border-box; }
              .historia-modal-header {
                box-shadow: 0 4px 14px rgba(63, 45, 29, .08);
              }
              .historia-header-actions {
                visibility: visible !important;
                opacity: 1 !important;
              }
              .historia-main-scroll { min-height: 0; height: 100%; overflow-y: auto; overflow-x: auto; padding: 0 32px calc(84px + env(safe-area-inset-bottom, 0px)) 196px; scroll-behavior: smooth; scrollbar-gutter: stable both-edges; }
              .historia-main-scroll,
              .historia-main-scroll * { box-sizing: border-box; min-width: 0; }
              .historia-main-scroll section[data-hist-section] { scroll-margin-top: 16px; }
              .historia-main-scroll h3 { font-size: 18px; }
              .historia-main-scroll label > span { font-size: 11px; }
              .historia-main-scroll input,
              .historia-main-scroll select,
              .historia-main-scroll textarea,
              .historia-main-scroll button { font-size: 11px; }
              .historia-main-scroll input:not([type="checkbox"]),
              .historia-main-scroll textarea {
                border-radius: 0 !important;
              }
              .historia-section-nav {
                position: absolute;
                z-index: 4;
                top: 8px;
                bottom: 18px;
                left: 8px;
                width: 172px;
                padding: 12px;
                overflow-y: auto;
                border: 1px solid #dfd1c1;
                border-radius: 12px;
                background: rgba(255, 253, 249, .97);
                box-shadow: 0 10px 24px rgba(63, 45, 29, .1);
                backdrop-filter: blur(8px);
              }
              .historia-section-nav-title {
                margin: 0 0 10px;
                color: #5f4a32;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: .06em;
                text-transform: uppercase;
              }
              .historia-section-nav button {
                display: flex;
                align-items: center;
                width: 100%;
                min-height: 36px;
                margin-bottom: 6px;
                padding: 8px 10px;
                border: 1px solid transparent;
                border-radius: 7px;
                background: transparent;
                color: #52606d;
                font-weight: 750;
                text-align: left;
                cursor: pointer;
                transition: background .15s ease, color .15s ease, border-color .15s ease, transform .15s ease;
              }
              .historia-section-nav button:hover {
                border-color: #b9d7f5;
                background: #eaf4ff;
                color: #0759bd;
                transform: translateX(2px);
              }
              .historia-header-actions button {
                min-height: 36px;
                padding-left: 14px !important;
                padding-right: 14px !important;
                border-radius: 12px !important;
                box-shadow: 0 5px 14px rgba(63, 45, 29, .12);
                transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
              }
              .historia-header-actions button:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 8px 18px rgba(63, 45, 29, .18);
                filter: saturate(1.08);
              }
              .historia-header-actions button:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 0 3px 8px rgba(63, 45, 29, .14);
              }
              .historia-main-scroll input[type="checkbox"] {
                position: absolute;
                width: 1px;
                height: 1px;
                margin: -1px;
                padding: 0;
                overflow: hidden;
                clip: rect(0 0 0 0);
                white-space: nowrap;
                border: 0;
              }
              .historia-main-scroll label:has(input[type="checkbox"]) {
                min-height: 34px;
                padding: 8px 16px;
                border: 1px solid transparent;
                border-radius: 999px;
                background: #eceeef;
                color: #4b5563;
                cursor: pointer;
                justify-content: center;
                text-align: center;
                user-select: none;
                box-shadow: none;
                transition: background .15s ease, color .15s ease, box-shadow .15s ease, transform .15s ease;
              }
              .historia-main-scroll label:has(input[type="checkbox"]):hover {
                border-color: transparent;
                background: #dfe4ea;
                color: #334155;
                box-shadow: 0 3px 8px rgba(15, 23, 42, .09);
                transform: translateY(-1px);
              }
              .historia-main-scroll label:has(input[type="checkbox"]:checked) {
                border-color: transparent;
                background: #0866d9;
                color: #fff;
                font-weight: 800;
                box-shadow: 0 4px 10px rgba(8, 102, 217, .24);
              }
              .historia-main-scroll label:has(input[type="checkbox"]:checked):hover {
                border-color: transparent;
                background: #0759bd;
                color: #fff;
                box-shadow: 0 6px 14px rgba(8, 102, 217, .3);
              }
              .historia-main-scroll label:has(input[type="checkbox"]:focus-visible) {
                outline: 3px solid rgba(8, 102, 217, .3);
                outline-offset: 2px;
              }
              .historia-paciente-grid { display: grid; gap: 10px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
              @media (max-width: 1700px) {
                .historia-paciente-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
              }
              @media (max-width: 1200px) {
                .historia-paciente-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              }
              @media (max-width: 860px) {
                .historia-paciente-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .historia-section-nav { display: none; }
                .historia-main-scroll { padding-left: 12px; }
                .historia-modal-header { align-items: flex-start !important; }
                .historia-header-actions {
                  width: 100%;
                  justify-content: flex-start !important;
                }
              }
              @media (max-width: 560px) {
                .historia-paciente-grid { grid-template-columns: 1fr; }
              }
            `}</style>
            <div className="historia-layout" style={HISTORIA_LAYOUT_SCALE_STYLE}>
              <nav className="historia-section-nav" aria-label="Secciones de historia clínica">
                <div className="historia-section-nav-title">Ir a sección</div>
                {[
                  ["paciente", "Paciente"],
                  ["antecedentes", "Antecedentes"],
                  ["habitos", "Hábitos y riesgos"],
                  ["refraccion", "Refracción"],
                  ["mediciones", "Mediciones"],
                  ["optometria", "Optometría"],
                  ["hallazgos", "AV y hallazgos"],
                  ["seguimiento", "Seguimiento"],
                ].map(([sectionId, label]) => (
                  <button
                    key={`historia-nav-${sectionId}`}
                    type="button"
                    onClick={() => {
                      const target = document.querySelector<HTMLElement>(`[data-hist-section="${sectionId}"]`);
                      const scrollPanel = target?.closest<HTMLElement>(".historia-main-scroll");
                      if (!target || !scrollPanel) return;
                      const targetTop =
                        scrollPanel.scrollTop +
                        target.getBoundingClientRect().top -
                        scrollPanel.getBoundingClientRect().top;
                      scrollPanel.scrollTo({ top: Math.max(0, targetTop - 12), behavior: "smooth" });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <div className="historia-main-scroll">
            <div
              style={{
                marginBottom: 12,
                fontSize: 13,
                color: "#5f4a32",
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <span><strong>Creada:</strong> {formatDateTimeHistoria(historiaData?.created_at)}</span>
              <span><strong>Actualizada:</strong> {formatDateTimeHistoria(historiaData?.updated_at ?? historiaData?.created_at)}</span>
            </div>
            {error && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid #c0392b", background: "#fdecea", color: "#7b241c", fontWeight: 700 }}>
                {error}
              </div>
            )}
            {historiaMissingSummary && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid #b9770e", background: "#fef9e7", color: "#7d6608", fontWeight: 700 }}>
                {historiaMissingSummary}
              </div>
            )}
            {historiaPacienteInfo && (
              <section data-hist-section="paciente">
                <div
                  style={{
                    marginBottom: 14,
                    background: "#fff",
                    border: "1px solid #ead9c8",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#5f4a32" }}>Información del paciente</div>
                  </div>
                  <div className="historia-paciente-grid">
                    <div><strong>ID:</strong> {historiaPacienteInfo.paciente_id}</div>
                    <div><strong>Nombre:</strong> {[historiaPacienteInfo.primer_nombre, historiaPacienteInfo.segundo_nombre, historiaPacienteInfo.apellido_paterno, historiaPacienteInfo.apellido_materno].filter(Boolean).join(" ")}</div>
                    <div><strong>Fecha de nacimiento:</strong> {historiaPacienteInfo.fecha_nacimiento || ""}</div>
                    <div><strong>Edad:</strong> {calcAge(historiaPacienteInfo.fecha_nacimiento)}</div>
                    <div><strong>Teléfono:</strong> {historiaPacienteInfo.telefono || ""}</div>
                    <div><strong>Correo:</strong> {historiaPacienteInfo.correo || ""}</div>
                    <div style={{ gridColumn: "1 / -1", overflowWrap: "anywhere" }}>
                      <strong>Direccion:</strong>{" "}
                      {pickMostCompleteAddress(
                        formatDireccionPaciente(historiaPacienteInfo),
                        formatDireccionHistoriaSnapshot(historiaData)
                      ) || "Sin dirección registrada"}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f0e1cf" }}>
                    <div style={{ fontWeight: 700, color: "#5f4a32", marginBottom: 8 }}>Doctor que atiende</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span>Doctor primer nombre</span>
                        <input
                          style={historiaInputStyle}
                          value={historiaData?.doctor_primer_nombre ?? ""}
                          onChange={(e) => {
                            const current = historiaData ?? {};
                            const primerNombre = e.target.value;
                            const apellidoPaterno = current.doctor_apellido_paterno ?? "";
                            setHistoriaData({
                              ...current,
                              doctor_primer_nombre: primerNombre,
                              doctor_atencion: composeDoctorAtencion(primerNombre, apellidoPaterno),
                            });
                          }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span>Doctor primer apellido</span>
                        <input
                          style={historiaInputStyle}
                          value={historiaData?.doctor_apellido_paterno ?? ""}
                          onChange={(e) => {
                            const current = historiaData ?? {};
                            const apellidoPaterno = e.target.value;
                            const primerNombre = current.doctor_primer_nombre ?? "";
                            setHistoriaData({
                              ...current,
                              doctor_apellido_paterno: apellidoPaterno,
                              doctor_atencion: composeDoctorAtencion(primerNombre, apellidoPaterno),
                            });
                          }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 10 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontWeight: 700 }}>Diagnóstico principal</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {DIAGNOSTICO_PRINCIPAL_OPTIONS.map((opt) => (
                            <label key={`diag-principal-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={diagnosticoPrincipalSeleccionados.includes(opt.value)}
                                onChange={(e) => {
                                  const current = historiaData ?? {};
                                  const next = togglePipeValue(current.diagnostico_principal, opt.value, e.target.checked);
                                  const removeOtro = opt.value === "otro" && !e.target.checked;
                                  setHistoriaData({
                                    ...current,
                                    diagnostico_principal: next,
                                    diagnostico_principal_otro: removeOtro ? "" : (current.diagnostico_principal_otro ?? ""),
                                  });
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                        {diagnosticoPrincipalSeleccionados.includes("otro") && (
                          <input
                            style={historiaItemInputStyle}
                            placeholder="Otro diagnóstico principal"
                            value={historiaData?.diagnostico_principal_otro ?? ""}
                            onChange={(e) => setHistoriaData({ ...(historiaData ?? {}), diagnostico_principal_otro: e.target.value })}
                          />
                        )}
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontWeight: 700 }}>Diagnósticos secundarios</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {DIAGNOSTICO_SECUNDARIO_OPTIONS.map((opt) => (
                            <label key={`diag-sec-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={diagnosticoSecundarioSeleccionados.includes(opt.value)}
                                onChange={(e) => {
                                  const current = historiaData ?? {};
                                  const next = togglePipeValue(current.diagnosticos_secundarios, opt.value, e.target.checked);
                                  const removeOtro = opt.value === "otro_secundario" && !e.target.checked;
                                  setHistoriaData({
                                    ...current,
                                    diagnosticos_secundarios: next,
                                    diagnosticos_secundarios_otro: removeOtro ? "" : (current.diagnosticos_secundarios_otro ?? ""),
                                  });
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                        {diagnosticoSecundarioSeleccionados.includes("otro_secundario") && (
                          <input
                            style={historiaItemInputStyle}
                            placeholder="Otro diagnóstico secundario"
                            value={historiaData?.diagnosticos_secundarios_otro ?? ""}
                            onChange={(e) => setHistoriaData({ ...(historiaData ?? {}), diagnosticos_secundarios_otro: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                    <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      <span>Recomendación de tratamiento</span>
                      <textarea
                        style={{ ...historiaInputStyle, minHeight: 72, resize: "vertical" }}
                        value={historiaData?.recomendacion_tratamiento ?? ""}
                        onChange={(e) => {
                          setHistoriaData({
                            ...(historiaData ?? {}),
                            recomendacion_tratamiento: e.target.value,
                          });
                        }}
                      />
                    </label>
                  </div>
                </div>
              </section>
            )}
        

            {loadingHistoria ? (
              <div>Cargando...</div>
            ) : historiaData ? (

              <form
                id="historia-clinica-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await saveHistoriaClinica();
                }}
                style={{ display: "grid", gap: 10, paddingBottom: 48 }}
              >
                <section data-hist-section="refraccion" style={{ display: "grid", gap: 12, order: 4 }}>
                  {/* Refracción */}
                  <h3 style={{ margin: 0, color: "#5f4a32" }}>Refracción</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                    <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 14, borderRadius: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>Ojo derecho (OD)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}><span>Esfera</span><input type="text" style={historiaInputStyle} value={historiaData.od_esfera ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_esfera: e.target.value || null})}/></label>
                        <label style={{ display: "grid", gap: 4 }}><span>Cilindro</span><input type="text" style={historiaInputStyle} value={historiaData.od_cilindro ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_cilindro: e.target.value || null})}/></label>
                        <label style={{ display: "grid", gap: 4 }}><span>Eje</span><input type="text" style={historiaInputStyle} value={historiaData.od_eje ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_eje: e.target.value || null})}/></label>
                        <label style={{ display: "grid", gap: 4 }}><span>Add</span><input type="text" style={historiaInputStyle} value={historiaData.od_add ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_add: e.target.value || null})}/></label>
                      </div>
                    </div>

                    <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 14, borderRadius: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>Ojo izquierdo (OI)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}><span>Esfera</span><input type="text" style={historiaInputStyle} value={historiaData.oi_esfera ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_esfera: e.target.value || null})}/></label>
                        <label style={{ display: "grid", gap: 4 }}><span>Cilindro</span><input type="text" style={historiaInputStyle} value={historiaData.oi_cilindro ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_cilindro: e.target.value || null})}/></label>
                        <label style={{ display: "grid", gap: 4 }}><span>Eje</span><input type="text" style={historiaInputStyle} value={historiaData.oi_eje ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_eje: e.target.value || null})}/></label>
                        <label style={{ display: "grid", gap: 4 }}><span>Add</span><input type="text" style={historiaInputStyle} value={historiaData.oi_add ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_add: e.target.value || null})}/></label>
                      </div>
                    </div>
                  </div>
                </section>

                <section data-hist-section="mediciones" style={{ display: "grid", gap: 12, order: 5 }}>
                  {/* Mediciones */}
                  <h3 style={{ margin: 0, color: "#5f4a32" }}>Mediciones</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                    <label style={{ display: "grid", gap: 4 }}><span>DP</span><input type="text" style={historiaInputStyle} value={historiaData.dp ?? ""} onChange={(e)=>setHistoriaData({...historiaData, dp: e.target.value || null})}/></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Queratometría OD</span><input type="text" style={historiaInputStyle} value={historiaData.queratometria_od ?? ""} onChange={(e)=>setHistoriaData({...historiaData, queratometria_od: e.target.value || null})}/></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Queratometría OI</span><input type="text" style={historiaInputStyle} value={historiaData.queratometria_oi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, queratometria_oi: e.target.value || null})}/></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Presión OD</span><input type="text" style={historiaInputStyle} value={historiaData.presion_od ?? ""} onChange={(e)=>setHistoriaData({...historiaData, presion_od: e.target.value || null})}/></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Presión OI</span><input type="text" style={historiaInputStyle} value={historiaData.presion_oi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, presion_oi: e.target.value || null})}/></label>
                  </div>
                </section>

                <section data-hist-section="antecedentes" style={{ display: "grid", gap: 12, order: 2 }}>
                  {/* Antecedentes */}
                  <div style={{ background: "linear-gradient(180deg, #fffdf9 0%, #fff8ef 100%)", border: "1px solid #dfc8ae", padding: 14, borderRadius: 14, display: "grid", gap: 12 }}>
                    <div style={{ fontWeight: 800, color: "#5f4a32", fontSize: 16 }}>Lentes actuales</div>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span>¿Usa lentes actualmente?</span>
                      <select
                        style={historiaInputStyle}
                        value={String(historiaData.usa_lentes ?? "")}
                        onChange={(e) => {
                          const usa = parseBoolSelect(e.target.value);
                          setHistoriaData({
                            ...historiaData,
                            usa_lentes: usa,
                            ...(usa === true ? {} : {
                              tipo_lentes_actual: "",
                              tiempo_uso_lentes: "",
                              tiempo_uso_lentes_anios: "",
                              lentes_contacto_horas_dia: null,
                              lentes_contacto_dias_semana: null,
                              uso_lentes_proteccion_uv: "",
                              lentes_pares: [],
                            }),
                          });
                        }}
                      >
                        <option value="">Seleccionar</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </label>

                    {historiaData.usa_lentes === true && (
                      <>
                        <label style={{ display: "grid", gap: 4, maxWidth: 320 }}>
                          <span>¿Cuántos pares de lentes tiene actualmente?</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            style={historiaInputStyle}
                            value={Math.max(1, parseLentesActualesDetalle(historiaData.lentes_pares).length)}
                            onChange={(e) => {
                              const count = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                              const current = parseLentesActualesDetalle(historiaData.lentes_pares);
                              const next = Array.from({ length: count }, (_, idx) => current[idx] ?? { tipo: "", tratamientos: [], color_tinte: "", grado_tinte: "" });
                              setHistoriaData({ ...historiaData, lentes_pares: next });
                            }}
                          />
                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                          {(parseLentesActualesDetalle(historiaData.lentes_pares).length
                            ? parseLentesActualesDetalle(historiaData.lentes_pares)
                            : [{ tipo: "", tratamientos: [], color_tinte: "", grado_tinte: "" }]
                          ).map((par, idx, pares) => (
                            <div key={`lentes-par-${idx}`} style={{ border: "1px solid #ead9c8", background: "#fff", borderRadius: 12, padding: 12 }}>
                              <div style={{ fontWeight: 800, color: "#5f4a32", marginBottom: 8 }}>Par de lentes #{idx + 1}</div>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span>Tipo</span>
                                <select
                                  style={historiaInputStyle}
                                  value={par.tipo}
                                  onChange={(e) => {
                                    const next = pares.map((item, itemIdx) => itemIdx === idx ? { ...item, tipo: e.target.value } : item);
                                    setHistoriaData({ ...historiaData, lentes_pares: next });
                                  }}
                                >
                                  <option value="">Seleccionar</option>
                                  <option value="opticos">Lentes ópticos</option>
                                  <option value="contacto">Contacto</option>
                                  <option value="sol">Lentes de sol</option>
                                </select>
                              </label>
                              <div style={{ fontWeight: 700, margin: "10px 0 6px" }}>Tratamientos de este par</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                {TRATAMIENTOS_LENTES_MANEJAR_OPTIONS.map((opt) => (
                                  <label key={`par-${idx}-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input
                                      type="checkbox"
                                      checked={par.tratamientos.includes(opt.value)}
                                      onChange={(e) => {
                                        const tratamientos = e.target.checked
                                          ? Array.from(new Set([...par.tratamientos, opt.value]))
                                          : par.tratamientos.filter((value) => value !== opt.value);
                                        const next = pares.map((item, itemIdx) => itemIdx === idx
                                          ? {
                                              ...item,
                                              tratamientos,
                                              ...(opt.value === "tintados" && !e.target.checked ? { color_tinte: "", grado_tinte: "" } : {}),
                                            }
                                          : item);
                                        setHistoriaData({ ...historiaData, lentes_pares: next });
                                      }}
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                              {par.tratamientos.includes("tintados") && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                                  <label style={{ display: "grid", gap: 4 }}>
                                    <span>Color del tinte</span>
                                    <input
                                      style={historiaInputStyle}
                                      placeholder="Ej. gris, café, verde"
                                      value={par.color_tinte}
                                      onChange={(e) => {
                                        const next = pares.map((item, itemIdx) => itemIdx === idx ? { ...item, color_tinte: e.target.value } : item);
                                        setHistoriaData({ ...historiaData, lentes_pares: next });
                                      }}
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4 }}>
                                    <span>Grado de tinte</span>
                                    <input
                                      style={historiaInputStyle}
                                      placeholder="Ej. 25%, 50% u oscuro"
                                      value={par.grado_tinte}
                                      onChange={(e) => {
                                        const next = pares.map((item, itemIdx) => itemIdx === idx ? { ...item, grado_tinte: e.target.value } : item);
                                        setHistoriaData({ ...historiaData, lentes_pares: next });
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#5f4a32" }}>Puestos laborales</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                        value={historiaData.puesto_laboral_cantidad ?? ""}
                        onChange={(e) => {
                          const nextCount = clampHistoriaCantidad(e.target.value);
                          const nextItems = resizeHistoriaItems(
                            splitHistoriaItems(historiaData.puesto_laboral),
                            nextCount ?? 0
                          );
                          setHistoriaData({
                            ...historiaData,
                            puesto_laboral_cantidad: nextCount,
                            puesto_laboral: joinHistoriaItems(nextItems),
                          });
                        }}
                      />
                    </div>
                    <div style={historiaItemsGridStyle}>
                      {(resizeHistoriaItems(
                        splitHistoriaItems(historiaData.puesto_laboral),
                        clampHistoriaCantidad(historiaData.puesto_laboral_cantidad) ?? 0
                      )).map((item, idx) => (
                        <input
                          key={`puesto-item-${idx + 1}`}
                          style={historiaItemInputStyle}
                          placeholder={`Puesto laboral ${idx + 1}`}
                          value={item}
                          onChange={(e) => {
                            const count = clampHistoriaCantidad(historiaData.puesto_laboral_cantidad) ?? 0;
                            const nextItems = resizeHistoriaItems(
                              splitHistoriaItems(historiaData.puesto_laboral),
                              count
                            );
                            nextItems[idx] = e.target.value;
                            setHistoriaData({
                              ...historiaData,
                              puesto_laboral: joinHistoriaItems(nextItems),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </label>

                  <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12, display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Antecedentes generales</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>
                      {ANTECEDENTE_OPTIONS.map((opt) => {
                        return (
                          <label key={`ag-${opt}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={antecedentesGeneralesSeleccionados.includes(opt)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...antecedentesGeneralesSeleccionados, opt]
                                  : antecedentesGeneralesSeleccionados.filter((x) => x !== opt);
                                const removeOtroGeneral = opt === "otro" && !e.target.checked;
                                const generalOtro = removeOtroGeneral ? "" : (historiaData.antecedentes_otro_general ?? "");
                                const generalOtroCantidad = removeOtroGeneral
                                  ? null
                                  : clampHistoriaCantidad(historiaData.antecedentes_otro_general_cantidad);
                                const generalOtroPayload = composeCantidadYTexto(generalOtroCantidad, generalOtro);
                                setHistoriaData({
                                  ...historiaData,
                                  antecedentes_generales: next.join("|"),
                                  antecedentes_familiares: "",
                                  antecedentes_otro_general: generalOtro,
                                  antecedentes_otro_general_cantidad: generalOtroCantidad,
                                  antecedentes_otro_familiar: "",
                                  antecedentes_otro: composeAntecedentesOtro(generalOtroPayload, ""),
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {antecedentesGeneralesSeleccionados.includes("otro") && (
                      <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
                        <span>Otro (generales)</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                          <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                          <input
                            type="number"
                            min={0}
                            max={15}
                            style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                            value={historiaData.antecedentes_otro_general_cantidad ?? ""}
                            onChange={(e) => {
                              const nextCount = clampHistoriaCantidad(e.target.value);
                              const nextItems = resizeHistoriaItems(
                                splitHistoriaItems(historiaData.antecedentes_otro_general),
                                nextCount ?? 0
                              );
                              const general = joinHistoriaItems(nextItems);
                              const generalPayload = composeCantidadYTexto(nextCount, general);
                              setHistoriaData({
                                ...historiaData,
                                antecedentes_otro_general_cantidad: nextCount,
                                antecedentes_otro_general: general,
                                antecedentes_otro_familiar: "",
                                antecedentes_otro: composeAntecedentesOtro(generalPayload, ""),
                              });
                            }}
                          />
                        </div>
                        <div style={historiaItemsGridStyle}>
                          {(resizeHistoriaItems(
                            splitHistoriaItems(historiaData.antecedentes_otro_general),
                            clampHistoriaCantidad(historiaData.antecedentes_otro_general_cantidad) ?? 0
                          )).map((item, idx) => (
                            <input
                              key={`antecedente-otro-item-${idx + 1}`}
                              style={historiaItemInputStyle}
                              placeholder={`Antecedente otro ${idx + 1}`}
                              value={item}
                              onChange={(e) => {
                                const count = clampHistoriaCantidad(historiaData.antecedentes_otro_general_cantidad) ?? 0;
                                const nextItems = resizeHistoriaItems(
                                  splitHistoriaItems(historiaData.antecedentes_otro_general),
                                  count
                                );
                                nextItems[idx] = e.target.value;
                                const general = joinHistoriaItems(nextItems);
                                const generalPayload = composeCantidadYTexto(count, general);
                                setHistoriaData({
                                  ...historiaData,
                                  antecedentes_otro_general: general,
                                  antecedentes_otro_familiar: "",
                                  antecedentes_otro: composeAntecedentesOtro(generalPayload, ""),
                                });
                              }}
                            />
                          ))}
                        </div>
                      </label>
                    )}
                  </div>
                  <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Antecedentes oculares familiares</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>
                      {ANTECEDENTE_OPTIONS.map((opt) => (
                        <label key={`aof-${opt}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={antecedentesOcularesFamiliaresSeleccionados.includes(opt)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...antecedentesOcularesFamiliaresSeleccionados, opt]
                                : antecedentesOcularesFamiliaresSeleccionados.filter((x) => x !== opt);
                              const removeOtro = opt === "otro" && !e.target.checked;
                              setHistoriaData({
                                ...historiaData,
                                antecedentes_oculares_familiares: joinPipeList(next),
                                antecedentes_oculares_familiares_otro: removeOtro
                                  ? ""
                                  : (historiaData.antecedentes_oculares_familiares_otro ?? ""),
                                antecedentes_oculares_familiares_otro_cantidad: removeOtro
                                  ? null
                                  : clampHistoriaCantidad(historiaData.antecedentes_oculares_familiares_otro_cantidad),
                              });
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                    {antecedentesOcularesFamiliaresSeleccionados.includes("otro") && (
                      <label style={{ display: "grid", gap: 6, marginTop: 8 }}>
                        <span>Otro (oculares familiares)</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                          <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                          <input
                            type="number"
                            min={0}
                            max={15}
                            style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                            value={historiaData.antecedentes_oculares_familiares_otro_cantidad ?? ""}
                            onChange={(e) => {
                              const nextCount = clampHistoriaCantidad(e.target.value);
                              const nextItems = resizeHistoriaItems(
                                splitHistoriaItems(historiaData.antecedentes_oculares_familiares_otro),
                                nextCount ?? 0
                              );
                              setHistoriaData({
                                ...historiaData,
                                antecedentes_oculares_familiares_otro_cantidad: nextCount,
                                antecedentes_oculares_familiares_otro: joinHistoriaItems(nextItems),
                              });
                            }}
                          />
                        </div>
                        <div style={historiaItemsGridStyle}>
                          {(resizeHistoriaItems(
                            splitHistoriaItems(historiaData.antecedentes_oculares_familiares_otro),
                            clampHistoriaCantidad(historiaData.antecedentes_oculares_familiares_otro_cantidad) ?? 0
                          )).map((item, idx) => (
                            <input
                              key={`aof-otro-item-${idx + 1}`}
                              style={historiaItemInputStyle}
                              placeholder={`Antecedente ocular familiar ${idx + 1}`}
                              value={item}
                              onChange={(e) => {
                                const count = clampHistoriaCantidad(historiaData.antecedentes_oculares_familiares_otro_cantidad) ?? 0;
                                const nextItems = resizeHistoriaItems(
                                  splitHistoriaItems(historiaData.antecedentes_oculares_familiares_otro),
                                  count
                                );
                                nextItems[idx] = e.target.value;
                                setHistoriaData({
                                  ...historiaData,
                                  antecedentes_oculares_familiares_otro: joinHistoriaItems(nextItems),
                                });
                              }}
                            />
                          ))}
                        </div>
                      </label>
                    )}
                  </div>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Alergias</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                        value={historiaData.alergias_cantidad ?? ""}
                        onChange={(e) => {
                          const nextCount = clampHistoriaCantidad(e.target.value);
                          const nextItems = resizeHistoriaItems(splitHistoriaItems(historiaData.alergias), nextCount ?? 0);
                          setHistoriaData({
                            ...historiaData,
                            alergias_cantidad: nextCount,
                            alergias: joinHistoriaItems(nextItems),
                          });
                        }}
                      />
                    </div>
                    <div style={historiaItemsGridStyle}>
                      {(resizeHistoriaItems(
                        splitHistoriaItems(historiaData.alergias),
                        clampHistoriaCantidad(historiaData.alergias_cantidad) ?? 0
                      )).map((item, idx) => (
                        <input
                          key={`alergia-item-${idx + 1}`}
                          style={historiaItemInputStyle}
                          placeholder={`Alergia ${idx + 1}`}
                          value={item}
                          onChange={(e) => {
                            const count = clampHistoriaCantidad(historiaData.alergias_cantidad) ?? 0;
                            const nextItems = resizeHistoriaItems(splitHistoriaItems(historiaData.alergias), count);
                            nextItems[idx] = e.target.value;
                            setHistoriaData({
                              ...historiaData,
                              alergias: joinHistoriaItems(nextItems),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Enfermedades</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                        value={historiaData.enfermedades_cantidad ?? ""}
                        onChange={(e) => {
                          const nextCount = clampHistoriaCantidad(e.target.value);
                          const nextItems = resizeHistoriaItems(splitHistoriaItems(historiaData.enfermedades), nextCount ?? 0);
                          setHistoriaData({
                            ...historiaData,
                            enfermedades_cantidad: nextCount,
                            enfermedades: joinHistoriaItems(nextItems),
                          });
                        }}
                      />
                    </div>
                    <div style={historiaItemsGridStyle}>
                      {(resizeHistoriaItems(
                        splitHistoriaItems(historiaData.enfermedades),
                        clampHistoriaCantidad(historiaData.enfermedades_cantidad) ?? 0
                      )).map((item, idx) => (
                        <input
                          key={`enfermedad-item-${idx + 1}`}
                          style={historiaItemInputStyle}
                          placeholder={`Enfermedad ${idx + 1}`}
                          value={item}
                          onChange={(e) => {
                            const count = clampHistoriaCantidad(historiaData.enfermedades_cantidad) ?? 0;
                            const nextItems = resizeHistoriaItems(splitHistoriaItems(historiaData.enfermedades), count);
                            nextItems[idx] = e.target.value;
                            setHistoriaData({
                              ...historiaData,
                              enfermedades: joinHistoriaItems(nextItems),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Cirugías</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                      <input
                        type="number"
                        min={0}
                        max={15}
                        style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                        value={historiaData.cirugias_cantidad ?? ""}
                        onChange={(e) => {
                          const nextCount = clampHistoriaCantidad(e.target.value);
                          const nextItems = resizeHistoriaItems(splitHistoriaItems(historiaData.cirugias), nextCount ?? 0);
                          setHistoriaData({
                            ...historiaData,
                            cirugias_cantidad: nextCount,
                            cirugias: joinHistoriaItems(nextItems),
                          });
                        }}
                      />
                    </div>
                    <div style={historiaItemsGridStyle}>
                      {(resizeHistoriaItems(
                        splitHistoriaItems(historiaData.cirugias),
                        clampHistoriaCantidad(historiaData.cirugias_cantidad) ?? 0
                      )).map((item, idx) => (
                        <input
                          key={`cirugia-item-${idx + 1}`}
                          style={historiaItemInputStyle}
                          placeholder={`Cirugía ${idx + 1}`}
                          value={item}
                          onChange={(e) => {
                            const count = clampHistoriaCantidad(historiaData.cirugias_cantidad) ?? 0;
                            const nextItems = resizeHistoriaItems(splitHistoriaItems(historiaData.cirugias), count);
                            nextItems[idx] = e.target.value;
                            setHistoriaData({
                              ...historiaData,
                              cirugias: joinHistoriaItems(nextItems),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </label>
                  <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Diabetes Mellitus (DM)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span>Diabetes</span>
                        <select
                          style={historiaInputStyle}
                          value={historiaData.diabetes_estado ?? ""}
                          onChange={(e) => setHistoriaData({ ...historiaData, diabetes_estado: e.target.value })}
                        >
                          <option value="">Seleccionar</option>
                          <option value="no">No</option>
                          <option value="tipo_1">Sí (tipo 1)</option>
                          <option value="tipo_2">Sí (tipo 2)</option>
                          <option value="prediabetes">Prediabetes</option>
                          <option value="no_sabe">No sabe</option>
                        </select>
                      </label>
                      {["tipo_1", "tipo_2", "prediabetes"].includes(String(historiaData.diabetes_estado ?? "")) && (
                        <>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Control (últimos 3 meses)</span>
                            <select
                              style={historiaInputStyle}
                              value={historiaData.diabetes_control ?? ""}
                              onChange={(e) => setHistoriaData({ ...historiaData, diabetes_control: e.target.value })}
                            >
                              <option value="">Seleccionar</option>
                              <option value="controlada">Controlada</option>
                              <option value="no_controlada">No controlada</option>
                              <option value="no_sabe">No sabe</option>
                            </select>
                          </label>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Años con diabetes</span>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              style={historiaInputStyle}
                              value={historiaData.diabetes_anios ?? ""}
                              onChange={(e) => setHistoriaData({ ...historiaData, diabetes_anios: e.target.value })}
                            />
                          </label>
                        </>
                      )}
                    </div>
                    {["tipo_1", "tipo_2", "prediabetes"].includes(String(historiaData.diabetes_estado ?? "")) && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Tratamiento</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {DIABETES_TRATAMIENTO_OPTIONS.map((opt) => (
                            <label key={`dm-trat-${opt}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={splitPipeList(historiaData.diabetes_tratamiento).includes(opt)}
                                onChange={(e) =>
                                  setHistoriaData({
                                    ...historiaData,
                                    diabetes_tratamiento: togglePipeValue(historiaData.diabetes_tratamiento, opt, e.target.checked),
                                  })
                                }
                              />
                              <span>{DIABETES_TRATAMIENTO_LABELS[opt] ?? opt}</span>
                            </label>
                          ))}
                        </div>
                        {splitPipeList(historiaData.diabetes_tratamiento).includes("otro") && (
                          <input
                            style={{ ...historiaInputStyle, marginTop: 10 }}
                            placeholder="Especifica otro tratamiento"
                            value={historiaData.diabetes_tratamiento_otro ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, diabetes_tratamiento_otro: e.target.value })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                </section>

                <section data-hist-section="habitos" style={{ display: "grid", gap: 12, order: 3 }}>
                  {/* Hábitos y riesgos */}
                  <h3 style={{ margin: 0, color: "#5f4a32" }}>Hábitos y riesgos</h3>
                  <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12, display: "grid", gap: 10 }}>
                    <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 700, color: "#5f4a32" }}>Pantallas / trabajo de cerca</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Horas de pantalla/celular al día</span>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            style={historiaInputStyle}
                            value={historiaData.horas_pantalla_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, horas_pantalla_dia: e.target.value || null })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Trabajo de cerca horas/día (leer/compu/cel)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            style={historiaInputStyle}
                            value={historiaData.trabajo_cerca_horas_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, trabajo_cerca_horas_dia: e.target.value || null })}
                          />
                        </label>
                        {mostrarDistanciaPantalla && (
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Distancia promedio pantalla (cm)</span>
                            <input
                              type="number"
                              min={0}
                              step="1"
                              style={historiaInputStyle}
                              value={historiaData.distancia_promedio_pantalla_cm ?? ""}
                              onChange={(e) => setHistoriaData({ ...historiaData, distancia_promedio_pantalla_cm: e.target.value || null })}
                            />
                          </label>
                        )}
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Uso de pantalla en oscuridad</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.uso_pantalla_en_oscuridad ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_pantalla_en_oscuridad: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {USO_PANTALLA_OSCURIDAD_UNIDAD_OPTIONS.map((opt) => (
                              <option key={`pantalla-osc-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Iluminación de trabajo</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.iluminacion_trabajo ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, iluminacion_trabajo: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {ILUMINACION_TRABAJO_OPTIONS.map((opt) => (
                              <option key={`iluminacion-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 700, color: "#5f4a32" }}>Exterior / UV</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Exposición al sol/UV</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.exposicion_uv ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, exposicion_uv: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Horas al exterior por día</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.horas_exterior_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, horas_exterior_dia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {HORAS_EXTERIOR_DIA_OPTIONS.map((opt) => (
                              <option key={`horas-ext-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Uso de lentes de sol (horas al día)</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.uso_lentes_sol_horas_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_lentes_sol_horas_dia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {USO_LENTES_SOL_HORAS_DIA_OPTIONS.map((opt) => (
                              <option key={`sol-horas-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Uso de lentes de sol (días por semana)</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.uso_lentes_sol_frecuencia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_lentes_sol_frecuencia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {USO_LENTES_SOL_DIAS_SEMANA_OPTIONS.map((opt) => (
                              <option key={`sol-freq-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Conducción nocturna (al día)</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.conduccion_nocturna_horas ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, conduccion_nocturna_horas: e.target.value || null })}
                          >
                            <option value="">Seleccionar</option>
                            {CONDUCCION_NOCTURNA_OPTIONS.map((opt) => (
                              <option key={`conduccion-noc-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {[
                        { key: "dia", label: "¿Usa lentes al manejar de día?" },
                        { key: "noche", label: "¿Usa lentes al manejar de noche?" },
                      ].map(({ key, label }) => {
                        const usaKey = `usa_lentes_manejar_${key}`;
                        const tipoKey = `tipo_lentes_manejar_${key}`;
                        const tratamientosKey = `tratamientos_lentes_manejar_${key}`;
                        const usaLentes = historiaData[usaKey] === true;
                        return (
                          <div key={key} style={{ padding: 12, borderRadius: 12, background: "#fffaf4", border: "1px solid #ead9c8" }}>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>{label}</span>
                              <select
                                style={historiaInputStyle}
                                value={historiaData[usaKey] === true ? "si" : historiaData[usaKey] === false ? "no" : ""}
                                onChange={(e) => {
                                  const next = e.target.value === "" ? null : e.target.value === "si";
                                  setHistoriaData({
                                    ...historiaData,
                                    [usaKey]: next,
                                    ...(next ? {} : { [tipoKey]: "", [tratamientosKey]: "" }),
                                  });
                                }}
                              >
                                <option value="">Seleccionar</option>
                                <option value="si">Sí</option>
                                <option value="no">No</option>
                              </select>
                            </label>
                            {usaLentes && (
                              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>¿Qué tipo de lentes?</span>
                                  <select
                                    style={historiaInputStyle}
                                    value={historiaData[tipoKey] ?? ""}
                                    onChange={(e) => setHistoriaData({ ...historiaData, [tipoKey]: e.target.value })}
                                  >
                                    <option value="">Seleccionar</option>
                                    {TIPO_LENTES_MANEJAR_OPTIONS.map((opt) => (
                                      <option key={`${key}-tipo-${opt.value}`} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <div>
                                  <div style={{ fontWeight: 700, marginBottom: 6 }}>¿Tienen tratamiento?</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                    {TRATAMIENTOS_LENTES_MANEJAR_OPTIONS.map((opt) => (
                                      <label key={`${key}-trat-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <input
                                          type="checkbox"
                                          checked={splitPipeList(historiaData[tratamientosKey]).includes(opt.value)}
                                          onChange={(e) => setHistoriaData({
                                            ...historiaData,
                                            [tratamientosKey]: togglePipeValue(historiaData[tratamientosKey], opt.value, e.target.checked),
                                          })}
                                        />
                                        <span>{opt.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 700, color: "#5f4a32" }}>Sueño / estrés / hábitos</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Horas de sueño promedio</span>
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step="0.1"
                            style={historiaInputStyle}
                            value={historiaData.horas_sueno_promedio ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, horas_sueno_promedio: e.target.value || null })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Estrés (0-10)</span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step="1"
                            style={historiaInputStyle}
                            value={historiaData.estres_nivel ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, estres_nivel: e.target.value || null })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Peso (kg)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej. 68.5"
                            style={historiaInputStyle}
                            value={historiaData.peso_kg ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, peso_kg: normalizeOneDecimalInput(e.target.value) })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Altura (cm)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Ej. 173"
                            style={historiaInputStyle}
                            value={historiaData.altura_cm ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, altura_cm: normalizeIntegerInput(e.target.value) })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Cafeína (bebidas con cafeína a la semana)</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.cafeina_por_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, cafeina_por_dia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {CAFEINA_POR_DIA_OPTIONS.map((opt) => (
                              <option key={`cafeina-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>¿Lees libros?</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.lee_libros === true ? "si" : historiaData.lee_libros === false ? "no" : ""}
                            onChange={(e) => {
                              const next = e.target.value === "" ? null : e.target.value === "si";
                              setHistoriaData({ ...historiaData, lee_libros: next, ...(next ? {} : { horas_lectura_dia: "" }) });
                            }}
                          >
                            <option value="">Seleccionar</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        {historiaData.lee_libros === true && (
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Horas de lectura a la semana</span>
                            <select
                              style={historiaInputStyle}
                              value={historiaData.horas_lectura_dia ?? ""}
                              onChange={(e) => setHistoriaData({ ...historiaData, horas_lectura_dia: e.target.value })}
                            >
                              <option value="">Seleccionar</option>
                              {HORAS_LECTURA_SEMANA_OPTIONS.map((opt) => (
                                <option key={`lectura-${opt.value}`} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Nivel educativo</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.nivel_educativo ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, nivel_educativo: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {NIVEL_EDUCATIVO_OPTIONS.map((opt) => (
                              <option key={`nivel-ed-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 10 }}>
                      <div style={{ fontWeight: 700, color: "#5f4a32" }}>Ambiente / exposición</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Aire acondicionado: frecuencia</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.uso_aire_acondicionado_frecuencia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_aire_acondicionado_frecuencia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {FRECUENCIA_AMBIENTE_OPTIONS.map((opt) => (
                              <option key={`aire-frec-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Aire acondicionado: horas al día</span>
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step="0.1"
                            style={historiaInputStyle}
                            value={historiaData.uso_aire_acondicionado_horas_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_aire_acondicionado_horas_dia: e.target.value || null })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Calefacción: frecuencia</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.uso_calefaccion_frecuencia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_calefaccion_frecuencia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {FRECUENCIA_AMBIENTE_OPTIONS.map((opt) => (
                              <option key={`calef-frec-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Calefacción: horas al día</span>
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step="0.1"
                            style={historiaInputStyle}
                            value={historiaData.uso_calefaccion_horas_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_calefaccion_horas_dia: e.target.value || null })}
                          />
                        </label>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10, display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>Síntomas al despertar</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        {SINTOMAS_AL_DESPERTAR_OPTIONS.map((opt) => (
                          <label key={`sint-despertar-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={sintomasAlDespertarSeleccionados.includes(opt.value)}
                              onChange={(e) => {
                                const current = historiaData ?? {};
                                const next = togglePipeValue(current.sintomas_al_despertar, opt.value, e.target.checked);
                                const removeOtro = opt.value === "otro" && !e.target.checked;
                                setHistoriaData({
                                  ...current,
                                  sintomas_al_despertar: next,
                                  sintomas_al_despertar_otro: removeOtro ? "" : (current.sintomas_al_despertar_otro ?? ""),
                                });
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      {sintomasAlDespertarSeleccionados.includes("otro") && (
                        <input
                          style={historiaItemInputStyle}
                          placeholder="Otro síntoma al despertar"
                          value={historiaData.sintomas_al_despertar_otro ?? ""}
                          onChange={(e) => setHistoriaData({ ...historiaData, sintomas_al_despertar_otro: e.target.value })}
                        />
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10, display: "grid", gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>Convive con mascotas</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        {CONVIVE_MASCOTAS_OPTIONS.map((opt) => (
                          <label key={`mascota-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={conviveMascotasSeleccionados.includes(opt.value)}
                              onChange={(e) => {
                                const current = historiaData ?? {};
                                const next = togglePipeValue(current.convive_mascotas, opt.value, e.target.checked);
                                const removeOtro = opt.value === "otro" && !e.target.checked;
                                setHistoriaData({
                                  ...current,
                                  convive_mascotas: next,
                                  convive_mascotas_otro: removeOtro ? "" : (current.convive_mascotas_otro ?? ""),
                                });
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      {conviveMascotasSeleccionados.includes("otro") && (
                        <input
                          style={historiaItemInputStyle}
                          placeholder="Otra mascota"
                          value={historiaData.convive_mascotas_otro ?? ""}
                          onChange={(e) => setHistoriaData({ ...historiaData, convive_mascotas_otro: e.target.value })}
                        />
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Tabaco</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Estado</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.tabaquismo_estado ?? ""}
                            onChange={(e) => {
                              const estado = e.target.value;
                              if (estado === "nunca") {
                                setHistoriaData({
                                  ...historiaData,
                                  tabaquismo_estado: estado,
                                  tabaquismo_intensidad: "",
                                  tabaquismo_tiempo_consumo_valor: "",
                                  tabaquismo_tiempo_consumo_unidad: "anios",
                                  tabaquismo_tiempo_desde_dejo_valor: "",
                                  tabaquismo_tiempo_desde_dejo_unidad: "anios",
                                });
                                return;
                              }
                              setHistoriaData({
                                ...historiaData,
                                tabaquismo_estado: estado,
                                tabaquismo_tiempo_desde_dejo_valor: estado === "ex_fumador" ? (historiaData?.tabaquismo_tiempo_desde_dejo_valor ?? "") : "",
                                tabaquismo_tiempo_desde_dejo_unidad: estado === "ex_fumador" ? (historiaData?.tabaquismo_tiempo_desde_dejo_unidad ?? "anios") : "anios",
                              });
                            }}
                          >
                            <option value="">Seleccionar</option>
                            <option value="nunca">Nunca</option>
                            <option value="ex_fumador">Ex consumidor</option>
                            <option value="fumador_actual">Consumidor actual</option>
                          </select>
                        </label>
                        {["ex_fumador", "fumador_actual"].includes(String(historiaData.tabaquismo_estado ?? "")) && (
                          <>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Intensidad (cigarros a la semana)</span>
                              <input
                                type="number"
                                min={0}
                                step="1"
                                style={historiaInputStyle}
                                value={historiaData.tabaquismo_intensidad ?? ""}
                                onChange={(e) => setHistoriaData({ ...historiaData, tabaquismo_intensidad: e.target.value })}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Tiempo siendo consumidor</span>
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                style={historiaInputStyle}
                                value={historiaData.tabaquismo_tiempo_consumo_valor ?? ""}
                                onChange={(e) => setHistoriaData({ ...historiaData, tabaquismo_tiempo_consumo_valor: e.target.value })}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Unidad</span>
                              <select
                                style={historiaInputStyle}
                                value={historiaData.tabaquismo_tiempo_consumo_unidad ?? "anios"}
                                onChange={(e) => setHistoriaData({ ...historiaData, tabaquismo_tiempo_consumo_unidad: e.target.value })}
                              >
                                {DURACION_CONSUMO_UNIDAD_OPTIONS.map((opt) => (
                                  <option key={`tabaco-consumo-unidad-${opt.value}`} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                        {String(historiaData.tabaquismo_estado ?? "") === "ex_fumador" && (
                          <>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Tiempo desde que lo dejó</span>
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                style={historiaInputStyle}
                                value={historiaData.tabaquismo_tiempo_desde_dejo_valor ?? ""}
                                onChange={(e) => setHistoriaData({ ...historiaData, tabaquismo_tiempo_desde_dejo_valor: e.target.value })}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Unidad desde que lo dejó</span>
                              <select
                                style={historiaInputStyle}
                                value={historiaData.tabaquismo_tiempo_desde_dejo_unidad ?? "anios"}
                                onChange={(e) => setHistoriaData({ ...historiaData, tabaquismo_tiempo_desde_dejo_unidad: e.target.value })}
                              >
                                {DURACION_CONSUMO_UNIDAD_OPTIONS.map((opt) => (
                                  <option key={`tabaco-dejo-unidad-${opt.value}`} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Alcohol, marihuana y otras drogas</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                        <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: "#5f4a32" }}>Alcohol</div>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Estado</span>
                            <select
                              style={historiaInputStyle}
                              value={historiaData.alcohol_estado ?? "nunca"}
                              onChange={(e) => {
                                const estado = e.target.value;
                                if (estado === "nunca") {
                                  setHistoriaData({
                                    ...historiaData,
                                    alcohol_estado: estado,
                                    alcohol_bebidas_dia: "",
                                    alcohol_frecuencia_nivel: "",
                                    alcohol_tiempo_valor: "",
                                    alcohol_tiempo_unidad: "anios",
                                  });
                                  return;
                                }
                                setHistoriaData({ ...historiaData, alcohol_estado: estado });
                              }}
                            >
                              {ESTADO_CONSUMO_OPTIONS.map((opt) => (
                                <option key={`alcohol-estado-${opt.value}`} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                          {String(historiaData.alcohol_estado ?? "nunca") !== "nunca" && (
                            <>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span>Frecuencia a la semana</span>
                                <select
                                  style={historiaInputStyle}
                                  value={historiaData.alcohol_frecuencia_nivel ?? ""}
                                  onChange={(e) => setHistoriaData({ ...historiaData, alcohol_frecuencia_nivel: e.target.value })}
                                >
                                  <option value="">Seleccionar</option>
                                  <option value="baja">Baja</option>
                                  <option value="media">Media</option>
                                  <option value="alta">Alta</option>
                                </select>
                              </label>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span>Bebidas a la semana</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  style={historiaInputStyle}
                                  value={historiaData.alcohol_bebidas_dia ?? ""}
                                  onChange={(e) => setHistoriaData({ ...historiaData, alcohol_bebidas_dia: e.target.value })}
                                />
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>Tiempo siendo consumidor</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    style={historiaInputStyle}
                                    value={historiaData.alcohol_tiempo_valor ?? ""}
                                    onChange={(e) => setHistoriaData({ ...historiaData, alcohol_tiempo_valor: e.target.value })}
                                  />
                                </label>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>Unidad</span>
                                  <select
                                    style={historiaInputStyle}
                                    value={historiaData.alcohol_tiempo_unidad ?? "anios"}
                                    onChange={(e) => setHistoriaData({ ...historiaData, alcohol_tiempo_unidad: e.target.value })}
                                  >
                                    {DURACION_CONSUMO_UNIDAD_OPTIONS.map((opt) => (
                                      <option key={`alcohol-unidad-${opt.value}`} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: "#5f4a32" }}>Marihuana</div>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Estado</span>
                            <select
                              style={historiaInputStyle}
                              value={historiaData.marihuana_estado ?? "nunca"}
                              onChange={(e) => {
                                const estado = e.target.value;
                                if (estado === "nunca") {
                                  setHistoriaData({
                                    ...historiaData,
                                    marihuana_estado: estado,
                                    marihuana_frecuencia_semana: "",
                                    marihuana_tiempo_valor: "",
                                    marihuana_tiempo_unidad: "anios",
                                    marihuana_forma: "",
                                  });
                                  return;
                                }
                                setHistoriaData({ ...historiaData, marihuana_estado: estado });
                              }}
                            >
                              {ESTADO_CONSUMO_OPTIONS.map((opt) => (
                                <option key={`marihuana-estado-${opt.value}`} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                          {true && (
                            <>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span>Veces por semana</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  style={historiaInputStyle}
                                  value={historiaData.marihuana_frecuencia_semana ?? ""}
                                  onChange={(e) => setHistoriaData({ ...historiaData, marihuana_frecuencia_semana: e.target.value })}
                                />
                              </label>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span>Forma</span>
                                <select
                                  style={historiaInputStyle}
                                  value={historiaData.marihuana_forma ?? ""}
                                  onChange={(e) => setHistoriaData({ ...historiaData, marihuana_forma: e.target.value })}
                                >
                                  <option value="">Seleccionar</option>
                                  <option value="fumada">Fumada</option>
                                  <option value="vaporizada">Vaporizada</option>
                                  <option value="comestibles">Comestibles</option>
                                  <option value="mixta">Mixta</option>
                                </select>
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>Tiempo siendo consumidor</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    style={historiaInputStyle}
                                    value={historiaData.marihuana_tiempo_valor ?? ""}
                                    onChange={(e) => setHistoriaData({ ...historiaData, marihuana_tiempo_valor: e.target.value })}
                                  />
                                </label>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>Unidad</span>
                                  <select
                                    style={historiaInputStyle}
                                    value={historiaData.marihuana_tiempo_unidad ?? "anios"}
                                    onChange={(e) => setHistoriaData({ ...historiaData, marihuana_tiempo_unidad: e.target.value })}
                                  >
                                    {DURACION_CONSUMO_UNIDAD_OPTIONS.map((opt) => (
                                      <option key={`marihuana-unidad-${opt.value}`} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </>
                          )}
                        </div>

                        <div style={{ border: "1px solid #f0e1cf", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                          <div style={{ fontWeight: 700, color: "#5f4a32" }}>Drogas (otras)</div>
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Estado</span>
                            <select
                              style={historiaInputStyle}
                              value={historiaData.drogas_consumo_estado ?? "nunca"}
                              onChange={(e) => {
                                const estado = e.target.value;
                                if (estado === "nunca") {
                                  setHistoriaData({
                                    ...historiaData,
                                    drogas_consumo_estado: estado,
                                    drogas_tipos: "",
                                    drogas_frecuencia_semana: "",
                                    drogas_tiempo_valor: "",
                                    drogas_tiempo_unidad: "anios",
                                  });
                                  return;
                                }
                                setHistoriaData({ ...historiaData, drogas_consumo_estado: estado });
                              }}
                            >
                              {ESTADO_CONSUMO_OPTIONS.map((opt) => (
                                <option key={`drogas-estado-${opt.value}`} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                          {true && (
                            <>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Tipo</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                                  {DROGAS_TIPOS_OPTIONS.map((opt) => (
                                    <label key={`drogas-tipo-${opt}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <input
                                        type="checkbox"
                                        checked={splitPipeList(historiaData.drogas_tipos).includes(opt)}
                                        onChange={(e) =>
                                          setHistoriaData({
                                            ...historiaData,
                                            drogas_tipos: togglePipeValue(historiaData.drogas_tipos, opt, e.target.checked),
                                          })
                                        }
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span>Frecuencia (veces por semana)</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  style={historiaInputStyle}
                                  value={historiaData.drogas_frecuencia_semana ?? ""}
                                  onChange={(e) => setHistoriaData({ ...historiaData, drogas_frecuencia_semana: e.target.value })}
                                />
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>Tiempo siendo consumidor</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    style={historiaInputStyle}
                                    value={historiaData.drogas_tiempo_valor ?? ""}
                                    onChange={(e) => setHistoriaData({ ...historiaData, drogas_tiempo_valor: e.target.value })}
                                  />
                                </label>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span>Unidad</span>
                                  <select
                                    style={historiaInputStyle}
                                    value={historiaData.drogas_tiempo_unidad ?? "anios"}
                                    onChange={(e) => setHistoriaData({ ...historiaData, drogas_tiempo_unidad: e.target.value })}
                                  >
                                    {DURACION_CONSUMO_UNIDAD_OPTIONS.map((opt) => (
                                      <option key={`drogas-unidad-${opt.value}`} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Deporte y condiciones generales</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Deporte que practica</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                            <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                            <input
                              type="number"
                              min={0}
                              max={15}
                              style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                              value={historiaData.deporte_tipos_cantidad ?? ""}
                              onChange={(e) => {
                                const nextCount = clampHistoriaCantidad(e.target.value);
                                const nextItems = resizeHistoriaItems(
                                  splitHistoriaItems(historiaData.deporte_tipos),
                                  nextCount ?? 0
                                );
                                setHistoriaData({
                                  ...historiaData,
                                  deporte_tipos_cantidad: nextCount,
                                  deporte_tipos: joinHistoriaItems(nextItems),
                                });
                              }}
                            />
                          </div>
                          <div style={historiaItemsGridStyle}>
                            {(resizeHistoriaItems(
                              splitHistoriaItems(historiaData.deporte_tipos),
                              clampHistoriaCantidad(historiaData.deporte_tipos_cantidad) ?? 0
                            )).map((item, idx) => (
                              <input
                                key={`deporte-item-${idx + 1}`}
                                style={historiaItemInputStyle}
                                placeholder={`Deporte ${idx + 1}`}
                                value={item}
                                onChange={(e) => {
                                  const count = clampHistoriaCantidad(historiaData.deporte_tipos_cantidad) ?? 0;
                                  const nextItems = resizeHistoriaItems(
                                    splitHistoriaItems(historiaData.deporte_tipos),
                                    count
                                  );
                                  nextItems[idx] = e.target.value;
                                  setHistoriaData({
                                    ...historiaData,
                                    deporte_tipos: joinHistoriaItems(nextItems),
                                  });
                                }}
                              />
                            ))}
                          </div>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Deporte: días/semana</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.deporte_frecuencia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, deporte_frecuencia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {DEPORTE_FRECUENCIA_OPTIONS.map((opt) => (
                              <option key={`dep-freq-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Deporte: horas por día</span>
                          <input
                            type="text"
                            style={historiaInputStyle}
                            value={historiaData.deporte_horas_dia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, deporte_horas_dia: e.target.value })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Hipertensión</span>
                          <select
                            style={historiaInputStyle}
                            value={String(historiaData.hipertension ?? "")}
                            onChange={(e) => setHistoriaData({ ...historiaData, hipertension: parseBoolSelect(e.target.value) })}
                          >
                            <option value="">Seleccionar</option>
                            <option value="true">Si</option>
                            <option value="false">No</option>
                          </select>
                        </label>
                      </div>
                      <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                        <span>Medicamentos que actualmente toma</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                          <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                          <input
                            type="number"
                            min={0}
                            max={15}
                            style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                            value={historiaData.medicamentos_cantidad ?? ""}
                            onChange={(e) => {
                              const nextCount = clampHistoriaCantidad(e.target.value);
                              const nextItems = resizeHistoriaItems(
                                splitHistoriaItems(historiaData.medicamentos),
                                nextCount ?? 0
                              );
                              setHistoriaData({
                                ...historiaData,
                                medicamentos_cantidad: nextCount,
                                medicamentos: joinHistoriaItems(nextItems),
                              });
                            }}
                          />
                        </div>
                        <div style={historiaItemsGridStyle}>
                          {(resizeHistoriaItems(
                            splitHistoriaItems(historiaData.medicamentos),
                            clampHistoriaCantidad(historiaData.medicamentos_cantidad) ?? 0
                          )).map((item, idx) => (
                            <input
                              key={`medicamento-item-${idx + 1}`}
                              style={historiaItemInputStyle}
                              placeholder={`Medicamento ${idx + 1}`}
                              value={item}
                              onChange={(e) => {
                                const count = clampHistoriaCantidad(historiaData.medicamentos_cantidad) ?? 0;
                                const nextItems = resizeHistoriaItems(
                                  splitHistoriaItems(historiaData.medicamentos),
                                  count
                                );
                                nextItems[idx] = e.target.value;
                                setHistoriaData({
                                  ...historiaData,
                                  medicamentos: joinHistoriaItems(nextItems),
                                });
                              }}
                            />
                          ))}
                        </div>
                      </label>
                    </div>

                    <div style={{ display: "none", borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Lentes</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Usa lentes actualmente</span>
                          <select
                            style={historiaInputStyle}
                            value={String(historiaData.usa_lentes ?? "")}
                            onChange={(e) => {
                              const usa = parseBoolSelect(e.target.value);
                              if (usa !== true) {
                                setHistoriaData({
                                  ...historiaData,
                                  usa_lentes: usa,
                                  tipo_lentes_actual: "",
                                  tiempo_uso_lentes: "",
                                  tiempo_uso_lentes_anios: "",
                                  lentes_contacto_horas_dia: null,
                                  lentes_contacto_dias_semana: null,
                                });
                                return;
                              }
                              setHistoriaData({ ...historiaData, usa_lentes: usa });
                            }}
                          >
                            <option value="">Seleccionar</option>
                            <option value="true">Si</option>
                            <option value="false">No</option>
                          </select>
                        </label>
                        {historiaData.usa_lentes === true && (
                          <label style={{ display: "grid", gap: 4 }}>
                            <span>Tipo de lentes</span>
                            <select
                              style={historiaInputStyle}
                              value={historiaData.tipo_lentes_actual ?? ""}
                              onChange={(e) => {
                                const tipo = e.target.value;
                                setHistoriaData({
                                  ...historiaData,
                                  tipo_lentes_actual: tipo,
                                });
                              }}
                            >
                              <option value="">Seleccionar</option>
                              <option value="armazon">Armazón</option>
                              <option value="contacto">Contacto</option>
                              <option value="ambos">Ambos</option>
                            </select>
                          </label>
                        )}
                        {historiaData.usa_lentes === true && Boolean(historiaData.tipo_lentes_actual) && (
                          <>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Tiempo de uso de lentes: en años</span>
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                style={historiaInputStyle}
                                value={historiaData.tiempo_uso_lentes_anios ?? ""}
                                onChange={(e) => setHistoriaData({ ...historiaData, tiempo_uso_lentes_anios: e.target.value })}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Tiempo de uso al día (horas)</span>
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                style={historiaInputStyle}
                                value={historiaData.lentes_contacto_horas_dia ?? ""}
                                onChange={(e) => setHistoriaData({ ...historiaData, lentes_contacto_horas_dia: e.target.value || null })}
                              />
                            </label>
                          </>
                        )}
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Uso de lentes con micas antiblueray al día</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.uso_lentes_proteccion_uv ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, uso_lentes_proteccion_uv: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {TIEMPO_USO_ANTIBLUERAY_DIA_OPTIONS.map((opt) => (
                              <option key={`antiblueray-dia-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #f0e1cf", paddingTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Síntomas</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Fotofobia (0-10)</span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step="1"
                            style={historiaInputStyle}
                            value={historiaData.fotofobia_escala ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, fotofobia_escala: e.target.value || null })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Dolor ocular (0-10)</span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step="1"
                            style={historiaInputStyle}
                            value={historiaData.dolor_ocular_escala ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, dolor_ocular_escala: e.target.value || null })}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Cefalea: frecuencia</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.cefalea_frecuencia ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, cefalea_frecuencia: e.target.value })}
                          >
                            <option value="">Seleccionar</option>
                            {CEFALEA_FRECUENCIA_OPTIONS.map((opt) => (
                              <option key={`cefalea-freq-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Flotadores / destellos</span>
                          <select
                            style={historiaInputStyle}
                            value={historiaData.flotadores_destellos ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setHistoriaData({
                                ...historiaData,
                                flotadores_destellos: val,
                                flotadores_lateralidad: val ? (historiaData.flotadores_lateralidad ?? "") : "",
                              });
                            }}
                          >
                            <option value="">Seleccionar</option>
                            {FLOTADORES_DESTELLOS_OPTIONS.map((opt) => (
                              <option key={`flotadores-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                        {Boolean(historiaData.flotadores_destellos) && historiaData.flotadores_destellos !== "ninguno" && (
                          <>
                            <label style={{ display: "grid", gap: 4 }}>
                              <span>Lateralidad</span>
                              <select
                                style={historiaInputStyle}
                                value={historiaData.flotadores_lateralidad ?? ""}
                                onChange={(e) => setHistoriaData({ ...historiaData, flotadores_lateralidad: e.target.value })}
                              >
                                <option value="">Seleccionar</option>
                                {FLOTADORES_LATERALIDAD_OPTIONS.map((opt) => (
                                  <option key={`lateralidad-${opt.value}`} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Síntomas adicionales</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {SINTOMAS_OPTIONS.map((opt) => (
                            <label key={`sint-${opt.value}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={splitPipeList(historiaData.sintomas).includes(opt.value)}
                                onChange={(e) =>
                                  setHistoriaData({
                                    ...historiaData,
                                    sintomas: togglePipeValue(historiaData.sintomas, opt.value, e.target.checked),
                                  })
                                }
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#5f4a32" }}>Otro</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 220 }}>
                            <span style={{ fontSize: 12, color: "#6b4f37", fontWeight: 700 }}>Cantidad</span>
                            <input
                              type="number"
                              min={0}
                              max={15}
                              style={{ ...historiaInputStyle, width: 96, padding: 8 }}
                              value={historiaData.sintomas_otros_cantidad ?? ""}
                              onChange={(e) => {
                                const nextCount = clampHistoriaCantidad(e.target.value);
                                const nextItems = resizeHistoriaItems(
                                  splitHistoriaItems(historiaData.sintomas_otros),
                                  nextCount ?? 0
                                );
                                setHistoriaData({
                                  ...historiaData,
                                  sintomas_otros_cantidad: nextCount,
                                  sintomas_otros: joinHistoriaItems(nextItems),
                                });
                              }}
                            />
                          </div>
                          <div style={historiaItemsGridStyle}>
                            {(resizeHistoriaItems(
                              splitHistoriaItems(historiaData.sintomas_otros),
                              clampHistoriaCantidad(historiaData.sintomas_otros_cantidad) ?? 0
                            )).map((item, idx) => (
                              <input
                                key={`sintoma-otro-item-${idx + 1}`}
                                style={historiaItemInputStyle}
                                placeholder={`Otro síntoma ${idx + 1}`}
                                value={item}
                                onChange={(e) => {
                                  const count = clampHistoriaCantidad(historiaData.sintomas_otros_cantidad) ?? 0;
                                  const nextItems = resizeHistoriaItems(
                                    splitHistoriaItems(historiaData.sintomas_otros),
                                    count
                                  );
                                  nextItems[idx] = e.target.value;
                                  setHistoriaData({
                                    ...historiaData,
                                    sintomas_otros: joinHistoriaItems(nextItems),
                                  });
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section data-hist-section="optometria" style={{ display: "grid", gap: 12, order: 6 }}>
                  {/* Optometría complementaria */}
                  <h3 style={{ margin: 0, color: "#5f4a32" }}>Optometría complementaria</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                    <label style={{ display: "grid", gap: 4 }}><span>PPC</span><input type="text" style={historiaInputStyle} value={historiaData.ppc ?? ""} onChange={(e)=>setHistoriaData({...historiaData, ppc: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Lejos</span><input type="text" style={historiaInputStyle} value={historiaData.lejos ?? ""} onChange={(e)=>setHistoriaData({...historiaData, lejos: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Cerca</span><input type="text" style={historiaInputStyle} value={historiaData.cerca ?? ""} onChange={(e)=>setHistoriaData({...historiaData, cerca: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Tensión</span><input type="text" style={historiaInputStyle} value={historiaData.tension ?? ""} onChange={(e)=>setHistoriaData({...historiaData, tension: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>mmHg</span><input type="text" style={historiaInputStyle} value={historiaData.mmhg ?? ""} onChange={(e)=>setHistoriaData({...historiaData, mmhg: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>DI</span><input type="text" style={historiaInputStyle} value={historiaData.di ?? ""} onChange={(e)=>setHistoriaData({...historiaData, di: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Adición OD</span><input type="text" style={historiaInputStyle} value={historiaData.adicionod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, adicionod: e.target.value || null})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Adición OI</span><input type="text" style={historiaInputStyle} value={historiaData.adicionoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, adicionoi: e.target.value || null})} /></label>
                  </div>
                </section>

                <section data-hist-section="hallazgos" style={{ display: "grid", gap: 12, order: 7 }}>
                  {/* AV y hallazgos */}
                  <h3 style={{ margin: 0, color: "#5f4a32" }}>AV y hallazgos</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                    <label style={{ display: "grid", gap: 4 }}><span>AV sin RX OD</span><input style={historiaInputStyle} value={historiaData.avsinrxod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, avsinrxod: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>AV sin RX OI</span><input style={historiaInputStyle} value={historiaData.avsinrixoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, avsinrixoi: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>CAP visual OD</span><input style={historiaInputStyle} value={historiaData.capvisualod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, capvisualod: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>CAP visual OI</span><input style={historiaInputStyle} value={historiaData.capvisualoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, capvisualoi: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>AV RX ant OD</span><input style={historiaInputStyle} value={historiaData.avrxantod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, avrxantod: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>AV RX ant OI</span><input style={historiaInputStyle} value={historiaData.avrxantoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, avrxantoi: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Quera OD</span><input style={historiaInputStyle} value={historiaData.queraod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, queraod: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Quera OI</span><input style={historiaInputStyle} value={historiaData.queraoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, queraoi: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Retinos OD</span><input style={historiaInputStyle} value={historiaData.retinosod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, retinosod: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Retinos OI</span><input style={historiaInputStyle} value={historiaData.retinosoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, retinosoi: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Subjetivo OD</span><input style={historiaInputStyle} value={historiaData.subjeod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, subjeod: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Subjetivo OI</span><input style={historiaInputStyle} value={historiaData.subjeoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, subjeoi: e.target.value})} /></label>
                    <label style={{ display: "grid", gap: 4 }}><span>Papila</span><input style={historiaInputStyle} value={historiaData.papila ?? ""} onChange={(e)=>setHistoriaData({...historiaData, papila: e.target.value})} /></label>
                  </div>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Biomicroscopia</span>
                    <textarea
                      style={{ ...historiaInputStyle, minHeight: 80, resize: "vertical" }}
                      value={historiaData.biomicroscopia ?? ""}
                      onChange={(e)=>setHistoriaData({...historiaData, biomicroscopia: e.target.value})}
                    />
                  </label>
                </section>

                <section data-hist-section="seguimiento" style={{ display: "grid", gap: 12, order: 8 }}>
                  <h3 style={{ margin: 0, color: "#5f4a32" }}>Seguimiento</h3>
                  <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 4 }}>
                        <span>Seguimiento requerido</span>
                        <select
                          style={historiaInputStyle}
                          value={String(historiaData.seguimiento_requerido ?? "")}
                          onChange={(e) => {
                            const requerido = parseBoolSelect(e.target.value);
                            if (requerido !== true) {
                              setHistoriaData({
                                ...historiaData,
                                seguimiento_requerido: requerido,
                                seguimiento_tipo: "",
                                seguimiento_valor: "",
                              });
                              return;
                            }
                            setHistoriaData({
                              ...historiaData,
                              seguimiento_requerido: requerido,
                              seguimiento_tipo: "fecha",
                            });
                          }}
                        >
                          <option value="">Seleccionar</option>
                          <option value="true">Si</option>
                          <option value="false">No</option>
                        </select>
                      </label>
                      {historiaData.seguimiento_requerido === true && (
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Fecha de seguimiento</span>
                          <input
                            type="date"
                            style={historiaInputStyle}
                            value={historiaData.seguimiento_valor ?? ""}
                            onChange={(e) => setHistoriaData({ ...historiaData, seguimiento_tipo: "fecha", seguimiento_valor: e.target.value })}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </section>

              </form>

            ) : (
              <div style={{ marginTop: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  Este paciente no tiene historia clínica aún.
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const r = await apiFetch(
                        `/pacientes/${historiaPacienteId}/historia?sucursal_id=${historiaSucursalId ?? sucursalActivaId}`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            paciente_id: historiaPacienteId,
                            diagnostico_general: "",
                            doctor_atencion: "",
                          }),
                        }
                      );

                      if (!r.ok) throw new Error(await readErrorMessage(r));

                      const data = await r.json();
                      setHistoriaData(normalizeHistoriaForUi(data, ""));
                    } catch (e: any) {
                      setError(e?.message ?? String(e));
                    }
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Crear historia clínica
                </button>
              </div>
            )}
              </div>
            </div>
          </div>
        </div>
        ), document.body)}

      {successHistoriaMsg && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #2ecc71",
            background: "#e8f8f2",
            color: "#1e8449",
            fontWeight: 700,
          }}
        >
          ✔ {successHistoriaMsg}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #f00", borderRadius: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
