# Rollback Notes

## Scope

This rollback note applies to the narrow internal alpha deployment of the Tabular Alpha API.

## Rollback triggers

Rollback if any of the following occur:
- health endpoint fails after deploy
- repeated 5xx responses on valid requests
- crash loops or process instability
- unacceptable latency for intended internal testing
- unexpected exposure beyond intended internal audience

## Rollback actions

1. Stop routing traffic to the new revision or service.
2. Revert to the previous known-good revision if one exists.
3. If no previous revision exists, disable the service and return to local/test mode.
4. Preserve logs and request samples for postmortem.

## Post-rollback

- record the trigger condition
- record the failed version identifier
- record immediate mitigation taken
- create a short follow-up issue before retrying deploy
