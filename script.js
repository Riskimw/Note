
const STORAGE_KEY = "codevault_notes_v1";

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let currentFilter = "all";
let searchQuery = "";

const $ = (id) => document.getElementById(id);

const grid = $("notesGrid");
const modal = $("modal");
const form = $("noteForm");

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  $("totalCount").textContent = notes.length;
  $("statTotal").textContent = notes.length;
  $("statFav").textContent = notes.filter(n => n.favorite).length;
  $("statCategories").textContent =
    new Set(notes.map(n => n.category)).size;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function renderNotes() {
  let filtered = [...notes];

  if (currentFilter === "favorites") {
    filtered = filtered.filter(n => n.favorite);
  } else if (currentFilter !== "all") {
    filtered = filtered.filter(n => n.category === currentFilter);
  }

  if (searchQuery) {
    filtered = filtered.filter(n =>
      [n.title, n.description, n.code, n.category]
        .some(value => value.toLowerCase().includes(searchQuery))
    );
  }

  const sort = $("sortSelect").value;

  if (sort === "newest") {
    filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  } else if (sort === "oldest") {
    filtered.sort((a, b) => a.updatedAt - b.updatedAt);
  } else {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  grid.innerHTML = filtered.map(note => `
    <article class="note-card">
      <div class="note-top">
        <span class="note-category">${escapeHTML(note.category)}</span>
        <div class="note-actions">
          <button class="icon-btn ${note.favorite ? "fav" : ""}"
            data-action="favorite" data-id="${note.id}"
            title="Favorit">
            ${note.favorite ? "★" : "☆"}
          </button>
          <button class="icon-btn" data-action="edit"
            data-id="${note.id}" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete"
            data-id="${note.id}" title="Hapus">×</button>
        </div>
      </div>

      <h3>${escapeHTML(note.title)}</h3>
      <p class="note-desc">${escapeHTML(note.description || "Tidak ada deskripsi.")}</p>

      <div class="code-preview">
        <pre>${escapeHTML(note.code)}</pre>
      </div>

      <div class="note-bottom">
        <span class="note-date">${formatDate(note.updatedAt)}</span>
        <button class="copy-btn" data-action="copy"
          data-id="${note.id}">▣ Copy Code</button>
      </div>
    </article>
  `).join("");

  $("emptyState").classList.toggle("show", filtered.length === 0);
  grid.style.display = filtered.length ? "grid" : "none";

  saveNotes();
}

function openModal(note = null) {
  form.reset();
  $("noteId").value = note ? note.id : "";
  $("modalTitle").textContent = note ? "Edit Note" : "New Note";

  $("noteTitle").value = note?.title || "";
  $("noteDescription").value = note?.description || "";
  $("noteCategory").value = note?.category || "HTML";
  $("noteCode").value = note?.code || "";

  updateEditorLanguage();
  modal.classList.add("show");
  $("noteTitle").focus();
}

function closeModal() {
  modal.classList.remove("show");
}

function updateEditorLanguage() {
  $("editorLanguage").textContent = $("noteCategory").value;
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const id = $("noteId").value;
  const oldNote = notes.find(n => n.id === id);

  const note = {
    id: id || crypto.randomUUID(),
    title: $("noteTitle").value.trim(),
    description: $("noteDescription").value.trim(),
    category: $("noteCategory").value,
    code: $("noteCode").value,
    favorite: oldNote?.favorite || false,
    createdAt: oldNote?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  if (!note.title || !note.code.trim()) {
    showToast("Judul dan kode wajib diisi!");
    return;
  }

  if (id) {
    notes = notes.map(n => n.id === id ? note : n);
  } else {
    notes.unshift(note);
  }

  closeModal();
  renderNotes();
  showToast(id ? "Catatan berhasil diperbarui!" : "Catatan berhasil disimpan!");
});

// Tambah catatan
$("addBtn").addEventListener("click", () => openModal());
$("emptyAddBtn").addEventListener("click", () => openModal());

// Tutup modal
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("searchInput").focus();
  }
});

// Ganti bahasa editor
$("noteCategory").addEventListener("change", updateEditorLanguage);

// Search
$("searchInput").addEventListener("input", event => {
  searchQuery = event.target.value.toLowerCase().trim();
  renderNotes();
});

// Sort
$("sortSelect").addEventListener("change", renderNotes);

// Filter kategori
document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    const names = {
      all: "Semua Catatan",
      favorites: "Favorit"
    };

    const title = names[currentFilter] || currentFilter;

    $("breadcrumbName").textContent = title;
    $("listTitle").textContent =
      currentFilter === "all" ? "All Notes" : title;

    $("listSubtitle").textContent =
      currentFilter === "favorites"
        ? "Catatan yang lo tandai sebagai favorit."
        : currentFilter === "all"
          ? "Semua snippet kode lo ada di sini."
          : `Kumpulan catatan ${title} lo.`;

    $("searchInput").value = "";
    searchQuery = "";

    if (window.innerWidth <= 700) {
      $("sidebar").classList.remove("open");
    }

    renderNotes();
  });
});

// Aksi pada kartu catatan
grid.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const note = notes.find(n => n.id === id);
  if (!note) return;

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(note.code);
      showToast("Kode berhasil disalin!");
    } catch {
      showToast("Gagal menyalin kode. Coba akses lewat HTTPS.");
    }
  }

  if (action === "edit") {
    openModal(note);
  }

  if (action === "delete") {
    if (confirm(`Hapus catatan "${note.title}"?`)) {
      notes = notes.filter(n => n.id !== id);
      renderNotes();
      showToast("Catatan berhasil dihapus!");
    }
  }

  if (action === "favorite") {
    note.favorite = !note.favorite;
    renderNotes();
    showToast(note.favorite ? "Ditambahkan ke favorit!" : "Dihapus dari favorit!");
  }
});

// Mobile sidebar
$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// Inisialisasi
renderNotes();
