/**
 * agent-system-alignment.ts (T3-2) — align the agent-system model onto the UDM.
 */

import type { AgentClass, AgentPassport, PermissionFlags } from "./agent-passport.js";
import type { UdmAttribute, UdmEntityType, UdmRecord } from "./udm.js";

const CLASS_TO_ENTITY: Record<AgentClass, UdmEntityType> = {
  system_core: "system_daemon",
  intelligence_automation: "intelligence_agent",
  app_helper: "app_helper",
  legacy_bridge: "legacy_bridge",
  third_party: "external_app",
};

export function agentClassToUdm(agentClass: AgentClass): UdmEntityType {
  return CLASS_TO_ENTITY[agentClass];
}

export function permissionFlagsToUdmAttributes(flags: PermissionFlags): UdmAttribute[] {
  return [
    { name: "is_daemon", value: flags.is_daemon },
    { name: "is_apple_signed", value: flags.is_apple_signed },
    { name: "suppress_user_authorization_prompt", value: flags.suppress_user_authorization_prompt },
    { name: "system_bundle", value: flags.system_bundle },
  ];
}

export function agentPassportToUdmRecord(passport: AgentPassport): UdmRecord {
  const attributes: UdmAttribute[] = [
    { name: "agent_class", value: passport.agent_class },
    { name: "interrupt_level", value: passport.interrupt_level },
    ...permissionFlagsToUdmAttributes(passport),
  ];
  return {
    entityType: agentClassToUdm(passport.agent_class),
    sourceBundleId: passport.bundle_id,
    attributes,
  };
}
