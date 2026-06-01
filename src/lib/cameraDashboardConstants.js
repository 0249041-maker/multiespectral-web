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
    label: "Configuración",
    items: [{ sectionId: CAMERA_SECTION_IDS.CONFIG, short: "Configuración" }],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAL_FILTERS,
    label: "Calibración filtros",
    items: [
      { sectionId: CAMERA_SECTION_IDS.CAL_FILTERS, short: "Calibración filtros" },
    ],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAL_FOCUS,
    label: "Calibración óptica",
    items: [
      {
        sectionId: CAMERA_SECTION_IDS.CAL_FOCUS_APERTURE,
        short: "Calibración óptica",
      },
    ],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAL_WHITE,
    label: "Calibración blancos",
    items: [
      { sectionId: CAMERA_SECTION_IDS.CAL_WHITE, short: "Calibración blancos" },
    ],
  },
  {
    id: CAMERA_WORKFLOW_STEP_IDS.CAPTURE,
    label: "Captura de cubo",
    items: [
      { sectionId: CAMERA_SECTION_IDS.CAPTURE_SINGLE, short: "Captura de cubo" },
    ],
  },
];

export const CAMERA_NAV_GROUPS = [];

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

/** Valor de `state` en mensajes hello/status cuando la cámara está en captura de cubo. */
export const CAMERA_STATE_CUBE_CAPTURE = "cube_capture_mode";

export const CAMERA_STATE_SHUTTING_DOWN = "shutting_down";

/** Estados en los que no se permite `shutdown_camera`. */
export const CAMERA_STATES_BLOCKING_SHUTDOWN = [
  "calibrating_filters",
  "switching_filter",
  "capturing_white_reference",
  "uploading_white_reference",
  "capturing_cube",
  "uploading_cube",
  CAMERA_STATE_SHUTTING_DOWN,
];

/** Estados en los que sí se puede intentar apagar (lista explícita del protocolo). */
export const CAMERA_STATES_ALLOWING_SHUTDOWN = [
  "online",
  "optical_calibration",
  "white_calibration",
  CAMERA_STATE_CUBE_CAPTURE,
];

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
