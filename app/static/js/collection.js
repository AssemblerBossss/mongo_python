const state = { skip: 0, limit: 20, filter: {}, total: 0 };
let editingId = null;

function buildQuery() {
    const params = new URLSearchParams();
    params.set("skip", state.skip);
    params.set("limit", state.limit);
    if (Object.keys(state.filter).length) {
        params.set("filter", JSON.stringify(state.filter));
    }
    return params.toString();
}

async function loadDocuments() {
    const tbody = document.getElementById("docs-tbody");
    try {
        const data = await api(`/api/collections/${encodeURIComponent(COLLECTION_NAME)}/documents?${buildQuery()}`);
        state.total = data.total;
        renderTable(data.items);
        updatePagination();
    } catch (e) {
        document.getElementById("docs-thead").innerHTML = "";
        tbody.innerHTML = `<tr><td class="error">${e.message}</td></tr>`;
    }
}

function collectColumns(items) {
    const cols = ["_id"];
    for (const item of items) {
        for (const key of Object.keys(item)) {
            if (key !== "_id" && !cols.includes(key)) cols.push(key);
        }
    }
    return cols.slice(0, 7);
}

function formatCell(value) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderTable(items) {
    const thead = document.getElementById("docs-thead");
    const tbody = document.getElementById("docs-tbody");
    if (items.length === 0) {
        thead.innerHTML = "";
        tbody.innerHTML = '<tr><td class="muted">Нет документов</td></tr>';
        return;
    }
    const columns = collectColumns(items);
    thead.innerHTML = `<tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}<th>Действия</th></tr>`;
    tbody.innerHTML = items
        .map((item) => {
            const id = item._id;
            const cells = columns.map((c) => `<td title="${escapeHtml(formatCell(item[c]))}">${escapeHtml(formatCell(item[c]))}</td>`).join("");
            return `
                <tr>
                    ${cells}
                    <td class="actions-cell">
                        <button class="btn btn-small" onclick="openDocModal('${id}')">Изменить</button>
                        <button class="btn btn-small btn-danger" onclick="deleteDocument('${id}')">Удалить</button>
                    </td>
                </tr>`;
        })
        .join("");
}

function updatePagination() {
    const page = Math.floor(state.skip / state.limit) + 1;
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    document.getElementById("page-info").textContent = `Стр. ${page} из ${pages} (всего ${state.total})`;
    document.getElementById("prev-page").disabled = state.skip === 0;
    document.getElementById("next-page").disabled = state.skip + state.limit >= state.total;
}

function prevPage() {
    state.skip = Math.max(0, state.skip - state.limit);
    loadDocuments();
}

function nextPage() {
    if (state.skip + state.limit < state.total) {
        state.skip += state.limit;
        loadDocuments();
    }
}

function applyFilter() {
    const raw = document.getElementById("filter-input").value.trim();
    if (!raw) {
        state.filter = {};
    } else {
        try {
            state.filter = JSON.parse(raw);
        } catch (e) {
            toast("Фильтр должен быть корректным JSON", "error");
            return;
        }
    }
    state.skip = 0;
    loadDocuments();
}

function resetFilter() {
    document.getElementById("filter-input").value = "";
    state.filter = {};
    state.skip = 0;
    loadDocuments();
}

async function openDocModal(id = null) {
    editingId = id;
    document.getElementById("doc-modal-title").textContent = id ? `Документ ${id}` : "Новый документ";
    const editor = document.getElementById("doc-editor");
    if (id) {
        try {
            const doc = await api(`/api/collections/${encodeURIComponent(COLLECTION_NAME)}/documents/${id}`);
            editor.value = JSON.stringify(doc, null, 2);
        } catch (e) {
            toast(e.message, "error");
            return;
        }
    } else {
        editor.value = "{\n  \n}";
    }
    openModal("doc-modal");
}

async function saveDocument() {
    let data;
    try {
        data = JSON.parse(document.getElementById("doc-editor").value);
    } catch (e) {
        toast("Некорректный JSON", "error");
        return;
    }
    try {
        if (editingId) {
            await api(`/api/collections/${encodeURIComponent(COLLECTION_NAME)}/documents/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(data),
            });
            toast("Документ обновлён", "success");
        } else {
            await api(`/api/collections/${encodeURIComponent(COLLECTION_NAME)}/documents`, {
                method: "POST",
                body: JSON.stringify(data),
            });
            toast("Документ добавлен", "success");
        }
        closeModal("doc-modal");
        loadDocuments();
    } catch (e) {
        toast(e.message, "error");
    }
}

async function deleteDocument(id) {
    if (!confirm("Удалить документ?")) return;
    try {
        await api(`/api/collections/${encodeURIComponent(COLLECTION_NAME)}/documents/${id}`, { method: "DELETE" });
        toast("Документ удалён", "success");
        loadDocuments();
    } catch (e) {
        toast(e.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", loadDocuments);
