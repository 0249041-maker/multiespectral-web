/** IDs de sección del panel de instrumentación (solo UI). */
export const CAMERA_SECTION_IDS = {
  STATUS: "status",
  CONFIG: "config",
  CAL_FILTERS: "cal-filters",
  /** Enfoque + diafragma en un solo flujo (misma vista en vivo). */
  CAL_FOCUS_APERTURE: "cal-focus-aperture",
  CAL_WHITE: "cal-white",
  CAPTURE_SINGLE: "capture-single",
  CAPTURE_CONTINUOUS: "capture-continuous",
  LIVE: "live",
  LEDS: "leds",
  LOGS: "logs",
};

/** IDs de pasos del flujo de trabajo (línea de tiempo del menú). */
export const CAMERA_WORKFLOW_STEP_IDS = {
  CONFIG: "config",
  CAL_FILTERS: "calFilters",
  CAL_FOCUS: "calFocus",
  CAL_WHITE: "calWhite",
  CAPTURE: "capture",
};

/** Pasos ordenados: Config → calibraciones → captura (1× o secuencia). */
export const CAMERA_WORKFLOW_STEPS = [
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CONFIG,
    label: "Config",
    items: [{ sectionId: CAMERA_SECTION_IDS.CONFIG, short: "Config" }],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAL_FILTERS,
    label: "Cal filtros",
    items: [{ sectionId: CAMERA_SECTION_IDS.CAL_FILTERS, short: "Cal · filtros" }],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAL_FOCUS,
    label: "Cal foco",
    items: [
      { sectionId: CAMERA_SECTION_IDS.CAL_FOCUS_APERTURE, short: "Cal · foco/diaf." },
    ],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAL_WHITE,
    label: "Cal blanco",
    items: [{ sectionId: CAMERA_SECTION_IDS.CAL_WHITE, short: "Cal · blanco" }],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAPTURE,
    label: "Captura",
    items: [
      { sectionId: CAMERA_SECTION_IDS.CAPTURE_SINGLE, short: "1× cubo" },
      { sectionId: CAMERA_SECTION_IDS.CAPTURE_CONTINUOUS, short: "Secuencia" },
    ],
  },
];

export const CAMERA_NAV_GROUPS = [
  {
    label: "Instrumentación",
    items: [
      { id: CAMERA_SECTION_IDS.STATUS, label: "Estado", short: "Estado" },
      { id: CAMERA_SECTION_IDS.LIVE, label: "Vista en vivo", short: "Live" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: CAMERA_SECTION_IDS.LEDS, label: "LEDs", short: "NeoPixel" },
      { id: CAMERA_SECTION_IDS.LOGS, label: "Consola", short: "Logs" },
    ],
  },
];

/** Estados globales mock para badges del header. */
export const GLOBAL_STATUS_KEYS = [
  "booting",
  "wifi",
  "server",
  "online",
  "calibrating",
  "capturing",
  "uploading",
  "error",
];

export const GLOBAL_STATUS_LABELS = {
  booting: "Booting",
  wifi: "Connecting WiFi",
  server: "Connecting Server",
  online: "Online",
  calibrating: "Calibrating",
  capturing: "Capturing",
  uploading: "Uploading",
  error: "Error",
};

/** WebSocket de vista en vivo para calibraciones (y stream de cámara en producción). */
export const CAMERA_LIVE_WS_URL = "wss://camera.multispectralcam.com";

/** Bucket Storage: una carpeta por compensador blanco (Raspberry / capturas). */
export const WHITE_COMPENSATORS_BUCKET =
  import.meta.env.VITE_SUPABASE_WHITE_BUCKET || "white_compensators";

/** Patrones LED por tipo de calibración al pulsar «Iniciar calibración». */
export const CALIBRATION_LED = {
  FILTERS: { pattern: "spinner", color: "white" },
  /** Al terminar calibración de filtros con éxito. */
  FILTERS_DONE: { pattern: "blink", color: "green" },
  FOCUS_APERTURE: { pattern: "blink", color: "white" },
  /** Al terminar calibración óptica (enfoque/diafragma) con éxito. */
  FOCUS_APERTURE_DONE: { pattern: "blink", color: "green" },
  WHITE: { pattern: "blink", color: "white" },
  WHITE_DONE: { pattern: "blink", color: "green" },
};

/** Filtros del cubo óptico (IDs alineados con el protocolo WebSocket de la cámara). */
export const WAVELENGTH_FILTERS = [
  { id: 1, nm: 450, label: "450 nm" },
  { id: 2, nm: 550, label: "550 nm" },
  { id: 3, nm: 656, label: "656 nm" },
  { id: 4, nm: 725, label: "725 nm" },
  { id: 5, nm: 850, label: "850 nm" },
];

/** Bandas del cubo blanco (725 nm oficial, no 720). */
export const WHITE_CALIBRATION_BANDS_NM = [450, 550, 656, 725, 850];
