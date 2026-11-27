// Allowed values. They MUST match the check constraints in supabase/migrations.

export const CATEGORIES = [
  "Surgery",
  "PDPH",
  "Rib fracture",
  "Difficult airway",
  "Anaphylaxis",
  "Medical issue",
  "Other",
] as const;
/** Categories that get a free-text "Details" box. */
export const NOTE_CATEGORIES = [
  "Difficult airway",
  "Anaphylaxis",
  "Medical issue",
  "Other",
] as const;
export const PDPH_TECHNIQUES = ["Spinal", "CSE"] as const;
export const SPINAL_LEVELS = ["L1-L2", "L2-L3", "L3-L4", "L4-L5", "L5-S1"];
export const NEEDLE_SUGGESTIONS = [
  "22G Quincke",
  "25G Quincke",
  "26G Quincke",
  "27G Quincke",
  "25G Whitacre",
  "27G Whitacre",
  "25G Sprotte",
];
export const WARDS_DEFAULT = [
  "7A",
  "23B",
  "39",
  "OT Complex",
  "ICU",
  "Other",
] as const;
export const SEXES = ["M", "F"] as const;
export const ANAESTHESIA_MODES = ["GA", "Spinal", "CSE", "Regional"] as const;
export const NERVE_TYPES = [
  "Supraclavicular",
  "Rectus sheath",
  "Femoral",
  "Other",
] as const;
export const MED_DRUGS = [
  "Paracetamol",
  "Tramadol",
  "Morphine",
  "Pregabalin",
  "Gabapentin",
  "Celecoxib (Cox-2)",
  "Diclofenac (NSAID)",
  "Other",
] as const;
export const MED_ROUTES = [
  "Oral",
  "IV",
  "IM",
  "SC",
  "PR",
  "IT",
  "Epidural",
] as const;
export const MED_FREQS = [
  "Every 4h",
  "Every 6h",
  "Every 8h",
  "Every 12h",
  "Daily",
  "Other",
] as const;
export const MED_DOSINGS = ["single", "loading"] as const;
export const SESSIONS = ["Morning", "Evening"] as const;
export const MOBILIZATION = ["Mobilized", "Not mobilized"] as const;
export const ROUND_TAGS = [
  "Top-up given",
  "Line removed",
  "Dose changed",
  "Catheter concern",
  "Discharge planned",
  "Urgent review",
] as const;

export const ROLES = ["nurse", "resident", "consultant", "admin"] as const;

/** Epidural level suggestions for the type-ahead list (free text is also allowed). */
export const EPIDURAL_LEVELS: string[] = (() => {
  // T1–T3 are not used for epidural insertion, so the list starts at T4.
  const single = [
    ...Array.from({ length: 9 }, (_, i) => `T${i + 4}`), // T4 … T12
    ...Array.from({ length: 5 }, (_, i) => `L${i + 1}`), // L1 … L5
  ];
  const pairs = single.slice(0, -1).map((l, i) => `${l}-${single[i + 1]}`);
  return [...pairs, ...single];
})();

/** Sign out after this long without touching the app (also counts time spent in the background). */
export const IDLE_LOGOUT_MS = 5 * 60 * 1000;
export const APP_VERSION = "1.0.0";
export const MIN_PASSWORD_LENGTH = 12;
