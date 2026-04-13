# Enrichment Collector

This service is the first asynchronous ingress processor for SynapseIQ.

Its responsibilities are:
- receive source-native or semi-normalized records from stream or batch ingress
- validate input shape
- invoke adapter normalization and enrichment
- emit canonical envelopes downstream
- preserve provenance, confidence, and policy metadata

This service should remain thin and consume shared contract packages rather than inventing local contracts.