/**
 * agent-passport.ts — the five-class host-agent model (mirrors the canonical
 * AgentPassport in SourceOS-Linux/sourceos-spec T0-1). Pure, dependency-free.
 */

export type AgentClass =
  | "system_core"
  | "intelligence_automation"
  | "app_helper"
  | "legacy_bridge"
  | "third_party";

export const AGENT_CLASSES: readonly AgentClass[] = [
  "system_core",
  "intelligence_automation",
  "app_helper",
  "legacy_bridge",
  "third_party",
];

export type InterruptLevel =
  | "critical"
  | "time_sensitive"
  | "high"
  | "standard"
  | "passive";

export interface PermissionFlags {
  is_daemon: boolean;
  is_apple_signed: boolean;
  suppress_user_authorization_prompt: boolean;
  system_bundle: boolean;
}

export interface AgentPassport extends PermissionFlags {
  bundle_id: string;
  agent_class: AgentClass;
  interrupt_level: InterruptLevel;
  summarize_previews_permitted?: boolean;
  dnd_intelligent_management_permitted?: boolean;
  autonomous_action_permitted?: boolean;
}
