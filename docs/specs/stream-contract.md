# Stream Contract

This document defines the stream contract for **SynapseIQ**, including the semantics and structure of event data in transit.

## Purpose

The stream contract is the interface between SynapseIQ and streaming platforms such as **Kafka**, **Pub/Sub**, or similar message bus systems. It ensures that:
- events are delivered consistently and reliably
- records can be traced, replayed, and deduplicated
- events comply with **canonical UDM** schemas

## Stream Contract Goals
- Define clear message formats for each event type
- Guarantee **ordering**, **replayability**, and **deduplication**
- Provide **traceability** for all events
- Ensure **privacy** and **consent** are honored in event delivery

## Stream Event Structure
Each stream event must contain the following attributes:

### Required Fields:
- `event_id`: A globally unique identifier for the event (UUID).
- `record_kind`: Type of record, valid values include:
    - `event`
    - `entity`
    - `link`
    - `mapping`
    - `finding`
    - `activation`
- `record_ts`: Timestamp of when the event was generated.
- `record_stage`: Stage of the record, valid values include:
    - `raw`
    - `normalized`
    - `enriched`
    - `validated`
    - `inferred`
    - `activated`
- `source_id`: Identifier of the system producing the event (vendor or internal service).
- `transport_metadata`: Metadata for the transport layer (e.g., `trace_id`, `correlation_id`, `partition`, `topic`).

### Optional Fields:
- `redactions_applied`: Array of redacted fields for compliance.
- `policy`: Policy metadata (e.g., `consent_mode`, `classification`, `redactions_applied`).

## Stream Event Semantics

- **Ordering Guarantees**: Events must arrive in order of generation, with strict ordering preserved for events within the same partition.
- **Replay Model**: Events must be **replayable** within the same retention window.
- **Idempotency**: Events emitted must be idempotent, meaning reprocessing the same event multiple times should yield the same outcome.
- **Backpressure Handling**: The system must handle backpressure gracefully, ensuring that events are not lost under heavy load.

## Topic Structure
Each Kafka topic should be named according to the **event type** and **domain** to ensure that consumers can filter messages efficiently. For example:
- `zoominfo-events` for ZoomInfo data
- `gdeltr-events` for GDELT data

## Partitioning and Offset
- **Partitioning**: Each event must be assigned to a partition based on its **record kind** or **domain**.
- **Offset**: The system must track offsets per consumer group to ensure **exactly-once delivery**.

## Non-negotiable Requirements
1. Every event must have a `record_id`.
2. Events must contain metadata necessary for **traceability** (e.g., `trace_id`, `correlation_id`).
3. Events must be **idempotent**.
4. **Privacy**: Redactions must be applied as defined in the consent policy.

## Rationale

This stream contract ensures the system can process high-throughput, real-time event data across multiple vendors and domains, while ensuring that events are traceable, consistent, and enriched according to the **canonical UDM model**.