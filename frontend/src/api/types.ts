export interface CollectionInfo {
  name: string;
  count: number;
}

export interface FieldInfo {
  name: string;
  types: string[];
}

export interface DocumentsPage {
  items: Record<string, unknown>[];
  total: number;
  skip: number;
  limit: number;
}

export interface ApiError {
  detail: string;
  request_id?: string | null;
}

export interface DocumentsQueryParams {
  filter?: string;
  skip?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: number;
}

export interface DomainImportStats {
  domain: string;
  received: number;
  imported: number;
  skipped: number;
}

export interface ImportSummary {
  domains: DomainImportStats[];
  total_imported: number;
  total_skipped: number;
}

export interface ScanRecord  {
    instance: string;
    result: boolean;
    data_type: string;
    data?: Record<string, unknown>;
    error?: string | null;
};

export type ImportPayloadBody = Record<string, ScanRecord[]>;
