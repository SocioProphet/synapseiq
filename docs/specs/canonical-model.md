# Canonical Data Model (UDM Alignment)

This document describes the **canonical data model** used in **SynapseIQ**, based on the **Universal Data Model (UDM)**. The UDM serves as the foundation for all data processing, ensuring consistency and standardization across vendor-specific data sources.

## UDM Overview
The **UDM (Universal Data Model)** provides a standardized framework for defining **core entities** and **relationships** within the SynapseIQ platform. These entities serve as the **canonical** model for all enriched event data, regardless of the vendor or data format.

### Core Entities:
- **Person**: Represents individuals involved in events.
- **Organization**: Represents organizations (companies, government bodies, etc.).
- **Event**: Represents events or activities that have occurred.

### Core Relationships:
- **isMemberOf**: Represents the relationship between a **Person** and an **Organization**.
- **participatesIn**: Represents the participation of a **Person** or **Organization** in an **Event**.
- **isRelatedTo**: Represents connections between **Events** or **Organizations**.

### UDM Alignment with Vendor Data
For each vendor, we map raw data to UDM entities and relationships. For example, in the case of **ZoomInfo** data:
- `company_name` maps to **Organization**.
- `person_name` maps to **Person**.
- `event_metadata` maps to **Event**.

This mapping ensures that all incoming data, regardless of source, conforms to the **UDM schema** and can be processed consistently.

### Data Transformation Pipeline
1. **Data Ingestion**: Data from multiple vendors (e.g., ZoomInfo, GDELT) is ingested.
2. **Normalization**: Raw data is mapped to UDM entities and relationships.
3. **Enrichment**: Data is enriched using domain-specific ontologies (e.g., **FIBO**, **UCO**, **SCO**).
4. **Storage**: Enriched data is stored in BigQuery, adhering to the UDM schema.

By aligning data with the **UDM**, we ensure that the system remains **flexible** and **scalable**, while maintaining **semantic consistency** across all data sources.