"use client";
import { useEffect, useRef } from "react";
import type { SkyParams } from "@/lib/sky";

/**
 * What forms the cloud?
 */
type Puff = {
  ox: number; // orig x pos
  oy: number; // orig y pos
  r: number; // radius
  px: number; // x offset
  py: number; // y offset
  vx: number; // x velocity
  vy: number; // y velocity
};

/**
 * What fills the sky?
 */
type Cloud = {
  x: number; // x pos
  y: number; // y pos
  s: number; // scale
  layer: number; // z pos
  puffs: Puff[]; // indiv puffs
  stretch: number; // stretchiness
  vx: number; // x velocity
  flat: number; // vertical flatness
  dark: number; // darkness
  a: number; // opacity
};

/**
 * What can fll from the clouds?
 */
type Drop = { x: number; y: number; l: number; v: number };

/**
 * Time-dependent RGB values
 */
type Key = [number, number[], number[]];

/**
 * Restrict value v between two others in a and b given a < b
 * @param v Number
 * @param a Number
 * @param b Number
 * @returns v if a < v < b, otherwise return a or b
 */
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Linear interpolation
 * @param a start point
 * @param b end point
 * @param t desired %
 * @returns value resulted from formula
 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const R = Math.random;
const TAU = Math.PI * 2; // 2pi radians representing circumference of circle
const KEYS: Key[] = [
  [0, [10, 14, 40], [28, 38, 80]], // 12am
  [5.5, [40, 50, 110], [240, 150, 120]], // 5:30am
  [8, [80, 140, 220], [190, 220, 250]], // 8am
  [13, [50, 130, 225], [165, 215, 252]], // 1pm
  [17.5, [70, 110, 200], [250, 190, 140]], // 5:30pm
  [19.5, [50, 50, 110], [230, 110, 100]], // 7:30pm
  [22, [12, 16, 45], [30, 40, 85]], // 10pm
  [24, [10, 14, 40], [28, 38, 80]], // 12am
];

/**
 * Determines how much daylight should appear according to the time in hours
 * @param h number repping hour
 * @returns number repping amount of daylight
 */
const light = (h: number) =>
  0.28 + 0.72 * Math.max(0, Math.sin((Math.PI * (h - 5.5)) / 14));

/**
 * Converts RGB array to CSS rgb() colour
 * @param c RGB array
 * @returns string repping the rgb() function
 */
const rgb = (c: number[]) => `rgb(${c.map(Math.round).join(",")})`;

/**
 * Create new puff
 * @param ox orig x pos
 * @param oy orig y pos
 * @param r radius
 * @returns new puff with other req properties
 */
const pf = (ox: number, oy: number, r: number): Puff => ({
  ox,
  oy,
  r,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
});

/**
 * Depending on current hour, return what colours the top and bottom of sky should be
 * @param h current hour
 * @returns two colours: top, bottom colours of sky during h
 */
function skyColors(h: number): [number[], number[]] {
  let i = 0;
  while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
  const a = KEYS[i],
    b = KEYS[i + 1],
    t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  return [
    a[1].map((v, k) => lerp(v, b[1][k], t)),
    a[2].map((v, k) => lerp(v, b[2][k], t)),
  ];
}

// sky component
export default function CloudSky({ sky }: { sky: SkyParams }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(sky);
  useEffect(() => {
    target.current = sky;
  }, [sky]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const S = { ...target.current };
    let W = 0,
      H = 0,
      raf = 0, // request animation frame
      last = performance.now(),
      flash = 0, // lightning effect
      bucket = -1; // categorise clouds based on heaviness
    let clouds: Cloud[] = [];
    const drops: Drop[] = [];
    // Stars shall be randomly generated
    const stars = Array.from({ length: 140 }, () => ({
      x: R(),
      y: R() * 0.7,
      r: R() * 1.2 + 0.3,
      t: R() * 6,
    }));
    // Pointer
    const P = {
      x: -999,
      y: -999,
      active: false,
      drag: null as Cloud | null,
      lx: 0,
      ly: 0,
    };

    /**
     * resize window based on device
     */
    function resize() {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * d;
      cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    /**
     * Create new cloud
     * @returns new cloud obj
     */
    function makeCloud(): Cloud {
      const h = S.heavy,
        r = R();
      const t =
        h > 70
          ? r < 0.5
            ? "storm"
            : "stratus"
          : h > 35
            ? r < 0.6
              ? "stratus"
              : "cumulus"
            : r < 0.3
              ? "cirrus"
              : "cumulus";
      let layer = R(),
        s = 38 + layer * 62,
        y = H * (0.06 + R() * 0.5),
        flat = 1,
        dark = 1,
        a = 1;
      const puffs: Puff[] = [];
      if (t === "cumulus") {
        const n = 6 + Math.floor(R() * 6);
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1) - 0.5;
          puffs.push(
            pf(
              u * 3.2 + (R() - 0.5) * 0.4,
              -Math.cos(u * Math.PI) * 0.4 * R() + R() * 0.15,
              (0.7 + R() * 0.6) * (1 - Math.abs(u) * 0.8) + 0.35,
            ),
          );
        }
      } else if (t === "cirrus") {
        layer = R() * 0.3;
        s = 45 + R() * 30;
        y = H * (0.04 + R() * 0.2);
        flat = 0.3;
        a = 0.45;
        for (let i = 0; i < 14; i++) {
          const u = i / 13 - 0.5;
          puffs.push(
            pf(
              u * 6,
              Math.sin(u * 5) * 0.25 + (R() - 0.5) * 0.2,
              0.35 + R() * 0.35,
            ),
          );
        }
      } else if (t === "stratus") {
        layer = 0.2 + R() * 0.4;
        s = 60 + R() * 40;
        y = H * (0.15 + R() * 0.4);
        flat = 0.4;
        dark = 0.88;
        for (let i = 0; i < 11; i++) {
          const u = i / 10 - 0.5;
          puffs.push(pf(u * 5, (R() - 0.5) * 0.25, 0.6 + R() * 0.4));
        }
      } else {
        layer = 0.6 + R() * 0.4;
        s = 70 + R() * 40;
        y = H * (0.3 + R() * 0.3);
        dark = 0.55;
        for (let i = 0; i < 15; i++) {
          const u = i / 14 - 0.5,
            tw = 1 - Math.abs(u) * 1.7;
          puffs.push(
            pf(u * 2.6, -tw * R() * 1.4, (0.7 + R() * 0.5) * (0.5 + tw * 0.7)),
          );
        }
      }
      return {
        x: R() * (W + 500) - 250,
        y,
        s,
        layer,
        puffs,
        stretch: 1,
        vx: 0,
        flat,
        dark,
        a,
      };
    }

    /**
     * Relate user's pointer's coordinates to canvas
     * @param e Pointer event with cursor coords
     * @returns tuple of relative cursor coords
     */
    const pos = (e: PointerEvent): [number, number] => {
      const b = cv.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };

    /**
     * Pick the foremost cloud under cursor
     * @param x cursor x pos
     * @param y cursor y pos
     * @returns cloud under cursor, else null
     */
    function pick(x: number, y: number) {
      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i];
        for (const p of c.puffs) {
          const dx = x - (c.x + p.ox * c.s * c.stretch + p.px),
            dy = y - (c.y + p.oy * c.s + p.py);
          if (dx * dx + dy * dy < (p.r * c.s * 0.9) ** 2) return c;
        }
      }
      return null;
    }

    /**
     * Pointer down event function (to grab cloud)
     * @param e pointer event obj
     */
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      [P.x, P.y] = pos(e);
      P.active = true;
      P.lx = P.x;
      P.ly = P.y;
      P.drag = pick(P.x, P.y);
      if (P.drag) {
        cv.style.cursor = "grabbing";
        P.drag.vx = 0;
      }
    };

    /**
     * Pointer move function (to move cloud)
     * @param e pointer event obj
     */
    const move = (e: PointerEvent) => {
      const [x, y] = pos(e);
      if (P.drag) {
        const dx = x - P.lx,
          dy = y - P.ly;
        P.drag.x += dx;
        P.drag.y += dy;
        P.drag.vx = dx * 60;
        P.drag.stretch = clamp(1 + Math.hypot(dx, dy) / 25, 1, 1.8);
      }
      P.x = x;
      P.y = y;
      P.lx = x;
      P.ly = y;
      if (e.pointerType === "mouse") P.active = true;
    };

    /**
     * Pointer up function (to release cloud)
     * @param e pointer event obj
     */
    const up = (e: PointerEvent) => {
      P.drag = null;
      cv.style.cursor = "grab";
      if (e.pointerType !== "mouse") P.active = false;
    };

    /**
     * Pointer leave (the canvas) function
     * @param e
     */
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !P.drag) P.active = false;
    };

    /**
     * For the sun and moon's glow
     * @param x x-pos
     * @param y y-pos
     * @param r radius
     * @param c colour
     * @param a alpha
     */
    function glow(x: number, y: number, r: number, c: string, a: number) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${a})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    /**
     * Function to illustrate sky
     * @param now current timestamp
     * @param heavy darkness of clouds
     */
    function drawSky(now: number, heavy: number) {
      const h = S.hour,
        vis = 1 - heavy * 0.8,
        night = clamp((0.6 - light(h)) / 0.3, 0, 1);
      // Stars
      if (night > 0) {
        ctx.fillStyle = "#fff";
        // twinkle twinkle little star
        for (const s of stars) {
          ctx.globalAlpha =
            night * (1 - heavy) * (0.5 + 0.5 * Math.sin(now / 700 + s.t));
          ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
        }
        ctx.globalAlpha = 1;
      }
      // Sun
      const u = (h - 5.5) / 13;
      if (u >= 0 && u <= 1) {
        const x = W * (0.1 + 0.8 * u),
          y = H * (0.6 - 0.5 * Math.sin(Math.PI * u));
        glow(x, y, Math.min(W, H) * 0.5, "255,225,160", 0.55 * vis);
        glow(x, y, 70, "255,245,210", 0.9 * vis);
        ctx.fillStyle = `rgba(255,250,225,${vis})`;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, TAU); // draw Sun
        ctx.fill();
      }
      // Moon
      const m = ((h - 18 + 24) % 24) / 11.5;
      if (m >= 0 && m <= 1) {
        const x = W * (0.1 + 0.8 * m),
          y = H * (0.6 - 0.5 * Math.sin(Math.PI * m));
        glow(x, y, Math.min(W, H) * 0.35, "170,195,255", 0.4 * vis);
        ctx.fillStyle = `rgba(238,242,255,${vis})`;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(180,190,220,${0.5 * vis})`;
        ctx.beginPath();
        ctx.arc(x - 7, y - 4, 5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 6, y + 7, 4, 0, TAU);
        ctx.fill();
      }
    }

    /**
     * Main animation loop AKA "tick"
     * Update and redraw canvas each frame
     * @param now current timestamp from raf
     */
    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      const T = target.current,
        k = Math.min(1, dt * 1.5);
      S.cover = lerp(S.cover, T.cover, k);
      S.wind = lerp(S.wind, T.wind, k);
      S.heavy = lerp(S.heavy, T.heavy, k);
      S.rain = lerp(S.rain, T.rain, k);
      S.hour = T.hour;

      const b = S.heavy > 70 ? 2 : S.heavy > 35 ? 1 : 0;
      if (b !== bucket) {
        bucket = b;
        clouds = [];
      }
      const want = Math.round((S.cover / 100) * 20 * (reduce ? 0.7 : 1)); // how many clouds should there be?
      while (clouds.length < want) clouds.push(makeCloud());
      while (clouds.length > want)
        clouds.splice(Math.floor(R() * clouds.length), 1);
      clouds.sort((a, c) => a.layer - c.layer);

      const [top, bot] = skyColors(S.hour),
        heavy = S.heavy / 100,
        lt = light(S.hour);
      const grey = [105 * lt + 12, 115 * lt + 16, 135 * lt + 26];
      const g = ctx.createLinearGradient(0, 0, 0, H); // vertical gradient
      g.addColorStop(
        0,
        rgb(top.map((v, i) => lerp(v, grey[i] * 0.8, heavy * 0.7))),
      );
      g.addColorStop(1, rgb(bot.map((v, i) => lerp(v, grey[i], heavy * 0.7))));

      ctx.fillStyle = g; // for background
      ctx.fillRect(0, 0, W, H);
      drawSky(now, heavy);

      const gv = 255 - 190 * heavy,
        col = [
          gv * lt + 10 * (1 - lt),
          gv * lt + 14 * (1 - lt),
          gv * lt + 34 * (1 - lt),
        ];
      const windScale = reduce ? 0.25 : 1;
      for (const c of clouds) {
        c.x += (S.wind * windScale * (0.25 + c.layer * 0.9) + c.vx) * dt;
        if (c !== P.drag) c.vx *= Math.exp(-2.5 * dt);
        c.stretch += (1 - c.stretch) * (P.drag === c ? 0 : Math.min(1, dt * 3));
        const m = c.s * 3.2; // enable cloud to wrap around left and right side of canvas
        if (c.x > W + m) c.x = -m;
        if (c.x < -m) c.x = W + m;
        for (const p of c.puffs) {
          const wx = c.x + p.ox * c.s * c.stretch + p.px,
            wy = c.y + p.oy * c.s + p.py;
          if (P.active && !P.drag) {
            // logic for cloud push when pointer hover nearby
            const dx = wx - P.x,
              dy = wy - P.y,
              d = Math.hypot(dx, dy) || 1,
              rr = 140;
            if (d < rr) {
              const f = 1 - d / rr;
              p.vx += (dx / d) * f * 1600 * dt;
              p.vy += (dy / d) * f * 1600 * dt;
            }
          }
          p.vx -= p.px * 38 * dt; // reset after cloud hover
          p.vy -= p.py * 38 * dt;
          const damp = Math.exp(-5 * dt); // damping ensures smooth transition
          p.vx *= damp;
          p.vy *= damp;
          p.px += p.vx * dt;
          p.py += p.vy * dt;
        }
        const alpha = (0.55 + c.layer * 0.4) * c.a;
        for (const p of c.puffs) {
          const wx = c.x + p.ox * c.s * c.stretch + p.px,
            wy = c.y + p.oy * c.s + p.py,
            r = p.r * c.s;
          const sh = (1 - clamp((p.oy + 0.1) * 0.45, 0, 0.28)) * c.dark;
          const cc = col.map((v) => Math.round(v * sh)).join(",");
          ctx.save();
          ctx.translate(wx, wy);
          ctx.scale(1, c.flat);
          const rg = ctx.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
          rg.addColorStop(0, `rgba(${cc},${alpha})`);
          rg.addColorStop(0.55, `rgba(${cc},${alpha * 0.6})`);
          rg.addColorStop(1, `rgba(${cc},0)`);
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }

      const wantDrops = S.cover > 30 ? S.rain * (reduce ? 2 : 4) : 0; // how many raindrops?
      while (drops.length < wantDrops)
        drops.push({
          x: R() * (W + 300) - 150,
          y: R() * H,
          l: 10 + R() * 14,
          v: 600 + R() * 400,
        });
      if (drops.length > wantDrops) drops.length = Math.floor(wantDrops);
      for (const d of drops) {
        d.y += d.v * dt;
        d.x += S.wind * 3 * dt;
        if (d.y > H) {
          d.y = -20;
          d.x = R() * (W + 300) - 150;
        }
      }
      if (drops.length) {
        ctx.strokeStyle = `rgba(200,215,240,${0.25 + S.rain / 250})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const d of drops) {
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + S.wind * 0.015 * d.l, d.y + d.l);
        }
        ctx.stroke();
      }

      // random lightning effect trigger during stormy or rainy days
      if (!reduce && S.heavy > 75 && S.rain > 60 && R() < dt * 0.25) flash = 1;
      flash = Math.max(0, flash - dt * 2.5);
      if (flash > 0) {
        ctx.fillStyle = `rgba(235,240,255,${flash * 0.55})`;
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(frame);
    }

    // save resources, save the planet :D
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    // init setup
    resize();
    cv.style.cursor = "grab";
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", vis);
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", vis);
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-label="This is a sky you can freely interact with. Drag or touch the clouds to move them."
      className="fixed inset-0 h-full w-full touch-none"
    />
  );
}
