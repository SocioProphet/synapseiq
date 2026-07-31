/**
 * udm.ts — minimal Unified Data Model types the agent-system alignment targets.
 */

export type UdmEntityType =
  | "system_daemon"
  | "intelligence_agent"
  | "app_helper"
  | "legacy_bridge"
  | "external_app";

export interface UdmAttribute {
  name: string;
  value: string | number | boolean;
}

export interface UdmRecord {
  entityType: UdmEntityType;
  sourceBundleId: string;
  attributes: UdmAttribute[];
}
