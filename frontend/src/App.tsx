
import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from "react";
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
  como_nos_conocio?: string | null;
  ocupacion?: string | null;
  alergias?: string | null;
  fumador_tabaco?: boolean | null;
  fumador_marihuana?: boolean | null;
  consumidor_alcohol?: boolean | null;
  creado_en?: string | null;
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
};

type Consulta = {
  consulta_id: number;
  fecha_hora: string | null;
  tipo_consulta: string | null;
  doctor_primer_nombre: string | null;
  doctor_apellido_paterno: string | null;
  motivo: string | null;
  diagnostico: string | null;
  plan: string | null;
  notas: string | null;
  paciente_id: number;
  paciente_nombre: string;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  como_nos_conocio?: string | null;
};

type ConsultaCreate = {
  paciente_id: number;
  sucursal_id?: number | null;
  tipo_consulta?: string | null;
  doctor_primer_nombre?: string | null;
  doctor_apellido_paterno?: string | null;
  motivo?: string | null;
  diagnostico?: string | null;
  plan?: string | null;
  notas?: string | null;
  agendar_en_calendario?: boolean | null;
  agenda_inicio?: string | null;
  agenda_fin?: string | null;
};

type Venta = {
  venta_id: number;
  fecha_hora: string | null;
  compra: string | null;
  monto_total: number;
  metodo_pago: "efectivo" | "tarjeta_credito" | "tarjeta_debito";
  adelanto_aplica?: boolean;
  adelanto_monto?: number | null;
  adelanto_metodo?: "efectivo" | "tarjeta_credito" | "tarjeta_debito" | null;
  como_nos_conocio?: string | null;
  notas: string | null;
  paciente_id: number;
  paciente_nombre: string;
  sucursal_id: number | null;
};

type VentaCreate = {
  paciente_id: number;
  sucursal_id?: number | null;
  compra: string;
  monto_total: number;
  metodo_pago: "efectivo" | "tarjeta_credito" | "tarjeta_debito";
  adelanto_aplica?: boolean;
  adelanto_monto?: number | null;
  adelanto_metodo?: "efectivo" | "tarjeta_credito" | "tarjeta_debito" | null;
  como_nos_conocio?: string | null;
  notas?: string | null;
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

type StatsResumen = {
  sucursal_id: number;
  periodo: {
    modo: "hoy" | "semana" | "mes" | "anio" | string;
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



const API = "http://127.0.0.1:8000";

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

  const r = await fetch(`${API}${path}`, { ...init, headers });

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
  variant: "pacientes" | "consultas" | "ventas" | "estadisticas";
  children: ReactNode;
  onClick: () => void;
}) {
  const activeBg =
    variant === "pacientes"
      ? "#6F8A3C"
      : variant === "consultas"
        ? "#C9822B"
        : variant === "ventas"
          ? "#4D7A9B"
          : "#6A5ACD";
  const activeBorder =
    variant === "pacientes"
      ? "#5f7734"
      : variant === "consultas"
        ? "#b37225"
        : variant === "ventas"
          ? "#3f6784"
          : "#5346a8";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 18px",
        borderRadius: 12,
        border: active ? `1px solid ${activeBorder}` : "1px solid #d7c6b2",
        background: active ? activeBg : "#fff8ef",
        color: active ? "#fff" : "#3f2f20",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: active ? "0 8px 18px rgba(80, 60, 35, 0.18)" : "none",
      }}
    >
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

function formatDateYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function isEmptyHistoriaValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

function wordCount(value: string | null | undefined): number {
  if (!value) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function formatMetodoPagoLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "tarjeta_credito") return "tarjeta de credito";
  if (value === "tarjeta_debito") return "tarjeta de debito";
  return value;
}

function formatComoNosConocioLabel(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim().toLowerCase();
  if (v === "linkedln" || v === "linkedin") return "LinkedIn";
  if (v === "fb") return "Facebook";
  if (v === "instagram") return "Instagram";
  if (v === "google") return "Google";
  if (v === "referencia") return "Referencia";
  return value;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function splitPhoneForUi(value: string | null | undefined): { countryIso: string; local: string } {
  const raw = (value ?? "").trim();
  if (!raw) return { countryIso: DEFAULT_PHONE_COUNTRY, local: "" };

  const countriesByDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const found = countriesByDial.find((c) => raw === c.dial || raw.startsWith(`${c.dial} `) || raw.startsWith(c.dial));
  if (!found) return { countryIso: DEFAULT_PHONE_COUNTRY, local: onlyDigits(raw).slice(0, 10) };

  let local = onlyDigits(raw.slice(found.dial.length).trim());
  if (local.startsWith("-")) local = local.slice(1).trim();
  return { countryIso: found.iso, local: local.slice(0, 10) };
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

const HISTORIA_REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "od_esfera", label: "OD Esfera" },
  { key: "od_cilindro", label: "OD Cilindro" },
  { key: "od_eje", label: "OD Eje" },
  { key: "od_add", label: "OD Add" },
  { key: "oi_esfera", label: "OI Esfera" },
  { key: "oi_cilindro", label: "OI Cilindro" },
  { key: "oi_eje", label: "OI Eje" },
  { key: "oi_add", label: "OI Add" },
  { key: "dp", label: "DP" },
  { key: "queratometria_od", label: "Queratometria OD" },
  { key: "queratometria_oi", label: "Queratometria OI" },
  { key: "presion_od", label: "Presion OD" },
  { key: "presion_oi", label: "Presion OI" },
  { key: "doctor_atencion", label: "Doctor que atendio" },
  { key: "historia", label: "Historia" },
  { key: "antecedentes", label: "Antecedentes" },
  { key: "fumador_tabaco", label: "Fumador tabaco" },
  { key: "fumador_marihuana", label: "Fumador marihuana" },
  { key: "consumidor_alcohol", label: "Consumidor alcohol" },
  { key: "diabetes", label: "Diabetes" },
  { key: "deportista", label: "Deportista" },
  { key: "ppc", label: "PPC" },
  { key: "lejos", label: "Lejos" },
  { key: "cerca", label: "Cerca" },
  { key: "tension", label: "Tension" },
  { key: "mmhg", label: "mmHg" },
  { key: "di", label: "DI" },
  { key: "avsinrxod", label: "AV sin RX OD" },
  { key: "avsinrixoi", label: "AV sin RX OI" },
  { key: "capvisualod", label: "CAP visual OD" },
  { key: "capvisualoi", label: "CAP visual OI" },
  { key: "avrxantod", label: "AV RX ant OD" },
  { key: "avrxantoi", label: "AV RX ant OI" },
  { key: "queraod", label: "Quera OD" },
  { key: "queraoi", label: "Quera OI" },
  { key: "retinosod", label: "Retinos OD" },
  { key: "retinosoi", label: "Retinos OI" },
  { key: "subjeoi", label: "Subje OI" },
  { key: "adicionod", label: "Adicion OD" },
  { key: "adicionoi", label: "Adicion OI" },
  { key: "papila", label: "Papila" },
  { key: "biomicroscopia", label: "Biomicroscopia" },
  { key: "diagnostico_general", label: "Diagnostico general" },
  { key: "observaciones", label: "Observaciones" },
];

const ANTECEDENTE_OPTIONS = [
  "glaucoma",
  "diabetes",
  "miopia",
  "hipermetropia",
  "cataratas",
  "otro",
];

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

  let general = "";
  let familiar = "";
  for (const line of raw.split(/\n+/)) {
    const clean = line.trim();
    if (!clean) continue;
    const lowered = clean.toLowerCase();
    if (lowered.startsWith("general:")) {
      general = clean.slice(clean.indexOf(":") + 1).trim();
      continue;
    }
    if (lowered.startsWith("familiar:")) {
      familiar = clean.slice(clean.indexOf(":") + 1).trim();
    }
  }

  if (!general && !familiar) {
    general = raw;
  }

  return {
    antecedentes_otro_general: general,
    antecedentes_otro_familiar: familiar,
  };
}

function normalizeHistoriaForUi(data: any, fallbackDoctor: string) {
  const doctorBase = String(data?.doctor_atencion ?? fallbackDoctor ?? "").trim();
  const doctorParts = splitDoctorAtencion(doctorBase);
  const antecedentesOtroParts = splitAntecedentesOtro(data?.antecedentes_otro ?? "");
  return {
    ...data,
    avsinrixoi: data?.avsinrixoi ?? data?.avsinrxoi ?? "",
    doctor_atencion: doctorBase,
    doctor_primer_nombre: doctorParts.doctor_primer_nombre,
    doctor_apellido_paterno: doctorParts.doctor_apellido_paterno,
    antecedentes_otro: composeAntecedentesOtro(
      antecedentesOtroParts.antecedentes_otro_general,
      antecedentesOtroParts.antecedentes_otro_familiar
    ),
    antecedentes_otro_general: antecedentesOtroParts.antecedentes_otro_general,
    antecedentes_otro_familiar: antecedentesOtroParts.antecedentes_otro_familiar,
  };
}

export default function App() {
  const [tab, setTab] = useState<"pacientes" | "consultas" | "ventas" | "estadisticas">("pacientes");

  // ---- Estado de sesión y búsqueda ----
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingPacienteId, setEditingPacienteId] = useState<number | null>(null);
  const [qPaciente, setQPaciente] = useState("");
  const [qConsulta, setQConsulta] = useState("");
  const [pacienteFiltroOpen, setPacienteFiltroOpen] = useState(false);
  const [pacienteFiltroModo, setPacienteFiltroModo] = useState<"hoy" | "rango" | "mes" | "anio">("hoy");
  const [pacienteFechaDesde, setPacienteFechaDesde] = useState("");
  const [pacienteFechaHasta, setPacienteFechaHasta] = useState("");
  const [pacienteMes, setPacienteMes] = useState("");
  const [pacienteAnio, setPacienteAnio] = useState(String(new Date().getFullYear()));
  const [pacienteFiltroLabel, setPacienteFiltroLabel] = useState("Hoy");
  const [consultaFiltroOpen, setConsultaFiltroOpen] = useState(false);
  const [consultaFiltroModo, setConsultaFiltroModo] = useState<"hoy" | "rango" | "mes" | "anio">("hoy");
  const [consultaFechaDesde, setConsultaFechaDesde] = useState("");
  const [consultaFechaHasta, setConsultaFechaHasta] = useState("");
  const [consultaMes, setConsultaMes] = useState("");
  const [consultaAnio, setConsultaAnio] = useState(String(new Date().getFullYear()));
  const [consultaFiltroLabel, setConsultaFiltroLabel] = useState("Hoy");
  const [ventaFiltroModo, setVentaFiltroModo] = useState<"hoy" | "rango" | "mes" | "anio">("hoy");
  const [ventaFechaDesde, setVentaFechaDesde] = useState("");
  const [ventaFechaHasta, setVentaFechaHasta] = useState("");
  const [ventaMes, setVentaMes] = useState("");
  const [ventaAnio, setVentaAnio] = useState(String(new Date().getFullYear()));
  const [ventaFiltroLabel, setVentaFiltroLabel] = useState("Hoy");
  const [qVenta, setQVenta] = useState("");
  const [statsData, setStatsData] = useState<StatsResumen | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsFiltroModo, setStatsFiltroModo] = useState<"hoy" | "semana" | "mes" | "anio">("hoy");
  const [statsMes, setStatsMes] = useState(String(new Date().getMonth() + 1));
  const [statsAnio, setStatsAnio] = useState(String(new Date().getFullYear()));
  const [statsFiltroLabel, setStatsFiltroLabel] = useState("Hoy");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);





  // Historial por paciente
  const [histPacienteId, setHistPacienteId] = useState<number | null>(null);
  const [histConsultas, setHistConsultas] = useState<Consulta[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [selectedConsultaDetalle, setSelectedConsultaDetalle] = useState<Consulta | null>(null);
  const [selectedVentaDetalle, setSelectedVentaDetalle] = useState<Venta | null>(null);


  const [savingPaciente, setSavingPaciente] = useState(false);
  const [savingConsulta, setSavingConsulta] = useState(false);
  const [savingVenta, setSavingVenta] = useState(false);
  const [successVentaMsg, setSuccessVentaMsg] = useState<string | null>(null);
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null);
  const [successConsultaMsg, setSuccessConsultaMsg] = useState<string | null>(null);
  const [editingConsultaId, setEditingConsultaId] = useState<number | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActivaId, setSucursalActivaId] = useState<number>(1);

  const [historiaPacienteId, setHistoriaPacienteId] = useState<number | null>(null);
  const [historiaPacienteInfo, setHistoriaPacienteInfo] = useState<Paciente | null>(null);
  const [historiaData, setHistoriaData] = useState<any | null>(null);
  const [loadingHistoria, setLoadingHistoria] = useState(false);
  const [historiaGuardada, setHistoriaGuardada] = useState(false);
  const [historiaConfirmOpen, setHistoriaConfirmOpen] = useState(false);
  const [historiaSaving, setHistoriaSaving] = useState(false);
  const [historiaMissingSummary, setHistoriaMissingSummary] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = useState<"paciente" | "consulta" | "venta" | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmBusy, setDeleteConfirmBusy] = useState(false);







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
  });
  const [pacienteTelefonoPais, setPacienteTelefonoPais] = useState<string>(DEFAULT_PHONE_COUNTRY);
  const [pacienteTelefonoLocal, setPacienteTelefonoLocal] = useState<string>("");

  const [formConsulta, setFormConsulta] = useState<ConsultaCreate>({
    paciente_id: 0,
    sucursal_id: 1,
    tipo_consulta: "",
    doctor_primer_nombre: "",
    doctor_apellido_paterno: "",
    motivo: "",
    diagnostico: "",
    plan: "",
    notas: "",
  });
  const [tipoConsultaOtro, setTipoConsultaOtro] = useState("");
  const [tiposConsultaSeleccionados, setTiposConsultaSeleccionados] = useState<string[]>([]);
  const [agendarConsulta, setAgendarConsulta] = useState(false);
  const [agendaFecha, setAgendaFecha] = useState(formatDateYYYYMMDD(new Date()));
  const [agendaSlots, setAgendaSlots] = useState<AgendaSlot[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaTimezone, setAgendaTimezone] = useState<string>("");
  const [agendaSlotSeleccionado, setAgendaSlotSeleccionado] = useState<AgendaSlot | null>(null);
  const [qPacienteConsulta, setQPacienteConsulta] = useState("");
  const [loadingPacienteConsulta, setLoadingPacienteConsulta] = useState(false);
  const [pacientesConsultaOpciones, setPacientesConsultaOpciones] = useState<Array<{ id: number; label: string }>>([]);
  const [qPacienteVenta, setQPacienteVenta] = useState("");
  const [loadingPacienteVenta, setLoadingPacienteVenta] = useState(false);
  const [pacientesVentaOpciones, setPacientesVentaOpciones] = useState<Array<{ id: number; label: string }>>([]);
  const [ventasSeleccionadas, setVentasSeleccionadas] = useState<string[]>([]);
  const [ventaCompraOtro, setVentaCompraOtro] = useState("");
  const [formVenta, setFormVenta] = useState<VentaCreate>({
    paciente_id: 0,
    sucursal_id: 1,
    compra: "",
    monto_total: 0,
    metodo_pago: "efectivo",
    adelanto_aplica: false,
    adelanto_monto: null,
    adelanto_metodo: null,
    como_nos_conocio: "",
    notas: "",
  });

  const pacientesOpciones = useMemo(() => {
    return pacientes
      .map((p) => {
        const nombre = [p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno]
          .filter(Boolean)
          .join(" ");
        return { id: p.paciente_id, label: `${p.paciente_id} — ${nombre}` };
      })
      .sort((a, b) => a.id - b.id);
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
      c.tipo_consulta,
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
    const q = qPaciente.trim().toLowerCase();
    if (!q) return pacientes;

    return pacientes.filter((p) => {
      const nombre = [
        p.primer_nombre,
        p.segundo_nombre,
        p.apellido_paterno,
        p.apellido_materno,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const id = String(p.paciente_id);
      const tel = (p.telefono ?? "").toLowerCase();
      const correo = (p.correo ?? "").toLowerCase();

      return (
        nombre.includes(q) ||
        id.includes(q) ||
        tel.includes(q) ||
        correo.includes(q)
      );
    });
  }, [pacientes, qPaciente]);




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
  }) {
    setError(null);

    const modo = override?.modo ?? consultaFiltroModo;
    const fechaDesde = override?.fechaDesde ?? consultaFechaDesde;
    const fechaHasta = override?.fechaHasta ?? consultaFechaHasta;
    const mes = override?.mes ?? consultaMes;
    const anio = override?.anio ?? consultaAnio;

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
  }) {
    setError(null);

    const modo = override?.modo ?? ventaFiltroModo;
    const fechaDesde = override?.fechaDesde ?? ventaFechaDesde;
    const fechaHasta = override?.fechaHasta ?? ventaFechaHasta;
    const mes = override?.mes ?? ventaMes;
    const anio = override?.anio ?? ventaAnio;

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

    apiFetch(`/ventas?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la lista de ventas.");
        return r.json();
      })
      .then(setVentas)
      .catch((e) => setError(e?.message ?? String(e)));
  }

  function loadStats(override?: {
    modo?: "hoy" | "semana" | "mes" | "anio";
    mes?: string;
    anio?: string;
  }) {
    setLoadingStats(true);
    setError(null);

    const modo = override?.modo ?? statsFiltroModo;
    const mes = override?.mes ?? statsMes;
    const anio = override?.anio ?? statsAnio;

    const params = new URLSearchParams();
    params.set("sucursal_id", String(sucursalActivaId));
    params.set("modo", modo);

    if (modo === "mes") {
      if (mes) params.set("mes", mes);
      if (anio) params.set("anio", anio);
      setStatsFiltroLabel(`Mes ${mes || "?"}/${anio || "?"}`);
    } else if (modo === "anio") {
      if (anio) params.set("anio", anio);
      setStatsFiltroLabel(`Año ${anio || "?"}`);
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
      return;
    }
    const mesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const anio = String(mesPasado.getFullYear());
    const mes = String(mesPasado.getMonth() + 1);
    setVentaFiltroModo("mes");
    setVentaAnio(anio);
    setVentaMes(mes);
    loadVentas({ modo: "mes", anio, mes });
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
    if (!agendarConsulta) return;
    setAgendaLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("fecha", agendaFecha);
      params.set("sucursal_id", String(sucursalActivaId));
      params.set("duracion_min", "30");
      const r = await apiFetch(`/agenda/disponibilidad?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data = await r.json();
      const slots = Array.isArray(data?.slots) ? data.slots : [];
      setAgendaSlots(slots);
      setAgendaTimezone(data?.timezone ?? "");
      setAgendaSlotSeleccionado((prev) => {
        if (!prev) return null;
        const found = slots.find((s: AgendaSlot) => s.inicio === prev.inicio && s.fin === prev.fin);
        return found ?? null;
      });
    } catch (e: any) {
      setAgendaSlots([]);
      setAgendaSlotSeleccionado(null);
      setError(e?.message ?? String(e));
    } finally {
      setAgendaLoading(false);
    }
  }

  async function buscarPacientesParaConsulta(query?: string) {
    const q = (query ?? qPacienteConsulta).trim();
    if (!q) {
      setPacientesConsultaOpciones(pacientesOpciones);
      return;
    }
    if (q.length < 2) {
      setPacientesConsultaOpciones(pacientesOpciones);
      return;
    }

    setLoadingPacienteConsulta(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "80");
      params.set("sucursal_id", String(sucursalActivaId));
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: Paciente[] = await r.json();
      const ops = data
        .map((p) => {
          const nombre = [p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno]
            .filter(Boolean)
            .join(" ");
          return { id: p.paciente_id, label: `${p.paciente_id} — ${nombre}` };
        })
        .sort((a, b) => a.id - b.id);
      setPacientesConsultaOpciones(ops);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPacientesConsultaOpciones([]);
    } finally {
      setLoadingPacienteConsulta(false);
    }
  }

  async function buscarPacientesParaVenta(query?: string) {
    const q = (query ?? qPacienteVenta).trim();
    if (!q) {
      setPacientesVentaOpciones(pacientesOpciones);
      return;
    }
    if (q.length < 2) {
      setPacientesVentaOpciones(pacientesOpciones);
      return;
    }

    setLoadingPacienteVenta(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "80");
      params.set("sucursal_id", String(sucursalActivaId));
      const r = await apiFetch(`/pacientes/buscar?${params.toString()}`);
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data: Paciente[] = await r.json();
      const ops = data
        .map((p) => {
          const nombre = [p.primer_nombre, p.segundo_nombre, p.apellido_paterno, p.apellido_materno]
            .filter(Boolean)
            .join(" ");
          return { id: p.paciente_id, label: `${p.paciente_id} — ${nombre}` };
        })
        .sort((a, b) => a.id - b.id);
      setPacientesVentaOpciones(ops);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setPacientesVentaOpciones([]);
    } finally {
      setLoadingPacienteVenta(false);
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
    if (!me) return;
    setFormPaciente((prev) => ({ ...prev, sucursal_id: sucursalActivaId }));
    setFormConsulta((prev) => ({ ...prev, sucursal_id: sucursalActivaId, paciente_id: 0 }));
    setFormVenta((prev) => ({ ...prev, sucursal_id: sucursalActivaId, paciente_id: 0 }));
    setEditingVentaId(null);
    setSuccessVentaMsg(null);
    loadPacientes();
    loadConsultas();
    loadVentas();
  }, [sucursalActivaId, me]);

  useEffect(() => {
    if (!me) return;
    loadSucursales();
  }, [me]);

  useEffect(() => {
    if (!me || tab !== "consultas") return;
    if (!agendarConsulta) return;
    loadAgendaDisponibilidad();
  }, [me, tab, agendaFecha, sucursalActivaId, agendarConsulta]);

  useEffect(() => {
    if (!me || tab !== "estadisticas") return;
    loadStats();
  }, [me, tab, sucursalActivaId]);





  function loadSucursales() {
    setError(null);
    apiFetch(`/sucursales`)
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar la lista de sucursales.");
        return r.json();
      })
      .then((data: Sucursal[]) => {
        setSucursales(data);
        if (data.length > 0 && !data.find((s) => s.sucursal_id === sucursalActivaId)) {
          setSucursalActivaId(data[0].sucursal_id);
        }
      })
      .catch((e) => setError(e?.message ?? String(e)));
  }




  
  function startEditPaciente(p: Paciente) {
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
    });
    setTab("pacientes");
  }

  function cancelEditPaciente() {
    setEditingPacienteId(null);
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
    });
  }

  // ---- Acciones de formularios ----
  async function onSubmitPaciente(e: FormEvent) {
    e.preventDefault();
    setSavingPaciente(true);
    setError(null);

    try {
      if (!formPaciente.primer_nombre?.trim()) throw new Error("Primer nombre es obligatorio.");
      if (!formPaciente.segundo_nombre?.trim()) throw new Error("Segundo nombre es obligatorio.");
      if (!formPaciente.apellido_paterno?.trim()) throw new Error("Apellido paterno es obligatorio.");
      if (!formPaciente.apellido_materno?.trim()) throw new Error("Apellido materno es obligatorio.");
      if (!formPaciente.fecha_nacimiento?.trim()) throw new Error("Fecha de nacimiento es obligatoria.");
      if (!formPaciente.sexo?.trim()) throw new Error("Sexo es obligatorio.");
      const telefonoDigits = onlyDigits(pacienteTelefonoLocal);
      if (telefonoDigits.length !== 10) {
        throw new Error("Teléfono debe tener exactamente 10 dígitos.");
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

      const r = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await readErrorMessage(r));

      cancelEditPaciente();
      loadPacientes();
      setTab("pacientes");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingPaciente(false);
    }
  }

  async function openHistoria(paciente: Paciente) {
    const paciente_id = paciente.paciente_id;
    setHistoriaPacienteId(paciente_id);
    setHistoriaPacienteInfo(paciente);
    setLoadingHistoria(true);
    setHistoriaData(null);
    setError(null);

    try {
      const r = await apiFetch(
        `/pacientes/${paciente_id}/historia?sucursal_id=${sucursalActivaId}`
      );

      if (r.status === 404) {
        setHistoriaData(null); // no existe todavía
        return;
      }

      if (!r.ok) throw new Error(await readErrorMessage(r));

      const data = await r.json();
      setHistoriaData(normalizeHistoriaForUi(data, me?.username ?? ""));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingHistoria(false);
    }
  }

  function closeHistoriaModal() {
    setHistoriaPacienteId(null);
    setHistoriaPacienteInfo(null);
    setHistoriaGuardada(false);
    setHistoriaConfirmOpen(false);
    setHistoriaMissingSummary(null);
    setError(null);
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
    const tipos = (c.tipo_consulta ?? "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    setTiposConsultaSeleccionados(tipos);
    setFormConsulta({
      paciente_id: c.paciente_id,
      sucursal_id: sucursalActivaId,
      tipo_consulta: c.tipo_consulta ?? "",
      doctor_primer_nombre: c.doctor_primer_nombre ?? "",
      doctor_apellido_paterno: c.doctor_apellido_paterno ?? "",
      motivo: "",
      diagnostico: "",
      plan: "",
      notas: c.notas ?? "",
    });
    setAgendarConsulta(false);
    setAgendaSlotSeleccionado(null);
    setTab("consultas");
    setSuccessConsultaMsg(null);
  }

  function cancelEditConsulta() {
    setEditingConsultaId(null);
    setTiposConsultaSeleccionados([]);
    setTipoConsultaOtro("");
    setFormConsulta((prev) => ({
      ...prev,
      tipo_consulta: "",
      doctor_primer_nombre: "",
      doctor_apellido_paterno: "",
      notas: "",
    }));
    setAgendarConsulta(false);
    setQPacienteConsulta("");
    setPacientesConsultaOpciones(pacientesOpciones);
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
      if (tiposConsultaSeleccionados.length === 0) {
        throw new Error("Selecciona al menos un tipo de consulta.");
      }
      if (tiposConsultaSeleccionados.includes("otro") && !tipoConsultaOtro.trim()) {
        throw new Error("Escribe la razón cuando seleccionas 'otro'.");
      }
      if (!formConsulta.doctor_primer_nombre?.trim() || !formConsulta.doctor_apellido_paterno?.trim()) {
        throw new Error("Nombre y apellido del doctor son obligatorios.");
      }
      const tipoConsultaTexto = tiposConsultaSeleccionados.join("|");

      let notasFinal = (formConsulta.notas ?? "").trim();
      if (tiposConsultaSeleccionados.includes("otro") && tipoConsultaOtro.trim()) {
        const razon = `Razon (otro): ${tipoConsultaOtro.trim()}`;
        notasFinal = notasFinal ? `${razon} | ${notasFinal}` : razon;
      }
      if (wordCount(notasFinal) > 50) {
        throw new Error("Notas no puede superar 50 palabras (incluyendo la razón de 'otro').");
      }

      const usarAgenda = editingConsultaId === null && agendarConsulta;
      if (usarAgenda && !agendaSlotSeleccionado) {
        throw new Error("Selecciona un horario disponible para agendar la consulta.");
      }

      const payload = cleanPayload({
        ...formConsulta,
        sucursal_id: sucursalActivaId,
        tipo_consulta: tipoConsultaTexto,
        motivo: null,
        diagnostico: null,
        plan: null,
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
        notas: "",
      }));
      setTipoConsultaOtro("");
      setTiposConsultaSeleccionados([]);
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
    const otroItem = comprasRaw.find((x) => x.toLowerCase().startsWith("otro:"));
    const compras = comprasRaw
      .map((x) => (x.toLowerCase().startsWith("otro:") ? "otro" : x))
      .filter(Boolean);
    setVentasSeleccionadas(compras);
    setVentaCompraOtro(otroItem ? otroItem.slice(5).trim() : "");
    setFormVenta({
      paciente_id: v.paciente_id,
      sucursal_id: sucursalActivaId,
      compra: v.compra ?? "",
      monto_total: Number(v.monto_total ?? 0),
      metodo_pago: v.metodo_pago ?? "efectivo",
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
    setVentasSeleccionadas([]);
    setVentaCompraOtro("");
    setFormVenta({
      paciente_id: 0,
      sucursal_id: sucursalActivaId,
      compra: "",
      monto_total: 0,
      metodo_pago: "efectivo",
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
      if (ventasSeleccionadas.length === 0) throw new Error("Selecciona al menos un tipo de compra.");
      if (ventasSeleccionadas.includes("otro") && !ventaCompraOtro.trim()) {
        throw new Error("Escribe el detalle para 'otro'.");
      }
      if (!formVenta.monto_total || Number(formVenta.monto_total) <= 0) {
        throw new Error("Monto total debe ser mayor a 0.");
      }
      if (!formVenta.metodo_pago) {
        throw new Error("Selecciona método de pago.");
      }
      if (formVenta.adelanto_aplica) {
        if (!formVenta.adelanto_monto || Number(formVenta.adelanto_monto) <= 0) {
          throw new Error("Adelanto debe ser mayor a 0.");
        }
        if (!formVenta.adelanto_metodo) {
          throw new Error("Selecciona método de pago del adelanto.");
        }
      }
      if (wordCount(formVenta.notas ?? "") > 50) {
        throw new Error("Notas no puede superar 50 palabras.");
      }

      const compraFinal = ventasSeleccionadas
        .map((x) => (x === "otro" ? `otro:${ventaCompraOtro.trim()}` : x))
        .join("|");

      const payload = cleanPayload({
        ...formVenta,
        sucursal_id: sucursalActivaId,
        compra: compraFinal,
        monto_total: Number(formVenta.monto_total),
        adelanto_aplica: Boolean(formVenta.adelanto_aplica),
        adelanto_monto: formVenta.adelanto_aplica ? Number(formVenta.adelanto_monto) : null,
        adelanto_metodo: formVenta.adelanto_aplica ? formVenta.adelanto_metodo : null,
      });

      const endpoint = editingVentaId === null ? "/ventas" : `/ventas/${editingVentaId}`;
      const method = editingVentaId === null ? "POST" : "PUT";
      let r = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

      // Si estaba en edición pero la venta ya no existe en esta sucursal,
      // caemos automáticamente a creación para no bloquear operación.
      if (method === "PUT" && r.status === 404) {
        setEditingVentaId(null);
        r = await apiFetch("/ventas", { method: "POST", body: JSON.stringify(payload) });
      }
      if (!r.ok) throw new Error(await readErrorMessage(r));

      setFormVenta((prev) => ({
        ...prev,
        compra: "",
        monto_total: 0,
        metodo_pago: "efectivo",
        adelanto_aplica: false,
        adelanto_monto: null,
        adelanto_metodo: null,
        como_nos_conocio: "",
        notas: "",
      }));
      setVentasSeleccionadas([]);
      setVentaCompraOtro("");
      setEditingVentaId(null);
      loadVentas();
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

  function getHistoriaMissingFields(): string[] {
    const missing = HISTORIA_REQUIRED_FIELDS
      .filter((f) => isEmptyHistoriaValue(historiaData?.[f.key]))
      .map((f) => f.label);
    if (historiaData?.diabetes === true && isEmptyHistoriaValue(historiaData?.tipo_diabetes)) {
      missing.push("Tipo de diabetes");
    }
    return missing;
  }

  async function saveHistoriaClinica() {
    try {
      setHistoriaSaving(true);
      setError(null);
      const doctorAtencion =
        composeDoctorAtencion(
          historiaData?.doctor_primer_nombre,
          historiaData?.doctor_apellido_paterno
        ) || String(historiaData?.doctor_atencion ?? me?.username ?? "").trim();
      const antecedentesOtro = composeAntecedentesOtro(
        historiaData?.antecedentes_otro_general,
        historiaData?.antecedentes_otro_familiar
      );
      const r = await apiFetch(
        `/pacientes/${historiaPacienteId}/historia?sucursal_id=${sucursalActivaId}`,
        {
          method: "PUT",
          body: JSON.stringify({
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
            puesto_laboral: historiaPacienteInfo?.ocupacion ?? null,
            doctor_atencion: doctorAtencion || null,
            historia: historiaData.historia,
            antecedentes: historiaData.antecedentes,
            antecedentes_generales: historiaData.antecedentes_generales,
            antecedentes_familiares: historiaData.antecedentes_familiares,
            antecedentes_otro: antecedentesOtro || null,
            alergias: historiaData.alergias,
            enfermedades: historiaData.enfermedades,
            cirugias: historiaData.cirugias,
            fumador_tabaco: historiaData.fumador_tabaco,
            fumador_marihuana: historiaData.fumador_marihuana,
            consumidor_alcohol: historiaData.consumidor_alcohol,
            diabetes: historiaData.diabetes,
            tipo_diabetes: historiaData.tipo_diabetes,
            deportista: historiaData.deportista,
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
            subjeoi: historiaData.subjeoi,
            adicionod: historiaData.adicionod,
            adicionoi: historiaData.adicionoi,
            papila: historiaData.papila,
            biomicroscopia: historiaData.biomicroscopia,
            diagnostico_general: historiaData.diagnostico_general,
            observaciones: historiaData.observaciones,
          }),
        }
      );
      if (!r.ok) throw new Error(await readErrorMessage(r));
      const data = await r.json();
      setHistoriaData(normalizeHistoriaForUi(data, me?.username ?? ""));
      setHistoriaGuardada(true);
      setHistoriaConfirmOpen(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setHistoriaSaving(false);
    }
  }




  async function doLogin(e: FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setError(null);

    try {
      const r = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      if (!r.ok) throw new Error(await readErrorMessage(r));

      const data = (await r.json()) as LoginResponse;
      setToken(data.access_token);

      setLoginPass("");

      await loadMe(); // llena me
      loadSucursales();

    } catch (e: any) {
      setError(String(e));
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
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "linear-gradient(180deg, #f7efe4 0%, #efe3d4 100%)",
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

          <form onSubmit={doLogin} style={{ border: "1px solid #e7d7c7", borderRadius: 16, background: "#fffaf4", padding: 20 }}>
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
                border: "1px solid #111",
                background: loggingIn ? "#eee" : "#111",
                color: loggingIn ? "#111" : "#fff",
                fontWeight: 700,
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

  const canCreatePaciente = isAdmin || isRecep;
  const canEditPaciente = isAdmin || isRecep || isDoctor;
  const canDeletePaciente = isAdmin;

  const canCreateConsulta = isAdmin || isDoctor || isRecep;
  const canEditConsulta = isAdmin || isDoctor || isRecep;
  const canDeleteConsulta = isAdmin || isDoctor || isRecep;
  const canCreateVenta = isAdmin || isDoctor || isRecep;
  const canEditVenta = isAdmin || isDoctor || isRecep;
  const canDeleteVenta = isAdmin || isDoctor || isRecep;

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
    padding: 10,
    borderRadius: 10,
    border: "1px solid #d9c7b3",
    background: "#fff",
  } as const;

  const antecedentesGeneralesSeleccionados = String(historiaData?.antecedentes_generales ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);

  const antecedentesFamiliaresSeleccionados = String(historiaData?.antecedentes_familiares ?? "")
    .split("|")
    .map((x: string) => x.trim())
    .filter(Boolean);


  return (
    <div
      style={{
        maxWidth: "none",
        width: "calc(100vw - 24px)",
        margin: "12px auto",
        padding: 22,
        fontFamily: "Avenir Next, Avenir, Nunito Sans, Segoe UI, sans-serif",
        minHeight: "calc(100vh - 24px)",
        color: "#2f241a",
        background: "linear-gradient(180deg, #fff8ef 0%, #fff4e8 100%)",
        border: "1px solid #e6d5c3",
        borderRadius: 20,
      }}
    >
      <style>{`
        input, select, textarea {
          box-sizing: border-box;
        }
        button {
          transition: transform 0.14s ease, box-shadow 0.18s ease, filter 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
        }
        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(86, 63, 40, 0.2);
          filter: brightness(0.98);
        }
        button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 4px 10px rgba(86, 63, 40, 0.18);
        }
      `}</style>

      <div
        style={{
          display: "grid",
          justifyItems: "center",
          textAlign: "center",
          gap: 4,
          marginBottom: 2,
          padding: "2px 20px 0",
        }}
      >
        <img
          src={logoOlm}
          alt="Óptica OLM"
          style={{
            height: "clamp(84px, 8vw, 130px)",
            width: "auto",
            maxWidth: "62vw",
            objectFit: "contain",
            mixBlendMode: "multiply",
            filter: "contrast(1.08) saturate(1.06)",
          }}
        />

        <div style={{ textAlign: "center", fontWeight: 900, fontSize: "clamp(16px, 1.9vw, 28px)", letterSpacing: 2.6, color: "#5f4a32", marginTop: -2 }}>
          BASE DE DATOS
        </div>
      </div>

      {/* Barra superior: sesión */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
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
              border: "1px solid #ddc9b4",
              background: "#fff8ef",
              fontWeight: 700,
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
            border: "1px solid #d2bca7",
            background: "#fff6ea",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>






      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Sucursal:</div>
        <select
          value={sucursalActivaId}
          disabled={me?.rol !== "admin"}
          onChange={(e) => setSucursalActivaId(Number(e.target.value))}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            minWidth: 280,
          }}
        >
          {sucursales.length === 0 ? (
            <option value={sucursalActivaId}>Cargando...</option>
          ) : (
            sucursales.map((s) => (
              <option key={s.sucursal_id} value={s.sucursal_id}>
                {s.nombre} — {s.ciudad}, {s.estado}
              </option>
            ))
          )}
        </select>
      </div>


      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <TabButton variant="pacientes" active={tab === "pacientes"} onClick={() => setTab("pacientes")}>
          Pacientes
        </TabButton>
        <TabButton variant="consultas" active={tab === "consultas"} onClick={() => setTab("consultas")}>
          Consultas
        </TabButton>
        <TabButton variant="ventas" active={tab === "ventas"} onClick={() => setTab("ventas")}>
          Ventas
        </TabButton>
        <TabButton variant="estadisticas" active={tab === "estadisticas"} onClick={() => setTab("estadisticas")}>
          Estadísticas
        </TabButton>
      </div>




      {/* ========================= PACIENTES ========================= */}
      {tab === "pacientes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, alignItems: "start" }}>
          <form
            onSubmit={onSubmitPaciente}
            noValidate
            style={{ ...softCard, padding: 16 }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              {editingPacienteId ? `Editando paciente #${editingPacienteId}` : "Nuevo paciente"}
            </div>

            <label style={{ display: "block", marginBottom: 8 }}>
              Primer nombre *
              <input
                value={formPaciente.primer_nombre ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, primer_nombre: e.target.value })}
                required
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Segundo nombre *
              <input
                value={formPaciente.segundo_nombre ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, segundo_nombre: e.target.value })}
                required
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
              Apellido materno *
              <input
                value={formPaciente.apellido_materno ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, apellido_materno: e.target.value })}
                required
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Fecha de nacimiento *
                <input
                  type="date"
                  value={formPaciente.fecha_nacimiento ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, fecha_nacimiento: e.target.value })}
                  required
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
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
                  onChange={(e) => setPacienteTelefonoLocal(onlyDigits(e.target.value).slice(0, 10))}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  placeholder="10 digitos"
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                Captura exactamente 10 dígitos.
              </div>
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Correo
              <input
                type="email"
                value={formPaciente.correo ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, correo: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

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
                  <option value="fb">FB</option>
                  <option value="google">Google</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="referencia">Referencia</option>
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
                placeholder="Buscar por ID, nombre, teléfono o correo..."
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  marginBottom: 10,
                }}
              />


            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th align="left" style={{ padding: 10 }}>ID</th>
                  <th align="left" style={{ padding: 10 }}>Nombre</th>
                  <th align="left" style={{ padding: 10 }}>Apellidos</th>
                  <th align="left" style={{ padding: 10 }}>Nacimiento</th>
                  <th align="left" style={{ padding: 10 }}>Teléfono</th>
                  <th align="left" style={{ padding: 10 }}>Correo</th>
                  <th align="left" style={{ padding: 10 }}>Acciones</th>

                </tr>
              </thead>


              <tbody>
                {pacientesFiltrados.map((p) => (
                  <tr key={p.paciente_id} style={{ borderTop: "1px solid #eee" }}>
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

                    {/* ACCIONES */}
                    <td style={{ padding: 10 }}>
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
                    <td style={{ padding: 10 }} colSpan={7}>
                      Sin pacientes (filtro)
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
                        <th align="left" style={{ padding: 10 }}>Fecha</th>
                        <th align="left" style={{ padding: 10 }}>Tipo</th>
                        <th align="left" style={{ padding: 10 }}>Doctor</th>
                        <th align="left" style={{ padding: 10 }}>Motivo</th>
                        <th align="left" style={{ padding: 10 }}>Diagnóstico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histConsultas.map((c) => (
                        <tr key={c.consulta_id} style={{ borderTop: "1px solid #eee" }}>
                          <td style={{ padding: 10 }}>{c.consulta_id}</td>
                          <td style={{ padding: 10 }}>{formatDateTimePretty(c.fecha_hora)}</td>
                          <td style={{ padding: 10 }}>{c.tipo_consulta ?? ""}</td>
                          <td style={{ padding: 10 }}>
                            {[c.doctor_primer_nombre, c.doctor_apellido_paterno].filter(Boolean).join(" ")}
                          </td>
                          <td style={{ padding: 10 }}>{c.motivo ?? ""}</td>
                          <td style={{ padding: 10 }}>{c.diagnostico ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ========================= CONSULTAS ========================= */}
      {
        tab === "consultas" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 16, alignItems: "start" }}>
            <form onSubmit={onSubmitConsulta} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                {editingConsultaId === null ? "Nueva consulta" : `Editando consulta #${editingConsultaId}`}
              </div>
              {successConsultaMsg && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: "1px solid #2ecc71", background: "#eafaf1", color: "#1e8449", fontWeight: 700 }}>
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
                <div style={{ marginBottom: 12, border: "1px solid #ddd", borderRadius: 10, padding: 10, background: "#fff" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={agendarConsulta}
                      onChange={(e) => {
                        setAgendarConsulta(e.target.checked);
                        if (!e.target.checked) setAgendaSlotSeleccionado(null);
                      }}
                    />
                    Agendar en Google Calendar
                  </label>

                  {agendarConsulta && (
                    <>
                      <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 8, flexWrap: "wrap" }}>
                        <label style={{ display: "block" }}>
                          Fecha *
                          <input
                            type="date"
                            value={agendaFecha}
                            onChange={(e) => setAgendaFecha(e.target.value)}
                            style={{ display: "block", padding: 8, borderRadius: 8, border: "1px solid #ddd", background: "#fff", minWidth: 180 }}
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

                      {agendaLoading ? (
                        <div style={{ fontSize: 13 }}>Cargando horarios...</div>
                      ) : agendaSlots.length === 0 ? (
                        <div style={{ fontSize: 13, opacity: 0.85 }}>No hay horarios disponibles para ese día.</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
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
                    </>
                  )}
                </div>
              )}

              <div style={{ display: "block", marginBottom: 10 }}>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>Tipo de consulta *</div>
                <div style={{ display: "grid", gap: 6, padding: 10, border: "1px solid #ddd", borderRadius: 10, background: "#fff" }}>
                  {[
                    "primera_vez_en_clinica",
                    "revision_general",
                    "graduacion_lentes",
                    "lentes_contacto",
                    "seguimiento",
                    "molestia",
                    "otro",
                  ].map((opt) => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={tiposConsultaSeleccionados.includes(opt)}
                        onChange={(e) => {
                          setTiposConsultaSeleccionados((prev) => {
                            const next = e.target.checked
                              ? [...prev, opt]
                              : prev.filter((x) => x !== opt);
                            if (!next.includes("otro")) setTipoConsultaOtro("");
                            setFormConsulta((curr) => ({ ...curr, tipo_consulta: next.join("|") }));
                            return next;
                          });
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {tiposConsultaSeleccionados.includes("otro") && (
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
                  onChange={(e) => {
                    const next = e.target.value;
                    const razon = tiposConsultaSeleccionados.includes("otro") && tipoConsultaOtro.trim()
                      ? `Razon (otro): ${tipoConsultaOtro.trim()}`
                      : "";
                    const merged = razon ? `${razon} | ${next}` : next;
                    if (wordCount(merged) <= 50) {
                      setFormConsulta({ ...formConsulta, notas: next });
                    }
                  }}
                  rows={3}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                  {(() => {
                    const razon = tiposConsultaSeleccionados.includes("otro") && tipoConsultaOtro.trim()
                      ? `Razon (otro): ${tipoConsultaOtro.trim()}`
                      : "";
                    const merged = razon
                      ? `${razon} | ${formConsulta.notas ?? ""}`
                      : (formConsulta.notas ?? "");
                    return `${wordCount(merged)}/50 palabras`;
                  })()}
                </div>
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
                background: savingConsulta ? "#f7ebdd" : "#C9822B",
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
                  onClick={() => loadConsultas()}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Actualizar lista
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>Consultas</span>
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: "1px solid #d7c4b0",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
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
                    background: "#5f4a32",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                    letterSpacing: 0.2,
                  }}
                >
                  BUSCAR CONSULTA
                </button>
              </div>

              <div style={{ padding: 14, paddingTop: 0 }}>
                <input
                  value={qConsulta}
                  onChange={(e) => setQConsulta(e.target.value)}
                  placeholder="Buscar por ID, paciente, doctor o tipo..."
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                />
              </div>


              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th align="left" style={{ padding: 10 }}>ID</th>
                    <th align="left" style={{ padding: 10 }}>Fecha</th>
                    <th align="left" style={{ padding: 10 }}>Paciente</th>
                    <th align="left" style={{ padding: 10 }}>Tipo</th>
                    <th align="left" style={{ padding: 10 }}>Doctor</th>
                    <th align="left" style={{ padding: 10 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consultasFiltradas.map((c) => (
                    <tr key={c.consulta_id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 10 }}>{c.consulta_id}</td>
                      <td style={{ padding: 10 }}>{formatDateTimePretty(c.fecha_hora)}</td>
                      <td style={{ padding: 10 }}>{c.paciente_nombre}</td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(c.tipo_consulta ?? "")
                            .split("|")
                            .map((x) => x.trim())
                            .filter(Boolean)
                            .map((tipo) => (
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
                                {tipo}
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
                      ) : (
                        <span style={{ opacity: 0.5 }}>Sin permisos</span>
                      )}
                      </td>
                    </tr>
                  ))}
                  {consultasFiltradas.length === 0 && (
                    <tr>
                      <td style={{ padding: 10 }} colSpan={6}>Sin consultas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }


      {/* ========================= VENTAS ========================= */}
      {tab === "ventas" && (
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

            <div style={{ display: "block", marginBottom: 10 }}>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>Compra *</div>
              <div style={{ display: "grid", gap: 6, padding: 10, border: "1px solid #ddd", borderRadius: 10, background: "#fff" }}>
                {[
                  "armazon",
                  "micas",
                  "lentes_contacto",
                  "micas_antiblueray",
                  "micas_fotocromaticas",
                  "otro",
                ].map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={ventasSeleccionadas.includes(opt)}
                      onChange={(e) => {
                        setVentasSeleccionadas((prev) => {
                          const next = e.target.checked ? [...prev, opt] : prev.filter((x) => x !== opt);
                          if (!next.includes("otro")) setVentaCompraOtro("");
                          setFormVenta((curr) => ({ ...curr, compra: next.join("|") }));
                          return next;
                        });
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {ventasSeleccionadas.includes("otro") && (
              <label style={{ display: "block", marginBottom: 8 }}>
                Detalle (otro) *
                <input
                  value={ventaCompraOtro}
                  onChange={(e) => setVentaCompraOtro(e.target.value)}
                  required
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
            )}

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

            <label style={{ display: "block", marginBottom: 8 }}>
              Método de pago *
              <select
                value={formVenta.metodo_pago}
                onChange={(e) =>
                  setFormVenta({
                    ...formVenta,
                    metodo_pago: e.target.value as "efectivo" | "tarjeta_credito" | "tarjeta_debito",
                  })
                }
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
              >
                <option value="efectivo">efectivo</option>
                <option value="tarjeta_credito">tarjeta_credito</option>
                <option value="tarjeta_debito">tarjeta_debito</option>
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              ¿Dejó adelanto? *
              <select
                value={formVenta.adelanto_aplica ? "si" : "no"}
                onChange={(e) => {
                  const aplica = e.target.value === "si";
                  setFormVenta({
                    ...formVenta,
                    adelanto_aplica: aplica,
                    adelanto_monto: aplica ? formVenta.adelanto_monto ?? null : null,
                    adelanto_metodo: aplica ? formVenta.adelanto_metodo ?? "efectivo" : null,
                  });
                }}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
              >
                <option value="no">no</option>
                <option value="si">si</option>
              </select>
            </label>

            {formVenta.adelanto_aplica && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Monto adelanto (MXN) *
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
                    required
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Método adelanto *
                  <select
                    value={formVenta.adelanto_metodo ?? "efectivo"}
                    onChange={(e) =>
                      setFormVenta({
                        ...formVenta,
                        adelanto_metodo: e.target.value as "efectivo" | "tarjeta_credito" | "tarjeta_debito",
                      })
                    }
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                  >
                    <option value="efectivo">efectivo</option>
                    <option value="tarjeta_credito">tarjeta_credito</option>
                    <option value="tarjeta_debito">tarjeta_debito</option>
                  </select>
                </label>
              </div>
            )}

            <label style={{ display: "block", marginBottom: 8 }}>
              Notas
              <textarea
                value={formVenta.notas ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (wordCount(next) <= 50) {
                    setFormVenta({ ...formVenta, notas: next });
                  }
                }}
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                {`${wordCount(formVenta.notas ?? "")}/50 palabras`}
              </div>
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
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(v.compra ?? "")
                          .split("|")
                          .map((x) => x.trim())
                          .filter(Boolean)
                          .map((item) => (
                            <span key={`${v.venta_id}-${item}`} style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #d9c7b3", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}>
                              {item}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td style={{ padding: 10 }}>${Number(v.monto_total || 0).toFixed(2)}</td>
                    <td style={{ padding: 10 }}>{v.metodo_pago ?? ""}</td>
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
                      ) : (
                        <span style={{ opacity: 0.5 }}>Sin permisos</span>
                      )}
                    </td>
                  </tr>
                ))}
                {ventasFiltradas.length === 0 && (
                  <tr>
                    <td style={{ padding: 10 }} colSpan={8}>Sin ventas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "estadisticas" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ ...softCard, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>
                Estadísticas de sucursal #{sucursalActivaId}
              </div>
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => { setStatsFiltroModo("hoy"); loadStats({ modo: "hoy" }); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "hoy" ? "#111" : "#fff", color: statsFiltroModo === "hoy" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Hoy</button>
              <button type="button" onClick={() => { setStatsFiltroModo("semana"); loadStats({ modo: "semana" }); }} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "semana" ? "#111" : "#fff", color: statsFiltroModo === "semana" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Semana</button>
              <button type="button" onClick={() => setStatsFiltroModo("mes")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "mes" ? "#111" : "#fff", color: statsFiltroModo === "mes" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Mes</button>
              <button type="button" onClick={() => setStatsFiltroModo("anio")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: statsFiltroModo === "anio" ? "#111" : "#fff", color: statsFiltroModo === "anio" ? "#fff" : "#111", fontWeight: 700, cursor: "pointer" }}>Año</button>
            </div>

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

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Filtro actual: {statsData?.periodo?.label ?? statsFiltroLabel}
            </div>
          </div>

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
                <div style={{ ...softCard, padding: 14 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Ventas (periodo)</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{statsData.ventas.total}</div>
                </div>
                {(isAdmin || isRecep) && (
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Monto ventas (periodo)</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>${Number(statsData.ventas.monto_total || 0).toFixed(2)}</div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
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
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Bar chart: productos más comprados (periodo)</div>
                {statsData.productos_top.length === 0 ? (
                  <div>Sin ventas de productos en el periodo.</div>
                ) : (
                  <div style={{ display: "grid", gap: 9 }}>
                    {(() => {
                      const maxValue = Math.max(1, ...statsData.productos_top.map((x) => x.total));
                      return statsData.productos_top.map((item) => (
                        <div key={`prod-${item.producto}`} style={{ display: "grid", gridTemplateColumns: "220px 1fr 50px", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 13 }}>{formatStatsEtiqueta(item.producto)}</div>
                          <div style={{ height: 12, borderRadius: 999, background: "#eee6dc", overflow: "hidden" }}>
                            <div style={{ width: `${(item.total / maxValue) * 100}%`, height: "100%", background: "#C9822B" }} />
                          </div>
                          <div style={{ textAlign: "right", fontWeight: 700 }}>{item.total}</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
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
              <div><b>Fecha:</b> {formatDateTimePretty(selectedConsultaDetalle.fecha_hora)}</div>
              <div><b>Paciente:</b> {selectedConsultaDetalle.paciente_nombre}</div>
              <div><b>Doctor:</b> {[selectedConsultaDetalle.doctor_primer_nombre, selectedConsultaDetalle.doctor_apellido_paterno].filter(Boolean).join(" ")}</div>
              <div><b>Sucursal:</b> {selectedConsultaDetalle.sucursal_nombre ?? ""}</div>
              <div style={{ gridColumn: "1 / -1" }}>
                <b>Tipo de consulta:</b>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(selectedConsultaDetalle.tipo_consulta ?? "")
                    .split("|")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((tipo) => (
                      <span
                        key={`modal-consulta-${selectedConsultaDetalle.consulta_id}-${tipo}`}
                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #d9c7b3", background: "#fff", fontSize: 12, fontWeight: 700, color: "#5a4633" }}
                      >
                        {tipo}
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
              <div><b>Monto total:</b> ${Number(selectedVentaDetalle.monto_total || 0).toFixed(2)}</div>
              <div><b>Método de pago:</b> {formatMetodoPagoLabel(selectedVentaDetalle.metodo_pago)}</div>
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
                <input type="date" value={pacienteFechaDesde} onChange={(e) => setPacienteFechaDesde(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                <input type="date" value={pacienteFechaHasta} onChange={(e) => setPacienteFechaHasta(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
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
                <input type="date" value={consultaFechaDesde} onChange={(e) => setConsultaFechaDesde(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
                <input type="date" value={consultaFechaHasta} onChange={(e) => setConsultaFechaHasta(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
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
      {historiaPacienteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(71,54,37,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, #fffdf9 0%, #fff6eb 100%)",
              padding: 20,
              borderRadius: 18,
              border: "1px solid #e2cfba",
              width: 1240,
              maxWidth: "98vw",
              maxHeight: "94vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(68, 49, 33, 0.26)",
            }}
          >
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "linear-gradient(180deg, #fffdf9 0%, #fff6eb 100%)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #ead9c8",
              }}
            >
              <h2 style={{ margin: 0 }}>
                Historia clínica paciente #{historiaPacienteId}
              </h2>
              <button
                type="button"
                onClick={closeHistoriaModal}
                aria-label="Cerrar historia clínica"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "1px solid #d8c5b0",
                  background: "#fff",
                  color: "#5f4a32",
                  fontWeight: 800,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                X
              </button>
            </div>
            <style>{`
              .historia-required label > span::after { content: " *"; color: #8d5d2f; font-weight: 800; }
            `}</style>
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
                  {canEditPaciente && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!historiaPacienteInfo) return;
                        startEditPaciente(historiaPacienteInfo);
                        closeHistoriaModal();
                      }}
                      style={{ ...actionBtnStyle, padding: "6px 10px" }}
                    >
                      Editar paciente
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <div><strong>Nombre:</strong> {[historiaPacienteInfo.primer_nombre, historiaPacienteInfo.segundo_nombre, historiaPacienteInfo.apellido_paterno, historiaPacienteInfo.apellido_materno].filter(Boolean).join(" ")}</div>
                  <div><strong>Fecha de nacimiento:</strong> {historiaPacienteInfo.fecha_nacimiento || ""}</div>
                  <div><strong>Edad:</strong> {calcAge(historiaPacienteInfo.fecha_nacimiento)}</div>
                  <div><strong>Teléfono:</strong> {historiaPacienteInfo.telefono || ""}</div>
                  <div><strong>Correo:</strong> {historiaPacienteInfo.correo || ""}</div>
                </div>
              </div>
            )}
        

            {historiaGuardada && (
              <div
                style={{
                  background: "#e8f8f2",
                  border: "1px solid #2ecc71",
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 18,
                  fontWeight: 600,
                  color: "#1e8449",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  ✔ Historia clínica guardada correctamente
                </div>
              




                <button
                  type="button"
                  onClick={() => {
                    setHistoriaGuardada(false);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #2ecc71",
                    background: "#2ecc71",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ver historia clínica
                </button>
              </div>
            )}




            {loadingHistoria ? (
              <div>Cargando...</div>
            ) : historiaData ? (

              <form
                className="historia-required"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setError(null);
                    const missing = getHistoriaMissingFields();
                    if (missing.length > 0) {
                      setHistoriaMissingSummary(`Faltan ${missing.length} campos: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "..." : ""}`);
                      return;
                    }
                    setHistoriaMissingSummary(null);
                    setHistoriaConfirmOpen(true);
                  } catch (e: any) {
                    setError(e?.message ?? String(e));
                  }
                }}
                style={{ display: "grid", gap: 16 }}
              >
                {/* Refracción */}
                <h3 style={{ margin: 0, color: "#5f4a32" }}>Refracción</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                  <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 14, borderRadius: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Ojo derecho (OD)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <label style={{ display: "grid", gap: 4 }}><span>Esfera</span><input type="number" step="0.25" style={historiaInputStyle} value={historiaData.od_esfera ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_esfera: e.target.value || null})}/></label>
                      <label style={{ display: "grid", gap: 4 }}><span>Cilindro</span><input type="number" step="0.25" style={historiaInputStyle} value={historiaData.od_cilindro ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_cilindro: e.target.value || null})}/></label>
                      <label style={{ display: "grid", gap: 4 }}><span>Eje</span><input type="number" style={historiaInputStyle} value={historiaData.od_eje ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_eje: e.target.value || null})}/></label>
                      <label style={{ display: "grid", gap: 4 }}><span>Add</span><input type="number" step="0.25" style={historiaInputStyle} value={historiaData.od_add ?? ""} onChange={(e)=>setHistoriaData({...historiaData, od_add: e.target.value || null})}/></label>
                    </div>
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #ead9c8", padding: 14, borderRadius: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Ojo izquierdo (OI)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <label style={{ display: "grid", gap: 4 }}><span>Esfera</span><input type="number" step="0.25" style={historiaInputStyle} value={historiaData.oi_esfera ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_esfera: e.target.value || null})}/></label>
                      <label style={{ display: "grid", gap: 4 }}><span>Cilindro</span><input type="number" step="0.25" style={historiaInputStyle} value={historiaData.oi_cilindro ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_cilindro: e.target.value || null})}/></label>
                      <label style={{ display: "grid", gap: 4 }}><span>Eje</span><input type="number" style={historiaInputStyle} value={historiaData.oi_eje ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_eje: e.target.value || null})}/></label>
                      <label style={{ display: "grid", gap: 4 }}><span>Add</span><input type="number" step="0.25" style={historiaInputStyle} value={historiaData.oi_add ?? ""} onChange={(e)=>setHistoriaData({...historiaData, oi_add: e.target.value || null})}/></label>
                    </div>
                  </div>
                </div>

                {/* Mediciones */}
                <h3 style={{ margin: 0, color: "#5f4a32" }}>Mediciones</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                  <label style={{ display: "grid", gap: 4 }}><span>DP</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.dp ?? ""} onChange={(e)=>setHistoriaData({...historiaData, dp: e.target.value || null})}/></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Queratometría OD</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.queratometria_od ?? ""} onChange={(e)=>setHistoriaData({...historiaData, queratometria_od: e.target.value || null})}/></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Queratometría OI</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.queratometria_oi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, queratometria_oi: e.target.value || null})}/></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Presión OD</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.presion_od ?? ""} onChange={(e)=>setHistoriaData({...historiaData, presion_od: e.target.value || null})}/></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Presión OI</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.presion_oi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, presion_oi: e.target.value || null})}/></label>
                </div>

                {/* Historia y antecedentes */}
                <h3 style={{ margin: 0, color: "#5f4a32" }}>Historia y antecedentes</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Doctor primer nombre</span>
                    <input
                      style={historiaInputStyle}
                      value={historiaData.doctor_primer_nombre ?? ""}
                      onChange={(e) => {
                        const primerNombre = e.target.value;
                        const apellidoPaterno = historiaData.doctor_apellido_paterno ?? "";
                        setHistoriaData({
                          ...historiaData,
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
                      value={historiaData.doctor_apellido_paterno ?? ""}
                      onChange={(e) => {
                        const apellidoPaterno = e.target.value;
                        const primerNombre = historiaData.doctor_primer_nombre ?? "";
                        setHistoriaData({
                          ...historiaData,
                          doctor_apellido_paterno: apellidoPaterno,
                          doctor_atencion: composeDoctorAtencion(primerNombre, apellidoPaterno),
                        });
                      }}
                    />
                  </label>
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Historia</span>
                  <textarea
                    style={{ ...historiaInputStyle, minHeight: 80, resize: "vertical" }}
                    value={historiaData.historia ?? ""}
                    onChange={(e)=>setHistoriaData({...historiaData, historia: e.target.value})}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Antecedentes</span>
                  <textarea
                    style={{ ...historiaInputStyle, minHeight: 80, resize: "vertical" }}
                    value={historiaData.antecedentes ?? ""}
                    onChange={(e)=>setHistoriaData({...historiaData, antecedentes: e.target.value})}
                  />
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
                                const familiarOtro = historiaData.antecedentes_otro_familiar ?? "";
                                setHistoriaData({
                                  ...historiaData,
                                  antecedentes_generales: next.join("|"),
                                  antecedentes_otro_general: generalOtro,
                                  antecedentes_otro: composeAntecedentesOtro(generalOtro, familiarOtro),
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {antecedentesGeneralesSeleccionados.includes("otro") && (
                      <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                        <span>Otro (generales)</span>
                        <input
                          style={historiaInputStyle}
                          value={historiaData.antecedentes_otro_general ?? ""}
                          onChange={(e) => {
                            const general = e.target.value;
                            const familiar = historiaData.antecedentes_otro_familiar ?? "";
                            setHistoriaData({
                              ...historiaData,
                              antecedentes_otro_general: general,
                              antecedentes_otro: composeAntecedentesOtro(general, familiar),
                            });
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Antecedentes familiares</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>
                      {ANTECEDENTE_OPTIONS.map((opt) => {
                        return (
                          <label key={`af-${opt}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={antecedentesFamiliaresSeleccionados.includes(opt)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...antecedentesFamiliaresSeleccionados, opt]
                                  : antecedentesFamiliaresSeleccionados.filter((x) => x !== opt);
                                const removeOtroFamiliar = opt === "otro" && !e.target.checked;
                                const familiarOtro = removeOtroFamiliar ? "" : (historiaData.antecedentes_otro_familiar ?? "");
                                const generalOtro = historiaData.antecedentes_otro_general ?? "";
                                setHistoriaData({
                                  ...historiaData,
                                  antecedentes_familiares: next.join("|"),
                                  antecedentes_otro_familiar: familiarOtro,
                                  antecedentes_otro: composeAntecedentesOtro(generalOtro, familiarOtro),
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {antecedentesFamiliaresSeleccionados.includes("otro") && (
                      <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                        <span>Otro (familiares)</span>
                        <input
                          style={historiaInputStyle}
                          value={historiaData.antecedentes_otro_familiar ?? ""}
                          onChange={(e) => {
                            const familiar = e.target.value;
                            const general = historiaData.antecedentes_otro_general ?? "";
                            setHistoriaData({
                              ...historiaData,
                              antecedentes_otro_familiar: familiar,
                              antecedentes_otro: composeAntecedentesOtro(general, familiar),
                            });
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Alergias</span>
                    <textarea
                      style={{ ...historiaInputStyle, minHeight: 70, resize: "vertical" }}
                      value={historiaData.alergias ?? ""}
                      onChange={(e) => setHistoriaData({ ...historiaData, alergias: e.target.value })}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Enfermedades</span>
                    <textarea
                      style={{ ...historiaInputStyle, minHeight: 70, resize: "vertical" }}
                      value={historiaData.enfermedades ?? ""}
                      onChange={(e) => setHistoriaData({ ...historiaData, enfermedades: e.target.value })}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Cirugías</span>
                    <textarea
                      style={{ ...historiaInputStyle, minHeight: 70, resize: "vertical" }}
                      value={historiaData.cirugias ?? ""}
                      onChange={(e) => setHistoriaData({ ...historiaData, cirugias: e.target.value })}
                    />
                  </label>
                </div>

                {/* Hábitos y riesgos */}
                <h3 style={{ margin: 0, color: "#5f4a32" }}>Hábitos y riesgos</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                  <label style={{ display: "grid", gap: 4 }}><span>Fumador tabaco</span><select style={historiaInputStyle} value={String(historiaData.fumador_tabaco ?? "")} onChange={(e)=>setHistoriaData({...historiaData, fumador_tabaco: parseBoolSelect(e.target.value)})}><option value="">Seleccionar</option><option value="true">Si</option><option value="false">No</option></select></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Fumador marihuana</span><select style={historiaInputStyle} value={String(historiaData.fumador_marihuana ?? "")} onChange={(e)=>setHistoriaData({...historiaData, fumador_marihuana: parseBoolSelect(e.target.value)})}><option value="">Seleccionar</option><option value="true">Si</option><option value="false">No</option></select></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Consumidor alcohol</span><select style={historiaInputStyle} value={String(historiaData.consumidor_alcohol ?? "")} onChange={(e)=>setHistoriaData({...historiaData, consumidor_alcohol: parseBoolSelect(e.target.value)})}><option value="">Seleccionar</option><option value="true">Si</option><option value="false">No</option></select></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Diabetes</span><select style={historiaInputStyle} value={String(historiaData.diabetes ?? "")} onChange={(e)=>setHistoriaData({...historiaData, diabetes: parseBoolSelect(e.target.value), tipo_diabetes: parseBoolSelect(e.target.value) ? historiaData.tipo_diabetes : null})}><option value="">Seleccionar</option><option value="true">Si</option><option value="false">No</option></select></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Deportista</span><select style={historiaInputStyle} value={String(historiaData.deportista ?? "")} onChange={(e)=>setHistoriaData({...historiaData, deportista: parseBoolSelect(e.target.value)})}><option value="">Seleccionar</option><option value="true">Si</option><option value="false">No</option></select></label>
                  {historiaData.diabetes === true && (
                    <label style={{ display: "grid", gap: 4 }}><span>Tipo de diabetes</span><input style={historiaInputStyle} value={historiaData.tipo_diabetes ?? ""} onChange={(e)=>setHistoriaData({...historiaData, tipo_diabetes: e.target.value})} /></label>
                  )}
                </div>

                {/* Optometría complementaria */}
                <h3 style={{ margin: 0, color: "#5f4a32" }}>Optometría complementaria</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, background: "#fff", border: "1px solid #ead9c8", padding: 12, borderRadius: 12 }}>
                  <label style={{ display: "grid", gap: 4 }}><span>PPC</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.ppc ?? ""} onChange={(e)=>setHistoriaData({...historiaData, ppc: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Lejos</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.lejos ?? ""} onChange={(e)=>setHistoriaData({...historiaData, lejos: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Cerca</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.cerca ?? ""} onChange={(e)=>setHistoriaData({...historiaData, cerca: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Tensión</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.tension ?? ""} onChange={(e)=>setHistoriaData({...historiaData, tension: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>mmHg</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.mmhg ?? ""} onChange={(e)=>setHistoriaData({...historiaData, mmhg: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>DI</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.di ?? ""} onChange={(e)=>setHistoriaData({...historiaData, di: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Adición OD</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.adicionod ?? ""} onChange={(e)=>setHistoriaData({...historiaData, adicionod: e.target.value || null})} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span>Adición OI</span><input type="number" step="0.1" style={historiaInputStyle} value={historiaData.adicionoi ?? ""} onChange={(e)=>setHistoriaData({...historiaData, adicionoi: e.target.value || null})} /></label>
                </div>

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

                {/* Diagnóstico */}
                <h3 style={{ margin: 0, color: "#5f4a32" }}>Diagnóstico</h3>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Diagnóstico general</span>
                  <textarea
                    style={{ ...historiaInputStyle, minHeight: 90, resize: "vertical" }}
                    value={historiaData.diagnostico_general ?? ""}
                    onChange={(e)=>setHistoriaData({...historiaData, diagnostico_general: e.target.value})}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span>Observaciones</span>
                  <textarea
                    style={{ ...historiaInputStyle, minHeight: 90, resize: "vertical" }}
                    value={historiaData.observaciones ?? ""}
                    onChange={(e)=>setHistoriaData({...historiaData, observaciones: e.target.value})}
                  />
                </label>

                <div style={{ position: "sticky", bottom: 0, background: "linear-gradient(180deg, rgba(255,246,235,0.1), #fff6eb)", paddingTop: 10 }}>
                  <button type="submit" style={{ width: "100%", padding: "13px 18px", borderRadius: 12, border: "1px solid #5f4a32", background: "#5f4a32", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    Guardar cambios
                  </button>
                  {historiaConfirmOpen && (
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #d8c2a8", background: "#fff8ef", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, color: "#5f4a32" }}>¿Guardar cambios de esta historia clínica?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => setHistoriaConfirmOpen(false)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d7c4b0", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
                          Seguir editando
                        </button>
                        <button type="button" disabled={historiaSaving} onClick={saveHistoriaClinica} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #5f4a32", background: "#5f4a32", color: "#fff", fontWeight: 700, cursor: historiaSaving ? "not-allowed" : "pointer" }}>
                          {historiaSaving ? "Guardando..." : "Guardar ahora"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

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
                        `/pacientes/${historiaPacienteId}/historia?sucursal_id=${sucursalActivaId}`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            paciente_id: historiaPacienteId,
                            diagnostico_general: "",
                            doctor_atencion: me?.username ?? "",
                          }),
                        }
                      );

                      if (!r.ok) throw new Error(await readErrorMessage(r));

                      const data = await r.json();
                      setHistoriaData(normalizeHistoriaForUi(data, me?.username ?? ""));
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


                <button
                  type="button"
                  onClick={closeHistoriaModal}
                  style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, border: "1px solid #d8c5b0", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  Cerrar
                </button>
              </div>
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
