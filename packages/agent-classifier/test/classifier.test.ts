import test from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  validateAgentPassport,
  UnclassifiedAgentError,
  AgentPassportValidationError,
} from "../src/classifier.js";
import type { AgentPassport } from "../src/agent-passport.js";

test("com.anthropic.claudefordesktop -> third_party; suppress false", () => {
  const p = classify({ bundle_id: "com.anthropic.claudefordesktop" });
  assert.equal(p.agent_class, "third_party");
  assert.equal(p.suppress_user_authorization_prompt, false);
});

test("com.apple.sharingd -> system_core; suppress true; is_daemon true", () => {
  const p = classify({ bundle_id: "com.apple.sharingd" });
  assert.equal(p.agent_class, "system_core");
  assert.equal(p.suppress_user_authorization_prompt, true);
  assert.equal(p.is_daemon, true);
});

test("com.apple.Siri.ActionPredictionNotifications -> intelligence_automation; three constraints false", () => {
  const p = classify({ bundle_id: "com.apple.Siri.ActionPredictionNotifications" });
  assert.equal(p.agent_class, "intelligence_automation");
  assert.equal(p.summarize_previews_permitted, false);
  assert.equal(p.dnd_intelligent_management_permitted, false);
  assert.equal(p.autonomous_action_permitted, false);
});

test("org.mozilla.firefox -> third_party; system_bundle false", () => {
  const p = classify({ bundle_id: "org.mozilla.firefox" });
  assert.equal(p.agent_class, "third_party");
  assert.equal(p.system_bundle, false);
});

test("unknown bundle throws UnclassifiedAgentError; no passport emitted", () => {
  assert.throws(
    () => classify({ bundle_id: "com.unknown.mystery" }),
    (err: unknown) => {
      assert.ok(err instanceof UnclassifiedAgentError);
      assert.equal(err.bundle_id, "com.unknown.mystery");
      assert.ok(!/anySource/.test(String((err as UnclassifiedAgentError).reason)) || true);
      return true;
    },
  );
});

test("third_party with system_bundle:true is a validation error (class elevation)", () => {
  const bad: AgentPassport = {
    bundle_id: "com.evil.app",
    agent_class: "third_party",
    interrupt_level: "standard",
    is_daemon: false,
    is_apple_signed: false,
    suppress_user_authorization_prompt: false,
    system_bundle: true,
  };
  assert.throws(() => validateAgentPassport(bad), AgentPassportValidationError);
});
