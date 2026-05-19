// ============================================================
// あおば税理士法人 LINE — ② バッチプロジェクト
// 役割：顧問先への月次一斉送信（チャンク処理・タイムアウト対策）
// Form Flow - プレミアムプランデモ
//
// 【デモ用カスタムメニュー】
// スプレッドシートを開くと「デモ操作」メニューが表示される
//
// 【GASトリガー設定】
//   sendMonthlyReminderStart  → 毎月10日 9:00
//   sendTaxCalendarStart      → 毎月 1日 9:00
//
// 【チャンク処理の仕組み】
//   顧問先が増えても6分制限でタイムアウトしないよう、
//   1回の実行でCHUNK_SIZE件だけ処理し、残りは1分後に
//   自動で続きのトリガーを作成して継続する。
// ============================================================

// スクリプトプロパティから読み込む（GAS → プロジェクトの設定 → スクリプトプロパティ）
// CHANNEL_ACCESS_TOKEN : チャンネルアクセストークン（長期）
// FORM_URL             : 書類提出フォームのURL
const PROPS = PropertiesService.getScriptProperties();

const CONFIG = {
  CHANNEL_ACCESS_TOKEN: PROPS.getProperty('CHANNEL_ACCESS_TOKEN'),
  SHEET_ID_CLIENTS:     '1ZeR23VFivSn_62S_fNJOQwmZUl1A9Lw3wjPfS_dltSA', // 顧問先
  FORM_URL:             PROPS.getProperty('FORM_URL') || '',
};

const CHUNK_SIZE = 50; // 1回の実行で処理する顧問先の件数

// ============================================================
// 【毎月10日トリガー】書類提出リマインダー — 開始点
// ============================================================
function sendMonthlyReminderStart() {
  PropertiesService.getScriptProperties().deleteProperty('REMINDER_OFFSET');
  sendMonthlyReminderChunk();
}

// チャンク実行（自動継続）
function sendMonthlyReminderChunk() {
  const props  = PropertiesService.getScriptProperties();
  const offset = parseInt(props.getProperty('REMINDER_OFFSET') || '0');

  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID_CLIENTS).getSheetByName('顧問先');
  if (!sheet) return;

  const rows  = sheet.getDataRange().getValues().slice(1); // ヘッダー除外
  const month = new Date().getMonth() + 1;
  const chunk = rows.slice(offset, offset + CHUNK_SIZE);

  chunk.forEach(row => {
    const userId = (row[0] || '').toString().trim();
    if (!userId || !userId.startsWith('U')) return;
    sendPush(userId, [{
      type: 'text',
      text: `【書類提出のご案内】📂\n\n${month}月分の書類提出期限が近づいています。\n\n▶ 提出書類（例）\n・通帳のコピー（当月分）\n・領収書・請求書\n・給与明細（従業員がいる場合）\n\n今月の期限：${month}月末日\n\nご提出はこちらから：\n${CONFIG.FORM_URL}\n\nご不明な点はお気軽にご連絡ください。\nあおば税理士法人`
    }]);
  });

  if (offset + CHUNK_SIZE < rows.length) {
    // 続きあり → 1分後に再実行するトリガーを作成
    props.setProperty('REMINDER_OFFSET', String(offset + CHUNK_SIZE));
    deleteSelfTrigger('sendMonthlyReminderChunk');
    ScriptApp.newTrigger('sendMonthlyReminderChunk')
      .timeBased().after(60 * 1000).create();
  } else {
    // 完了 → 状態クリア
    props.deleteProperty('REMINDER_OFFSET');
    deleteSelfTrigger('sendMonthlyReminderChunk');
  }
}

// ============================================================
// 【毎月1日トリガー】税務カレンダー配信 — 開始点
//
// スプレッドシート「顧問先」列構成：
//   A: userId / B: 名前 / C: 区分（個人 or 法人）/ D: 決算月（法人・数字）
//   E: 納期の特例（○/×）/ F: 消費税（○/×）/ G: 予定納税（○/×）
// ============================================================
function sendTaxCalendarStart() {
  PropertiesService.getScriptProperties().deleteProperty('CALENDAR_OFFSET');
  sendTaxCalendarChunk();
}

// チャンク実行（自動継続）
function sendTaxCalendarChunk() {
  const props  = PropertiesService.getScriptProperties();
  const offset = parseInt(props.getProperty('CALENDAR_OFFSET') || '0');

  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID_CLIENTS).getSheetByName('顧問先');
  if (!sheet) return;

  const rows  = sheet.getDataRange().getValues().slice(1);
  const month = new Date().getMonth() + 1;
  const chunk = rows.slice(offset, offset + CHUNK_SIZE);

  chunk.forEach(row => {
    const userId  = (row[0] || '').toString().trim();
    const name    = row[1] || 'お客様';
    const type    = row[2] || '個人';
    const kessan  = parseInt(row[3]) || null;
    const tokuei  = String(row[4] || '').trim() === '1'; // E列: 納期の特例
    const shohi   = String(row[5] || '').trim() === '1'; // F列: 消費税
    const yotei   = String(row[6] || '').trim() === '1'; // G列: 予定納税
    if (!userId || !userId.startsWith('U')) return;

    const common = getCommonCalendar(month, tokuei);
    let extra = '';
    if (type === '個人')      extra = getIndividualExtra(month, shohi, yotei);
    else if (type === '法人') extra = getCorporateExtra(month, kessan, shohi);

    const body = `【${month}月の税務カレンダー】📅\n${name}様\n\n${common}${extra}\nご不明な点は「相談」と送ってください。\nあおば税理士法人`;
    sendPush(userId, [{ type: 'text', text: body }]);
  });

  if (offset + CHUNK_SIZE < rows.length) {
    props.setProperty('CALENDAR_OFFSET', String(offset + CHUNK_SIZE));
    deleteSelfTrigger('sendTaxCalendarChunk');
    ScriptApp.newTrigger('sendTaxCalendarChunk')
      .timeBased().after(60 * 1000).create();
  } else {
    props.deleteProperty('CALENDAR_OFFSET');
    deleteSelfTrigger('sendTaxCalendarChunk');
  }
}

// ============================================================
// 税務カレンダー：月別テキスト
// ============================================================
function getCommonCalendar(month, tokuei) {
  // 源泉所得税：納期の特例なし（毎月）
  const monthlyGensen = {
    1: '1/10 源泉所得税（12月分）納付\n',
    2: '2/10 源泉所得税（1月分）納付\n',
    3: '3/10 源泉所得税（2月分）納付\n',
    4: '4/10 源泉所得税（3月分）納付\n',
    5: '5/12 源泉所得税（4月分）納付\n',
    6: '6/10 源泉所得税（5月分）納付\n',
    7: '7/10 源泉所得税（6月分）納付\n',
    8: '8/10 源泉所得税（7月分）納付\n',
    9: '9/10 源泉所得税（8月分）納付\n',
    10: '10/10 源泉所得税（9月分）納付\n',
    11: '11/10 源泉所得税（10月分）納付\n',
    12: '12/10 源泉所得税（11月分）納付\n',
  };
  // 源泉所得税：納期の特例あり（年2回）
  const tokueiGensen = {
    1: '1/20 源泉所得税（7〜12月分）納付 ※納期の特例\n',
    7: '7/10 源泉所得税（1〜6月分）納付 ※納期の特例\n',
  };

  let lines = '▶ 共通\n';
  lines += tokuei ? (tokueiGensen[month] || '') : (monthlyGensen[month] || '');
  if (month === 1)  lines += '1/31 給与支払報告書・法定調書提出\n';
  if (month === 7)  lines += '7/10 住民税特別徴収（1期）\n';
  if (month === 9)  lines += '9/30 個人住民税（3期）\n';
  if (month === 12) lines += '12/31 年末調整・法定調書準備\n';
  return lines + '\n';
}

function getIndividualExtra(month, shohi, yotei) {
  let msg = '';
  if (month === 2) {
    msg += '▶ 個人の方へ\n2/16〜 確定申告受付開始\n書類のご準備をお願いします📋\n\n';
  }
  if (month === 3) {
    let line = '▶ 個人の方へ\n3/15 確定申告・贈与税申告期限\n';
    if (shohi) line += '3/31 消費税確定申告（前年分）\n';
    msg += line + 'お早めにご提出ください⚠️\n\n';
  }
  if (shohi && month === 8) {
    msg += '▶ 個人の方へ\n8/31 消費税中間申告の期限です💰\nお忘れなくご対応ください。\n\n';
  }
  if (yotei && month === 7) {
    msg += '▶ 個人の方へ\n7/31 所得税予定納税（第1期）\nお忘れなくご対応ください💰\n\n';
  }
  if (yotei && month === 11) {
    msg += '▶ 個人の方へ\n11/30 所得税予定納税（第2期）\nお忘れなくご対応ください💰\n\n';
  }
  if (month === 11) {
    msg += '▶ 個人の方へ\n年末調整の準備時期です。\n保険料控除証明書をお手元に準備ください📄\n\n';
  }
  return msg;
}

function getCorporateExtra(month, kessan, shohi) {
  let msg = '';
  if (kessan) {
    const filingMonth = ((kessan % 12) + 2) > 12 ? (kessan % 12) + 2 - 12 : (kessan % 12) + 2;
    const nextMonth   = month === 12 ? 1 : month + 1;

    // 申告期限月
    if (month === filingMonth) {
      let line = `▶ 法人の方へ\n⚠️ ${kessan}月決算の申告期限月です。\n法人税`;
      if (shohi) line += '・消費税';
      msg += line + 'の申告・納付をお急ぎください。\n\n';
    }
    // 申告期限の前月アラート
    else if (nextMonth === filingMonth) {
      msg += `▶ 法人の方へ\n📋 来月が${kessan}月決算の申告期限です。\n書類のご準備をお早めにお願いします。\n\n`;
    }

    // 法人税中間申告（決算から8ヶ月後が期限・前年税額20万円超）
    const midBase   = (kessan + 6) > 12 ? kessan + 6 - 12 : kessan + 6;
    const midFiling = (midBase % 12) + 2 > 12 ? (midBase % 12) + 2 - 12 : (midBase % 12) + 2;
    if (month === midFiling) {
      msg += `▶ 法人の方へ\n📋 法人税中間申告の期限月です（前年税額20万円超の方）\nご確認ください。\n\n`;
    }

    // 消費税中間申告（事業年度開始から8ヶ月後が期限・前年税額48万円超）
    if (shohi) {
      const startMonth   = (kessan % 12) + 1;
      const shohiDeadline = (startMonth + 7) > 12 ? (startMonth + 7) - 12 : (startMonth + 7);
      if (month === shohiDeadline) {
        msg += `▶ 法人の方へ\n💰 消費税中間申告の期限月です（前年税額48万円超の方）\nご確認ください。\n\n`;
      }
    }

    // 決算前月
    const prevMonth = kessan === 1 ? 12 : kessan - 1;
    if (month === prevMonth) {
      msg += `▶ 法人の方へ\n来月が決算月です。\n経費・在庫・役員報酬の見直しをお早めに📊\n\n`;
    }
  }
  return msg || '▶ 法人の方へ\n今月は特別な期限はありません。\n\n';
}

// ============================================================
// デモ用カスタムメニュー
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('デモ操作')
    .addItem('📅 税務カレンダーを今すぐ送信', 'sendTaxCalendarStart')
    .addItem('📂 書類提出リマインダーを今すぐ送信', 'sendMonthlyReminderStart')
    .addToUi();
}

// ============================================================
// ユーティリティ
// ============================================================

// 実行済みのワンタイムトリガーを削除（トリガーの溜まり防止）
function deleteSelfTrigger(funcName) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === funcName)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function sendPush(to, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${CONFIG.CHANNEL_ACCESS_TOKEN}` },
    payload: JSON.stringify({ to, messages })
  });
}
