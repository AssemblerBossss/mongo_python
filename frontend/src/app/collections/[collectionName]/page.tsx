"use client";

import Sidebar from "@/src/components/custom/Sidebar.tsx";
import Editor from "@/src/components/custom/MonacoEditorLazy.tsx";
import {Button} from "@/src/components/ui/button.tsx";
import {Input} from "@/src/components/ui/input.tsx";
import {useToast} from "@/src/components/ui/toast.tsx";
import {cn} from "@/src/lib/utils.ts";
import {convertToCSV} from "@/src/lib/data-utils.ts";
import {parseQueryObject} from "@/src/lib/query-parser.ts";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    DatabaseZap,
    Download,
    Edit3,
    FileJson,
    Layers,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Table2,
    Trash2,
    Upload,
    Wand2,
    X,
} from "lucide-react";
import Link from "next/link";
import {useParams, useRouter, useSearchParams} from "next/navigation";
import {Suspense, useEffect, useRef, useState} from "react";
import type {ChangeEvent, ReactNode} from "react";

type JsonObject = Record<string, unknown>;
type TabKey = "documents" | "schema" | "indexes" | "stats";
type ViewMode = "tree" | "json";

const tabs: { key: TabKey; label: string; icon: typeof FileJson }[] = [
    {key: "documents", label: "Documents", icon: FileJson},
    {key: "schema", label: "Schema", icon: DatabaseZap},
    {key: "indexes", label: "Indexes", icon: Layers},
    {key: "stats", label: "Stats", icon: Table2},
];
const tabKeys = new Set<TabKey>(tabs.map(({key}) => key));

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

function Value({value}: { value: unknown }) {
    if (value === null) return <span className="text-gray-400">null</span>;
    if (typeof value === "boolean") return <span
        className="text-purple-600">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-blue-600">{value}</span>;
    if (typeof value === "string") return <span className="text-cyan-700">&quot;{value}&quot;</span>;
    if (Array.isArray(value)) return <span className="text-gray-400">Array({value.length})</span>;
    if (typeof value === "object") return <span className="text-gray-400">Object</span>;
    return <span>{String(value)}</span>;
}

function TreeNode({label, value}: { label: string; value: unknown }) {
    const expandable = value !== null && typeof value === "object";
    const [open, setOpen] = useState(true);
    const keys = expandable ? Object.keys(value as JsonObject) : [];
    return (
        <div className="py-0.5">
            <div className="flex items-start gap-1">
                {expandable ? (
                    <button onClick={() => setOpen((v) => !v)} className="w-4 text-gray-400 hover:text-blue-500">
                        <span className={cn("inline-block transition-transform", open && "rotate-90")}>›</span>
                    </button>
                ) : <span className="w-4"/>}
                <span className="font-medium text-gray-700">{label}:</span>
                {expandable ? <span
                        className="text-xs italic text-gray-400">{Array.isArray(value) ? `Array(${keys.length})` : `{${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ", …" : ""}}`}</span> :
                    <Value value={value}/>}
            </div>
            {expandable && open && (
                <div className="ml-5 border-l border-gray-200 pl-2">
                    {keys.map((key) => <TreeNode key={key} label={key} value={(value as JsonObject)[key]}/>)}
                </div>
            )}
        </div>
    );
}

function DocumentTree({doc}: { doc: unknown }) {
    if (!doc || typeof doc !== "object") return <Value value={doc}/>;
    return <div className="font-mono text-sm">{Object.keys(doc as JsonObject).map((key) => <TreeNode key={key}
                                                                                                     label={key}
                                                                                                     value={(doc as JsonObject)[key]}/>)}</div>;
}


function JsonPrimitive({value}: { value: unknown }) {
    if (value === null) return <span className="text-gray-400">null</span>;
    if (typeof value === "boolean") return <span
        className="text-purple-600">{String(value)}</span>;
    if (typeof value === "number") return <span className="text-blue-600">{value}</span>;
    if (typeof value === "string") return <span
        className="text-emerald-700">{JSON.stringify(value)}</span>;
    return <span className="text-gray-700">{JSON.stringify(value)}</span>;
}

function CollapsibleJsonNode({
                                 name,
                                 value,
                                 depth = 0,
                                 isLast = true,
                             }: {
    name?: string;
    value: unknown;
    depth?: number;
    isLast?: boolean;
}) {
    const expandable = value !== null && typeof value === "object";
    const [open, setOpen] = useState(true);
    const isArray = Array.isArray(value);
    const entries = expandable ? Object.entries(value as JsonObject) : [];
    const opener = isArray ? "[" : "{";
    const closer = isArray ? "]" : "}";
    const prefix = name !== undefined ? <><span className="text-sky-700">{JSON.stringify(name)}</span><span
        className="text-gray-500">: </span></> : null;
    const comma = isLast ? null : <span className="text-gray-500">,</span>;

    if (!expandable) {
        return (
            <div className="leading-6" style={{paddingLeft: depth * 18}}>
                <span className="inline-block w-4"/>{prefix}<JsonPrimitive value={value}/>{comma}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="leading-6" style={{paddingLeft: depth * 18}}>
                <span className="inline-block w-4"/>{prefix}<span
                className="text-gray-600">{opener}{closer}</span>{comma}
            </div>
        );
    }

    return (
        <div className="leading-6">
            <div style={{paddingLeft: depth * 18}}>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="inline-flex w-4 items-center justify-center text-gray-400 hover:text-emerald-500"
                    aria-label={open ? "Collapse JSON node" : "Expand JSON node"}
                >
                    <span className={cn("inline-block transition-transform", open && "rotate-90")}>›</span>
                </button>
                {prefix}<span className="text-gray-600">{opener}</span>
                {!open && <span
                    className="text-gray-400">… {isArray ? `${entries.length} items` : `${entries.length} fields`} …</span>}
                {!open && <span className="text-gray-600">{closer}</span>}
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
                    <div style={{paddingLeft: depth * 18}}><span className="inline-block w-4"/><span
                        className="text-gray-600">{closer}</span>{comma}</div>
                </>
            )}
        </div>
    );
}

function CollapsibleJsonView({value, dark = false}: { value: unknown; dark?: boolean }) {
    return (
        <div className={cn("font-mono text-xs", dark ? "text-gray-100" : "text-gray-800")}>
            <CollapsibleJsonNode value={value}/>
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
    const address = searchParams.get("address") ?? "";

    const hasAdvancedQuery = filter !== "{}" || project !== "{}" || sort !== "{}";
    const [searchMode, setSearchMode] = useState<"simple" | "advanced">(hasAdvancedQuery ? "advanced" : "simple");
    const [addressInput, setAddressInput] = useState(address);
    const [filterInput, setFilterInput] = useState(filter);
    const [projectInput, setProjectInput] = useState(project);
    const [sortInput, setSortInput] = useState(sort);
    const [viewMode, setViewMode] = useState<ViewMode>("tree");
    const [editingDoc, setEditingDoc] = useState<JsonObject | null>(null);
    const [editorValue, setEditorValue] = useState("{}");
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
    const [dropIndexName, setDropIndexName] = useState<string | null>(null);

    const [indexKeys, setIndexKeys] = useState('{\n  "fieldName": 1\n}');
    const [indexOptions, setIndexOptions] = useState('{\n  "name": "fieldName_1"\n}');
    const [schemaResult, setSchemaResult] = useState<unknown>(null);

    useEffect(() => {
        setFilterInput(filter);
        setProjectInput(project);
        setSortInput(sort);
        setAddressInput(address);
    }, [filter, project, sort, address]);
    useEffect(() => {
        if (!editingDoc) return;
        const {_id, ...rest} = editingDoc;
        void _id;
        setEditorValue(pretty(rest));
        setJsonError(null);
    }, [editingDoc]);

    const documentsQuery = useQuery({
        queryKey: ["documents", collectionName, page, limit, filter, project, sort, address],
        queryFn: async () => {
            const p = new URLSearchParams({page: String(page), limit: String(limit)});
            if (address) {
                p.set("address", address);
            } else {
                p.set("filter", filter);
                p.set("project", project);
                p.set("sort", sort);
            }
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

    const documents: JsonObject[] = documentsQuery.data?.documents ?? [];
    const pagination = documentsQuery.data?.pagination ?? {total: 0, pages: 1, page, limit};

    function updateUrl(next: Record<string, string | number>) {
        const p = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(next)) p.set(key, String(value));
        router.push(`?${p.toString()}`);
    }

    function switchTab(nextTab: TabKey) {
        updateUrl({tab: nextTab});
    }

    function runFind() {
        try {
            parseJsonObject(filterInput, "Filter");
            parseJsonObject(projectInput, "Project");
            parseJsonObject(sortInput, "Sort");
            updateUrl({
                tab: "documents", page: 1,
                filter: filterInput, project: projectInput, sort: sortInput,
                address: "",
            });
        } catch (error) {
            toast.error((error as Error).message);
        }
    }

    function resetQuery() {
        setFilterInput("{}");
        setProjectInput("{}");
        setSortInput("{}");
        updateUrl({tab: "documents", page: 1, limit: 20, filter: "{}", project: "{}", sort: "{}", address: ""});
    }

    function runAddressSearch() {
        const value = addressInput.trim();
        updateUrl({tab: "documents", page: 1, address: value, filter: "{}", project: "{}", sort: "{}"});
    }

    function resetAddressSearch() {
        setAddressInput("");
        updateUrl({tab: "documents", page: 1, limit: 20, address: "", filter: "{}", project: "{}", sort: "{}"});
    }

    const importMutation = useMutation({
        mutationFn: async (docs: unknown[]) => {
            const res = await fetch(`${apiCollectionPath}/documents`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(docs),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Import failed");
            return json;
        },
        onSuccess: (json) => {
            toast.success(json.message || "Import completed");
            queryClient.invalidateQueries({queryKey: ["documents", collectionName]});
        },
        onError: (error) => toast.error((error as Error).message),
    });


    const updateMutation = useMutation({
        mutationFn: async ({id, body}: { id: string; body: unknown }) => {
            const res = await fetch(`${apiCollectionPath}/documents/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Update failed");
            return json;
        },
        onSuccess: () => {
            toast.success("Document updated successfully.");
            setEditingDoc(null);
            queryClient.invalidateQueries({queryKey: ["documents", collectionName]});
        },
        onError: (error) => toast.error((error as Error).message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${apiCollectionPath}/documents/${encodeURIComponent(id)}`, {method: "DELETE"});
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Delete failed");
            return json;
        },
        onSuccess: () => {
            toast.success("Document deleted successfully.");
            setDeleteDocId(null);
            setEditingDoc(null);
            queryClient.invalidateQueries({queryKey: ["documents", collectionName]});
        },
        onError: (error) => toast.error((error as Error).message),
    });

    const createIndexMutation = useMutation({
        mutationFn: async () => {
            const keys = parseJsonObject(indexKeys, "Index keys");
            const options = parseJsonObject(indexOptions, "Index options");
            const res = await fetch(`${apiCollectionPath}/indexes`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({keys, options}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Index creation failed");
            return json;
        },
        onSuccess: () => {
            toast.success("Index created successfully.");
            queryClient.invalidateQueries({queryKey: ["indexes", collectionName]});
        },
        onError: (error) => toast.error((error as Error).message),
    });

    const dropIndexMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await fetch(`${apiCollectionPath}/indexes/${encodeURIComponent(name)}`, {method: "DELETE"});
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Drop index failed");
            return json;
        },
        onSuccess: () => {
            toast.success("Index dropped successfully.");
            setDropIndexName(null);
            queryClient.invalidateQueries({queryKey: ["indexes", collectionName]});
        },
        onError: (error) => toast.error((error as Error).message),
    });

    const schemaMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${apiCollectionPath}/schema`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({sampleSize: 500}),
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
        const blob = new Blob([content], {type: format === "json" ? "application/json" : "text/csv"});
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), {
            href: url,
            download: `${collectionName}-page-${page}.${format}`
        });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} export started.`);
    }

    function saveEditor() {
        try {
            setJsonError(null);
            const parsed = parseJsonObject(editorValue, "Document");
            updateMutation.mutate({id: String(editingDoc?._id), body: parsed});
        } catch (error) {
            setJsonError((error as Error).message);
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar/>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <header className="space-y-4">
                        <Link href="/"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <ArrowLeft size={14}/> Back to Collections
                        </Link>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <Layers size={24}/></div>
                                <div className="min-w-0">
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">{collectionName}</h1>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => documentsQuery.refetch()}
                                        disabled={documentsQuery.isFetching}>
                                    <RefreshCw size={16}
                                               className={cn(documentsQuery.isFetching && "animate-spin")}/> Reload
                                </Button>
                                <Button variant="outline" onClick={() => exportCurrent("json")}><Download
                                    size={16}/> JSON</Button>
                                <Button variant="outline" onClick={() => exportCurrent("csv")}><Download
                                    size={16}/> CSV</Button>
                                <Button variant="outline" onClick={() => fileInputRef.current?.click()}
                                        disabled={importMutation.isPending}><Upload
                                    size={16}/> Import</Button>
                                <input ref={fileInputRef} type="file" accept=".json,application/json"
                                       onChange={handleFileChange} className="hidden"/>
                            </div>
                        </div>
                    </header>

                    <div
                        className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 flex gap-1">
                        {tabs.map((item) => {
                            const Icon = item.icon;
                            const active = tab === item.key;
                            return <button key={item.key} onClick={() => switchTab(item.key)}
                                           className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors", active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100")}>
                                <Icon size={16}/>{item.label}</button>;
                        })}
                    </div>

                    <section
                        className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                                <button type="button" onClick={() => setSearchMode("simple")}
                                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", searchMode === "simple" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                                    Simple
                                </button>
                                <button type="button" onClick={() => setSearchMode("advanced")}
                                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-colors", searchMode === "advanced" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                                    Advanced
                                </button>
                            </div>
                            <div className="flex gap-2">
                                {(["tree", "json"] as ViewMode[]).map((mode) => <Button key={mode}
                                                                                                 variant={viewMode === mode ? "default" : "outline"}
                                                                                                 onClick={() => setViewMode(mode)}
                                                                                                 className="capitalize">{mode}</Button>)}
                            </div>
                        </div>

                        {searchMode === "simple" ? (
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="flex-1 min-w-[240px] space-y-1">
                                    <label
                                        className="text-xs font-medium text-gray-500">Search by MAC / IP / Domain</label>
                                    <Input value={addressInput}
                                           onChange={(e: ChangeEvent<HTMLInputElement>) => setAddressInput(e.target.value)}
                                           onKeyDown={(e) => e.key === "Enter" && runAddressSearch()}
                                           placeholder="e.g. 192.168.1.1, AA:BB:CC:DD:EE:FF, example.com"/>
                                </div>
                                <Button onClick={runAddressSearch}><Search size={16}/> Search</Button>
                                <Button variant="outline" onClick={resetAddressSearch}>Clear</Button>
                                {address && documentsQuery.data?.address_type && (
                                    <span
                                        className="px-2 py-2 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold uppercase self-center">
                                        {documentsQuery.data.address_type}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <LabeledEditor label="Filter" value={filterInput} onChange={setFilterInput}/>
                                    <LabeledEditor label="Project" value={projectInput} onChange={setProjectInput}/>
                                    <LabeledEditor label="Sort" value={sortInput} onChange={setSortInput}/>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={runFind}><Search
                                        size={16}/> Find</Button>
                                    <Button variant="outline" onClick={resetQuery}>Reset</Button>
                                </div>
                            </>
                        )}
                    </section>

                    {tab === "documents" && (
                        <section className="space-y-4">
                            <div className="flex flex-col gap-3 text-sm text-gray-500">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <span>Showing <b
                                        className="text-gray-900">{documents.length}</b> of <b
                                        className="text-gray-900">{pagination.total}</b> documents</span>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" disabled={page <= 1}
                                                onClick={() => updateUrl({page: page - 1})}><ChevronLeft
                                            size={16}/></Button>
                                        <span
                                            className="px-3 py-2 rounded-lg border border-gray-200 bg-white">Page {page} / {pagination.pages}</span>
                                        <Button variant="outline" size="icon" disabled={page >= pagination.pages}
                                                onClick={() => updateUrl({page: page + 1})}><ChevronRight
                                            size={16}/></Button>
                                    </div>
                                </div>
                                <div
                                    className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2">
                                    <Button size="sm"
                                            onClick={() => fileInputRef.current?.click()}><Plus size={14}/> Add
                                        Data</Button>
                                </div>
                            </div>

                            {documentsQuery.isLoading ?
                                <LoaderBlock text="Loading documents…"/> : documentsQuery.error ? <ErrorBox
                                    message={(documentsQuery.error as Error).message}/> : (
                                        <div className="space-y-4">
                                            {documents.map((doc) => (
                                                <div key={String(doc._id)}
                                                     className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                                    <div
                                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-gray-100 border-b border-gray-200">
                                                        <code
                                                            className="text-xs truncate text-gray-600">_id: {String(doc._id)}</code>
                                                        <div className="flex gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => {
                                                                const {_id, ...clone} = doc;
                                                                void _id;
                                                                navigator.clipboard?.writeText(pretty(clone));
                                                                toast.success("Document JSON copied.");
                                                            }}><Copy size={14}/> Clone JSON</Button>
                                                            <Button variant="outline" size="sm"
                                                                    onClick={() => setEditingDoc(doc)}><Edit3
                                                                size={14}/> Edit</Button>
                                                            <Button variant="outline" size="sm"
                                                                    onClick={() => setDeleteDocId(String(doc._id))}
                                                                    className="text-red-600"><Trash2 size={14}/> Delete</Button>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="p-4 overflow-x-auto bg-white">{viewMode === "json" ?
                                                        <CollapsibleJsonView value={doc}/> :
                                                        <DocumentTree doc={doc}/>}</div>
                                                </div>
                                            ))}
                                            {documents.length === 0 && <EmptyBox text="No documents found."/>}
                                        </div>
                                    )}
                        </section>
                    )}

                    {tab === "schema" && <ToolPanel title="Schema Analyzer"
                                                    action={<Button onClick={() => schemaMutation.mutate()}
                                                                    disabled={schemaMutation.isPending}><DatabaseZap
                                                        size={16}/> Analyze Sample</Button>}>
                        <p className="text-sm text-gray-500">Analyze a random sample of
                            documents and show detected fields, types, presence, and examples.</p>
                        <ResultBlock value={schemaResult} loading={schemaMutation.isPending}/>
                    </ToolPanel>}

                    {tab === "indexes" && <ToolPanel title="Indexes"
                                                     action={<Button onClick={() => createIndexMutation.mutate()}
                                                                     disabled={createIndexMutation.isPending}><Plus
                                                         size={16}/> Create Index</Button>}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div><h3 className="font-semibold mb-2">Keys</h3><EditorBox value={indexKeys}
                                                                                        onChange={setIndexKeys}
                                                                                        height="160px"/></div>
                            <div><h3 className="font-semibold mb-2">Options</h3><EditorBox value={indexOptions}
                                                                                           onChange={setIndexOptions}
                                                                                           height="160px"/></div>
                        </div>
                        {indexesQuery.isLoading ? <LoaderBlock text="Loading indexes…"/> : indexesQuery.error ?
                            <ErrorBox message={(indexesQuery.error as Error).message}/> : (
                                <div className="space-y-2">
                                    {(indexesQuery.data ?? []).map((index: JsonObject) => <div
                                        key={String(index.name)}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
                                        <div><b>{String(index.name)}</b>
                                            <pre
                                                className="text-xs text-gray-500 mt-1 overflow-x-auto">{pretty(index.key)}</pre>
                                        </div>
                                        <Button variant="outline" size="sm"
                                                disabled={index.name === "_id_" || dropIndexMutation.isPending}
                                                onClick={() => setDropIndexName(String(index.name))}
                                                className="text-red-600"><Trash2 size={14}/> Drop</Button>
                                    </div>)}
                                </div>
                            )}
                    </ToolPanel>}
                  
                    {tab === "stats" && <ToolPanel title="Collection Stats">
                        {statsQuery.isLoading ? <LoaderBlock text="Loading stats…"/> : statsQuery.error ?
                            <ErrorBox message={(statsQuery.error as Error).message}/> :
                            <ResultBlock value={statsQuery.data?.stats}/>}
                    </ToolPanel>}
                </div>
            </main>

            {editingDoc && <Modal title="Edit Document" onClose={() => setEditingDoc(null)}>
                <EditorBox value={editorValue} onChange={(value) => {
                    setEditorValue(value);
                    try {
                        parseJsonObject(value, "Document");
                        setJsonError(null);
                    } catch (error) {
                        setJsonError((error as Error).message);
                    }
                }} height="60vh"/>
                {jsonError ? <ErrorBox message={jsonError}/> :
                    <div className="flex items-center gap-2 text-sm text-emerald-600"><Check size={16}/> Valid JSON
                    </div>}
                <div className="flex justify-between gap-3 pt-4">
                    <Button variant="destructive" onClick={() => setDeleteDocId(String(editingDoc._id))}><Trash2
                        size={16}/> Delete</Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditorValue(pretty(JSON.parse(editorValue)))}><Wand2
                            size={16}/> Beautify</Button>
                        <Button onClick={saveEditor}
                                disabled={!!jsonError || updateMutation.isPending}>{updateMutation.isPending ?
                            <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>} Save</Button>
                    </div>
                </div>
            </Modal>}

            {dropIndexName && <Modal title="Drop Index?" onClose={() => setDropIndexName(null)} maxWidth="max-w-xl">
                <div className="flex gap-3 rounded-lg bg-red-50 p-4 text-red-700">
                    <AlertTriangle size={22}/> Dropping an index can slow down queries that rely on it.
                </div>
                <code
                    className="block text-xs break-all rounded-lg bg-gray-100 p-3">{dropIndexName}</code>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDropIndexName(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => dropIndexMutation.mutate(dropIndexName)}
                            disabled={dropIndexMutation.isPending}>{dropIndexMutation.isPending ?
                        <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>} Drop index</Button>
                </div>
            </Modal>}

            {deleteDocId && <Modal title="Delete Document?" onClose={() => setDeleteDocId(null)}>
                <div className="flex gap-3 rounded-lg bg-red-50 p-4 text-red-700">
                    <AlertTriangle size={22}/> This action cannot be undone.
                </div>
                <code
                    className="block text-xs break-all rounded-lg bg-gray-100 p-3">{deleteDocId}</code>
                <div className="flex justify-end gap-2"><Button variant="outline"
                                                                onClick={() => setDeleteDocId(null)}>Cancel</Button><Button
                    variant="destructive" onClick={() => deleteMutation.mutate(deleteDocId)}
                    disabled={deleteMutation.isPending}>Delete</Button></div>
            </Modal>}
        </div>
    );
}

function LabeledEditor({label, value, onChange}: { label: string; value: string; onChange: (value: string) => void }) {
    return <div className="space-y-1"><label
        className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</label><Input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={label === "Filter" ? '{ status: "active" }' : "{}"} spellCheck={false}
        className="font-mono text-xs"/></div>;
}

function EditorBox({value, onChange, height = "220px"}: {
    value: string;
    onChange: (value: string) => void;
    height?: string
}) {
    return <div className="overflow-hidden rounded-xl border border-gray-200"><Editor
        height={height} defaultLanguage="json" theme="vs-dark" value={value} onChange={(v) => onChange(v ?? "")}
        options={{
            minimap: {enabled: false},
            fontSize: 13,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            formatOnPaste: true
        }}/></div>;
}

function ToolPanel({title, action, children}: { title: string; action?: ReactNode; children: ReactNode }) {
    return <section
        className="rounded-xl border border-gray-200 bg-white p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h2
            className="text-xl font-bold text-gray-900">{title}</h2>{action}</div>
        {children}</section>;
}

function ResultBlock({value, loading}: { value: unknown; loading?: boolean }) {
    if (loading) return <LoaderBlock text="Running…"/>;
    if (!value) return <EmptyBox text="No result yet."/>;
    return <div
        className="max-h-[520px] overflow-auto rounded-xl border border-gray-200 bg-gray-950 p-4">
        <CollapsibleJsonView value={value} dark/></div>;
}

function LoaderBlock({text}: { text: string }) {
    return <div
        className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 p-10 text-gray-500">
        <Loader2 className="animate-spin" size={22}/> {text}</div>;
}

function ErrorBox({message}: { message: string }) {
    return <div
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{message}</div>;
}

function EmptyBox({text}: { text: string }) {
    return <div
        className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-500">{text}</div>;
}

function Modal({title, onClose, children, maxWidth = "max-w-5xl"}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string
}) {
    return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
            className={cn("w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl", maxWidth)}>
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100">
                    <X size={20}/></button>
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    </div>;
}

export default function CollectionPage() {
    return <Suspense
        fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin"
                                                                                      size={42}/>
        </div>}><CollectionPageContent/></Suspense>;
}
