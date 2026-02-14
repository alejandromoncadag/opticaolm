
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
  variant: "pacientes" | "consultas";
  children: ReactNode;
  onClick: () => void;
}) {
  const activeBg = variant === "pacientes" ? "#6F8A3C" : "#C9822B";
  const activeBorder = variant === "pacientes" ? "#5f7734" : "#b37225";
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

export default function App() {
  const [tab, setTab] = useState<"pacientes" | "consultas">("pacientes");

  // ---- Estado de sesión y búsqueda ----
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
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
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);





  // Historial por paciente
  const [histPacienteId, setHistPacienteId] = useState<number | null>(null);
  const [histConsultas, setHistConsultas] = useState<Consulta[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);


  const [savingPaciente, setSavingPaciente] = useState(false);
  const [savingConsulta, setSavingConsulta] = useState(false);
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
  const [deleteConfirmType, setDeleteConfirmType] = useState<"paciente" | "consulta" | null>(null);
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
  });

  const [formConsulta, setFormConsulta] = useState<ConsultaCreate>({
    paciente_id: 0,
    sucursal_id: 1,
    tipo_consulta: "primera_vez",
    doctor_primer_nombre: "",
    doctor_apellido_paterno: "",
    motivo: "",
    diagnostico: "",
    plan: "",
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
      c.motivo,
      c.diagnostico,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return texto.includes(q);
  });
}, [consultas, qConsulta]);




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


  useEffect(() => {
    if (getToken()) loadMe();
  }, []);



  useEffect(() => {
    if (!me) return;
    setFormPaciente((prev) => ({ ...prev, sucursal_id: sucursalActivaId }));
    setFormConsulta((prev) => ({ ...prev, sucursal_id: sucursalActivaId, paciente_id: 0 }));
    loadPacientes();
    loadConsultas();
  }, [sucursalActivaId, me]);

  useEffect(() => {
    if (!me) return;
    loadSucursales();
  }, [me]);





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
    });
    setTab("pacientes");
  }

  function cancelEditPaciente() {
    setEditingPacienteId(null);
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
    });
  }

  // ---- Acciones de formularios ----
  async function onSubmitPaciente(e: FormEvent) {
    e.preventDefault();
    setSavingPaciente(true);
    setError(null);

    try {
      const payload = cleanPayload({ ...formPaciente, sucursal_id: sucursalActivaId });

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
      setHistoriaData({
        ...data,
        avsinrixoi: data.avsinrixoi ?? data.avsinrxoi ?? "",
        doctor_atencion: data.doctor_atencion ?? me?.username ?? "",
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingHistoria(false);
    }
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

  async function confirmDeleteAction() {
    if (!deleteConfirmType || deleteConfirmId === null) return;
    setDeleteConfirmBusy(true);
    try {
      if (deleteConfirmType === "paciente") {
        await deletePaciente(deleteConfirmId);
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







  async function onSubmitConsulta(e: FormEvent) {
    e.preventDefault();
    setSavingConsulta(true);
    setError(null);

    try {
      if (!formConsulta.paciente_id || formConsulta.paciente_id === 0) {
        throw new Error("Selecciona un paciente.");
      }

      const payload = cleanPayload({ ...formConsulta, sucursal_id: sucursalActivaId });
      console.log("POST /consultas payload:", payload);
      
      const r = await apiFetch(`/consultas`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(await readErrorMessage(r));


      // limpiar form (pero mantener paciente y doctor si quieres)
      setFormConsulta((prev) => ({
        ...prev,
        tipo_consulta: "primera_vez",
        motivo: "",
        diagnostico: "",
        plan: "",
        notas: "",
      }));

      loadConsultas();
      setTab("consultas");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingConsulta(false);
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
            doctor_atencion: historiaData.doctor_atencion ?? me?.username ?? null,
            historia: historiaData.historia,
            antecedentes: historiaData.antecedentes,
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
      setHistoriaData({
        ...data,
        avsinrixoi: data.avsinrixoi ?? data.avsinrxoi ?? "",
        doctor_atencion: data.doctor_atencion ?? me?.username ?? "",
      });
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
        <div style={{ width: "100%", maxWidth: 400, fontFamily: "system-ui" }}>
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

          <form onSubmit={doLogin} style={{ border: "1px solid #e7d7c7", borderRadius: 16, background: "#fffaf4", padding: 16 }}>
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

  const canCreateConsulta = isAdmin || isDoctor;
  const canDeleteConsulta = isAdmin || isDoctor;

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
          gap: 8,
          marginBottom: 8,
          padding: "6px 20px 4px",
        }}
      >
        <img
          src={logoOlm}
          alt="Óptica OLM"
          style={{
            height: "clamp(140px, 14vw, 220px)",
            width: "auto",
            maxWidth: "72vw",
            objectFit: "contain",
            mixBlendMode: "multiply",
            filter: "contrast(1.08) saturate(1.06)",
          }}
        />

        <div style={{ textAlign: "center", fontWeight: 900, fontSize: "clamp(22px, 2.6vw, 38px)", letterSpacing: 4.2, color: "#5f4a32" }}>
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
      </div>




      {/* ========================= PACIENTES ========================= */}
      {tab === "pacientes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, alignItems: "start" }}>
          <form
            onSubmit={onSubmitPaciente}
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
                <input
                  type="date"
                  value={formPaciente.fecha_nacimiento ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, fecha_nacimiento: e.target.value })}
                  required
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Sexo
                <select
                  value={formPaciente.sexo ?? ""}
                  onChange={(e) => setFormPaciente({ ...formPaciente, sexo: e.target.value })}
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
                  <option value="otro">otro</option>
                  <option value="no_especifica">no_especifica</option>
                </select>
              </label>
            </div>

            <label style={{ display: "block", marginBottom: 8 }}>
              Teléfono
              <input
                value={formPaciente.telefono ?? ""}
                onChange={(e) => setFormPaciente({ ...formPaciente, telefono: e.target.value })}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
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
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Nueva consulta</div>

              <label style={{ display: "block", marginBottom: 8 }}>
                Paciente *
                <select
                  value={formConsulta.paciente_id}
                  onChange={(e) => setFormConsulta({ ...formConsulta, paciente_id: Number(e.target.value) })}
                  required
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  {pacientesOpciones.length === 0 ? (
                    <option value={0}>No hay pacientes</option>
                  ) : (
                    pacientesOpciones.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Tipo de consulta
                <select
                  value={formConsulta.tipo_consulta ?? ""}
                  onChange={(e) => setFormConsulta({ ...formConsulta, tipo_consulta: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  <option value="primera_vez">primera_vez</option>
                  <option value="seguimiento">seguimiento</option>
                  <option value="lentes_contacto">lentes_contacto</option>
                  <option value="graduacion">graduacion</option>
                  <option value="otro">otro</option>
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Doctor (nombre)
                  <input
                    value={formConsulta.doctor_primer_nombre ?? ""}
                    onChange={(e) => setFormConsulta({ ...formConsulta, doctor_primer_nombre: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <label style={{ display: "block", marginBottom: 8 }}>
                  Doctor (apellido)
                  <input
                    value={formConsulta.doctor_apellido_paterno ?? ""}
                    onChange={(e) => setFormConsulta({ ...formConsulta, doctor_apellido_paterno: e.target.value })}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>
              </div>

              <label style={{ display: "block", marginBottom: 8 }}>
                Motivo
                <input
                  value={formConsulta.motivo ?? ""}
                  onChange={(e) => setFormConsulta({ ...formConsulta, motivo: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Diagnóstico
                <input
                  value={formConsulta.diagnostico ?? ""}
                  onChange={(e) => setFormConsulta({ ...formConsulta, diagnostico: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Plan
                <textarea
                  value={formConsulta.plan ?? ""}
                  onChange={(e) => setFormConsulta({ ...formConsulta, plan: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

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
                  pacientesOpciones.length === 0 ||
                  !canCreateConsulta
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
                {savingConsulta ? "Guardando..." : "Guardar consulta"}
              </button>

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
                  placeholder="Buscar por ID, paciente, doctor, tipo, motivo, diagnóstico..."
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
                    <th align="left" style={{ padding: 10 }}>Motivo</th>
                    <th align="left" style={{ padding: 10 }}>Diagnóstico</th>
                    <th align="left" style={{ padding: 10 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consultasFiltradas.map((c) => (
                    <tr key={c.consulta_id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 10 }}>{c.consulta_id}</td>
                      <td style={{ padding: 10 }}>{formatDateTimePretty(c.fecha_hora)}</td>
                      <td style={{ padding: 10 }}>{c.paciente_nombre}</td>
                      <td style={{ padding: 10 }}>{c.tipo_consulta ?? ""}</td>
                      <td style={{ padding: 10 }}>
                        {[c.doctor_primer_nombre, c.doctor_apellido_paterno].filter(Boolean).join(" ")}
                      </td>
                      <td style={{ padding: 10 }}>{c.motivo ?? ""}</td>
                      <td style={{ padding: 10 }}>{c.diagnostico ?? ""}</td>
                      <td style={{ padding: 10 }}>
                      
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
                      <td style={{ padding: 10 }} colSpan={8}>Sin consultas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }


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
                : `¿Seguro que quieres eliminar la consulta #${deleteConfirmId}?`}
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
              padding: 24,
              borderRadius: 18,
              border: "1px solid #e2cfba",
              width: 1040,
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(68, 49, 33, 0.26)",
            }}
          >
            <h2 style={{ marginBottom: 12 }}>
              Historia clínica paciente #{historiaPacienteId}
            </h2>
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
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <div><strong>Nombre:</strong> {[historiaPacienteInfo.primer_nombre, historiaPacienteInfo.segundo_nombre, historiaPacienteInfo.apellido_paterno, historiaPacienteInfo.apellido_materno].filter(Boolean).join(" ")}</div>
                <div><strong>Fecha de nacimiento:</strong> {historiaPacienteInfo.fecha_nacimiento || ""}</div>
                <div><strong>Edad:</strong> {calcAge(historiaPacienteInfo.fecha_nacimiento)}</div>
                <div><strong>Teléfono:</strong> {historiaPacienteInfo.telefono || ""}</div>
                <div><strong>Correo:</strong> {historiaPacienteInfo.correo || ""}</div>
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
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Doctor que atendió</span>
                  <input
                    style={historiaInputStyle}
                    value={historiaData.doctor_atencion ?? ""}
                    onChange={(e)=>setHistoriaData({...historiaData, doctor_atencion: e.target.value})}
                  />
                </label>
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
                      setHistoriaData(data);
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
                  onClick={() => {
                    setHistoriaPacienteId(null);
                    setHistoriaPacienteInfo(null);
                    setHistoriaGuardada(false);
                    setHistoriaConfirmOpen(false);
                    setHistoriaMissingSummary(null);
                  }}
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
