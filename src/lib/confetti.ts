import confetti from "canvas-confetti";

export function celebrate() {
  const colors = ["#22c55e", "#8b5cf6", "#3b82f6", "#f59e0b", "#ec4899"];
  const defaults = { spread: 70, ticks: 80, gravity: 0.9, decay: 0.94, scalar: 1, colors };

  confetti({ ...defaults, particleCount: 60, origin: { x: 0.5, y: 0.6 }, startVelocity: 45 });
  setTimeout(() => confetti({ ...defaults, particleCount: 40, angle: 60, origin: { x: 0, y: 0.7 } }), 80);
  setTimeout(() => confetti({ ...defaults, particleCount: 40, angle: 120, origin: { x: 1, y: 0.7 } }), 160);
}
