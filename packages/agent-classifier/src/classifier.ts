/**
 * classifier.ts (T3-3) — classify a host process into a typed AgentPassport.
 *
 * Governance rule (non-negotiable): anything unclassifiable throws
 * UnclassifiedAgentError. anySource is NOT a valid class and is never emitted.
 */

import {
  AGENT_CLASSES,
  type AgentClass,
  type AgentPassport,
  type InterruptLevel,
  type PermissionFlags,
} from "./agent-passport.js";

export type ClassificationMethod = "bundle_id_lookup" | "flag_inference" | "manual";

export interface ClassifierInput {
  bundle_id: string;
  pid?: number;
  binary_path?: string;
  flags?: Partial<PermissionFlags>;
}

export class UnclassifiedAgentError extends Error {
  readonly bundle_id: string;
  readonly attempted_classification_method: ClassificationMethod;
  readonly reason: string;
  constructor(bundle_id: string, attempted: ClassificationMethod, reason: string) {
    super(`unclassified agent ${bundle_id}: ${reason} (anySource is not a valid class)`);
    this.name = "UnclassifiedAgentError";
    this.bundle_id = bundle_id;
    this.attempted_classification_method = attempted;
    this.reason = reason;
  }
}

export class AgentPassportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentPassportValidationError";
  }
}

interface BundleEntry {
  agent_class: AgentClass;
  interrupt_level: InterruptLevel;
  flags: PermissionFlags;
  intelligence?: {
    summarize_previews_permitted: boolean;
    dnd_intelligent_management_permitted: boolean;
    autonomous_action_permitted: boolean;
  };
}

const KNOWN_BUNDLES: Record<string, BundleEntry> = {
  "com.apple.sharingd": {
    agent_class: "system_core",
    interrupt_level: "critical",
    flags: { is_daemon: true, is_apple_signed: true, suppress_user_authorization_prompt: true, system_bundle: true },
  },
  "com.apple.Siri.ActionPredictionNotifications": {
    agent_class: "intelligence_automation",
    interrupt_level: "time_sensitive",
    flags: { is_daemon: true, is_apple_signed: true, suppress_user_authorization_prompt: false, system_bundle: true },
    intelligence: {
      summarize_previews_permitted: false,
      dnd_intelligent_management_permitted: false,
      autonomous_action_permitted: false,
    },
  },
  "com.anthropic.claudefordesktop": {
    agent_class: "third_party",
    interrupt_level: "standard",
    flags: { is_daemon: false, is_apple_signed: false, suppress_user_authorization_prompt: false, system_bundle: false },
  },
  "org.mozilla.firefox": {
    agent_class: "third_party",
    interrupt_level: "standard",
    flags: { is_daemon: false, is_apple_signed: false, suppress_user_authorization_prompt: false, system_bundle: false },
  },
};

/** Throw if the passport violates a class invariant (fail closed). */
export function validateAgentPassport(passport: AgentPassport): void {
  if (!AGENT_CLASSES.includes(passport.agent_class)) {
    throw new AgentPassportValidationError(
      `agent.class: '${passport.agent_class}' is not a valid class`,
    );
  }
  if (passport.agent_class === "third_party" && passport.system_bundle) {
    throw new AgentPassportValidationError(
      "agent.class.elevation: third_party cannot claim system_core capabilities (system_bundle)",
    );
  }
  if (passport.suppress_user_authorization_prompt && !passport.is_apple_signed) {
    throw new AgentPassportValidationError(
      "agent.flags: suppress_user_authorization_prompt requires is_apple_signed",
    );
  }
  if (passport.agent_class === "intelligence_automation") {
    if (
      passport.summarize_previews_permitted === undefined ||
      passport.dnd_intelligent_management_permitted === undefined ||
      passport.autonomous_action_permitted === undefined
    ) {
      throw new AgentPassportValidationError(
        "intelligence_automation requires all three intelligence constraint fields",
      );
    }
  }
}

function buildFromEntry(bundle_id: string, entry: BundleEntry): AgentPassport {
  const base: AgentPassport = {
    bundle_id,
    agent_class: entry.agent_class,
    interrupt_level: entry.interrupt_level,
    is_daemon: entry.flags.is_daemon,
    is_apple_signed: entry.flags.is_apple_signed,
    suppress_user_authorization_prompt: entry.flags.suppress_user_authorization_prompt,
    system_bundle: entry.flags.system_bundle,
  };
  if (entry.intelligence) {
    base.summarize_previews_permitted = entry.intelligence.summarize_previews_permitted;
    base.dnd_intelligent_management_permitted = entry.intelligence.dnd_intelligent_management_permitted;
    base.autonomous_action_permitted = entry.intelligence.autonomous_action_permitted;
  }
  return base;
}

/**
 * Classify a process into a typed AgentPassport.
 * 1) known bundle_id -> assign; 2) flag inference; 3) else throw.
 */
export function classify(input: ClassifierInput): AgentPassport {
  const known = KNOWN_BUNDLES[input.bundle_id];
  if (known !== undefined) {
    const passport = buildFromEntry(input.bundle_id, known);
    validateAgentPassport(passport);
    return passport;
  }

  // Flag inference: an unsigned, non-system-bundle process is treated as third_party.
  const flags = input.flags;
  if (flags !== undefined && flags.is_apple_signed === false && flags.system_bundle !== true) {
    const passport: AgentPassport = {
      bundle_id: input.bundle_id,
      agent_class: "third_party",
      interrupt_level: "standard",
      is_daemon: flags.is_daemon ?? false,
      is_apple_signed: false,
      suppress_user_authorization_prompt: false,
      system_bundle: false,
    };
    validateAgentPassport(passport);
    return passport;
  }

  throw new UnclassifiedAgentError(
    input.bundle_id,
    flags === undefined ? "bundle_id_lookup" : "flag_inference",
    "no known-bundle match and flags insufficient to infer a class",
  );
}
