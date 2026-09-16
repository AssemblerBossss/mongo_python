"use client";

import Sidebar from "@/src/components/custom/Sidebar.tsx";
import Editor from "@/src/components/custom/MonacoEditorLazy.tsx";
import { Button } from "@/src/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu.tsx";
import { Input } from "@/src/components/ui/input.tsx";
import { useToast } from "@/src/components/ui/toast.tsx";
import { cn } from "@/src/lib/utils.ts";
import { convertToCSV } from "@/src/lib/data-utils.ts";
import { parseQueryArray, parseQueryObject } from "@/src/lib/query-parser.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  DatabaseZap,
  Download,
  Edit3,
  FileJson,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Table2,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

type JsonObject = Record<string, unknown>;
type TabKey = "documents" | "aggregations" | "schema" | "indexes" | "explain" | "validation" | "stats";
type ViewMode = "tree" | "json" | "table";
type BulkMode = "update" | "delete" | null;

const tabs: { key: TabKey; label: string; icon: typeof FileJson }[] = [
  { key: "documents", label: "Documents", icon: FileJson },
  { key: "aggregations", label: "Aggregations", icon: GitBranch },
  { key: "schema", label: "Schema", icon: DatabaseZap },
  { key: "indexes", label: "Indexes", icon: Layers },
  { key: "explain", label: "Explain Plan", icon: BarChart3 },
  { key: "validation", label: "Validation", icon: ShieldCheck },
  { key: "stats", label: "Stats", icon: Table2 },
];
const tabKeys = new Set<TabKey>(tabs.map(({ key }) => key));

function boundedClientInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value: string, label: string) {
  return parseQueryObject(value, label);
}

function parseJsonArray(value: string, label: string) {
  return parseQueryArray(value, label);
}

function Value({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-400">null</span>;
  if (typeof value === "boolean") return <span className="text-purple-600 dark:text-purple-400">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  if (typeof value === "string") return <span className="text-cyan-700 dark:text-cyan-300">&quot;{value}&quot;</span>;
  if (Array.isArray(value)) return <span className="text-gray-400">Array({value.length})</span>;
  if (typeof value === "object") return <span className="text-gray-400">Object</span>;
  return <span>{String(value)}</span>;
}

function TreeNode({ label, value }: { label: string; value: unknown }) {
  const expandable = value !== null && typeof value === "object";
  const [open, setOpen] = useState(false);
  const keys = expandable ? Object.keys(value as JsonObject) : [];
  return (
    <div className="py-0.5">
      <div className="flex items-start gap-1">
        {expandable ? (
          <button onClick={() => setOpen((v) => !v)} className="w-4 text-gray-400 hover:text-blue-500">
            <span className={cn("inline-block transition-transform", open && "rotate-90")}>›</span>
          </button>
        ) : <span className="w-4" />}
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}:</span>
        {expandable ? <span className="text-xs italic text-gray-400">{Array.isArray(value) ? `Array(${keys.length})` : `{${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ", …" : ""}}`}</span> : <Value value={value} />}
      </div>
      {expandable && open && (
        <div className="ml-5 border-l border-gray-200 dark:border-compass-border/50 pl-2">
          {keys.map((key) => <TreeNode key={key} label={key} value={(value as JsonObject)[key]} />)}
        </div>
      )}
    </div>
  );
}

function DocumentTree({ doc }: { doc: unknown }) {
  if (!doc || typeof doc !== "object") return <Value value={doc} />;
  return <div className="font-mono text-sm">{Object.keys(doc as JsonObject).map((key) => <TreeNode key={key} label={key} value={(doc as JsonObject)[key]} />)}</div>;
}


function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-400">null</span>;
  if (typeof value === "boolean") return <span className="text-purple-600 dark:text-purple-400">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  if (typeof value === "string") return <span className="text-emerald-700 dark:text-emerald-300">{JSON.stringify(value)}</span>;
  return <span className="text-gray-700 dark:text-gray-300">{JSON.stringify(value)}</span>;
}

function CollapsibleJsonNode({
  name,
  value,
  depth = 0,
  isLast = true,
  defaultOpen = false,
}: {
  name?: string;
  value: unknown;
  depth?: number;
  isLast?: boolean;
  defaultOpen?: boolean;
}) {
  const expandable = value !== null && typeof value === "object";
  const [open, setOpen] = useState(defaultOpen || depth === 0);
  const isArray = Array.isArray(value);
  const entries = expandable ? Object.entries(value as JsonObject) : [];
  const opener = isArray ? "[" : "{";
  const closer = isArray ? "]" : "}";
  const prefix = name !== undefined ? <><span className="text-sky-700 dark:text-sky-300">{JSON.stringify(name)}</span><span className="text-gray-500 dark:text-gray-400">: </span></> : null;
  const comma = isLast ? null : <span className="text-gray-500 dark:text-gray-400">,</span>;

  if (!expandable) {
    return (
      <div className="leading-6" style={{ paddingLeft: depth * 18 }}>
        <span className="inline-block w-4" />{prefix}<JsonPrimitive value={value} />{comma}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="leading-6" style={{ paddingLeft: depth * 18 }}>
        <span className="inline-block w-4" />{prefix}<span className="text-gray-600 dark:text-gray-300">{opener}{closer}</span>{comma}
      </div>
    );
  }

  return (
    <div className="leading-6">
      <div style={{ paddingLeft: depth * 18 }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex w-4 items-center justify-center text-gray-400 hover:text-emerald-500"
          aria-label={open ? "Collapse JSON node" : "Expand JSON node"}
        >
          <span className={cn("inline-block transition-transform", open && "rotate-90")}>›</span>
        </button>
        {prefix}<span className="text-gray-600 dark:text-gray-300">{opener}</span>
        {!open && <span className="text-gray-400">… {isArray ? `${entries.length} items` : `${entries.length} fields`} …</span>}
        {!open && <span className="text-gray-600 dark:text-gray-300">{closer}</span>}
        {!open && comma}
      </div>
      {open && (
        <>
          {entries.map(([key, child], index) => (
            <CollapsibleJsonNode
              key={`${depth}-${key}-${index}`}
              name={isArray ? undefined : key}
              value={child}
              depth={depth + 1}
              isLast={index === entries.length - 1}
            />
          ))}
          <div style={{ paddingLeft: depth * 18 }}><span className="inline-block w-4" /><span className="text-gray-600 dark:text-gray-300">{closer}</span>{comma}</div>
        </>
      )}
    </div>
  );
}

function CollapsibleJsonView({ value, dark = false }: { value: unknown; dark?: boolean }) {
  return (
    <div className={cn("font-mono text-xs", dark ? "text-gray-100" : "text-gray-800 dark:text-gray-100")}>
      <CollapsibleJsonNode value={value} />
    </div>
  );
}

function TableView({ documents }: { documents: JsonObject[] }) {
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents.slice(0, 25)) Object.keys(doc).slice(0, 20).forEach((key) => set.add(key));
    return [...set];
  }, [documents]);

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-bg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 dark:bg-compass-border/30 text-left">
          <tr>{columns.map((column) => <th key={column} className="p-3 font-semibold text-gray-700 dark:text-compass-text whitespace-nowrap">{column}</th>)}</tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={String(doc._id)} className="border-t border-gray-100 dark:border-compass-border/50">
              {columns.map((column) => <td key={column} className="p-3 align-top font-mono text-xs max-w-[260px] truncate"><Value value={doc[column]} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollectionPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const collectionName = params.collectionName as string;
  const apiCollectionPath = `/api/collections/${encodeURIComponent(collectionName)}`;
  const requestedTab = searchParams.get("tab") as TabKey | null;
  const tab = requestedTab && tabKeys.has(requestedTab) ? requestedTab : "documents";
  const page = boundedClientInteger(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = boundedClientInteger(searchParams.get("limit"), 20, 1, 200);
  const filter = searchParams.get("filter") ?? "{}";
  const project = searchParams.get("project") ?? "{}";
  const sort = searchParams.get("sort") ?? "{}";

  const [filterInput, setFilterInput] = useState(filter);
  const [projectInput, setProjectInput] = useState(project);
  const [sortInput, setSortInput] = useState(sort);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [editingDoc, setEditingDoc] = useState<JsonObject | null>(null);
  const [editorValue, setEditorValue] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [dropIndexName, setDropIndexName] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState<BulkMode>(null);
  const [bulkUpdateInput, setBulkUpdateInput] = useState('{\n  "$set": {\n    \n  }\n}');
  const [bulkConfirmInput, setBulkConfirmInput] = useState("");
  const [bulkConfirmStep, setBulkConfirmStep] = useState(false);

  const [pipelineInput, setPipelineInput] = useState('[\n  { "$match": {} }\n]');
  const [aggregationResult, setAggregationResult] = useState<unknown>(null);
  const [indexKeys, setIndexKeys] = useState('{\n  "fieldName": 1\n}');
  const [indexOptions, setIndexOptions] = useState('{\n  "name": "fieldName_1"\n}');
  const [schemaResult, setSchemaResult] = useState<unknown>(null);
  const [explainResult, setExplainResult] = useState<unknown>(null);
  const [validationInput, setValidationInput] = useState("{}");

  useEffect(() => { setFilterInput(filter); setProjectInput(project); setSortInput(sort); }, [filter, project, sort]);
  useEffect(() => {
    if (!editingDoc) return;
    const { _id, ...rest } = editingDoc;
    void _id;
    setEditorValue(pretty(rest));
    setJsonError(null);
  }, [editingDoc]);

  const documentsQuery = useQuery({
    queryKey: ["documents", collectionName, page, limit, filter, project, sort],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(limit), filter, project, sort });
      const res = await fetch(`${apiCollectionPath}/documents?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch documents");
      return json;
    },
  });

  const indexesQuery = useQuery({
    queryKey: ["indexes", collectionName],
    enabled: tab === "indexes",
    queryFn: async () => {
      const res = await fetch(`${apiCollectionPath}/indexes`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch indexes");
      return json;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["collection-stats", collectionName],
    enabled: tab === "stats",
    queryFn: async () => {
      const res = await fetch(`${apiCollectionPath}/stats`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch stats");
      return json;
    },
  });

  const validationQuery = useQuery({
    queryKey: ["validation", collectionName],
    enabled: tab === "validation",
    queryFn: async () => {
      const res = await fetch(`${apiCollectionPath}/validation`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch validation");
      setValidationInput(pretty(json.validator ?? {}));
      return json;
    },
  });

  const documents: JsonObject[] = documentsQuery.data?.documents ?? [];
  const pagination = documentsQuery.data?.pagination ?? { total: 0, pages: 1, page, limit };

  function updateUrl(next: Record<string, string | number>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) p.set(key, String(value));
    router.push(`?${p.toString()}`);
  }

  function switchTab(nextTab: TabKey) {
    updateUrl({ tab: nextTab });
  }

  function runFind() {
    try {
      parseJsonObject(filterInput, "Filter");
      parseJsonObject(projectInput, "Project");
      parseJsonObject(sortInput, "Sort");
      updateUrl({ tab: "documents", page: 1, filter: filterInput, project: projectInput, sort: sortInput });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function resetQuery() {
    setFilterInput("{}");
    setProjectInput("{}");
    setSortInput("{}");
    updateUrl({ tab: "documents", page: 1, limit: 20, filter: "{}", project: "{}", sort: "{}" });
  }

  const importMutation = useMutation({
    mutationFn: async (docs: unknown[]) => {
      const res = await fetch(`${apiCollectionPath}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docs),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.message || "Import completed");
      queryClient.invalidateQueries({ queryKey: ["documents", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: unknown }) => {
      const res = await fetch(`${apiCollectionPath}/documents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Document updated successfully.");
      setEditingDoc(null);
      queryClient.invalidateQueries({ queryKey: ["documents", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiCollectionPath}/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Document deleted successfully.");
      setDeleteDocId(null);
      setEditingDoc(null);
      queryClient.invalidateQueries({ queryKey: ["documents", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const update = parseJsonObject(bulkUpdateInput, "Bulk update");
      const res = await fetch(`${apiCollectionPath}/documents/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, update }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bulk update failed");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.message || "Bulk update completed");
      setBulkMode(null);
      queryClient.invalidateQueries({ queryKey: ["documents", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiCollectionPath}/documents/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, confirm: bulkConfirmInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bulk delete failed");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.message || "Bulk delete completed");
      setBulkMode(null);
      setBulkConfirmStep(false);
      setBulkConfirmInput("");
      queryClient.invalidateQueries({ queryKey: ["documents", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const aggregateMutation = useMutation({
    mutationFn: async () => {
      const pipeline = parseJsonArray(pipelineInput, "Pipeline");
      const res = await fetch(`${apiCollectionPath}/aggregate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline, limit: 100 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Aggregation failed");
      return json;
    },
    onSuccess: (result) => {
      toast.success("Aggregation completed.");
      setAggregationResult(result);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const createIndexMutation = useMutation({
    mutationFn: async () => {
      const keys = parseJsonObject(indexKeys, "Index keys");
      const options = parseJsonObject(indexOptions, "Index options");
      const res = await fetch(`${apiCollectionPath}/indexes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys, options }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Index creation failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Index created successfully.");
      queryClient.invalidateQueries({ queryKey: ["indexes", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const dropIndexMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${apiCollectionPath}/indexes/${encodeURIComponent(name)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Drop index failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Index dropped successfully.");
      setDropIndexName(null);
      queryClient.invalidateQueries({ queryKey: ["indexes", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const schemaMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiCollectionPath}/schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleSize: 500 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Schema analysis failed");
      return json;
    },
    onSuccess: (result) => {
      toast.success("Schema analysis completed.");
      setSchemaResult(result);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const explainMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiCollectionPath}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: filterInput, projection: projectInput, sort: sortInput, limit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Explain failed");
      return json;
    },
    onSuccess: (result) => {
      toast.success("Explain plan completed.");
      setExplainResult(result);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const validationMutation = useMutation({
    mutationFn: async () => {
      const validator = parseJsonObject(validationInput, "Validator");
      const res = await fetch(`${apiCollectionPath}/validation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validator, validationLevel: "strict", validationAction: "error" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Validation update failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Validation updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["validation", collectionName] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? ""));
        importMutation.mutate(Array.isArray(parsed) ? parsed : [parsed]);
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function exportCurrent(format: "json" | "csv") {
    const content = format === "json" ? pretty(documents) : convertToCSV(documents);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${collectionName}-page-${page}.${format}` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${format.toUpperCase()} export started.`);
  }

  function openBulk(mode: Exclude<BulkMode, null>) {
    setBulkMode(mode);
    setBulkConfirmStep(false);
    setBulkConfirmInput("");
    setJsonError(null);
  }

  function closeBulk() {
    setBulkMode(null);
    setBulkConfirmStep(false);
    setBulkConfirmInput("");
  }

  function exportBulkCode(mode: "update" | "delete") {
    const command = mode === "update"
      ? `db.${collectionName}.updateMany(${filter}, ${bulkUpdateInput})`
      : `db.${collectionName}.deleteMany(${filter})`;
    const blob = new Blob([command], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${collectionName}-bulk-${mode}.js` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${mode === "update" ? "Bulk update" : "Bulk delete"} command exported.`);
  }

  function saveEditor() {
    try {
      setJsonError(null);
      const parsed = parseJsonObject(editorValue, "Document");
      updateMutation.mutate({ id: String(editingDoc?._id), body: parsed });
    } catch (error) {
      setJsonError((error as Error).message);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-compass-green hover:underline">
              <ArrowLeft size={14} /> Back to Collections
            </Link>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-compass-green rounded-lg"><Layers size={24} /></div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-compass-text truncate">{collectionName}</h1>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => documentsQuery.refetch()} disabled={documentsQuery.isFetching} className="dark:border-compass-border dark:hover:bg-compass-border/30">
                  <RefreshCw size={16} className={cn(documentsQuery.isFetching && "animate-spin")} /> Reload
                </Button>
                <Button variant="outline" onClick={() => exportCurrent("json")} className="dark:border-compass-border dark:hover:bg-compass-border/30"><Download size={16} /> JSON</Button>
                <Button variant="outline" onClick={() => exportCurrent("csv")} className="dark:border-compass-border dark:hover:bg-compass-border/30"><Download size={16} /> CSV</Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} className="dark:border-compass-border dark:hover:bg-compass-border/30"><Upload size={16} /> Import</Button>
                <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
          </header>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar p-1 flex gap-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return <button key={item.key} onClick={() => switchTab(item.key)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors", active ? "bg-blue-600 text-white dark:bg-compass-green dark:text-compass-bg" : "text-gray-600 dark:text-compass-muted hover:bg-gray-100 dark:hover:bg-compass-border/30")}><Icon size={16} />{item.label}</button>;
            })}
          </div>

          <section className="rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar p-4 space-y-3 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <LabeledEditor label="Filter" value={filterInput} onChange={setFilterInput} />
              <LabeledEditor label="Project" value={projectInput} onChange={setProjectInput} />
              <LabeledEditor label="Sort" value={sortInput} onChange={setSortInput} />
            </div>
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                <Button onClick={runFind} className="dark:bg-compass-green dark:text-compass-bg"><Search size={16} /> Find</Button>
                <Button variant="outline" onClick={resetQuery} className="dark:border-compass-border dark:hover:bg-compass-border/30">Reset</Button>
              </div>
              <div className="flex gap-2">
                {(["tree", "json", "table"] as ViewMode[]).map((mode) => <Button key={mode} variant={viewMode === mode ? "default" : "outline"} onClick={() => setViewMode(mode)} className="capitalize dark:border-compass-border">{mode}</Button>)}
              </div>
            </div>
          </section>

          {tab === "documents" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 text-sm text-gray-500 dark:text-compass-muted">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>Showing <b className="text-gray-900 dark:text-compass-text">{documents.length}</b> of <b className="text-gray-900 dark:text-compass-text">{pagination.total}</b> documents</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => updateUrl({ page: page - 1 })}><ChevronLeft size={16} /></Button>
                    <span className="px-3 py-2 rounded-lg border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar">Page {page} / {pagination.pages}</span>
                    <Button variant="outline" size="icon" disabled={page >= pagination.pages} onClick={() => updateUrl({ page: page + 1 })}><ChevronRight size={16} /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar p-2">
                  <Button size="sm" className="dark:bg-compass-green dark:text-compass-bg" onClick={() => fileInputRef.current?.click()}><Plus size={14} /> Add Data</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="dark:border-compass-border dark:bg-compass-bg dark:text-compass-text"><Layers size={14} /> Bulk <ChevronDown size={14} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="dark:border-compass-border dark:bg-compass-sidebar dark:text-compass-text">
                      <DropdownMenuItem onClick={() => openBulk("update")}>Bulk update documents</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openBulk("delete")} className="text-red-600 dark:text-red-300">Bulk delete documents</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="outline" onClick={() => exportCurrent("json")} className="dark:border-compass-border dark:bg-compass-bg dark:text-compass-text"><Download size={14} /> Export Data</Button>
                  <Button size="sm" variant="outline" onClick={() => exportBulkCode("delete")} className="dark:border-compass-border dark:bg-compass-bg dark:text-compass-text"><FileJson size={14} /> Export Code</Button>
                </div>
              </div>

              {documentsQuery.isLoading ? <LoaderBlock text="Loading documents…" /> : documentsQuery.error ? <ErrorBox message={(documentsQuery.error as Error).message} /> : viewMode === "table" ? <TableView documents={documents} /> : (
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={String(doc._id)} className="rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar shadow-sm overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-gray-100 dark:bg-compass-border/20 border-b border-gray-200 dark:border-compass-border">
                        <code className="text-xs truncate text-gray-600 dark:text-compass-muted">_id: {String(doc._id)}</code>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => { const { _id, ...clone } = doc; void _id; navigator.clipboard?.writeText(pretty(clone)); toast.success("Document JSON copied."); }}><Copy size={14} /> Clone JSON</Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingDoc(doc)}><Edit3 size={14} /> Edit</Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteDocId(String(doc._id))} className="text-red-600"><Trash2 size={14} /> Delete</Button>
                        </div>
                      </div>
                      <div className="p-4 overflow-x-auto bg-white dark:bg-compass-bg/30">{viewMode === "json" ? <CollapsibleJsonView value={doc} /> : <DocumentTree doc={doc} />}</div>
                    </div>
                  ))}
                  {documents.length === 0 && <EmptyBox text="No documents found." />}
                </div>
              )}
            </section>
          )}

          {tab === "aggregations" && <ToolPanel title="Aggregation Pipeline Builder" action={<Button onClick={() => aggregateMutation.mutate()} disabled={aggregateMutation.isPending}><GitBranch size={16} /> Run Pipeline</Button>}>
            <EditorBox value={pipelineInput} onChange={setPipelineInput} height="260px" />
            <ResultBlock value={aggregationResult} loading={aggregateMutation.isPending} />
          </ToolPanel>}

          {tab === "schema" && <ToolPanel title="Schema Analyzer" action={<Button onClick={() => schemaMutation.mutate()} disabled={schemaMutation.isPending}><DatabaseZap size={16} /> Analyze Sample</Button>}>
            <p className="text-sm text-gray-500 dark:text-compass-muted">Analyze a random sample of documents and show detected fields, types, presence, and examples.</p>
            <ResultBlock value={schemaResult} loading={schemaMutation.isPending} />
          </ToolPanel>}

          {tab === "indexes" && <ToolPanel title="Indexes" action={<Button onClick={() => createIndexMutation.mutate()} disabled={createIndexMutation.isPending}><Plus size={16} /> Create Index</Button>}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div><h3 className="font-semibold mb-2">Keys</h3><EditorBox value={indexKeys} onChange={setIndexKeys} height="160px" /></div>
              <div><h3 className="font-semibold mb-2">Options</h3><EditorBox value={indexOptions} onChange={setIndexOptions} height="160px" /></div>
            </div>
            {indexesQuery.isLoading ? <LoaderBlock text="Loading indexes…" /> : indexesQuery.error ? <ErrorBox message={(indexesQuery.error as Error).message} /> : (
              <div className="space-y-2">
                {(indexesQuery.data?.indexes ?? []).map((index: JsonObject) => <div key={String(index.name)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-compass-border p-3">
                  <div><b>{String(index.name)}</b><pre className="text-xs text-gray-500 dark:text-compass-muted mt-1 overflow-x-auto">{pretty(index.key)}</pre></div>
                  <Button variant="outline" size="sm" disabled={index.name === "_id_" || dropIndexMutation.isPending} onClick={() => setDropIndexName(String(index.name))} className="text-red-600"><Trash2 size={14} /> Drop</Button>
                </div>)}
              </div>
            )}
          </ToolPanel>}

          {tab === "explain" && <ToolPanel title="Explain Plan" action={<Button onClick={() => explainMutation.mutate()} disabled={explainMutation.isPending}><BarChart3 size={16} /> Run Explain</Button>}>
            <p className="text-sm text-gray-500 dark:text-compass-muted">Uses the Filter / Project / Sort bar above and returns execution stats.</p>
            <ResultBlock value={explainResult} loading={explainMutation.isPending} />
          </ToolPanel>}

          {tab === "validation" && <ToolPanel title="JSON Schema Validation" action={<Button onClick={() => validationMutation.mutate()} disabled={validationMutation.isPending}><ShieldCheck size={16} /> Apply Validator</Button>}>
            {validationQuery.isLoading ? <LoaderBlock text="Loading validator…" /> : validationQuery.error ? <ErrorBox message={(validationQuery.error as Error).message} /> : <EditorBox value={validationInput} onChange={setValidationInput} height="320px" />}
          </ToolPanel>}

          {tab === "stats" && <ToolPanel title="Collection Stats">
            {statsQuery.isLoading ? <LoaderBlock text="Loading stats…" /> : statsQuery.error ? <ErrorBox message={(statsQuery.error as Error).message} /> : <ResultBlock value={statsQuery.data?.stats} />}
          </ToolPanel>}
        </div>
      </main>

      {editingDoc && <Modal title="Edit Document" onClose={() => setEditingDoc(null)}>
        <EditorBox value={editorValue} onChange={(value) => { setEditorValue(value); try { parseJsonObject(value, "Document"); setJsonError(null); } catch (error) { setJsonError((error as Error).message); } }} height="60vh" />
        {jsonError ? <ErrorBox message={jsonError} /> : <div className="flex items-center gap-2 text-sm text-emerald-600"><Check size={16} /> Valid JSON</div>}
        <div className="flex justify-between gap-3 pt-4">
          <Button variant="destructive" onClick={() => setDeleteDocId(String(editingDoc._id))}><Trash2 size={16} /> Delete</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditorValue(pretty(JSON.parse(editorValue)))}><Wand2 size={16} /> Beautify</Button>
            <Button onClick={saveEditor} disabled={!!jsonError || updateMutation.isPending}>{updateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save</Button>
          </div>
        </div>
      </Modal>}

      {bulkMode === "update" && <Modal title={`Update ${pagination.total} documents`} onClose={closeBulk}>
        <p className="text-sm text-gray-500 dark:text-compass-muted"><b>{collectionName}</b></p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-compass-text">Filter <span className="rounded-full bg-gray-200 dark:bg-compass-border px-2 py-0.5 text-xs">applied</span></div>
          <code className="block rounded-lg border border-gray-200 dark:border-compass-border bg-gray-50 dark:bg-compass-bg p-3 text-xs">{filter === "{}" ? "None" : filter}</code>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-compass-text">Update</h3>
            <Button variant="outline" size="sm" onClick={() => exportBulkCode("update")}><FileJson size={14} /> Export command</Button>
          </div>
          <EditorBox value={bulkUpdateInput} onChange={(value) => { setBulkUpdateInput(value); try { parseJsonObject(value, "Bulk update"); setJsonError(null); } catch (error) { setJsonError((error as Error).message); } }} height="280px" />
          {jsonError ? <ErrorBox message={jsonError} /> : <div className="flex items-center gap-2 text-sm text-emerald-600"><Check size={16} /> Valid update JSON</div>}
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-4">
          <Button variant="outline" onClick={() => toast.info({ title: "Saved operations are coming soon", description: "Bulk operation presets will be added in a later version." })}><Star size={16} /> Save</Button>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeBulk}>Cancel</Button>
            <Button onClick={() => bulkUpdateMutation.mutate()} disabled={!!jsonError || bulkUpdateMutation.isPending}>{bulkUpdateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Update {pagination.total} documents</Button>
          </div>
        </div>
      </Modal>}

      {bulkMode === "delete" && <Modal title={bulkConfirmStep ? "Are you absolutely sure?" : `Delete ${pagination.total} documents`} onClose={closeBulk}>
        {!bulkConfirmStep ? (
          <>
            <p className="text-sm text-gray-500 dark:text-compass-muted"><b>{collectionName}</b></p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-compass-text">Filter <span className="rounded-full bg-gray-200 dark:bg-compass-border px-2 py-0.5 text-xs">applied</span></div>
                <code className="block rounded-lg border border-gray-200 dark:border-compass-border bg-gray-50 dark:bg-compass-bg p-3 text-xs">{filter === "{}" ? "None" : filter}</code>
              </div>
              <Button variant="outline" onClick={() => exportBulkCode("delete")}><FileJson size={16} /> Export</Button>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-compass-text">Preview sample of {Math.min(5, documents.length)} documents</h3>
              <div className="max-h-[360px] overflow-auto rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-bg p-4">
                {documents.slice(0, 5).length ? documents.slice(0, 5).map((doc) => <div key={String(doc._id)} className="mb-4 border-b border-gray-200 dark:border-compass-border pb-4 last:mb-0 last:border-0 last:pb-0"><CollapsibleJsonView value={doc} /></div>) : <EmptyBox text="No preview available." />}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeBulk}>Cancel</Button>
              <Button variant="destructive" onClick={() => setBulkConfirmStep(true)}><Trash2 size={16} /> Delete {pagination.total} documents</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300"><AlertTriangle size={22} /> This action cannot be undone. This will permanently delete {pagination.total} documents.</div>
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
              The document list and count may not always reflect the latest updates in real time. This action applies to all documents matching the current filter, including documents not currently visible.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-compass-text">Type <code>{collectionName}</code> to confirm</label>
              <Input value={bulkConfirmInput} onChange={(e) => setBulkConfirmInput(e.target.value)} className="dark:bg-compass-bg dark:border-compass-border dark:text-compass-text" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setBulkConfirmStep(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => bulkDeleteMutation.mutate()} disabled={bulkConfirmInput !== collectionName || bulkDeleteMutation.isPending}>{bulkDeleteMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Delete {pagination.total} documents</Button>
            </div>
          </>
        )}
      </Modal>}

      {dropIndexName && <Modal title="Drop Index?" onClose={() => setDropIndexName(null)} maxWidth="max-w-xl">
        <div className="flex gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300"><AlertTriangle size={22} /> Dropping an index can slow down queries that rely on it.</div>
        <code className="block text-xs break-all rounded-lg bg-gray-100 dark:bg-compass-bg p-3">{dropIndexName}</code>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDropIndexName(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => dropIndexMutation.mutate(dropIndexName)} disabled={dropIndexMutation.isPending}>{dropIndexMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Drop index</Button>
        </div>
      </Modal>}

      {deleteDocId && <Modal title="Delete Document?" onClose={() => setDeleteDocId(null)}>
        <div className="flex gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300"><AlertTriangle size={22} /> This action cannot be undone.</div>
        <code className="block text-xs break-all rounded-lg bg-gray-100 dark:bg-compass-bg p-3">{deleteDocId}</code>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteDocId(null)}>Cancel</Button><Button variant="destructive" onClick={() => deleteMutation.mutate(deleteDocId)} disabled={deleteMutation.isPending}>Delete</Button></div>
      </Modal>}
    </div>
  );
}

function LabeledEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1"><label className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-compass-muted">{label}</label><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label === "Filter" ? '{ status: "active" }' : "{}"} spellCheck={false} className="font-mono text-xs dark:bg-compass-bg dark:border-compass-border dark:text-compass-text" /></div>;
}

function EditorBox({ value, onChange, height = "220px" }: { value: string; onChange: (value: string) => void; height?: string }) {
  return <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-compass-border"><Editor height={height} defaultLanguage="json" theme="vs-dark" value={value} onChange={(v) => onChange(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: "on", automaticLayout: true, formatOnPaste: true }} /></div>;
}

function ToolPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar p-4 md:p-6 shadow-sm space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h2 className="text-xl font-bold text-gray-900 dark:text-compass-text">{title}</h2>{action}</div>{children}</section>;
}

function ResultBlock({ value, loading }: { value: unknown; loading?: boolean }) {
  if (loading) return <LoaderBlock text="Running…" />;
  if (!value) return <EmptyBox text="No result yet." />;
  return <div className="max-h-[520px] overflow-auto rounded-xl border border-gray-200 dark:border-compass-border bg-gray-950 p-4"><CollapsibleJsonView value={value} dark /></div>;
}

function LoaderBlock({ text }: { text: string }) {
  return <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 dark:border-compass-border p-10 text-gray-500 dark:text-compass-muted"><Loader2 className="animate-spin" size={22} /> {text}</div>;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-red-700 dark:text-red-300">{message}</div>;
}

function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gray-200 dark:border-compass-border p-10 text-center text-gray-500 dark:text-compass-muted">{text}</div>;
}

function Modal({ title, onClose, children, maxWidth = "max-w-5xl" }: { title: string; onClose: () => void; children: ReactNode; maxWidth?: string }) {
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className={cn("w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-compass-border bg-white dark:bg-compass-sidebar shadow-2xl", maxWidth)}><div className="flex items-center justify-between border-b border-gray-200 dark:border-compass-border p-4"><h2 className="text-xl font-bold text-gray-900 dark:text-compass-text">{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-compass-border/30"><X size={20} /></button></div><div className="p-4 space-y-4">{children}</div></div></div>;
}

export default function CollectionPage() {
  return <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" size={42} /></div>}><CollectionPageContent /></Suspense>;
}
