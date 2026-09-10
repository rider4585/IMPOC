import {
    BrowserMultiFormatReader,
    HTMLCanvasElementLuminanceSource,
} from '@zxing/browser';
import {
    BarcodeFormat,
    DecodeHintType,
    MultiFormatReader,
    BinaryBitmap,
    HybridBinarizer,
} from '@zxing/library';
import {
    useEffect,
    useRef,
    useState,
} from 'react';

import '../BarcodeScanner.css';

const SCAN_PAUSE_DURATION = 5;

/*
 * Default zoom level.
 */
const DEFAULT_ZOOM = 1;

function BarcodeScanner({ onDetected, onError }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    /*
     * Native BarcodeDetector.
     *
     * Used when supported by the browser.
     */
    const detectorRef = useRef(null);

    /*
     * ZXing reader.
     *
     * Used as fallback when BarcodeDetector
     * is unavailable.
     */
    const codeReaderRef = useRef(null);

    /*
     * ZXing controls returned by continuous
     * decode operation.
     */
    const zxingControlsRef = useRef(null);

    /*
     * Native BarcodeDetector animation loop.
     */
    const animationFrameRef = useRef(null);

    /*
     * Pause timer.
     */
    const pauseTimerRef = useRef(null);

    /*
     * Prevent overlapping native detections.
     */
    const detectingRef = useRef(false);

    /*
     * Guards against starting the camera twice.
     *
     * React StrictMode invokes mount effects twice
     * in development; getUserMedia must only run once.
     */
    const startRequestedRef = useRef(false);

    /*
     * Shared pause state.
     *
     * Refs are used here because both the native
     * detector and ZXing callbacks need the latest
     * value without depending on React re-renders.
     */
    const pausedRef = useRef(false);

    /*
     * Audio context for scan success sound.
     */
    const audioContextRef = useRef(null);

    const [started, setStarted] = useState(false);
    const [barcode, setBarcode] = useState('');
    const [scanPaused, setScanPaused] =
        useState(false);
    const [remainingSeconds, setRemainingSeconds] =
        useState(0);
    const [error, setError] = useState('');

    /*
     * ---------------------------------------------------------
     * Zoom state
     * ---------------------------------------------------------
     */

    const [zoom, setZoom] =
        useState(DEFAULT_ZOOM);

    /*
     * Actual camera zoom range.
     *
     * These are discovered after the camera
     * has been opened.
     */
    const [zoomRange, setZoomRange] =
        useState(null);

    /*
     * Zoom delta applied by the floating
     * stepper controls.
     */
    const ZOOM_STEP = 0.5;

    /*
     * Torch state.
     */
    const [torchSupported, setTorchSupported] =
        useState(false);

    const [torchEnabled, setTorchEnabled] =
        useState(false);

    /*
     * ---------------------------------------------------------
     * Create ZXing Code 128 reader
     * ---------------------------------------------------------
     */

    const createZXingReader = () => {
        const hints = new Map();

        /*
         * Our product barcodes are Code 128.
         *
         * Restricting ZXing to this format makes
         * scanning considerably faster.
         */
        hints.set(
            DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.CODE_128]
        );

        /*
         * NOTE: we deliberately do NOT set DecodeHintType.TRY_HARDER.
         * TRY_HARDER makes ZXing's 1D reader rotate each frame 90°
         * (HTMLCanvasElementLuminanceSource.rotate), and that canvas-rotate
         * path throws "Could not create a Canvas element" on Windows Chrome
         * with @zxing/browser 0.2.1 (works on macOS/iOS). Code 128 is a
         * horizontal barcode, so the rotated pass isn't needed — dropping the
         * hint fixes Windows scanning and makes each frame faster.
         */

        return new BrowserMultiFormatReader(
            hints
        );
    };

    /*
     * ---------------------------------------------------------
     * Success sound
     * ---------------------------------------------------------
     */

    const playSuccessSound = () => {
        try {
            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContext) {
                return;
            }

            if (!audioContextRef.current) {
                audioContextRef.current =
                    new AudioContext();
            }

            const audioContext =
                audioContextRef.current;

            if (
                audioContext.state ===
                'suspended'
            ) {
                audioContext.resume();
            }

            const oscillator =
                audioContext.createOscillator();

            const gain =
                audioContext.createGain();

            oscillator.type = 'sine';

            oscillator.frequency.setValueAtTime(
                1000,
                audioContext.currentTime
            );

            oscillator.frequency.setValueAtTime(
                1400,
                audioContext.currentTime + 0.08
            );

            gain.gain.setValueAtTime(
                0.0001,
                audioContext.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.25,
                audioContext.currentTime + 0.01
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                audioContext.currentTime + 0.15
            );

            oscillator.connect(gain);
            gain.connect(
                audioContext.destination
            );

            oscillator.start();

            oscillator.stop(
                audioContext.currentTime + 0.15
            );
        } catch {
            /*
             * Sound is optional.
             */
        }
    };

    /*
     * ---------------------------------------------------------
     * Vibration
     * ---------------------------------------------------------
     */

    const vibrateOnSuccess = () => {
        if ('vibrate' in navigator) {
            navigator.vibrate(100);
        }
    };

    /*
     * ---------------------------------------------------------
     * Barcode detected
     * ---------------------------------------------------------
     */

    const handleBarcodeDetected = (value) => {
        if (
            !value ||
            pausedRef.current
        ) {
            return;
        }

        setBarcode(value);

        playSuccessSound();
        vibrateOnSuccess();

        if (typeof onDetected === 'function') {
            onDetected(value);
        }

        pauseScanning();
    };

    /*
     * ---------------------------------------------------------
     * Pause scanning after successful scan
     * ---------------------------------------------------------
     */

    const pauseScanning = () => {
        pausedRef.current = true;

        setScanPaused(true);

        setRemainingSeconds(
            SCAN_PAUSE_DURATION
        );

        let remaining =
            SCAN_PAUSE_DURATION;

        if (pauseTimerRef.current) {
            clearInterval(
                pauseTimerRef.current
            );
        }

        pauseTimerRef.current =
            setInterval(() => {
                remaining -= 1;

                setRemainingSeconds(
                    remaining
                );

                if (remaining <= 0) {
                    clearInterval(
                        pauseTimerRef.current
                    );

                    pauseTimerRef.current =
                        null;

                    pausedRef.current = false;

                    setScanPaused(false);
                    setRemainingSeconds(0);
                }
            }, 1000);
    };

    /*
     * ---------------------------------------------------------
     * Floating zoom stepper
     * ---------------------------------------------------------
     */

    const changeZoom = async (delta) => {
        const stream =
            streamRef.current;

        if (
            !stream ||
            !zoomRange
        ) {
            return;
        }

        const track =
            stream.getVideoTracks()[0];

        if (!track) {
            return;
        }

        const current =
            typeof zoom === 'number'
                ? zoom
                : DEFAULT_ZOOM;

        const nextZoom = Math.min(
            Math.max(
                current + delta,
                zoomRange.min
            ),
            zoomRange.max
        );

        if (nextZoom === current) {
            return;
        }

        try {
            await track.applyConstraints({
                advanced: [{ zoom: nextZoom }],
            });

            setZoom(nextZoom);
        } catch (zoomError) {
            console.error(
                'Unable to change zoom:',
                zoomError
            );
        }
    };

    /*
     * ---------------------------------------------------------
     * Toggle flashlight / torch
     * ---------------------------------------------------------
     */

    const toggleTorch = async () => {
        const stream =
            streamRef.current;

        if (
            !stream ||
            !torchSupported
        ) {
            return;
        }

        const track =
            stream.getVideoTracks()[0];

        if (!track) {
            return;
        }

        const nextState =
            !torchEnabled;

        try {
            await track.applyConstraints({
                advanced: [
                    {
                        torch: nextState,
                    },
                ],
            });

            setTorchEnabled(
                nextState
            );
        } catch (torchError) {
            console.error(
                'Unable to change flashlight:',
                torchError
            );
        }
    };

    /*
     * ---------------------------------------------------------
     * Start camera
     * ---------------------------------------------------------
     */

    const startCamera = async () => {
        if (startRequestedRef.current) {
            return;
        }

        startRequestedRef.current = true;

        try {
            setError('');
            setBarcode('');
            setScanPaused(false);
            setRemainingSeconds(0);

            setTorchSupported(false);
            setTorchEnabled(false);

            setZoomRange(null);

            pausedRef.current = false;

            /*
             * Create ZXing reader.
             */
            codeReaderRef.current =
                createZXingReader();

            /*
             * Request rear/environment camera.
             */
            const stream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video: {
                            facingMode: {
                                ideal: 'environment',
                            },

                            width: {
                                ideal: 1920,
                            },

                            height: {
                                ideal: 1080,
                            },

                            frameRate: {
                                ideal: 30,
                                max: 60,
                            },
                        },

                        audio: false,
                    }
                );

            streamRef.current = stream;

            const track =
                stream.getVideoTracks()[0];

            /*
             * -------------------------------------------------
             * Camera configuration
             * -------------------------------------------------
             */

            try {
                const capabilities =
                    track.getCapabilities();

                /*
                 * -------------------------------------------------
                 * Zoom
                 * -------------------------------------------------
                 */

                if (capabilities.zoom) {
                    const min =
                        capabilities.zoom.min;

                    const max =
                        capabilities.zoom.max;

                    setZoomRange({
                        min,
                        max,
                    });

                    /*
                     * Clamp requested zoom to the
                     * actual camera-supported range.
                     */
                    const currentZoom =
                        typeof zoom === 'number'
                            ? zoom
                            : DEFAULT_ZOOM;

                    const appliedZoom =
                        Math.min(
                            Math.max(
                                currentZoom,
                                min
                            ),
                            max
                        );

                    /*
                     * Update UI if requested zoom was
                     * outside camera capabilities.
                     */
                    if (
                        appliedZoom !==
                        currentZoom
                    ) {
                        setZoom(
                            appliedZoom
                        );
                    }

                    await track.applyConstraints({
                        advanced: [
                            {
                                zoom: appliedZoom,
                            },
                        ],
                    });
                } else {
                    /*
                     * Camera doesn't expose zoom
                     * capability.
                     */
                    setZoomRange(null);
                }

                /*
                 * -------------------------------------------------
                 * Continuous autofocus
                 * -------------------------------------------------
                 */

                if (
                    capabilities.focusMode &&
                    capabilities.focusMode.includes(
                        'continuous'
                    )
                ) {
                    await track.applyConstraints({
                        advanced: [
                            {
                                focusMode:
                                    'continuous',
                            },
                        ],
                    });
                }

                /*
                 * -------------------------------------------------
                 * Torch support
                 * -------------------------------------------------
                 *
                 * We DO NOT turn it on automatically.
                 */
                if (capabilities.torch) {
                    setTorchSupported(true);
                    setTorchEnabled(false);
                }
            } catch (
                cameraConfigurationError
                ) {
                console.warn(
                    'Unable to configure camera capabilities:',
                    cameraConfigurationError
                );
            }

            /*
             * -------------------------------------------------
             * Native BarcodeDetector
             * -------------------------------------------------
             */

            detectorRef.current = null;

            if (
                'BarcodeDetector' in
                window
            ) {
                try {
                    const supportedFormats =
                        await BarcodeDetector.getSupportedFormats();

                    if (
                        supportedFormats.includes(
                            'code_128'
                        )
                    ) {
                        detectorRef.current =
                            new BarcodeDetector({
                                formats: [
                                    'code_128',
                                ],
                            });
                    }
                } catch {
                    detectorRef.current = null;
                }
            }

            setStarted(true);
        } catch (cameraError) {
            console.error(
                'Unable to access camera:',
                cameraError
            );

            /*
             * Allow the user to retry.
             */
            startRequestedRef.current = false;

            /*
             * Clean up partially opened camera.
             */
            if (streamRef.current) {
                streamRef.current
                    .getTracks()
                    .forEach((track) => {
                        try {
                            track.stop();
                        } catch {
                            // Ignore cleanup errors.
                        }
                    });

                streamRef.current = null;
            }

            if (
                cameraError.name ===
                'NotAllowedError'
            ) {
                setError(
                    'Camera permission denied.'
                );
            } else if (
                cameraError.name ===
                'NotFoundError'
            ) {
                setError(
                    'No camera found.'
                );
            } else {
                setError(
                    'Unable to access camera.'
                );
            }

            if (typeof onError === 'function') {
                onError();
            }
        }
    };

    /*
     * ---------------------------------------------------------
     * Attach camera stream to video
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (
            !started ||
            !videoRef.current ||
            !streamRef.current
        ) {
            return;
        }

        const video =
            videoRef.current;

        video.srcObject =
            streamRef.current;

        video.play().catch((playError) => {
            console.error(
                'Unable to start video:',
                playError
            );
        });

        return () => {
            video.pause();
            video.srcObject = null;
        };
    }, [started]);

    /*
     * ---------------------------------------------------------
     * Native BarcodeDetector
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (
            !started ||
            !detectorRef.current
        ) {
            return;
        }

        let cancelled = false;

        const detect = async () => {
            if (cancelled) {
                return;
            }

            const video =
                videoRef.current;

            if (
                !video ||
                video.readyState <
                HTMLMediaElement.HAVE_METADATA
            ) {
                animationFrameRef.current =
                    requestAnimationFrame(
                        detect
                    );

                return;
            }

            if (!pausedRef.current) {
                if (
                    !detectingRef.current
                ) {
                    detectingRef.current =
                        true;

                    try {
                        const results =
                            await detectorRef.current.detect(
                                video
                            );

                        if (
                            results &&
                            results.length
                        ) {
                            const result =
                                results[0];

                            if (
                                result.rawValue
                            ) {
                                handleBarcodeDetected(
                                    result.rawValue
                                );
                            }
                        }
                    } catch {
                        /*
                         * Ignore individual frame
                         * detection failures.
                         */
                    } finally {
                        detectingRef.current =
                            false;
                    }
                }
            }

            animationFrameRef.current =
                requestAnimationFrame(
                    detect
                );
        };

        detect();

        return () => {
            cancelled = true;

            if (
                animationFrameRef.current
            ) {
                cancelAnimationFrame(
                    animationFrameRef.current
                );

                animationFrameRef.current =
                    null;
            }

            detectingRef.current =
                false;
        };
    }, [started]);

    /*
     * ---------------------------------------------------------
     * ZXing Code 128 fallback
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (
            !started ||
            detectorRef.current
        ) {
            return;
        }

        let cancelled = false;

        const startZXing = async () => {
            const video =
                videoRef.current;

            const reader =
                codeReaderRef.current;

            if (
                !video ||
                !reader
            ) {
                return;
            }

            /*
             * Wait for camera metadata.
             */
            if (
                video.readyState <
                HTMLMediaElement.HAVE_METADATA
            ) {
                await new Promise(
                    (resolve) => {
                        const handleLoadedMetadata =
                            () => {
                                video.removeEventListener(
                                    'loadedmetadata',
                                    handleLoadedMetadata
                                );

                                resolve();
                            };

                        video.addEventListener(
                            'loadedmetadata',
                            handleLoadedMetadata
                        );
                    }
                );
            }

            if (cancelled) {
                return;
            }

            /*
             * Manual capture + decode loop.
             *
             * We deliberately do NOT use reader.decodeFromVideoElement(): it
             * draws the <video> to a 2D canvas via drawImage(video), which
             * returns a BLACK frame on Windows Chrome with hardware-accelerated
             * video decode — the preview looks fine but every capture is blank,
             * so nothing ever decodes. Instead we pull CPU-side frames with
             * ImageCapture.grabFrame() (fallback createImageBitmap(video)), draw
             * those onto our own canvas, and decode with @zxing/library. This
             * path works on iOS, macOS and Windows.
             */
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
            const multiReader = new MultiFormatReader();
            multiReader.setHints(hints);

            const captureCanvas = document.createElement('canvas');

            let imageCapture = null;
            try {
                const track = streamRef.current?.getVideoTracks?.()[0];
                if (track && typeof window !== 'undefined' && 'ImageCapture' in window) {
                    imageCapture = new window.ImageCapture(track);
                }
            } catch {
                imageCapture = null;
            }

            /*
             * Some Windows Chrome + GPU combos hand back a BLACK frame from the
             * video/GPU pipeline (grabFrame / drawImage(video) / createImageBitmap
             * (video)) even though the live preview looks fine — so nothing ever
             * decodes. ImageCapture.takePhoto() uses the camera's still pipeline
             * and returns real pixels. We start on the fast per-frame path and,
             * if we detect several all-black captures in a row, switch to a slower
             * takePhoto loop for the rest of the session.
             */
            let useTakePhoto = false;
            let blackStreak = 0;

            const canvasIsBlack = (ctx, w, h) => {
                try {
                    const sx = Math.max(0, Math.floor(w / 2) - 16);
                    const sy = Math.max(0, Math.floor(h / 2) - 16);
                    const { data } = ctx.getImageData(sx, sy, 32, 32);
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] || data[i + 1] || data[i + 2]) return false;
                    }
                    return true;
                } catch {
                    return false;
                }
            };

            const grabBitmap = async () => {
                if (useTakePhoto && imageCapture) {
                    const blob = await imageCapture.takePhoto();
                    return await createImageBitmap(blob);
                }
                if (imageCapture) {
                    try {
                        return await imageCapture.grabFrame();
                    } catch {
                        // grabFrame can throw if the track is not ready — fall
                        // back to createImageBitmap for the rest of the session.
                        imageCapture = null;
                    }
                }
                return await createImageBitmap(video);
            };

            const decodeLoop = async () => {
                if (cancelled) return;

                if (
                    !pausedRef.current &&
                    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
                ) {
                    try {
                        const bitmap = await grabBitmap();
                        const w = bitmap.width;
                        const h = bitmap.height;

                        if (w && h) {
                            if (captureCanvas.width !== w) captureCanvas.width = w;
                            if (captureCanvas.height !== h) captureCanvas.height = h;

                            const ctx = captureCanvas.getContext('2d', {
                                willReadFrequently: true,
                            });
                            ctx.drawImage(bitmap, 0, 0, w, h);
                            if (bitmap.close) bitmap.close();

                            // Detect the black-frame GPU bug and switch pipelines.
                            if (!useTakePhoto && imageCapture) {
                                if (canvasIsBlack(ctx, w, h)) {
                                    if (++blackStreak >= 4) useTakePhoto = true;
                                } else {
                                    blackStreak = 0;
                                }
                            }

                            try {
                                const source = new HTMLCanvasElementLuminanceSource(captureCanvas);
                                const binary = new BinaryBitmap(new HybridBinarizer(source));
                                // decodeWithState keeps the CODE_128 hints set above.
                                // multiReader.decode(image) resets hints each call and
                                // would scan every format (QR, etc.) — slow and noisy.
                                const result = multiReader.decodeWithState(binary);
                                const value = result && result.getText();

                                if (value && !cancelled && !pausedRef.current) {
                                    handleBarcodeDetected(value);
                                }
                            } catch {
                                // NotFoundException — no barcode in this frame.
                            } finally {
                                multiReader.reset();
                            }
                        }
                    } catch {
                        // Frame grab failed this tick — retry next frame.
                    }
                }

                if (!cancelled) {
                    // Throttle: ~8/s on the fast path, gentler for takePhoto
                    // (which is heavier). Keeps CPU + log noise down.
                    const delay = useTakePhoto ? 500 : 120;
                    animationFrameRef.current = window.setTimeout(() => {
                        decodeLoop();
                    }, delay);
                }
            };

            zxingControlsRef.current = {
                stop: () => {
                    if (animationFrameRef.current) {
                        clearTimeout(animationFrameRef.current);
                        animationFrameRef.current = null;
                    }
                },
            };

            decodeLoop();
        };

        startZXing();

        return () => {
            cancelled = true;

            if (
                zxingControlsRef.current
            ) {
                try {
                    zxingControlsRef.current.stop();
                } catch {
                    /*
                     * Scanner is already stopping.
                     */
                }

                zxingControlsRef.current =
                    null;
            }
        };
    }, [started]);

    /*
     * ---------------------------------------------------------
     * Start camera on mount
     * ---------------------------------------------------------
     *
     * The camera is opened as soon as the scanner
     * is mounted; there is no start screen.
     *
     * The guard inside startCamera prevents the
     * camera from being opened twice (e.g. under
     * React StrictMode in development).
     */
    useEffect(() => {
        /*
         * Defer the initial start out of the effect's
         * synchronous body; startCamera resets state
         * (setError) which is not allowed synchronously.
         */
        const timer = setTimeout(() => {
            startCamera();
        }, 0);

        return () => {
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /*
     * ---------------------------------------------------------
     * Component cleanup
     * ---------------------------------------------------------
     */

    useEffect(() => {
        return () => {
            if (
                animationFrameRef.current
            ) {
                cancelAnimationFrame(
                    animationFrameRef.current
                );
            }

            if (
                zxingControlsRef.current
            ) {
                try {
                    zxingControlsRef.current.stop();
                } catch {
                    /*
                     * Already stopped.
                     */
                }
            }

            if (pauseTimerRef.current) {
                clearInterval(
                    pauseTimerRef.current
                );
            }

            if (streamRef.current) {
                streamRef.current
                    .getTracks()
                    .forEach((track) => {
                        try {
                            track.stop();
                        } catch {
                            /*
                             * Already stopped.
                             */
                        }
                    });
            }

            if (audioContextRef.current) {
                audioContextRef.current
                    .close()
                    .catch(() => {});
            }
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * UI
     * ---------------------------------------------------------
     */

    return (
        <div className="barcode-scanner">
            {!started && !error && (
                <div className="scanner-starting">
                    Starting camera…
                </div>
            )}

            {error && (
                <div className="scanner-start">
                    <div className="scanner-start-content">
                        <div className="scanner-start-title">
                            Barcode Scanner
                        </div>

                        <div className="scanner-error">
                            {error}
                        </div>

                        <button
                            type="button"
                            className="scanner-start-button"
                            onClick={startCamera}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {started && (
                <div className="scanner">
                    {torchSupported && (
                        <button
                            type="button"
                            className={`scanner-torch ${
                                torchEnabled
                                    ? 'active'
                                    : ''
                            }`}
                            onClick={toggleTorch}
                            aria-label={
                                torchEnabled
                                    ? 'Turn flashlight off'
                                    : 'Turn flashlight on'
                            }
                        >
                            <span
                                className="scanner-torch-icon"
                                aria-hidden="true"
                            >
                                🔦
                            </span>

                            <span>
                                {torchEnabled
                                    ? 'ON'
                                    : 'OFF'}
                            </span>
                        </button>
                    )}

                    <div className="scanner-camera">
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                        />

                        {zoomRange && (
                            <div className="scanner-zoom">
                                <button
                                    type="button"
                                    className="scanner-zoom-button"
                                    onClick={() =>
                                        changeZoom(
                                            -ZOOM_STEP
                                        )
                                    }
                                    aria-label="Zoom out"
                                >
                                    −
                                </button>

                                <span className="scanner-zoom-value">
                                    {zoom}×
                                </span>

                                <button
                                    type="button"
                                    className="scanner-zoom-button"
                                    onClick={() =>
                                        changeZoom(
                                            ZOOM_STEP
                                        )
                                    }
                                    aria-label="Zoom in"
                                >
                                    +
                                </button>
                            </div>
                        )}

                        {scanPaused && (
                            <div className="scanner-pause-message">
                                <span>
                                    Scanning paused
                                </span>

                                <strong>
                                    {
                                        remainingSeconds
                                    }
                                    s
                                </strong>
                            </div>
                        )}

                        <div className="scanner-overlay">
                            <div
                                className={`scanner-frame ${
                                    scanPaused
                                        ? 'paused'
                                        : ''
                                }`}
                            >
                                <span className="corner top-left" />
                                <span className="corner top-right" />
                                <span className="corner bottom-left" />
                                <span className="corner bottom-right" />
                            </div>
                        </div>

                        {barcode && (
                            <div className="scanner-result">
                                {barcode}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default BarcodeScanner;