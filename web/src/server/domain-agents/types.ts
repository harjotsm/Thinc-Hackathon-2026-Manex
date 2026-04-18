export type DomainAgentContext = {
  incidentId: string;
  productId?: string;
  partNumber?: string;
  evidenceIds: string[];
  primaryDefectCode?: string;
  supplierName?: string;
};

export type DomainInitiative = {
  title: string;
  domain: "production" | "supplier" | "rnd";
  target_system: string;
  owner_hint: string;
  rationale: string;
  confidence: number;
  evidence: string[];
  closure_predicate: {
    type: "no_defect_code_in_window" | "manual_confirmation";
    params: Record<string, unknown>;
  };
};
