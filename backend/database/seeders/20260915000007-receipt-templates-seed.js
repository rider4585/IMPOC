/**
 * Seed the first receipt templates (R-47).
 *
 * Inserts a default SALE template whose HTML matches the shop's physical
 * receipt (cream/brown theme, lotus monogram, "LOOK BEAUTIFUL EVERYDAY"
 * tagline). The template uses {{placeholders}} so the engine can render
 * it with real data at receipt time.
 *
 * All content lives in the database — no HTML files on disk.
 */

export const SALE_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt</title>
<style>
  :root {
    --cream: #F7F3EC;
    --ink: #6E4B2F;
    --ink-soft: rgba(110, 75, 47, 0.55);
    --tan-fill: #E7D9C4;
    --tan-border: #C9AE8E;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); }
  body {
    font-family: Georgia, 'Times New Roman', Times, serif;
    color: var(--ink);
  }
  .page {
    position: relative;
    width: 148mm;
    min-height: 210mm;
    margin: 0 auto;
    padding: 10mm 10mm 8mm;
    background: var(--cream);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .corner { position: absolute; opacity: 1; pointer-events: none; }
  .corner--tr { top: -14px; right: -14px; }
  .corner--bl { bottom: -18px; left: -18px; }
  .corner--br { bottom: -6px; right: 10%; opacity: 0.6; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; position: relative; z-index: 1; }
  .brand { display: flex; flex-direction: column; align-items: flex-start; }
  .monogram { width: 56px; height: 56px; margin-bottom: 4px; }
  .wordmark { font-size: 17px; font-weight: 700; letter-spacing: 4px; color: var(--ink); }
  .tagline { margin-top: 4px; font-size: 8px; letter-spacing: 1.2px; color: var(--ink); display: flex; align-items: center; gap: 5px; white-space: nowrap; }
  .arrow-svg { color: var(--ink); width: 20px; height: 7px; }
  .arrow-svg.arrow--rev { transform: scaleX(-1); }

  .meta { text-align: right; padding-top: 4px; min-width: 130px; }
  .meta .field { justify-content: flex-end; }
  .meta .field .label { white-space: nowrap; }

  .field { display: flex; align-items: baseline; gap: 6px; margin: 6px 0; font-size: 10.5px; }
  .field .label { white-space: nowrap; color: var(--ink); font-style: italic; }
  .field .value { flex: 0 1 auto; border-bottom: 1px dotted var(--ink-soft); padding-bottom: 1px; min-width: 30px; }
  .field--wide { width: 100%; }
  .field--wide .value { flex: 1; }

  .customer { position: relative; z-index: 1; margin-top: 10px; }

  table.items {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border: 1px solid var(--tan-border);
    margin-top: 12px;
    position: relative;
    z-index: 1;
  }
  table.items th, table.items td { padding: 5px 4px; font-size: 10px; }
  table.items thead th {
    background: var(--tan-fill);
    border-bottom: 1px solid var(--tan-border);
    color: var(--ink);
    font-weight: 700;
    letter-spacing: 0.3px;
    text-align: center;
  }
  table.items th + th, table.items td + td { border-left: 1px solid var(--tan-border); }
  table.items tbody td { border-bottom: 1px dotted var(--tan-border); }
  table.items tbody tr:last-child td { border-bottom: none; }
  table.items td.c-sno { text-align: center; }
  table.items td.c-desc { text-align: left; }
  table.items td.c-qty { text-align: center; }
  table.items td.c-rate { text-align: right; }
  table.items td.c-amt { text-align: right; }
  table.items .total-row td { font-weight: 700; }
  table.items .total-row .total-label { text-align: right; font-style: italic; }
  table.items .total-row .total-value { text-align: right; }

  .words { margin-top: 12px; position: relative; z-index: 1; }

  .spacer { flex: 1; min-height: 10px; }

  .foot { position: relative; z-index: 1; margin-top: 12px; }
  .thanks { text-align: center; font-size: 11px; font-style: italic; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 6px 0 14px; }
  .divider .line { width: 50px; height: 1px; background: var(--tan-border); }
  .sign { display: flex; justify-content: flex-end; }
  .sign-inner { text-align: center; }
  .sign-line { display: block; width: 110px; border-top: 1px solid var(--ink); margin-bottom: 3px; }
  .sign-label { font-size: 9px; font-style: italic; }

  .receipt-image-slot {
    border: 1px dashed var(--tan-border);
    background: rgba(201, 174, 142, 0.14);
    color: var(--ink-soft);
    font-size: 9px;
    font-style: italic;
    letter-spacing: 0.5px;
    text-align: center;
    padding: 12px 8px;
    margin: 8px 0;
    position: relative;
    z-index: 1;
  }

  @media print {
    @page { size: A5; margin: 0; }
    html, body { width: 148mm; }
    .page { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="page">

    <header class="head">
      <div class="brand">
        <svg class="monogram" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="96" fill="none" stroke="#C9AE8E" stroke-width="1" opacity="0.5"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(36 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(72 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(108 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(144 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(180 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(216 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(252 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(288 100 100)"/>
          <ellipse cx="100" cy="69" rx="22" ry="58" fill="none" stroke="#C9AE8E" stroke-width="1.4" opacity="0.85" transform="rotate(324 100 100)"/>
          <text x="100" y="132" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="80" font-weight="700" fill="#6E4B2F">\u0936\u094D\u0930\u0940</text>
        </svg>
        <div class="wordmark">{{store.wordmark}}</div>
        <div class="tagline">
          <svg class="arrow-svg" width="30" height="10" viewBox="0 0 30 10"><line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1"/><path d="M19 1 L27 5 L19 9 Z" fill="currentColor"/></svg>
          <span>LOOK BEAUTIFUL EVERYDAY</span>
          <svg class="arrow-svg arrow--rev" width="30" height="10" viewBox="0 0 30 10"><line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="1"/><path d="M19 1 L27 5 L19 9 Z" fill="currentColor"/></svg>
        </div>
      </div>
      <div class="meta">
        <div class="field"><span class="label">Bill No.</span><span class="value">{{transaction.number}}</span></div>
        <div class="field"><span class="label">Date :</span><span class="value">{{transaction.date}}</span></div>
      </div>
    </header>

    <!-- IMAGE SLOT: replace this whole div with your image later, e.g. <img src="your-image.png" style="width:100%" />. Delete the div to leave no gap. Hidden on printed receipts until you add a real image. -->
    <div class="receipt-image-slot" data-label="IMAGE SLOT - add your image here later">IMAGE SLOT - add your image here later</div>

    <div class="customer">
      <div class="field field--wide"><span class="label">Name :</span><span class="value">{{customer.name}}</span></div>
      <div class="field field--wide"><span class="label">Mobile No. :</span><span class="value">{{customer.phone}}</span></div>
    </div>

    <table class="items">
      <colgroup>
        <col style="width:8%" />
        <col style="width:44%" />
        <col style="width:12%" />
        <col style="width:16%" />
        <col style="width:20%" />
      </colgroup>
      <thead>
        <tr>
          <th class="c-sno">S.No.</th>
          <th class="c-desc">Description</th>
          <th class="c-qty">Qty.</th>
          <th class="c-rate">Rate</th>
          <th class="c-amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td class="c-sno">{{item.sno}}.</td>
          <td class="c-desc">{{item.description}}</td>
          <td class="c-qty">{{item.quantity}}</td>
          <td class="c-rate">{{item.rate}}</td>
          <td class="c-amt">{{item.amount}}</td>
        </tr>
        {{/each}}
        <tr class="total-row">
          <td colspan="3"></td>
          <td class="total-label">Total :</td>
          <td class="total-value">{{totals.total}}</td>
        </tr>
      </tbody>
    </table>

    <div class="words">
      <div class="field field--wide"><span class="label">Amount in Words :</span><span class="value">{{amountInWords}}</span></div>
    </div>

    <div class="spacer"></div>

    <footer class="foot">
      <div class="thanks">{{footer.text}}</div>
      <div class="divider">
        <span class="line"></span>
        <svg width="16" height="16" viewBox="0 0 100 100">
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(45 50 50)"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(90 50 50)"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(135 50 50)"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(180 50 50)"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(225 50 50)"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(270 50 50)"/>
          <ellipse cx="50" cy="32" rx="12" ry="32" fill="none" stroke="#6E4B2F" stroke-width="1.6" opacity="0.9" transform="rotate(315 50 50)"/>
        </svg>
        <span class="line"></span>
      </div>
      <div class="sign">
        <div class="sign-inner">
          <span class="sign-line"></span>
          <span class="sign-label">Signature</span>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;

/** @type {import('sequelize').QueryInterface} */
export async function up(queryInterface) {
    // Check if templates already exist (idempotent)
    const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM receipt_templates LIMIT 1`
    );
    if (existing.length > 0) return;

    // Get admin user ID for createdBy
    const [admins] = await queryInterface.sequelize.query(
        `SELECT u.id
           FROM users u
           JOIN user_roles ur ON ur.user_id = u.id
           JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'ADMIN'
          LIMIT 1`
    );
    const adminId = admins.length > 0 ? admins[0].id : null;

    const now = new Date();

    // Insert SALE template (published)
    await queryInterface.sequelize.query(
        `INSERT INTO receipt_templates
            (uuid, name, entity_type, version, html_content, editor_state, is_active, created_by, created_at, updated_at)
         VALUES
            (gen_random_uuid(), :name, 'SALE', 1, :html, NULL, true, :userId, :now, :now)`,
        {
            replacements: {
                name: 'Sale Receipt',
                html: SALE_TEMPLATE_HTML,
                userId: adminId,
                now,
            },
        }
    );

    // Insert RENTAL template (published — one active template per entity type)
    await queryInterface.sequelize.query(
        `INSERT INTO receipt_templates
            (uuid, name, entity_type, version, html_content, editor_state, is_active, created_by, created_at, updated_at)
         VALUES
            (gen_random_uuid(), :name, 'RENTAL', 1, :html, NULL, true, :userId, :now, :now)`,
        {
            replacements: {
                name: 'Rental Receipt',
                html: SALE_TEMPLATE_HTML,
                userId: adminId,
                now,
            },
        }
    );
}

/** @type {import('sequelize').QueryInterface} */
export async function down(queryInterface) {
    await queryInterface.sequelize.query(
        `DELETE FROM receipt_templates WHERE name IN ('Sale Receipt', 'Rental Receipt')`
    );
}
