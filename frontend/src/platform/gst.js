/**
 * GST helpers (R-51). Pure, client-side; money in integer paise.
 *
 * Vendors charge CGST + SGST on purchases. The stock form shows the true
 * per-unit cost (buying price + GST) so the inventory manager can pick a
 * selling price with the tax already counted.
 */

/**
 * Per-unit landed cost.
 *
 * @param {object} p
 * @param {number|null} p.buyingPricePaise   per-unit buying price (pre-GST)
 * @param {number|null} p.wholeBuyingPricePaise  whole-lot price, used when the per-unit price is absent
 * @param {number} p.quantity                 units in the lot (for whole-lot pricing)
 * @param {number} p.cgstRatePct              e.g. 2.5
 * @param {number} p.sgstRatePct              e.g. 2.5
 * @returns {{ basePaise:number, gstPaise:number, totalPaise:number, ratePct:number }|null}
 *   null when there is no usable buying price yet
 */
export function landedCostPerUnit({ buyingPricePaise, wholeBuyingPricePaise, quantity, cgstRatePct, sgstRatePct }) {
  let basePaise = null;
  if (Number.isFinite(buyingPricePaise) && buyingPricePaise > 0) {
    basePaise = buyingPricePaise;
  } else if (Number.isFinite(wholeBuyingPricePaise) && wholeBuyingPricePaise > 0 && Number.isInteger(quantity) && quantity > 0) {
    basePaise = Math.round(wholeBuyingPricePaise / quantity);
  }
  if (basePaise == null) return null;

  const ratePct = (Number(cgstRatePct) || 0) + (Number(sgstRatePct) || 0);
  const gstPaise = Math.round((basePaise * ratePct) / 100);

  return { basePaise, gstPaise, totalPaise: basePaise + gstPaise, ratePct };
}

/** Parse a percent input ("2.5", "", "abc") -> number | NaN; empty = 0. */
export function parsePercent(str) {
  const trimmed = String(str ?? '').trim();
  if (trimmed === '') return 0;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return NaN;
  const value = Number(trimmed);
  return value > 100 ? NaN : value;
}
