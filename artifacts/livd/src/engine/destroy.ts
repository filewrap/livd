import gsap from "gsap";

// ─── Split an element's text into per-character spans ────────────────────────
export function splitToChars(el: Element): HTMLSpanElement[] {
  const children = Array.from(el.childNodes);
  const spans: HTMLSpanElement[] = [];

  // Collect and replace text nodes with char spans
  children.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const frag = document.createDocumentFragment();
      text.split("").forEach((ch) => {
        const span = document.createElement("span");
        span.className = "split-char";
        span.textContent = ch;
        frag.appendChild(span);
        spans.push(span);
      });
      el.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Recurse into child elements
      const childSpans = splitToChars(node as Element);
      childSpans.forEach((s) => spans.push(s));
    }
  });

  return spans;
}

// ─── Glitch a span (rapid position flicker) ──────────────────────────────────
function glitchEl(el: HTMLElement, duration = 0.8): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    function tick() {
      const el2 = el as HTMLElement;
      if (!el2.isConnected) { resolve(); return; }
      el2.style.transform = `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 4}px)`;
      if (Date.now() - start < duration * 1000) requestAnimationFrame(tick);
      else { el2.style.transform = ""; resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

// ─── Destroy: Navigation ──────────────────────────────────────────────────────
export async function destroyNav(): Promise<void> {
  const nav = document.getElementById("site-nav");
  if (!nav) return;

  // Glitch border first
  (nav as HTMLElement).style.borderBottomColor = "rgba(139,0,0,0.4)";

  // Split nav links
  const links = nav.querySelectorAll(".nav-links a, .nav-logo");
  const allChars: HTMLSpanElement[] = [];
  links.forEach((link) => {
    const chars = splitToChars(link);
    allChars.push(...chars);
  });

  // Fly upward with stagger
  await new Promise<void>((resolve) => {
    gsap.to(allChars, {
      y: () => -(60 + Math.random() * 80),
      x: () => (Math.random() - 0.5) * 60,
      rotation: () => (Math.random() - 0.5) * 40,
      opacity: 0,
      duration: 0.9,
      stagger: 0.015,
      ease: "power3.in",
      onComplete: resolve,
    });
  });

  // Collapse nav height
  await new Promise<void>((resolve) => {
    gsap.to(nav, {
      height: 0,
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.4,
      ease: "power2.in",
      onComplete: resolve,
    });
  });

  (nav as HTMLElement).style.display = "none";
}

// ─── Destroy: Hero ────────────────────────────────────────────────────────────
export async function destroyHero(): Promise<void> {
  const hero = document.getElementById("site-hero");
  const heroContent = document.getElementById("hero-content");
  if (!hero || !heroContent) return;

  // Glitch the container briefly
  await glitchEl(heroContent as HTMLElement, 0.3);

  // Split title into chars, fall with gravity
  const titleEl = document.getElementById("hero-title");
  if (titleEl) {
    const titleChars = splitToChars(titleEl);
    await new Promise<void>((resolve) => {
      gsap.to(titleChars, {
        y: () => 80 + Math.random() * 160,
        x: () => (Math.random() - 0.5) * 40,
        rotation: () => (Math.random() - 0.5) * 25,
        opacity: 0,
        duration: 1.4,
        stagger: { each: 0.025, from: "random" },
        ease: "power2.in",
        onComplete: resolve,
      });
    });
  }

  // Sub text dissolves
  const subEl = document.getElementById("hero-sub");
  const cueEl = document.getElementById("hero-scroll-cue");
  await new Promise<void>((resolve) => {
    if (subEl) gsap.to(subEl, { opacity: 0, y: 30, filter: "blur(8px)", duration: 0.9, ease: "power2.out" });
    if (cueEl) gsap.to(cueEl, { opacity: 0, duration: 0.5 });
    setTimeout(resolve, 1000);
  });

  // Collapse hero
  await new Promise<void>((resolve) => {
    gsap.to(hero, {
      height: 0,
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.6,
      ease: "power2.in",
      onComplete: resolve,
    });
  });

  (hero as HTMLElement).style.display = "none";
}

// ─── Destroy: Section (generic) ──────────────────────────────────────────────
export async function destroySection(el: Element, index: number): Promise<void> {
  const headings = el.querySelectorAll("h2, .section-heading");
  const bodies = el.querySelectorAll(".section-body p, .quote-text, .section-num");
  const tags = el.querySelectorAll(".section-tag, .quote-source");

  // Glitch container
  await glitchEl(el as HTMLElement, 0.2);

  // Break headings — characters scatter
  headings.forEach((h) => {
    const chars = splitToChars(h);
    gsap.to(chars, {
      y: () => index % 2 === 0 ? -(40 + Math.random() * 80) : (40 + Math.random() * 80),
      x: () => (Math.random() - 0.5) * 80,
      rotation: () => (Math.random() - 0.5) * 30,
      opacity: 0,
      duration: 1.1,
      stagger: { each: 0.02, from: "end" },
      ease: "power2.in",
    });
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 400));

  // Bodies fade and blur
  const bodyAnim = Promise.all(
    Array.from(bodies).map((b) =>
      new Promise<void>((res) => {
        gsap.to(b, { opacity: 0, y: 20, filter: "blur(6px)", duration: 0.8, ease: "power1.out", onComplete: res });
      }),
    ),
  );

  // Tags fade
  gsap.to(Array.from(tags), { opacity: 0, duration: 0.4, stagger: 0.05 });

  await bodyAnim;

  // Collapse section
  await new Promise<void>((resolve) => {
    gsap.to(el, {
      height: 0,
      opacity: 0,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.55,
      ease: "power2.in",
      onComplete: resolve,
    });
  });
  (el as HTMLElement).style.display = "none";
}

// ─── Destroy: Footer ──────────────────────────────────────────────────────────
export async function destroyFooter(): Promise<void> {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  // Everything dissolves together, slowly
  const allText = footer.querySelectorAll(".footer-brand, .footer-tagline, .footer-credit, .footer-seed, .footer-end");
  await new Promise<void>((resolve) => {
    gsap.to(Array.from(allText), {
      opacity: 0,
      y: 30,
      stagger: 0.1,
      duration: 1.2,
      ease: "power1.out",
    });
    gsap.to(footer, {
      opacity: 0,
      duration: 2,
      delay: 0.5,
      ease: "power1.in",
      onComplete: resolve,
    });
  });
  (footer as HTMLElement).style.display = "none";
  const spacer = document.querySelector(".site-spacer") as HTMLElement;
  if (spacer) spacer.style.display = "none";
}

// ─── Full Destruction Sequence ────────────────────────────────────────────────
export async function runDestructionSequence(
  onSectionDead: (sectionName: string) => void,
): Promise<void> {

  // Nav dies first
  onSectionDead("nav");
  await destroyNav();
  await delay(400);

  // Hero
  onSectionDead("hero");
  await destroyHero();
  await delay(400);

  // Sections in order
  const sections = [
    { el: document.getElementById("section-observable"), name: "observable" },
    { el: document.getElementById("section-time"), name: "time" },
    { el: document.getElementById("site-quote"), name: "quote" },
    { el: document.getElementById("section-process"), name: "entropy" },
    { el: document.getElementById("section-pattern"), name: "pattern" },
  ];

  for (let i = 0; i < sections.length; i++) {
    const { el, name } = sections[i];
    if (!el) continue;
    onSectionDead(name);
    await destroySection(el, i);
    await delay(320);
  }

  // Footer (slowest — the last breath)
  onSectionDead("footer");
  await destroyFooter();
  await delay(600);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
