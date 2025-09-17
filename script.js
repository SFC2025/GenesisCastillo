// === Config desde APP_CONFIG (versión mínima, sin WhatsApp) ===
const CFG = (typeof window !== "undefined" && window.APP_CONFIG) || {};
const SHEET_CSV = CFG.SHEET_CSV || "";
const CALENDLY_URL = CFG.CALENDLY_URL || "";
const PAYPAL_CLIENT_ID_SUB = CFG.PAYPAL?.CLIENT_ID_SUB || "";
const PAYPAL_CLIENT_ID_HB = CFG.PAYPAL?.CLIENT_ID_HB || "";
const PAYPAL_SUB_PLAN_ID = CFG.PAYPAL?.SUB_PLAN_ID || "";

// Helper para inyectar scripts externos
function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ==================== PayPal Subscription Button (dinámico) ====================
(async function renderSubscription(retries = 25) {
  const sel = "#paypal-button-container-P-6SV06465S5864740NNDAHZ6Y";
  if (!document.querySelector(sel)) return;

  if (!PAYPAL_CLIENT_ID_SUB || !PAYPAL_SUB_PLAN_ID) {
    console.warn("Falta CLIENT_ID_SUB o SUB_PLAN_ID en config.js");
    return;
  }

  const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
    PAYPAL_CLIENT_ID_SUB
  )}&components=buttons&vault=true&intent=subscription`;
  if (!window.paypalSUB) {
    try {
      await loadScript(sdkUrl, { "data-namespace": "paypalSUB" });
    } catch (e) {
      console.error("No se pudo cargar PayPal SUB SDK:", e);
      return;
    }
  }

  const ready = () => !!(window.paypalSUB && paypalSUB.Buttons);
  if (!ready()) {
    return retries > 0
      ? void setTimeout(() => renderSubscription(retries - 1), 200)
      : console.error("PayPal SUB no disponible");
  }

  paypalSUB
    .Buttons({
      style: {
        shape: "rect",
        color: "gold",
        layout: "vertical",
        label: "subscribe",
        tagline: false,
      },
      createSubscription: (_, actions) =>
        actions.subscription.create({ plan_id: PAYPAL_SUB_PLAN_ID }),
      onApprove: (data) => {
        location.href =
          "gracias.html?product=suscripcion&sub=" +
          encodeURIComponent(data.subscriptionID);
      },
    })
    .render(sel);
})();

// ==================== Utilidades ====================
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// Año footer (si no existe #year, no rompe)
const yearEl = $("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ==================== Menú responsive ====================
(() => {
  const nav = document.querySelector(".site-nav");
  const toggle = document.querySelector(".site-nav .nav-toggle");
  const list = document.querySelector("#nav-list");
  if (!nav || !toggle || !list) return;

  const onDoc = (e) => {
    // Si toque el botón o adentro de la lista, no cierro
    if (e.target.closest(".nav-toggle") || e.target.closest("#nav-list"))
      return;
    close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  const open = () => {
    nav.classList.add("open");
    list.classList.add("show");
    toggle.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDoc, { capture: true });
    document.addEventListener("touchstart", onDoc, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
  };

  const close = () => {
    nav.classList.remove("open");
    list.classList.remove("show");
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDoc, { capture: true });
    document.removeEventListener("touchstart", onDoc, { capture: true });
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", close);
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle.getAttribute("aria-expanded") === "true" ? close() : open();
  });

  // Cierra al tocar cualquier <a> del menú
  list.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });
})();

// ==================== Modales genéricos (contacto, sobre, etc.) ====================
(() => {
  const focusableSel = [
    "button",
    "[href]",
    "input",
    "select",
    "textarea",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  $$(".modal").forEach((modal) => {
    const id = "#" + modal.id;
    const openers = $$(
      `[data-open-modal][href="${id}"],
   [data-open-modal][data-target="${id}"],
   [data-open-modal][href="${id}-open"]`
    );

    const closers = $$("[data-close-modal], .modal-backdrop", modal);

    let lastFocused = null;

    const open = () => {
      lastFocused = document.activeElement;
      modal.setAttribute("aria-hidden", "false");
      const first = modal.querySelector(focusableSel);
      first && first.focus();
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
      modal.addEventListener("keydown", onCycle);
    };

    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      modal.removeEventListener("keydown", onCycle);
      lastFocused && lastFocused.focus();
    };

    const onKey = (e) => {
      if (e.key === "Escape") close();
    };

    const onCycle = (e) => {
      if (e.key !== "Tab") return;
      const f = $$(focusableSel, modal).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    openers.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      })
    );
    closers.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      })
    );
  });
})();

// ==================== Validación del formulario ===================
(() => {
  const form = $("#contact-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const email = (data.get("email") || "").toString().trim();
    const msg = (data.get("message") || "").toString().trim();
    let ok = true;

    // Validaciones simples
    if (!name) ok = false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ok = false;
    if (msg.length < 6) ok = false;

    if (!ok) {
      e.preventDefault();
      alert("Por favor, completa correctamente los campos requeridos.");
    }
  });
})();

// ==================== Carrusel (autoplay, loop infinito, accesible) ====================
(() => {
  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) return;

  const track = carousel.querySelector("[data-track]");
  const prevBtn = carousel.querySelector("[data-prev]");
  const nextBtn = carousel.querySelector("[data-next]");

  let slides = Array.from(track.querySelectorAll(".slide"));

  // Clones para loop
  const firstClone = slides[0].cloneNode(true);
  const lastClone = slides[slides.length - 1].cloneNode(true);
  track.appendChild(firstClone);
  track.insertBefore(lastClone, slides[0]);

  const realCount = slides.length; // cantidad real sin clones
  slides = Array.from(track.querySelectorAll(".slide")); // ahora con clones

  // --- medidas dinámicas (ANCHO REAL del slide + gap) ---
  let slideW = 0;
  let gapPx = 0;

  const measure = () => {
    const first = track.querySelector(".slide");
    if (!first) return;
    gapPx = parseFloat(getComputedStyle(track).gap || "0") || 0;
    slideW = first.getBoundingClientRect().width;
  };

  let index = 1; // empezamos en el primer real (por el clon izq)
  let isAnimating = false;
  let autoplayId = null;
  const AUTOPLAY_MS = 3000;

  const offsetX = () => -(index * (slideW + gapPx));

  const setPosition = (animate = true) => {
    track.style.transition = animate ? "transform 450ms ease" : "none";
    track.style.transform = `translate3d(${-(index * (slideW + gapPx))}px,0,0)`;
  };

  const onResize = () => {
    measure();
    setPosition(false);
  };
  window.addEventListener("resize", onResize);
  // Recalcular también cuando cambie el tamaño del track o carguen imágenes
  const ro = new ResizeObserver(() => {
    onResize();
  });
  ro.observe(track);

  // Re-medimos cuando cargue cada imagen (por si hay lazy)
  track.querySelectorAll("img").forEach((img) => {
    img.addEventListener("load", onResize, { once: true });
  });

  // Inicial
  measure();
  setPosition(false);

  const goTo = (i) => {
    if (isAnimating) return;
    isAnimating = true;
    index = i;
    setPosition(true);
  };
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);

  // salto suave al volver de los clones
  track.addEventListener("transitionend", (e) => {
    if (e.propertyName && e.propertyName !== "transform") return;

    let jumped = false;
    if (index === 0) {
      index = realCount; // último real
      jump();
      jumped = true;
    } else if (index === realCount + 1) {
      index = 1; // primero real
      jump();
      jumped = true;
    }

    isAnimating = false;

    // reiniciar autoplay después de cada paso (y después del jump)
    stop();
    start();

    function jump() {
      // 1) cortar transición y mover instantáneo
      track.style.transition = "none";
      track.style.transform = `translate3d(${-(
        index *
        (slideW + gapPx)
      )}px,0,0)`;

      // 2) forzar reflow
      void track.offsetWidth;

      // 3) doble RAF para asegurar el “fix”
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          track.style.transition = "transform 450ms ease";
        });
      });
    }
  });

  // Autoplay con pausa hover/focus
  const start = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stop();
    autoplayId = setInterval(next, AUTOPLAY_MS);
  };
  const stop = () => {
    if (autoplayId) clearInterval(autoplayId);
    autoplayId = null;
  };

  // Pausar SOLO al interactuar con controles o enfocar el track
  prevBtn.addEventListener("mouseenter", stop);
  nextBtn.addEventListener("mouseenter", stop);
  prevBtn.addEventListener("mouseleave", start);
  nextBtn.addEventListener("mouseleave", start);
  // (dejo focus para a11y)
  track.addEventListener("focusin", stop);
  track.addEventListener("focusout", start);

  // Al terminar de cargar TODO, re-medimos y arrancamos autoplay
  if (document.readyState === "complete") {
    onResize();
    start();
  } else {
    window.addEventListener("load", () => {
      onResize();
      start();
    });
  }
})();

// ==================== Accesos directos (ignora enlaces de modal) ====================
(() => {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    // No tocar si abre/cierra modales
    if (a.hasAttribute("data-open-modal") || a.hasAttribute("data-close-modal"))
      return;

    const id = a.getAttribute("href");
    if (id.length > 1) {
      const el = document.querySelector(id);
      // Evita scrollear hacia el contenedor del modal
      if (el && !el.classList.contains("modal")) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
})();

// ==================== PayPal Hosted Buttons (dinámico, todos los contenedores) ====================
(async function initPayPalHostedAll(retries = 25) {
  const containers = Array.from(
    document.querySelectorAll('[id^="paypal-container-"]')
  );
  if (!containers.length) return;

  if (!PAYPAL_CLIENT_ID_HB) {
    console.warn("Falta CLIENT_ID_HB en config.js para Hosted Buttons");
    return;
  }

  // Cargar SDK si no existe
  if (!window.paypalHB) {
    const hbUrl =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        PAYPAL_CLIENT_ID_HB
      )}` + `&components=hosted-buttons&currency=USD&disable-funding=venmo`;
    try {
      await loadScript(hbUrl, { "data-namespace": "paypalHB" });
    } catch (e) {
      console.error("No se pudo cargar PayPal HB SDK:", e);
      return;
    }
  }

  const ready = !!(window.paypalHB && paypalHB.HostedButtons);
  if (!ready) {
    return retries > 0
      ? void setTimeout(() => initPayPalHostedAll(retries - 1), 200)
      : console.warn("PayPal HB no disponible (SDK no cargado).");
  }

  // Render de cada contenedor según el sufijo del id
  for (const el of containers) {
    const hostedId = el.id.replace("paypal-container-", "");
    paypalHB
      .HostedButtons({ hostedButtonId: hostedId })
      .render(`#${el.id}`)
      .catch((err) => console.error(`PayPal HB render #${el.id} falló:`, err));
  }
})();

// Cerrar mini-nav menu al clickear fuera, al hacer click en un link, o con Escape en panel menu
document.addEventListener("click", (e) => {
  const header = document.querySelector(".site-header.compact");
  if (!header) return;
  const isOpen = header.classList.contains("is-open");
  const insideHeader = e.target.closest(".site-header.compact");
  if (isOpen && !insideHeader) header.classList.remove("is-open");
});

document.querySelector("#mini-nav")?.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    document.querySelector(".site-header.compact")?.classList.remove("is-open");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelector(".site-header.compact")?.classList.remove("is-open");
  }
});
