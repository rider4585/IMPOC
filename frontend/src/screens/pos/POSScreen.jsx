import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../auth/useAuth.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { getUnitByBarcode } from '../../services/unitsApi.js';
import { createSale } from '../../services/salesApi.js';
import { formatPaise } from '../../platform/money.js';
import { SaleReceipt } from './SaleReceipt.jsx';
import './pos.css';

export function POSScreen() {
  const { permissions } = useAuth();
  const toast = useToast();
  const can = useCallback((p) => permissions && permissions.includes(p), [permissions]);

  const canCheckout = can(PERMISSIONS.SALES.CREATE);

  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [lookupError, setLookupError] = useState('');

  const totalPaise = useMemo(
    () => cart.reduce((sum, item) => sum + item.sellingPricePaise, 0),
    [cart]
  );

  const addByBarcode = useCallback(
    async (value) => {
      const b = String(value || '').trim();
      if (!b) return;
      setLookupError('');
      setBarcode('');
      try {
        const unit = await getUnitByBarcode(b);
        if (!unit) {
          setLookupError(`No unit found with barcode "${b}".`);
          toast.error({ title: 'Not found', description: `No unit with barcode "${b}".` });
          return;
        }
        if (unit.channel !== 'RETAIL') {
          toast.error({ title: 'Not sellable', description: 'This unit is a rental item and cannot be sold.' });
          return;
        }
        if (unit.status !== 'in_stock') {
          toast.error({ title: 'Not in stock', description: `Unit "${b}" is currently "${unit.status}".` });
          return;
        }
        if (cart.some((item) => item.uuid === unit.uuid)) {
          toast.warning({ title: 'Already in cart' });
          return;
        }
        setCart((prev) => [
          ...prev,
          {
            uuid: unit.uuid,
            barcode: unit.barcode,
            sellingPricePaise: Number(unit.sellingPricePaise),
          },
        ]);
        toast.success({ title: `Added ${unit.barcode}` });
      } catch (err) {
        setLookupError(err.message || 'Lookup failed');
        toast.error({ title: 'Lookup failed', description: err.message });
      }
    },
    [cart, toast]
  );

  const removeItem = (uuid) => {
    setCart((prev) => prev.filter((item) => item.uuid !== uuid));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setBarcode('');
    setReceipt(null);
    setLookupError('');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const sale = await createSale({
        customerName: customerName.trim() || undefined,
        items: cart.map((item) => ({ unitUuid: item.uuid })),
      });
      setReceipt(sale);
      setCart([]);
      setCustomerName('');
      setBarcode('');
      toast.success({ title: `Sale ${sale.saleNumber} completed` });
    } catch (err) {
      toast.error({ title: 'Checkout failed', description: err.message });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      addByBarcode(barcode);
    }
  };

  if (receipt) {
    return (
      <div className="pos-page">
        <SaleReceipt sale={receipt} />
        <div className="pos-new-sale">
          <Button onClick={() => setReceipt(null)}>New sale</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-page__header">
        <div>
          <h1 className="typography-heading">Point of Sale</h1>
          <p className="typography-body-sm pos-page__subtitle">
            Scan or look up sellable units, then checkout.
          </p>
        </div>
      </div>

      <div className="pos-layout">
        <div className="pos-main">
          <Card>
            <CardHeader>
              <CardTitle>Add items</CardTitle>
            </CardHeader>
            <CardContent className="pos-card__content">
              <Input
                label="Scan or enter barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scan barcode, then press Enter"
                autoFocus
                maxLength={12}
              />
              {lookupError && <div className="admin-error" role="alert">{lookupError}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cart ({cart.length})</CardTitle>
            </CardHeader>
            <CardContent className="pos-card__content">
              {cart.length === 0 ? (
                <p className="admin-muted">Cart is empty. Scan or enter a barcode to add items.</p>
              ) : (
                <ul className="pos-cart-list">
                  {cart.map((item) => (
                    <li key={item.uuid} className="pos-cart-item">
                      <span className="pos-cart-barcode">{item.barcode}</span>
                      <span className="pos-cart-price">{formatPaise(item.sellingPricePaise)}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.uuid)} aria-label={`Remove ${item.barcode}`}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="pos-side">
          <Card>
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="pos-card__content">
              <Input
                label="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
              />
              <div className="pos-total-row">
                <span>Total</span>
                <strong data-testid="pos-total">{formatPaise(totalPaise)}</strong>
              </div>
            </CardContent>
            <CardFooter className="pos-card__footer">
              <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>
                Clear
              </Button>
              <Button
                onClick={handleCheckout}
                loading={checkingOut}
                disabled={cart.length === 0}
                data-testid="pos-checkout"
              >
                {canCheckout ? 'Charge' : 'No permission'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default POSScreen;
