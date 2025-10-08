// ===== Boids Background (v3, background-safe + HiDPI) =====
(() => {
  // Run after DOM is ready (in case script isn't loaded with "defer")
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  function start() {
    // Only run if background is enabled via data attribute
    if (document.body && document.body.getAttribute("data-bg") !== "boids") return;

    let canvas = document.getElementById("boids-bg");
    if (!canvas) {
      // Fallback: create the canvas if it's missing
      canvas = document.createElement("canvas");
      canvas.id = "boids-bg";
      document.body.prepend(canvas);
    }

    const ctx = canvas.getContext("2d", { alpha: true }); // transparent!
    let W = 0, H = 0, dpr = 1;

    // Palette / groups
    const COLORS = ["#204fc7", "#067a52", "#ad3829"];
    const NUM_GROUPS = COLORS.length;

    // Flock config
    const N = 120;
    const MAX_SPEED = 3.0, MAX_FORCE = 0.1, MAX_TURN = Math.PI / 30;
    const R_SEP = 20, R_ALIGN = 45, R_COH = 80;
    const W_SEP = 1.8, W_ALIGN = 0.9, W_COH = 0.45, W_WAND = 0.02;

    // Utils
    const mag = v => Math.hypot(v.x, v.y);
    const heading = v => {
      const m = mag(v) || 1e-9;
      return { x: v.x / m, y: v.y / m };
    };
    const limit = (v, m) => {
      const n = mag(v);
      if (n > m) { v.x *= m / n; v.y *= m / n; }
      return v;
    };
    const setMag = (v, m) => {
      const n = mag(v) || 1e-9;
      v.x *= m / n; v.y *= m / n; return v;
    };
    const angDiff = (a, b) => ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
    const rotateTowards = (v, des, maxA) => {
      const s = mag(v);
      const a = Math.atan2(v.y, v.x);
      const b = Math.atan2(des.y, des.x);
      const d = angDiff(a, b);
      const na = Math.abs(d) < maxA ? b : a + (d > 0 ? maxA : -maxA);
      return { x: Math.cos(na) * s, y: Math.sin(na) * s };
    };
    const torusOffset = (ax, ay, bx, by) => {
      let dx = bx - ax, dy = by - ay;
      if (dx >  W / 2) dx -= W; else if (dx < -W / 2) dx += W;
      if (dy >  H / 2) dy -= H; else if (dy < -H / 2) dy += H;
      return { x: dx, y: dy };
    };

    // HiDPI-aware resize
    function resize() {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      // Use CSS size from the element itself (fixed, inset:0)
      const rect = canvas.getBoundingClientRect();
      W = Math.floor(rect.width);
      H = Math.floor(rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing to CSS pixels
      ctx.lineWidth = 1; // this is in CSS pixels thanks to setTransform
    }

    // Boid
    class Boid {
      constructor() {
        this.x = Math.random() * W; this.y = Math.random() * H;
        const a = Math.random() * Math.PI * 2;
        const s = MAX_SPEED * (0.6 + 0.4 * Math.random());
        this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
        this.group = (Math.random() * NUM_GROUPS) | 0;
        this.wT = Math.random() * Math.PI * 2;
        this.tick = (20 + Math.random() * 100) | 0;
      }
      wander() {
        this.tick--;
        if (this.tick <= 0) {
          this.tick = 60 + (Math.random() * 120) | 0;
          this.wT += (Math.random() - 0.5) * 1.2;
        }
        const d = heading({ x: this.vx, y: this.vy });
        const p = { x: -d.y, y: d.x };
        const t = { x: d.x + p.x * Math.sin(this.wT) * 0.6, y: d.y + p.y * Math.sin(this.wT) * 0.6 };
        const des = setMag(t, MAX_SPEED);
        return limit({ x: des.x - this.vx, y: des.y - this.vy }, MAX_FORCE);
      }
      rule(boids) {
        let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, cs = 0, ca = 0, cc = 0;
        for (const o of boids) {
          if (o === this) continue;
          const off = torusOffset(this.x, this.y, o.x, o.y);
          const d = Math.hypot(off.x, off.y);
          if (d < R_SEP && d > 0) { sx -= off.x / d; sy -= off.y / d; cs++; }
          if (o.group === this.group) {
            if (d < R_ALIGN) { ax += o.vx; ay += o.vy; ca++; }
            if (d < R_COH)   { cx += this.x + off.x; cy += this.y + off.y; cc++; }
          }
        }
        const F = { x: 0, y: 0 };
        if (cs) {
          sx /= cs;
          const des = setMag({ x: sx, y: sy }, MAX_SPEED);
          F.x += (des.x - this.vx) * W_SEP; F.y += (des.y - this.vy) * W_SEP;
        }
        if (ca) {
          ax /= ca;
          const des = setMag({ x: ax, y: ay }, MAX_SPEED);
          F.x += (des.x - this.vx) * W_ALIGN; F.y += (des.y - this.vy) * W_ALIGN;
        }
        if (cc) {
          cx /= cc; const dx = cx - this.x, dy = cy - this.y;
          const des = setMag({ x: dx, y: dy }, MAX_SPEED);
          F.x += (des.x - this.vx) * W_COH; F.y += (des.y - this.vy) * W_COH;
        }
        const w = this.wander(); F.x += w.x * W_WAND; F.y += w.y * W_WAND;
        return limit(F, MAX_FORCE);
      }
      update(boids) {
        const s = this.rule(boids);
        let dv = { x: this.vx + s.x, y: this.vy + s.y };
        dv = setMag(dv, Math.min(mag(dv), MAX_SPEED));
        const nv = rotateTowards({ x: this.vx, y: this.vy }, dv, MAX_TURN);
        this.vx = nv.x; this.vy = nv.y;
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0) this.x += W; else if (this.x >= W) this.x -= W;
        if (this.y < 0) this.y += H; else if (this.y >= H) this.y -= H;
      }
      draw(ctx) {
        const d = heading({ x: this.vx, y: this.vy });
        const l = { x: -d.y, y: d.x };
        const tip  = { x: this.x + d.x * 14, y: this.y + d.y * 14 };
        const base = { x: this.x - d.x * 9,  y: this.y - d.y * 9  };
        const left = { x: base.x + l.x * 4,  y: base.y + l.y * 4  };
        const right= { x: base.x - l.x * 4,  y: base.y - l.y * 4  };
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y); ctx.lineTo(left.x, left.y); ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fillStyle = COLORS[this.group]; ctx.fill();
        ctx.strokeStyle = "#282828"; ctx.stroke();
      }
    }

    // Seed and run
    let boids = [];
    function seed() {
      boids.length = 0;
      for (let i = 0; i < N; i++) boids.push(new Boid());
    }

    function onResize() { resize(); seed(); }
    window.addEventListener("resize", onResize, { passive: true });
    resize(); seed();

    // Pause when tab hidden (battery-friendly)
    let running = true;
    document.addEventListener("visibilitychange", () => { running = !document.hidden; });

    function frame() {
      if (running) {
        // Transparent clear so CSS background shows through
        ctx.clearRect(0, 0, W, H);

        for (const b of boids) b.update(boids);
        for (const b of boids) b.draw(ctx);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();