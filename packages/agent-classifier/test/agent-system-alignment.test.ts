import test from "node:test";
import assert from "node:assert/strict";
import {
  agentClassToUdm,
  permissionFlagsToUdmAttributes,
  agentPassportToUdmRecord,
} from "../src/agent-system-alignment.js";
import type { AgentPassport } from "../src/agent-passport.js";

test("agentClassToUdm maps each class to its UDM entity type", () => {
  assert.equal(agentClassToUdm("system_core"), "system_daemon");
  assert.equal(agentClassToUdm("intelligence_automation"), "intelligence_agent");
  assert.equal(agentClassToUdm("app_helper"), "app_helper");
  assert.equal(agentClassToUdm("legacy_bridge"), "legacy_bridge");
  assert.equal(agentClassToUdm("third_party"), "external_app");
});

test("permissionFlagsToUdmAttributes emits the four flag attributes", () => {
  const attrs = permissionFlagsToUdmAttributes({
    is_daemon: true,
    is_apple_signed: true,
    suppress_user_authorization_prompt: false,
    system_bundle: true,
  });
  assert.equal(attrs.length, 4);
  const byName = new Map(attrs.map((a) => [a.name, a.value]));
  assert.equal(byName.get("is_daemon"), true);
  assert.equal(byName.get("system_bundle"), true);
});

test("agentPassportToUdmRecord builds a typed record", () => {
  const passport: AgentPassport = {
    bundle_id: "com.anthropic.claudefordesktop",
    agent_class: "third_party",
    interrupt_level: "standard",
    is_daemon: false,
    is_apple_signed: false,
    suppress_user_authorization_prompt: false,
    system_bundle: false,
  };
  const rec = agentPassportToUdmRecord(passport);
  assert.equal(rec.entityType, "external_app");
  assert.equal(rec.sourceBundleId, "com.anthropic.claudefordesktop");
  assert.ok(rec.attributes.some((a) => a.name === "agent_class" && a.value === "third_party"));
});
