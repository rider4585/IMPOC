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
import './intake.css';

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
    <div className="intake-page">
      <div className="intake-page__header">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}>&larr; Back to lots</Button>
          <h1 className="typography-heading">Scan units into lot</h1>
          <p className="typography-body-sm intake-page__subtitle">
            {lot.productTypeName || 'Lot'} &middot; channel {lot.channel} &middot; qty {lot.quantity}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colour &amp; size for this batch</CardTitle>
        </CardHeader>
        <CardContent className="intake-card__content">
          <div className="intake-inline-form">
            <Select
              label="Colour"
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
        <CardContent className="intake-card__content">
          {canScan ? (
            <>
              <div className="intake-inline-form">
                <Input
                  label="Manual barcode"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Type or paste a barcode"
                  maxLength={12}
                />
                <Button onClick={() => doScan(manualBarcode)} loading={scanning}>
                  Add
                </Button>
              </div>
              <div className="intake-scan-toggle">
                <Button variant={scannerOpen ? 'outline' : 'primary'} onClick={() => setScannerOpen((o) => !o)}>
                  {scannerOpen ? 'Hide camera scanner' : 'Open camera scanner'}
                </Button>
              </div>
              {scannerOpen && (
                <div className="intake-scanner">
                  <BarcodeScanner onDetected={(barcode) => doScan(barcode)} />
                </div>
              )}
            </>
          ) : (
            <p className="admin-muted">You don't have permission to scan units into lots.</p>
          )}

          <h4 className="intake-section-title">Scanned units ({scannedUnits.length})</h4>
          {scannedUnits.length === 0 ? (
            <p className="admin-muted">No units scanned yet for this lot.</p>
          ) : (
            <ul className="intake-unit-list">
              {scannedUnits.map((u) => (
                <li key={u.uuid} className="intake-unit-item">
                  <span className="intake-unit-barcode">{u.barcode}</span>
                  <span className="intake-unit-meta">
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
