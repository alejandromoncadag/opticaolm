
import { useEffect, useMemo, useRef, useState, type ReactNode, type FormEvent, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker.css";
import logoOlm from "./assets/optica.png";
import OnlineShippingAdmin from "./OnlineShippingAdmin";
import OpticalOperationsAdmin from "./OpticalOperationsAdmin";
import OpticalCatalogPricingAdmin from "./OpticalCatalogPricingAdmin";



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

type VentaEstado =
  | "cotizacion"
  | "pendiente"
  | "confirmada"
  | "completada"
  | "cancelada"
  | "devuelta";

type VentaEstadoPago =
  | "sin_pago"
  | "anticipo"
  | "pagada"
  | "pago_parcial"
  | "reembolsada";

type VentaEstadoPedido =
  | "pendiente_fabricacion"
  | "en_fabricacion"
  | "listo_entregar"
  | "entregado"
  | "cancelado";

type VentaPago = {
  pago_id?: number;
  metodo: VentaMetodoPago;
  monto: number;
  referencia?: string | null;
  fecha_hora?: string | null;
};

type VentaPagoDraft = Omit<VentaPago, "monto"> & {
  ui_id: number;
  monto: number | string;
};

type VentaProductoDetalle = {
  venta_catalogo_detalle_id?: number;
  linea_ref?: string;
  configuracion_ref?: string | null;
  tipo_linea?: "producto" | "armazon" | "diseno" | "tratamiento";
  variante_id?: number | null;
  variante_codigo?: string | null;
  variante_nombre?: string | null;
  estado_registro?: "activo" | "reemplazado" | "cancelado";
  cantidad_cancelada?: number;
  producto_id: number;
  sku: string;
  categoria: string;
  subcategoria?: string | null;
  nombre: string;
  modelo?: string | null;
  color?: string | null;
  tipo_mica?: string | null;
  descripcion?: string | null;
  imagen_url?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type Venta = {
  venta_id: number;
  fecha_hora: string | null;
  compra: string | null;
  subtotal?: number;
  descuento_porcentaje?: number;
  descuento_monto?: number;
  descuento_motivo?: string | null;
  cupon_tipo?: string | null;
  monto_total: number;
  metodo_pago: string;
  forma_liquidacion?: VentaFormaLiquidacion;
  plazo_meses?: number | null;
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
  pagos?: VentaPago[];
  productos?: VentaProductoDetalle[];
  monto_pagado?: number;
  saldo_pendiente?: number;
  estado_venta?: VentaEstado | string;
  estado_pago?: VentaEstadoPago | string;
  estado_pedido?: VentaEstadoPedido | string;
  origen_catalogo?: "fase1b" | string;
  version_catalogo?: number;
  credito_cliente?: number;
  configuraciones?: VentaConfiguracionOptica[];
  descuentos?: VentaDescuentoFase1B[];
};

type VentaCreate = {
  paciente_id: number;
  sucursal_id?: number | null;
  compra: string;
  subtotal?: number;
  descuento_porcentaje?: number;
  descuento_monto?: number;
  descuento_motivo?: string | null;
  cupon_tipo?: string | null;
  monto_total: number;
  metodo_pago: string;
  forma_liquidacion?: VentaFormaLiquidacion;
  plazo_meses?: number | null;
  adelanto_aplica?: boolean;
  adelanto_monto?: number | null;
  adelanto_metodo?: VentaMetodoPago | null;
  como_nos_conocio?: string | null;
  notas?: string | null;
  productos?: Array<{
    producto_id: number;
    cantidad: number;
  }>;
  pagos?: VentaPago[];
  estado_venta?: VentaEstado;
  estado_pago?: VentaEstadoPago;
  estado_pedido?: VentaEstadoPedido;
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
  slug?: string;
  costo_confirmado?: boolean;
  stock_reservado?: number;
  version?: number;
  comportamiento_abasto_default?: VentaComportamientoAbasto;
  unidad_medida?: string;
  permite_graduacion?: boolean;
  tipo_producto?: "producto_fisico" | "componente_mica" | "servicio";
  publicado_online?: boolean;
  comprable_online?: boolean;
  permite_favorito?: boolean;
  cantidad_maxima_por_linea?: number | null;
  variantes?: CatalogoVariante[];
};

type InventarioMovimiento = {
  movimiento_id: number;
  fecha_hora: string;
  tipo: string;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  costo_unitario: number | null;
  proveedor: string | null;
  folio: string | null;
  notas: string | null;
  usuario: string;
  producto_id: number;
  producto: string;
  sku: string;
};

type FinanzasData = {
  periodo: { desde: string; hasta: string };
  resumen: Record<string, number>;
  movimientos: Array<Record<string, any>>;
  gastos: Array<Record<string, any>>;
  nomina: Array<Record<string, any>>;
  cuentas_cobrar: Array<Record<string, any>>;
  cuentas_pagar: Array<Record<string, any>>;
  estado_resultados: Record<string, number>;
  flujo_efectivo: Record<string, number>;
  balance_general: Record<string, number>;
};

type VentaCarritoItem = {
  producto_id: number;
  cantidad: number;
};

type CatalogoVariante = {
  variante_id: number;
  codigo: string;
  nombre: string;
  precio_ajuste_override?: number | null;
};

type VentaComportamientoAbasto =
  | "inventario"
  | "laboratorio_bajo_pedido"
  | "fabricacion_interna"
  | "servicio";

type VentaEstadoProduccion =
  | "pendiente_anticipo"
  | "listo_para_produccion"
  | "en_produccion"
  | "listo_para_entregar"
  | "entregado"
  | "cancelado";

type VentaConfiguracionOptica = {
  configuracion_id?: number;
  configuracion_ref: string;
  tipo_configuracion: "par_completo" | "solo_micas" | "solo_tratamiento";
  usa_armazon_cliente?: boolean;
  armazon_producto_id: number | null;
  diseno_producto_id: number | null;
  tratamiento_producto_id: number | null;
  variante_id: number | null;
  uso_visual: "lejos" | "cerca" | "intermedio" | "multifocal" | "sin_graduacion" | "otro";
  uso_visual_otro?: string | null;
  prescripcion_id: number | null;
  comportamiento_abasto_usado: VentaComportamientoAbasto;
  estado_produccion?: VentaEstadoProduccion;
  estado_registro?: "activo" | "reemplazado" | "cancelado";
  subtotal_bruto_snapshot?: number;
};

type VentaDescuentoFase1B = {
  descuento_id?: number;
  descuento_ref: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: number | string;
  motivo: string;
  motivo_otro?: string | null;
  cupon_tipo: "online" | "fisico" | "sin_cupon";
  alcance: "venta" | "configuracion" | "linea";
  orden_aplicacion: number;
  configuracion_refs: string[];
  linea_refs: string[];
  base_elegible?: number;
  monto_aplicado?: number;
};

type PrescripcionOptica = {
  prescripcion_id: number;
  sucursal_captura_id: number;
  origen: "interna" | "externa_cliente";
  fecha_prescripcion?: string | null;
  referencia_externa?: string | null;
  od_esfera?: string | null;
  od_cilindro?: string | null;
  oi_esfera?: string | null;
  oi_cilindro?: string | null;
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
  || "http://127.0.0.1:8000";

function resolveCatalogMediaUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${API.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

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
      `No se pudo conectar con el backend (${API}${path}). Verifica que el backend esté iniciado y que la URL configurada sea correcta; después recarga la página.`
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
  rol: "admin" | "recepcion" | "doctor" | "contador";
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
  variant: "pacientes" | "consultas" | "ventas" | "resumen_ventas" | "estadisticas" | "historia_clinica" | "inventario";
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
          : variant === "resumen_ventas"
            ? "#0f766e"
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
          : variant === "resumen_ventas"
            ? "▤"
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

function formatIsoWeekInput(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function parseIsoWeekRange(value: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const januaryFourth = new Date(year, 0, 4);
  const mondayOffset = (januaryFourth.getDay() + 6) % 7;
  const start = new Date(year, 0, 4 - mondayOffset + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
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

function formatVentaEstadoLabel(value: string | null | undefined): string {
  return VENTA_ESTADO_OPTIONS.find((opcion) => opcion.value === value)?.label || "Confirmada";
}

function formatVentaEstadoPagoLabel(value: string | null | undefined): string {
  return VENTA_ESTADO_PAGO_OPTIONS.find((opcion) => opcion.value === value)?.label || "Sin pago";
}

function formatVentaEstadoPedidoLabel(value: string | null | undefined): string {
  return VENTA_ESTADO_PEDIDO_OPTIONS.find((opcion) => opcion.value === value)?.label || "Pendiente de fabricación";
}

function deriveVentaEstadoPago(
  montoTotal: number,
  montoPagado: number,
  cantidadPagos: number,
): VentaEstadoPago {
  if (montoPagado <= 0) return "sin_pago";
  if (montoPagado >= montoTotal) return "pagada";
  return cantidadPagos <= 1 ? "anticipo" : "pago_parcial";
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

const VENTA_PLAN_FINANCIAMIENTO_OPTIONS: Array<{ value: VentaFormaLiquidacion; label: string }> = [
  { value: "meses_sin_intereses", label: "Meses sin intereses" },
  { value: "meses_con_intereses", label: "Meses con intereses" },
];

const VENTA_ESTADO_OPTIONS: Array<{ value: VentaEstado; label: string; detail: string }> = [
  { value: "cotizacion", label: "Cotización", detail: "Todavía no es una venta confirmada." },
  { value: "pendiente", label: "Pendiente", detail: "Se inició, pero falta confirmar algo." },
  { value: "confirmada", label: "Confirmada", detail: "El cliente aceptó el pedido." },
  { value: "completada", label: "Completada", detail: "Terminó correctamente." },
  { value: "cancelada", label: "Cancelada", detail: "La venta se anuló." },
  { value: "devuelta", label: "Devuelta", detail: "El producto fue regresado después de completar la venta." },
];

const VENTA_ESTADO_PAGO_OPTIONS: Array<{ value: VentaEstadoPago; label: string }> = [
  { value: "sin_pago", label: "Sin pago" },
  { value: "anticipo", label: "Anticipo" },
  { value: "pagada", label: "Pagada" },
  { value: "pago_parcial", label: "Pago parcial" },
  { value: "reembolsada", label: "Reembolsada" },
];

const VENTA_ESTADO_PEDIDO_OPTIONS: Array<{ value: VentaEstadoPedido; label: string }> = [
  { value: "pendiente_fabricacion", label: "Pendiente de fabricación" },
  { value: "en_fabricacion", label: "En fabricación" },
  { value: "listo_entregar", label: "Listo para entregar" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
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
  const [tab, setTab] = useState<"pacientes" | "consultas" | "ventas" | "resumen_ventas" | "estadisticas" | "historia_clinica" | "inventario" | "envios" | "finanzas">("pacientes");

  // ---- Estado de sesión y búsqueda ----
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
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
  const [ventasResumen, setVentasResumen] = useState<Venta[]>([]);
  const [loadingVentasResumen, setLoadingVentasResumen] = useState(false);
  const [ventasResumenError, setVentasResumenError] = useState<string | null>(null);
  const [qVentasResumen, setQVentasResumen] = useState("");
  const [ventasResumenEstado, setVentasResumenEstado] = useState<"por_cobrar" | "parciales" | "liquidadas" | "todas">("por_cobrar");
  const [ventasResumenEstadoVenta, setVentasResumenEstadoVenta] = useState<"todas" | VentaEstado>("todas");
  const [ventasResumenEstadoPago, setVentasResumenEstadoPago] = useState<"todos" | VentaEstadoPago>("todos");
  const [ventasResumenPeriodo, setVentasResumenPeriodo] = useState<"todos" | "dia" | "semana" | "mes" | "anio">("todos");
  const [ventasResumenDia, setVentasResumenDia] = useState(formatDateYYYYMMDD(new Date()));
  const [ventasResumenSemana, setVentasResumenSemana] = useState(formatIsoWeekInput(new Date()));
  const [ventasResumenMes, setVentasResumenMes] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [ventasResumenAnio, setVentasResumenAnio] = useState(String(new Date().getFullYear()));
  const [ventasResumenOrden, setVentasResumenOrden] = useState<"recientes" | "antiguas" | "cliente" | "monto_desc" | "saldo_desc">("recientes");
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);





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
  const [ventaDetalleEditando, setVentaDetalleEditando] = useState(false);
  const [savingVentaSeguimiento, setSavingVentaSeguimiento] = useState(false);
  const [ventaSeguimientoError, setVentaSeguimientoError] = useState<string | null>(null);
  const [ventaSeguimientoDraft, setVentaSeguimientoDraft] = useState<{
    estado_venta: VentaEstado;
    estado_pago: VentaEstadoPago;
    estado_pedido: VentaEstadoPedido;
    notas: string;
  }>({
    estado_venta: "confirmada",
    estado_pago: "sin_pago",
    estado_pedido: "pendiente_fabricacion",
    notas: "",
  });
  const [ventaNuevoPagoMetodo, setVentaNuevoPagoMetodo] = useState<VentaMetodoPago>("efectivo");
  const [ventaNuevoPagoMonto, setVentaNuevoPagoMonto] = useState("");


  const [savingPaciente, setSavingPaciente] = useState(false);
  const [successPacienteMsg, setSuccessPacienteMsg] = useState<string | null>(null);
  const [savingConsulta, setSavingConsulta] = useState(false);
  const [savingVenta, setSavingVenta] = useState(false);
  const [successVentaMsg, setSuccessVentaMsg] = useState<string | null>(null);
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null);
  const [ventaEdicionOriginal, setVentaEdicionOriginal] = useState<Venta | null>(null);
  const [inventario, setInventario] = useState<InventarioProducto[]>([]);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [inventarioError, setInventarioError] = useState<string | null>(null);
  const [inventarioStockDraft, setInventarioStockDraft] = useState<Record<number, number | string>>({});
  const [inventarioPrecioDraft, setInventarioPrecioDraft] = useState<Record<number, number>>({});
  const [inventarioCostoDraft, setInventarioCostoDraft] = useState<Record<number, number | "">>({});
  const [savingInventarioId, setSavingInventarioId] = useState<number | null>(null);
  const [inventarioBusqueda, setInventarioBusqueda] = useState("");
  const [inventarioCategoriaFiltro, setInventarioCategoriaFiltro] = useState("todos");
  const [inventarioVista, setInventarioVista] = useState<"existencias" | "movimientos" | "analisis" | "costos" | "precios_opticos" | "comercio" | "bajo_pedido">("existencias");
  const [inventarioMetricaAyuda, setInventarioMetricaAyuda] = useState<"valor" | "ganancia" | null>(null);
  const [inventarioImagenAmpliada, setInventarioImagenAmpliada] = useState<InventarioProducto | null>(null);
  const [inventarioMovimientos, setInventarioMovimientos] = useState<InventarioMovimiento[]>([]);
  const [loadingInventarioMovimientos, setLoadingInventarioMovimientos] = useState(false);
  const [savingInventarioMovimiento, setSavingInventarioMovimiento] = useState(false);
  const [inventarioMovimientoForm, setInventarioMovimientoForm] = useState({
    producto_id: "",
    tipo: "entrada_compra",
    cantidad: "",
    costo_unitario: "",
    proveedor: "",
    folio: "",
    notas: "",
  });
  const [finanzasSeccion, setFinanzasSeccion] = useState<"resumen" | "movimientos" | "gastos" | "nomina" | "cobrar" | "pagar" | "resultados" | "flujo" | "balance">("resumen");
  const [finanzasDesde, setFinanzasDesde] = useState(() => {
    const hoy = new Date();
    return formatDateYYYYMMDD(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  });
  const [finanzasHasta, setFinanzasHasta] = useState(() => formatDateYYYYMMDD(new Date()));
  const [finanzasData, setFinanzasData] = useState<FinanzasData | null>(null);
  const [loadingFinanzas, setLoadingFinanzas] = useState(false);
  const [savingFinanzas, setSavingFinanzas] = useState(false);
  const [finanzasError, setFinanzasError] = useState<string | null>(null);
  const [finanzasForm, setFinanzasForm] = useState<Record<string, any>>({});
  const [finanzasCxpPagoDraft, setFinanzasCxpPagoDraft] = useState<Record<number, string>>({});
  const [ventaCategoria, setVentaCategoria] = useState<VentaCategoria | "">("");
  const [ventaCarrito, setVentaCarrito] = useState<VentaCarritoItem[]>([]);
  const [ventaDescuentoPorcentaje, setVentaDescuentoPorcentaje] = useState(0);
  const [ventaDescuentoMontoFijo, setVentaDescuentoMontoFijo] = useState(0);
  const ventaFormRef = useRef<HTMLFormElement | null>(null);
  const ventaSubmitConfirmadoRef = useRef(false);
  const ventaPagoSeqRef = useRef(1);
  const [ventaPagos, setVentaPagos] = useState<VentaPagoDraft[]>([
    { ui_id: 1, metodo: "efectivo", monto: "" },
  ]);
  const [, setVentaLentesPaso] = useState(1);
  const [ventaConfirmacionOpen, setVentaConfirmacionOpen] = useState(false);
  const [, setVentaAgregarTinte] = useState(false);
  const [, setVentaMostrarAntiblue] = useState(false);
  const [ventaTinteGrado, setVentaTinteGrado] = useState<VentaTinteGrado>("");
  const ventaConfiguracionSeqRef = useRef(1);
  const ventaDescuentoSeqRef = useRef(1);
  const [ventaConfiguraciones, setVentaConfiguraciones] = useState<VentaConfiguracionOptica[]>([]);
  const [ventaConfiguracionActiva, setVentaConfiguracionActiva] = useState<string | null>(null);
  const [ventaDescuentosFase1B, setVentaDescuentosFase1B] = useState<VentaDescuentoFase1B[]>([]);
  const [ventaPreviewFase1B, setVentaPreviewFase1B] = useState<{
    subtotal: number;
    descuento_total: number;
    total: number;
    descuentos: Array<{ descuento_ref: string; base_elegible: number; monto_aplicado: number }>;
  } | null>(null);
  const [ventaPreviewLoading, setVentaPreviewLoading] = useState(false);
  const [prescripcionesVenta, setPrescripcionesVenta] = useState<PrescripcionOptica[]>([]);
  const [prescripcionVentaOpen, setPrescripcionVentaOpen] = useState(false);
  const [prescripcionVentaForm, setPrescripcionVentaForm] = useState({
    origen: "interna" as "interna" | "externa_cliente",
    fecha_prescripcion: formatDateYYYYMMDD(new Date()),
    referencia_externa: "",
    od_esfera: "", od_cilindro: "", od_eje: "", od_adicion: "",
    oi_esfera: "", oi_cilindro: "", oi_eje: "", oi_adicion: "",
    distancia_pupilar: "", notas: "",
  });
  const [successConsultaMsg, setSuccessConsultaMsg] = useState<string | null>(null);
  const [successHistoriaMsg, setSuccessHistoriaMsg] = useState<string | null>(null);
  const [editingConsultaId, setEditingConsultaId] = useState<number | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActivaId, setSucursalActivaId] = useState<number>(1);
  const [sucursalFiltro, setSucursalFiltro] = useState<number | "general" | "online">("general");

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
    descuento_monto: 0,
    descuento_motivo: null,
    cupon_tipo: null,
    monto_total: 0,
    metodo_pago: "efectivo",
    forma_liquidacion: "pago_completo",
    plazo_meses: null,
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

  useEffect(() => {
    if (!me || !formVenta.paciente_id || !["admin", "recepcion", "doctor"].includes(me.rol)) {
      setPrescripcionesVenta([]);
      return;
    }
    loadPrescripcionesVenta(formVenta.paciente_id).catch((reason) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [formVenta.paciente_id, me?.rol]);

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

  const ventasResumenFiltradas = useMemo(() => {
    const q = normalizeForSearch(qVentasResumen);
    const semanaSeleccionada = parseIsoWeekRange(ventasResumenSemana);
    const filtradas = ventasResumen.filter((venta) => {
      const fechaVenta = venta.fecha_hora ? new Date(venta.fecha_hora) : null;
      const coincidePeriodo =
        ventasResumenPeriodo === "todos"
        || (fechaVenta !== null && !Number.isNaN(fechaVenta.getTime()) && (
          (ventasResumenPeriodo === "dia" && formatDateYYYYMMDD(fechaVenta) === ventasResumenDia)
          || (
            ventasResumenPeriodo === "semana"
            && semanaSeleccionada !== null
            && fechaVenta >= semanaSeleccionada.start
            && fechaVenta < semanaSeleccionada.end
          )
          || (
            ventasResumenPeriodo === "mes"
            && `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, "0")}` === ventasResumenMes
          )
          || (
            ventasResumenPeriodo === "anio"
            && String(fechaVenta.getFullYear()) === ventasResumenAnio
          )
        ));
      if (!coincidePeriodo) return false;
      const saldo = Number(venta.saldo_pendiente || 0);
      const pagado = Number(venta.monto_pagado || 0);
      const coincideEstado =
        ventasResumenEstado === "todas"
        || (ventasResumenEstado === "por_cobrar" && saldo > 0)
        || (ventasResumenEstado === "parciales" && saldo > 0 && pagado > 0)
        || (ventasResumenEstado === "liquidadas" && venta.estado_pago === "pagada");
      if (!coincideEstado) return false;
      if (
        ventasResumenEstadoVenta !== "todas"
        && venta.estado_venta !== ventasResumenEstadoVenta
      ) return false;
      if (
        ventasResumenEstadoPago !== "todos"
        && venta.estado_pago !== ventasResumenEstadoPago
      ) return false;
      if (!q) return true;
      return normalizeForSearch([
        venta.venta_id,
        venta.fecha_hora,
        venta.paciente_nombre,
        venta.compra,
        venta.monto_total,
        venta.monto_pagado,
        venta.saldo_pendiente,
        venta.metodo_pago,
        venta.estado_venta,
        venta.estado_pago,
        venta.estado_pedido,
        venta.productos?.map((producto) => [
          producto.nombre,
          producto.sku,
          producto.modelo,
          producto.color,
          producto.tipo_mica,
        ].join(" ")).join(" "),
      ].join(" ")).includes(q);
    });
    return [...filtradas].sort((a, b) => {
      if (ventasResumenOrden === "cliente") {
        return a.paciente_nombre.localeCompare(b.paciente_nombre, "es", { sensitivity: "base" });
      }
      if (ventasResumenOrden === "monto_desc") {
        return Number(b.monto_total || 0) - Number(a.monto_total || 0);
      }
      if (ventasResumenOrden === "saldo_desc") {
        return Number(b.saldo_pendiente || 0) - Number(a.saldo_pendiente || 0);
      }
      const fechaA = a.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
      const fechaB = b.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
      return ventasResumenOrden === "antiguas" ? fechaA - fechaB : fechaB - fechaA;
    });
  }, [
    ventasResumen,
    qVentasResumen,
    ventasResumenEstado,
    ventasResumenEstadoVenta,
    ventasResumenEstadoPago,
    ventasResumenPeriodo,
    ventasResumenDia,
    ventasResumenSemana,
    ventasResumenMes,
    ventasResumenAnio,
    ventasResumenOrden,
  ]);

  const ventasResumenMetricas = useMemo(() => {
    const porCobrar = ventasResumen.filter((venta) => Number(venta.saldo_pendiente || 0) > 0);
    const parciales = porCobrar.filter((venta) => Number(venta.monto_pagado || 0) > 0);
    const liquidadas = ventasResumen.filter((venta) => venta.estado_pago === "pagada");
    return {
      porCobrar: porCobrar.length,
      parciales: parciales.length,
      liquidadas: liquidadas.length,
      todas: ventasResumen.length,
      saldoPorCobrar: porCobrar.reduce(
        (total, venta) => total + Number(venta.saldo_pendiente || 0),
        0,
      ),
    };
  }, [ventasResumen]);




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

  async function loadVentasResumen() {
    if (!me) return;
    setLoadingVentasResumen(true);
    setVentasResumenError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      params.set("sucursal_id", String(sucursalActivaId));
      params.set("fecha_desde", "2000-01-01");
      const r = await apiFetch(`/ventas?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      setVentasResumen(await r.json());
    } catch (e: any) {
      setVentasResumen([]);
      setVentasResumenError(e?.message ?? String(e));
    } finally {
      setLoadingVentasResumen(false);
    }
  }

  async function loadInventario() {
    if (!me) return;
    setLoadingInventario(true);
    setInventarioError(null);
    try {
      const r = await apiFetch(`/catalogo/inventario?sucursal_id=${sucursalActivaId}`);
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
        Object.fromEntries(data.map((producto) => [
          producto.producto_id,
          producto.costo_unitario == null ? "" : Number(producto.costo_unitario),
        ]))
      );
    } catch (e: any) {
      setInventario([]);
      setInventarioError(e?.message ?? String(e));
    } finally {
      setLoadingInventario(false);
    }
  }

  async function guardarStockInventario(producto: InventarioProducto) {
    const valorDraft = inventarioStockDraft[producto.producto_id];
    if (valorDraft === "" || !Number.isFinite(Number(valorDraft))) {
      setInventarioError("Escribe una cantidad de stock válida.");
      return;
    }
    const stock = Math.max(0, Math.trunc(Number(valorDraft ?? producto.stock)));
    setSavingInventarioId(producto.producto_id);
    setInventarioError(null);
    try {
      const r = await apiFetch(
        `/catalogo/inventario/${producto.producto_id}/stock?sucursal_id=${sucursalActivaId}`,
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

  async function loadInventarioMovimientos() {
    if (!me || !["admin", "contador"].includes(me.rol)) return;
    setLoadingInventarioMovimientos(true);
    setInventarioError(null);
    try {
      const r = await apiFetch(`/catalogo/inventario/movimientos?sucursal_id=${sucursalActivaId}&limit=500`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      setInventarioMovimientos(await r.json());
    } catch (e: any) {
      setInventarioMovimientos([]);
      setInventarioError(e?.message ?? String(e));
    } finally {
      setLoadingInventarioMovimientos(false);
    }
  }

  async function registrarInventarioMovimiento() {
    if (!isAdmin) return;
    const productoId = Number(inventarioMovimientoForm.producto_id);
    const cantidad = Number(inventarioMovimientoForm.cantidad);
    const producto = inventario.find((item) => item.producto_id === productoId);
    if (!producto || !Number.isInteger(cantidad) || cantidad < 0 || (inventarioMovimientoForm.tipo !== "conteo_fisico" && cantidad === 0)) {
      setInventarioError("Selecciona un producto y escribe una cantidad válida.");
      return;
    }
    if (inventarioMovimientoForm.tipo === "entrada_compra" && (!inventarioMovimientoForm.costo_unitario || Number(inventarioMovimientoForm.costo_unitario) < 0)) {
      setInventarioError("Captura el costo unitario de la compra.");
      return;
    }
    setSavingInventarioMovimiento(true);
    setInventarioError(null);
    try {
      const r = await apiFetch(`/catalogo/inventario/${productoId}/movimientos`, {
        method: "POST",
        body: JSON.stringify({
          sucursal_id: sucursalActivaId,
          tipo: inventarioMovimientoForm.tipo,
          cantidad,
          expected_stock: producto.stock,
          costo_unitario: inventarioMovimientoForm.costo_unitario === "" ? null : Number(inventarioMovimientoForm.costo_unitario),
          proveedor: inventarioMovimientoForm.proveedor.trim() || null,
          folio: inventarioMovimientoForm.folio.trim() || null,
          notas: inventarioMovimientoForm.notas.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(await readErrorMessage(r));
      setInventarioMovimientoForm((prev) => ({ ...prev, cantidad: "", costo_unitario: "", proveedor: "", folio: "", notas: "" }));
      await Promise.all([loadInventario(), loadInventarioMovimientos()]);
    } catch (e: any) {
      setInventarioError(e?.message ?? String(e));
    } finally {
      setSavingInventarioMovimiento(false);
    }
  }

  async function guardarProductoInventario(producto: InventarioProducto) {
    const stock = producto.controla_stock
      ? Math.max(0, Math.trunc(Number(inventarioStockDraft[producto.producto_id] ?? producto.stock)))
      : null;
    const precio = Math.max(0, Number(inventarioPrecioDraft[producto.producto_id] ?? producto.precio));
    const costoDraft = inventarioCostoDraft[producto.producto_id] ?? producto.costo_unitario ?? "";
    const costoUnitario = costoDraft === "" ? null : Math.max(0, Number(costoDraft));
    if (!Number.isFinite(precio) || (costoUnitario !== null && !Number.isFinite(costoUnitario))) {
      setInventarioError("Precio de venta y costo unitario deben ser números válidos.");
      return;
    }
    setSavingInventarioId(producto.producto_id);
    setInventarioError(null);
    try {
      const r = await apiFetch(
        `/catalogo/inventario/${producto.producto_id}?sucursal_id=${sucursalActivaId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            stock,
            expected_stock: stock === null ? null : producto.stock,
            precio,
            ...(costoUnitario === null ? {} : { costo_unitario: costoUnitario }),
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
                costo_unitario: actualizado.costo_unitario == null ? null : Number(actualizado.costo_unitario),
              }
            : item
        )
      );
      setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: Number(actualizado.stock || 0) }));
      setInventarioPrecioDraft((prev) => ({ ...prev, [producto.producto_id]: Number(actualizado.precio || 0) }));
      setInventarioCostoDraft((prev) => ({
        ...prev,
        [producto.producto_id]: actualizado.costo_unitario == null ? "" : Number(actualizado.costo_unitario),
      }));
    } catch (e: any) {
      setInventarioError(e?.message ?? String(e));
    } finally {
      setSavingInventarioId(null);
    }
  }

  function resetVentaWizard() {
    setVentaConfirmacionOpen(false);
    setVentaCategoria("");
    setVentaCarrito([]);
    setVentaDescuentoPorcentaje(0);
    setVentaDescuentoMontoFijo(0);
    ventaPagoSeqRef.current += 1;
    setVentaPagos([
      { ui_id: ventaPagoSeqRef.current, metodo: "efectivo", monto: "" },
    ]);
    setVentaLentesPaso(1);
    setVentaTinteGrado("");
    setVentaConfiguraciones([]);
    setVentaConfiguracionActiva(null);
    setVentaDescuentosFase1B([]);
    setVentaPreviewFase1B(null);
    setVentasSeleccionadas([]);
  }

  async function guardarConfiguracionComercio(producto: InventarioProducto) {
    if (!isAdmin) return;
    setSavingInventarioId(producto.producto_id);
    setInventarioError(null);
    try {
      const r = await apiFetch(
        `/catalogo/productos/${producto.producto_id}/comercio-online`,
        {
          method: "PATCH",
          body: JSON.stringify({
            publicado_online: Boolean(producto.publicado_online),
            comprable_online: Boolean(producto.comprable_online),
            permite_favorito: Boolean(producto.permite_favorito),
            cantidad_maxima_por_linea: producto.cantidad_maxima_por_linea ?? null,
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
                publicado_online: Boolean(actualizado.publicado_online),
                comprable_online: Boolean(actualizado.comprable_online),
                permite_favorito: Boolean(actualizado.permite_favorito),
                cantidad_maxima_por_linea: actualizado.cantidad_maxima_por_linea ?? null,
              }
            : item,
        ),
      );
    } catch (e: any) {
      setInventarioError(e?.message ?? String(e));
    } finally {
      setSavingInventarioId(null);
    }
  }

  function crearConfiguracionOptica(
    tipo: VentaConfiguracionOptica["tipo_configuracion"] = "par_completo",
  ) {
    const ref = `config-${Date.now()}-${ventaConfiguracionSeqRef.current++}`;
    const next: VentaConfiguracionOptica = {
      configuracion_ref: ref,
      tipo_configuracion: tipo,
      armazon_producto_id: null,
      diseno_producto_id: null,
      tratamiento_producto_id: null,
      variante_id: null,
      uso_visual: tipo === "solo_tratamiento" ? "otro" : "lejos",
      uso_visual_otro: tipo === "solo_tratamiento" ? "Tratamiento del par existente" : null,
      prescripcion_id: null,
      comportamiento_abasto_usado: "laboratorio_bajo_pedido",
      estado_produccion: "pendiente_anticipo",
    };
    setVentaConfiguraciones((prev) => [...prev, next]);
    setVentaConfiguracionActiva(ref);
    setVentaPreviewFase1B(null);
  }

  function actualizarConfiguracionOptica(
    ref: string,
    patch: Partial<VentaConfiguracionOptica>,
  ) {
    setVentaConfiguraciones((prev) => prev.map((config) => {
      if (config.configuracion_ref !== ref) return config;
      const next = { ...config, ...patch };
      if (patch.tipo_configuracion === "par_completo") {
        next.armazon_producto_id = config.armazon_producto_id;
      } else if (patch.tipo_configuracion === "solo_micas") {
        next.armazon_producto_id = null;
      } else if (patch.tipo_configuracion === "solo_tratamiento") {
        next.armazon_producto_id = null;
        next.diseno_producto_id = null;
        next.uso_visual = "otro";
        next.uso_visual_otro = "Tratamiento del par existente";
        next.prescripcion_id = null;
      }
      if (patch.tratamiento_producto_id === null) next.variante_id = null;
      return next;
    }));
    setVentaPreviewFase1B(null);
  }

  function quitarConfiguracionOptica(ref: string) {
    setVentaConfiguraciones((prev) => prev.filter((config) => config.configuracion_ref !== ref));
    setVentaDescuentosFase1B((prev) => prev
      .map((discount) => ({
        ...discount,
        configuracion_refs: discount.configuracion_refs.filter((item) => item !== ref),
        linea_refs: discount.linea_refs.filter((item) => !item.startsWith(`${ref}:`)),
      }))
      .filter((discount) => discount.alcance === "venta" || discount.configuracion_refs.length > 0 || discount.linea_refs.length > 0)
      .map((discount, index) => ({ ...discount, orden_aplicacion: index + 1 }))
    );
    setVentaConfiguracionActiva(null);
    setVentaPreviewFase1B(null);
  }

  function agregarDescuentoFase1B() {
    if (!isAdmin && ventaDescuentosFase1B.length >= 1) return;
    const ref = `desc-${Date.now()}-${ventaDescuentoSeqRef.current++}`;
    setVentaDescuentosFase1B((prev) => [...prev, {
      descuento_ref: ref,
      tipo: "porcentaje",
      valor: "",
      motivo: "familiar",
      cupon_tipo: "sin_cupon",
      alcance: "venta",
      orden_aplicacion: prev.length + 1,
      configuracion_refs: [],
      linea_refs: [],
    }]);
    setVentaPreviewFase1B(null);
  }

  function actualizarDescuentoFase1B(ref: string, patch: Partial<VentaDescuentoFase1B>) {
    setVentaDescuentosFase1B((prev) => prev.map((discount) => (
      discount.descuento_ref === ref ? { ...discount, ...patch } : discount
    )));
    setVentaPreviewFase1B(null);
  }

  function moverDescuentoFase1B(ref: string, direction: -1 | 1) {
    if (!isAdmin) return;
    setVentaDescuentosFase1B((prev) => {
      const current = prev.findIndex((discount) => discount.descuento_ref === ref);
      const target = current + direction;
      if (current < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[current], next[target]] = [next[target], next[current]];
      return next.map((discount, index) => ({ ...discount, orden_aplicacion: index + 1 }));
    });
    setVentaPreviewFase1B(null);
  }

  async function loadPrescripcionesVenta(pacienteId: number) {
    if (!pacienteId) {
      setPrescripcionesVenta([]);
      return;
    }
    const response = await apiFetch(`/pacientes/${pacienteId}/prescripciones-opticas`);
    if (!response.ok) throw new Error(await readErrorMessage(response));
    setPrescripcionesVenta(await response.json());
  }

  async function crearPrescripcionVenta() {
    if (!formVenta.paciente_id) throw new Error("Selecciona primero un paciente.");
    const response = await apiFetch(`/pacientes/${formVenta.paciente_id}/prescripciones-opticas`, {
      method: "POST",
      body: JSON.stringify(cleanPayload({
        ...prescripcionVentaForm,
        sucursal_captura_id: sucursalActivaId,
      })),
    });
    if (!response.ok) throw new Error(await readErrorMessage(response));
    const created = await response.json();
    await loadPrescripcionesVenta(formVenta.paciente_id);
    setPrescripcionVentaOpen(false);
    if (ventaConfiguracionActiva) {
      actualizarConfiguracionOptica(ventaConfiguracionActiva, { prescripcion_id: Number(created.prescripcion_id) });
    }
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

  function seleccionarDisenoFlujoOptico(producto: InventarioProducto) {
    const yaSeleccionado = ventaCarrito.some((item) => item.producto_id === producto.producto_id);
    const micaBase = inventario.find((item) => item.sku === "MIC-BASE-001");
    const idsDisenos = new Set(ventaMicasDisenos.map((item) => item.producto_id));
    const idsTratamientos = new Set(ventaMicasTratamientos.map((item) => item.producto_id));
    const idsArmazones = new Set(ventaArmazonesOpticos.map((item) => item.producto_id));
    setVentaCarrito((prev) => {
      const cantidadArmazones = Math.max(
        1,
        prev
          .filter((item) => idsArmazones.has(item.producto_id))
          .reduce((total, item) => total + item.cantidad, 0),
      );
      // MIC-BASE-001 era un cargo legacy que se agregaba además del diseño.
      // El diseño seleccionado ya representa el par de micas, por lo que se elimina.
      let next = prev.filter((item) => !idsDisenos.has(item.producto_id) && item.producto_id !== micaBase?.producto_id);
      if (yaSeleccionado) {
        next = next.filter((item) => !idsTratamientos.has(item.producto_id));
        return next;
      }
      next.push({ producto_id: producto.producto_id, cantidad: cantidadArmazones });
      return next;
    });
    if (yaSeleccionado) {
      setVentaAgregarTinte(false);
      setVentaMostrarAntiblue(false);
      setVentaTinteGrado("");
    }
    setVentaLentesPaso(yaSeleccionado ? 2 : 3);
  }

  function seleccionarTratamientoFlujoOptico(
    producto: InventarioProducto,
    opciones?: { mantenerAbierto?: boolean; esTinte?: boolean },
  ) {
    const yaSeleccionado = ventaCarrito.some((item) => item.producto_id === producto.producto_id);
    agregarProductoCarrito(producto, "reemplazar_subcategoria");
    const cantidadArmazones = ventaCarrito
      .filter((item) => ventaArmazonesOpticos.some((armazon) => armazon.producto_id === item.producto_id))
      .reduce((total, item) => total + item.cantidad, 0);
    setVentaCarrito((prev) => prev.map((item) =>
      item.producto_id === producto.producto_id ? { ...item, cantidad: Math.max(1, cantidadArmazones) } : item
    ));
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

  // Se conservan temporalmente para poder abrir ventas legacy sin cambiar su estructura.
  void seleccionarDisenoFlujoOptico;
  void seleccionarTratamientoFlujoOptico;

  function actualizarCantidadCarrito(producto: InventarioProducto, cantidad: number) {
    const maximo = producto.controla_stock ? Math.max(1, producto.stock) : 99;
    const cantidadSegura = Math.min(Math.max(1, Math.trunc(cantidad || 1)), maximo);
    setVentaCarrito((prev) => {
      let next = prev.map((item) =>
        item.producto_id === producto.producto_id
          ? { ...item, cantidad: cantidadSegura }
          : item,
      );
      if (producto.categoria === "lentes_opticos" && producto.subcategoria === "armazon") {
        const idsArmazones = new Set(ventaArmazonesOpticos.map((item) => item.producto_id));
        const idsMicas = new Set(
          inventario.filter((item) => item.categoria === "micas").map((item) => item.producto_id),
        );
        const cantidadArmazones = next
          .filter((item) => idsArmazones.has(item.producto_id))
          .reduce((total, item) => total + item.cantidad, 0);
        next = next.map((item) =>
          idsMicas.has(item.producto_id) ? { ...item, cantidad: cantidadArmazones } : item,
        );
      }
      return next;
    });
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
    params.set("sucursal_id", String(sucursalFiltro));
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
    if (!me || me.rol === "contador") return;
    const q = qPaciente.trim();
    if (!q) {
      buscarPacientesParaTabla("");
      return;
    }
    const t = setTimeout(() => {
      buscarPacientesParaTabla(q);
    }, 120);
    return () => clearTimeout(t);
  }, [qPaciente, sucursalActivaId, me?.rol]);

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
    if (me.rol !== "contador") {
      loadPacientes();
      loadConsultas();
    }
  }, [sucursalActivaId, me]);

  useEffect(() => {
    if (!me) return;
    if (!isAdmin && !isContador && me.sucursal_id) {
      setSucursalActivaId(me.sucursal_id);
      setSucursalFiltro(me.sucursal_id);
    }
    loadSucursales();
  }, [me]);

  useEffect(() => {
    if (
      me
      && (
        !["admin", "contador"].includes(me.rol)
        || (["comercio", "bajo_pedido"].includes(inventarioVista) && me.rol !== "admin")
      )
    ) setInventarioVista("existencias");
  }, [me?.rol, inventarioVista]);

  useEffect(() => {
    if (!me || tab !== "consultas") return;
    if (editingConsultaId !== null) return;
    loadAgendaDisponibilidad();
  }, [me, tab, agendaFecha, sucursalActivaId, editingConsultaId]);

  useEffect(() => {
    if (!me || tab !== "estadisticas") return;
    loadStats();
  }, [me, tab, sucursalFiltro]);

  useEffect(() => {
    if (!me || tab !== "resumen_ventas") return;
    loadVentasResumen();
  }, [me, tab, sucursalFiltro]);

  useEffect(() => {
    if (!me || tab !== "finanzas" || !["admin", "contador"].includes(me.rol)) return;
    loadFinanzas();
  }, [me, tab, sucursalFiltro]);

  useEffect(() => {
    if (!me || tab !== "inventario" || inventarioVista !== "movimientos") return;
    loadInventarioMovimientos();
  }, [me, tab, sucursalActivaId, inventarioVista]);

  useEffect(() => {
    if (!me) return;
    if (tab === "ventas" && me.rol !== "admin") return;
    if (tab !== "ventas" && tab !== "inventario" && tab !== "envios") return;
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
    if (!me) return;
    if (me.rol === "contador") {
      if (!["finanzas", "resumen_ventas", "inventario"].includes(tab)) setTab("finanzas");
      return;
    }
    if ((me.rol === "recepcion") && tab === "historia_clinica") {
      setTab("pacientes");
    }
    if (tab === "finanzas" && !["admin", "contador"].includes(me.rol)) setTab("pacientes");
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

  async function openPacientePerfilDesdeVenta(venta: Venta) {
    setTab("pacientes");
    const pacienteLocal = pacientes.find((paciente) => paciente.paciente_id === venta.paciente_id);
    if (pacienteLocal) {
      await openPacientePerfil(pacienteLocal);
      return;
    }

    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", String(venta.paciente_id));
      params.set("limit", "20");
      params.set("sucursal_id", String(sucursalActivaId));
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const encontrados: Paciente[] = await r.json();
      const paciente = encontrados.find((item) => item.paciente_id === venta.paciente_id);
      if (!paciente) throw new Error("No se encontró la información completa del paciente.");
      await openPacientePerfil(paciente);
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
      loadVentasResumen();
      if (selectedVentaDetalle?.venta_id === venta_id) {
        closeVentaDetalle();
      }
      if (editingVentaId === venta_id) {
        cancelEditVenta();
      }
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

  function openVentaDetalle(v: Venta) {
    const estadoPagoCalculado = deriveVentaEstadoPago(
      Number(v.monto_total || 0),
      Number(v.monto_pagado || 0),
      v.pagos?.length || 0,
    );
    setSelectedVentaDetalle(v);
    setVentaDetalleEditando(false);
    setVentaSeguimientoError(null);
    setVentaNuevoPagoMetodo("efectivo");
    setVentaNuevoPagoMonto("");
    setVentaSeguimientoDraft({
      estado_venta: VENTA_ESTADO_OPTIONS.some((opcion) => opcion.value === v.estado_venta)
        ? v.estado_venta as VentaEstado
        : "confirmada",
      estado_pago: VENTA_ESTADO_PAGO_OPTIONS.some((opcion) => opcion.value === v.estado_pago)
        ? v.estado_pago as VentaEstadoPago
        : estadoPagoCalculado,
      estado_pedido: VENTA_ESTADO_PEDIDO_OPTIONS.some((opcion) => opcion.value === v.estado_pedido)
        ? v.estado_pedido as VentaEstadoPedido
        : "pendiente_fabricacion",
      notas: v.notas || "",
    });
  }

  function closeVentaDetalle() {
    setSelectedVentaDetalle(null);
    setVentaDetalleEditando(false);
    setVentaSeguimientoError(null);
    setVentaNuevoPagoMonto("");
  }

  async function guardarSeguimientoVenta() {
    if (!selectedVentaDetalle) return;
    setSavingVentaSeguimiento(true);
    setVentaSeguimientoError(null);
    try {
      const montoNuevo = Math.max(0, Number(ventaNuevoPagoMonto || 0));
      const saldoActual = Number(selectedVentaDetalle.saldo_pendiente || 0);
      if (montoNuevo > saldoActual) {
        throw new Error("El pago nuevo no puede ser mayor que el saldo por pagar.");
      }
      if (
        montoNuevo > 0
        && ["cancelada", "devuelta"].includes(ventaSeguimientoDraft.estado_venta)
      ) {
        throw new Error("No puedes registrar un pago nuevo en una venta cancelada o devuelta.");
      }
      const montoPagadoPreview = Number(selectedVentaDetalle.monto_pagado || 0) + montoNuevo;
      const estadoPagoPreview = montoNuevo > 0
        ? deriveVentaEstadoPago(
            Number(selectedVentaDetalle.monto_total || 0),
            montoPagadoPreview,
            (selectedVentaDetalle.pagos?.length || 0) + 1,
          )
        : ventaSeguimientoDraft.estado_pago;
      const payload = {
        sucursal_id: sucursalActivaId,
        estado_venta: ventaSeguimientoDraft.estado_venta,
        estado_pago: estadoPagoPreview,
        estado_pedido: ventaSeguimientoDraft.estado_pedido,
        notas: ventaSeguimientoDraft.notas.trim() || null,
        ...(montoNuevo > 0
          ? {
              nuevo_pago: {
                metodo: ventaNuevoPagoMetodo,
                monto: Number(montoNuevo.toFixed(2)),
              },
            }
          : {}),
      };
      const r = await apiFetch(
        `/ventas/${selectedVentaDetalle.venta_id}/seguimiento`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const actualizado = await r.json();
      const ventaActualizada: Venta = { ...selectedVentaDetalle, ...actualizado };
      setSelectedVentaDetalle(ventaActualizada);
      setVentaSeguimientoDraft((prev) => ({
        ...prev,
        estado_pago: actualizado.estado_pago,
        notas: actualizado.notas || "",
      }));
      setVentaNuevoPagoMonto("");
      setVentaDetalleEditando(false);
      setVentasResumen((prev) => prev.map((venta) => venta.venta_id === ventaActualizada.venta_id ? ventaActualizada : venta));
      setPerfilVentas((prev) => prev.map((venta) => venta.venta_id === ventaActualizada.venta_id ? ventaActualizada : venta));
    } catch (e: any) {
      setVentaSeguimientoError(e?.message ?? String(e));
    } finally {
      setSavingVentaSeguimiento(false);
    }
  }

  async function loadFinanzas(desde = finanzasDesde, hasta = finanzasHasta) {
    if (!me || !["admin", "contador"].includes(me.rol)) return;
    setLoadingFinanzas(true);
    setFinanzasError(null);
    try {
      const params = new URLSearchParams({
        sucursal_id: String(sucursalFiltro),
        fecha_desde: desde,
        fecha_hasta: hasta,
      });
      const r = await apiFetch(`/finanzas/datos?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      setFinanzasData(await r.json());
    } catch (e: any) {
      setFinanzasError(e?.message ?? String(e));
    } finally {
      setLoadingFinanzas(false);
    }
  }

  async function crearRegistroFinanzas(endpoint: string, payload: Record<string, any>) {
    setSavingFinanzas(true);
    setFinanzasError(null);
    try {
      const comprobante = payload.comprobante_file instanceof File ? payload.comprobante_file as File : null;
      const payloadJson = { ...payload };
      delete payloadJson.comprobante_file;
      const r = await apiFetch(`/finanzas/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(cleanPayload({ ...payloadJson, sucursal_id: sucursalActivaId })),
      });
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const creado = await r.json();
      if (comprobante && (endpoint === "gastos" || endpoint === "cuentas-pagar")) {
        const recurso = endpoint === "gastos" ? "gasto" : "cuenta_pagar";
        const registroId = endpoint === "gastos" ? creado.gasto_id : creado.cuenta_pagar_id;
        const params = new URLSearchParams({ recurso, registro_id: String(registroId), nombre: comprobante.name, sucursal_id: String(sucursalActivaId) });
        const archivoR = await apiFetch(`/finanzas/comprobantes?${params.toString()}`, {
          method: "POST",
          headers: { "Content-Type": comprobante.type || "application/octet-stream" },
          body: comprobante,
        });
        if (!archivoR.ok) throw new Error(`El registro se creó, pero el comprobante no pudo guardarse: ${await readErrorMessage(archivoR)}`);
      }
      setFinanzasForm({});
      await loadFinanzas();
    } catch (e: any) {
      setFinanzasError(e?.message ?? String(e));
    } finally {
      setSavingFinanzas(false);
    }
  }

  async function abrirComprobanteFinanzas(comprobanteId: number) {
    setFinanzasError(null);
    try {
      const r = await apiFetch(`/finanzas/comprobantes/${comprobanteId}?sucursal_id=${sucursalActivaId}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const url = URL.createObjectURL(await r.blob());
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setFinanzasError(e?.message ?? String(e));
    }
  }

  async function actualizarEstadoFinanzas(recurso: "gastos" | "nomina" | "cuentas_pagar", registroId: number, estado: string, montoPagado?: number) {
    setSavingFinanzas(true);
    setFinanzasError(null);
    try {
      const params = new URLSearchParams({ estado, sucursal_id: String(sucursalActivaId) });
      if (montoPagado !== undefined) params.set("monto_pagado", String(montoPagado));
      const r = await apiFetch(`/finanzas/${recurso}/${registroId}/estado?${params.toString()}`, { method: "PATCH" });
      if (!r.ok) throw new Error(await readErrorMessage(r));
      await loadFinanzas();
    } catch (e: any) {
      setFinanzasError(e?.message ?? String(e));
    } finally {
      setSavingFinanzas(false);
    }
  }

  function aplicarPeriodoFinanzas(tipo: "hoy" | "semana" | "mes" | "anio") {
    const hoy = new Date();
    let desde = new Date(hoy);
    if (tipo === "semana") {
      const dia = (hoy.getDay() + 6) % 7;
      desde.setDate(hoy.getDate() - dia);
    } else if (tipo === "mes") {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (tipo === "anio") {
      desde = new Date(hoy.getFullYear(), 0, 1);
    }
    const desdeTexto = formatDateYYYYMMDD(desde);
    const hastaTexto = formatDateYYYYMMDD(hoy);
    setFinanzasDesde(desdeTexto);
    setFinanzasHasta(hastaTexto);
    loadFinanzas(desdeTexto, hastaTexto);
  }

  function exportarFinanzasCsv() {
    if (!finanzasData) return;
    const filas: any[][] = [["seccion", "fecha_periodo", "concepto", "descripcion", "estado_fuente", "importe_1", "importe_2"]];
    Object.entries(finanzasData.resumen).forEach(([concepto, monto]) => filas.push(["resumen", `${finanzasDesde} a ${finanzasHasta}`, concepto, "", "", monto, ""]));
    Object.entries(finanzasData.estado_resultados).forEach(([concepto, monto]) => filas.push(["estado_resultados", `${finanzasDesde} a ${finanzasHasta}`, concepto, "", "", monto, ""]));
    Object.entries(finanzasData.flujo_efectivo).forEach(([concepto, monto]) => filas.push(["flujo_efectivo", `${finanzasDesde} a ${finanzasHasta}`, concepto, "", "", monto, ""]));
    Object.entries(finanzasData.balance_general).forEach(([concepto, monto]) => filas.push(["balance_general", finanzasHasta, concepto, "", "", monto, ""]));
    finanzasData.movimientos.forEach((item) => filas.push(["movimiento", item.fecha, item.categoria, item.descripcion, `${item.tipo}/${item.fuente}`, item.monto, item.cuenta]));
    finanzasData.gastos.forEach((item) => filas.push(["gasto", item.fecha, item.categoria, item.descripcion, item.estado, item.monto, item.proveedor]));
    finanzasData.nomina.forEach((item) => filas.push(["nomina", `${item.periodo_inicio} a ${item.periodo_fin}`, item.empleado, "Pago neto / costo patronal", item.estado, item.pago_neto, item.costo_patronal]));
    finanzasData.cuentas_cobrar.forEach((item) => filas.push(["cuenta_por_cobrar", item.fecha, `Venta #${item.venta_id}`, item.cliente, item.estado_pago, item.saldo, item.total]));
    finanzasData.cuentas_pagar.forEach((item) => filas.push(["cuenta_por_pagar", item.fecha_emision, item.categoria, `${item.proveedor}: ${item.concepto}`, item.estado, item.saldo, item.monto_total]));
    const contenido = filas.map((fila) => fila.map((valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob(["\ufeff", contenido], { type: "text/csv;charset=utf-8" }));
    enlace.download = `finanzas_${finanzasDesde}_${finanzasHasta}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  function startEditVenta(v: Venta) {
    setEditingVentaId(v.venta_id);
    setVentaEdicionOriginal(v);
    setVentaSeguimientoDraft({
      estado_venta: VENTA_ESTADO_OPTIONS.some((opcion) => opcion.value === v.estado_venta)
        ? v.estado_venta as VentaEstado
        : "confirmada",
      estado_pago: VENTA_ESTADO_PAGO_OPTIONS.some((opcion) => opcion.value === v.estado_pago)
        ? v.estado_pago as VentaEstadoPago
        : deriveVentaEstadoPago(
            Number(v.monto_total || 0),
            Number(v.monto_pagado || 0),
            v.pagos?.length || 0,
          ),
      estado_pedido: VENTA_ESTADO_PEDIDO_OPTIONS.some((opcion) => opcion.value === v.estado_pedido)
        ? v.estado_pedido as VentaEstadoPedido
        : "pendiente_fabricacion",
      notas: v.notas || "",
    });
    setVentaNuevoPagoMetodo("efectivo");
    setVentaNuevoPagoMonto("");
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
    setVentaCarrito(
      (v.productos || []).filter((producto) => !producto.configuracion_ref).map((producto) => ({
        producto_id: producto.producto_id,
        cantidad: Math.max(1, Number(producto.cantidad || 1) - Number(producto.cantidad_cancelada || 0)),
      })),
    );
    setVentaConfiguraciones(
      (v.configuraciones || [])
        .filter((config) => config.estado_registro === "activo" || !config.estado_registro)
        .map((config) => ({ ...config })),
    );
    setVentaConfiguracionActiva(null);
    setVentaDescuentosFase1B(
      (v.descuentos || []).map((discount, index) => ({
        ...discount,
        valor: Number(discount.valor || 0),
        orden_aplicacion: index + 1,
        configuracion_refs: discount.configuracion_refs || [],
        linea_refs: discount.linea_refs || [],
      })),
    );
    setVentaPreviewFase1B(v.origen_catalogo === "fase1b" ? {
      subtotal: Number(v.subtotal || 0),
      descuento_total: Number(v.descuento_monto || 0),
      total: Number(v.monto_total || 0),
      descuentos: (v.descuentos || []).map((discount) => ({
        descuento_ref: discount.descuento_ref,
        base_elegible: Number(discount.base_elegible || 0),
        monto_aplicado: Number(discount.monto_aplicado || 0),
      })),
    } : null);
    setQPacienteVenta(v.paciente_nombre);
    setPacientesVentaOpciones((opciones) => (
      opciones.some((opcion) => opcion.id === v.paciente_id)
        ? opciones
        : [{ id: v.paciente_id, label: v.paciente_nombre }, ...opciones]
    ));
    const descuentoMontoGuardado = Number(v.descuento_monto || 0);
    setVentaDescuentoPorcentaje(Number(v.descuento_porcentaje || 0));
    setVentaDescuentoMontoFijo(descuentoMontoGuardado);
    const pagosEdicion = v.pagos && v.pagos.length > 0
      ? v.pagos
      : [{
          metodo: metodosPago[0] || "efectivo",
          monto: v.adelanto_aplica ? Number(v.adelanto_monto || 0) : Number(v.monto_total || 0),
        }];
    setVentaPagos(
      pagosEdicion.map((pago, index) => ({
        ...pago,
        ui_id: pago.pago_id ?? -(index + 1),
        monto: Number(pago.monto || 0),
      })),
    );
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
      descuento_monto: descuentoMontoGuardado,
      descuento_motivo: v.descuento_motivo ?? null,
      cupon_tipo: v.cupon_tipo ?? null,
      monto_total: Number(v.monto_total ?? 0),
      metodo_pago: v.metodo_pago ?? "efectivo",
      forma_liquidacion: v.forma_liquidacion ?? "pago_completo",
      plazo_meses: v.plazo_meses ?? null,
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
    setVentaEdicionOriginal(null);
    resetVentaWizard();
    setFormVenta({
      paciente_id: 0,
      sucursal_id: sucursalActivaId,
      compra: "",
      subtotal: 0,
      descuento_porcentaje: 0,
      descuento_monto: 0,
      descuento_motivo: null,
      cupon_tipo: null,
      monto_total: 0,
      metodo_pago: "efectivo",
      forma_liquidacion: "pago_completo",
      plazo_meses: null,
      adelanto_aplica: false,
      adelanto_monto: null,
      adelanto_metodo: null,
      como_nos_conocio: "",
      notas: "",
    });
    setQPacienteVenta("");
    setPacientesVentaOpciones(pacientesOpciones);
  }

  function completarEdicionVenta() {
    cancelEditVenta();
    setSuccessVentaMsg("Edición completada.");
    setTimeout(() => setSuccessVentaMsg(null), 3000);
  }

  function buildVentaFase1BPayload() {
    if (!formVenta.paciente_id) throw new Error("Selecciona un paciente.");
    if (ventaCarrito.length === 0 && ventaConfiguraciones.length === 0) {
      throw new Error("Agrega al menos un producto o una configuración óptica.");
    }
    ventaConfiguraciones.forEach((config, index) => {
      const design = inventario.find((item) => item.producto_id === config.diseno_producto_id);
      const treatment = inventario.find((item) => item.producto_id === config.tratamiento_producto_id);
      if (config.tipo_configuracion === "par_completo" && (!config.armazon_producto_id || !config.diseno_producto_id)) {
        throw new Error(`El par ${index + 1} requiere armazón y diseño.`);
      }
      if (config.tipo_configuracion === "solo_micas" && !config.diseno_producto_id) {
        throw new Error(`El par ${index + 1} requiere un diseño de micas.`);
      }
      if (config.tipo_configuracion === "solo_tratamiento" && !config.tratamiento_producto_id) {
        throw new Error(`El trabajo ${index + 1} requiere un tratamiento.`);
      }
      if ((treatment?.sku === "DEMO-TRT-BLUE" || treatment?.sku === "DEMO-TRT-TINT") && !config.variante_id) {
        throw new Error(`Selecciona la variante de ${treatment.nombre} en el par ${index + 1}.`);
      }
      const prescriptionOptional = config.tipo_configuracion === "solo_tratamiento"
        || design?.sku === "DEMO-LENS-NONRX"
        || config.uso_visual === "sin_graduacion";
      if (!prescriptionOptional && !config.prescripcion_id) {
        throw new Error(`Selecciona una receta del paciente para el par ${index + 1}.`);
      }
      if (config.uso_visual === "otro" && !config.uso_visual_otro?.trim()) {
        throw new Error(`Describe el uso visual del par ${index + 1}.`);
      }
    });
    const discounts = ventaDescuentosFase1B.map((discount, index) => {
      const value = Number(discount.valor || 0);
      if (!Number.isFinite(value) || value <= 0) throw new Error(`El descuento ${index + 1} requiere un valor mayor a cero.`);
      if (discount.tipo === "porcentaje" && value > 100) throw new Error(`El porcentaje del descuento ${index + 1} no puede superar 100%.`);
      if (discount.motivo === "otro" && !discount.motivo_otro?.trim()) throw new Error(`Describe el motivo del descuento ${index + 1}.`);
      if (discount.alcance === "configuracion" && discount.configuracion_refs.length === 0) throw new Error(`Selecciona al menos un par para el descuento ${index + 1}.`);
      if (discount.alcance === "linea" && discount.linea_refs.length === 0) throw new Error(`Selecciona al menos una línea para el descuento ${index + 1}.`);
      return { ...discount, valor: Number(value.toFixed(2)), orden_aplicacion: index + 1 };
    });
    const payments = ventaPagos
      .map((payment) => ({
        ...(payment.pago_id ? { pago_id: payment.pago_id } : {}),
        metodo: payment.metodo,
        monto: Number(Number(payment.monto || 0).toFixed(2)),
        referencia: payment.referencia || null,
      }))
      .filter((payment) => payment.monto > 0);
    return cleanPayload({
      paciente_id: formVenta.paciente_id,
      sucursal_id: sucursalActivaId,
      notas: formVenta.notas?.trim() || null,
      forma_liquidacion: formVenta.forma_liquidacion || "pago_completo",
      plazo_meses: formVenta.plazo_meses,
      estado_venta: editingVentaId !== null ? ventaSeguimientoDraft.estado_venta : "confirmada",
      productos_catalogo: ventaCarrito.map((item) => ({
        linea_ref: `producto-${item.producto_id}`,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
      })),
      configuraciones: ventaConfiguraciones,
      descuentos: discounts,
      pagos: payments,
    });
  }

  async function previewVentaFase1B() {
    setVentaPreviewLoading(true);
    setError(null);
    try {
      const payload = buildVentaFase1BPayload();
      const response = await apiFetch("/ventas/fase1b/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const preview = await response.json();
      setVentaPreviewFase1B(preview);
      return preview;
    } catch (reason: any) {
      setVentaPreviewFase1B(null);
      setError(reason?.message ?? String(reason));
      throw reason;
    } finally {
      setVentaPreviewLoading(false);
    }
  }

  async function onSubmitVenta(e: FormEvent) {
    e.preventDefault();
    if (!ventaSubmitConfirmadoRef.current) {
      try {
        if (editingVentaId === null || ventaEdicionOriginal?.origen_catalogo === "fase1b") {
          await previewVentaFase1B();
        }
        setVentaConfirmacionOpen(true);
      } catch {
        // La validación detallada queda visible en el formulario.
      }
      return;
    }
    ventaSubmitConfirmadoRef.current = false;
    setSavingVenta(true);
    setError(null);
    setSuccessVentaMsg(null);

    try {
      if (editingVentaId === null || ventaEdicionOriginal?.origen_catalogo === "fase1b") {
        const payload = buildVentaFase1BPayload();
        const endpoint = editingVentaId === null ? "/ventas/fase1b" : `/ventas/${editingVentaId}/fase1b`;
        const response = await apiFetch(endpoint, {
          method: editingVentaId === null ? "POST" : "PUT",
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const saved: Venta = await response.json();
        if (editingVentaId !== null) {
          setVentaEdicionOriginal(saved);
          setVentaConfiguraciones(saved.configuraciones || []);
          setVentaDescuentosFase1B(saved.descuentos || []);
          setVentaCarrito((saved.productos || []).filter((item) => !item.configuracion_ref && item.estado_registro !== "cancelado").map((item) => ({ producto_id: item.producto_id, cantidad: item.cantidad - Number(item.cantidad_cancelada || 0) })));
          setVentaPreviewFase1B({
            subtotal: Number(saved.subtotal || 0), descuento_total: Number(saved.descuento_monto || 0),
            total: Number(saved.monto_total || 0), descuentos: (saved.descuentos || []).map((discount) => ({ descuento_ref: discount.descuento_ref, base_elegible: Number(discount.base_elegible || 0), monto_aplicado: Number(discount.monto_aplicado || 0) })),
          });
          setSuccessVentaMsg("Cambios guardados. La venta permanece abierta para más ediciones.");
        } else {
          resetVentaWizard();
          setFormVenta((prev) => ({ ...prev, compra: "", subtotal: 0, monto_total: 0, notas: "", descuento_porcentaje: 0, descuento_monto: 0, descuento_motivo: null, cupon_tipo: null }));
          setSuccessVentaMsg("Venta guardada con el catálogo global.");
        }
        await Promise.all([loadInventario(), loadVentasResumen()]);
        setTimeout(() => setSuccessVentaMsg(null), 3500);
        return;
      }
      if (!formVenta.paciente_id || formVenta.paciente_id === 0) throw new Error("Selecciona un paciente.");
      const carritoDetalle = ventaCarrito
        .map((item) => {
          const producto = inventario.find((row) => row.producto_id === item.producto_id);
          return producto ? { ...item, producto } : null;
        })
        .filter((item): item is VentaCarritoItem & { producto: InventarioProducto } => Boolean(item));
      if (me?.rol === "admin" && carritoDetalle.length === 0) {
        throw new Error("Agrega al menos un producto al carrito.");
      }
      if (me?.rol === "admin") {
        carritoDetalle.forEach(({ producto, cantidad }) => {
          const cantidadOriginal = editingVentaId === null
            ? 0
            : Number(
                ventaEdicionOriginal?.productos?.find(
                  (item) => item.producto_id === producto.producto_id,
                )?.cantidad || 0,
              );
          const disponible = producto.stock + cantidadOriginal;
          if (producto.controla_stock && cantidad > disponible) {
            throw new Error(`Solo hay ${disponible} unidades disponibles de ${producto.nombre} para esta edición.`);
          }
        });
      }
      const tieneArmazonOptico = carritoDetalle.some(
        ({ producto }) => producto.categoria === "lentes_opticos" && producto.subcategoria === "armazon",
      );
      if (me?.rol === "admin" && tieneArmazonOptico) {
        const tieneDiseno = carritoDetalle.some(({ producto }) => producto.categoria === "micas" && producto.subcategoria === "diseno");
        const tieneTratamiento = carritoDetalle.some(({ producto }) => producto.categoria === "micas" && producto.subcategoria === "tratamiento");
        if (!tieneDiseno || !tieneTratamiento) {
          throw new Error("Completa la selección de micas: diseño y tratamiento.");
        }
      }
      const tieneTinte = carritoDetalle.some(({ producto }) => producto.tipo_mica === "tinte")
        || ventasSeleccionadas.includes("micas_tinte");
      if (me?.rol === "admin" && tieneTinte && !ventaTinteGrado) {
        throw new Error("Selecciona el grado del tinte.");
      }

      const compraTokensBase = me?.rol === "admin"
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
      const subtotalVenta = me?.rol === "admin"
        ? subtotalCarrito
        : Number(formVenta.subtotal || formVenta.monto_total || 0);
      const descuentoPorcentaje = me?.rol === "admin"
        ? ventaDescuentoPorcentaje
        : Number(formVenta.descuento_porcentaje || 0);
      const descuentoMontoFijo = me?.rol === "admin"
        ? ventaDescuentoMontoFijo
        : Number(formVenta.descuento_monto || 0);
      const descuentoActivo = descuentoPorcentaje > 0 || descuentoMontoFijo > 0;
      if (descuentoPorcentaje > 0 && descuentoMontoFijo > 0) {
        throw new Error("Selecciona descuento por porcentaje o por monto, no ambos.");
      }
      if (descuentoMontoFijo > subtotalVenta) {
        throw new Error("El descuento en pesos no puede ser mayor al subtotal.");
      }
      if (descuentoActivo && !formVenta.descuento_motivo) {
        throw new Error("Selecciona el motivo del descuento.");
      }
      if (descuentoActivo && !formVenta.cupon_tipo) {
        throw new Error("Selecciona el tipo de cupón.");
      }
      const descuentoCalculado = descuentoMontoFijo > 0
        ? descuentoMontoFijo
        : subtotalVenta * descuentoPorcentaje / 100;
      const montoTotal = Number(Math.max(0, subtotalVenta - descuentoCalculado).toFixed(2));
      if (subtotalVenta <= 0) throw new Error("El carrito debe tener un subtotal mayor a 0.");
      const pagosPayload = ventaPagos
        .map((pago) => ({
          ...(pago.pago_id ? { pago_id: pago.pago_id } : {}),
          metodo: pago.metodo,
          monto: Number(Number(pago.monto || 0).toFixed(2)),
          referencia: pago.referencia || null,
        }))
        .filter((pago) => pago.monto > 0);
      if (editingVentaId === null && pagosPayload.length === 0) {
        throw new Error("Registra al menos un pago o adelanto.");
      }
      const montoPagado = Number(
        pagosPayload.reduce((total, pago) => total + pago.monto, 0).toFixed(2),
      );
      if (montoPagado > montoTotal) {
        throw new Error("La suma de los pagos no puede ser mayor al total.");
      }
      const metodosPago = Array.from(new Set(pagosPayload.map((pago) => pago.metodo)));
      const pagoCompleto = Math.abs(montoPagado - montoTotal) < 0.01;
      const planFinanciamiento = ["meses_sin_intereses", "meses_con_intereses"].includes(
        formVenta.forma_liquidacion || "",
      )
        ? formVenta.forma_liquidacion
        : null;
      if (
        planFinanciamiento
        && ![3, 6, 9, 12, 18, 24].includes(Number(formVenta.plazo_meses || 0))
      ) {
        throw new Error("Selecciona el plazo del financiamiento.");
      }
      const formaLiquidacion: VentaFormaLiquidacion = editingVentaId !== null
        ? (formVenta.forma_liquidacion ?? "pago_completo")
        : planFinanciamiento
          ? planFinanciamiento
          : pagoCompleto
            ? (metodosPago.length > 1 ? "pago_mixto" : "pago_completo")
            : "adelanto_apartado";
      const requiereAdelanto = !pagoCompleto && montoPagado > 0;

      const payload = cleanPayload({
        ...formVenta,
        sucursal_id: sucursalActivaId,
        compra: compraTokens.join("|"),
        subtotal: subtotalVenta,
        descuento_porcentaje: descuentoPorcentaje,
        descuento_monto: descuentoMontoFijo,
        monto_total: montoTotal,
        metodo_pago: metodosPago.join("|") || "efectivo",
        forma_liquidacion: formaLiquidacion,
        adelanto_aplica: requiereAdelanto,
        adelanto_monto: requiereAdelanto ? montoPagado : null,
        adelanto_metodo: requiereAdelanto && metodosPago.length === 1
          ? metodosPago[0]
          : null,
        ...(me?.rol === "admin"
          ? {
              productos: ventaCarrito,
            }
          : {}),
        pagos: pagosPayload,
        ...(editingVentaId !== null
          ? {
              estado_venta: ventaSeguimientoDraft.estado_venta,
              estado_pago: ventaSeguimientoDraft.estado_pago,
              estado_pedido: ventaSeguimientoDraft.estado_pedido,
            }
          : {}),
      });

      const endpoint = editingVentaId === null
        ? "/ventas"
        : me?.rol === "admin"
          ? `/ventas/${editingVentaId}/edicion-completa`
          : `/ventas/${editingVentaId}`;
      const method = editingVentaId === null ? "POST" : "PUT";
      const r = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await readErrorMessage(r));
      if (editingVentaId !== null) {
        const actualizado = await r.json();
        const pacienteNombre = pacientesVentaOpciones.find(
          (paciente) => paciente.id === formVenta.paciente_id,
        )?.label || ventaEdicionOriginal?.paciente_nombre || `Paciente #${formVenta.paciente_id}`;
        const ventaActualizada: Venta = {
          ...(ventaEdicionOriginal as Venta),
          ...actualizado,
          paciente_id: formVenta.paciente_id,
          paciente_nombre: pacienteNombre,
          compra: compraTokens.join("|"),
          descuento_motivo: formVenta.descuento_motivo,
          cupon_tipo: formVenta.cupon_tipo,
          plazo_meses: formVenta.plazo_meses,
          productos: actualizado.productos || [],
          pagos: actualizado.pagos || [],
        };
        const pagosActualizados: VentaPagoDraft[] = (actualizado.pagos || []).map(
          (pago: VentaPago, index: number) => ({
            ...pago,
            ui_id: pago.pago_id ?? -(index + 1),
            monto: Number(pago.monto || 0),
          }),
        );
        setVentaEdicionOriginal(ventaActualizada);
        setVentaPagos(
          pagosActualizados.length > 0
            ? pagosActualizados
            : [{ ui_id: ++ventaPagoSeqRef.current, metodo: "efectivo", monto: "" }],
        );
        setFormVenta((prev) => ({
          ...prev,
          subtotal: Number(actualizado.subtotal || 0),
          monto_total: Number(actualizado.monto_total || 0),
          metodo_pago: actualizado.metodo_pago || "efectivo",
          forma_liquidacion: actualizado.forma_liquidacion || prev.forma_liquidacion,
          adelanto_aplica: Number(actualizado.monto_pagado || 0) > 0 && Number(actualizado.saldo_pendiente || 0) > 0,
          adelanto_monto: Number(actualizado.monto_pagado || 0) || null,
        }));
        setVentaSeguimientoDraft((prev) => ({
          ...prev,
          estado_venta: actualizado.estado_venta,
          estado_pago: actualizado.estado_pago,
          estado_pedido: actualizado.estado_pedido,
        }));
        setVentasResumen((prev) => prev.map((venta) => venta.venta_id === editingVentaId ? ventaActualizada : venta));
        setPerfilVentas((prev) => prev.map((venta) => venta.venta_id === editingVentaId ? ventaActualizada : venta));
        setSuccessVentaMsg("Cambios guardados. Puedes continuar editando esta venta.");
        setTimeout(() => setSuccessVentaMsg(null), 3500);
        loadInventario();
        loadVentasResumen();
        return;
      }

      setFormVenta((prev) => ({
        ...prev,
        compra: "",
        subtotal: 0,
        descuento_porcentaje: 0,
        descuento_monto: 0,
        descuento_motivo: null,
        cupon_tipo: null,
        monto_total: 0,
        metodo_pago: "efectivo",
        forma_liquidacion: "pago_completo",
        plazo_meses: null,
        adelanto_aplica: false,
        adelanto_monto: null,
        adelanto_metodo: null,
        como_nos_conocio: "",
        notas: "",
      }));
      resetVentaWizard();
      setEditingVentaId(null);
      setVentaEdicionOriginal(null);
      if (me?.rol === "admin") {
        loadInventario();
      }
      setTab("ventas");
      setSuccessVentaMsg("Venta guardada con éxito.");
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
    setLogoutConfirmOpen(false);
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
  const isContador = me.rol === "contador";
  const sessionUser = String(me.username || "").trim().toLowerCase();
  const hideVentasTabUsers = new Set(["edomex_doc", "playa_doc"]);
  const hideVentasMetodoPieUsers = new Set(["edomex_doc", "playa_doc"]);
  const hideVentasPeriodoKpiUsers = new Set(["edomex_doc", "playa_doc"]);
  const hideMoneyMonthlyChartUsers = new Set(["edomex_doc", "playa_doc", "playa_recep", "edomex_recep"]);
  const hideTopPacientesUsers = new Set(["edomex_doc", "playa_doc"]);
  const canViewVentasTab = !isContador && !hideVentasTabUsers.has(sessionUser);
  const canViewResumenVentas = canViewVentasTab || isContador;
  const canViewVentasMetodoPie = !hideVentasMetodoPieUsers.has(sessionUser);
  const canViewVentasPeriodoKpi = !hideVentasPeriodoKpiUsers.has(sessionUser);
  const canViewMoneyMonthlyChart = !hideMoneyMonthlyChartUsers.has(sessionUser);
  const canViewTopPacientesMes = !hideTopPacientesUsers.has(sessionUser);
  const canViewVentasCantidadMensualChart = isAdmin || isRecep;
  const canViewHistoriaTab = !isContador && (isAdmin || isDoctor);

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
  const ventaMicasDisenos = productosPor("micas", "diseno");
  const ventaMicasTratamientos = productosPor("micas", "tratamiento");
  const ventaTratamientoAntirreflejante = ventaMicasTratamientos.find((producto) => producto.sku === "DEMO-TRT-AR");
  const ventaTratamientoFotocromatico = ventaMicasTratamientos.find((producto) => producto.sku === "DEMO-TRT-PHOTO");
  const ventaTratamientoAntiblue = ventaMicasTratamientos.find((producto) => producto.sku === "DEMO-TRT-BLUE");
  const ventaTratamientoTinte = ventaMicasTratamientos.find((producto) => producto.sku === "DEMO-TRT-TINT");
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
  const ventaCantidadOriginalPorProducto = new Map(
    (ventaEdicionOriginal?.productos || []).map((producto) => [producto.producto_id, Number(producto.cantidad || 0)]),
  );
  const ventaArmazonesSeleccionados = ventaArmazonesOpticos.filter((producto) => ventaCarritoIds.has(producto.producto_id));
  const ventaSubtotalCarrito = ventaCarritoDetalle.reduce(
    (total, item) => total + Number(item.producto.precio || 0) * item.cantidad,
    0,
  );
  const ventaSubtotalConfiguraciones = ventaConfiguraciones.reduce((total, config) => {
    const frame = inventario.find((item) => item.producto_id === config.armazon_producto_id);
    const design = inventario.find((item) => item.producto_id === config.diseno_producto_id);
    const treatment = inventario.find((item) => item.producto_id === config.tratamiento_producto_id);
    const variant = treatment?.variantes?.find((item) => item.variante_id === config.variante_id);
    const treatmentPrice = variant?.precio_ajuste_override ?? treatment?.precio ?? 0;
    return total + Number(frame?.precio || 0) + Number(design?.precio || 0) + Number(treatmentPrice || 0);
  }, 0);
  const ventaSubtotalResumen = ventaSubtotalCarrito + ventaSubtotalConfiguraciones;
  const ventaDescuentoMonto = Number(ventaPreviewFase1B?.descuento_total || 0);
  const ventaTotalCarrito = Number((ventaPreviewFase1B?.total ?? ventaSubtotalResumen).toFixed(2));
  const ventaMontoPagado = Number(
    ventaPagos.reduce((total, pago) => total + Math.max(0, Number(pago.monto || 0)), 0).toFixed(2),
  );
  const ventaSaldo = Math.max(0, Number((ventaTotalCarrito - ventaMontoPagado).toFixed(2)));
  const ventaEstadoPago = ventaMontoPagado <= 0
    ? "Pendiente"
    : ventaSaldo > 0
      ? "Pago parcial"
      : "Pagado";
  const ventaDetallePagoNuevo = Math.max(0, Number(ventaNuevoPagoMonto || 0));
  const ventaDetalleMontoPagadoPreview = Number(
    (Number(selectedVentaDetalle?.monto_pagado || 0) + ventaDetallePagoNuevo).toFixed(2),
  );
  const ventaDetalleSaldoPreview = Math.max(
    0,
    Number((Number(selectedVentaDetalle?.monto_total || 0) - ventaDetalleMontoPagadoPreview).toFixed(2)),
  );
  const ventaDetalleEstadoPagoPreview = selectedVentaDetalle
    ? ventaDetallePagoNuevo > 0
      ? deriveVentaEstadoPago(
          Number(selectedVentaDetalle.monto_total || 0),
          ventaDetalleMontoPagadoPreview,
          (selectedVentaDetalle.pagos?.length || 0) + 1,
        )
      : ventaSeguimientoDraft.estado_pago
    : "sin_pago";
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
  const inventarioGrupoKey = (producto: InventarioProducto) =>
    producto.categoria === "lentes_opticos" && producto.subcategoria === "clip_on"
      ? "clip_on"
      : producto.categoria;
  const inventarioGrupoLabel = (grupo: string) =>
    grupo === "clip_on" ? "Clip-on" : formatVentaCompraLabel(grupo);
  const inventarioGrupoKeys = Array.from(
    new Set(inventarioVisible.map(inventarioGrupoKey)),
  );
  const inventarioGrupos = inventarioGrupoKeys
    .map((categoria) => ({
      categoria,
      productos: inventarioFiltrado.filter((producto) => inventarioGrupoKey(producto) === categoria),
    }))
    .filter((grupo) => grupo.productos.length > 0);
  const inventarioControladoFiltrado = inventarioFiltrado.filter((producto) => producto.controla_stock);
  const inventarioAnalisisTotalUnidades = inventarioControladoFiltrado.reduce(
    (total, producto) => total + Number(producto.stock || 0),
    0,
  );
  const inventarioAnalisisAgotados = inventarioControladoFiltrado.filter((producto) => producto.stock <= 0);
  const inventarioAnalisisBajos = inventarioControladoFiltrado.filter(
    (producto) => producto.stock > 0 && producto.stock <= producto.stock_minimo,
  );
  const inventarioAnalisisSaludables = inventarioControladoFiltrado.filter(
    (producto) => producto.stock > producto.stock_minimo,
  );
  const inventarioAnalisisValor = inventarioControladoFiltrado.reduce(
    (total, producto) => total + Number(producto.costo_unitario || 0) * Number(producto.stock || 0),
    0,
  );
  const inventarioAnalisisPorCategoria = Array.from(
    inventarioControladoFiltrado.reduce((grupos, producto) => {
      const actual = grupos.get(producto.categoria) || { categoria: producto.categoria, productos: 0, unidades: 0, valor: 0 };
      actual.productos += 1;
      actual.unidades += Number(producto.stock || 0);
      actual.valor += Number(producto.costo_unitario || 0) * Number(producto.stock || 0);
      grupos.set(producto.categoria, actual);
      return grupos;
    }, new Map<string, { categoria: string; productos: number; unidades: number; valor: number }>()),
  ).map(([, item]) => item).sort((a, b) => b.unidades - a.unidades);
  const inventarioAnalisisTopStock = [...inventarioControladoFiltrado]
    .sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))
    .slice(0, 10);

  const renderVentaProductoButton = (
    producto: InventarioProducto,
    onClick: () => void,
    selected = ventaCarritoIds.has(producto.producto_id),
  ) => {
    const disponibleEdicion = producto.stock + (editingVentaId !== null
      ? Number(ventaCantidadOriginalPorProducto.get(producto.producto_id) || 0)
      : 0);
    const agotado = producto.controla_stock && disponibleEdicion <= 0;
    const esMica = producto.categoria === "micas";
    return (
      <button
        key={producto.producto_id}
        type="button"
        disabled={agotado}
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
          cursor: agotado ? "not-allowed" : "pointer",
          opacity: agotado ? 0.62 : 1,
          boxShadow: selected ? "0 8px 20px rgba(37,99,235,.12)" : "none",
        }}
      >
        {!esMica && (
          <span style={{ width: 82, height: 82, overflow: "hidden", background: "#f5f7f9", border: "1px solid #e2e8ee" }}>
            {producto.imagen_url ? (
              <img
                src={resolveCatalogMediaUrl(producto.imagen_url)}
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
                ? (agotado ? "AGOTADO" : `${disponibleEdicion} DISPONIBLE${editingVentaId !== null ? " PARA EDITAR" : ""}`)
                : "SERVICIO / ADICIONAL"}
            </span>
          )}
        </span>
      </button>
    );
  };

  const renderVentaPagoLiquidacion = () => (
    <section style={{ display: "grid", gap: 11, marginTop: 12, padding: 12, border: "1px solid #cbdcf0", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, color: "#16385d" }}>Pagos y adelantos</div>
          <div style={{ marginTop: 2, color: "#718397", fontSize: 11 }}>
            El total de la venta ya está en el resumen. Aquí registra cuánto pagó con cada método.
          </div>
        </div>
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: ventaMontoPagado > ventaTotalCarrito ? "#fee2e2" : ventaSaldo > 0 ? "#fff1d6" : "#dcfce7",
            color: ventaMontoPagado > ventaTotalCarrito ? "#991b1b" : ventaSaldo > 0 ? "#92400e" : "#166534",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {ventaMontoPagado > ventaTotalCarrito ? "Importe excedido" : ventaEstadoPago}
        </span>
      </div>

      {editingVentaId !== null && (
        <div style={{ padding: 9, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", fontSize: 11, fontWeight: 750 }}>
          Puedes corregir pagos anteriores, eliminarlos o agregar nuevos. La fecha original se conserva en los pagos existentes.
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {ventaPagos.map((pago, index) => (
          <div
            key={pago.ui_id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(170px, 1fr) minmax(170px, .8fr) 32px",
              gap: 7,
              alignItems: "end",
              padding: 9,
              border: "1px solid #dbe6ef",
              background: "#f8fbff",
            }}
          >
            <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
              MÉTODO
              <select
                value={pago.metodo}
                onChange={(e) => setVentaPagos((prev) => prev.map((item) => item.ui_id === pago.ui_id ? { ...item, metodo: e.target.value as VentaMetodoPago } : item))}
                style={{ width: "100%", padding: 8, border: "1px solid #b9cce0", background: "#fff" }}
              >
                {VENTA_METODO_PAGO_OPTIONS.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
              MONTO PAGADO CON ESTE MÉTODO
              <input
                type="text"
                inputMode="decimal"
                value={String(pago.monto ?? "")}
                onChange={(e) => {
                  const siguiente = e.target.value.replace(",", ".");
                  if (siguiente === "" || /^\d+(?:\.\d{0,2})?$/.test(siguiente)) {
                    setVentaPagos((prev) => prev.map((item) =>
                      item.ui_id === pago.ui_id ? { ...item, monto: siguiente } : item
                    ));
                  }
                }}
                placeholder=""
                style={{ width: "100%", padding: 8, border: "1px solid #8cb4df", textAlign: "right", fontWeight: 900 }}
              />
              {editingVentaId !== null && pago.pago_id && (
                <span style={{ color: "#718397", fontSize: 9, fontWeight: 650 }}>
                  Registrado: {pago.fecha_hora ? formatDateTimePretty(pago.fecha_hora) : "fecha no disponible"}
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setVentaPagos((prev) => {
                const restantes = prev.filter((item) => item.ui_id !== pago.ui_id);
                return restantes.length > 0
                  ? restantes
                  : [{ ui_id: ++ventaPagoSeqRef.current, metodo: "efectivo", monto: "" }];
              })}
              aria-label={`Eliminar pago ${index + 1}`}
              title="Eliminar pago"
              style={{
                width: 32,
                height: 34,
                border: "1px solid #fecaca",
                background: "#fff5f5",
                color: "#b91c1c",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {editingVentaId !== null && (
        <div style={{ display: "grid", gap: 10, padding: 11, border: "1px solid #a7c7e7", background: "#f8fbff" }}>
          <div style={{ fontWeight: 900, color: "#173b61" }}>Editar seguimiento de la venta</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
              ESTADO DE LA VENTA
              <select
                value={ventaSeguimientoDraft.estado_venta}
                onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, estado_venta: e.target.value as VentaEstado }))}
                style={{ width: "100%", padding: 8, border: "1px solid #b9cce0", background: "#fff" }}
              >
                {VENTA_ESTADO_OPTIONS.map((opcion) => (
                  <option key={`edicion-venta-${opcion.value}`} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
              ESTADO DEL PAGO
              <select
                value={ventaSeguimientoDraft.estado_pago}
                onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, estado_pago: e.target.value as VentaEstadoPago }))}
                style={{ width: "100%", padding: 8, border: "1px solid #b9cce0", background: "#fff" }}
              >
                {VENTA_ESTADO_PAGO_OPTIONS.map((opcion) => (
                  <option key={`edicion-pago-${opcion.value}`} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
              PEDIDO / ENTREGA
              <select
                value={ventaSeguimientoDraft.estado_pedido}
                onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, estado_pedido: e.target.value as VentaEstadoPedido }))}
                style={{ width: "100%", padding: 8, border: "1px solid #b9cce0", background: "#fff" }}
              >
                {VENTA_ESTADO_PEDIDO_OPTIONS.map((opcion) => (
                  <option key={`edicion-pedido-${opcion.value}`} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ color: "#718397", fontSize: 10 }}>
            El estado del pago se recalcula automáticamente con los importes guardados.
          </div>
        </div>
      )}

      <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                ventaPagoSeqRef.current += 1;
                const usados = new Set(ventaPagos.map((pago) => pago.metodo));
                const siguiente = VENTA_METODO_PAGO_OPTIONS.find((opcion) => !usados.has(opcion.value))?.value || "efectivo";
                setVentaPagos((prev) => [...prev, { ui_id: ventaPagoSeqRef.current, metodo: siguiente, monto: "" }]);
              }}
              style={{ ...actionBtnStyle, padding: "7px 10px", borderColor: "#8fb1d5", color: "#174ea6" }}
            >
              + Agregar otro pago
            </button>
          </div>
          <label style={{ display: "grid", gap: 4, maxWidth: 270, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
            PLAN DE FINANCIAMIENTO (OPCIONAL)
            <select
              value={
                ["meses_sin_intereses", "meses_con_intereses"].includes(formVenta.forma_liquidacion || "")
                  ? formVenta.forma_liquidacion
                  : ""
              }
              onChange={(e) => setFormVenta((prev) => ({
                ...prev,
                forma_liquidacion: (e.target.value || "pago_completo") as VentaFormaLiquidacion,
                plazo_meses: null,
              }))}
              style={{ width: "100%", padding: 8, border: "1px solid #b9cce0", background: "#fff" }}
            >
              <option value="">Sin plan especial</option>
              {VENTA_PLAN_FINANCIAMIENTO_OPTIONS.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </label>
          {["meses_sin_intereses", "meses_con_intereses"].includes(formVenta.forma_liquidacion || "") && (
            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "#40566c", fontSize: 10, fontWeight: 850 }}>
                PLAZO *
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(58px, 1fr))", gap: 6 }}>
                {[3, 6, 9, 12, 18, 24].map((meses) => {
                  const activo = formVenta.plazo_meses === meses;
                  return (
                    <button
                      key={meses}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => setFormVenta((prev) => ({ ...prev, plazo_meses: meses }))}
                      style={{
                        padding: "8px 6px",
                        border: activo ? "1px solid #1565c0" : "1px solid #cbd8e4",
                        background: activo ? "#1565c0" : "#fff",
                        color: activo ? "#fff" : "#40566c",
                        fontWeight: 850,
                        cursor: "pointer",
                      }}
                    >
                      {meses} meses
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", border: "1px solid #dbe6ef" }}>
        <div style={{ padding: 9, background: "#eff6ff" }}>
          <div style={{ color: "#52708e", fontSize: 10, fontWeight: 850 }}>PAGADO</div>
          <strong style={{ color: "#174ea6" }}>${ventaMontoPagado.toFixed(2)}</strong>
        </div>
        <div style={{ padding: 9, background: ventaSaldo > 0 ? "#fff7ed" : "#f0fdf4" }}>
          <div style={{ color: ventaSaldo > 0 ? "#9a4c0e" : "#166534", fontSize: 10, fontWeight: 850 }}>SALDO POR PAGAR</div>
          <strong style={{ color: ventaSaldo > 0 ? "#c2410c" : "#166534" }}>${ventaSaldo.toFixed(2)}</strong>
        </div>
      </div>
      <div style={{ color: "#718397", fontSize: 10 }}>
        “Saldo por pagar” es la cantidad que el cliente todavía debe.
      </div>
    </section>
  );

  const renderVentaResumenProductos = () => (
    <section style={{ position: "sticky", top: 12, padding: 14, border: "1px solid #b8d3ec", background: "#f8fbff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 900, color: "#16385d" }}>Resumen de productos</div>
          <div style={{ fontSize: 12, color: "#6b7f93" }}>{ventaCarritoDetalle.length} producto(s) y {ventaConfiguraciones.length} par(es) configurado(s)</div>
        </div>
        {(ventaCarritoDetalle.length > 0 || ventaConfiguraciones.length > 0) && (
          <button
            type="button"
            onClick={() => { setVentaCarrito([]); setVentaConfiguraciones([]); setVentaPreviewFase1B(null); }}
            style={{ ...actionBtnStyle, padding: "7px 10px" }}
          >
            Vaciar carrito
          </button>
        )}
      </div>

      {ventaConfiguraciones.map((config, index) => {
        const frame = inventario.find((item) => item.producto_id === config.armazon_producto_id);
        const design = inventario.find((item) => item.producto_id === config.diseno_producto_id);
        const treatment = inventario.find((item) => item.producto_id === config.tratamiento_producto_id);
        const variant = treatment?.variantes?.find((item) => item.variante_id === config.variante_id);
        return <div key={config.configuracion_ref} style={{ display: "grid", gap: 4, marginBottom: 8, padding: 10, border: "1px solid #dbe6ef", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#174ea6" }}>Par {index + 1}</strong><button type="button" onClick={() => { setVentaCategoria("lentes_opticos"); setVentaConfiguracionActiva(config.configuracion_ref); }} style={{ ...actionBtnStyle, padding: "4px 8px" }}>Editar</button></div>
          <div style={{ fontSize: 12 }}><span style={{ color: "#718397" }}>Tipo:</span> {config.tipo_configuracion.replaceAll("_", " ")}</div>
          <div style={{ fontSize: 12 }}><span style={{ color: "#718397" }}>Armazón:</span> {frame?.nombre || "Armazón del cliente"}</div>
          <div style={{ fontSize: 12 }}><span style={{ color: "#718397" }}>Diseño:</span> {design?.nombre || "No aplica"}</div>
          <div style={{ fontSize: 12 }}><span style={{ color: "#718397" }}>Tratamiento:</span> {treatment ? `${treatment.nombre}${variant ? ` · ${variant.nombre}` : ""}` : "Sin tratamiento"}</div>
          <div style={{ fontSize: 12 }}><span style={{ color: "#718397" }}>Uso:</span> {config.uso_visual.replaceAll("_", " ")} · <span style={{ color: "#718397" }}>Abasto:</span> {config.comportamiento_abasto_usado.replaceAll("_", " ")}</div>
        </div>;
      })}

      {ventaCarritoDetalle.length === 0 && ventaConfiguraciones.length === 0 ? (
        <div style={{ padding: 18, border: "1px dashed #b9cde0", background: "#fff", color: "#6b7f93", textAlign: "center" }}>
          Selecciona productos del catálogo para comenzar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 7 }}>
          {ventaCarritoDetalle.map(({ producto, cantidad }) => {
            const esMica = producto.categoria === "micas";
            const detalleTinte = producto.tipo_mica === "tinte" && ventaTinteGrado
              ? ventaTinteGrado.replace("_", " ")
              : null;
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
                      <img src={resolveCatalogMediaUrl(producto.imagen_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8aa0b2" }}>◇</span>
                    )}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", color: "#173b61", lineHeight: 1.2 }}>{producto.nombre}</strong>
                  <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "#6b7f93" }}>{producto.sku}</span>
                  {detalleTinte && (
                    <span style={{ display: "inline-block", marginTop: 4, padding: "3px 7px", border: "1px solid #d8b98f", background: "#fff8ed", color: "#784718", fontSize: 10, fontWeight: 900, textTransform: "capitalize" }}>
                      {detalleTinte}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  max={producto.controla_stock
                    ? producto.stock + Number(ventaCantidadOriginalPorProducto.get(producto.producto_id) || 0)
                    : 99}
                  value={cantidad}
                  disabled={esMica && ventaArmazonesSeleccionados.length > 0}
                  onChange={(e) => actualizarCantidadCarrito(producto, Number(e.target.value))}
                  aria-label={`Cantidad de ${producto.nombre}`}
                  title={esMica && ventaArmazonesSeleccionados.length > 0 ? "La cantidad se sincroniza con los armazones." : undefined}
                  style={{ width: "100%", padding: 7, border: "1px solid #b9cce0", background: esMica && ventaArmazonesSeleccionados.length > 0 ? "#eef2f6" : "#fff" }}
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

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div><strong style={{ color: "#173b61" }}>Descuentos acumulados</strong><div style={{ color: "#718397", fontSize: 11 }}>Se aplican exactamente en el orden mostrado.</div></div>
          <button type="button" onClick={agregarDescuentoFase1B} disabled={!isAdmin && ventaDescuentosFase1B.length >= 1} style={actionBtnStyle}>+ Agregar descuento</button>
        </div>
        {ventaDescuentosFase1B.map((discount, index) => {
          const preview = ventaPreviewFase1B?.descuentos.find((item) => item.descuento_ref === discount.descuento_ref);
          const lineOptions = [
            ...ventaCarritoDetalle.map(({ producto }) => ({ value: `producto-${producto.producto_id}`, label: producto.nombre })),
            ...ventaConfiguraciones.flatMap((config, configIndex) => {
              const options: Array<{ value: string; label: string }> = [];
              if (config.armazon_producto_id) options.push({ value: `${config.configuracion_ref}:armazon`, label: `Par ${configIndex + 1}: armazón` });
              if (config.diseno_producto_id) options.push({ value: `${config.configuracion_ref}:diseno`, label: `Par ${configIndex + 1}: diseño` });
              if (config.tratamiento_producto_id) options.push({ value: `${config.configuracion_ref}:tratamiento`, label: `Par ${configIndex + 1}: tratamiento` });
              return options;
            }),
          ];
          return <div key={discount.descuento_ref} style={{ padding: 10, border: "1px solid #cbd8e4", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <strong>#{index + 1} en el orden de aplicación</strong>
              <span style={{ display: "flex", gap: 5 }}>
                {isAdmin && <><button type="button" disabled={index === 0} onClick={() => moverDescuentoFase1B(discount.descuento_ref, -1)} style={{ ...actionBtnStyle, padding: "4px 8px" }}>↑</button><button type="button" disabled={index === ventaDescuentosFase1B.length - 1} onClick={() => moverDescuentoFase1B(discount.descuento_ref, 1)} style={{ ...actionBtnStyle, padding: "4px 8px" }}>↓</button></>}
                <button type="button" onClick={() => { setVentaDescuentosFase1B((prev) => prev.filter((item) => item.descuento_ref !== discount.descuento_ref).map((item, position) => ({ ...item, orden_aplicacion: position + 1 }))); setVentaPreviewFase1B(null); }} style={{ ...actionBtnStyle, padding: "4px 8px", color: "#991b1b" }}>Quitar</button>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Tipo<select value={discount.tipo} onChange={(event) => actualizarDescuentoFase1B(discount.descuento_ref, { tipo: event.target.value as VentaDescuentoFase1B["tipo"], valor: "" })} style={{ padding: 8, border: "1px solid #b9cce0", background: "#fff" }}><option value="porcentaje">Porcentaje (%)</option><option value="monto_fijo">Monto fijo (MXN)</option></select></label>
              <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Valor<input inputMode="decimal" value={discount.valor} onChange={(event) => { const value = event.target.value.replace(",", "."); if (value !== "" && !/^\d+(?:\.\d{0,2})?$/.test(value)) return; if (discount.tipo === "porcentaje" && Number(value || 0) > 100) return; actualizarDescuentoFase1B(discount.descuento_ref, { valor: value }); }} style={{ padding: 8, border: "1px solid #b9cce0" }} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Motivo<select value={discount.motivo} onChange={(event) => actualizarDescuentoFase1B(discount.descuento_ref, { motivo: event.target.value })} style={{ padding: 8, border: "1px solid #b9cce0", background: "#fff" }}>{VENTA_DESCUENTO_MOTIVO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="cliente_frecuente">Cliente frecuente</option><option value="otro">Otro</option></select></label>
              <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Cupón<select value={discount.cupon_tipo} onChange={(event) => actualizarDescuentoFase1B(discount.descuento_ref, { cupon_tipo: event.target.value as VentaDescuentoFase1B["cupon_tipo"] })} style={{ padding: 8, border: "1px solid #b9cce0", background: "#fff" }}><option value="online">Cupón online</option><option value="fisico">Cupón físico</option><option value="sin_cupon">Sin cupón</option></select></label>
              <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Aplicar a<select value={discount.alcance} onChange={(event) => actualizarDescuentoFase1B(discount.descuento_ref, { alcance: event.target.value as VentaDescuentoFase1B["alcance"], configuracion_refs: [], linea_refs: [] })} style={{ padding: 8, border: "1px solid #b9cce0", background: "#fff" }}><option value="venta">Toda la venta</option><option value="configuracion">Uno o varios pares</option><option value="linea">Líneas específicas</option></select></label>
            </div>
            {discount.motivo === "otro" && <input value={discount.motivo_otro || ""} onChange={(event) => actualizarDescuentoFase1B(discount.descuento_ref, { motivo_otro: event.target.value })} placeholder="Describe el motivo" style={{ width: "100%", marginTop: 8, padding: 8, border: "1px solid #b9cce0" }} />}
            {discount.alcance === "configuracion" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{ventaConfiguraciones.map((config, configIndex) => { const selected = discount.configuracion_refs.includes(config.configuracion_ref); return <button key={config.configuracion_ref} type="button" onClick={() => actualizarDescuentoFase1B(discount.descuento_ref, { configuracion_refs: selected ? discount.configuracion_refs.filter((ref) => ref !== config.configuracion_ref) : [...discount.configuracion_refs, config.configuracion_ref] })} style={{ ...actionBtnStyle, background: selected ? "#ddebff" : "#fff", borderColor: selected ? "#2563eb" : "#cbd8e4" }}>Par {configIndex + 1}</button>; })}</div>}
            {discount.alcance === "linea" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{lineOptions.map((option) => { const selected = discount.linea_refs.includes(option.value); return <button key={option.value} type="button" onClick={() => actualizarDescuentoFase1B(discount.descuento_ref, { linea_refs: selected ? discount.linea_refs.filter((ref) => ref !== option.value) : [...discount.linea_refs, option.value] })} style={{ ...actionBtnStyle, background: selected ? "#ddebff" : "#fff", borderColor: selected ? "#2563eb" : "#cbd8e4" }}>{option.label}</button>; })}</div>}
            {preview && <div style={{ marginTop: 8, padding: 7, background: "#eff6ff", color: "#174ea6", fontSize: 12 }}>Base restante elegible: ${Number(preview.base_elegible).toFixed(2)} · Descuenta: ${Number(preview.monto_aplicado).toFixed(2)}</div>}
          </div>;
        })}
        <button type="button" onClick={() => previewVentaFase1B().catch(() => undefined)} disabled={ventaPreviewLoading} style={{ ...actionBtnStyle, borderColor: "#2563eb", color: "#174ea6" }}>{ventaPreviewLoading ? "Calculando..." : "Actualizar vista previa"}</button>
        <div style={{ padding: 12, background: "#102f50", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}><span>Subtotal</span><strong>${ventaSubtotalResumen.toFixed(2)}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 13, color: "#a9d5ff" }}><span>Descuentos ({ventaDescuentosFase1B.length})</span><strong>−${ventaDescuentoMonto.toFixed(2)}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 13, color: "#cbdff3" }}><span>Pagado</span><strong>−${ventaMontoPagado.toFixed(2)}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 13 }}><span>Saldo por pagar</span><strong>${ventaSaldo.toFixed(2)}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,.22)", fontSize: 19 }}><span>Total</span><strong>${ventaTotalCarrito.toFixed(2)} MXN</strong></div>
        </div>
      </div>
      {editingVentaId === null && (
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          <button
            type="button"
            onClick={async () => {
              try {
                await previewVentaFase1B();
                setVentaConfirmacionOpen(true);
              } catch {
                // El detalle validado ya se muestra en el formulario.
              }
            }}
            disabled={savingVenta || ventaPreviewLoading || !canCreateVenta}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #0f766e",
              background: savingVenta || ventaPreviewLoading || !canCreateVenta ? "#dfe9e8" : "#0f766e",
              color: savingVenta || ventaPreviewLoading || !canCreateVenta ? "#526b7b" : "#fff",
              fontWeight: 900,
              cursor: savingVenta || !canCreateVenta ? "not-allowed" : "pointer",
            }}
          >
            {ventaPreviewLoading ? "Calculando..." : "Previsualizar y confirmar venta"}
          </button>
          <span style={{ textAlign: "center", color: "#718397", fontSize: 10 }}>
            Revisarás una confirmación final antes de guardar.
          </span>
          {error && (
            <span style={{ padding: 9, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 11 }}>
              {error}
            </span>
          )}
        </div>
      )}
      {editingVentaId !== null && (
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => ventaFormRef.current?.requestSubmit()}
            disabled={savingVenta || !canEditVenta}
            style={{
              width: "100%",
              padding: 13,
              border: "1px solid #0f766e",
              background: savingVenta || !canEditVenta ? "#dfe9e8" : "#0f766e",
              color: savingVenta || !canEditVenta ? "#526b7b" : "#fff",
              fontWeight: 900,
              cursor: savingVenta ? "wait" : "pointer",
            }}
          >
            {savingVenta ? "Guardando cambios..." : "Guardar cambios de la venta"}
          </button>
          <span style={{ textAlign: "center", color: "#718397", fontSize: 10 }}>
            Cada guardado pide confirmación y conserva abierta esta venta para continuar editando.
          </span>
          <button
            type="button"
            onClick={completarEdicionVenta}
            disabled={savingVenta}
            style={{ ...actionBtnStyle, width: "100%", padding: 11, borderColor: "#8fb1d5", color: "#174ea6" }}
          >
            Completar edición
          </button>
          {error && (
            <span style={{ padding: 9, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 11 }}>
              {error}
            </span>
          )}
        </div>
      )}
    </section>
  );

  const renderFlujoLentesOpticos = () => (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <button type="button" onClick={() => crearConfiguracionOptica("par_completo")} style={{ ...actionBtnStyle, borderColor: "#2563eb", color: "#174ea6" }}>+ Par completo</button>
        <button type="button" onClick={() => crearConfiguracionOptica("solo_micas")} style={actionBtnStyle}>+ Solo micas</button>
        <button type="button" onClick={() => crearConfiguracionOptica("solo_tratamiento")} style={actionBtnStyle}>+ Solo tratamiento</button>
      </div>
      {ventaConfiguraciones.length === 0 && (
        <div style={{ padding: 16, border: "1px dashed #a9bed3", background: "#f8fbff", color: "#526b7b" }}>
          Agrega una configuración por cada par. Cada una guarda su propio diseño, tratamiento, uso y receta.
        </div>
      )}
      {ventaConfiguraciones.map((config, index) => {
        const expanded = ventaConfiguracionActiva === config.configuracion_ref;
        const frame = inventario.find((item) => item.producto_id === config.armazon_producto_id);
        const design = inventario.find((item) => item.producto_id === config.diseno_producto_id);
        const treatment = inventario.find((item) => item.producto_id === config.tratamiento_producto_id);
        const variant = treatment?.variantes?.find((item) => item.variante_id === config.variante_id);
        const treatmentPrice = variant?.precio_ajuste_override ?? treatment?.precio ?? 0;
        const configTotal = Number(frame?.precio || 0) + Number(design?.precio || 0) + Number(treatmentPrice || 0);
        const needsVariant = treatment?.sku === "DEMO-TRT-BLUE" || treatment?.sku === "DEMO-TRT-TINT";
        const prescriptionOptional = config.tipo_configuracion === "solo_tratamiento"
          || design?.sku === "DEMO-LENS-NONRX"
          || config.uso_visual === "sin_graduacion";
        const optionStyle = (selected: boolean): CSSProperties => ({
          minHeight: 64, padding: 9, border: selected ? "2px solid #2563eb" : "1px solid #cbd8e4",
          background: selected ? "#eaf2ff" : "#fff", color: "#173b61", textAlign: "left",
          fontWeight: 850, cursor: "pointer",
        });
        return (
          <section key={config.configuracion_ref} style={{ border: expanded ? "2px solid #2563eb" : "1px solid #cbd8e4", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 11, background: expanded ? "#edf5ff" : "#f8fafc" }}>
              <button type="button" onClick={() => setVentaConfiguracionActiva(expanded ? null : config.configuracion_ref)} style={{ flex: 1, border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}>
                <strong style={{ color: "#173b61" }}>Par {index + 1} · {config.tipo_configuracion.replaceAll("_", " ")}</strong>
                <span style={{ display: "block", marginTop: 3, color: "#61768a", fontSize: 11 }}>
                  {frame?.nombre || (config.tipo_configuracion === "par_completo" ? "Sin armazón" : "Armazón del cliente")} · {design?.nombre || (config.tipo_configuracion === "solo_tratamiento" ? "Sin diseño nuevo" : "Sin diseño")} · {treatment ? `${treatment.nombre}${variant ? ` (${variant.nombre})` : ""}` : "Sin tratamiento"} · ${configTotal.toFixed(2)}
                </span>
              </button>
              <button type="button" onClick={() => setVentaConfiguracionActiva(config.configuracion_ref)} style={actionBtnStyle}>{expanded ? "Editando" : "Editar"}</button>
              <button type="button" onClick={() => quitarConfiguracionOptica(config.configuracion_ref)} style={{ ...actionBtnStyle, color: "#991b1b", borderColor: "#fecaca" }}>Quitar</button>
            </div>
            {expanded && (
              <div style={{ display: "grid", gap: 13, padding: 12 }}>
                <label style={{ display: "grid", gap: 5, fontWeight: 850 }}>Tipo de configuración
                  <select value={config.tipo_configuracion} onChange={(event) => actualizarConfiguracionOptica(config.configuracion_ref, { tipo_configuracion: event.target.value as VentaConfiguracionOptica["tipo_configuracion"] })} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}>
                    <option value="par_completo">Par completo</option>
                    <option value="solo_micas">Solo micas (armazón del cliente)</option>
                    <option value="solo_tratamiento">Solo tratamiento del par existente</option>
                  </select>
                </label>

                {config.tipo_configuracion === "par_completo" && (
                  <div>
                    <strong>1. Armazón</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 7, marginTop: 7 }}>
                      {ventaArmazonesOpticos.map((product) => {
                        const selected = config.armazon_producto_id === product.producto_id;
                        const disabled = product.controla_stock && product.stock <= 0 && !selected;
                        return <button key={product.producto_id} type="button" disabled={disabled} onClick={() => actualizarConfiguracionOptica(config.configuracion_ref, { armazon_producto_id: selected ? null : product.producto_id })} style={{ ...optionStyle(selected), opacity: disabled ? .48 : 1 }}>
                          {product.nombre}<span style={{ display: "block", marginTop: 4, color: "#0e5fa8" }}>${Number(product.precio).toFixed(2)} · {product.stock} disponibles</span>
                        </button>;
                      })}
                    </div>
                  </div>
                )}

                {config.tipo_configuracion !== "solo_tratamiento" && (
                  <div>
                    <strong>2. Diseño de mica (un par)</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 7, marginTop: 7 }}>
                      {ventaMicasDisenos.map((product) => {
                        const selected = config.diseno_producto_id === product.producto_id;
                        return <button key={product.producto_id} type="button" onClick={() => actualizarConfiguracionOptica(config.configuracion_ref, { diseno_producto_id: selected ? null : product.producto_id, prescripcion_id: product.sku === "DEMO-LENS-NONRX" ? null : config.prescripcion_id })} style={optionStyle(selected)}>
                          {product.nombre}<span style={{ display: "block", marginTop: 4, color: "#0e5fa8" }}>+${Number(product.precio).toFixed(2)}</span>
                        </button>;
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <strong>{config.tipo_configuracion === "solo_tratamiento" ? "1. Tratamiento requerido" : "3. Tratamiento (máximo uno)"}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 7, marginTop: 7 }}>
                    {config.tipo_configuracion !== "solo_tratamiento" && (
                      <button type="button" onClick={() => actualizarConfiguracionOptica(config.configuracion_ref, { tratamiento_producto_id: null, variante_id: null })} style={optionStyle(config.tratamiento_producto_id === null)}>Sin tratamiento · +$0</button>
                    )}
                    {[ventaTratamientoAntirreflejante, ventaTratamientoFotocromatico, ventaTratamientoAntiblue, ventaTratamientoTinte].filter((item): item is InventarioProducto => Boolean(item)).map((product) => {
                      const selected = config.tratamiento_producto_id === product.producto_id;
                      return <button key={product.producto_id} type="button" onClick={() => actualizarConfiguracionOptica(config.configuracion_ref, { tratamiento_producto_id: selected && config.tipo_configuracion !== "solo_tratamiento" ? null : product.producto_id, variante_id: null })} style={optionStyle(selected)}>
                        {product.nombre}<span style={{ display: "block", marginTop: 4, color: "#0e5fa8" }}>+${Number(product.precio).toFixed(2)}</span>
                      </button>;
                    })}
                  </div>
                  {needsVariant && treatment && (
                    <div style={{ marginTop: 9, padding: 10, border: "1px solid #d7e2ed", background: "#f8fbff" }}>
                      <strong>{treatment.sku === "DEMO-TRT-TINT" ? "Color del tinte" : "Color del reflejo"}</strong>
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
                        {(treatment.variantes || []).map((item) => {
                          const selected = config.variante_id === item.variante_id;
                          const color = VENTA_TINTE_COLORES[item.nombre] || (item.codigo.includes("verde") ? "#35a56a" : "#3478cf");
                          return <button key={item.variante_id} type="button" onClick={() => actualizarConfiguracionOptica(config.configuracion_ref, { variante_id: item.variante_id })} style={{ ...optionStyle(selected), minHeight: 42, borderRadius: 999, padding: "7px 11px" }}>
                            <span style={{ display: "inline-block", width: 13, height: 13, marginRight: 6, borderRadius: 999, background: color, verticalAlign: -2 }} />{item.nombre}
                          </button>;
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {config.tipo_configuracion !== "solo_tratamiento" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 9 }}>
                    <label style={{ display: "grid", gap: 5, fontWeight: 850 }}>Uso visual
                      <select value={config.uso_visual} onChange={(event) => actualizarConfiguracionOptica(config.configuracion_ref, { uso_visual: event.target.value as VentaConfiguracionOptica["uso_visual"], prescripcion_id: event.target.value === "sin_graduacion" ? null : config.prescripcion_id })} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}>
                        <option value="lejos">Lejos</option><option value="cerca">Cerca</option><option value="intermedio">Intermedio</option><option value="multifocal">Multifocal</option><option value="sin_graduacion">Sin graduación</option><option value="otro">Otro</option>
                      </select>
                    </label>
                    {config.uso_visual === "otro" && <label style={{ display: "grid", gap: 5, fontWeight: 850 }}>Describe el uso<input value={config.uso_visual_otro || ""} onChange={(event) => actualizarConfiguracionOptica(config.configuracion_ref, { uso_visual_otro: event.target.value })} style={{ padding: 9, border: "1px solid #cbd8e4" }} /></label>}
                    {!prescriptionOptional && <label style={{ display: "grid", gap: 5, fontWeight: 850 }}>Receta del paciente
                      <select value={config.prescripcion_id || ""} onChange={(event) => actualizarConfiguracionOptica(config.configuracion_ref, { prescripcion_id: event.target.value ? Number(event.target.value) : null })} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}>
                        <option value="">Seleccionar receta...</option>{prescripcionesVenta.map((item) => <option key={item.prescripcion_id} value={item.prescripcion_id}>Receta #{item.prescripcion_id} · {item.fecha_prescripcion || "sin fecha"} · {item.origen === "interna" ? "interna" : "externa"}</option>)}
                      </select>
                    </label>}
                    {!prescriptionOptional && <button type="button" onClick={() => { setVentaConfiguracionActiva(config.configuracion_ref); setPrescripcionVentaOpen(true); }} style={{ ...actionBtnStyle, alignSelf: "end" }}>+ Registrar receta</button>}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 9 }}>
                  <label style={{ display: "grid", gap: 5, fontWeight: 850 }}>Abasto para este par
                    <select value={config.comportamiento_abasto_usado} onChange={(event) => actualizarConfiguracionOptica(config.configuracion_ref, { comportamiento_abasto_usado: event.target.value as VentaComportamientoAbasto })} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}>
                      <option value="laboratorio_bajo_pedido">Laboratorio bajo pedido</option><option value="fabricacion_interna">Fabricación interna</option><option value="inventario">Inventario</option>
                    </select>
                  </label>
                  {editingVentaId !== null && <label style={{ display: "grid", gap: 5, fontWeight: 850 }}>Estado de producción
                    <select value={config.estado_produccion || "pendiente_anticipo"} onChange={(event) => actualizarConfiguracionOptica(config.configuracion_ref, { estado_produccion: event.target.value as VentaEstadoProduccion })} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}>
                      <option value="pendiente_anticipo">Pendiente de anticipo</option><option value="listo_para_produccion">Listo para producción</option><option value="en_produccion">En producción</option><option value="listo_para_entregar">Listo para entregar</option><option value="entregado">Entregado</option>
                    </select>
                  </label>}
                </div>
                <button type="button" onClick={() => setVentaConfiguracionActiva(null)} style={{ ...actionBtnStyle, borderColor: "#0f766e", color: "#0f766e" }}>Terminar configuración</button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );

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
          onClick={() => setLogoutConfirmOpen(true)}
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
          value={String(sucursalFiltro)}
          disabled={!isAdmin && !isContador}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "general" || value === "online") {
              setSucursalFiltro(value);
            } else {
              const branchId = Number(value);
              setSucursalActivaId(branchId);
              setSucursalFiltro(branchId);
            }
          }}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #d6e1e6",
            background: "#fff",
            minWidth: 280,
          }}
        >
          <option value="general">General</option>
          {sucursales.length === 0 ? (
            <option value={String(sucursalActivaId)}>Cargando...</option>
          ) : (
            <>
            {sucursales.map((s) => (
              <option key={s.sucursal_id} value={s.sucursal_id}>
                {s.nombre}
              </option>
            ))}
            <option value="online">Tienda en línea</option>
            </>
          )}
        </select>
      </div>


      <div className="olm-main-tabs" style={{ display: "flex", gap: 6, marginBottom: 22 }}>
        {!isContador && (
          <TabButton variant="pacientes" active={tab === "pacientes"} onClick={() => setTab("pacientes")}>
            Pacientes
          </TabButton>
        )}
        {canViewHistoriaTab && (
          <TabButton
            variant="historia_clinica"
            active={tab === "historia_clinica"}
            onClick={() => setTab("historia_clinica")}
          >
            Historia clínica
          </TabButton>
        )}
        {!isContador && (
          <TabButton variant="consultas" active={tab === "consultas"} onClick={() => setTab("consultas")}>
            Consultas
          </TabButton>
        )}
        {canViewResumenVentas && (
          <TabButton variant="ventas" active={tab === "ventas"} onClick={() => setTab("ventas")}>
            Ventas
          </TabButton>
        )}
        {canViewVentasTab && (
          <TabButton
            variant="resumen_ventas"
            active={tab === "resumen_ventas"}
            onClick={() => setTab("resumen_ventas")}
          >
            Resumen de ventas
          </TabButton>
        )}
        {!isContador && (
          <TabButton variant="estadisticas" active={tab === "estadisticas"} onClick={() => setTab("estadisticas")}>
            Estadísticas
          </TabButton>
        )}
        {(isAdmin || isDoctor || isRecep || isContador) && (
          <TabButton variant="inventario" active={tab === "inventario"} onClick={() => setTab("inventario")}>
            Inventario
          </TabButton>
        )}
        {(isAdmin || isRecep) && (
          <TabButton variant="inventario" active={tab === "envios"} onClick={() => setTab("envios") }>
            Entregas en línea
          </TabButton>
        )}
        {(isAdmin || isContador) && (
          <TabButton variant="estadisticas" active={tab === "finanzas"} onClick={() => setTab("finanzas")}>
            Finanzas
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
      {!isContador && tab === "pacientes" && (
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
        !isContador && tab === "consultas" && (
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
          <form ref={ventaFormRef} onSubmit={onSubmitVenta} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
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
              {(isAdmin || isRecep || isDoctor) ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {editingVentaId !== null && (
                    <div style={{ padding: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", fontSize: 13, fontWeight: 700 }}>
                      Estás editando toda la venta. El inventario se ajustará únicamente por la diferencia de productos y cantidades.
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

                      {loadingInventario ? (
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
                            renderFlujoLentesOpticos()
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

            {(!isAdmin || editingVentaId !== null) && (
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
            )}

            {editingVentaId === null && (
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
            )}

            {editingVentaId !== null && (
              <button
                type="button"
                onClick={completarEdicionVenta}
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
                Completar edición
              </button>
            )}
          </form>

          <div style={{ display: "grid", gap: 16, alignSelf: "start", minWidth: 0 }}>
            {isAdmin && renderVentaResumenProductos()}
          </div>
        </div>
      )}

      {/* ========================= RESUMEN DE VENTAS ========================= */}
      {canViewResumenVentas && tab === "resumen_ventas" && (
        <div style={{ display: "grid", gap: 16 }}>
          <section style={{ ...softCard, padding: 18, background: "#f8fbff", borderColor: "#c9dced" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, color: "#173b61" }}>Resumen de ventas</h2>
                <div style={{ marginTop: 5, color: "#6b7f93" }}>
                  Localiza rápidamente ventas con saldo por pagar y consulta al cliente o el detalle de la venta.
                </div>
              </div>
              <button
                type="button"
                onClick={loadVentasResumen}
                disabled={loadingVentasResumen}
                style={{
                  ...actionBtnStyle,
                  padding: "10px 14px",
                  borderColor: "#8fb1d5",
                  color: "#174ea6",
                  cursor: loadingVentasResumen ? "wait" : "pointer",
                }}
              >
                {loadingVentasResumen ? "Actualizando..." : "Actualizar resumen"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10, marginTop: 16 }}>
              {([
                {
                  value: "por_cobrar",
                  label: "Por cobrar",
                  count: ventasResumenMetricas.porCobrar,
                  detail: `$${ventasResumenMetricas.saldoPorCobrar.toFixed(2)} pendientes`,
                  color: "#c2410c",
                  background: "#fff7ed",
                },
                {
                  value: "parciales",
                  label: "Pago parcial",
                  count: ventasResumenMetricas.parciales,
                  detail: "Ya pagaron una parte",
                  color: "#a16207",
                  background: "#fffbeb",
                },
                {
                  value: "liquidadas",
                  label: "Pagadas",
                  count: ventasResumenMetricas.liquidadas,
                  detail: "Pagadas por completo",
                  color: "#166534",
                  background: "#f0fdf4",
                },
                {
                  value: "todas",
                  label: "Todas las ventas",
                  count: ventasResumenMetricas.todas,
                  detail: "Historial completo",
                  color: "#174ea6",
                  background: "#eff6ff",
                },
              ] as const).map((filtro) => {
                const activo = ventasResumenEstado === filtro.value;
                return (
                  <button
                    key={filtro.value}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setVentasResumenEstado(filtro.value)}
                    style={{
                      padding: 13,
                      border: activo ? `2px solid ${filtro.color}` : "1px solid #d7e3ed",
                      background: filtro.background,
                      color: filtro.color,
                      textAlign: "left",
                      cursor: "pointer",
                      boxShadow: activo ? "0 8px 20px rgba(15, 23, 42, .10)" : "none",
                    }}
                  >
                    <span style={{ display: "block", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: .5 }}>
                      {filtro.label}
                    </span>
                    <strong style={{ display: "block", marginTop: 4, fontSize: 24 }}>{filtro.count}</strong>
                    <span style={{ display: "block", marginTop: 2, fontSize: 11, opacity: .82 }}>{filtro.detail}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ ...softCard, overflow: "hidden" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #dbe6ef", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={qVentasResumen}
                onChange={(e) => setQVentasResumen(e.target.value)}
                placeholder="Buscar por cliente, venta, producto, método o monto..."
                style={{ flex: "1 1 360px", minWidth: 220, padding: 10, border: "1px solid #cbd8e4", background: "#fff" }}
              />
              <select
                value={ventasResumenEstadoVenta}
                onChange={(e) => setVentasResumenEstadoVenta(e.target.value as "todas" | VentaEstado)}
                aria-label="Filtrar por estado de la venta"
                style={{ minWidth: 190, padding: 10, border: "1px solid #cbd8e4", background: "#fff" }}
              >
                <option value="todas">Todos los estados de venta</option>
                {VENTA_ESTADO_OPTIONS.map((opcion) => (
                  <option key={`filtro-${opcion.value}`} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
              <select
                value={ventasResumenEstadoPago}
                onChange={(e) => setVentasResumenEstadoPago(e.target.value as "todos" | VentaEstadoPago)}
                aria-label="Filtrar por estado del pago"
                style={{ minWidth: 170, padding: 10, border: "1px solid #cbd8e4", background: "#fff" }}
              >
                <option value="todos">Todos los estados de pago</option>
                {VENTA_ESTADO_PAGO_OPTIONS.map((opcion) => (
                  <option key={`filtro-pago-${opcion.value}`} value={opcion.value}>{opcion.label}</option>
                ))}
              </select>
              <select
                value={ventasResumenPeriodo}
                onChange={(e) => setVentasResumenPeriodo(e.target.value as typeof ventasResumenPeriodo)}
                aria-label="Filtrar por periodo"
                style={{ minWidth: 155, padding: 10, border: "1px solid #cbd8e4", background: "#fff" }}
              >
                <option value="todos">Cualquier fecha</option>
                <option value="dia">Elegir día</option>
                <option value="semana">Elegir semana</option>
                <option value="mes">Elegir mes</option>
                <option value="anio">Elegir año</option>
              </select>
              {ventasResumenPeriodo === "dia" && (
                <input
                  type="date"
                  value={ventasResumenDia}
                  onChange={(e) => setVentasResumenDia(e.target.value)}
                  aria-label="Día de las ventas"
                  style={{ minWidth: 155, padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}
                />
              )}
              {ventasResumenPeriodo === "semana" && (
                <input
                  type="week"
                  value={ventasResumenSemana}
                  onChange={(e) => setVentasResumenSemana(e.target.value)}
                  aria-label="Semana de las ventas"
                  style={{ minWidth: 165, padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}
                />
              )}
              {ventasResumenPeriodo === "mes" && (
                <input
                  type="month"
                  value={ventasResumenMes}
                  onChange={(e) => setVentasResumenMes(e.target.value)}
                  aria-label="Mes de las ventas"
                  style={{ minWidth: 155, padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}
                />
              )}
              {ventasResumenPeriodo === "anio" && (
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  step={1}
                  value={ventasResumenAnio}
                  onChange={(e) => setVentasResumenAnio(e.target.value)}
                  aria-label="Año de las ventas"
                  style={{ width: 115, padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}
                />
              )}
              <select
                value={ventasResumenOrden}
                onChange={(e) => setVentasResumenOrden(e.target.value as typeof ventasResumenOrden)}
                aria-label="Ordenar ventas"
                style={{ minWidth: 175, padding: 10, border: "1px solid #cbd8e4", background: "#fff" }}
              >
                <option value="recientes">Más recientes primero</option>
                <option value="antiguas">Más antiguas primero</option>
                <option value="cliente">Cliente A–Z</option>
                <option value="monto_desc">Mayor total</option>
                <option value="saldo_desc">Mayor saldo pendiente</option>
              </select>
              {(qVentasResumen || ventasResumenEstadoVenta !== "todas" || ventasResumenEstadoPago !== "todos" || ventasResumenPeriodo !== "todos" || ventasResumenOrden !== "recientes") && (
                <button
                  type="button"
                  onClick={() => {
                    setQVentasResumen("");
                    setVentasResumenEstadoVenta("todas");
                    setVentasResumenEstadoPago("todos");
                    setVentasResumenPeriodo("todos");
                    setVentasResumenOrden("recientes");
                  }}
                  style={{ ...actionBtnStyle, padding: "9px 12px" }}
                >
                  Limpiar filtros
                </button>
              )}
              <span style={{ color: "#6b7f93", fontSize: 12, fontWeight: 800 }}>
                {ventasResumenFiltradas.length} resultado(s)
              </span>
            </div>

            {ventasResumenError && (
              <div style={{ margin: 14, padding: 11, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
                {ventasResumenError}
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1360, borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "#173b61", color: "#fff" }}>
                    <th align="left" style={{ width: 75, padding: "11px 9px" }}>Venta</th>
                    <th align="left" style={{ width: 145, padding: "11px 9px" }}>Fecha</th>
                    <th align="left" style={{ width: 210, padding: "11px 9px" }}>Cliente</th>
                    <th align="right" style={{ width: 110, padding: "11px 9px" }}>Total</th>
                    <th align="right" style={{ width: 110, padding: "11px 9px" }}>Pagado</th>
                    <th align="right" style={{ width: 135, padding: "11px 9px" }}>Saldo por pagar</th>
                    <th align="left" style={{ width: 125, padding: "11px 9px" }}>Estado venta</th>
                    <th align="left" style={{ width: 125, padding: "11px 9px" }}>Estado pago</th>
                    <th align="left" style={{ width: 175, padding: "11px 9px" }}>Pedido / entrega</th>
                    <th align="left" style={{ width: 150, padding: "11px 9px" }}>Método</th>
                    <th align="left" style={{ width: 105, padding: "11px 9px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasResumenFiltradas.map((venta) => {
                    const saldo = Number(venta.saldo_pendiente || 0);
                    const pagado = Number(venta.monto_pagado || 0);
                    const liquidada = saldo <= 0;
                    const parcial = !liquidada && pagado > 0;
                    const metodos = venta.pagos && venta.pagos.length > 0
                      ? Array.from(new Set(venta.pagos.map((pago) => formatMetodoPagoLabel(pago.metodo)))).join(" + ")
                      : formatMetodoPagoLabel(venta.metodo_pago);
                    return (
                      <tr key={`resumen-venta-${venta.venta_id}`} style={{ borderTop: "1px solid #e4ebf1", background: liquidada ? "#fbfefc" : "#fff" }}>
                        <td style={{ padding: 9, fontWeight: 900, color: "#173b61" }}>#{venta.venta_id}</td>
                        <td style={{ padding: 9, color: "#526b7b", fontSize: 12 }}>{formatDateTimePretty(venta.fecha_hora)}</td>
                        <td style={{ padding: 9 }}>
                          {isContador ? <strong style={{ color: "#40566c" }}>{venta.paciente_nombre}</strong> : <button
                              type="button"
                              onClick={() => openPacientePerfilDesdeVenta(venta)}
                              title="Abrir información completa del paciente"
                              style={{
                                padding: 0,
                                border: 0,
                                background: "transparent",
                                color: "#0e5fa8",
                                fontWeight: 850,
                                textAlign: "left",
                                cursor: "pointer",
                                textDecoration: "underline",
                                textUnderlineOffset: 3,
                              }}
                            >
                              {venta.paciente_nombre}
                            </button>}
                        </td>
                        <td style={{ padding: 9, textAlign: "right", fontWeight: 800 }}>${Number(venta.monto_total || 0).toFixed(2)}</td>
                        <td style={{ padding: 9, textAlign: "right", color: "#174ea6", fontWeight: 800 }}>${pagado.toFixed(2)}</td>
                        <td style={{ padding: 9, textAlign: "right", color: liquidada ? "#166534" : "#c2410c", fontWeight: 900 }}>${saldo.toFixed(2)}</td>
                        <td style={{ padding: 9 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "5px 8px",
                              borderRadius: 999,
                              background: venta.estado_venta === "completada"
                                ? "#dcfce7"
                                : venta.estado_venta === "cancelada" || venta.estado_venta === "devuelta"
                                  ? "#fee2e2"
                                  : "#e0f2fe",
                              color: venta.estado_venta === "completada"
                                ? "#166534"
                                : venta.estado_venta === "cancelada" || venta.estado_venta === "devuelta"
                                  ? "#991b1b"
                                  : "#075985",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            {formatVentaEstadoLabel(venta.estado_venta)}
                          </span>
                        </td>
                        <td style={{ padding: 9 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "5px 8px",
                              borderRadius: 999,
                              background: venta.estado_pago === "pagada"
                                ? "#dcfce7"
                                : venta.estado_pago === "reembolsada"
                                  ? "#ede9fe"
                                  : parcial
                                    ? "#fef3c7"
                                    : "#fee2e2",
                              color: venta.estado_pago === "pagada"
                                ? "#166534"
                                : venta.estado_pago === "reembolsada"
                                  ? "#6d28d9"
                                  : parcial
                                    ? "#92400e"
                                    : "#991b1b",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            {formatVentaEstadoPagoLabel(venta.estado_pago)}
                          </span>
                        </td>
                        <td style={{ padding: 9, color: "#40566c", fontSize: 12, fontWeight: 800 }}>
                          {formatVentaEstadoPedidoLabel(venta.estado_pedido)}
                        </td>
                        <td style={{ padding: 9, color: "#526b7b", fontSize: 12 }}>{metodos}</td>
                        <td style={{ padding: 9 }}>
                          <button
                            type="button"
                            onClick={() => openVentaDetalle(venta)}
                            style={{ ...actionBtnStyle, padding: "7px 10px", color: "#174ea6", borderColor: "#9cb9d5" }}
                          >
                            Ver venta
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingVentasResumen && ventasResumenFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ padding: 24, textAlign: "center", color: "#6b7f93" }}>
                        No hay ventas en esta sección.
                      </td>
                    </tr>
                  )}
                  {loadingVentasResumen && ventasResumen.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ padding: 24, textAlign: "center", color: "#6b7f93" }}>
                        Cargando resumen de ventas...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {(isAdmin || isRecep) && tab === "envios" && (
        <OnlineShippingAdmin isAdmin={isAdmin} products={inventario} />
      )}

      {/* ========================= INVENTARIO ========================= */}
      {(isAdmin || isDoctor || isRecep || isContador) && tab === "inventario" && (
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
              <button
                type="button"
                onClick={() => setInventarioVista("analisis")}
                aria-pressed={inventarioVista === "analisis"}
                style={{
                  padding: "9px 14px",
                  border: inventarioVista === "analisis" ? "1px solid #6d4b9c" : "1px solid #b9cce0",
                  background: inventarioVista === "analisis" ? "#6d4b9c" : "#fff",
                  color: inventarioVista === "analisis" ? "#fff" : "#40566c",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Análisis de inventario
              </button>
              {(isAdmin || isContador) && (
                <button
                  type="button"
                  onClick={() => setInventarioVista("movimientos")}
                  aria-pressed={inventarioVista === "movimientos"}
                  style={{
                    padding: "9px 14px",
                    border: inventarioVista === "movimientos" ? "1px solid #9a4c0e" : "1px solid #b9cce0",
                    background: inventarioVista === "movimientos" ? "#9a4c0e" : "#fff",
                    color: inventarioVista === "movimientos" ? "#fff" : "#40566c",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Movimientos y compras
                </button>
              )}
              {(isAdmin || isContador) && (
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
              {(isAdmin || isContador) && (
                <button
                  type="button"
                  onClick={() => setInventarioVista("precios_opticos")}
                  aria-pressed={inventarioVista === "precios_opticos"}
                  style={{
                    padding: "9px 14px",
                    border: inventarioVista === "precios_opticos" ? "1px solid #0f766e" : "1px solid #b9cce0",
                    background: inventarioVista === "precios_opticos" ? "#0f766e" : "#fff",
                    color: inventarioVista === "precios_opticos" ? "#fff" : "#40566c",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Precios ópticos
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setInventarioVista("comercio")}
                  aria-pressed={inventarioVista === "comercio"}
                  style={{
                    padding: "9px 14px",
                    border: inventarioVista === "comercio" ? "1px solid #1e40af" : "1px solid #b9cce0",
                    background: inventarioVista === "comercio" ? "#1e40af" : "#fff",
                    color: inventarioVista === "comercio" ? "#fff" : "#40566c",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Comercio en línea
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setInventarioVista("bajo_pedido")}
                  aria-pressed={inventarioVista === "bajo_pedido"}
                  style={{
                    padding: "9px 14px",
                    border: inventarioVista === "bajo_pedido" ? "1px solid #0f766e" : "1px solid #b9cce0",
                    background: inventarioVista === "bajo_pedido" ? "#0f766e" : "#fff",
                    color: inventarioVista === "bajo_pedido" ? "#fff" : "#40566c",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Bajo pedido
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

          {isAdmin && inventarioVista === "comercio" && (
            <section style={{ ...softCard, overflowX: "auto", borderColor: "#b8c9ee" }}>
              <div style={{ padding: 15, borderBottom: "1px solid #dbe4f4", background: "#f6f8ff" }}>
                <h3 style={{ margin: 0, color: "#1e3a8a" }}>Disponibilidad para la tienda en línea</h3>
                <p style={{ margin: "5px 0 0", color: "#5d6f87", lineHeight: 1.45 }}>
                  Publicar un producto no lo vuelve comprable automáticamente. Durante Phase 1F-A solo pueden habilitarse
                  lentes de sol, lentes de contacto, accesorios y productos de limpieza o cuidado.
                </p>
              </div>
              <table style={{ width: "100%", minWidth: 1160, tableLayout: "fixed", borderCollapse: "collapse", background: "#fff", fontSize: 12 }}>
                <colgroup>
                  <col style={{ width: 250 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 115 }} />
                  <col style={{ width: 135 }} />
                  <col style={{ width: 125 }} />
                  <col style={{ width: 235 }} />
                  <col style={{ width: 130 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#1e3a8a", color: "#fff" }}>
                    {[
                      "PRODUCTO",
                      "CATEGORÍA",
                      "PUBLICADO",
                      "COMPRABLE",
                      "FAVORITOS",
                      "MÁXIMO POR LÍNEA",
                      "ACCIÓN",
                    ].map((label) => <th key={label} align="left" style={{ padding: "10px 9px" }}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {inventarioFiltrado.map((producto) => {
                    const categoriaComprableDirecta = [
                      "lentes_de_sol",
                      "lentes_de_contacto",
                      "accesorios_y_refacciones",
                      "soluciones_y_cuidado",
                    ].includes(producto.categoria);
                    const esArmazonOpticoComprable =
                      producto.categoria === "lentes_opticos"
                      && ["armazon", "clip_on"].includes(producto.subcategoria || "");
                    const categoriaComprable =
                      producto.tipo_producto === "producto_fisico"
                      && Boolean(producto.controla_stock)
                      && (categoriaComprableDirecta || esArmazonOpticoComprable);
                    const disponibleEnTienda = producto.activo && Boolean(producto.publicado_online);
                    const guardando = savingInventarioId === producto.producto_id;
                    const actualizarLocal = (changes: Partial<InventarioProducto>) => {
                      setInventario((prev) => prev.map((item) => (
                        item.producto_id === producto.producto_id ? { ...item, ...changes } : item
                      )));
                    };
                    return (
                      <tr key={`comercio-${producto.producto_id}`} style={{ borderTop: "1px solid #e1e8f3", verticalAlign: "top" }}>
                        <td style={{ padding: 10 }}>
                          <strong style={{ color: "#173b61" }}>{producto.nombre}</strong>
                          <div style={{ marginTop: 2, color: "#718397", fontSize: 11 }}>{producto.sku}</div>
                          {!producto.activo && <div style={{ marginTop: 4, color: "#b91c1c", fontWeight: 850 }}>Producto inactivo</div>}
                        </td>
                        <td style={{ padding: 10, color: "#40566c" }}>{formatVentaCompraLabel(producto.categoria)}</td>
                        <td style={{ padding: 10 }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(producto.publicado_online)}
                              onChange={(e) => actualizarLocal({ publicado_online: e.target.checked })}
                            />
                            {producto.publicado_online ? "Sí" : "No"}
                          </label>
                        </td>
                        <td style={{ padding: 10 }}>
                          <label title={categoriaComprable ? "" : "Categoría no comprable durante Phase 1F-A"} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800, opacity: categoriaComprable ? 1 : 0.55 }}>
                            <input
                              type="checkbox"
                              disabled={!categoriaComprable && !producto.comprable_online}
                              checked={Boolean(producto.comprable_online)}
                              onChange={(e) => actualizarLocal({ comprable_online: e.target.checked })}
                            />
                            {producto.comprable_online ? "Sí" : "No"}
                          </label>
                          {producto.comprable_online && !disponibleEnTienda && (
                            <div style={{ marginTop: 4, color: "#9a4c0e", fontSize: 10 }}>Guardado; suspendido mientras no esté activo y publicado.</div>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(producto.permite_favorito)}
                              onChange={(e) => actualizarLocal({ permite_favorito: e.target.checked })}
                            />
                            {producto.permite_favorito ? "Sí" : "No"}
                          </label>
                          {producto.permite_favorito && !disponibleEnTienda && (
                            <div style={{ marginTop: 4, color: "#9a4c0e", fontSize: 10 }}>No aparecerá activo hasta volver a publicarse.</div>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={producto.cantidad_maxima_por_linea ?? ""}
                            placeholder="Opcional"
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") actualizarLocal({ cantidad_maxima_por_linea: null });
                              else if (/^\d+$/.test(raw) && Number(raw) > 0) actualizarLocal({ cantidad_maxima_por_linea: Number(raw) });
                            }}
                            style={{ width: "100%", padding: 8, border: "1px solid #aebed6" }}
                          />
                          {producto.cantidad_maxima_por_linea == null && (
                            <div style={{ marginTop: 4, color: "#6b7f93", fontSize: 10 }}>
                              Sin límite configurado; sujeto a existencias disponibles.
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() => guardarConfiguracionComercio(producto)}
                            style={{ ...actionBtnStyle, width: "100%", padding: "8px 10px", borderColor: "#809bd3", color: "#1e40af", cursor: guardando ? "wait" : "pointer" }}
                          >
                            {guardando ? "Guardando..." : "Guardar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {isAdmin && inventarioVista === "bajo_pedido" && (
            <section style={{ ...softCard, padding: 15, borderColor: "#9fd3cd" }}>
              <OpticalOperationsAdmin
                branches={sucursales}
                activeBranchId={sucursalActivaId}
              />
            </section>
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
                    {inventarioGrupoLabel(grupo.categoria)}
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
                    <strong style={{ fontSize: 15 }}>{inventarioGrupoLabel(grupo.categoria)}</strong>
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
                    const stockDraftRaw = inventarioStockDraft[producto.producto_id] ?? producto.stock;
                    const stockDraft = Math.max(
                      0,
                      Math.trunc(Number(stockDraftRaw || 0)),
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
                                <img src={resolveCatalogMediaUrl(producto.imagen_url)} alt={producto.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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
                                step={1}
                                value={stockDraftRaw}
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={() => {
                                  if (stockDraftRaw === "") {
                                    setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: producto.stock }));
                                  }
                                }}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  if (valor === "" || /^\d+$/.test(valor)) {
                                    setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: valor }));
                                  }
                                }}
                                placeholder="Stock total"
                                aria-label={`Nuevo stock total de ${producto.nombre}`}
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

          {inventarioVista === "analisis" && (
            <div style={{ display: "grid", gap: 14 }}>
              <section style={{ ...softCard, padding: 16, borderColor: "#d9c9ea", background: "#fcfaff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#46325f" }}>Análisis de inventario</h3>
                    <div style={{ marginTop: 4, color: "#718397", fontSize: 12 }}>
                      Sucursal #{sucursalActivaId}. Los resultados respetan la búsqueda y la categoría seleccionadas arriba.
                    </div>
                  </div>
                  <span style={{ padding: "6px 10px", background: "#ede9fe", color: "#5b21b6", fontSize: 11, fontWeight: 900 }}>
                    {inventarioControladoFiltrado.length} productos con stock
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 9, marginTop: 14 }}>
                  {[
                    { label: "Unidades disponibles", value: inventarioAnalisisTotalUnidades, color: "#174ea6", bg: "#eff6ff" },
                    { label: "Stock saludable", value: inventarioAnalisisSaludables.length, color: "#166534", bg: "#f0fdf4" },
                    { label: "Stock bajo", value: inventarioAnalisisBajos.length, color: "#9a4c0e", bg: "#fff7ed" },
                    { label: "Agotados", value: inventarioAnalisisAgotados.length, color: "#991b1b", bg: "#fef2f2" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: 12, border: "1px solid #dbe6ef", background: item.bg }}>
                      <div style={{ color: "#60758a", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ marginTop: 3, color: item.color, fontSize: 26, fontWeight: 950 }}>{item.value}</div>
                    </div>
                  ))}
                  {(isAdmin || isContador) && (
                    <div style={{ padding: 12, border: "1px solid #d8c9ea", background: "#faf7ff" }}>
                      <div style={{ color: "#6d4b7d", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Valor actual</div>
                      <div style={{ marginTop: 3, color: "#5b2166", fontSize: 22, fontWeight: 950 }}>${inventarioAnalisisValor.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </section>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
                <section style={{ ...softCard, padding: 15 }}>
                  <h3 style={{ margin: 0, color: "#173b61", fontSize: 16 }}>Estado de existencias</h3>
                  <div style={{ marginTop: 4, color: "#718397", fontSize: 11 }}>Porcentaje de productos, no de unidades.</div>
                  {inventarioControladoFiltrado.length === 0 ? (
                    <div style={{ padding: 24, color: "#718397", textAlign: "center" }}>Sin productos para este filtro.</div>
                  ) : (() => {
                    const total = inventarioControladoFiltrado.length;
                    const pctSaludable = inventarioAnalisisSaludables.length / total * 100;
                    const pctBajo = inventarioAnalisisBajos.length / total * 100;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "170px minmax(0, 1fr)", gap: 16, alignItems: "center", marginTop: 14 }}>
                        <div
                          aria-label="Gráfica circular del estado de existencias"
                          style={{
                            width: 160,
                            height: 160,
                            borderRadius: "50%",
                            background: `conic-gradient(#22c55e 0 ${pctSaludable}%, #f59e0b ${pctSaludable}% ${pctSaludable + pctBajo}%, #ef4444 ${pctSaludable + pctBajo}% 100%)`,
                            boxShadow: "inset 0 0 0 1px rgba(15,23,42,.08)",
                          }}
                        />
                        <div style={{ display: "grid", gap: 9 }}>
                          {[
                            { label: "Saludable", count: inventarioAnalisisSaludables.length, color: "#22c55e" },
                            { label: "Stock bajo", count: inventarioAnalisisBajos.length, color: "#f59e0b" },
                            { label: "Agotado", count: inventarioAnalisisAgotados.length, color: "#ef4444" },
                          ].map((item) => (
                            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto", gap: 7, alignItems: "center", borderBottom: "1px solid #edf1f5", paddingBottom: 6 }}>
                              <span style={{ width: 10, height: 10, background: item.color }} />
                              <span style={{ color: "#526b7b" }}>{item.label}</span>
                              <strong>{item.count} ({Math.round(item.count / total * 100)}%)</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </section>

                <section style={{ ...softCard, padding: 15 }}>
                  <h3 style={{ margin: 0, color: "#173b61", fontSize: 16 }}>Unidades por categoría</h3>
                  <div style={{ marginTop: 4, color: "#718397", fontSize: 11 }}>Cantidad física disponible en cada categoría.</div>
                  {inventarioAnalisisPorCategoria.length === 0 ? (
                    <div style={{ padding: 24, color: "#718397", textAlign: "center" }}>Sin existencias para mostrar.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      {inventarioAnalisisPorCategoria.map((item) => {
                        const maximo = Math.max(1, ...inventarioAnalisisPorCategoria.map((categoria) => categoria.unidades));
                        return (
                          <div key={`analisis-categoria-${item.categoria}`} style={{ display: "grid", gridTemplateColumns: "130px minmax(100px, 1fr) 70px", gap: 8, alignItems: "center" }}>
                            <span style={{ color: "#40566c", fontSize: 11, fontWeight: 800 }}>{formatVentaCompraLabel(item.categoria)}</span>
                            <div style={{ height: 18, background: "#edf2f7", overflow: "hidden" }}>
                              <div style={{ width: `${Math.max(3, item.unidades / maximo * 100)}%`, height: "100%", background: "linear-gradient(90deg, #315f89, #6d4b9c)" }} />
                            </div>
                            <strong style={{ textAlign: "right", color: "#173b61" }}>{item.unidades}</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
                <section style={{ ...softCard, padding: 15 }}>
                  <h3 style={{ margin: 0, color: "#173b61", fontSize: 16 }}>Productos con más unidades</h3>
                  <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
                    {inventarioAnalisisTopStock.length === 0 ? (
                      <div style={{ color: "#718397" }}>Sin productos para mostrar.</div>
                    ) : inventarioAnalisisTopStock.map((producto) => {
                      const maximo = Math.max(1, ...inventarioAnalisisTopStock.map((item) => Number(item.stock || 0)));
                      return (
                        <div key={`top-stock-${producto.producto_id}`} style={{ display: "grid", gridTemplateColumns: "minmax(125px, 1fr) minmax(90px, 1fr) 48px", gap: 8, alignItems: "center" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#40566c", fontSize: 11 }} title={producto.nombre}>{producto.nombre}</span>
                          <div style={{ height: 14, background: "#edf2f7" }}>
                            <div style={{ width: `${Math.max(2, Number(producto.stock || 0) / maximo * 100)}%`, height: "100%", background: "#0f766e" }} />
                          </div>
                          <strong style={{ textAlign: "right", color: "#0f766e" }}>{producto.stock}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section style={{ ...softCard, padding: 15 }}>
                  <h3 style={{ margin: 0, color: "#8a3d0a", fontSize: 16 }}>Atención de reabastecimiento</h3>
                  <div style={{ marginTop: 4, color: "#718397", fontSize: 11 }}>Productos agotados o en su mínimo configurado.</div>
                  {[...inventarioAnalisisAgotados, ...inventarioAnalisisBajos].length === 0 ? (
                    <div style={{ marginTop: 14, padding: 16, background: "#f0fdf4", color: "#166534", fontWeight: 800 }}>No hay alertas para este filtro.</div>
                  ) : (
                    <div style={{ overflowX: "auto", marginTop: 12 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "#fff7ed", color: "#8a3d0a" }}>
                            <th align="left" style={{ padding: 8 }}>PRODUCTO</th>
                            <th align="right" style={{ padding: 8 }}>ACTUAL</th>
                            <th align="right" style={{ padding: 8 }}>MÍNIMO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...inventarioAnalisisAgotados, ...inventarioAnalisisBajos]
                            .sort((a, b) => a.stock - b.stock)
                            .map((producto) => (
                              <tr key={`alerta-stock-${producto.producto_id}`} style={{ borderTop: "1px solid #f0e7dc" }}>
                                <td style={{ padding: 8 }}><strong>{producto.nombre}</strong><div style={{ color: "#718397" }}>{producto.sku}</div></td>
                                <td align="right" style={{ padding: 8, color: producto.stock <= 0 ? "#b91c1c" : "#c2410c", fontWeight: 900 }}>{producto.stock}</td>
                                <td align="right" style={{ padding: 8 }}>{producto.stock_minimo}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {(isAdmin || isContador) && inventarioAnalisisPorCategoria.length > 0 && (
                <section style={{ ...softCard, padding: 15, borderColor: "#d9c9ea" }}>
                  <h3 style={{ margin: 0, color: "#5b2166", fontSize: 16 }}>Valor invertido por categoría</h3>
                  <div style={{ marginTop: 4, color: "#718397", fontSize: 11 }}>Costo unitario × existencias actuales.</div>
                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    {inventarioAnalisisPorCategoria.map((item) => {
                      const maximo = Math.max(1, ...inventarioAnalisisPorCategoria.map((categoria) => categoria.valor));
                      return (
                        <div key={`valor-categoria-${item.categoria}`} style={{ display: "grid", gridTemplateColumns: "150px minmax(120px, 1fr) 120px", gap: 9, alignItems: "center" }}>
                          <span style={{ color: "#40566c", fontSize: 11, fontWeight: 800 }}>{formatVentaCompraLabel(item.categoria)}</span>
                          <div style={{ height: 18, background: "#f2edf7" }}>
                            <div style={{ width: `${Math.max(2, item.valor / maximo * 100)}%`, height: "100%", background: "linear-gradient(90deg, #6d4b9c, #b45f91)" }} />
                          </div>
                          <strong style={{ textAlign: "right", color: "#5b2166" }}>${item.valor.toFixed(2)}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {(isAdmin || isContador) && inventarioVista === "movimientos" && (
            <div style={{ display: "grid", gap: 12 }}>
              {isAdmin && (
                <section style={{ ...softCard, padding: 16, borderColor: "#f0c9a8", background: "#fffaf5" }}>
                  <h3 style={{ margin: 0, color: "#7c3f12" }}>Registrar movimiento de inventario</h3>
                  <div style={{ marginTop: 4, color: "#718397", fontSize: 11 }}>
                    La fecha, hora y usuario se guardan automáticamente. En una compra, el costo promedio se actualiza sin duplicar el producto.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 9, marginTop: 13 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850 }}>PRODUCTO
                      <select required value={inventarioMovimientoForm.producto_id} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, producto_id: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f", background: "#fff" }}>
                        <option value="">Seleccionar...</option>
                        {inventarioVisible.filter((item) => item.controla_stock).map((item) => <option key={item.producto_id} value={item.producto_id}>{item.sku} · {item.nombre} ({item.stock})</option>)}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850 }}>TIPO
                      <select value={inventarioMovimientoForm.tipo} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, tipo: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f", background: "#fff" }}>
                        <option value="entrada_compra">Entrada por compra</option>
                        <option value="devolucion">Devolución recibida</option>
                        <option value="merma">Merma o daño</option>
                        <option value="ajuste_positivo">Ajuste positivo</option>
                        <option value="ajuste_negativo">Ajuste negativo</option>
                        <option value="conteo_fisico">Conteo físico (stock final)</option>
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850 }}>{inventarioMovimientoForm.tipo === "conteo_fisico" ? "STOCK FINAL" : "CANTIDAD"}
                      <input type="number" min={0} step={1} value={inventarioMovimientoForm.cantidad} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, cantidad: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f" }} />
                    </label>
                    {inventarioMovimientoForm.tipo === "entrada_compra" && (
                      <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850 }}>COSTO UNITARIO (MXN)
                        <input type="number" min={0} step="0.01" value={inventarioMovimientoForm.costo_unitario} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, costo_unitario: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f" }} />
                      </label>
                    )}
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850 }}>PROVEEDOR
                      <input value={inventarioMovimientoForm.proveedor} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, proveedor: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f" }} />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850 }}>FOLIO / FACTURA
                      <input value={inventarioMovimientoForm.folio} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, folio: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f" }} />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 850, gridColumn: "span 2" }}>NOTAS
                      <input value={inventarioMovimientoForm.notas} onChange={(e) => setInventarioMovimientoForm({ ...inventarioMovimientoForm, notas: e.target.value })} style={{ padding: 9, border: "1px solid #d3b89f" }} />
                    </label>
                    <button type="button" onClick={registrarInventarioMovimiento} disabled={savingInventarioMovimiento} style={{ padding: 10, border: 0, background: savingInventarioMovimiento ? "#d7c8bb" : "#9a4c0e", color: "#fff", fontWeight: 900, cursor: savingInventarioMovimiento ? "wait" : "pointer" }}>
                      {savingInventarioMovimiento ? "Guardando..." : "Guardar movimiento"}
                    </button>
                  </div>
                </section>
              )}
              <section style={{ ...softCard, overflowX: "auto", borderColor: "#efd8c4" }}>
                <div style={{ padding: 13, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div><strong style={{ color: "#7c3f12" }}>Historial auditable</strong><div style={{ color: "#718397", fontSize: 11 }}>Entradas, salidas y conteos de esta sucursal.</div></div>
                  <button type="button" onClick={loadInventarioMovimientos} disabled={loadingInventarioMovimientos} style={{ ...actionBtnStyle, padding: "7px 10px" }}>{loadingInventarioMovimientos ? "Cargando..." : "Actualizar"}</button>
                </div>
                <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse", fontSize: 11 }}>
                  <thead><tr style={{ background: "#7c3f12", color: "#fff" }}>{["FECHA Y HORA","PRODUCTO","TIPO","CAMBIO","STOCK ANTERIOR","STOCK NUEVO","COSTO","PROVEEDOR / FOLIO","USUARIO","NOTAS"].map((label) => <th key={label} align="left" style={{ padding: 9 }}>{label}</th>)}</tr></thead>
                  <tbody>
                    {inventarioMovimientos.map((item) => <tr key={item.movimiento_id} style={{ borderTop: "1px solid #eadfd5" }}>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>{formatDateTimePretty(item.fecha_hora)}</td>
                      <td style={{ padding: 8 }}><strong>{item.producto}</strong><div style={{ color: "#718397" }}>{item.sku}</div></td>
                      <td style={{ padding: 8 }}>{formatStatsEtiqueta(item.tipo)}</td>
                      <td style={{ padding: 8, color: item.cantidad < 0 ? "#b91c1c" : "#166534", fontWeight: 900 }}>{item.cantidad > 0 ? "+" : ""}{item.cantidad}</td>
                      <td style={{ padding: 8 }}>{item.stock_anterior}</td><td style={{ padding: 8, fontWeight: 900 }}>{item.stock_nuevo}</td>
                      <td style={{ padding: 8 }}>{item.costo_unitario == null ? "—" : `$${Number(item.costo_unitario).toFixed(2)}`}</td>
                      <td style={{ padding: 8 }}>{item.proveedor || "—"}<div style={{ color: "#718397" }}>{item.folio || ""}</div></td>
                      <td style={{ padding: 8 }}>{item.usuario}</td><td style={{ padding: 8 }}>{item.notas || "—"}</td>
                    </tr>)}
                    {!loadingInventarioMovimientos && inventarioMovimientos.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#718397" }}>Todavía no hay movimientos registrados.</td></tr>}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {(isAdmin || isContador) && inventarioVista === "precios_opticos" && (
            <OpticalCatalogPricingAdmin apiFetch={apiFetch} canEdit={isAdmin} />
          )}

          {(isAdmin || isContador) && inventarioVista === "costos" && (
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
                    const costoDraft = inventarioCostoDraft[producto.producto_id] ?? producto.costo_unitario ?? "";
                    const costoConfirmado = costoDraft !== "";
                    const costo = costoConfirmado ? Math.max(0, Number(costoDraft)) : 0;
                    const precio = Math.max(0, Number(inventarioPrecioDraft[producto.producto_id] ?? producto.precio));
                    const stockRaw = inventarioStockDraft[producto.producto_id] ?? producto.stock;
                    const stock = producto.controla_stock
                      ? Math.max(0, Math.trunc(Number(stockRaw || 0)))
                      : 0;
                    const ganancia = precio - costo;
                    const margen = precio > 0 ? (ganancia / precio) * 100 : 0;
                    const sinCambios =
                      stock === Number(producto.stock || 0)
                      && precio === Number(producto.precio || 0)
                      && (costoConfirmado
                        ? costo === Number(producto.costo_unitario)
                        : producto.costo_unitario == null);
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
                            disabled={isContador}
                            min={0}
                            step="0.01"
                            value={precio}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setInventarioPrecioDraft((prev) => ({ ...prev, [producto.producto_id]: Number(e.target.value || 0) }))}
                            aria-label={`Precio de venta de ${producto.nombre}`}
                            style={{ width: "100%", padding: "7px 6px", border: "1px solid #8cb4df", textAlign: "right", fontWeight: 850 }}
                          />
                        </td>
                        <td align="right" style={{ padding: "7px 6px", background: "#effaf8" }}>
                          <input
                            type="number"
                            disabled={isContador}
                            min={0}
                            step="0.01"
                            value={costoDraft}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="Sin confirmar"
                            onChange={(e) => setInventarioCostoDraft((prev) => ({
                              ...prev,
                              [producto.producto_id]: e.target.value === "" ? "" : Number(e.target.value),
                            }))}
                            aria-label={`Costo unitario de ${producto.nombre}`}
                            style={{ width: "100%", padding: "7px 6px", border: "1px solid #75aaa3", textAlign: "right", fontWeight: 850 }}
                          />
                        </td>
                        <td align="right" style={{ padding: "9px 8px", background: ganancia >= 0 ? "#f0fdf4" : "#fef2f2", color: ganancia >= 0 ? "#166534" : "#991b1b", fontWeight: 900, whiteSpace: "nowrap" }}>
                          {costoConfirmado ? `$${ganancia.toFixed(2)}` : "Pendiente"}
                        </td>
                        <td align="right" style={{ padding: "9px 8px", background: "#f2fbf5", color: margen >= 0 ? "#166534" : "#991b1b", fontWeight: 900, whiteSpace: "nowrap" }}>{costoConfirmado ? `${margen.toFixed(1)}%` : "Pendiente"}</td>
                        <td align="center" style={{ padding: "7px 6px", background: "#fff8ed", color: "#92400e", fontWeight: 900 }}>
                          {producto.controla_stock ? (
                            <input
                              type="number"
                              disabled={isContador}
                              min={0}
                              step={1}
                              value={stockRaw}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={() => {
                                if (stockRaw === "") {
                                  setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: producto.stock }));
                                }
                              }}
                              onChange={(e) => {
                                const valor = e.target.value;
                                if (valor === "" || /^\d+$/.test(valor)) {
                                  setInventarioStockDraft((prev) => ({ ...prev, [producto.producto_id]: valor }));
                                }
                              }}
                              aria-label={`Nuevo stock total de ${producto.nombre}`}
                              style={{ width: "100%", padding: "7px 5px", border: "1px solid #d9a45e", textAlign: "center", fontWeight: 900 }}
                            />
                          ) : "Servicio"}
                        </td>
                        <td align="right" style={{ padding: "9px 8px", background: "#f8f5ff", fontWeight: 850, whiteSpace: "nowrap" }}>{costoConfirmado ? `$${(costo * stock).toFixed(2)}` : "Pendiente"}</td>
                        <td align="right" style={{ padding: "9px 8px", background: "#fbf4fc", color: ganancia >= 0 ? "#5b2166" : "#991b1b", fontWeight: 900, whiteSpace: "nowrap" }}>{costoConfirmado ? `$${(ganancia * stock).toFixed(2)}` : "Pendiente"}</td>
                        <td align="center" style={{ padding: "7px 6px", background: "#f9fafb" }}>
                          <button
                            type="button"
                            disabled={isContador || guardando || sinCambios}
                            onClick={() => guardarProductoInventario(producto)}
                            style={{
                              width: "100%",
                              padding: "8px 7px",
                              border: "1px solid #1d4ed8",
                              background: isContador || guardando || sinCambios ? "#e2e8f0" : "#2563eb",
                              color: isContador || guardando || sinCambios ? "#64748b" : "#fff",
                              fontWeight: 900,
                              cursor: guardando || sinCambios ? "not-allowed" : "pointer",
                            }}
                          >
                            {isContador ? "Solo lectura" : guardando ? "Guardando..." : "Guardar"}
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

      {(isAdmin || isContador) && tab === "finanzas" && (
        <div style={{ display: "grid", gap: 14 }}>
          <section style={{ ...softCard, padding: 16, background: "#f8fbff", borderColor: "#c7d9ec" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, color: "#173b61" }}>Finanzas</h2>
                <div style={{ marginTop: 4, color: "#6b7f93", fontSize: 12 }}>Ventas y pagos se integran automáticamente; no se capturan dos veces.</div>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button type="button" onClick={exportarFinanzasCsv} disabled={!finanzasData} style={{ ...actionBtnStyle, padding: "9px 12px" }}>Exportar CSV</button>
                <button type="button" onClick={() => loadFinanzas()} disabled={loadingFinanzas} style={{ ...actionBtnStyle, padding: "9px 12px", borderColor: "#174ea6", color: "#174ea6" }}>{loadingFinanzas ? "Actualizando..." : "Actualizar"}</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 13 }}>
              {(["hoy", "semana", "mes", "anio"] as const).map((periodo) => (
                <button key={periodo} type="button" onClick={() => aplicarPeriodoFinanzas(periodo)} style={{ ...actionBtnStyle, padding: "7px 10px", textTransform: "capitalize" }}>{periodo === "anio" ? "Año" : periodo}</button>
              ))}
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800 }}>DESDE <input type="date" value={finanzasDesde} onChange={(e) => setFinanzasDesde(e.target.value)} style={{ padding: 7, border: "1px solid #b9cce0" }} /></label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800 }}>HASTA <input type="date" value={finanzasHasta} onChange={(e) => setFinanzasHasta(e.target.value)} style={{ padding: 7, border: "1px solid #b9cce0" }} /></label>
              <button type="button" onClick={() => loadFinanzas()} style={{ padding: "7px 12px", border: "1px solid #0f766e", background: "#0f766e", color: "#fff", fontWeight: 900 }}>Aplicar rango</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 13, paddingTop: 12, borderTop: "1px solid #dbe6ef" }}>
              {([
                ["resumen", "Resumen"], ["movimientos", "Movimientos"], ["gastos", "Gastos"], ["nomina", "Nómina"],
                ["cobrar", "Cuentas por cobrar"], ["pagar", "Cuentas por pagar"], ["resultados", "Estado de resultados"],
                ["flujo", "Flujo de efectivo"], ["balance", "Balance general"],
              ] as Array<[typeof finanzasSeccion, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setFinanzasSeccion(value); setFinanzasForm({}); }} style={{ padding: "8px 11px", border: finanzasSeccion === value ? "1px solid #174ea6" : "1px solid #cbd8e4", background: finanzasSeccion === value ? "#174ea6" : "#fff", color: finanzasSeccion === value ? "#fff" : "#40566c", fontWeight: 850, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
          </section>

          {finanzasError && <div style={{ padding: 11, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 750 }}>{finanzasError}</div>}
          {loadingFinanzas && !finanzasData ? (
            <div style={{ ...softCard, padding: 30, textAlign: "center", color: "#60758a" }}>Cargando información financiera...</div>
          ) : finanzasData && (
            <>
              {finanzasSeccion === "resumen" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                  {[
                    ["Ingresos por ventas", "ingresos_ventas", "#174ea6"], ["Descuentos", "descuentos", "#b45309"], ["Dinero cobrado", "dinero_cobrado", "#0f766e"],
                    ["Saldos pendientes", "saldos_pendientes", "#c2410c"], ["Costo de productos", "costo_productos", "#6d4b9c"], ["Gastos", "gastos", "#b91c1c"],
                    ["Nómina", "nomina", "#9f1239"], ["Utilidad bruta", "utilidad_bruta", "#166534"], ["Utilidad neta", "utilidad_neta", "#0f5132"], ["Valor de inventario", "valor_inventario", "#5b2166"],
                  ].map(([label, key, color]) => (
                    <div key={key} style={{ ...softCard, padding: 14, borderColor: "#dbe6ef" }}>
                      <div style={{ color: "#60758a", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ marginTop: 5, color, fontSize: 23, fontWeight: 950 }}>${Number(finanzasData.resumen[key] || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}

              {finanzasSeccion === "movimientos" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <form onSubmit={(e) => { e.preventDefault(); crearRegistroFinanzas("movimientos", finanzasForm); }} style={{ ...softCard, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                    <input type="datetime-local" value={finanzasForm.fecha || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, fecha: e.target.value })} aria-label="Fecha del movimiento" style={{ padding: 9, border: "1px solid #cbd8e4" }} />
                    <input required placeholder="Cuenta: caja, banco..." value={finanzasForm.cuenta || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, cuenta: e.target.value })} style={{ padding: 9, border: "1px solid #cbd8e4" }} />
                    <select value={finanzasForm.tipo || "ingreso"} onChange={(e) => setFinanzasForm({ ...finanzasForm, tipo: e.target.value })} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select>
                    <input required placeholder="Categoría" value={finanzasForm.categoria || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, categoria: e.target.value })} style={{ padding: 9, border: "1px solid #cbd8e4" }} />
                    <input required placeholder="Descripción" value={finanzasForm.descripcion || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, descripcion: e.target.value })} style={{ padding: 9, border: "1px solid #cbd8e4" }} />
                    <input required type="number" min="0.01" step="0.01" placeholder="Monto" value={finanzasForm.monto || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, monto: Number(e.target.value) })} style={{ padding: 9, border: "1px solid #cbd8e4" }} />
                    <button disabled={savingFinanzas} style={{ padding: 10, border: 0, background: "#0f766e", color: "#fff", fontWeight: 900 }}>{savingFinanzas ? "Guardando..." : "Registrar movimiento"}</button>
                  </form>
                  <div style={{ ...softCard, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#173b61", color: "#fff" }}>{["FECHA","CUENTA","TIPO","CATEGORÍA","DESCRIPCIÓN","FUENTE","MONTO"].map((h) => <th key={h} align={h === "MONTO" ? "right" : "left"} style={{ padding: 9 }}>{h}</th>)}</tr></thead><tbody>{finanzasData.movimientos.map((item, i) => <tr key={`${item.fuente}-${i}`} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 8 }}>{formatDateTimePretty(item.fecha)}</td><td style={{ padding: 8 }}>{formatMetodoPagoLabel(item.cuenta)}</td><td style={{ padding: 8, color: item.tipo === "ingreso" ? "#166534" : "#b91c1c", fontWeight: 900 }}>{item.tipo}</td><td style={{ padding: 8 }}>{item.categoria}</td><td style={{ padding: 8 }}>{item.descripcion}</td><td style={{ padding: 8 }}>{item.fuente}</td><td align="right" style={{ padding: 8, fontWeight: 900 }}>${Number(item.monto).toFixed(2)}</td></tr>)}</tbody></table></div>
                </div>
              )}

              {finanzasSeccion === "gastos" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <form onSubmit={(e) => { e.preventDefault(); crearRegistroFinanzas("gastos", finanzasForm); }} style={{ ...softCard, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
                    <input required type="date" value={finanzasForm.fecha || finanzasHasta} onChange={(e) => setFinanzasForm({ ...finanzasForm, fecha: e.target.value })} />
                    <select required value={finanzasForm.categoria || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, categoria: e.target.value })}><option value="">Categoría...</option>{["renta","servicios","publicidad","software","reparaciones","proveedores","impuestos","otro"].map((x) => <option key={x} value={x}>{formatStatsEtiqueta(x)}</option>)}</select>
                    <input placeholder="Proveedor" value={finanzasForm.proveedor || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, proveedor: e.target.value })} />
                    <input required placeholder="Descripción" value={finanzasForm.descripcion || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, descripcion: e.target.value })} />
                    <input required type="number" min="0.01" step="0.01" placeholder="Monto" value={finanzasForm.monto || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, monto: Number(e.target.value) })} />
                    <input placeholder="Cuenta" value={finanzasForm.cuenta || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, cuenta: e.target.value })} />
                    <select value={finanzasForm.estado || "pendiente"} onChange={(e) => setFinanzasForm({ ...finanzasForm, estado: e.target.value })}>{["pendiente","pagado","aprobado","cancelado"].map((x) => <option key={x} value={x}>{formatStatsEtiqueta(x)}</option>)}</select>
                    <label style={{ display: "grid", gap: 3, fontSize: 10, fontWeight: 850 }}>COMPROBANTE (PDF O IMAGEN)
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFinanzasForm({ ...finanzasForm, comprobante_file: e.target.files?.[0] || null })} />
                    </label>
                    <button disabled={savingFinanzas} style={{ padding: 10, border: 0, background: "#0f766e", color: "#fff", fontWeight: 900 }}>Registrar gasto</button>
                  </form>
                  <div style={{ ...softCard, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#7f1d1d", color: "#fff" }}>{["FECHA","CATEGORÍA","PROVEEDOR","DESCRIPCIÓN","ESTADO","MONTO","COMPROBANTE"].map((h) => <th key={h} align={h === "MONTO" ? "right" : "left"} style={{ padding: 9 }}>{h}</th>)}</tr></thead><tbody>{finanzasData.gastos.map((item) => <tr key={item.gasto_id} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 8 }}>{item.fecha}</td><td style={{ padding: 8 }}>{formatStatsEtiqueta(item.categoria)}</td><td style={{ padding: 8 }}>{item.proveedor || "—"}</td><td style={{ padding: 8 }}>{item.descripcion}</td><td style={{ padding: 8 }}><select value={item.estado} disabled={savingFinanzas} onChange={(e) => actualizarEstadoFinanzas("gastos", item.gasto_id, e.target.value)}>{["pendiente","pagado","aprobado","cancelado"].map((estado) => <option key={estado} value={estado}>{formatStatsEtiqueta(estado)}</option>)}</select></td><td align="right" style={{ padding: 8, fontWeight: 900 }}>${item.monto.toFixed(2)}</td><td style={{ padding: 8 }}>{item.comprobante_id ? <button type="button" onClick={() => abrirComprobanteFinanzas(item.comprobante_id)} style={{ ...actionBtnStyle, padding: "5px 8px" }}>Abrir</button> : "—"}</td></tr>)}</tbody></table></div>
                </div>
              )}

              {finanzasSeccion === "nomina" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <form onSubmit={(e) => { e.preventDefault(); crearRegistroFinanzas("nomina", finanzasForm); }} style={{ ...softCard, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                    <input required placeholder="Empleado" value={finanzasForm.empleado || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, empleado: e.target.value })} />
                    <input required type="date" aria-label="Inicio del periodo" value={finanzasForm.periodo_inicio || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, periodo_inicio: e.target.value })} />
                    <input required type="date" aria-label="Fin del periodo" value={finanzasForm.periodo_fin || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, periodo_fin: e.target.value })} />
                    {[["salario_base","Salario"],["horas","Horas"],["comisiones","Comisiones"],["bonos","Bonos"],["deducciones","Deducciones"],["pago_neto","Pago neto"],["costo_patronal","Costo patronal"]].map(([key,label]) => <input key={key} type="number" min="0" step="0.01" placeholder={label} value={finanzasForm[key] || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, [key]: Number(e.target.value) })} />)}
                    <input type="date" aria-label="Fecha de pago" value={finanzasForm.fecha_pago || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, fecha_pago: e.target.value })} />
                    <select value={finanzasForm.estado || "pendiente"} onChange={(e) => setFinanzasForm({ ...finanzasForm, estado: e.target.value })}><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="aprobada">Aprobada</option><option value="cancelada">Cancelada</option></select>
                    <button disabled={savingFinanzas} style={{ padding: 10, border: 0, background: "#6d4b9c", color: "#fff", fontWeight: 900 }}>Registrar nómina</button>
                  </form>
                  <div style={{ ...softCard, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#5b2166", color: "#fff" }}>{["EMPLEADO","PERIODO","SALARIO","HORAS","COMISIONES","BONOS","DEDUCCIONES","NETO","COSTO PATRONAL","ESTADO"].map((h) => <th key={h} align="left" style={{ padding: 8 }}>{h}</th>)}</tr></thead><tbody>{finanzasData.nomina.map((item) => <tr key={item.nomina_id} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 8 }}>{item.empleado}</td><td style={{ padding: 8 }}>{item.periodo_inicio}–{item.periodo_fin}</td><td style={{ padding: 8 }}>${item.salario_base.toFixed(2)}</td><td style={{ padding: 8 }}>{item.horas}</td><td style={{ padding: 8 }}>${item.comisiones.toFixed(2)}</td><td style={{ padding: 8 }}>${item.bonos.toFixed(2)}</td><td style={{ padding: 8 }}>${item.deducciones.toFixed(2)}</td><td style={{ padding: 8, fontWeight: 900 }}>${item.pago_neto.toFixed(2)}</td><td style={{ padding: 8 }}>${item.costo_patronal.toFixed(2)}</td><td style={{ padding: 8 }}><select value={item.estado} disabled={savingFinanzas} onChange={(e) => actualizarEstadoFinanzas("nomina", item.nomina_id, e.target.value)}>{["pendiente","pagada","aprobada","cancelada"].map((estado) => <option key={estado} value={estado}>{formatStatsEtiqueta(estado)}</option>)}</select></td></tr>)}</tbody></table></div>
                  <div style={{ color: "#718397", fontSize: 11 }}>Registro administrativo únicamente: no calcula impuestos mexicanos ni genera CFDI de nómina.</div>
                </div>
              )}

              {finanzasSeccion === "cobrar" && (
                <div style={{ ...softCard, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#9a4c0e", color: "#fff" }}>{["VENTA","FECHA","CLIENTE","TOTAL","PAGADO","SALDO","ESTADO"].map((h) => <th key={h} align={h === "TOTAL" || h === "PAGADO" || h === "SALDO" ? "right" : "left"} style={{ padding: 9 }}>{h}</th>)}</tr></thead><tbody>{finanzasData.cuentas_cobrar.map((item) => <tr key={item.venta_id} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 8 }}>#{item.venta_id}</td><td style={{ padding: 8 }}>{formatDateTimePretty(item.fecha)}</td><td style={{ padding: 8 }}>{item.cliente}</td><td align="right" style={{ padding: 8 }}>${item.total.toFixed(2)}</td><td align="right" style={{ padding: 8 }}>${item.pagado.toFixed(2)}</td><td align="right" style={{ padding: 8, color: "#c2410c", fontWeight: 900 }}>${item.saldo.toFixed(2)}</td><td style={{ padding: 8 }}>{formatStatsEtiqueta(item.estado_pago)}</td></tr>)}</tbody></table></div>
              )}

              {finanzasSeccion === "pagar" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <form onSubmit={(e) => { e.preventDefault(); crearRegistroFinanzas("cuentas-pagar", finanzasForm); }} style={{ ...softCard, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 8 }}>
                    <input required placeholder="Proveedor" value={finanzasForm.proveedor || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, proveedor: e.target.value })} />
                    <input required placeholder="Categoría" value={finanzasForm.categoria || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, categoria: e.target.value })} />
                    <input required placeholder="Concepto" value={finanzasForm.concepto || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, concepto: e.target.value })} />
                    <input placeholder="Folio" value={finanzasForm.folio || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, folio: e.target.value })} />
                    <input required type="date" aria-label="Fecha de emisión" value={finanzasForm.fecha_emision || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, fecha_emision: e.target.value })} />
                    <input type="date" aria-label="Fecha de vencimiento" value={finanzasForm.fecha_vencimiento || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, fecha_vencimiento: e.target.value })} />
                    <input required type="number" min="0.01" step="0.01" placeholder="Monto total" value={finanzasForm.monto_total || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, monto_total: Number(e.target.value) })} />
                    <input type="number" min="0" step="0.01" placeholder="Monto pagado" value={finanzasForm.monto_pagado || ""} onChange={(e) => setFinanzasForm({ ...finanzasForm, monto_pagado: Number(e.target.value) })} />
                    <label style={{ display: "grid", gap: 3, fontSize: 10, fontWeight: 850 }}>FACTURA / COMPROBANTE
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFinanzasForm({ ...finanzasForm, comprobante_file: e.target.files?.[0] || null })} />
                    </label>
                    <button disabled={savingFinanzas} style={{ padding: 10, border: 0, background: "#b46516", color: "#fff", fontWeight: 900 }}>Registrar obligación</button>
                  </form>
                  <div style={{ ...softCard, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", fontSize: 11 }}><thead><tr style={{ background: "#8a3d0a", color: "#fff" }}>{["PROVEEDOR","CATEGORÍA","CONCEPTO","FOLIO","EMISIÓN","VENCIMIENTO","TOTAL","PAGADO","SALDO","ESTADO","COMPROBANTE","ACCIÓN"].map((h) => <th key={h} align="left" style={{ padding: 8 }}>{h}</th>)}</tr></thead><tbody>{finanzasData.cuentas_pagar.map((item) => { const pagoDraft = finanzasCxpPagoDraft[item.cuenta_pagar_id] ?? String(item.monto_pagado); return <tr key={item.cuenta_pagar_id} style={{ borderTop: "1px solid #e2e8f0" }}><td style={{ padding: 8 }}>{item.proveedor}</td><td style={{ padding: 8 }}>{item.categoria}</td><td style={{ padding: 8 }}>{item.concepto}</td><td style={{ padding: 8 }}>{item.folio || "—"}</td><td style={{ padding: 8 }}>{item.fecha_emision}</td><td style={{ padding: 8 }}>{item.fecha_vencimiento || "—"}</td><td style={{ padding: 8 }}>${item.monto_total.toFixed(2)}</td><td style={{ padding: 8 }}><input type="number" min={0} max={item.monto_total} step="0.01" value={pagoDraft} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setFinanzasCxpPagoDraft((prev) => ({ ...prev, [item.cuenta_pagar_id]: e.target.value }))} style={{ width: 90, padding: 6 }} /></td><td style={{ padding: 8, color: "#c2410c", fontWeight: 900 }}>${Math.max(0, item.monto_total - Number(pagoDraft || 0)).toFixed(2)}</td><td style={{ padding: 8 }}><select value={item.estado} disabled={savingFinanzas} onChange={(e) => actualizarEstadoFinanzas("cuentas_pagar", item.cuenta_pagar_id, e.target.value, Number(pagoDraft || 0))}>{["pendiente","parcial","pagada","cancelada"].map((estado) => <option key={estado} value={estado}>{formatStatsEtiqueta(estado)}</option>)}</select></td><td style={{ padding: 8 }}>{item.comprobante_id ? <button type="button" onClick={() => abrirComprobanteFinanzas(item.comprobante_id)} style={{ ...actionBtnStyle, padding: "5px 8px" }}>Abrir</button> : "—"}</td><td style={{ padding: 8 }}><button type="button" disabled={savingFinanzas} onClick={() => { const monto = Number(pagoDraft || 0); const estado = monto >= item.monto_total ? "pagada" : monto > 0 ? "parcial" : "pendiente"; actualizarEstadoFinanzas("cuentas_pagar", item.cuenta_pagar_id, estado, monto); }} style={{ ...actionBtnStyle, padding: "6px 9px" }}>Guardar</button></td></tr>; })}</tbody></table></div>
                </div>
              )}

              {finanzasSeccion === "resultados" && (
                <section style={{ ...softCard, padding: 18, maxWidth: 820 }}><h3 style={{ marginTop: 0, color: "#173b61" }}>Estado de resultados</h3>{Object.entries(finanzasData.estado_resultados).map(([key, value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 10, borderTop: "1px solid #e2e8f0", fontWeight: key.includes("utilidad") ? 900 : 650 }}><span>{formatStatsEtiqueta(key)}</span><strong style={{ color: Number(value) < 0 ? "#b91c1c" : "#173b61" }}>${Number(value).toFixed(2)}</strong></div>)}</section>
              )}
              {finanzasSeccion === "flujo" && (
                <section style={{ ...softCard, padding: 18, maxWidth: 820 }}><h3 style={{ marginTop: 0, color: "#0f766e" }}>Flujo de efectivo</h3>{Object.entries(finanzasData.flujo_efectivo).map(([key, value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 10, borderTop: "1px solid #e2e8f0" }}><span>{formatStatsEtiqueta(key)}</span><strong>${Number(value).toFixed(2)}</strong></div>)}</section>
              )}
              {finanzasSeccion === "balance" && (
                <section style={{ ...softCard, padding: 18, maxWidth: 820 }}><h3 style={{ marginTop: 0, color: "#5b2166" }}>Balance general</h3>{Object.entries(finanzasData.balance_general).map(([key, value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 10, borderTop: "1px solid #e2e8f0", fontWeight: ["activos","pasivos","capital_contable"].includes(key) ? 900 : 650 }}><span>{formatStatsEtiqueta(key)}</span><strong style={{ color: Number(value) < 0 ? "#b91c1c" : "#5b2166" }}>${Number(value).toFixed(2)}</strong></div>)}</section>
              )}
            </>
          )}
        </div>
      )}

      {!isContador && tab === "estadisticas" && (
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
              src={resolveCatalogMediaUrl(inventarioImagenAmpliada.imagen_url)}
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

      {prescripcionVentaOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, .58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1002,
            padding: 16,
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              try {
                await crearPrescripcionVenta();
              } catch (e: any) {
                setError(e?.message ?? String(e));
              }
            }}
            style={{ width: 720, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", padding: 18, border: "1px solid #cbd8e4", background: "#fff", boxShadow: "0 20px 55px rgba(15,23,42,.28)" }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: "#173b61" }}>Registrar receta óptica</div>
            <div style={{ marginTop: 4, color: "#6b7f93", fontSize: 12 }}>La receta quedará vinculada al paciente seleccionado y podrá usarse únicamente en sus configuraciones.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 9, marginTop: 14 }}>
              <label style={{ display: "grid", gap: 4 }}>Origen<select value={prescripcionVentaForm.origen} onChange={(event) => setPrescripcionVentaForm((prev) => ({ ...prev, origen: event.target.value as "interna" | "externa_cliente" }))} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}><option value="interna">Interna</option><option value="externa_cliente">Externa del cliente</option></select></label>
              <label style={{ display: "grid", gap: 4 }}>Fecha<input type="date" value={prescripcionVentaForm.fecha_prescripcion} onChange={(event) => setPrescripcionVentaForm((prev) => ({ ...prev, fecha_prescripcion: event.target.value }))} style={{ padding: 9, border: "1px solid #cbd8e4" }} /></label>
              {prescripcionVentaForm.origen === "externa_cliente" && <label style={{ display: "grid", gap: 4 }}>Referencia externa<input value={prescripcionVentaForm.referencia_externa} onChange={(event) => setPrescripcionVentaForm((prev) => ({ ...prev, referencia_externa: event.target.value }))} style={{ padding: 9, border: "1px solid #cbd8e4" }} /></label>}
            </div>
            {(["od", "oi"] as const).map((ojo) => (
              <section key={ojo} style={{ marginTop: 12, padding: 11, border: "1px solid #dbe6ef", background: "#f8fbff" }}>
                <strong style={{ color: "#173b61" }}>{ojo === "od" ? "Ojo derecho" : "Ojo izquierdo"}</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(100px, 1fr))", gap: 8, marginTop: 8 }}>
                  {(["esfera", "cilindro", "eje", "adicion"] as const).map((campo) => {
                    const key = `${ojo}_${campo}` as keyof typeof prescripcionVentaForm;
                    return <label key={key} style={{ display: "grid", gap: 4, fontSize: 11 }}>{campo.charAt(0).toUpperCase() + campo.slice(1)}<input inputMode="decimal" value={String(prescripcionVentaForm[key] || "")} onChange={(event) => setPrescripcionVentaForm((prev) => ({ ...prev, [key]: event.target.value }))} style={{ padding: 8, border: "1px solid #cbd8e4" }} /></label>;
                  })}
                </div>
              </section>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, .5fr) minmax(220px, 1fr)", gap: 9, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>Distancia pupilar<input inputMode="decimal" value={prescripcionVentaForm.distancia_pupilar} onChange={(event) => setPrescripcionVentaForm((prev) => ({ ...prev, distancia_pupilar: event.target.value }))} style={{ padding: 9, border: "1px solid #cbd8e4" }} /></label>
              <label style={{ display: "grid", gap: 4 }}>Notas<input value={prescripcionVentaForm.notas} onChange={(event) => setPrescripcionVentaForm((prev) => ({ ...prev, notas: event.target.value }))} style={{ padding: 9, border: "1px solid #cbd8e4" }} /></label>
            </div>
            {error && <div style={{ marginTop: 10, padding: 9, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setPrescripcionVentaOpen(false)} style={{ ...actionBtnStyle, padding: 10 }}>Cancelar</button>
              <button type="submit" style={{ padding: 10, border: "1px solid #0f766e", background: "#0f766e", color: "#fff", fontWeight: 900 }}>Guardar receta</button>
            </div>
          </form>
        </div>
      )}

      {ventaConfirmacionOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, .58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
            padding: 16,
          }}
        >
          <div style={{ width: 860, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", background: "#fff", border: "1px solid #cbd8e4", boxShadow: "0 20px 55px rgba(15,23,42,.28)", padding: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 21, color: "#173b61" }}>
              {editingVentaId !== null ? "Confirmar edición de la venta" : "Confirmar y guardar venta"}
            </div>
            <div style={{ marginTop: 5, color: "#6b7f93", fontSize: 12 }}>
              {editingVentaId !== null
                ? "¿Seguro que quieres proceder con esta edición?"
                : "Revisa una vez más antes de guardar y descontar las existencias."}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 14, padding: 12, border: "1px solid #dbe6ef", background: "#f8fbff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#6b7f93" }}>Paciente</span>
                <strong style={{ textAlign: "right", color: "#173b61" }}>
                  {pacientesVentaOpciones.find((paciente) => paciente.id === formVenta.paciente_id)?.label || `#${formVenta.paciente_id}`}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#6b7f93" }}>Productos diferentes</span>
                <strong>{ventaCarritoDetalle.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#6b7f93" }}>Total</span>
                <strong style={{ color: "#174ea6" }}>${ventaTotalCarrito.toFixed(2)} MXN</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#6b7f93" }}>Pagado</span>
                <strong>${ventaMontoPagado.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#6b7f93" }}>Saldo por pagar</span>
                <strong style={{ color: ventaSaldo > 0 ? "#c2410c" : "#166534" }}>${ventaSaldo.toFixed(2)}</strong>
              </div>
              {["meses_sin_intereses", "meses_con_intereses"].includes(formVenta.forma_liquidacion || "") && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#6b7f93" }}>Financiamiento</span>
                  <strong style={{ textAlign: "right" }}>
                    {formatFormaLiquidacionLabel(formVenta.forma_liquidacion)} · {formVenta.plazo_meses || "Sin plazo"} meses
                  </strong>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, border: "1px solid #dbe6ef", background: "#fff" }}>
              <div style={{ padding: "9px 11px", borderBottom: "1px solid #dbe6ef", background: "#eef5fb", color: "#173b61", fontWeight: 900 }}>
                Detalle del pedido
              </div>
              <div style={{ display: "grid", gap: 0 }}>
                {ventaCarritoDetalle.map(({ producto, cantidad }, index) => {
                  const detalleGrado = producto.tipo_mica === "tinte" && ventaTinteGrado
                    ? ` · ${ventaTinteGrado.replace("_", " ")}`
                    : "";
                  return (
                    <div
                      key={`confirmar-${producto.producto_id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px minmax(0, 1fr) 90px 110px",
                        gap: 10,
                        alignItems: "center",
                        padding: "9px 11px",
                        borderTop: index === 0 ? "none" : "1px solid #edf1f5",
                      }}
                    >
                      <strong style={{ color: "#6b7f93" }}>{index + 1}</strong>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", color: "#173b61" }}>{producto.nombre}</strong>
                        <span style={{ display: "block", marginTop: 2, color: "#718397", fontSize: 10 }}>
                          {producto.sku}
                          {producto.modelo ? ` · ${producto.modelo}` : ""}
                          {producto.color ? ` · ${producto.color}` : ""}
                          {detalleGrado}
                        </span>
                      </span>
                      <span style={{ textAlign: "right", color: "#526b7b" }}>{cantidad} × ${Number(producto.precio || 0).toFixed(2)}</span>
                      <strong style={{ textAlign: "right", color: "#174ea6" }}>${(cantidad * Number(producto.precio || 0)).toFixed(2)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(250px, .75fr)", gap: 12, marginTop: 12 }}>
              <section style={{ border: "1px solid #dbe6ef", background: "#f8fbff", padding: 11 }}>
                <div style={{ marginBottom: 7, color: "#173b61", fontWeight: 900 }}>Configuraciones ópticas</div>
                <div style={{ display: "grid", gap: 8, fontSize: 11 }}>
                  {ventaConfiguraciones.length === 0 && <span style={{ color: "#718397" }}>Esta venta no contiene pares configurados.</span>}
                  {ventaConfiguraciones.map((config, index) => {
                    const frame = inventario.find((item) => item.producto_id === config.armazon_producto_id);
                    const design = inventario.find((item) => item.producto_id === config.diseno_producto_id);
                    const treatment = inventario.find((item) => item.producto_id === config.tratamiento_producto_id);
                    const variant = treatment?.variantes?.find((item) => item.variante_id === config.variante_id);
                    const prescription = prescripcionesVenta.find((item) => item.prescripcion_id === config.prescripcion_id);
                    return <div key={`confirm-config-${config.configuracion_ref}`} style={{ padding: 9, border: "1px solid #cbd8e4", background: "#fff" }}>
                      <strong style={{ display: "block", color: "#173b61" }}>Par {index + 1} · {config.tipo_configuracion.replaceAll("_", " ")}</strong>
                      <span style={{ display: "block", marginTop: 4 }}>Armazón: <strong>{frame?.nombre || "Armazón del cliente / no aplica"}</strong></span>
                      <span style={{ display: "block", marginTop: 3 }}>Diseño: <strong>{design?.nombre || "No aplica"}</strong></span>
                      <span style={{ display: "block", marginTop: 3 }}>Tratamiento: <strong>{treatment ? `${treatment.nombre}${variant ? ` · ${variant.nombre}` : ""}` : "Sin tratamiento"}</strong></span>
                      <span style={{ display: "block", marginTop: 3 }}>Uso: <strong>{config.uso_visual.replaceAll("_", " ")}{config.uso_visual_otro ? ` · ${config.uso_visual_otro}` : ""}</strong></span>
                      <span style={{ display: "block", marginTop: 3 }}>Receta: <strong>{prescription ? `#${prescription.prescripcion_id} · ${prescription.fecha_prescripcion || "sin fecha"}` : "No requerida"}</strong></span>
                      <span style={{ display: "block", marginTop: 3 }}>Abasto: <strong>{config.comportamiento_abasto_usado.replaceAll("_", " ")}</strong></span>
                    </div>;
                  })}
                </div>
              </section>
              <section style={{ border: "1px solid #dbe6ef", background: "#fff", padding: 11 }}>
                <div style={{ marginBottom: 7, color: "#173b61", fontWeight: 900 }}>Pagos capturados</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {ventaPagos.filter((pago) => Number(pago.monto || 0) > 0).map((pago, index) => (
                    <div key={`confirmar-pago-${pago.ui_id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                      <span style={{ color: "#526b7b" }}>Pago {index + 1} · {formatMetodoPagoLabel(pago.metodo)}</span>
                      <strong>${Number(pago.monto || 0).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div style={{ marginTop: 12, padding: 10, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", fontSize: 12 }}>
              {editingVentaId !== null
                ? "Al confirmar se guardarán todos los cambios. Permanecerás en esta venta hasta presionar “Completar edición”."
                : "Presiona “Sí, guardar venta” para completar el registro. Esta es la confirmación final."}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setVentaConfirmacionOpen(false)}
                disabled={savingVenta}
                style={{ ...actionBtnStyle, padding: "10px 12px" }}
              >
                Volver a revisar
              </button>
              <button
                type="button"
                onClick={() => {
                  ventaSubmitConfirmadoRef.current = true;
                  setVentaConfirmacionOpen(false);
                  ventaFormRef.current?.requestSubmit();
                }}
                disabled={savingVenta}
                style={{ padding: "10px 12px", border: "1px solid #0f766e", background: savingVenta ? "#dfe9e8" : "#0f766e", color: savingVenta ? "#526b7b" : "#fff", fontWeight: 900, cursor: savingVenta ? "wait" : "pointer" }}
              >
                {savingVenta ? "Guardando..." : editingVentaId !== null ? "Sí, guardar cambios" : "Sí, guardar venta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVentaDetalle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: 1180,
              maxWidth: "98vw",
              maxHeight: "94vh",
              borderRadius: 14,
              border: "1px solid #cbd8e4",
              boxShadow: "0 20px 55px rgba(15,23,42,.28)",
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
            }}
          >
            <div style={{ padding: "15px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid #dbe6ef", background: "#f8fbff" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22, color: "#173b61" }}>
                  Venta #{selectedVentaDetalle.venta_id}
                </div>
                <div style={{ marginTop: 3, color: "#6b7f93", fontSize: 12 }}>
                  {formatDateTimePretty(selectedVentaDetalle.fecha_hora)} · {selectedVentaDetalle.paciente_nombre}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {canEditVenta && (
                  <button
                    type="button"
                    onClick={() => {
                      const venta = selectedVentaDetalle;
                      closeVentaDetalle();
                      startEditVenta(venta);
                    }}
                    style={{ ...actionBtnStyle, padding: "9px 13px", borderColor: "#0f766e", background: "#0f766e", color: "#fff" }}
                  >
                    Abrir en Ventas y editar
                  </button>
                )}
                {canDeleteVenta && (
                  <button
                    type="button"
                    onClick={() => {
                      const ventaId = selectedVentaDetalle.venta_id;
                      closeVentaDetalle();
                      askDeleteVenta(ventaId);
                    }}
                    style={{ ...actionBtnStyle, padding: "9px 13px", borderColor: "#dc2626", background: "#fff5f5", color: "#b91c1c" }}
                  >
                    Eliminar venta
                  </button>
                )}
                <button type="button" onClick={closeVentaDetalle} style={{ ...actionBtnStyle, padding: "9px 13px" }}>
                  Cerrar
                </button>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, .85fr)", gap: 16, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
                  <section style={{ border: "1px solid #cbdcf0", background: "#f8fbff", padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "#16385d" }}>Resumen de productos</div>
                        <div style={{ marginTop: 2, color: "#6b7f93", fontSize: 11 }}>
                          {selectedVentaDetalle.productos?.length || 0} producto(s) diferente(s)
                        </div>
                      </div>
                      <strong style={{ color: "#174ea6", fontSize: 18 }}>
                        ${Number(selectedVentaDetalle.monto_total || 0).toFixed(2)}
                      </strong>
                    </div>

                    {(() => {
                      const micasGuardadas = (selectedVentaDetalle.productos || []).filter(
                        (producto) => producto.categoria === "micas",
                      );
                      const tokensMicas = (selectedVentaDetalle.compra || "")
                        .split("|")
                        .map((token) => token.trim())
                        .filter((token) => token.includes("mica") || token.includes("tinte") || token.includes("bifocal") || token.includes("monofocal") || token.includes("progres"));
                      const gradoTinteGuardado = tokensMicas.find((token) => /^tinte_grado_[123]$/.test(token));
                      if (micasGuardadas.length === 0 && tokensMicas.length === 0) return null;
                      return (
                        <div style={{ marginBottom: 10, padding: 10, border: "1px solid #b9d8d3", background: "#f0fdfa" }}>
                          <div style={{ marginBottom: 7, color: "#0f766e", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
                            Micas, diseño y tratamientos
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {micasGuardadas.length > 0
                              ? micasGuardadas.map((producto) => (
                                  <span key={`mica-resumen-${producto.producto_id}`} style={{ padding: "6px 9px", border: "1px solid #99c9c1", background: "#fff", color: "#174f4a", fontSize: 11, fontWeight: 800 }}>
                                    {producto.subcategoria === "diseno"
                                      ? "Diseño"
                                      : producto.subcategoria === "tratamiento"
                                        ? "Tratamiento"
                                        : "Micas"}: {producto.nombre}
                                    {producto.tipo_mica ? ` · ${producto.tipo_mica.replace(/_/g, " ")}` : ""}
                                    {` · $${Number(producto.subtotal || 0).toFixed(2)}`}
                                  </span>
                                ))
                              : tokensMicas.map((token) => (
                                  <span key={`mica-token-${token}`} style={{ padding: "6px 9px", border: "1px solid #99c9c1", background: "#fff", color: "#174f4a", fontSize: 11, fontWeight: 800 }}>
                                    {formatVentaCompraLabel(token)}
                                  </span>
                                ))}
                            {micasGuardadas.length > 0 && gradoTinteGuardado && (
                              <span style={{ padding: "6px 9px", border: "1px solid #d8b98f", background: "#fff8ed", color: "#784718", fontSize: 11, fontWeight: 900, textTransform: "capitalize" }}>
                                Grado del tinte: {gradoTinteGuardado.replace("tinte_grado_", "grado ")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {selectedVentaDetalle.productos && selectedVentaDetalle.productos.length > 0 ? (
                      <div style={{ display: "grid", gap: 7 }}>
                        {selectedVentaDetalle.productos.map((producto) => {
                          const esMica = producto.categoria === "micas";
                          return (
                            <div
                              key={`detalle-producto-${producto.producto_id}`}
                              style={{
                                display: "grid",
                                gridTemplateColumns: esMica ? "minmax(0, 1fr) 75px 100px" : "54px minmax(0, 1fr) 75px 100px",
                                gap: 9,
                                alignItems: "center",
                                padding: 9,
                                border: "1px solid #dbe6ef",
                                background: "#fff",
                              }}
                            >
                              {!esMica && (
                                <div style={{ width: 54, height: 48, overflow: "hidden", border: "1px solid #e3e9ee", background: "#f5f7f9" }}>
                                  {producto.imagen_url ? (
                                    <img src={resolveCatalogMediaUrl(producto.imagen_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8aa0b2" }}>◇</span>
                                  )}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <strong style={{ display: "block", color: "#173b61" }}>{producto.nombre}</strong>
                                <span style={{ display: "block", marginTop: 2, color: "#6b7f93", fontSize: 11 }}>
                                  {producto.sku}
                                  {producto.modelo ? ` · ${producto.modelo}` : ""}
                                  {producto.color ? ` · ${producto.color}` : ""}
                                </span>
                                <span style={{ display: "block", marginTop: 3, color: "#0f766e", fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                                  {producto.subcategoria || producto.categoria}
                                  {producto.tipo_mica ? ` · ${producto.tipo_mica.replace(/_/g, " ")}` : ""}
                                </span>
                              </div>
                              <div style={{ textAlign: "center", color: "#526b7b", fontSize: 12 }}>
                                <strong>{producto.cantidad}</strong> × ${Number(producto.precio_unitario || 0).toFixed(2)}
                              </div>
                              <strong style={{ textAlign: "right", color: "#174ea6" }}>
                                ${Number(producto.subtotal || 0).toFixed(2)}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: 12, border: "1px dashed #b9cde0", background: "#fff" }}>
                        <div style={{ marginBottom: 7, color: "#6b7f93", fontSize: 11 }}>
                          Venta anterior sin detalle individual de inventario:
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(selectedVentaDetalle.compra ?? "")
                            .split("|")
                            .map((item) => item.trim())
                            .filter(Boolean)
                            .map((item) => (
                              <span key={`modal-venta-${selectedVentaDetalle.venta_id}-${item}`} style={{ padding: "5px 8px", borderRadius: 999, border: "1px solid #d9c7b3", background: "#fff", fontSize: 11, fontWeight: 800, color: "#5a4633" }}>
                                {formatVentaCompraLabel(item)}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: 10, border: "1px solid #dbe6ef" }}>
                      <div style={{ padding: 9, background: "#fff" }}>
                        <div style={{ color: "#718397", fontSize: 10, fontWeight: 850 }}>SUBTOTAL</div>
                        <strong>${Number(selectedVentaDetalle.subtotal ?? selectedVentaDetalle.monto_total ?? 0).toFixed(2)}</strong>
                      </div>
                      <div style={{ padding: 9, background: "#fff7ed" }}>
                        <div style={{ color: "#9a4c0e", fontSize: 10, fontWeight: 850 }}>DESCUENTO</div>
                        <strong>
                          {Number(selectedVentaDetalle.descuento_monto || 0) > 0
                            ? `$${Number(selectedVentaDetalle.descuento_monto || 0).toFixed(2)}`
                            : `${Number(selectedVentaDetalle.descuento_porcentaje || 0).toFixed(2)}%`}
                        </strong>
                      </div>
                      <div style={{ padding: 9, background: "#173b61", color: "#fff" }}>
                        <div style={{ fontSize: 10, fontWeight: 850, opacity: .75 }}>TOTAL</div>
                        <strong style={{ fontSize: 18 }}>${Number(selectedVentaDetalle.monto_total || 0).toFixed(2)}</strong>
                      </div>
                    </div>
                    {(Number(selectedVentaDetalle.descuento_porcentaje || 0) > 0 || Number(selectedVentaDetalle.descuento_monto || 0) > 0) && (
                      <div style={{ marginTop: 8, color: "#526b7b", fontSize: 11 }}>
                        {formatDescuentoMotivoLabel(selectedVentaDetalle.descuento_motivo)} · {formatCuponTipoLabel(selectedVentaDetalle.cupon_tipo)}
                      </div>
                    )}
                  </section>

                  <section style={{ border: "1px solid #dbe6ef", padding: 14, background: "#fff" }}>
                    <div style={{ fontWeight: 900, color: "#16385d", marginBottom: 9 }}>Pagos registrados</div>
                    {selectedVentaDetalle.pagos && selectedVentaDetalle.pagos.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {selectedVentaDetalle.pagos.map((pago, index) => {
                          const acumulado = (selectedVentaDetalle.pagos || [])
                            .slice(0, index + 1)
                            .reduce((total, item) => total + Number(item.monto || 0), 0);
                          return (
                            <div key={pago.pago_id ?? index} style={{ display: "grid", gridTemplateColumns: "60px minmax(0, 1fr) 100px 110px", gap: 10, alignItems: "center", padding: 9, border: "1px solid #dbe6ef", background: "#f8fbff", fontSize: 11 }}>
                              <strong style={{ color: "#174ea6" }}>Pago {index + 1}</strong>
                              <span>
                                <strong>{formatMetodoPagoLabel(pago.metodo)}</strong>
                                {pago.fecha_hora ? <span style={{ display: "block", marginTop: 2, color: "#718397", fontSize: 10 }}>{formatDateTimePretty(pago.fecha_hora)}</span> : <span style={{ display: "block", marginTop: 2, color: "#718397", fontSize: 10 }}>Fecha no disponible</span>}
                              </span>
                              <strong style={{ textAlign: "right", color: "#174ea6" }}>${Number(pago.monto || 0).toFixed(2)}</strong>
                              <span style={{ textAlign: "right", color: "#526b7b" }}>Acumulado<br /><strong>${acumulado.toFixed(2)}</strong></span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: "#718397", fontSize: 12 }}>
                        Registro anterior: {formatMetodoPagoLabel(selectedVentaDetalle.metodo_pago)}
                      </div>
                    )}
                  </section>
                </div>

                <aside style={{ display: "grid", gap: 12, minWidth: 0 }}>
                  <section style={{ border: "1px solid #cbdcf0", background: "#f8fbff", padding: 14 }}>
                    <div style={{ fontWeight: 900, color: "#16385d", marginBottom: 10 }}>Estados y seguimiento</div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={{ display: "grid", gap: 5, color: "#40566c", fontSize: 11, fontWeight: 850 }}>
                        ESTADO DE LA VENTA
                        {ventaDetalleEditando ? (
                          <select
                            value={ventaSeguimientoDraft.estado_venta}
                            onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, estado_venta: e.target.value as VentaEstado }))}
                            style={{ width: "100%", padding: 9, border: "1px solid #b9cce0", background: "#fff" }}
                          >
                            {VENTA_ESTADO_OPTIONS.map((opcion) => (
                              <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                            ))}
                          </select>
                        ) : (
                          <strong style={{ padding: 9, border: "1px solid #dbe6ef", background: "#fff", color: "#173b61" }}>
                            {formatVentaEstadoLabel(selectedVentaDetalle.estado_venta)}
                          </strong>
                        )}
                        <span style={{ color: "#718397", fontSize: 10, fontWeight: 500 }}>
                          {VENTA_ESTADO_OPTIONS.find((opcion) => opcion.value === (ventaDetalleEditando ? ventaSeguimientoDraft.estado_venta : selectedVentaDetalle.estado_venta))?.detail}
                        </span>
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#40566c", fontSize: 11, fontWeight: 850 }}>
                        ESTADO DEL PAGO
                        {ventaDetalleEditando ? (
                          <select
                            value={ventaDetalleEstadoPagoPreview}
                            disabled={ventaDetallePagoNuevo > 0}
                            onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, estado_pago: e.target.value as VentaEstadoPago }))}
                            style={{ width: "100%", padding: 9, border: "1px solid #b9cce0", background: ventaDetallePagoNuevo > 0 ? "#eef2f6" : "#fff" }}
                          >
                            {VENTA_ESTADO_PAGO_OPTIONS.map((opcion) => {
                              const pagado = Number(selectedVentaDetalle.monto_pagado || 0);
                              const saldo = Number(selectedVentaDetalle.saldo_pendiente || 0);
                              const incompatible =
                                (opcion.value === "sin_pago" && pagado > 0)
                                || (opcion.value === "pagada" && saldo > 0)
                                || (["anticipo", "pago_parcial"].includes(opcion.value) && (pagado <= 0 || saldo <= 0));
                              return <option key={opcion.value} value={opcion.value} disabled={incompatible}>{opcion.label}</option>;
                            })}
                          </select>
                        ) : (
                          <strong style={{ padding: 9, border: "1px solid #dbe6ef", background: "#fff", color: "#173b61" }}>
                            {formatVentaEstadoPagoLabel(selectedVentaDetalle.estado_pago)}
                          </strong>
                        )}
                        {ventaDetallePagoNuevo > 0 && (
                          <span style={{ color: "#0e5fa8", fontSize: 10, fontWeight: 700 }}>
                            Se actualizará automáticamente a {formatVentaEstadoPagoLabel(ventaDetalleEstadoPagoPreview)}.
                          </span>
                        )}
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#40566c", fontSize: 11, fontWeight: 850 }}>
                        ESTADO DEL PEDIDO O ENTREGA
                        {ventaDetalleEditando ? (
                          <select
                            value={ventaSeguimientoDraft.estado_pedido}
                            onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, estado_pedido: e.target.value as VentaEstadoPedido }))}
                            style={{ width: "100%", padding: 9, border: "1px solid #b9cce0", background: "#fff" }}
                          >
                            {VENTA_ESTADO_PEDIDO_OPTIONS.map((opcion) => (
                              <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                            ))}
                          </select>
                        ) : (
                          <strong style={{ padding: 9, border: "1px solid #dbe6ef", background: "#fff", color: "#173b61" }}>
                            {formatVentaEstadoPedidoLabel(selectedVentaDetalle.estado_pedido)}
                          </strong>
                        )}
                      </label>
                    </div>
                  </section>

                  <section style={{ border: "1px solid #cbdcf0", background: "#fff", padding: 14 }}>
                    <div style={{ fontWeight: 900, color: "#16385d", marginBottom: 10 }}>Estado de cuenta</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #dbe6ef" }}>
                      <div style={{ padding: 10, background: "#eff6ff" }}>
                        <div style={{ color: "#52708e", fontSize: 10, fontWeight: 850 }}>PAGADO</div>
                        <strong style={{ color: "#174ea6" }}>${ventaDetalleMontoPagadoPreview.toFixed(2)}</strong>
                      </div>
                      <div style={{ padding: 10, background: ventaDetalleSaldoPreview > 0 ? "#fff7ed" : "#f0fdf4" }}>
                        <div style={{ color: ventaDetalleSaldoPreview > 0 ? "#9a4c0e" : "#166534", fontSize: 10, fontWeight: 850 }}>SALDO POR PAGAR</div>
                        <strong style={{ color: ventaDetalleSaldoPreview > 0 ? "#c2410c" : "#166534" }}>${ventaDetalleSaldoPreview.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div style={{ marginTop: 7, color: "#718397", fontSize: 10 }}>
                      Forma de liquidación: {formatFormaLiquidacionLabel(selectedVentaDetalle.forma_liquidacion)}
                      {selectedVentaDetalle.plazo_meses ? ` · ${selectedVentaDetalle.plazo_meses} meses` : ""}
                    </div>

                    {ventaDetalleEditando && Number(selectedVentaDetalle.saldo_pendiente || 0) > 0 && ventaSeguimientoDraft.estado_pago !== "reembolsada" && (
                      <div style={{ display: "grid", gap: 8, marginTop: 11, paddingTop: 11, borderTop: "1px solid #e1e8ef" }}>
                        <div>
                          <strong style={{ display: "block", color: "#173b61", fontSize: 12 }}>Registrar un pago nuevo</strong>
                          <span style={{ display: "block", marginTop: 2, color: "#718397", fontSize: 10 }}>
                            Déjalo vacío si solo actualizarás los estados.
                          </span>
                        </div>
                        <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
                          MÉTODO
                          <select
                            value={ventaNuevoPagoMetodo}
                            onChange={(e) => setVentaNuevoPagoMetodo(e.target.value as VentaMetodoPago)}
                            style={{ width: "100%", padding: 8, border: "1px solid #b9cce0", background: "#fff" }}
                          >
                            {VENTA_METODO_PAGO_OPTIONS.map((opcion) => (
                              <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4, color: "#40566c", fontSize: 10, fontWeight: 850 }}>
                          MONTO PAGADO AHORA
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ventaNuevoPagoMonto}
                            onChange={(e) => {
                              const siguiente = e.target.value.replace(",", ".");
                              if (siguiente === "" || /^\d+(?:\.\d{0,2})?$/.test(siguiente)) {
                                setVentaNuevoPagoMonto(siguiente);
                              }
                            }}
                            placeholder=""
                            style={{ width: "100%", padding: 8, border: "1px solid #8cb4df", textAlign: "right", fontWeight: 900 }}
                          />
                        </label>
                      </div>
                    )}
                  </section>

                  <section style={{ border: "1px solid #dbe6ef", background: "#fff", padding: 14 }}>
                    <label style={{ display: "grid", gap: 6, color: "#40566c", fontSize: 11, fontWeight: 850 }}>
                      NOTAS
                      {ventaDetalleEditando ? (
                        <textarea
                          rows={4}
                          value={ventaSeguimientoDraft.notas}
                          onChange={(e) => setVentaSeguimientoDraft((prev) => ({ ...prev, notas: e.target.value }))}
                          style={{ width: "100%", padding: 9, border: "1px solid #b9cce0", resize: "vertical" }}
                        />
                      ) : (
                        <span style={{ minHeight: 58, padding: 9, border: "1px solid #dbe6ef", background: "#f8fafc", color: "#526b7b", fontWeight: 500 }}>
                          {selectedVentaDetalle.notas?.trim() || "Sin notas"}
                        </span>
                      )}
                    </label>
                  </section>

                  {ventaSeguimientoDraft.estado_pago === "reembolsada" && ventaDetalleEditando && (
                    <div style={{ padding: 10, border: "1px solid #ddd6fe", background: "#f5f3ff", color: "#5b21b6", fontSize: 11 }}>
                      “Reembolsada” registra el estado. No modifica inventario ni crea automáticamente un movimiento de devolución.
                    </div>
                  )}

                  {ventaSeguimientoError && (
                    <div style={{ padding: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 12 }}>
                      {ventaSeguimientoError}
                    </div>
                  )}

                  {ventaDetalleEditando && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setVentaDetalleEditando(false);
                          setVentaSeguimientoError(null);
                          setVentaNuevoPagoMonto("");
                          openVentaDetalle(selectedVentaDetalle);
                        }}
                        disabled={savingVentaSeguimiento}
                        style={{ ...actionBtnStyle, padding: "10px 12px" }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={guardarSeguimientoVenta}
                        disabled={savingVentaSeguimiento}
                        style={{ padding: "10px 12px", border: "1px solid #0f766e", background: savingVentaSeguimiento ? "#dfe9e8" : "#0f766e", color: savingVentaSeguimiento ? "#526b7b" : "#fff", fontWeight: 900, cursor: savingVentaSeguimiento ? "wait" : "pointer" }}
                      >
                        {savingVentaSeguimiento ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  )}
                </aside>
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

      {logoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            background: "rgba(15, 23, 42, .48)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div style={{ width: 430, maxWidth: "95vw", padding: 18, border: "1px solid #cbd8e4", background: "#fff", boxShadow: "0 20px 55px rgba(15,23,42,.28)" }}>
            <div id="logout-confirm-title" style={{ color: "#173b61", fontSize: 19, fontWeight: 900 }}>
              Confirmar cierre de sesión
            </div>
            <div style={{ marginTop: 8, color: "#526b7b" }}>
              ¿Estás seguro de que quieres cerrar sesión?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                style={{ ...actionBtnStyle, padding: "10px 12px" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={logout}
                style={{ padding: "10px 12px", border: "1px solid #b91c1c", background: "#b91c1c", color: "#fff", fontWeight: 900, cursor: "pointer" }}
              >
                Sí, cerrar sesión
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
                : `¿Estás seguro de que quieres eliminar la venta #${deleteConfirmId}? Se borrará para siempre de PostgreSQL y las existencias descontadas se restaurarán.`}
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
