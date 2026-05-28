/** Lightweight starfield for the chat canvas — pauses when tab is hidden. */

export function mountCosmicAmbient(canvas, options = {}) {
  if (!canvas) return () => {};

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starCount = reducedMotion ? 48 : (options.starCount ?? 120);
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let width = 0;
  let height = 0;
  let raf = 0;
  let running = true;
  const stars = [];

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = parent.clientWidth;
    height = parent.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedStars() {
    stars.length = 0;
    for (let i = 0; i < starCount; i += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: 0.004 + Math.random() * 0.012,
        drift: 0.015 + Math.random() * 0.04,
      });
    }
  }

  function draw(time) {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = reducedMotion
        ? 0.55
        : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 252, 245, ${twinkle * 0.85})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();

      if (!reducedMotion) {
        star.y += star.drift * 0.15;
        if (star.y > height + 4) {
          star.y = -4;
          star.x = Math.random() * width;
        }
      }
    }

    raf = requestAnimationFrame(draw);
  }

  const onResize = () => {
    resize();
    seedStars();
  };

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      raf = requestAnimationFrame(draw);
    }
  };

  resize();
  seedStars();
  raf = requestAnimationFrame(draw);

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
