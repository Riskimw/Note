
let notes = [];
let currentFilter = "all";
let searchQuery = "";

const $ = id => document.getElementById(id);
const grid = $("notesGrid");
const modal = $("modal");
const form = $("noteForm");

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
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

function formatDate(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// LOAD NOTES FROM SUPABASE
async function loadNotes() {
  try {
    const { data, error } = await supabaseClient
      .from("code_notes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    notes = data.map(note => ({
      id: note.id,
      title: note.title,
      description: note.description || "",
      category: note.category,
      code: note.code,
      favorite: note.favorite || false,
      createdAt: note.created_at,
      updatedAt: new Date(note.updated_at || note.created_at).getTime()
    }));

    renderNotes();

    $("totalCount").textContent = notes.length;
    showStatus("All changes saved");
  } catch (error) {
    console.error("Supabase error:", error);
    showStatus("Connection error");
    showToast("Gagal mengambil catatan: " + error.message);
  }
}

function showStatus(message) {
  const status = document.querySelector(".status");
  if (status) {
    status.innerHTML = `<i></i> ${escapeHTML(message)}`;
  }
}

// RENDER NOTES
function renderNotes() {
  let filtered = [...notes];

  if (currentFilter === "favorites") {
    filtered = filtered.filter(note => note.favorite);
  } else if (currentFilter !== "all") {
    filtered = filtered.filter(note =>
      note.category === currentFilter
    );
  }

  if (searchQuery) {
    filtered = filtered.filter(note =>
      [
        note.title,
        note.description,
        note.code,
        note.category
      ].some(value =>
        String(value).toLowerCase().includes(searchQuery)
      )
    );
  }

  const sort = $("sortSelect").value;

  if (sort === "newest") {
    filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  } else if (sort === "oldest") {
    filtered.sort((a, b) => a.updatedAt - b.updatedAt);
  } else {
    filtered.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  grid.innerHTML = filtered.map(note => `
    <article class="note-card">
      <div class="note-top">
        <span class="note-category">
          ${escapeHTML(note.category)}
        </span>

        <div class="note-actions">
          <button class="icon-btn ${note.favorite ? "fav" : ""}"
            data-action="favorite"
            data-id="${note.id}"
            title="Favorit">
            ${note.favorite ? "★" : "☆"}
          </button>

          <button class="icon-btn"
            data-action="edit"
            data-id="${note.id}"
            title="Edit">✎</button>

          <button class="icon-btn"
            data-action="delete"
            data-id="${note.id}"
            title="Hapus">×</button>
        </div>
      </div>

      <h3>${escapeHTML(note.title)}</h3>

      <p class="note-desc">
        ${escapeHTML(note.description || "Tidak ada deskripsi.")}
      </p>

      <div class="code-preview">
        <pre>${escapeHTML(note.code)}</pre>
      </div>

      <div class="note-bottom">
        <span class="note-date">
          ${formatDate(note.updatedAt)}
        </span>

        <button class="copy-btn"
          data-action="copy"
          data-id="${note.id}">
          ▣ Copy Code
        </button>
      </div>
    </article>
  `).join("");

  $("emptyState").classList.toggle(
    "show",
    filtered.length === 0
  );

  grid.style.display = filtered.length ? "grid" : "none";

  $("totalCount").textContent = notes.length;
  $("statTotal").textContent = notes.length;
  $("statFav").textContent =
    notes.filter(note => note.favorite).length;

  $("statCategories").textContent =
    new Set(notes.map(note => note.category)).size;
}

// OPEN MODAL
function openModal(note = null) {
  form.reset();

  $("noteId").value = note ? note.id : "";
  $("modalTitle").textContent =
    note ? "Edit Note" : "New Note";

  $("noteTitle").value = note?.title || "";
  $("noteDescription").value =
    note?.description || "";
  $("noteCategory").value =
    note?.category || "HTML";
  $("noteCode").value = note?.code || "";

  updateEditorLanguage();

  modal.classList.add("show");
  $("noteTitle").focus();
}

function closeModal() {
  modal.classList.remove("show");
}

function updateEditorLanguage() {
  $("editorLanguage").textContent =
    $("noteCategory").value;
}

// SAVE NOTES TO SUPABASE
form.addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("noteId").value;
  const oldNote = notes.find(note => note.id === id);

  const note = {
    title: $("noteTitle").value.trim(),
    description: $("noteDescription").value.trim(),
    category: $("noteCategory").value,
    code: $("noteCode").value,
    favorite: oldNote?.favorite || false,
    updated_at: new Date().toISOString()
  };

  if (!note.title || !note.code.trim()) {
    showToast("Judul dan kode wajib diisi!");
    return;
  }

  const saveButton = form.querySelector(
    'button[type="submit"]'
  );

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    let result;

    if (id) {
      result = await supabaseClient
        .from("code_notes")
        .update(note)
        .eq("id", id);
    } else {
      delete note.updated_at;

      result = await supabaseClient
        .from("code_notes")
        .insert([note]);
    }

    if (result.error) throw result.error;

    closeModal();
    showToast(
      id
        ? "Catatan berhasil diperbarui!"
        : "Catatan berhasil disimpan!"
    );

    await loadNotes();

  } catch (error) {
    console.error(error);
    showToast("Gagal menyimpan: " + error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = 'Save Note <span>↗</span>';
  }
});

// BUTTONS
$("addBtn").addEventListener("click", () => openModal());

$("emptyAddBtn").addEventListener("click", () => openModal());

$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    $("searchInput").focus();
  }
});

$("noteCategory").addEventListener(
  "change",
  updateEditorLanguage
);

// SEARCH
$("searchInput").addEventListener("input", event => {
  searchQuery = event.target.value.toLowerCase().trim();
  renderNotes();
});

// SORT
$("sortSelect").addEventListener("change", renderNotes);

// CATEGORY FILTER
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
        ? "Catatan favorit lo."
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

// CARD ACTIONS
grid.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const note = notes.find(item => item.id === id);

  if (!note) return;

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(note.code);
      showToast("Kode berhasil disalin!");
    } catch {
      showToast("Gagal menyalin kode.");
    }
  }

  if (action === "edit") {
    openModal(note);
  }

  if (action === "delete") {
    if (!confirm(`Hapus catatan "${note.title}"?`)) {
      return;
    }

    button.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("code_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      showToast("Catatan berhasil dihapus!");
      await loadNotes();

    } catch (error) {
      console.error(error);
      showToast("Gagal menghapus: " + error.message);
      button.disabled = false;
    }
  }

  if (action === "favorite") {
    button.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("code_notes")
        .update({
          favorite: !note.favorite,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      await loadNotes();
      showToast("Favorit berhasil diperbarui!");

    } catch (error) {
      console.error(error);
      showToast("Gagal memperbarui favorit.");
      button.disabled = false;
    }
  }
});

// MOBILE SIDEBAR
$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// INITIALIZE
loadNotes();
