import { useEffect, useRef, useState } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useGestureRecognizer } from '../hooks/useGestureRecognizer';

const CONFIG = {
  drawRadius: 34,
  wipeRadius: 104,
  resteamDelayMs: 1400,
  resteamDurationMs: 5200,
  overlayAlpha: 0.68,
  stampSpacingFactor: 0.35,
  wipeSoundBaseVolume: 0.04,
  wipeSoundMaxVolume: 0.22,
  wipeSoundSmoothing: 0.16,
};

type InteractionMode = 'idle' | 'draw' | 'wipe';
type Point = { x: number; y: number };

function getDistance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIndex: number,
  pipIndex: number,
  mcpIndex: number,
) {
  const wrist = landmarks[0];
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];

  const tipToWrist = getDistance(tip, wrist);
  const pipToWrist = getDistance(pip, wrist);
  const tipToMcp = getDistance(tip, mcp);
  const pipToMcp = getDistance(pip, mcp);

  return tipToWrist > pipToWrist * 1.12 && tipToMcp > pipToMcp * 1.35;
}

function resolveMode(landmarks?: NormalizedLandmark[], label?: string): InteractionMode {
  if (!landmarks || landmarks.length < 21) {
    if (label === 'Pointing_Up') return 'draw';
    if (label === 'Open_Palm') return 'wipe';
    return 'idle';
  }

  const indexExtended = isFingerExtended(landmarks, 8, 6, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9);
  const ringExtended = isFingerExtended(landmarks, 16, 14, 13);
  const pinkyExtended = isFingerExtended(landmarks, 20, 18, 17);

  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return 'draw';
  }

  if (extendedCount >= 4 || label === 'Open_Palm') {
    return 'wipe';
  }

  if (indexExtended && extendedCount <= 2) {
    return 'draw';
  }

  return label === 'Pointing_Up' ? 'draw' : 'idle';
}

function projectPointer(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  mode: InteractionMode,
) {
  if (landmarks.length === 0) return null;

  if (mode === 'wipe') {
    const anchors = [0, 5, 9, 13, 17].map((index) => landmarks[index]);
    const center = anchors.reduce(
      (sum, point) => ({ x: sum.x + point.x / anchors.length, y: sum.y + point.y / anchors.length }),
      { x: 0, y: 0 },
    );

    return { x: width - center.x * width, y: center.y * height };
  }

  const tip = landmarks[8];
  return { x: width - tip.x * width, y: tip.y * height };
}

function stampReveal(
  ctx: CanvasRenderingContext2D,
  point: Point,
  radius: number,
) {
  const gradient = ctx.createRadialGradient(
    point.x,
    point.y,
    0,
    point.x,
    point.y,
    radius,
  );

  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.72)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawInterpolatedReveal(
  ctx: CanvasRenderingContext2D,
  previousPoint: Point | null,
  nextPoint: Point,
  radius: number,
) {
  if (!previousPoint) {
    stampReveal(ctx, nextPoint, radius);
    return nextPoint;
  }

  const dx = nextPoint.x - previousPoint.x;
  const dy = nextPoint.y - previousPoint.y;
  const distance = Math.hypot(dx, dy);
  const spacing = Math.max(4, radius * CONFIG.stampSpacingFactor);
  const steps = Math.max(1, Math.ceil(distance / spacing));

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    stampReveal(ctx, {
      x: previousPoint.x + dx * t,
      y: previousPoint.y + dy * t,
    }, radius);
  }

  return nextPoint;
}

export function SteamGlassScene() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const wipeAudioRef = useRef<HTMLAudioElement | null>(null);
  const smoothedSpeedRef = useRef(0);
  const smoothedPointRef = useRef<Point | null>(null);
  const lastActiveModeRef = useRef<InteractionMode>('idle');
  const lastModeSeenAtRef = useRef(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { isReady, recognize } = useGestureRecognizer();

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (error) {
        console.error('Failed to access webcam', error);
        setCameraError('Camera access is required. Please allow webcam permission in the browser.');
      }
    };

    startCamera().catch(console.error);

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const revealCanvas = revealCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;

      if (!revealCanvas) return;

      revealCanvas.width = width;
      revealCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const audio = new Audio('/sounds/wipe.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    wipeAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      wipeAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const video = videoRef.current;
    const revealCanvas = revealCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (!video || !revealCanvas) return;

    const revealCtx = revealCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');

    if (!revealCtx || !maskCtx) return;

    let frameId = 0;
    let lastFrameTime = performance.now();
    let lastInteractionTime = performance.now();
    let previousPoint: Point | null = null;

    const render = (time: number) => {
      const width = revealCanvas.width;
      const height = revealCanvas.height;
      const deltaMs = time - lastFrameTime;
      lastFrameTime = time;

      const result = recognize(video, time);
      const gestureLabel = result?.gestures[0]?.[0]?.categoryName;
      const handLandmarks = result?.landmarks[0];
      const rawMode = resolveMode(handLandmarks, gestureLabel);
      const mode =
        rawMode !== 'idle' || time - lastModeSeenAtRef.current < 140
          ? (rawMode !== 'idle' ? rawMode : lastActiveModeRef.current)
          : 'idle';
      let pointerSpeed = 0;

      if (rawMode !== 'idle') {
        lastActiveModeRef.current = rawMode;
        lastModeSeenAtRef.current = time;
      }

      if (handLandmarks && mode !== 'idle') {
        const radius = mode === 'wipe' ? CONFIG.wipeRadius : CONFIG.drawRadius + 6;
        const rawPoint = projectPointer(handLandmarks, width, height, mode);

        if (rawPoint) {
          const previousSmoothedPoint = smoothedPointRef.current;
          const smoothing = mode === 'draw' ? 0.34 : 0.42;
          const point = previousSmoothedPoint
            ? {
                x: previousSmoothedPoint.x + (rawPoint.x - previousSmoothedPoint.x) * smoothing,
                y: previousSmoothedPoint.y + (rawPoint.y - previousSmoothedPoint.y) * smoothing,
              }
            : rawPoint;

          smoothedPointRef.current = point;

          if (previousPoint) {
            pointerSpeed = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) / Math.max(deltaMs, 1);
          }

          previousPoint = drawInterpolatedReveal(maskCtx, previousPoint, point, radius);
          lastInteractionTime = time;
        }
      } else {
        previousPoint = null;
        smoothedPointRef.current = null;
      }

      smoothedSpeedRef.current += (pointerSpeed - smoothedSpeedRef.current) * CONFIG.wipeSoundSmoothing;

      if (wipeAudioRef.current) {
        const activeSound = mode !== 'idle' && smoothedSpeedRef.current > 0.01;
        const audio = wipeAudioRef.current;

        if (activeSound) {
          if (audio.paused) {
            audio.currentTime = 0;
            audio.play().catch(() => undefined);
          }

          const nextVolume = Math.min(
            CONFIG.wipeSoundBaseVolume + smoothedSpeedRef.current * 0.055,
            CONFIG.wipeSoundMaxVolume,
          );
          const nextRate = Math.min(0.92 + smoothedSpeedRef.current * 0.32, 1.35);

          audio.volume += (nextVolume - audio.volume) * 0.2;
          audio.playbackRate += (nextRate - audio.playbackRate) * 0.2;
        } else if (!audio.paused) {
          audio.volume *= 0.8;
          audio.playbackRate += (1 - audio.playbackRate) * 0.16;

          if (audio.volume < 0.01) {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0;
          }
        } else {
          audio.volume = 0;
          audio.playbackRate = 1;
        }
      }

      if (time - lastInteractionTime > CONFIG.resteamDelayMs) {
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(deltaMs / CONFIG.resteamDurationMs, 0.09)})`;
        maskCtx.fillRect(0, 0, width, height);
      }

      revealCtx.clearRect(0, 0, width, height);
      revealCtx.save();
      revealCtx.scale(-1, 1);
      revealCtx.drawImage(video, -width, 0, width, height);
      revealCtx.restore();
      revealCtx.globalCompositeOperation = 'destination-in';
      revealCtx.drawImage(maskCanvas, 0, 0, width, height);
      revealCtx.globalCompositeOperation = 'source-over';

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [isReady, recognize]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-slate-950">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        autoPlay
        muted
        playsInline
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),linear-gradient(180deg,rgba(246,250,255,0.22),rgba(190,204,219,0.14))]" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backdropFilter: 'blur(20px) saturate(1.03)',
          background: `
            linear-gradient(180deg, rgba(236, 240, 243, ${CONFIG.overlayAlpha * 0.82}), rgba(205, 212, 218, ${CONFIG.overlayAlpha * 0.74})),
            radial-gradient(circle at 24% 18%, rgba(255,255,255,0.16), transparent 26%),
            radial-gradient(circle at 72% 24%, rgba(255,255,255,0.12), transparent 18%),
            radial-gradient(circle at 50% 78%, rgba(255,255,255,0.08), transparent 26%)
          `,
          mixBlendMode: 'normal',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.035) 18%, transparent 42%),
            radial-gradient(circle at 20% 22%, rgba(255,255,255,0.06), transparent 11%),
            radial-gradient(circle at 68% 16%, rgba(255,255,255,0.045), transparent 12%),
            repeating-linear-gradient(
              90deg,
              transparent 0 92px,
              rgba(255,255,255,0.018) 92px 94px,
              transparent 94px 190px
            )
          `,
          opacity: 0.42,
          mixBlendMode: 'screen',
          filter: 'blur(10px)',
        }}
      />

      <canvas
        ref={revealCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5 text-[11px] uppercase tracking-[0.28em] text-white/60 sm:p-7">
        <span>Steam Glass Prototype</span>
        <span>{isReady ? 'Hand Tracking Ready' : 'Loading MediaPipe'}</span>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-5 sm:p-7">
        <div className="max-w-md rounded-3xl border border-white/12 bg-black/24 px-4 py-3 text-sm text-white/82 shadow-2xl backdrop-blur-md">
          <p className="font-semibold tracking-[0.18em] text-cyan-100/85 uppercase">
            Gestures
          </p>
          <p className="mt-2">Index finger: fine draw wipe</p>
          <p>Open palm: wide clean wipe</p>
          <p className="mt-2 text-white/56">
            The reveal mask slowly fogs over again after inactivity.
          </p>
        </div>
      </div>

      {cameraError ? (
        <div className="absolute left-5 top-20 max-w-sm rounded-2xl border border-rose-200/30 bg-rose-950/70 px-4 py-3 text-sm text-rose-50 shadow-xl backdrop-blur-md">
          {cameraError}
        </div>
      ) : null}
    </main>
  );
}
