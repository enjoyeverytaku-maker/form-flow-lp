import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLUMN_DIR = path.resolve(__dirname, '../column');

// 各記事に追加する関連リンク
const RULES = {
  'line-gas-automation-guide.html':   { glossary: ['gas','webhook'],         cases: [],             tools: ['gas-template'] },
  'line-webhook-gas.html':            { glossary: ['webhook','gas'],          cases: [],             tools: [] },
  'line-step-delivery-scenario.html': { glossary: ['step-delivery','richmenu'], cases: [],           tools: [] },
  'richmenu-design.html':             { glossary: ['richmenu'],               cases: [],             tools: [] },
  'lstep-vs-gas.html':                { glossary: ['gas'],                    cases: [],             tools: [] },
  'line-reservation-auto.html':       { glossary: ['gas'],                    cases: ['seitai-01'],  tools: [] },
  'line-jidou-henshin-settei.html':   { glossary: ['webhook','gas'],          cases: [],             tools: ['gas-template'] },
  'seitai-line-katsuyo.html':         { glossary: ['step-delivery'],          cases: ['seitai-01'],  tools: [] },
  'salon-line-katsuyo.html':          { glossary: ['richmenu','step-delivery'], cases: ['beauty-01'], tools: [] },
  'nail-salon-line.html':             { glossary: ['step-delivery'],          cases: ['nail-salon-01'], tools: [] },
  'consultant-line-katsuyo.html':     { glossary: ['step-delivery'],          cases: ['consultant-01'], tools: [] },
  'restaurant-line.html':             { glossary: ['richmenu'],               cases: ['beauty-01'],  tools: [] },
  'fudousan-line.html':               { glossary: ['webhook'],                cases: ['lawyer-01'],  tools: [] },
  'line-inquiry-automation.html':     { glossary: ['webhook','gas'],          cases: ['lawyer-01'],  tools: [] },
  'line-repeat-customer.html':        { glossary: ['step-delivery'],          cases: ['beauty-01'],  tools: [] },
  'line-friends-increase.html':       { glossary: ['richmenu'],               cases: [],             tools: ['gas-template'] },
  'line-hajimeru-mae.html':           { glossary: ['richmenu','step-delivery'], cases: [],           tools: [] },
  'line-kouchiku-daikou-hiyou.html':  { glossary: ['gas'],                    cases: ['seitai-01'],  tools: [] },
  'line-pricing-plan-2026.html':      { glossary: ['gas'],                    cases: [],             tools: [] },
};

const GLOSSARY_META = {
  'gas':           { href: '/glossary/gas.html',           label: 'GASでLINEを自動化する方法（用語解説）' },
  'webhook':       { href: '/glossary/webhook.html',       label: 'LINE×GASのWebhookとは（用語解説）' },
  'step-delivery': { href: '/glossary/step-delivery.html', label: 'LINEのステップ配信とは（用語解説）' },
  'richmenu':      { href: '/glossary/richmenu.html',      label: 'LINEのリッチメニューとは（用語解説）' },
};

const CASE_META = {
  'seitai-01':    { href: '/cases/seitai-01.html',    label: '事例：整体院｜キャンセル率60%減' },
  'nail-salon-01':{ href: '/cases/nail-salon-01.html', label: '事例：ネイルサロン｜再来率40%向上' },
  'consultant-01':{ href: '/cases/consultant-01.html', label: '事例：コンサルタント｜返信工数80%削減' },
  'beauty-01':    { href: '/cases/beauty-01.html',    label: '事例：美容室｜休眠顧客15%が再来店' },
  'lawyer-01':    { href: '/cases/lawyer-01.html',    label: '事例：弁護士事務所｜予約対応を完全自動化' },
  'ec-01':        { href: '/cases/ec-01.html',        label: '事例：EC・通販｜リピート率2.3倍' },
};

const TOOL_META = {
  'gas-template': { href: '/tools/gas-template.html', label: 'LINE×GASテンプレート無料配布' },
};

// インラインリンク: 本文中の最初の出現をリンク化するキーワードマップ
const INLINE_TERMS = [
  { pattern: /(?<![">\/])(?<!<[^>]*)(\bGAS\b)(?![^<]*<\/a>)/,        slug: 'gas' },
  { pattern: /(?<![">\/])(?<!<[^>]*)(Webhook)(?![^<]*<\/a>)/,         slug: 'webhook' },
  { pattern: /(?<![">\/])(?<!<[^>]*)(ステップ配信)(?![^<]*<\/a>)/,    slug: 'step-delivery' },
  { pattern: /(?<![">\/])(?<!<[^>]*)(リッチメニュー)(?![^<]*<\/a>)/, slug: 'richmenu' },
];

const CSS_RELATED = `
    /* 関連リンクボックス */
    .article-related{margin:48px 0 0;padding:24px 28px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;}
    .article-related h3{font-size:13px;font-weight:700;color:#6B7280;letter-spacing:.08em;margin-bottom:12px;}
    .article-related ul{list-style:none;display:flex;flex-direction:column;gap:6px;}
    .article-related li a{font-size:14px;color:#06C755;display:inline-flex;align-items:center;gap:5px;}
    .article-related li a::before{content:"→";flex-shrink:0;}
`;

// 本文テキスト部分（<style>や<script>の外）に対してのみ置換
function replaceFirstTermOutsideTag(html, term, href) {
  // <style>, <script>, <a> ブロックを除いた最初の出現を置換
  const chunks = [];
  let lastIndex = 0;
  let replaced = false;
  // <style>, <script>, <a タグのブロックをスキップ
  const skipRe = /(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<a[\s\S]*?<\/a>)/gi;
  let m;
  while ((m = skipRe.exec(html)) !== null) {
    const before = html.slice(lastIndex, m.index);
    if (!replaced) {
      const idx = before.search(term.pattern || new RegExp(term));
      if (idx !== -1) {
        const match = before.match(term.pattern || new RegExp(term));
        chunks.push(before.slice(0, idx));
        chunks.push(`<a href="${href}">${match[0]}</a>`);
        chunks.push(before.slice(idx + match[0].length));
        replaced = true;
      } else {
        chunks.push(before);
      }
    } else {
      chunks.push(before);
    }
    chunks.push(m[0]);
    lastIndex = m.index + m[0].length;
  }
  const rest = html.slice(lastIndex);
  if (!replaced) {
    const pat = term.pattern || new RegExp(term);
    const idx = rest.search(pat);
    if (idx !== -1) {
      const match = rest.match(pat);
      chunks.push(rest.slice(0, idx));
      chunks.push(`<a href="${href}">${match[0]}</a>`);
      chunks.push(rest.slice(idx + match[0].length));
    } else {
      chunks.push(rest);
    }
  } else {
    chunks.push(rest);
  }
  return chunks.join('');
}

const files = fs.readdirSync(COLUMN_DIR).filter(f => f.endsWith('.html'));
let fixed = 0;

for (const file of files) {
  const rule = RULES[file];
  if (!rule) { console.log(`no rule: ${file}`); continue; }

  const filePath = path.join(COLUMN_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('article-related')) { console.log(`already done: ${file}`); continue; }

  // ① 関連リンクボックスを生成
  const links = [];
  for (const g of rule.glossary) {
    const m = GLOSSARY_META[g];
    if (m) links.push(`<li><a href="${m.href}">${m.label}</a></li>`);
  }
  for (const c of rule.cases) {
    const m = CASE_META[c];
    if (m) links.push(`<li><a href="${m.href}">${m.label}</a></li>`);
  }
  for (const t of rule.tools) {
    const m = TOOL_META[t];
    if (m) links.push(`<li><a href="${m.href}">${m.label}</a></li>`);
  }

  const relatedBlock = `
      <div class="article-related">
        <h3>関連ページ</h3>
        <ul>
          ${links.join('\n          ')}
        </ul>
      </div>`;

  // </footer> の直前に挿入
  html = html.replace(/<footer>/, `${relatedBlock}\n\n<footer>`);

  // ② CSS を </style> の最後の直前に追加（未追加の場合のみ）
  if (!html.includes('article-related')) {
    // 既にブロック追加されているはずだが念のため
  }
  html = html.replace(/(<\/style>)(?![\s\S]*<\/style>)/, `${CSS_RELATED}  $1`);

  // ③ インラインキーワードリンク化（最初の出現のみ）
  for (const term of INLINE_TERMS) {
    const gMeta = GLOSSARY_META[term.slug];
    if (!gMeta) continue;
    // このファイルでそのglosary slugがruleにある場合のみリンク化
    if (!rule.glossary.includes(term.slug)) continue;
    html = replaceFirstTermOutsideTag(html, term, gMeta.href);
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✓ ${file}`);
  fixed++;
}

console.log(`\n完了: ${fixed}件`);
