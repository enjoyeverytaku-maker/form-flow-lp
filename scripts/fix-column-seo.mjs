import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COLUMN_DIR = path.resolve(__dirname, '../column');

const files = fs.readdirSync(COLUMN_DIR).filter(f => f.endsWith('.html'));

let fixed = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(COLUMN_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');

  // --- 1. twitter:card がなければ追加 ---
  if (!html.includes('twitter:card')) {
    // og:title / og:description / og:image の値を抽出
    const ogTitle       = html.match(/<meta property="og:title"\s+content="([^"]+)"/)?.[1] ?? '';
    const ogDescription = html.match(/<meta property="og:description"\s+content="([^"]+)"/)?.[1] ?? '';
    const ogImage       = html.match(/<meta property="og:image"\s+content="([^"]+)"/)?.[1] ?? 'https://formflow.jp/ogp.png';

    const twitterBlock = `  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${ogImage}">`;

    // og:site_name の直後に挿入
    html = html.replace(
      /(<meta property="og:site_name"[^>]+>)/,
      `$1\n${twitterBlock}`
    );
  }

  // --- 2. Article JSON-LD に不足フィールドを補完 ---
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{([\s\S]*?)"@type":\s*"Article"([\s\S]*?)\}\s*<\/script>/,
    (match, before, after) => {
      // 既存の値を取り出す
      const headline      = match.match(/"headline":\s*"([^"]+)"/)?.[1] ?? '';
      const datePublished = match.match(/"datePublished":\s*"([^"]+)"/)?.[1] ?? '';
      const dateModified  = match.match(/"dateModified":\s*"([^"]+)"/)?.[1] ?? datePublished;

      // canonical URL を取り出す
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';

      // description を meta から取り出す
      const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? '';

      // 欠けている���ィールドだけ補完
      const needsMainEntity = !match.includes('"mainEntityOfPage"');
      const needsImage      = !match.includes('"image"');
      const needsDesc       = !match.includes('"description"');
      const needsUrl        = !match.includes('"url"');

      if (!needsMainEntity && !needsImage && !needsDesc && !needsUrl) return match;

      const additions = [];
      if (needsMainEntity && canonical) additions.push(`    "mainEntityOfPage": { "@type": "WebPage", "@id": "${canonical}" }`);
      if (needsImage)                    additions.push(`    "image": "https://formflow.jp/ogp.png"`);
      if (needsDesc && description)      additions.push(`    "description": "${description.replace(/"/g, '\\"')}"`);
      if (needsUrl && canonical)         additions.push(`    "url": "${canonical}"`);

      if (additions.length === 0) return match;

      // 最後の } の前に追加
      return match.replace(/\}\s*<\/script>$/, `,\n${additions.join(',\n')}\n  }\n  </script>`);
    }
  );

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✓ ${file}`);
  fixed++;
}

console.log(`\n完了: ${fixed}件修正, ${skipped}件スキップ`);
