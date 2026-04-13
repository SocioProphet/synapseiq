# Event Schema Contracts and Vendor Integration

This document defines the **event schema contracts** and outlines the integration process for different vendors, including **ZoomInfo**, **GDELT**, and other data sources.

## Event Schema Contract

The core **event schema** is based on the **UDM (Universal Data Model)**, ensuring consistency across multiple vendors. Each event must contain the following fields:

### Required Fields:

- `event_id`: A unique identifier for the event (UUID).
- `provider`: The name of the data provider (e.g., `zoominfo`, `gdeltr`).
- `observed_at`: The timestamp when the event occurred (ISO 8601).
- `site_host`: The hostname of the website or source system.
- `page_url`: The full URL of the page associated with the event.

### Optional Fields:

- `person_name`: The name of the person involved in the event.
- `company_name`: The name of the company involved in the event.
- `match`: Information about the matched entities.

### Data Structure Example:

```json
{
  "event_id": "uuid-v7",
  "provider": "zoominfo",
  "observed_at": "2026-04-11T22:10:10.000Z",
  "site_host": "example.com",
  "page_url": "https://example.com/demo",
  "match": {
    "company_name": "Acme Corp",
    "company_domain": "acme.com"
  }
}
```

## Vendor-Specific Integrations

The framework supports the integration of multiple vendors through **adapters** that normalize and enrich the raw event data to fit the **UDM schema**.

### ZoomInfo Integration
The **ZoomInfo adapter** ingests data from the **ZoomInfo platform**, specifically **identity touch events**. The data is normalized to the **UDM schema** and enriched using the **FIBO ontology**.

- **Adapter Features**: Normalizes `company_name`, `person_name`, and `event_metadata`.
- **Enrichment**: Uses **FIBO** for financial data and **UCO** for cybersecurity data.

### GDELT Integration
The **GDELT adapter** handles global event data and ingests the data from the **GDELT Event Database**.

- **Adapter Features**: Normalizes `event_id`, `actor_name`, `location`, and other event metadata.
- **Enrichment**: Uses **FIBO** for finance-related events and **UCO** for geopolitical and security-related data.

### Custom Vendor Adapters
New vendors can be integrated by implementing their respective **vendor adapters**, ensuring that data is enriched according to the **UDM schema** and **domain ontologies**.