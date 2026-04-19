import confetti from "canvas-confetti";

export function celebrate() {
  const colors = ["#22c55e", "#8b5cf6", "#3b82f6", "#f59e0b", "#ec4899", "#06b6d4", "#f43f5e"];
  const defaults = { ticks: 200, gravity: 0.85, decay: 0.92, scalar: 1.1, colors, zIndex: 9999 };

  // Center burst
  confetti({ ...defaults, particleCount: 120, spread: 100, startVelocity: 55, origin: { x: 0.5, y: 0.55 } });

  // Side cannons
  setTimeout(() => confetti({ ...defaults, particleCount: 70, angle: 60, spread: 70, startVelocity: 60, origin: { x: 0, y: 0.75 } }), 100);
  setTimeout(() => confetti({ ...defaults, particleCount: 70, angle: 120, spread: 70, startVelocity: 60, origin: { x: 1, y: 0.75 } }), 180);

  // Sustained sparkle rain
  const end = Date.now() + 900;
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      startVelocity: 45,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
      zIndex: 9999,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      startVelocity: 45,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
      zIndex: 9999,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();

  // Star-shaped finale
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 360,
      startVelocity: 25,
      ticks: 150,
      shapes: ["star"],
      colors: ["#fde047", "#fbbf24", "#f59e0b"],
      origin: { x: 0.5, y: 0.5 },
      zIndex: 9999,
    });
  }, 300);
}
