async function api(path, options = {}) {
    const res = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        let message = `Ошибка ${res.status}`;
        try {
            const body = await res.json();
            message = body.detail || message;
        } catch (_) {
            /* тело не JSON */
        }
        throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
}

function toast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function openModal(id) {
    document.getElementById(id).hidden = false;
}

function closeModal(id) {
    document.getElementById(id).hidden = true;
}

async function loadBadge() {
    const badge = document.getElementById("db-badge");
    if (!badge) return;
    try {
        const collections = await api("/api/collections");
        badge.textContent = `${collections.length} коллекций`;
    } catch (e) {
        badge.textContent = "нет соединения с БД";
    }
}

document.addEventListener("DOMContentLoaded", loadBadge);
