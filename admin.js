const STORAGE_KEY = "forethought_bookings";
const PROVIDER_KEY = "forethought_providers";

const ADMIN_KEY = "PROVIDER-SECRET-123"; // demo only
const adminPanel = document.getElementById("adminPanel");
const loginBtn = document.getElementById("loginBtn");
const providerKeyInput = document.getElementById("providerKey");
const loginStatus = document.getElementById("loginStatus");

// Check existing session
if (sessionStorage.getItem("isProvider") === "true") {
  adminPanel.hidden = false;
}

loginBtn.addEventListener("click", () => {
  if (providerKeyInput.value === ADMIN_KEY) {
    sessionStorage.setItem("isProvider", "true");
    adminPanel.hidden = false;
    loginStatus.textContent = "✅ Provider access granted";
    loginStatus.className = "status ok";
  } else {
    loginStatus.textContent = "❌ Invalid access key";
    loginStatus.className = "status bad";
  }
});

// Elements
const tbody = document.getElementById("adminTbody");
const filterDate = document.getElementById("adminFilterDate");
const clearFilterBtn = document.getElementById("adminClearFilter");
const exportBtn = document.getElementById("adminExport");
const exportCsvBtn = document.getElementById("adminExportCsv");
const clearAllBtn = document.getElementById("adminClearAll");
const statusBox = document.getElementById("adminStatus");

// Provider UI
const providerForm = document.getElementById("providerForm");
const providerList = document.getElementById("providerList");

// ---------- Helpers ----------
function setStatus(type, msg) {
  if (!statusBox) return;
  statusBox.className = `form-status ${type}`;
  statusBox.textContent = msg;
  statusBox.style.display = "block";
}

function safe(v) {
  return v === undefined || v === null ? "" : String(v);
}

// ---------- Storage ----------
function loadBookings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveBookings(b) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

function loadProviders() {
  const raw = localStorage.getItem(PROVIDER_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveProviders(p) {
  localStorage.setItem(PROVIDER_KEY, JSON.stringify(p));
}

function providerNameById(id) {
  if (!id) return "";
  return loadProviders().find((p) => String(p.id) === String(id))?.name || "";
}

// ---------- CSV helpers ----------
function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Render bookings ----------
function render() {
  if (!tbody) return;

  const bookings = loadBookings();
  const fd = filterDate?.value || "";
  const visible = fd ? bookings.filter((b) => b.date === fd) : bookings;

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="9">No bookings found.</td></tr>`;
    return;
  }

  const sorted = [...visible].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
  );

  tbody.innerHTML = sorted
    .map(
      (b) => `
    <tr>
      <td>${safe(b.date)}</td>
      <td>${safe(b.time)}</td>
      <td>${safe(b.service)}</td>
      <td>${safe(providerNameById(b.providerId))}</td>
      <td>${safe(b.name)}</td>
      <td>${safe(b.email)}</td>
      <td>${safe(b.phone)}</td>
      <td>${safe(b.notes)}</td>
      <td>
        <button class="btn btn-secondary" data-del="${safe(b.id)}">Delete</button>
      </td>
    </tr>
  `,
    )
    .join("");

  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.del;
      saveBookings(loadBookings().filter((b) => String(b.id) !== String(id)));
      setStatus("success", "Booking deleted.");
      render();
    });
  });
}

// ---------- Events ----------
filterDate?.addEventListener("change", render);

clearFilterBtn?.addEventListener("click", () => {
  filterDate.value = "";
  render();
});

exportBtn?.addEventListener("click", () => {
  downloadFile(
    "bookings-export.json",
    JSON.stringify(loadBookings(), null, 2),
    "application/json;charset=utf-8;",
  );
  setStatus("success", "Exported bookings-export.json");
});

exportCsvBtn?.addEventListener("click", () => {
  const bookings = loadBookings();
  const headers = [
    "date",
    "time",
    "service",
    "providerName",
    "providerId",
    "name",
    "email",
    "phone",
    "notes",
    "status",
    "createdAt",
    "id",
  ];
  const lines = [headers.join(",")];

  bookings.forEach((b) => {
    lines.push(
      [
        b.date,
        b.time,
        b.service,
        providerNameById(b.providerId),
        b.providerId,
        b.name,
        b.email,
        b.phone,
        b.notes,
        b.status,
        b.createdAt,
        b.id,
      ]
        .map(csvEscape)
        .join(","),
    );
  });

  downloadFile(
    "bookings-export.csv",
    lines.join("\n"),
    "text/csv;charset=utf-8;",
  );
  setStatus("success", "Exported bookings-export.csv");
});

clearAllBtn?.addEventListener("click", () => {
  saveBookings([]);
  setStatus("success", "All bookings cleared.");
  render();
});

// ---------- Provider manager ----------
providerForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = providerName.value.trim();
  const capacity = parseInt(providerCapacity.value, 10);
  const services = providerServices.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name || !services.length || capacity < 1) {
    setStatus("fail", "Please enter provider name, capacity, and services.");
    return;
  }

  const providers = loadProviders();
  providers.push({
    id: crypto.randomUUID(),
    name,
    capacity,
    services,
  });
  saveProviders(providers);
  providerForm.reset();
  renderProviders();
  setStatus("success", "Provider added.");
});

function renderProviders() {
  if (!providerList) return;
  const providers = loadProviders();

  if (!providers.length) {
    providerList.innerHTML = "<p class='subtext'>No providers yet.</p>";
    return;
  }

  providerList.innerHTML = providers
    .map(
      (p) => `
    <div class="booking-item">
      <strong>${safe(p.name)}</strong>
      <div>Capacity: ${p.capacity}</div>
      <div>Services: ${p.services.join(", ")}</div>
      <button class="btn btn-secondary" data-del-provider="${p.id}">Delete</button>
    </div>
  `,
    )
    .join("");

  providerList.querySelectorAll("[data-del-provider]").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveProviders(
        loadProviders().filter((p) => String(p.id) !== btn.dataset.delProvider),
      );
      renderProviders();
      render();
      setStatus("success", "Provider deleted.");
    });
  });
}

// Init
render();
renderProviders();
