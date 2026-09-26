export interface Breach {
  standard: 'AS/NZS 3000' | 'AS/NZS 3008.1.2';
  clause: string | null;
  severity: 'high' | 'medium' | 'low';
  source: string;
  item_ref: string;
  description: string;
  /** 'rule' = deterministic check with the working shown; 'ai' = model judgement for review. */
  method: 'rule' | 'ai';
}

export interface ComplianceResult {
  breaches: Breach[];
  not_checked: string[];
}
