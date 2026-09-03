import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
  useToast,
} from '../../components/ui';
import BarcodeScanner from '../../components/BarcodeScanner.jsx';
import { scanBarcodeIntoLot } from '../../services/intakeApi.js';
import { formatPaise } from '../../platform/money.js';

export function ScanScreen({ trip, lot, colours, sizes, onBack, canScan }) {
  const toast = useToast();
  const [colourUuid, setColourUuid] = useState('');
  const [sizeUuid, setSizeUuid] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [scannedUnits, setScannedUnits] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const doScan = async (barcode) => {
    if (!canScan) return;
    const value = String(barcode || '').trim();
    if (!value) return;
    if (!colourUuid || !sizeUuid) {
      toast.warning({ title: 'Select colour and size first' });
      return;
    }
    setScanning(true);
    try {
      const unit = await scanBarcodeIntoLot(trip.uuid, lot.uuid, {
        barcode: value,
        colourUuid,
        sizeUuid,
      });
      setScannedUnits((prev) => [unit, ...prev]);
      toast.success({ title: `Scanned ${value}` });
      setManualBarcode('');
    } catch (err) {
      toast.error({ title: 'Scan failed', description: err.message });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}>&larr; Back to lots</Button>
          <h1 className="typography-heading mb-1 mt-1">Scan units into lot</h1>
          <p className="typography-body-sm text-[var(--ink-muted)]">
            {lot.productTypeName || 'Lot'} &middot; channel {lot.channel} &middot; qty {lot.quantity}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colour &amp; size for this batch</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Colour"
              className="min-w-[180px] flex-1"
              value={colourUuid}
              onChange={(e) => setColourUuid(e.target.value)}
              required
            >
              <option value="">Select colour…</option>
              {colours.map((c) => (
                <option key={c.uuid} value={c.uuid}>{c.name}</option>
              ))}
            </Select>
            <Select
              label="Size"
              className="min-w-[180px] flex-1"
              value={sizeUuid}
              onChange={(e) => setSizeUuid(e.target.value)}
              required
            >
              <option value="">Select size…</option>
              {sizes.map((s) => (
                <option key={s.uuid} value={s.uuid}>{s.name}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scan / enter barcodes</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {canScan ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label="Manual barcode"
                  className="min-w-[220px] flex-1"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Type or paste a barcode"
                  maxLength={12}
                />
                <Button onClick={() => doScan(manualBarcode)} loading={scanning}>
                  Add
                </Button>
              </div>
              <div className="mt-4">
                <Button variant={scannerOpen ? 'outline' : 'primary'} onClick={() => setScannerOpen((o) => !o)}>
                  {scannerOpen ? 'Hide camera scanner' : 'Open camera scanner'}
                </Button>
              </div>
              {scannerOpen && (
                <div className="mt-4">
                  <BarcodeScanner onDetected={(barcode) => doScan(barcode)} />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">You don't have permission to scan units into lots.</p>
          )}

          <h4 className="mt-5 mb-2 text-[15px] font-semibold">Scanned units ({scannedUnits.length})</h4>
          {scannedUnits.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No units scanned yet for this lot.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {scannedUnits.map((u) => (
                <li
                  key={u.uuid}
                  className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-2 px-3 text-sm"
                >
                  <span className="font-semibold text-primary">{u.barcode}</span>
                  <span className="ml-auto text-[var(--ink-muted)]">
                    {formatPaise(Number(u.sellingPricePaise))}
                  </span>
                  <Badge variant="success">{u.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ScanScreen;
