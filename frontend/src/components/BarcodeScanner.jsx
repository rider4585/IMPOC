import {
    BrowserMultiFormatReader,
} from '@zxing/browser';
import {
    BarcodeFormat,
    DecodeHintType,
} from '@zxing/library';
import {
    useEffect,
    useRef,
    useState,
} from 'react';

import '../BarcodeScanner.css';

const SCAN_PAUSE_DURATION = 5;

/*
 * Default zoom shown on the start screen.
 */
const DEFAULT_ZOOM = 1;

function BarcodeScanner({ onDetected }) {
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

    const [zoomError, setZoomError] =
        useState('');

    /*
     * Actual camera zoom range.
     *
     * These are discovered after the camera
     * has been opened.
     */
    const [zoomRange, setZoomRange] =
        useState(null);

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

        hints.set(
            DecodeHintType.TRY_HARDER,
            true
        );

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
     * Zoom input
     * ---------------------------------------------------------
     */

    const handleZoomChange = (event) => {
        const value = event.target.value;

        /*
         * Allow the input to be temporarily empty
         * while the user is editing it.
         */
        if (value === '') {
            setZoom('');
            setZoomError('');

            return;
        }

        const numericValue =
            Number(value);

        if (
            !Number.isFinite(
                numericValue
            )
        ) {
            return;
        }

        /*
         * Keep zoom positive.
         */
        if (numericValue <= 0) {
            setZoomError(
                'Zoom must be greater than 0.'
            );

            setZoom(value);

            return;
        }

        setZoomError('');
        setZoom(numericValue);
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
        /*
         * Validate zoom before requesting camera.
         */
        const requestedZoom =
            Number(zoom);

        if (
            !Number.isFinite(
                requestedZoom
            ) ||
            requestedZoom <= 0
        ) {
            setZoomError(
                'Please enter a valid zoom value greater than 0.'
            );

            return;
        }

        try {
            setError('');
            setZoomError('');
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
                    const appliedZoom =
                        Math.min(
                            Math.max(
                                requestedZoom,
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
                        requestedZoom
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

            try {
                const controls =
                    await reader.decodeFromVideoElement(
                        video,
                        (result) => {
                            if (
                                cancelled ||
                                pausedRef.current
                            ) {
                                return;
                            }

                            if (result) {
                                const value =
                                    result.getText();

                                if (value) {
                                    handleBarcodeDetected(
                                        value
                                    );
                                }
                            }
                        }
                    );

                if (cancelled) {
                    controls?.stop?.();

                    return;
                }

                zxingControlsRef.current =
                    controls;
            } catch (zxingError) {
                if (!cancelled) {
                    console.error(
                        'ZXing scanner failed:',
                        zxingError
                    );
                }
            }
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
     * Stop camera
     * ---------------------------------------------------------
     */

    const stopCamera = () => {
        /*
         * Stop native BarcodeDetector loop.
         */
        if (
            animationFrameRef.current
        ) {
            cancelAnimationFrame(
                animationFrameRef.current
            );

            animationFrameRef.current =
                null;
        }

        /*
         * Stop ZXing.
         */
        if (
            zxingControlsRef.current
        ) {
            try {
                zxingControlsRef.current.stop();
            } catch {
                /*
                 * Scanner may already be stopped.
                 */
            }

            zxingControlsRef.current =
                null;
        }

        /*
         * Stop pause timer.
         */
        if (pauseTimerRef.current) {
            clearInterval(
                pauseTimerRef.current
            );

            pauseTimerRef.current =
                null;
        }

        /*
         * Stop camera tracks.
         *
         * This also releases the torch.
         */
        if (streamRef.current) {
            streamRef.current
                .getTracks()
                .forEach((track) => {
                    try {
                        track.stop();
                    } catch {
                        /*
                         * Track already stopped.
                         */
                    }
                });

            streamRef.current = null;
        }

        /*
         * Reset scanner state.
         */
        detectorRef.current = null;
        codeReaderRef.current = null;

        detectingRef.current = false;
        pausedRef.current = false;

        setStarted(false);
        setScanPaused(false);
        setRemainingSeconds(0);
        setBarcode('');
        setError('');

        setTorchSupported(false);
        setTorchEnabled(false);

        /*
         * Keep the user's selected zoom.
         *
         * This means when they reopen the scanner,
         * the same zoom value will be used.
         */
    };

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
            {!started && (
                <div className="scanner-start">
                    <div className="scanner-start-content">
                        <div className="scanner-start-title">
                            Barcode Scanner
                        </div>

                        <div className="scanner-zoom-input">
                            <label htmlFor="scanner-zoom">
                                Camera Zoom
                            </label>

                            <div className="scanner-zoom-input-wrapper">
                                <input
                                    id="scanner-zoom"
                                    type="number"
                                    inputMode="decimal"
                                    min="0.1"
                                    step="0.1"
                                    value={zoom}
                                    onChange={
                                        handleZoomChange
                                    }
                                    aria-describedby={
                                        zoomError
                                            ? 'scanner-zoom-error'
                                            : undefined
                                    }
                                />

                                <span>
                                    ×
                                </span>
                            </div>

                            {zoomError && (
                                <div
                                    id="scanner-zoom-error"
                                    className="scanner-zoom-error"
                                >
                                    {zoomError}
                                </div>
                            )}

                            {zoomRange && (
                                <div className="scanner-zoom-range">
                                    Camera supports{' '}
                                    {zoomRange.min}×
                                    {' – '}
                                    {zoomRange.max}×
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className="scanner-start-button"
                            onClick={startCamera}
                        >
                            Start Scanner
                        </button>

                        {error && (
                            <div className="scanner-error">
                                {error}
                            </div>
                        )}
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

                    <button
                        type="button"
                        className="scanner-close"
                        onClick={stopCamera}
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

export default BarcodeScanner;