import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button, SearchableSelect, useToast } from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getStock, scanBarcodeIntoStock } from '../../services/tripsApi.js';
import { getColours, getSizes, getProductTypes } from '../../services/picklistsApi.js';
import { formatPaise } from '../../platform/money.js';
import { wakingRequest } from '../../platform/wakingRequest.js';
import { createRequestKey } from '../../platform/requestKey.js';
import BarcodeScanner from '../../components/BarcodeScanner.jsx';

const STATES = { IDLE: 'idle', ARMED: 'armed', DECODED: 'decoded', SAVING: 'saving', STOCK_FULL: 'stock_full' };

export function StockIntake() {
  const { tripUuid, stockUuid } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);
  const canScan = can(PERMISSIONS.INVENTORY.CREATE);

  const [stock, setStock] = useState(null);
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [state, setState] = useState(STATES.IDLE);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [colourUuid, setColourUuid] = useState('');
  const [sizeUuid, setSizeUuid] = useState('');
  const [refusalInfo, setRefusalInfo] = useState(null);
  const [waking, setWaking] = useState(false);
  const [lastSavedColour, setLastSavedColour] = useState('');
  const [lastSavedSize, setLastSavedSize] = useState('');

  // Size-run state (passed via navigation state from StockForm)
  const navState = useLocation()?.state || {};
  const sizeRunEnabled = Boolean(navState?.sizeRun?.length > 0);
  const sizeRunSequence = navState?.sizeRun || [];
  const [sizeRunIndex, setSizeRunIndex] = useState(0);

  const [manualBarcode, setManualBarcode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [decodeFailHint, setDecodeFailHint] = useState(false);
  const decodeTimerRef = useRef(null);

  // UX-M1: inline save-failure — the worker keeps the decoded barcode + picks
  // and can retry from the panel instead of being dumped back to IDLE.
  const [saveError, setSaveError] = useState('');

  // UX-L4: cancelling the armed camera wipes prefilled state, so the stop
  // affordance asks "Confirm stop?" before actually tearing down.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const confirmTimerRef = useRef(null);

  // UX-M9: camera errors are surfaced by BarcodeScanner via onError; we show
  // an accessible Retry (remounts the scanner) + Stop affordance.
  const [scannerError, setScannerError] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  // UX-H5: guards the auto commit-repeat loop from double-firing while a save
  // is already in flight (e.g. colour/size change mid-save).
  const savingRef = useRef(false);

  const scannedCount = stock?.unitsScannedCount ?? 0;
  const quantity = stock ? Number(stock.quantity) : 0;
  const isFull = scannedCount >= quantity;

  const refreshStock = useCallback(async () => {
    if (!stockUuid) return null;
    const data = await getStock(tripUuid, stockUuid);
    if (data) setStock(data);
    return data;
  }, [tripUuid, stockUuid]);

  // Load stock data
  useEffect(() => {
    if (!stockUuid) return;
    setLoading(true);
    Promise.all([getStock(tripUuid, stockUuid), getColours(), getSizes(), getProductTypes()])
      .then(([stockData, colData, szData, typeData]) => {
        if (stockData) setStock(stockData);
        else setError('Stock not found');
        setColours(Array.isArray(colData) ? colData : colData?.items || []);
        setSizes(Array.isArray(szData) ? szData : szData?.items || []);
        setProductTypes(Array.isArray(typeData) ? typeData : typeData?.items || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tripUuid, stockUuid]);

  // Decode timer — after 10s armed with no decode, show hint + manual entry
  useEffect(() => {
    if (state === STATES.ARMED) {
      setDecodeFailHint(false);
      decodeTimerRef.current = setTimeout(() => setDecodeFailHint(true), 10000);
      return () => clearTimeout(decodeTimerRef.current);
    }
    return () => clearTimeout(decodeTimerRef.current);
  }, [state]);

  // Pre-fill colour/size from last saved unit
  useEffect(() => {
    if (state === STATES.DECODED) {
      if (lastSavedColour) setColourUuid(lastSavedColour);
      if (lastSavedSize && !sizeRunEnabled) setSizeUuid(lastSavedSize);
      else if (sizeRunEnabled && sizeRunSequence.length > 0) {
        setSizeUuid(sizeRunSequence[sizeRunIndex % sizeRunSequence.length]);
      }
    }
  }, [state, lastSavedColour, lastSavedSize, sizeRunEnabled, sizeRunSequence, sizeRunIndex]);

  // UX-H5: auto commit-repeat. As soon as the decoded unit has a colour AND a
  // size (either from prefill or the worker's picks), the save fires without a
  // tap. The loop is broken by refusals (keeps DECODED), inline save errors
  // (keeps DECODED + retry), or a completed stock (STOCK_FULL).
  useEffect(() => {
    if (state !== STATES.DECODED) return;
    if (refusalInfo || saveError || !scannedBarcode) return;
    if (!colourUuid || !sizeUuid) return;
    if (savingRef.current) return;
    handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, refusalInfo, saveError, colourUuid, sizeUuid, scannedBarcode]);

  const armCamera = () => {
    clearTimeout(confirmTimerRef.current);
    setScannedBarcode('');
    setColourUuid('');
    setSizeUuid('');
    setRefusalInfo(null);
    setSaveError('');
    setScannerError(false);
    setConfirmCancel(false);
    setShowManual(false);
    setDecodeFailHint(false);
    setState(STATES.ARMED);
  };

  const cancelScan = () => {
    clearTimeout(decodeTimerRef.current);
    clearTimeout(confirmTimerRef.current);
    setState(STATES.IDLE);
    setScannedBarcode('');
    setColourUuid('');
    setSizeUuid('');
    setRefusalInfo(null);
    setSaveError('');
    setScannerError(false);
    setConfirmCancel(false);
    setShowManual(false);
    setDecodeFailHint(false);
  };

  // UX-L4: lightweight two-tap guard — first tap arms "Confirm stop?", a
  // second tap (or a new decode) actually tears the camera down. Resets after
  // 3s so a mis-tap can't wipe the prefilled loop later.
  const handleCancelClick = () => {
    if (confirmCancel) {
      cancelScan();
      return;
    }
    setConfirmCancel(true);
    clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmCancel(false), 3000);
  };

  const handleRetryCamera = () => {
    setScannerError(false);
    setScannerKey((k) => k + 1);
  };

  const handleDetected = (barcode) => {
    if (state !== STATES.ARMED) return;
    clearTimeout(decodeTimerRef.current);
    clearTimeout(confirmTimerRef.current);
    setScannedBarcode(barcode);
    setRefusalInfo(null);
    setSaveError('');
    setConfirmCancel(false);
    setState(STATES.DECODED);
    // Haptic pulse
    try { navigator.vibrate?.(100); } catch {}
  };

  const handleManualSubmit = () => {
    const value = manualBarcode.trim();
    if (!value) return;
    clearTimeout(decodeTimerRef.current);
    setScannedBarcode(value);
    setRefusalInfo(null);
    setSaveError('');
    setState(STATES.DECODED);
    setShowManual(false);
    setManualBarcode('');
  };

  const handleSave = async () => {
    if (!scannedBarcode || !colourUuid || !sizeUuid) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveError('');
    setState(STATES.SAVING);
    setWaking(false);

    const requestKey = createRequestKey();
    const doSave = () =>
      scanBarcodeIntoStock(tripUuid, stockUuid, {
        barcode: scannedBarcode,
        colourUuid,
        sizeUuid,
      });

    try {
      const result = await wakingRequest(doSave, { requestKey });
      if (result?.status === 'waking') {
        setWaking(true);
      }
      // Refresh stock data to get updated count
      const updated = await refreshStock();

      // Save colour/size for pre-fill
      setLastSavedColour(colourUuid);
      setLastSavedSize(sizeUuid);

      // Advance size-run index
      if (sizeRunEnabled && sizeRunSequence.length > 0) {
        setSizeRunIndex((i) => (i + 1) % sizeRunSequence.length);
      }

      toast.success({ title: 'Unit saved' });
      try { navigator.vibrate?.(100); } catch {}
      setWaking(false);

      // UX-H5: auto re-arm the camera for the next unit — no "Scan next unit"
      // tap between units. STOCK_FULL still stops the loop.
      const newCount = updated?.unitsScannedCount ?? (scannedCount + 1);
      if (quantity > 0 && newCount >= quantity) {
        setState(STATES.STOCK_FULL);
      } else {
        setState(STATES.ARMED);
      }
    } catch (err) {
      const msg = err.message || 'Scan failed';
      if (msg.includes('already') || msg.includes('used') || msg.includes('barcode')) {
        setRefusalInfo({ barcode: scannedBarcode, message: msg });
        setState(STATES.DECODED);
        try { navigator.vibrate?.([100, 50, 100]); } catch {}
      } else if (err.statusCode === 404) {
        setRefusalInfo({ barcode: scannedBarcode, message: msg });
        setState(STATES.DECODED);
        try { navigator.vibrate?.([100, 50, 100]); } catch {}
      } else {
        // UX-M1: keep the decoded barcode + colour/size picks with an inline
        // retry instead of dumping the worker back to IDLE.
        setSaveError(msg);
        setState(STATES.DECODED);
        try { navigator.vibrate?.([100, 50, 100]); } catch {}
      }
      setWaking(false);
    } finally {
      savingRef.current = false;
    }
  };

  const dismissRefusal = () => {
    setRefusalInfo(null);
    armCamera();
  };

  const closeStock = () => {
    navigate(`/trips/${tripUuid}`);
  };

  if (!canScan) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <p className="text-sm text-[var(--ink-muted)]">You do not have permission to scan units.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-sunken)]" />
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/trips/${tripUuid}`)}>&larr; Back to trip</Button>
        <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">{error || 'Stock not found'}</div>
      </div>
    );
  }

  const nextSizeLabel = sizeRunEnabled && sizeRunSequence.length > 0
    ? sizes.find((s) => s.uuid === sizeRunSequence[sizeRunIndex % sizeRunSequence.length])?.name || '?'
    : null;

  // UX-L2: single STOCK_FULL panel shared by the post-save completion state and
  // the already-full-on-load case.
  const stockFullPanel = (
    <div className="w-full max-w-md text-center">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-lg">
        <p className="text-lg font-semibold text-[var(--success)]">{quantity} of {quantity} — stock complete</p>
        <Button onClick={closeStock} className="mt-4 w-full" data-testid="close-stock">
          Close stock
        </Button>
      </div>
    </div>
  );

  const stockTypeName = stock?.productType?.name
    || productTypes.find((t) => t.uuid === stock?.productTypeUuid)?.name
    || '';
  const stockSubTypeName = stock?.subType?.name
    || productTypes.find((t) => t.uuid === stock?.subTypeUuid)?.name
    || '';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-scan)]">
      {/* Back button */}
      <div className="absolute left-4 top-4 z-30">
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => navigate(`/trips/${tripUuid}`)}>
          &larr; Back
        </Button>
      </div>

      {/* Intake counter */}
      <div className="flex items-center justify-center pt-14 pb-4">
        <div className="text-center">
          <div
            className="text-5xl font-bold tabular-nums text-white"
            style={{ fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.02em' }}
            aria-live="polite"
          >
            {scannedCount} of {quantity}
          </div>
          <div className="mt-1 text-sm text-white/60">{stock.name || 'Stock'}</div>
        </div>
      </div>

      {/* Size-run chip */}
      {sizeRunEnabled && nextSizeLabel && state !== STATES.STOCK_FULL && (
        <div className="flex justify-center pb-2">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-foreground)]">
            Next: {nextSizeLabel}
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        {state === STATES.IDLE && !isFull && (
          <>
            <p className="mb-6 text-center text-sm text-white/50">
              {scannedCount > 0 ? 'Unit saved — scan the next one.' : 'Tap to arm the camera'}
            </p>
            <Button onClick={armCamera} className="w-full max-w-xs" data-testid="scan-barcode">
              {scannedCount > 0 ? 'Scan next unit' : 'Scan barcode'}
            </Button>
            {decodeFailHint && (
              <div className="mt-4 text-center">
                <p className="text-xs text-white/40">Hold the label flat, about 15cm from the camera</p>
              </div>
            )}
            <button
              type="button"
              className="mt-3 text-xs text-white/40 underline hover:text-white/60"
              onClick={() => setShowManual(true)}
            >
              Type the number instead
            </button>
          </>
        )}

        {state === STATES.ARMED && (
          <div className="w-full max-w-md">
            <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: '3/4', maxHeight: '60vh' }}>
              {scannerError ? (
                /* UX-M9: accessible camera-error card with real Retry + Stop. */
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg bg-[var(--surface-sunken)] px-6 text-center">
                  <p className="text-sm font-semibold text-[var(--ink)]">Camera unavailable</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Grant camera permission or make sure no other app is using the camera, then retry.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelScan}>Stop</Button>
                    <Button size="sm" onClick={handleRetryCamera} data-testid="retry-camera">Retry camera</Button>
                  </div>
                </div>
              ) : (
                <BarcodeScanner
                  key={scannerKey}
                  onDetected={handleDetected}
                  onError={() => setScannerError(true)}
                />
              )}
              {/* Glass overlay — stop with a two-tap confirm (UX-L4) */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <button
                  type="button"
                  className={
                    confirmCancel
                      ? 'rounded-full bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white'
                      : 'rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/80'
                  }
                  onClick={handleCancelClick}
                >
                  {confirmCancel ? 'Confirm stop?' : 'Stop camera'}
                </button>
              </div>
            </div>
            <div className="mt-3 text-center">
              {!scannerError && decodeFailHint && (
                <p className="text-xs text-white/40">Hold the label flat, about 15cm from the camera</p>
              )}
              <button
                type="button"
                className="mt-2 text-xs text-white/40 underline hover:text-white/60"
                onClick={() => { cancelScan(); setShowManual(true); }}
              >
                Type the number instead
              </button>
            </div>
          </div>
        )}

        {(state === STATES.DECODED || state === STATES.SAVING) && (
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-lg">
            {refusalInfo ? (
              /* Refusal state */
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--danger)]">Already used</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{refusalInfo.message}</p>
                <Button onClick={dismissRefusal} className="mt-4 w-full" data-testid="dismiss-refusal">
                  Dismiss
                </Button>
              </div>
            ) : (
              <>
                {/* Barcode display */}
                <div className="mb-4 text-center">
                  <span className="rounded bg-[var(--surface-sunken)] px-3 py-1.5 font-mono text-sm font-medium tracking-wider text-[var(--ink)]">
                    {scannedBarcode}
                  </span>
                </div>

                {/* Stock type + subtype */}
                {(stockTypeName || stockSubTypeName) && (
                  <div className="mb-1 text-center text-sm">
                    <span className="font-semibold text-[var(--ink)]">{stockTypeName || 'Type'}</span>
                    {stockSubTypeName && (
                      <span className="ml-1 font-medium text-[var(--ink-muted)]">· {stockSubTypeName}</span>
                    )}
                  </div>
                )}

                {/* Stock prices */}
                <div className="mb-4 text-center text-xs text-[var(--ink-muted)]">
                  Buy {formatPaise(Number(stock.buyingPricePaise))} · Sell {formatPaise(Number(stock.sellingPricePaise))}
                  {stock.channel === 'RENTAL' && stock.rentPerDayPaise && <> · Rent {formatPaise(Number(stock.rentPerDayPaise))}/day</>}
                </div>

                {/* Colour + Size fields */}
                <div className="flex flex-col gap-3">
                  <SearchableSelect
                    label="Colour"
                    value={colourUuid}
                    onChange={setColourUuid}
                    placeholder="Select colour…"
                    searchPlaceholder="Search colours…"
                    emptyMessage="No colours."
                    options={colours
                      .filter((c) => c.isActive !== false)
                      .map((c) => ({ value: c.uuid, label: c.name }))}
                  />

                  <SearchableSelect
                    label="Size"
                    value={sizeUuid}
                    onChange={setSizeUuid}
                    placeholder="Select size…"
                    searchPlaceholder="Search sizes…"
                    emptyMessage="No sizes."
                    options={sizes
                      .filter((s) => s.isActive !== false)
                      .map((s) => ({ value: s.uuid, label: s.name }))}
                  />
                </div>

                {waking && (
                  <div className="mt-3 rounded-md bg-[var(--accent)] p-2 text-center text-xs text-[var(--accent-foreground)]">
                    Waking the system up. This takes up to a minute. Nothing is lost.
                  </div>
                )}

                {saveError && (
                  <div className="mt-3 rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]" role="alert">
                    <p className="font-medium">Save failed</p>
                    <p className="mt-0.5">{saveError}</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={armCamera}>New barcode</Button>
                      <Button size="sm" onClick={handleSave} data-testid="retry-save">Retry save</Button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  loading={state === STATES.SAVING}
                  disabled={!colourUuid || !sizeUuid}
                  className="mt-4 w-full"
                  data-testid="save-unit"
                >
                  {saveError ? 'Retry save' : 'Save unit'}
                </Button>
              </>
            )}
          </div>
        )}

        {(state === STATES.STOCK_FULL || (isFull && state === STATES.IDLE)) && stockFullPanel}
      </div>

      {/* Manual barcode entry overlay */}
      {showManual && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={() => setShowManual(false)}>
          <div className="w-full max-w-md rounded-t-xl bg-[var(--surface-raised)] p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold">Enter barcode manually</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Type the barcode number"
                maxLength={12}
                className="flex-1 rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
              />
              <Button onClick={handleManualSubmit} disabled={!manualBarcode.trim()}>Submit</Button>
            </div>
            <button type="button" className="mt-2 text-xs text-[var(--ink-muted)]" onClick={() => setShowManual(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockIntake;