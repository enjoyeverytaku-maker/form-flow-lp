// ============================================================
// あおば税理士法人 — フォーム回答 → カレンダー登録 + Meet生成 + LINE自動返信
//
// 【設定手順】
// 1. 相談申込みスプレッドシートをGASエディタで開く
//    （スプレッドシート → 拡張機能 → Apps Script）
// 2. このコードを貼り付けて保存
// 3. Calendar APIを有効化
//    サービス（＋）→ Google Calendar API → 追加
// 4. addLineIdField() を1回だけ実行（フォームにLINE ID欄を追加）
// 5. ログに出た LINE_ID_ENTRY の値をコピーし、
//    Webhookプロジェクトのスクリプトプロパティに LINE_ID_ENTRY として登録
// 6. setFormTrigger() を実行してトリガーを登録
//
// 【スクリプトプロパティ】
//   CALENDAR_ID : 登録先カレンダーのID（通常はGmailアドレス）
//   LINE_TOKEN  : チャンネルアクセストークン
//   STAFF_IDS   : スタッフのLINE User ID カンマ区切り
// ============================================================

// フォーム列順（gas_create_form.js で作成した順番）
// ※ 確認コード欄をフォームに追加した場合は末尾に追加
const COL = {
  TIMESTAMP : 0,
  NAME      : 1,
  BUSINESS  : 2,
  TOPICS    : 3,
  DETAIL    : 4,
  DATE1     : 5,
  DATE2     : 6,
  METHOD    : 7,
  EMAIL     : 8,
  TOKEN     : 9, // 確認コード欄
};

// ============================================================
// ① フォームに確認コード欄を追加（1回だけ実行）
// ============================================================
function addTokenField() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const form = FormApp.openByUrl(ss.getFormUrl());
  form.addTextItem()
    .setTitle('確認コード')
    .setHelpText('LINEで受け取った6桁のコードを入力してください')
    .setRequired(true);
  Logger.log('✅ 確認コード欄を追加しました');
}

// トークンからuserIdを検索
function lookupUserIdByToken(token) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('TOKEN_SHEET_ID');
  if (!sheetId) return '';

  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName('トークン');
  if (!sheet) return '';

  const rows = sheet.getDataRange().getValues();
  const found = rows.find(r => String(r[0]) === token);
  return found ? found[1] : '';
}

// ============================================================
// ② トリガー登録（1回だけ実行）
// ============================================================
function setFormTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onFormSubmit')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();

  Logger.log('✅ トリガーを登録しました');
}

// ============================================================
// ③ フォーム送信時に自動実行
// ============================================================
function onFormSubmit(e) {
  const row   = e.values;
  const props = PropertiesService.getScriptProperties();
  const calId = props.getProperty('CALENDAR_ID') || 'primary';

  const name       = row[COL.NAME]     || '（名前未記入）';
  const biz        = row[COL.BUSINESS] || '';
  const topics     = row[COL.TOPICS]   || '';
  const detail     = row[COL.DETAIL]   || '';
  const date1      = row[COL.DATE1]    || '';
  const date2      = row[COL.DATE2]    || '';
  const method     = row[COL.METHOD]   || '';
  const email      = row[COL.EMAIL]    || '';
  const token      = (row[COL.TOKEN] || '').trim();
  const lineUserId = token ? lookupUserIdByToken(token) : '';

  const parsed = parseJapaneseDate(date1);

  const title = `【相談申込】${name}（${biz}）`;
  const description = [
    `▶ 相談内容：${topics}`,
    detail  ? `▶ 詳細：${detail}`   : '',
    `▶ 対応方法：${method}`,
    email   ? `▶ メール：${email}`  : '',
    lineUserId ? `▶ LINE ID：${lineUserId}` : '',
    '',
    `▶ 第1希望：${date1}`,
    date2   ? `▶ 第2希望：${date2}` : '',
  ].filter(Boolean).join('\n');

  // カレンダーに登録 + Meet生成
  let meetUrl = null;

  if (parsed) {
    const end      = new Date(parsed.getTime() + 60 * 60 * 1000);
    const calEvent = Calendar.Events.insert({
      summary: title,
      description,
      start: { dateTime: parsed.toISOString(), timeZone: 'Asia/Tokyo' },
      end:   { dateTime: end.toISOString(),    timeZone: 'Asia/Tokyo' },
      colorId: '7',
      conferenceData: {
        createRequest: {
          requestId: Utilities.getUuid(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }, calId, { conferenceDataVersion: 1 });

    meetUrl = calEvent.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || null;
    Logger.log(`✅ 予定作成: ${title} / Meet: ${meetUrl}`);
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    Calendar.Events.insert({
      summary: `⚠️ 要確認 ${title}`,
      description: `日時解析不可。手動で調整してください。\n第1希望：${date1}\n\n${description}`,
      start: { date: Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'yyyy-MM-dd') },
      end:   { date: Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'yyyy-MM-dd') },
      colorId: '5',
    }, calId);
    Logger.log(`⚠️ 日時解析不可。翌日の終日予定として登録: ${title}`);
  }

  // 申込者のLINEにMeetリンクを自動送信
  if (lineUserId && meetUrl) {
    pushMeetToUser(lineUserId, name, date1, meetUrl, props);
  }

  // スタッフにLINE通知
  notifyStaffLine(name, biz, topics, date1, method, meetUrl, lineUserId, props);
}

// ============================================================
// 申込者のLINEにMeetリンクを返す
// ============================================================
function pushMeetToUser(userId, name, date1, meetUrl, props) {
  const token = props.getProperty('LINE_TOKEN');
  if (!token) return;

  const msg = `${name}様\n\nご相談のお申込みありがとうございます📋\n\n日程が確定しましたら改めてご連絡いたします。\n\n▶ オンライン面談のURL（Google Meet）\n${meetUrl}\n\n▶ ご希望日時\n${date1}\n\n当日はこちらのURLよりご参加ください。\nご不明な点はこのLINEへご連絡ください。\n\nあおば税理士法人`;

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: msg }] })
  });
}

// ============================================================
// スタッフへのLINE通知
// ============================================================
function notifyStaffLine(name, biz, topics, date1, method, meetUrl, lineUserId, props) {
  const token    = props.getProperty('LINE_TOKEN');
  const staffIds = (props.getProperty('STAFF_IDS') || '').split(',').filter(Boolean);
  if (!token || staffIds.length === 0) return;

  const meetLine = meetUrl ? `🎥 Meet：${meetUrl}` : '🎥 Meet：日時未確定のため未生成';
  const sentLine = (lineUserId && meetUrl) ? '✅ 申込者のLINEにMeetリンクを送信済み' : '⚠️ LINEへの自動送信なし（LINE IDなし）';

  const msg = `【相談申込み】📋\n\n👤 ${name}\n🏢 ${biz}\n📋 ${topics}\n📅 ${date1}\n🖥 ${method}\n\n${meetLine}\n${sentLine}`;

  staffIds.forEach(id => {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${token}` },
      payload: JSON.stringify({ to: id, messages: [{ type: 'text', text: msg }] })
    });
  });
}

// ============================================================
// 日時パース
// ============================================================
function parseJapaneseDate(text) {
  if (!text) return null;
  const year = new Date().getFullYear();
  const now  = new Date();

  const mdMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!mdMatch) return null;

  const month = parseInt(mdMatch[1]) - 1;
  const day   = parseInt(mdMatch[2]);
  let hour = 10, minute = 0;

  const hourMatch = text.match(/午後\s*(\d{1,2})時/) || text.match(/(\d{1,2})時/) || text.match(/(\d{1,2}):(\d{2})/);
  if (hourMatch) {
    hour = parseInt(hourMatch[1]);
    if (text.includes('午後') && hour < 12) hour += 12;
    if (hourMatch[2]) minute = parseInt(hourMatch[2]);
  }

  const date = new Date(year, month, day, hour, minute, 0);
  if (date < now) date.setFullYear(year + 1);
  return date;
}
