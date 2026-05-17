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

export const CAMERA_NAV_GROUPS = [
  {
    label: "Instrumentación",
    items: [
      { id: CAMERA_SECTION_IDS.STATUS, label: "Estado", short: "Estado" },
      { id: CAMERA_SECTION_IDS.LIVE, label: "Vista en vivo", short: "Live" },
    ],
  },
  {
    label: "Configuración",
    items: [{ id: CAMERA_SECTION_IDS.CONFIG, label: "Parámetros", short: "Config" }],
  },
  {
    label: "Calibraciones",
    items: [
      { id: CAMERA_SECTION_IDS.CAL_FILTERS, label: "Filtros", short: "Cal · filtros" },
      {
        id: CAMERA_SECTION_IDS.CAL_FOCUS_APERTURE,
        label: "Enfoque y diafragma",
        short: "Cal · foco/diaf.",
      },
      { id: CAMERA_SECTION_IDS.CAL_WHITE, label: "Blancos", short: "Cal · blanco" },
    ],
  },
  {
    label: "Captura",
    items: [
      { id: CAMERA_SECTION_IDS.CAPTURE_SINGLE, label: "Individual", short: "1× cubo" },
      {
        id: CAMERA_SECTION_IDS.CAPTURE_CONTINUOUS,
        label: "Continua",
        short: "Secuencia",
      },
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

/** Patrones LED por tipo de calibración al pulsar «Iniciar calibración». */
export const CALIBRATION_LED = {
  FILTERS: { pattern: "spinner", color: "white" },
  FOCUS_APERTURE: { pattern: "blink", color: "white" },
  WHITE: { pattern: "blink", color: "white" },
};

export const WAVELENGTH_FILTERS = [
  { nm: 450, label: "450 nm" },
  { nm: 550, label: "550 nm" },
  { nm: 650, label: "650 nm" },
  { nm: 720, label: "720 nm" },
  { nm: 850, label: "850 nm" },
];
