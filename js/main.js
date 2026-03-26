/* =========================================================
   Forethought main.js — small, dependency-free site behavior
========================================================= */

(function () {
  /* =========================
     Mobile Menu Toggle
  ========================= */
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-site-nav]");

  if (toggle && nav) {
    const closeNav = () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });

    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });
  }

  /* =========================
     Tabs (Contact Page)
  ========================= */
  const tabButtons = document.querySelectorAll(".tab-btn[data-tab]");
  const tabPanels = document.querySelectorAll(".tab-panel[data-panel]");

  if (tabButtons.length && tabPanels.length) {
    const setActive = (name) => {
      tabButtons.forEach((btn) => {
        const active = btn.dataset.tab === name;
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.panel === name);
      });
    };

    tabButtons.forEach((btn) => btn.addEventListener("click", () => setActive(btn.dataset.tab)));
  }

  /* =========================
     Blog Filters
  ========================= */
  const filterButtons = document.querySelectorAll(".filter-btn[data-filter]");
  const posts = document.querySelectorAll("[data-post]");

  if (filterButtons.length && posts.length) {
    const apply = (filter) => {
      filterButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.filter === filter));

      posts.forEach((post) => {
        const tags = (post.getAttribute("data-post") || "").split(",").map((s) => s.trim());
        const show = filter === "all" || tags.includes(filter);
        post.style.display = show ? "" : "none";
      });
    };

    filterButtons.forEach((btn) => btn.addEventListener("click", () => apply(btn.dataset.filter)));
    apply("all");
  }

  /* =========================
     Basic Carousel (Outcomes)
  ========================= */
  document.querySelectorAll("[data-basic-carousel]").forEach((wrap) => {
    const items = Array.from(wrap.querySelectorAll("[data-carousel-item]"));
    const prev = wrap.querySelector("[data-carousel-prev]");
    const next = wrap.querySelector("[data-carousel-next]");
    if (!items.length || !prev || !next) return;

    let i = 0;
    const render = () => items.forEach((el, idx) => el.classList.toggle("is-active", idx === i));
    const go = (n) => { i = (n + items.length) % items.length; render(); };

    prev.addEventListener("click", () => go(i - 1));
    next.addEventListener("click", () => go(i + 1));
    render();
  });

  /* =========================
     Services Carousel (Home)
     - Pause button
     - Stops on hover/focus (recommended for auto-rotating)
  ========================= */
  document.querySelectorAll("[data-services-carousel]").forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
    const prevBtn = carousel.querySelector("[data-carousel-prev]");
    const nextBtn = carousel.querySelector("[data-carousel-next]");
    const dotsWrap = carousel.querySelector("[data-carousel-dots]");
    const toggleBtn = carousel.querySelector("[data-carousel-toggle]");
    const viewport = carousel.querySelector("[data-carousel-viewport]");

    if (!slides.length || !prevBtn || !nextBtn || !dotsWrap || !toggleBtn || !viewport) return;

    let index = 0;
    let timer = null;
    let isPaused = false;
    const INTERVAL = 6000;

    // Build dot buttons
    const dots = slides.map((_, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "services-carousel__dot";
      b.setAttribute("aria-label", `Go to slide ${idx + 1}`);
      b.addEventListener("click", () => goTo(idx, true));
      dotsWrap.appendChild(b);
      return b;
    });

    const render = () => {
      slides.forEach((s, i) => {
        const active = i === index;
        s.classList.toggle("is-active", active);
        s.setAttribute("aria-hidden", active ? "false" : "true");
      });
      dots.forEach((d, i) => d.setAttribute("aria-current", i === index ? "true" : "false"));
    };

    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const start = () => { if (!isPaused) timer = setInterval(() => goTo(index + 1, false), INTERVAL); };
    const restart = () => { stop(); start(); };

    const goTo = (i, userAction) => {
      index = (i + slides.length) % slides.length;
      render();
      if (userAction) restart();
    };

    prevBtn.addEventListener("click", () => goTo(index - 1, true));
    nextBtn.addEventListener("click", () => goTo(index + 1, true));

    toggleBtn.addEventListener("click", () => {
      isPaused = !isPaused;
      toggleBtn.textContent = isPaused ? "Play" : "Pause";
      toggleBtn.setAttribute("aria-pressed", isPaused ? "true" : "false");
      isPaused ? stop() : restart();
    });

    // Stop rotating on hover/focus
    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", () => start());
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", (e) => {
      if (!carousel.contains(e.relatedTarget) && !isPaused) start();
    });

    // Keyboard arrows
    carousel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1, true); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); goTo(index - 1, true); }
    });

    // Basic swipe
    let startX = null;
    viewport.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX), { passive: true });
    viewport.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 40) diff < 0 ? goTo(index + 1, true) : goTo(index - 1, true);
      startX = null;
    }, { passive: true });

    // Demo forms: prevent page reload (remove when wiring to CRM)
    document.querySelectorAll("[data-demo-form]").forEach((f) => {
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Demo form: replace form action with your CRM endpoint / automation.");
      });
    });

    render();
    start();
  });
})();

/* =========================
   Service enquiry helpers
========================= */
(function () {
  // Footer year
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Preselect service + set source page on embedded forms
  const forms = document.querySelectorAll("form[data-service-form]");
  if (!forms.length) return;

  forms.forEach((form) => {
    const select = form.querySelector('select[name="service_interest"]');
    const source = form.querySelector("[data-source-page]");
    const bodyDefault = document.body?.dataset?.serviceDefault;
    const formDefault = form.dataset.service;
    const desired = formDefault || bodyDefault || "";

    if (select && desired) {
      // Match option text
      const options = Array.from(select.options);
      const match = options.find((o) => (o.textContent || "").trim() === desired.trim());
      if (match) select.value = match.textContent.trim();
    }

    if (source) {
      source.value = window.location.pathname || "";
    }
  });
})();