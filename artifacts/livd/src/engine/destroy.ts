import gsap from "gsap";

// ─── Split an element's text into per-character spans ────────────────────────
export function splitToChars(el: Element): HTMLSpanElement[] {
  const children = Array.from(el.childNodes);
  const spans: HTMLSpanElement[] = [];

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
      if (!el.isConnected) { resolve(); return; }
      el.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 5}px)`;
      if (Date.now() - start < duration * 1000) requestAnimationFrame(tick);
      else { el.style.transform = ""; resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

// ─── Destroy: Navigation ──────────────────────────────────────────────────────
export async function destroyNav(): Promise<void> {
  const nav = document.getElementById("site-nav");
  if (!nav) return;

  // Red tinge the nav border
  (nav as HTMLElement).style.borderBottomColor = "rgba(139,0,0,0.5)";

  const links = nav.querySelectorAll(".nav-links a, .nav-logo, .center-links a");
  const allChars: HTMLSpanElement[] = [];
  links.forEach((link) => {
    const chars = splitToChars(link);
    allChars.push(...chars);
  });

  // Fly upward — slower, more dramatic
  await new Promise<void>((resolve) => {
    gsap.to(allChars, {
      y: () => -(80 + Math.random() * 120),
      x: () => (Math.random() - 0.5) * 80,
      rotation: () => (Math.random() - 0.5) * 50,
      opacity: 0,
      duration: 1.6,
      stagger: 0.028,
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
      duration: 0.55,
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

  // Longer glitch
  await glitchEl(heroContent as HTMLElement, 0.55);

  // Split title into chars, fall with gravity — give time to read the tagline
  const titleEl = document.getElementById("hero-title");
  if (titleEl) {
    const titleChars = splitToChars(titleEl);
    await new Promise<void>((resolve) => {
      gsap.to(titleChars, {
        y: () => 100 + Math.random() * 200,
        x: () => (Math.random() - 0.5) * 60,
        rotation: () => (Math.random() - 0.5) * 30,
        opacity: 0,
        duration: 2.2,
        stagger: { each: 0.045, from: "random" },
        ease: "power2.in",
        onComplete: resolve,
      });
    });
  }

  // Sub text dissolves — slow enough to half-read
  const subEl = document.getElementById("hero-sub");
  const cueEl = document.getElementById("hero-scroll-cue");
  await new Promise<void>((resolve) => {
    if (subEl) gsap.to(subEl, { opacity: 0, y: 40, filter: "blur(12px)", duration: 1.4, ease: "power2.out" });
    if (cueEl) gsap.to(cueEl, { opacity: 0, duration: 0.6 });
    setTimeout(resolve, 1600);
  });

  // Collapse hero
  await new Promise<void>((resolve) => {
    gsap.to(hero, {
      height: 0,
      opacity: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.8,
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

  // Glitch the container — long enough to notice something is wrong
  await glitchEl(el as HTMLElement, 0.42);

  // Break headings — characters scatter in opposite directions per section
  headings.forEach((h) => {
    const chars = splitToChars(h);
    gsap.to(chars, {
      y: () => index % 2 === 0 ? -(50 + Math.random() * 110) : (50 + Math.random() * 110),
      x: () => (Math.random() - 0.5) * 120,
      rotation: () => (Math.random() - 0.5) * 45,
      opacity: 0,
      duration: 1.9,
      stagger: { each: 0.038, from: "end" },
      ease: "power2.in",
    });
  });

  // Long pause — let the reader catch the heading disappearing
  await new Promise<void>((resolve) => setTimeout(resolve, 650));

  // Bodies fade — slow enough to half-read the paragraph
  const bodyAnim = Promise.all(
    Array.from(bodies).map((b) =>
      new Promise<void>((res) => {
        gsap.to(b, {
          opacity: 0,
          y: 28,
          filter: "blur(8px)",
          duration: 1.5,
          ease: "power1.out",
          onComplete: res,
        });
      }),
    ),
  );

  gsap.to(Array.from(tags), { opacity: 0, duration: 0.5, stagger: 0.06 });

  await bodyAnim;

  // Collapse section
  await new Promise<void>((resolve) => {
    gsap.to(el, {
      height: 0,
      opacity: 0,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.65,
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

  const allText = footer.querySelectorAll(".footer-brand, .footer-tagline, .footer-credit, .footer-seed, .footer-end");
  await new Promise<void>((resolve) => {
    gsap.to(Array.from(allText), {
      opacity: 0,
      y: 40,
      stagger: 0.14,
      duration: 1.6,
      ease: "power1.out",
    });
    gsap.to(footer, {
      opacity: 0,
      duration: 2.8,
      delay: 0.6,
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
  await delay(1000);

  // Hero
  onSectionDead("hero");
  await destroyHero();
  await delay(1200);

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
    await delay(900);
  }

  // Footer (slowest — the last breath)
  onSectionDead("footer");
  await destroyFooter();
  await delay(700);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
