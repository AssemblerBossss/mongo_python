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
