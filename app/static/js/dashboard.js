async function loadCollections() {
    const grid = document.getElementById("collections-grid");
    grid.innerHTML = '<p class="muted">Загрузка...</p>';
    try {
        const collections = await api("/api/collections");
        if (collections.length === 0) {
            grid.innerHTML = '<p class="muted">Коллекций пока нет. Создайте первую.</p>';
            return;
        }
        grid.innerHTML = "";
        for (const col of collections) {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <h3>${col.name}</h3>
                <p class="muted">${col.count} документов</p>
                <div class="card-actions">
                    <a class="btn btn-primary" href="/collections/${encodeURIComponent(col.name)}">Открыть</a>
                    <button class="btn btn-danger" onclick="deleteCollection('${col.name}')">Удалить</button>
                </div>`;
            grid.appendChild(card);
        }
    } catch (e) {
        grid.innerHTML = `<p class="error">${e.message}</p>`;
    }
}

function openCreateCollectionModal() {
    document.getElementById("new-collection-name").value = "";
    openModal("create-collection-modal");
}

async function submitCreateCollection() {
    const name = document.getElementById("new-collection-name").value.trim();
    if (!name) {
        toast("Введите имя коллекции", "error");
        return;
    }
    try {
        await api("/api/collections", { method: "POST", body: JSON.stringify({ name }) });
        closeModal("create-collection-modal");
        toast(`Коллекция "${name}" создана`, "success");
        loadCollections();
    } catch (e) {
        toast(e.message, "error");
    }
}

async function deleteCollection(name) {
    if (!confirm(`Удалить коллекцию "${name}" со всеми документами?`)) return;
    try {
        await api(`/api/collections/${encodeURIComponent(name)}`, { method: "DELETE" });
        toast(`Коллекция "${name}" удалена`, "success");
        loadCollections();
    } catch (e) {
        toast(e.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", loadCollections);
