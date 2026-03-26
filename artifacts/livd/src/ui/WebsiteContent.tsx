import { useEffect, useRef } from "react";
import { state, bus, Events } from "../store/state";
import { ArrowDown, Zap, Clock, Infinity, Star } from "lucide-react";
import gsap from "gsap";

// ─── Center Nav Pill — hosts Island messages AND mobile icon nav ──────────────
function CenterPill() {
  const linksRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(false);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const offShow = bus.on(Events.NAV_MSG_SHOW, (text: string) => {
      if (shownRef.current) {
        // Update text in place if already shown
        if (msgRef.current) {
          gsap.to(msgRef.current, {
            opacity: 0, duration: 0.1, onComplete: () => {
              if (msgRef.current) {
                msgRef.current.textContent = text;
                gsap.to(msgRef.current, { opacity: 1, duration: 0.2 });
              }
            },
          });
        }
        return;
      }
      shownRef.current = true;
      if (msgRef.current) msgRef.current.textContent = text;
      const links = linksRef.current;
      const msgEl = msgRef.current;
      if (links) gsap.to(links, { opacity: 0, duration: 0.22 });
      if (msgEl) {
        msgEl.style.display = "block";
        gsap.fromTo(msgEl, { opacity: 0 }, { opacity: 1, duration: 0.28 });
      }
    });

    const offHide = bus.on(Events.NAV_MSG_HIDE, () => {
      if (!shownRef.current) return;
      shownRef.current = false;
      const links = linksRef.current;
      const msgEl = msgRef.current;
      if (msgEl) {
        gsap.to(msgEl, {
          opacity: 0, duration: 0.22, onComplete: () => {
            if (msgEl) { msgEl.style.display = "none"; msgEl.textContent = ""; }
          },
        });
      }
      if (links) gsap.to(links, { opacity: 1, duration: 0.32, delay: 0.15 });
      // Remove warning pulse when message hides
      pillRef.current?.classList.remove("warning-pulse");
    });

    return () => { offShow(); offHide(); };
  }, []);

  return (
    <div className="nav-pill nav-pill-center" id="nav-center-pill" ref={pillRef}>
      <div className="center-links" ref={linksRef}>

        {/* Desktop: full text links */}
        <div className="center-desktop-links">
          <a href="#section-observable">observable</a>
          <span className="nav-sep">·</span>
          <a href="#section-time">time</a>
          <span className="nav-sep">·</span>
          <a href="#section-process">entropy</a>
          <span className="nav-sep">·</span>
          <a href="#section-pattern">pattern</a>
        </div>

        {/* Mobile: icon links only */}
        <div className="center-mobile-links">
          <a href="#section-observable" title="observable">
            <Star size={12} strokeWidth={1.5} />
          </a>
          <span className="nav-sep">·</span>
          <a href="#section-time" title="time">
            <Clock size={12} strokeWidth={1.5} />
          </a>
          <span className="nav-sep">·</span>
          <a href="#section-process" title="entropy">
            <Zap size={12} strokeWidth={1.5} />
          </a>
          <span className="nav-sep">·</span>
          <a href="#section-pattern" title="pattern">
            <Infinity size={12} strokeWidth={1.5} />
          </a>
        </div>

      </div>
      <span className="center-msg" ref={msgRef} style={{ display: "none" }} />
    </div>
  );
}

export function WebsiteContent() {
  useEffect(() => {
    const el = document.getElementById("footer-seed-val");
    if (el) el.textContent = state.sessionSeed;
  }, []);

  return (
    <div id="website">

      {/* ── Navigation — 3 glass pills ──────────────────────────── */}
      <nav id="site-nav">
        <div className="nav-pill nav-pill-left">
          <a className="nav-logo" href="#">
            <span className="dot">·</span>livd
          </a>
        </div>

        <CenterPill />

        <div className="nav-pill nav-pill-right">
          <span className="nav-end-dot">·</span>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section id="site-hero">
        <div id="hero-content">
          <p className="hero-eyebrow">on entropy / 2026</p>
          <h1 className="hero-title" id="hero-title">
            everything<br />dissolves.
          </h1>
          <p className="hero-sub" id="hero-sub">
            And in dissolution, everything is found. You are made of stars
            that burned out before your sun existed. What you call yourself
            is a temporary arrangement of matter borrowing order from chaos.
          </p>
          <div className="hero-scroll-cue" id="hero-scroll-cue">
            <span className="hero-scroll-line" />
            scroll to observe
            <ArrowDown size={12} strokeWidth={1.5} />
          </div>
        </div>
      </section>

      {/* ── Section 01: Observable ───────────────────────────────── */}
      <section className="site-section" id="section-observable">
        <div className="section-meta">
          <span className="section-num">01</span>
          <span className="section-tag">
            <Star size={9} strokeWidth={1.5} style={{ display: "inline", marginRight: 6 }} />
            the observable
          </span>
        </div>
        <div>
          <h2 className="section-heading">
            2×10²⁷ stars.<br />Every one, burning<br />toward nothing.
          </h2>
          <div className="section-body">
            <p>
              The second law of thermodynamics is not a law you can break.
              Entropy increases. Always. Every closed system trends toward
              disorder — heat disperses, structure collapses, information
              degrades.
            </p>
            <p>
              The universe is not winding down. It is winding out.
              Into a state of maximum entropy — heat death — where no
              work can be done, no difference exists, and nothing happens.
              Ever again.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 02: Time ─────────────────────────────────────── */}
      <section className="site-section" id="section-time">
        <div className="section-meta">
          <span className="section-num">02</span>
          <span className="section-tag">
            <Clock size={9} strokeWidth={1.5} style={{ display: "inline", marginRight: 6 }} />
            time
          </span>
        </div>
        <div>
          <h2 className="section-heading">
            Time does not pass.<br />It accumulates.
          </h2>
          <div className="section-body">
            <p>
              The arrow of time is the arrow of entropy. We experience time
              flowing in one direction because entropy flows in one direction.
              The past is accessible because it was ordered. The future
              is inaccessible because it is disordered.
            </p>
            <p>
              Every moment you have lived is still happening — collapsed,
              inaccessible, conserved. Your memory is the universe
              remembering itself through you.
            </p>
          </div>
        </div>
      </section>

      {/* ── Quote ─────────────────────────────────────────────────── */}
      <div className="site-quote" id="site-quote">
        <p className="quote-text">
          "The universe is under no obligation to make sense to you."
        </p>
        <p className="quote-source">— Neil deGrasse Tyson</p>
      </div>

      {/* ── Section 03: Process ──────────────────────────────────── */}
      <section className="site-section" id="section-process">
        <div className="section-meta">
          <span className="section-num">03</span>
          <span className="section-tag">
            <Zap size={9} strokeWidth={1.5} style={{ display: "inline", marginRight: 6 }} />
            the process
          </span>
        </div>
        <div>
          <h2 className="section-heading">
            Entropy is not<br />the enemy.<br />It is the mechanism.
          </h2>
          <div className="section-body">
            <p>
              Without entropy, no star could ignite. Without it, no chemical
              gradient could drive the first living cell. Without entropy,
              you would not exist to read this.
            </p>
            <p>
              The same force that destroys is the force that creates. It does
              not choose. It does not judge. It simply maximizes. And in
              maximizing, it occasionally — accidentally — makes something
              breathtaking.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 04: Pattern ──────────────────────────────────── */}
      <section className="site-section" id="section-pattern">
        <div className="section-meta">
          <span className="section-num">04</span>
          <span className="section-tag">
            <Infinity size={9} strokeWidth={1.5} style={{ display: "inline", marginRight: 6 }} />
            what survives
          </span>
        </div>
        <div>
          <h2 className="section-heading">
            Not matter.<br />Not memory.<br />Pattern.
          </h2>
          <div className="section-body">
            <p>
              A pattern complex enough to persist — to repeat — to adapt.
              Life is not special because it defies entropy. It is special
              because it temporarily concentrates order, using entropy as
              fuel, and produces more complexity than entropy destroys.
            </p>
            <p>
              For now. And that is the only time that matters.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer id="site-footer">
        <div className="footer-left">
          <div className="footer-brand">·livd</div>
          <p className="footer-tagline">
            entropy is not the enemy.<br />it is the process.<br />
            you observed it.
          </p>
        </div>
        <div className="footer-right">
          <div className="footer-credit">
            built on the second law<br />
            of thermodynamics<br />
            © 2026 ·livd
          </div>
          <div className="footer-seed">
            session <span id="footer-seed-val">——</span>
          </div>
          <div className="footer-end">·</div>
        </div>
      </footer>

      <div className="site-spacer" />
    </div>
  );
}
