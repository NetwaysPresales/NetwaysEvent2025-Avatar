'use client';

import { useRef, useEffect } from 'react';

// Avatar rendering constants
const AVATAR_SCALE_FACTOR = 0.80; // Scale avatar to 80% of viewport height

export function useGreenScreen() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tmpCanvasRef = useRef<HTMLCanvasElement>(null); // Kept for compatibility, though not strictly needed for WebGL
    const rafRef = useRef<number | null>(null);
    const processingRef = useRef(false);

    // WebGL refs
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const textureRef = useRef<WebGLTexture | null>(null);
    const positionBufferRef = useRef<WebGLBuffer | null>(null);
    const texCoordBufferRef = useRef<WebGLBuffer | null>(null);
    const texStepLocationRef = useRef<WebGLUniformLocation | null>(null);

    const startProcessing = () => {
        if (processingRef.current) return;

        processingRef.current = true;

        // Initialize WebGL if not done
        if (!glRef.current && canvasRef.current) {
            initWebGL(canvasRef.current);
        }

        renderLoop();
    };

    const stopProcessing = () => {
        processingRef.current = false;
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    const initWebGL = (canvas: HTMLCanvasElement) => {
        const gl = canvas.getContext('webgl', {
            premultipliedAlpha: false,
            alpha: true
        });

        if (!gl) {
            console.error('WebGL not supported');
            return;
        }
        glRef.current = gl;

        // Vertex shader: pass position and texture coordinates
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        // Fragment shader: HSV conversion and chroma keying with 5-tap smoothing
        const fsSource = `
            precision mediump float;
            uniform sampler2D u_image;
            uniform vec2 u_texStep; // texture texel size (1/width, 1/height)
            varying vec2 v_texCoord;

            vec3 rgb2hsv(vec3 c) {
                vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
                vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
                vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
                float d = q.x - min(q.w, q.y);
                float e = 1.0e-10;
                return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
            }

            float getAlpha(vec3 color) {
                vec3 hsv = rgb2hsv(color);
                float hue = hsv.x;
                float sat = hsv.y;
                float val = hsv.z;

                float targetHue = 0.333; 
                float hueDist = abs(hue - targetHue);
                if (hueDist > 0.5) hueDist = 1.0 - hueDist;

                float hueThresh = 0.07;  // Narrower Green range
                float satThresh = 0.45;  // Higher saturation threshold to protect hair
                float valThresh = 0.15; 

                // Basic Key
                if (hueDist < hueThresh && sat > satThresh && val > valThresh) {
                   return 0.0;
                }
                return 1.0;
            }

            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                vec3 hsv = rgb2hsv(color.rgb);
                
                float hue = hsv.x;
                float sat = hsv.y;
                float val = hsv.z;

                // Green Target
                float targetHue = 0.333; 
                float hueDist = abs(hue - targetHue);
                if (hueDist > 0.5) hueDist = 1.0 - hueDist;

                // Thresholds
                // Core Green (Definitely Background)
                float hueThresh = 0.08; 
                float satThresh = 0.40; // High saturation threshold to protect hair/white clothes
                float valThresh = 0.30; // High value threshold to protect dark hair
                
                // Edge Tolerance (Transition zone for smoothing)
                float hueTolerance = 0.05;

                float mask = 1.0;
                
                // Chroma Key Logic using Smoothstep for soft edges
                if (sat > satThresh && val > valThresh) {
                    // map hueDist from [hueThresh, hueThresh + hueTolerance] to [0, 1]
                    // pixels closer to green (low hueDist) become 0 (transparent)
                    // pixels further from green become 1 (opaque)
                    mask = smoothstep(hueThresh, hueThresh + hueTolerance, hueDist);
                }

                // Simple Spill Suppression (Despill)
                // If pixel is semi-transparent or fully green, reduce Green component
                if (mask < 0.9) {
                     color.g = min(color.g, max(color.r, color.b));
                }

                gl_FragColor = vec4(color.rgb, color.a * mask);
            }
        `;

        // Compile shaders
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const program = createProgram(gl, vertexShader!, fragmentShader!);

        if (!program) return;
        programRef.current = program;

        // Look up locations
        // const positionLocation = gl.getAttribLocation(program, "a_position"); // Unused in this simplified setup?
        // const texCoordLocation = gl.getAttribLocation(program, "a_texCoord"); // Unused
        const texStepLocation = gl.getUniformLocation(program, "u_texStep");
        texStepLocationRef.current = texStepLocation;

        // Provide texture coordinates for the rectangle.
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ]), gl.STATIC_DRAW);
        texCoordBufferRef.current = texCoordBuffer;

        // Create a buffer for the position of the rectangle corners.
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // We will update these dynamic positions in render loop based on aspect ratio
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1,
        ]), gl.STATIC_DRAW);
        positionBufferRef.current = positionBuffer;

        // Create a texture.
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        textureRef.current = texture;
    };

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
        const program = gl.createProgram();
        if (!program) return null;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    };

    const renderLoop = () => {
        if (!processingRef.current) return;

        const video = document.getElementById('avatar-video') as HTMLVideoElement;
        const canvas = canvasRef.current;
        const gl = glRef.current;
        const program = programRef.current;

        if (!video || !canvas || !gl || !program || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(renderLoop);
            return;
        }

        // 1. Resize Canvas to window
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
            gl.viewport(0, 0, cw, ch);
        }

        // 2. Upload video frame to texture
        gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        // 3. Clear
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 4. Setup Program
        gl.useProgram(program);

        // 5. Calculate Aspect Ratios for "Cover" Style with Scale
        const vw = video.videoWidth || 1920;
        const vh = video.videoHeight || 1080;
        const videoAspect = vw / vh;
        const canvasAspect = cw / ch;

        // Set texture step uniform
        if (texStepLocationRef.current) {
            gl.uniform2f(texStepLocationRef.current, 1.0 / vw, 1.0 / vh);
        }

        // We want avatar at 80% height (AVATAR_SCALE_FACTOR)

        // Apply Avatar Scale Factor hack? 
        // The original efficient code did a complex drawImage. 
        // For WebGL 'Cover':
        // If we draw -1 to 1, we fill screen.
        // We need to adjust Vertex Coordinates to maintain aspect ratio relative to viewport.

        // Let's compute vertices in Normalized Device Coordinates (NDC)
        // We want the video to be centered and cover the screen (or fit specific logic).
        // The original logic: "Cover-style: fill the canvas, crop what doesn't fit" + AVATAR_SCALE_FACTOR.

        // Actually, let's stick to standard "Cover" first for simplicity and full screen quality.
        // If the user wants the avatar smaller (80%), we scale the quad down.

        let width = 1.0;
        let height = 1.0;

        // StartWith: Fit Width or Fit Height to cover
        if (videoAspect > canvasAspect) {
            // Video is wider: Height is limiting factor for Coverage. 
            // Scale width > 1.0
            width = videoAspect / canvasAspect;
        } else {
            // Video is taller: Width is limiting
            height = canvasAspect / videoAspect;
        }

        // Apply scaling factor (make avatar smaller)
        width *= AVATAR_SCALE_FACTOR;
        height *= AVATAR_SCALE_FACTOR;

        // Center at bottom: Move Y down
        // 1.0 is top, -1.0 is bottom.
        // Current quad is centered at 0,0 (height 2.0). 
        // We want bottom of quad to be at -1.0.
        // Current bottom is -height. Shift y by -1.0 - (-height) = height - 1.0? 
        // No. Center is 0. Height is `height * 2` in NDC? No.
        // Let's assume vertex array is -1 to 1.

        // Let's construct vertices dynamically
        const w = width; // NDC half-width effectively if we assume base is square? No. 
        const h = height;

        // Quad coords:
        // Left: -w, Right: w
        // Top: -1 + 2*h, Bottom: -1  (Anchor to bottom)

        const x1 = -w;
        const x2 = w;
        const y1 = -1.0;
        const y2 = -1.0 + (h * 2.0);

        const vertices = new Float32Array([
            x1, y1,
            x2, y1,
            x1, y2,
            x1, y2,
            x2, y1,
            x2, y2,
        ]);

        // 6. Bind buffers and draw
        const positionLocation = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW); // Update vertices
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        gl.enableVertexAttribArray(texCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        rafRef.current = requestAnimationFrame(renderLoop);
    };

    // Public method to be compatible with old interface, though unnecessary in WebGL render loop
    const makeBackgroundTransparent = () => {
        // No-op, managed by renderLoop
    };

    useEffect(() => {
        return () => {
            stopProcessing();
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
