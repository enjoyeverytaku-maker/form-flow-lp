import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLUMN_DIR = path.resolve(__dirname, '../column');

// CTA バリエーション
const CTA_A = (lead) => `
      <!-- インラインCTA -->
      <div class="inline-cta">
        <p class="inline-cta-lead">${lead}</p>
        <div class="inline-cta-buttons">
          <a href="/demo.html" class="inline-cta-btn inline-cta-btn--outline">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            デモを体験する
          </a>
          <a href="/service.html#pricing" class="inline-cta-btn inline-cta-btn--primary">
            料金・プランを確認する →
          </a>
        </div>
      </div>
`;

const CTA_C = (lead) => `
      <!-- インラインCTA -->
      <div class="inline-cta">
        <p class="inline-cta-lead">${lead}</p>
        <div class="inline-cta-buttons">
          <a href="/service.html#pricing" class="inline-cta-btn inline-cta-btn--primary">
            Form Flowの料金・プランを確認する →
          </a>
        </div>
      </div>
`;

const CSS = `
    /* インラインCTA */
    .inline-cta{margin:36px 0;padding:20px 24px;background:#EFF9F4;border:1.5px solid rgba(6,199,85,.3);border-radius:14px;}
    .inline-cta-lead{font-size:14px;color:#374151;margin-bottom:14px;font-weight:500;}
    .inline-cta-buttons{display:flex;gap:10px;flex-wrap:wrap;}
    .inline-cta-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;transition:background .2s,box-shadow .2s;}
    .inline-cta-btn--primary{background:#06C755;color:#fff;}
    .inline-cta-btn--primary:hover{background:#059942;box-shadow:0 4px 12px rgba(6,199,85,.35);}
    .inline-cta-btn--outline{background:#fff;color:#06C755;border:1.5px solid #06C755;}
    .inline-cta-btn--outline:hover{background:#EFF9F4;}
    @media(max-width:480px){.inline-cta-buttons{flex-direction:column;}.inline-cta-btn{justify-content:center;}}
`;

// ファイルごとの設定
// skip: true → 挿入しない
// before: 正規表現 → そのh2の直前に挿入
// variant: 'A' or 'C'
// lead: 吹き出し文言
const RULES = {
  'line-webhook-gas.html':        { skip: true },
  '_snippet_inline_cta.html':     { skip: true },

  // 費用比較系
  'line-kouchiku-daikou-hiyou.html': {
    before: /(<h2[^>]*>まとめ)/,
    variant: 'C',
    lead: 'Form Flowに依頼した場合の費用はこちらで確認できます',
  },
  'lstep-vs-gas.html': {
    before: /(<h2[^>]*>どちらを選ぶべきか)/,
    variant: 'A',
    lead: '「どちらを選べばいいかわからない」場合は、まずデモで動きを確認してみてください',
  },
  'line-pricing-plan-2026.html': {
    before: /(<h2[^>]*>「無料でどこまでできるか」)/,
    variant: 'C',
    lead: 'LINE公式の設定を代わりに構築してほしい方はこちら',
  },

  // 業種別
  'seitai-line-katsuyo.html':     { before: /(<h2[^>]*>まとめ)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },
  'salon-line-katsuyo.html':      { before: /(<h2[^>]*>どこから始めれば)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },
  'nail-salon-line.html':         { before: /(<h2[^>]*>まとめ)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },
  'restaurant-line.html':         { before: /(<h2[^>]*>まとめ)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },
  'consultant-line-katsuyo.html': { before: /(<h2[^>]*>「待つ」から「仕組みで回す」へ)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },
  'fudousan-line.html':           { before: /(<h2[^>]*>まとめ)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },

  // ノウハウ系
  'line-reservation-auto.html':       { before: /(<h2[^>]*>まとめ)/, variant: 'A', lead: '「実際どんな動きをするの？」と気になった方へ' },
  'line-repeat-customer.html':        { before: /(<h2[^>]*>まとめ)/, variant: 'A', lead: '「実際どんな動きをするの？」と気になった方へ' },
  'line-inquiry-automation.html':     { before: /(<h2[^>]*>まず「夜間の問い合わせ」)/, variant: 'A', lead: '「実際どんな動きをするの？」と気になった方へ' },
  'line-step-delivery-scenario.html': { before: /(<h2[^>]*>Step 1)/, variant: 'A', lead: '「実際どんな動きをするの？」と気になった方へ' },
  'line-gas-automation-guide.html':   { before: /(<h2[^>]*>「動く仕組みを持つこと」)/, variant: 'A', lead: '「実際どんな動きをするの？」と気になった方へ' },
  'line-friends-increase.html':       { before: /(<h2[^>]*>7追加後のメッセージ)/, variant: 'A', lead: '友だちを増やした後は、LINEの自動化を整えましょう' },
  'line-hajimeru-mae.html':           { before: /(<h2[^>]*>小さく始めて)/, variant: 'A', lead: '「設定まで自分でやるのは難しい」という方へ' },
  'richmenu-design.html':             { before: /(<h2[^>]*>設計に正解はない)/, variant: 'A', lead: '「実際のデモを見てみたい」という方へ' },
  'line-jidou-henshin-settei.html':   { before: /(<h2[^>]*>自動返信でよくある失敗)/, variant: 'A', lead: '「自分で設定するのが難しい」と感じたら、代わりに構築します' },
};

const files = fs.readdirSync(COLUMN_DIR).filter(f => f.endsWith('.html'));

let fixed = 0;
for (const file of files) {
  const rule = RULES[file];
  if (rule?.skip) { console.log(`skip: ${file}`); continue; }
  if (!rule) { console.log(`no rule: ${file}`); continue; }

  const filePath = path.join(COLUMN_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // すでに挿入済みならスキップ
  if (html.includes('inline-cta')) { console.log(`already done: ${file}`); continue; }

  // CSS を </style> の最後の手前に追加
  html = html.replace(/(<\/style>)(?![\s\S]*<\/style>)/, `${CSS}  $1`);

  // CTA HTML を生成
  const ctaHtml = rule.variant === 'C'
    ? CTA_C(rule.lead)
    : CTA_A(rule.lead);

  // 挿入
  const newHtml = html.replace(rule.before, `${ctaHtml}      $1`);

  if (newHtml === html) {
    console.log(`⚠ no match: ${file}`);
    continue;
  }

  fs.writeFileSync(filePath, newHtml, 'utf8');
  console.log(`✓ ${file}`);
  fixed++;
}

console.log(`\n完了: ${fixed}件`);
