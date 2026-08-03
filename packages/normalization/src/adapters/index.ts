/**
 * Baseline adapters — map public-domain reference datasets into canonical RawMobilityRecords
 * (reference_substrate), which normalizeMobilitySignal then turns into privacy-gated MobilitySignals
 * used as denominators/baselines by the reasoning modules.
 */
export * from "./fhwa-hpms.js";
export * from "./census-lodes.js";
