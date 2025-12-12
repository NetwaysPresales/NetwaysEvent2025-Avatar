'use client';

import { useRef, useEffect } from 'react';

// Avatar rendering constants
const AVATAR_SCALE_FACTOR = 0.80; // Scale avatar to 80% of viewport height

export function useGreenScreen() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tmpCanvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);
    const lastFrameDataRef = useRef<ImageData | null>(null);
    const lastCanvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
    const processingRef = useRef(false);

    const startProcessing = () => {
        processingRef.current = true;
        makeBackgroundTransparent();
    };

    const stopProcessing = () => {
        processingRef.current = false;
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    // Green screen removal using HSV keying with feathering and spill suppression
    const makeBackgroundTransparent = () => {
        if (!processingRef.current) return;

        const video = document.getElementById('avatar-video') as HTMLVideoElement;
        const canvas = canvasRef.current;
        const tmpCanvas = tmpCanvasRef.current;

        if (!video || !canvas || !tmpCanvas || video.videoWidth === 0) {
            rafRef.current = requestAnimationFrame(makeBackgroundTransparent);
            return;
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        tmpCanvas.width = vw;
        tmpCanvas.height = vh;
        const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })!;
        tmpCtx.drawImage(video, 0, 0, vw, vh);

        const frame = tmpCtx.getImageData(0, 0, vw, vh);
        const d = frame.data;

        // Detect background type from corner samples (green screen vs white)
        const sample = (x: number, y: number) => {
            const idx = (y * vw + x) * 4;
            return [d[idx] / 255, d[idx + 1] / 255, d[idx + 2] / 255] as [number, number, number];
        };
        const corners = [sample(5, 5), sample(vw - 6, 5), sample(5, vh - 6), sample(vw - 6, vh - 6)];
        const avg = corners.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(v => v / 4) as [number, number, number];
        const maxC = Math.max(...avg);
        const minC = Math.min(...avg);
        const isGreenBg = avg[1] > avg[0] * 1.3 && avg[1] > avg[2] * 1.3; // green dominant
        const isWhiteBg = maxC > 0.95 && (maxC - minC) < 0.05; // high value, low saturation

        // HSV thresholds for green key (tuned to avoid teeth/skin removal)
        const hueCenter = 120; // pure green
        const hueWidth = 40;   // +/- range around green
        const minS = 0.25;     // minimum saturation to be considered key color
        const minV = 0.15;     // minimum value (brightness)

        // Feathering parameters
        const feather = 0.12;  // smooth edge width

        for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255;
            const g = d[i + 1] / 255;
            const b = d[i + 2] / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;

            // Compute HSV
            let h = 0;
            if (delta > 0.00001) {
                if (max === g) h = 60 * ((b - r) / delta + 2);
                else if (max === b) h = 60 * ((r - g) / delta + 4);
                else h = 60 * (((g - b) / delta) % 6);
            }
            if (h < 0) h += 360;
            const s = max === 0 ? 0 : delta / max;
            const v = max;

            // Distance from green hue
            const hueDiff = Math.min(Math.abs(h - hueCenter), 360 - Math.abs(h - hueCenter));

            // Key strength: 1.0 means fully transparent, 0.0 fully opaque
            let key = 0;
            if (isGreenBg) {
                if (s >= minS && v >= minV && hueDiff <= hueWidth + hueWidth * feather) {
                    // Soft step feathering
                    const edgeStart = hueWidth * (1 - feather);
                    if (hueDiff <= edgeStart) key = 1; // fully key out
                    else {
                        const t = (hueDiff - edgeStart) / (hueWidth * feather);
                        // smoothstep
                        key = t * t * (3 - 2 * t);
                        key = 1 - key; // invert to go from 1->0 across feather
                    }
                }
            } else if (isWhiteBg) {
                // Luma key for white: remove only very low-saturation high-value pixels (preserve teeth by requiring ultra-low saturation)
                const sat = s;
                if (v > 0.97 && sat < 0.05) {
                    key = 1;
                } else if (v > 0.93 && sat < 0.06) {
                    const t = (v - 0.93) / (0.97 - 0.93);
                    key = Math.max(0, Math.min(1, t * (1 - sat / 0.06)));
                }
            }

            // Apply alpha based on key (preserve whites/teeth/eyes)
            const origA = d[i + 3] / 255;
            const outA = Math.max(0, Math.min(1, origA * (1 - key)));
            d[i + 3] = Math.round(outA * 255);

            // Simple spill suppression: reduce green in semi-keyed pixels
            if (key > 0 && key < 1) {
                const spillFactor = key * 0.6; // tune amount
                const newG = Math.max(0, g - spillFactor * (g - Math.max(r, b)));
                d[i] = Math.round(r * 255);
                d[i + 1] = Math.round(newG * 255);
                d[i + 2] = Math.round(b * 255);
            }
        }

        // Draw with cover-style scaling (crop sides, fill height)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        // Match canvas to viewport for crisp scaling
        const cw = window.innerWidth;
        const ch = window.innerHeight;

        // Only resize canvas if dimensions changed (resizing clears canvas!)
        if (lastCanvasSizeRef.current.width !== cw || lastCanvasSizeRef.current.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
            lastCanvasSizeRef.current = { width: cw, height: ch };
        }

        const videoAspect = vw / vh;
        const canvasAspect = cw / ch;

        let drawW, drawH, sx = 0, sw = vw;
        const sy = 0, sh = vh;

        // Use constant scale factor for avatar size
        const scaleFactor = AVATAR_SCALE_FACTOR;

        // Cover-style: fill the canvas, crop what doesn't fit
        if (videoAspect > canvasAspect) {
            // Video is wider than canvas - crop horizontal sides
            drawH = Math.round(ch * scaleFactor);
            drawW = Math.round(drawH * videoAspect);

            // If portrait mode (narrow), crop more aggressively from sides
            if (canvasAspect < 1) {
                // Calculate source crop to center on the avatar
                const targetW = vh * canvasAspect; // width we want from video
                sx = Math.max(0, (vw - targetW) / 2); // center crop
                sw = targetW;
                drawW = Math.round(cw * scaleFactor);
                drawH = Math.round(drawW / canvasAspect);
            }
        } else {
            // Video is taller than canvas - crop top/bottom
            drawW = Math.round(cw * scaleFactor);
            drawH = Math.round(drawW / videoAspect);
        }

        // Center horizontally, anchor to bottom
        const dx = Math.floor((cw - drawW) / 2);
        const dy = Math.max(0, ch - drawH);

        // Put processed frame into an offscreen canvas at native size, then scale draw
        const processed = new ImageData(new Uint8ClampedArray(d), vw, vh);
        const off = tmpCanvas; // reuse tmpCanvas to blit processed frame
        off.width = vw;
        off.height = vh;
        const offCtx = off.getContext('2d')!;
        offCtx.putImageData(processed, 0, 0);

        ctx.clearRect(0, 0, cw, ch);
        // Draw with source crop (sx, sy, sw, sh) and destination scaling (dx, dy, drawW, drawH)
        ctx.drawImage(off, sx, sy, sw, sh, dx, dy, drawW, drawH);

        rafRef.current = requestAnimationFrame(makeBackgroundTransparent);
    };

    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    return {
        canvasRef,
        tmpCanvasRef,
        rafRef,
        startProcessing,
        stopProcessing,
        makeBackgroundTransparent
    };
}
