import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DD_CSS = `
.nav-dd{position:relative;}
.nav-dd-btn{background:none;border:none;cursor:pointer;font-size:14px;font-weight:500;color:var(--sub);display:flex;align-items:center;gap:4px;padding:0;font-family:inherit;transition:color .15s;}
.nav-dd-btn:hover,.nav-dd.open .nav-dd-btn{color:var(--text);}
.nav-dd-btn .arr{font-size:9px;transition:transform .2s;}
.nav-dd.open .arr{transform:rotate(180deg);}
.nav-dd-menu{position:absolute;top:calc(100% + 14px);left:50%;transform:translateX(-50%) translateY(-6px);background:#fff;border:1px solid var(--border);border-radius:10px;padding:6px;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.1);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;}
.nav-dd.open .nav-dd-menu{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0);}
.nav-dd-menu a{display:block;padding:8px 14px;font-size:13px;color:var(--sub);border-radius:6px;white-space:nowrap;transition:background .15s,color .15s;}
.nav-dd-menu a:hover{background:#f3f4f6;color:var(--text);}`;

const DD_JS = `
  document.querySelectorAll('.nav-dd').forEach(dd=>{
    dd.querySelector('.nav-dd-btn').addEventListener('click',e=>{
      e.stopPropagation();
      document.querySelectorAll('.nav-dd.open').forEach(o=>{if(o!==dd)o.classList.remove('open');});
      dd.classList.toggle('open');
    });
  });
  document.addEventListener('click',()=>document.querySelectorAll('.nav-dd.open').forEach(o=>o.classList.remove('open')));`;

function makeNavLinks(p) {
  return `<div class="nav-links">
      <a href="${p}cases.html">構築例</a>
      <div class="nav-dd">
        <button class="nav-dd-btn">サービス <span class="arr">▾</span></button>
        <div class="nav-dd-menu">
          <a href="${p}index.html#features">できること</a>
          <a href="${p}service.html#pricing">料金・プラン</a>
          <a href="${p}demo.html">デモ体験</a>
        </div>
      </div>
      <div class="nav-dd">
        <button class="nav-dd-btn">学ぶ <span class="arr">▾</span></button>
        <div class="nav-dd-menu">
          <a href="${p}column.html">コラム</a>
          <a href="${p}glossary/">用語解説</a>
        </div>
      </div>
      <a href="${p}about.html">制作者について</a>
      <a href="https://lin.ee/SD2HKgtW" target="_blank" rel="noopener" class="nav-cta">無料相談</a>
    </div>`;
}

function makeMobileMenu(p) {
  return `<div class="mobile-menu" id="mmenu">
  <a href="${p}cases.html">構築例</a>
  <a href="${p}index.html#features">できること</a>
  <a href="${p}service.html#pricing">料金・プラン</a>
  <a href="${p}demo.html">デモ体験</a>
  <a href="${p}column.html">コラム</a>
  <a href="${p}glossary/">用語解説</a>
  <a href="${p}about.html">制作者について</a>
  <a href="https://lin.ee/SD2HKgtW" target="_blank" rel="noopener" class="mc">無料相談・お問い合わせ</a>
</div>`;
}

// ファイルリスト: [filePath, pathPrefix, hasMobileMenu]
const targets = [
  // glossary pages
  ...['index.html','gas.html','richmenu.html','step-delivery.html','webhook.html',
      'keyword-reply.html','broadcast.html','line-oa.html']
    .map(f => [path.join(ROOT,'glossary',f), '../', false]),
  // cases pages
  ...['seitai-01.html','nail-salon-01.html','consultant-01.html',
      'beauty-01.html','lawyer-01.html','ec-01.html']
    .map(f => [path.join(ROOT,'cases',f), '../', false]),
  // tools
  [path.join(ROOT,'tools','gas-template.html'), '../', true],
  // root pages
  [path.join(ROOT,'demo.html'), './', true],
  [path.join(ROOT,'news.html'), './', true],
];

let updated = 0;

for (const [filePath, prefix, hasMobileMenu] of targets) {
  if (!fs.existsSync(filePath)) { console.log(`skip (not found): ${filePath}`); continue; }
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('nav-dd')) { console.log(`skip (already done): ${path.relative(ROOT, filePath)}`); continue; }

  // 1. CSS追加: </style> の直前
  html = html.replace(/(<\/style>)(?![\s\S]*<\/style>)/, `${DD_CSS}\n$1`);

  // 2. nav-links ブロックを置換（<div class="nav-links">...</div>）
  html = html.replace(/<div class="nav-links">[\s\S]*?<\/div>\s*<\/div>\s*<\/nav>/,
    match => match.replace(/<div class="nav-links">[\s\S]*?<\/div>(?=\s*<\/div>\s*<\/nav>)/, makeNavLinks(prefix))
  );

  // 3. mobile-menu ブロックを置換（ある場合のみ）
  if (hasMobileMenu) {
    html = html.replace(/<div class="mobile-menu"[^>]*>[\s\S]*?<\/div>(?=\s*\n*<!-- )/, makeMobileMenu(prefix));
  }

  // 4. JS追加: 最後の </script> の直前
  html = html.replace(/(<\/script>)(?![\s\S]*<\/script>)/, `${DD_JS}\n$1`);

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✓ ${path.relative(ROOT, filePath)}`);
  updated++;
}

console.log(`\n完了: ${updated}件`);
