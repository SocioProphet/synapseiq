# Enrichment API

This service is the synchronous ingress surface for SynapseIQ.

Typical responsibilities:
- receive webhook and API submissions
- validate request shape
- apply policy gates where needed
- route accepted inputs into the collector / stream path
- return deterministic request-level acknowledgements

This service should remain thin and should rely on shared contracts and normalization logic.
