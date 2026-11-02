(() => {
  const tokens = ["--pass", "--primary", "--secondary"];
  const count = 40;
  const gravity = 0.2;
  const lifetimeMs = 1400;

  window.eventideConfetti = (origin) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const styles = getComputedStyle(document.documentElement);
    const colors = tokens.map((token) => styles.getPropertyValue(token).trim());

    const canvas = document.createElement("canvas");
    const ratio = window.devicePixelRatio || 1;
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      inlineSize: "100%",
      blockSize: "100%",
      pointerEvents: "none",
      zIndex: "9999",
    });
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    document.body.append(canvas);

    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const box = origin.getBoundingClientRect();
    const originX = box.left + box.width / 2;
    const originY = box.top + box.height / 2;
    const pieces = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 4,
        spin: Math.random() * Math.PI,
        spinSpeed: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    const start = performance.now();
    const frame = (now) => {
      const age = now - start;
      context.clearRect(0, 0, innerWidth, innerHeight);
      context.globalAlpha = Math.max(0, 1 - age / lifetimeMs);
      for (const piece of pieces) {
        piece.vy += gravity;
        piece.vx *= 0.99;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.spin += piece.spinSpeed;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }
      if (age < lifetimeMs) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  };
})();
