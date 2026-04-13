export interface EventPayload {
  event_type: string;
  subject_entity_id?: string | null;
  object_entity_id?: string | null;
  location_entity_id?: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface EntityPayload {
  entity_type: string;
  display_name?: string | null;
  normalized_name?: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface LinkPayload {
  link_type: string;
  from_entity_id: string;
  to_entity_id: string;
  attributes?: Record<string, unknown> | null;
}

export interface MappingPayload {
  mapping_type: string;
  target: string;
  source_fields?: string[];
  attributes?: Record<string, unknown> | null;
}

export interface FindingPayload {
  finding_type: string;
  decision: string;
  severity?: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface ActivationPayload {
  destination_type: string;
  destination_id?: string | null;
  action?: string | null;
  attributes?: Record<string, unknown> | null;
}
