/**
 * @socioprophet/synapseiq-reasoning — mobility enrichment reasoning modules.
 *
 * The first module is the privacy-critical suppression engine (governs whether an observed
 * mobility signal may flow into a governed enrichment package). Additional reasoning modules
 * (trade-area, corridor-exposure, event-lift, site-fit, attribution) build on the same
 * schema + taxonomy substrate.
 */
export * from "./mobility-suppression.js";

export * from "./trade-area.js";
