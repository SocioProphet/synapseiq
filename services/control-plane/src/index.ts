export interface AdapterRegistration {
  adapter_id: string;
  version: string;
  capabilities: string[];
}

export interface SourceRegistration {
  source_id: string;
  source_type: string;
  adapter_id: string;
}

export class ControlPlane {
  private readonly adapters = new Map<string, AdapterRegistration>();
  private readonly sources = new Map<string, SourceRegistration>();

  registerAdapter(registration: AdapterRegistration): void {
    this.adapters.set(registration.adapter_id, registration);
  }

  registerSource(registration: SourceRegistration): void {
    this.sources.set(registration.source_id, registration);
  }

  getAdapter(adapterId: string): AdapterRegistration | undefined {
    return this.adapters.get(adapterId);
  }

  getSource(sourceId: string): SourceRegistration | undefined {
    return this.sources.get(sourceId);
  }
}
