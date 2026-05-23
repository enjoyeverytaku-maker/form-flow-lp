import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LP_DIR = path.resolve(__dirname, '..');

const targets = ['service.html', 'cases.html', 'premium.html', 'column.html'];

for (const file of targets) {
  const filePath = path.join(LP_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('twitter:card')) {
    console.log(`skip: ${file} (already has twitter:card)`);
    continue;
  }

  const ogTitle       = html.match(/<meta property="og:title"\s+content="([^"]+)"/)?.[1] ?? '';
  const ogDescription = html.match(/<meta property="og:description"\s+content="([^"]+)"/)?.[1] ?? '';
  const ogImage       = html.match(/<meta property="og:image"\s+content="([^"]+)"/)?.[1] ?? 'https://formflow.jp/ogp.png';

  const twitterBlock = `\n  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${ogImage}">`;

  // og:site_name の後に挿入。なければ og:image の後に挿入
  if (html.includes('og:site_name')) {
    html = html.replace(/(<meta property="og:site_name"[^>]+>)/, `$1${twitterBlock}`);
  } else {
    html = html.replace(/(<meta property="og:image"[^>]+>)/, `$1${twitterBlock}`);
  }

  // og:image のサイズ指定がなければ追加
  if (!html.includes('og:image:width')) {
    html = html.replace(
      /(<meta property="og:image"\s+content="[^"]+">)/,
      `$1\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✓ ${file}`);
}

console.log('\n完了');
