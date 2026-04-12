class BookingApp {
  constructor() {
    // Elements
    this.statusBox = document.getElementById("bookingStatus");
    this.form = document.getElementById("bookingForm");
    this.provider = document.getElementById("provider");
    this.providerError = document.getElementById("providerError"); // optional if you add span
    this.timestampInput = this.form?.querySelector(
      "[data-submission-timestamp]",
    );

    this.service = document.getElementById("bService");
    this.date = document.getElementById("bDate"); // now type="text" readonly
    this.time = document.getElementById("bTime");

    this.name = document.getElementById("bName");
    this.email = document.getElementById("bEmail");
    this.phone = document.getElementById("bPhone");
    this.notes = document.getElementById("bNotes");

    this.list = document.getElementById("bookingList");
    this.clearAllBtn = document.getElementById("clearAll");

    function validateBookingForm(form) {
      const requiredFields = [
        "#provider",
        "#bService",
        "#bDate",
        "#bTime",
        "#bName",
        "#bEmail",
      ];

      let valid = true;

      requiredFields.forEach((selector) => {
        const field = form.querySelector(selector);
        if (!field || !field.value.trim()) {
          valid = false;
          field.setAttribute("aria-invalid", "true");
        } else {
          field.removeAttribute("aria-invalid");
        }
      });

      // Email validity
      const email = form.querySelector("#bEmail");
      if (email && !email.checkValidity()) {
        valid = false;
        email.setAttribute("aria-invalid", "true");
      }

      return valid;
    }

    // Errors
    this.serviceError = document.getElementById("bServiceError");
    this.dateError = document.getElementById("bDateError");
    this.timeError = document.getElementById("bTimeError");
    this.nameError = document.getElementById("bNameError");
    this.emailError = document.getElementById("bEmailError");
    this.phoneError = document.getElementById("bPhoneError");

    // Calendar UI
    this.calTitle = document.getElementById("calTitle");
    this.calGrid = document.getElementById("calGrid");
    this.calPrev = document.getElementById("calPrev");
    this.calNext = document.getElementById("calNext");

    // Confirmation modal
    this.confirmOverlay = document.getElementById("confirmOverlay");
    this.confirmModal = document.getElementById("confirmModal");
    this.confirmSummary = document.getElementById("confirmSummary");
    this.confirmCancel = document.getElementById("confirmCancel");
    this.confirmSubmit = document.getElementById("confirmSubmit");

    // Storage keys (match admin.js)
    this.storageKey = "forethought_bookings";
    this.providerKey = "forethought_providers";

    // State
    this.bookings = this.loadBookings();
    this.pendingBooking = null;

    const today = new Date();
    this.viewYear = today.getFullYear();
    this.viewMonth = today.getMonth(); // 0-11

    // Min date (string) for text input model
    this.minDateStr = this.yyyyMmDd(today);

    // Ensure calendar nav buttons never submit the form
    if (this.calPrev) this.calPrev.type = "button";
    if (this.calNext) this.calNext.type = "button";

    // Init: render calendar immediately
    this.renderCalendar();
    this.renderBookingList();

    // Events
    this.service?.addEventListener("change", () => this.renderCalendar());

    // Date is readonly now; calendar controls it. But if you remove readonly later,
    // this keeps the calendar in sync.
    this.date?.addEventListener("change", () => {
      this.syncViewToSelectedDate();
      this.renderCalendar();
    });

    this.form?.addEventListener("submit", (e) => this.onSubmit(e));
    this.clearAllBtn?.addEventListener("click", () => this.clearAll());

    this.calPrev?.addEventListener("click", () => this.shiftMonth(-1));
    this.calNext?.addEventListener("click", () => this.shiftMonth(1));

    this.confirmCancel?.addEventListener("click", () => this.closeConfirm());
    this.confirmOverlay?.addEventListener("click", () => this.closeConfirm());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.confirmModal && !this.confirmModal.hidden)
        this.closeConfirm();
    });
    this.confirmSubmit?.addEventListener("click", () => this.commitBooking());
  }

  // ---------- Storage ----------
  loadBookings() {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }
  saveBookings(bookings) {
    localStorage.setItem(this.storageKey, JSON.stringify(bookings));
  }
  loadProviders() {
    const raw = localStorage.getItem(this.providerKey);
    return raw ? JSON.parse(raw) : [];
  }

  // ---------- Helpers ----------
  setStatus(type, msg) {
    if (!this.statusBox) return;
    this.statusBox.className = `form-status ${type}`;
    this.statusBox.textContent = msg;
    this.statusBox.style.display = "block";
  }
  clearStatus() {
    if (!this.statusBox) return;
    this.statusBox.className = "form-status";
    this.statusBox.textContent = "";
    this.statusBox.style.display = "none";
  }
  setError(el, errEl, msg) {
    if (!el || !errEl) return;
    el.classList.add("invalid");
    errEl.textContent = msg;
  }
  clearError(el, errEl) {
    if (!el || !errEl) return;
    el.classList.remove("invalid");
    errEl.textContent = "";
  }

  yyyyMmDd(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  syncViewToSelectedDate() {
    if (!this.date?.value) return;
    const [y, m] = this.date.value.split("-").map(Number);
    if (y && m) {
      this.viewYear = y;
      this.viewMonth = m - 1;
    }
  }

  // ---------- Double booking + provider capacity ----------
  // If providers exist: enforce capacity per provider at exact start time.
  // If none: disallow any duplicate at same date+time.

  isTimeTakenGlobally(dateStr, timeStr) {
    return this.bookings.some(
      (b) =>
        (b.status ?? "active") === "active" &&
        b.date === dateStr &&
        b.time === timeStr,
    );
  }

  countProviderAt(providerId, dateStr, timeStr) {
    return this.bookings.filter(
      (b) =>
        (b.status ?? "active") === "active" &&
        b.date === dateStr &&
        b.time === timeStr &&
        String(b.providerId) === String(providerId),
    ).length;
  }

  providerHasCapacity(provider, dateStr, timeStr) {
    return (
      this.countProviderAt(provider.id, dateStr, timeStr) < provider.capacity
    );
  }

  assignProvider(service, dateStr, timeStr) {
    const providers = this.loadProviders().filter(
      (p) => Array.isArray(p.services) && p.services.includes(service),
    );
    if (!providers.length) return null;

    const available = providers.filter((p) =>
      this.providerHasCapacity(p, dateStr, timeStr),
    );
    if (!available.length) return null;

    // least-loaded at that start time
    available.sort(
      (a, b) =>
        this.countProviderAt(a.id, dateStr, timeStr) -
        this.countProviderAt(b.id, dateStr, timeStr),
    );

    return available[0];
  }

  // ---------- Calendar ----------
  shiftMonth(delta) {
    const d = new Date(this.viewYear, this.viewMonth + delta, 1);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();
    this.renderCalendar();
  }

  renderCalendar() {
    if (!this.calTitle || !this.calGrid) return;

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Month + Year (this is what you want below the date field)
    this.calTitle.textContent = `${monthNames[this.viewMonth]} ${this.viewYear}`;

    const first = new Date(this.viewYear, this.viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(
      this.viewYear,
      this.viewMonth + 1,
      0,
    ).getDate();

    const selectedDate = this.date?.value || "";

    this.calGrid.innerHTML = "";

    // Leading blanks
    for (let i = 0; i < startDay; i++) {
      const cell = document.createElement("div");
      cell.className = "cal-cell cal-empty";
      this.calGrid.appendChild(cell);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(this.viewYear, this.viewMonth, day);
      const dateStr = this.yyyyMmDd(d);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-cell cal-day";
      btn.textContent = String(day);

      // Disable past days (based on minDateStr)
      if (dateStr < this.minDateStr) {
        btn.disabled = true;
        btn.classList.add("cal-disabled");
      }

      // Mark booked days (any booking on that date)
      if (
        this.bookings.some(
          (b) => (b.status ?? "active") === "active" && b.date === dateStr,
        )
      ) {
        btn.classList.add("cal-booked");
      }

      // Selected day highlight
      if (selectedDate === dateStr) {
        btn.classList.add("cal-selected");
      }

      // Click selects date & updates the Date field
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        this.date.value = dateStr; // ✅ sets the date under the calendar
        this.renderCalendar(); // ✅ refresh highlight
        this.time?.focus?.(); // nice UX
      });

      this.calGrid.appendChild(btn);
    }
  }

  // ---------- Validation ----------
  validateProvider() {
    const v = (this.provider?.value || "").trim();
    if (!v) {
      if (this.providerError)
        this.providerError.textContent = "Please choose a provider.";
      this.provider?.classList?.add("invalid");
      return false;
    }
    if (this.providerError) this.providerError.textContent = "";
    this.provider?.classList?.remove("invalid");
    return true;
  }
  validateService() {
    if (!this.service?.value) {
      this.setError(
        this.service,
        this.serviceError,
        "Please choose a service.",
      );
      return false;
    }
    this.clearError(this.service, this.serviceError);
    return true;
  }

  validateDate() {
    const v = (this.date?.value || "").trim();
    if (!v) {
      this.setError(this.date, this.dateError, "Please choose a date.");
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      this.setError(this.date, this.dateError, "Date must be YYYY-MM-DD.");
      return false;
    }
    if (v < this.minDateStr) {
      this.setError(this.date, this.dateError, "Please choose a future date.");
      return false;
    }
    this.clearError(this.date, this.dateError);
    return true;
  }

  validateTime() {
    const v = (this.time?.value || "").trim();
    if (!v) {
      this.timeError.textContent = "Please select a start time.";
      return false;
    }
    if (!/^\d{2}:\d{2}$/.test(v)) {
      this.timeError.textContent = "Please enter a valid time (HH:MM).";
      return false;
    }
    this.timeError.textContent = "";
    return true;
  }

  validateName() {
    const v = (this.name?.value || "").trim();
    if (v.length < 2) {
      this.setError(
        this.name,
        this.nameError,
        "Please enter your name (2+ characters).",
      );
      return false;
    }
    this.clearError(this.name, this.nameError);
    return true;
  }

  validateEmail() {
    const v = (this.email?.value || "").trim();
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(v)) {
      this.setError(this.email, this.emailError, "Please enter a valid email.");
      return false;
    }
    this.clearError(this.email, this.emailError);
    return true;
  }

  validatePhone() {
    const v = (this.phone?.value || "").trim();
    if (v === "") {
      this.clearError(this.phone, this.phoneError);
      return true;
    }
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10) {
      this.setError(
        this.phone,
        this.phoneError,
        "Please enter a valid phone number (10+ digits).",
      );
      return false;
    }
    this.clearError(this.phone, this.phoneError);
    return true;
  }

  // ---------- Submit / confirm ----------
  onSubmit(e) {
    e.preventDefault();
    this.clearStatus();

    const ok =
      this.validateProvider() &&
      this.validateService() &&
      this.validateDate() &&
      this.validateTime() &&
      this.validateName() &&
      this.validateEmail() &&
      this.validatePhone();

    if (!ok) {
      this.setStatus(
        "fail",
        "Please fix the highlighted fields and try again.",
      );
      return;
    }

    // reload latest to prevent double-book in multi-tab
    this.bookings = this.loadBookings();

    const service = this.service.value;
    const dateStr = this.date.value;
    const timeStr = this.time.value;

    const providers = this.loadProviders();
    let provider = null;

    if (providers.length > 0) {
      provider = this.assignProvider(service, dateStr, timeStr);
      if (!provider) {
        this.setStatus(
          "fail",
          "No providers are available at that time. Please choose another start time.",
        );
        return;
      }
    } else {
      if (this.isTimeTakenGlobally(dateStr, timeStr)) {
        this.setStatus(
          "fail",
          "That time was just booked. Please choose another start time.",
        );
        return;
      }
    }

    this.pendingBooking = {
      service,
      date: dateStr,
      time: timeStr,
      name: this.name.value.trim(),
      email: this.email.value.trim(),
      phone: this.phone.value.trim(),
      notes: this.notes.value.trim(),
      providerId: provider ? provider.id : null,
    };

    this.openConfirm(this.pendingBooking);
  }

  openConfirm(preview) {
    if (!this.confirmSummary || !this.confirmOverlay || !this.confirmModal)
      return;

    this.confirmSummary.innerHTML = `
      <p><strong>Service:</strong> ${preview.service}</p>
      <p><strong>Date:</strong> ${preview.date}</p>
      <p><strong>Start time:</strong> ${preview.time}</p>
      <hr />
      <p><strong>Name:</strong> ${preview.name}</p>
      <p><strong>Email:</strong> ${preview.email}</p>
      ${preview.phone ? `<p><strong>Phone:</strong> ${preview.phone}</p>` : ""}
      ${preview.notes ? `<p><strong>Notes:</strong> ${preview.notes}</p>` : ""}
    `;

    this.confirmOverlay.hidden = false;
    this.confirmModal.hidden = false;
    if (this.confirmSubmit) this.confirmSubmit.disabled = false;
    this.confirmSubmit?.focus?.();
  }

  closeConfirm() {
    if (this.confirmOverlay) this.confirmOverlay.hidden = true;
    if (this.confirmModal) this.confirmModal.hidden = true;
    this.pendingBooking = null;
  }

  async commitBooking() {
    if (!this.pendingBooking) return;
    if (this.confirmSubmit) this.confirmSubmit.disabled = true;

    // reload latest again for safety
    this.bookings = this.loadBookings();

    const p = this.pendingBooking;

    // re-check availability at commit
    const providers = this.loadProviders();
    let providerId = p.providerId;

    if (providers.length > 0) {
      const provider = this.assignProvider(p.service, p.date, p.time);
      if (!provider) {
        this.closeConfirm();
        this.setStatus(
          "fail",
          "That time is no longer available. Please choose another.",
        );
        if (this.confirmSubmit) this.confirmSubmit.disabled = false;
        return;
      }
      providerId = provider.id;
    } else {
      if (this.isTimeTakenGlobally(p.date, p.time)) {
        this.closeConfirm();
        this.setStatus(
          "fail",
          "That time was just booked. Please choose another.",
        );
        if (this.confirmSubmit) this.confirmSubmit.disabled = false;
        return;
      }
    }

    const booking = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      service: p.service,
      date: p.date,
      time: p.time,
      durationMin: null,
      endTime: null,
      name: p.name,
      email: p.email,
      phone: p.phone,
      notes: p.notes,
      createdAt: new Date().toISOString(),
      status: "active",
      providerId: providerId ?? null,
    };

    this.bookings.push(booking);
    this.saveBookings(this.bookings);

    this.closeConfirm();
    this.setStatus(
      "success",
      `Booked! ${booking.service} on ${booking.date} at ${booking.time}. Submitting…`,
    );

    try {
      await this.submitToNetlify();
      window.location.href = "success.html";
      return;
    } catch (err) {
      this.setStatus(
        "fail",
        "Your booking was saved on this device, but we couldn’t submit it right now. Please try again or contact us.",
      );
      if (this.confirmSubmit) this.confirmSubmit.disabled = false;
    }

    // If submission fails, keep your existing UI reset behavior (optional):
    this.form.reset();
    this.date.value = "";
    this.renderCalendar();
    this.renderBookingList();
  }

  // ---------- Booking list ----------
  renderBookingList() {
    if (!this.list) return;

    this.bookings = this.loadBookings();

    if (!this.bookings.length) {
      this.list.innerHTML = `<p class="subtext">No bookings yet.</p>`;
      return;
    }

    const providers = this.loadProviders();
    const providerName = (id) =>
      providers.find((p) => String(p.id) === String(id))?.name || "";

    const sorted = [...this.bookings].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
    );

    this.list.innerHTML = sorted
      .map(
        (b) => `
      <div class="booking-item">
        <strong>${b.service}</strong>
        <div>${b.date} at ${b.time}</div>
        ${b.providerId ? `<div><em>Provider:</em> ${providerName(b.providerId)}</div>` : ""}
        <div>${b.name} • ${b.email}${b.phone ? " • " + b.phone : ""}</div>
        ${b.notes ? `<div><em>Notes:</em> ${b.notes}</div>` : ""}
        <button type="button" class="btn btn-secondary" data-cancel="${b.id}">Cancel</button>
      </div>
    `,
      )
      .join("");

    this.list.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.cancelBooking(btn.dataset.cancel),
      );
    });
  }

  cancelBooking(id) {
    this.bookings = this.loadBookings().filter(
      (b) => String(b.id) !== String(id),
    );
    this.saveBookings(this.bookings);
    this.renderCalendar();
    this.renderBookingList();
    this.setStatus("success", "Booking canceled.");
  }

  clearAll() {
    this.bookings = [];
    this.saveBookings(this.bookings);
    this.renderCalendar();
    this.renderBookingList();
    this.setStatus("success", "All bookings cleared.");
  }

  encodeFormData(formData) {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) params.append(key, value);
    return params.toString();
  }

  async submitToNetlify() {
    if (!this.form) return;

    // Set timestamp right before submission (booking page uses booking.js, not main.js)
    if (this.timestampInput)
      this.timestampInput.value = new Date().toISOString();

    const formData = new FormData(this.form);
    if (!formData.has("form-name")) formData.append("form-name", "booking");

    const body = this.encodeFormData(formData);

    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) throw new Error("Netlify submission failed");
  }
}

new BookingApp();
