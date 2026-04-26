/**
 * f1-box-box — F1 pit lane loading animation with start/complete flow.
 * Canvas-based. Car drives in on start(), crew works on tyres,
 * then on complete() light goes green, crew steps back, car drives off.
 */

export interface F1PitstopOptions {
  /** Visual scale multiplier. Default: 1 */
  scale?: number;
  /** Accent (team) color */
  color?: string;
  /** Base color of the car chassis and mechanics' gear. Default: #1a1a1a */
  baseColor?: string;
  /**
   * Status line under the track.
   * Pass an array to cycle through messages: first and last are shown once
   * (at start / end); middle entries repeat in sequence during the work phase.
   */
  text?: string | string[];
  /** Interval in ms for cycling middle text entries. Default: 2000 */
  textInterval?: number;
}

export interface F1PitstopController {
  /** Car enters pit, crew starts working. */
  start: () => void;
  /** Light goes green, crew steps back, car drives off. */
  complete: () => void;
  /** Back to idle (car off-screen). */
  reset: () => void;
  /** Resize the scene; updates canvas backing store so scaling stays sharp. */
  setScale: (scale: number) => void;
  /** Remove from DOM. */
  destroy: () => void;
}

const STYLE_ID = "ef-f1-box-box-styles";

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.ef-f1-root {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-height: 1px;
}
.ef-f1-surface {
  width: 300px;
  height: 110px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, #1a1a22 0%, #111118 100%);
  border: 1px solid rgba(255,255,255,0.06);
}
.ef-f1-surface canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.ef-f1-text {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  text-align: center;
  min-height: 1em;
  max-width: min(300px, 100%);
}
`;
  document.head.appendChild(style);
}

const W = 300;
const H = 110;

const PIT_CENTER_X = W * 0.5;
const CAR_Y = H * 0.55;
const CAR_W = 100;
const CAR_H = 28;

interface MechanicState {
  baseX: number;
  baseY: number;
  crouchAmount: number;
  armPhase: number;
  side: "top" | "bottom";
}

function drawAsphalt(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#111118";
  ctx.fillRect(0, 0, W, H);

  // Track surface
  ctx.fillStyle = "#18181f";
  ctx.fillRect(0, H * 0.25, W, H * 0.6);

  // Pit lane line (dashed)
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, H * 0.25);
  ctx.lineTo(W, H * 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, H * 0.85);
  ctx.lineTo(W, H * 0.85);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pit box markings
  const boxLeft = PIT_CENTER_X - 55;
  const boxRight = PIT_CENTER_X + 55;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(boxLeft, H * 0.26, boxRight - boxLeft, H * 0.58);

  // Speed limit line
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(boxLeft, H * 0.26, boxRight - boxLeft, H * 0.58);
}

function drawF1Car(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, baseColor: string): void {
  ctx.save();
  ctx.translate(x, y);

  // Car shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, CAR_H * 0.6, CAR_W * 0.45, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const halfW = CAR_W * 0.5;
  const halfH = CAR_H * 0.5;

  // Rear wing
  ctx.fillStyle = color;
  ctx.fillRect(-halfW, -halfH + 1, 4, halfH * 2 - 2);
  ctx.fillStyle = baseColor;
  ctx.fillRect(-halfW + 1, -halfH + 3, 2, halfH * 2 - 6);

  // Rear body
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(-halfW + 4, -halfH + 4);
  ctx.lineTo(-halfW + 18, -halfH + 2);
  ctx.lineTo(-halfW + 18, halfH - 2);
  ctx.lineTo(-halfW + 4, halfH - 4);
  ctx.closePath();
  ctx.fill();

  // Engine cover
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-halfW + 18, -halfH + 2);
  ctx.lineTo(0, -halfH + 1);
  ctx.lineTo(0, halfH - 1);
  ctx.lineTo(-halfW + 18, halfH - 2);
  ctx.closePath();
  ctx.fill();

  // Sidepods
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(-12, -halfH);
  ctx.lineTo(8, -halfH - 2);
  ctx.lineTo(10, -halfH + 4);
  ctx.lineTo(-10, -halfH + 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, halfH);
  ctx.lineTo(8, halfH + 2);
  ctx.lineTo(10, halfH - 4);
  ctx.lineTo(-10, halfH - 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Cockpit
  ctx.fillStyle = "#111";
  ctx.fillRect(-2, -halfH + 3, 14, halfH * 2 - 6);
  // Halo
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-1, -halfH + 4);
  ctx.quadraticCurveTo(5, -halfH + 1, 11, -halfH + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1, halfH - 4);
  ctx.quadraticCurveTo(5, halfH - 1, 11, halfH - 4);
  ctx.stroke();

  // Driver helmet
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(5, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(3, -1, 4, 2);

  // Nose
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, -halfH + 2);
  ctx.lineTo(halfW - 10, -3);
  ctx.lineTo(halfW - 10, 3);
  ctx.lineTo(12, halfH - 2);
  ctx.closePath();
  ctx.fill();

  // Front wing endplates
  ctx.fillStyle = baseColor;
  ctx.fillRect(halfW - 10, -halfH - 2, 2, halfH * 2 + 4);

  // Front wing
  ctx.fillStyle = color;
  ctx.fillRect(halfW - 8, -halfH - 2, 8, 3);
  ctx.fillRect(halfW - 8, halfH - 1, 8, 3);
  ctx.globalAlpha = 0.6;
  ctx.fillRect(halfW - 7, -halfH + 2, 6, 2);
  ctx.fillRect(halfW - 7, halfH - 3, 6, 2);
  ctx.globalAlpha = 1;

  // T-cam
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(-16, -halfH, 3, 2);

  // Rear wheels
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(-halfW + 12, -halfH - 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-halfW + 12, halfH + 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(-halfW + 12, -halfH - 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-halfW + 12, halfH + 3, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Front wheels
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(halfW - 15, -halfH - 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(halfW - 15, halfH + 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(halfW - 15, -halfH - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(halfW - 15, halfH + 2, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMechanic(
  ctx: CanvasRenderingContext2D,
  m: MechanicState,
  color: string,
  baseColor: string,
  elapsed: number
): void {
  ctx.save();
  ctx.translate(m.baseX, m.baseY);

  const wobble = Math.sin(elapsed * 0.008 + m.armPhase) * 2;
  const crouchY = m.crouchAmount * 4;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 10 + crouchY, 5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (crouching)
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const legSpread = 2 + m.crouchAmount * 3;
  ctx.beginPath();
  ctx.moveTo(-1, 2 + crouchY);
  ctx.lineTo(-legSpread, 9 + crouchY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, 2 + crouchY);
  ctx.lineTo(legSpread, 9 + crouchY);
  ctx.stroke();

  // Boots
  ctx.fillStyle = baseColor;
  ctx.fillRect(-legSpread - 1.5, 8 + crouchY, 3, 2);
  ctx.fillRect(legSpread - 1.5, 8 + crouchY, 3, 2);

  // Body (overalls)
  ctx.fillStyle = color;
  ctx.fillRect(-3, -5 + crouchY * 0.3, 6, 8);

  // Arms extended toward wheel with gun
  const armDir = m.side === "top" ? -1 : 1;
  const gunX = armDir * (5 + wobble * 0.3);
  const gunY = -1 + crouchY * 0.5;

  ctx.strokeStyle = "#e8b89a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, -3 + crouchY * 0.3);
  ctx.lineTo(gunX, gunY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, -3 + crouchY * 0.3);
  ctx.lineTo(gunX + armDir * 2, gunY + 1);
  ctx.stroke();

  // Wheel gun
  ctx.fillStyle = "#888";
  ctx.save();
  ctx.translate(gunX + armDir * 3, gunY);
  ctx.rotate(armDir * 0.2 + wobble * 0.05);
  ctx.fillRect(-1, -1.5, 6 * Math.abs(armDir), 3);
  ctx.fillStyle = "#666";
  ctx.fillRect(-1, -1, 3, 2);
  ctx.restore();

  // Head with helmet
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -8 + crouchY * 0.2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Visor
  ctx.fillStyle = "#111";
  ctx.globalAlpha = 0.6;
  ctx.fillRect(-2.5, -9 + crouchY * 0.2, 5, 2);
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawJackMan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  baseColor: string,
  crouchAmount: number,
  elapsed: number
): void {
  ctx.save();
  ctx.translate(x, y);

  const crouchY = crouchAmount * 3;
  const pump = Math.sin(elapsed * 0.006) * crouchAmount * 1.5;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(0, 10 + crouchY, 4, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-1, 2 + crouchY);
  ctx.lineTo(-3, 9 + crouchY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, 2 + crouchY);
  ctx.lineTo(3, 9 + crouchY);
  ctx.stroke();

  // Boots
  ctx.fillStyle = baseColor;
  ctx.fillRect(-4, 8 + crouchY, 3, 2);
  ctx.fillRect(1, 8 + crouchY, 3, 2);

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(-3, -5 + crouchY * 0.3, 6, 8);

  // Arms holding jack
  ctx.strokeStyle = "#e8b89a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, -3 + crouchY * 0.3);
  ctx.lineTo(-4, 3 + pump);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, -3 + crouchY * 0.3);
  ctx.lineTo(4, 3 + pump);
  ctx.stroke();

  // Jack pole
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 3 + pump);
  ctx.lineTo(0, 14 + crouchY);
  ctx.stroke();

  // Jack base
  ctx.fillStyle = "#555";
  ctx.fillRect(-4, 13 + crouchY, 8, 2);

  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -8 + crouchY * 0.2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.globalAlpha = 0.6;
  ctx.fillRect(-2.5, -9 + crouchY * 0.2, 5, 2);
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawLight(ctx: CanvasRenderingContext2D, lightColor: string): void {
  // Light
  ctx.fillStyle = lightColor;
  ctx.beginPath();
  ctx.arc(W - 18, 11, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Glow
  ctx.fillStyle = lightColor;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(W - 18, 11, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPitLabel(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PIT", 8, 13);
}

/**
 * Mounts an F1 pit-stop animation. Call start() for car entry + tyre work loop,
 * complete() for green light + car exit.
 */
export function f1Pitstop(
  container: HTMLElement,
  options: F1PitstopOptions = {}
): F1PitstopController {
  if (typeof document === "undefined") {
    return {
      start: () => {},
      complete: () => {},
      reset: () => {},
      setScale: () => {},
      destroy: () => {},
    };
  }

  ensureStyles();

  const {
    scale = 1,
    color = "#e22828",
    baseColor = "#1a1a1a",
    text = "Pit lane…",
    textInterval: textIntervalMs = 2000,
  } = options;

  const textArr = Array.isArray(text) ? text : null;
  const middleTexts = textArr && textArr.length > 2 ? textArr.slice(1, -1) : null;
  const idleText = textArr ? textArr[0] : text as string;

  const root = document.createElement("div");
  root.className = "ef-f1-root";

  const surface = document.createElement("div");
  surface.className = "ef-f1-surface";

  const cvs = document.createElement("canvas");
  surface.appendChild(cvs);

  const sub = document.createElement("div");
  sub.className = "ef-f1-text";
  sub.textContent = idleText;

  root.append(surface, sub);
  container.appendChild(root);

  const ctx = cvs.getContext("2d")!;

  type Mode = "idle" | "entering" | "working" | "leaving" | "done";
  let mode: Mode = "idle";
  let animId = 0;
  let phaseStart = 0;

  let carX = -CAR_W;
  let lightColor = "#e22828";

  const halfW = CAR_W * 0.5;
  const mechanics: MechanicState[] = [
    { baseX: PIT_CENTER_X - halfW + 12, baseY: CAR_Y - CAR_H * 0.5 - 10, crouchAmount: 0, armPhase: 0, side: "top" },
    { baseX: PIT_CENTER_X - halfW + 12, baseY: CAR_Y + CAR_H * 0.5 + 10, crouchAmount: 0, armPhase: 1.2, side: "bottom" },
    { baseX: PIT_CENTER_X + halfW - 15, baseY: CAR_Y - CAR_H * 0.5 - 10, crouchAmount: 0, armPhase: 0.6, side: "top" },
    { baseX: PIT_CENTER_X + halfW - 15, baseY: CAR_Y + CAR_H * 0.5 + 10, crouchAmount: 0, armPhase: 1.8, side: "bottom" },
  ];

  let jackManCrouch = 0;

  let visualScale = Math.max(0.05, scale);

  function easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function drawScene(elapsed: number): void {
    ctx.clearRect(0, 0, W, H);
    drawAsphalt(ctx);
    drawPitLabel(ctx);
    drawLight(ctx, lightColor);

    // Jack man (behind car)
    if (mode === "working" || mode === "entering") {
      drawJackMan(ctx, PIT_CENTER_X + halfW + 12, CAR_Y, color, baseColor, jackManCrouch, elapsed);
    }

    drawF1Car(ctx, carX, CAR_Y, color, baseColor);

    // Mechanics (in front, visible when working)
    if (mode === "working" || mode === "leaving") {
      for (const m of mechanics) {
        drawMechanic(ctx, m, color, baseColor, elapsed);
      }
    }
  }

  function renderIdle(): void {
    carX = -CAR_W;
    lightColor = "#e22828";
    for (const m of mechanics) m.crouchAmount = 0;
    jackManCrouch = 0;
    ctx.clearRect(0, 0, W, H);
    drawAsphalt(ctx);
    drawPitLabel(ctx);
    drawLight(ctx, lightColor);
  }

  function applyPixelScale(s: number): void {
    visualScale = Math.max(0.05, s);
    const dpr = window.devicePixelRatio || 1;
    surface.style.width = `${W * visualScale}px`;
    surface.style.height = `${H * visualScale}px`;
    sub.style.maxWidth = `${W * visualScale}px`;
    cvs.width = Math.max(1, Math.round(W * dpr * visualScale));
    cvs.height = Math.max(1, Math.round(H * dpr * visualScale));
    ctx.setTransform(dpr * visualScale, 0, 0, dpr * visualScale, 0, 0);
    if (mode === "idle") {
      renderIdle();
    } else {
      drawScene(0);
    }
  }

  applyPixelScale(scale);

  // Phase 1: Car drives in from left and stops at pit box
  function enterLoop(now: number): void {
    if (mode !== "entering") return;
    if (!phaseStart) phaseStart = now;
    const elapsed = now - phaseStart;
    const enterDuration = 800;
    const t = Math.min(1, elapsed / enterDuration);

    carX = -CAR_W + (PIT_CENTER_X - (-CAR_W)) * easeOut(t);
    lightColor = "#e22828";

    drawScene(elapsed);

    if (t < 1) {
      animId = requestAnimationFrame(enterLoop);
    } else {
      carX = PIT_CENTER_X;
      mode = "working";
      phaseStart = 0;
      animId = requestAnimationFrame(workLoop);
    }
  }

  // Phase 2: Crew works on tyres (loops until complete() is called)
  function workLoop(now: number): void {
    if (mode !== "working") return;
    if (!phaseStart) phaseStart = now;
    const elapsed = now - phaseStart;

    // Crew crouches in over first 300ms
    const crouchIn = Math.min(1, elapsed / 300);
    for (const m of mechanics) {
      m.crouchAmount = easeOut(crouchIn);
    }
    jackManCrouch = easeOut(crouchIn);

    if (middleTexts) {
      const idx = Math.floor(elapsed / textIntervalMs) % middleTexts.length;
      sub.textContent = middleTexts[idx];
    }

    lightColor = "#e22828";
    drawScene(elapsed);

    animId = requestAnimationFrame(workLoop);
  }

  // Phase 3: Light goes green, crew steps back, car drives off
  function leaveLoop(now: number): void {
    if (mode !== "leaving") return;
    if (!phaseStart) phaseStart = now;
    const elapsed = now - phaseStart;

    // 0–200ms: crew stands up and steps back
    const standUp = Math.min(1, elapsed / 200);
    for (const m of mechanics) {
      m.crouchAmount = 1 - easeOut(standUp);
      // Step back from car
      const stepBack = m.side === "top" ? -1 : 1;
      m.baseY += stepBack * 0.15;
    }
    jackManCrouch = 1 - easeOut(standUp);

    // 200ms: light goes green
    if (elapsed > 150) {
      lightColor = "#22c55e";
    }

    // 300ms+: car accelerates out to the right
    if (elapsed > 300) {
      const driveT = Math.min(1, (elapsed - 300) / 600);
      const accel = driveT * driveT * driveT;
      carX = PIT_CENTER_X + accel * (W + CAR_W);
    }

    drawScene(elapsed);

    if (elapsed < 1000) {
      animId = requestAnimationFrame(leaveLoop);
    } else {
      mode = "done";
      sub.textContent = textArr ? textArr[textArr.length - 1] : "Box, box — out!";
    }
  }

  function start(): void {
    cancelAnimationFrame(animId);
    mode = "entering";
    phaseStart = 0;
    carX = -CAR_W;
    lightColor = "#e22828";
    for (const m of mechanics) m.crouchAmount = 0;
    jackManCrouch = 0;
    // Reset mechanic positions
    mechanics[0].baseY = CAR_Y - CAR_H * 0.5 - 10;
    mechanics[1].baseY = CAR_Y + CAR_H * 0.5 + 10;
    mechanics[2].baseY = CAR_Y - CAR_H * 0.5 - 10;
    mechanics[3].baseY = CAR_Y + CAR_H * 0.5 + 10;
    sub.textContent = textArr ? textArr[0] : "Box, box — coming in…";
    animId = requestAnimationFrame(enterLoop);
  }

  function complete(): void {
    if (mode !== "working") return;
    cancelAnimationFrame(animId);
    mode = "leaving";
    phaseStart = 0;
    sub.textContent = textArr ? textArr[textArr.length - 1] : "Tyres on — go, go, go!";
    animId = requestAnimationFrame(leaveLoop);
  }

  function reset(): void {
    cancelAnimationFrame(animId);
    mode = "idle";
    sub.textContent = idleText;
    renderIdle();
  }

  function setScale(next: number): void {
    const s = Number.isFinite(next) && next > 0 ? next : 1;
    applyPixelScale(s);
  }

  function destroy(): void {
    cancelAnimationFrame(animId);
    mode = "idle";
    root.remove();
  }

  return { start, complete, reset, setScale, destroy };
}

export default f1Pitstop;
