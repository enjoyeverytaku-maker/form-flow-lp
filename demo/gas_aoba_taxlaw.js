// ============================================================
// あおば税理士法人 LINE公式アカウント GASコード
// Form Flow - プレミアムプランデモ
// ============================================================

const CONFIG = {
  CHANNEL_ACCESS_TOKEN: 'ZEsK87GHyK/joY+/sJr5obt6Mqjj4qABXsoYlMdYjzm1rDJFb1W8GPgJSwPAKpVI7LqntZSCE3q5GbmDwqPcfadOpts8wvLh0ovU9Eiztlhrib9DPD4WntfneJXdY5UNcFDcS85Xl5pqC+pLlna7jwdB04t89/1O/w1cDnyilFU=',
  SHEET_ID_INQUIRY:     '1WaAt42mbJb5VTq_VgNxiT3iOUlSSpgz-t7L10GMrCm8', // 新規問い合わせ
  SHEET_ID_CLIENTS:     '1ZeR23VFivSn_62S_fNJOQwmZUl1A9Lw3wjPfS_dltSA', // 顧問先
  STAFF_USER_ID:        'ここにスタッフのLINE User IDを貼る',
  FORM_URL:             'ここにGoogleフォームのURLを貼る',
};

// ============================================================
// ① メインWebhook
// ============================================================
function doPost(e) {
  const json = JSON.parse(e.postData.contents);

  json.events.forEach(event => {
    if (event.type === 'follow') handleFollow(event);
    if (event.type === 'message' && event.message.type === 'text') {
      handleMessage(event);
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ② 友だち追加：あいさつ + Flexクーポン + スプシ記録 + スタッフ通知
// ============================================================
function handleFollow(event) {
  const userId = event.source.userId;
  const profile = getProfile(userId);
  const displayName = profile ? profile.displayName : 'お客様';

  // あいさつ + Flexクーポンを同時送信
  sendReply(event.replyToken, [
    {
      type: 'text',
      text: `${displayName}様、はじめまして！\nあおば税理士法人のLINEへようこそ📊\n\nこのアカウントでは\n\n✅ 書類提出の期限リマインダー\n✅ 税務カレンダーの自動お知らせ\n✅ よくある税務相談への自動回答\n✅ 無料相談のご予約\n\nを自動でご案内しています。\n下のメニューからお気軽にどうぞ。`
    },
    buildFlexCoupon()
  ]);

  // スプレッドシートに記録
  recordUser(userId, displayName);

  // スタッフにLINEで通知
  notifyStaff(displayName);
}

// ============================================================
// ③ メッセージ受信：キーワード自動返信
// ============================================================
function handleMessage(event) {
  const text   = event.message.text;
  const userId = event.source.userId;

  // サービス案内パネルタップ → 分岐Flexを送る
  if (text.includes('サービス案内') || text.includes('サービスを見る')) {
    sendReply(event.replyToken, [buildServiceSelector()]);
    return;
  }

  const reply = getKeywordReply(text);
  if (reply) {
    sendReply(event.replyToken, [{ type: 'text', text: reply }]);
  }

  // 「相談」のときはフォームURLも追加送信
  if (text.includes('相談')) {
    sendPush(userId, [{
      type: 'text',
      text: `ご相談の詳細を以下のフォームからお送りください📋\n\n${CONFIG.FORM_URL}\n\n回答後、1営業日以内にご連絡いたします。`
    }]);
  }
}

// ============================================================
// キーワード返信テキスト
// ============================================================
function getKeywordReply(text) {
  if (text.includes('経費')) {
    return '【経費になるもの・ならないもの】📝\n\n✅ 経費になるもの（例）\n・仕事で使った交通費・出張費\n・取引先との接待交際費（上限あり）\n・事務所の家賃・光熱費\n・業務用のPC・ソフトウェア\n\n❌ 経費にならないもの（例）\n・プライベートの食事・旅行\n・罰金・税金の延滞税\n\nグレーゾーンは個別判断が必要です。\n「相談」と送って無料相談をご予約ください。';
  }
  if (text.includes('節税')) {
    return '【今すぐできる節税3選】💡\n\n① iDeCo（個人型確定拠出年金）\n　掛金が全額所得控除に\n\n② 小規模企業共済\n　月最大7万円が所得控除に\n\n③ 経費の見直し\n　計上漏れがないか年末前に確認\n\n「どれが自分に合うか知りたい」\nという方は無料相談へどうぞ。\n「相談」と送ってください📅';
  }
  if (text.includes('インボイス')) {
    return '【インボイス制度のよくある疑問】🧾\n\nQ. 免税事業者のままでいい？\n→ 取引先が法人中心なら登録を検討\n　個人向けビジネスなら急がなくてよい場合も\n\nQ. 登録するとどうなる？\n→ 消費税の納税義務が発生する\n\nQ. 簡易課税は使える？\n→ 売上5,000万円以下なら選択可能\n\n詳しくは個別にご説明します。\n「相談」と送ってください。';
  }
  if (text.includes('確定申告')) {
    return '【確定申告についてのご案内】📝\n\n【個人の方】\n・申告期限：毎年3月15日\n・必要書類：源泉徴収票・経費領収書など\n\n【法人の方】\n・決算月から2ヶ月以内が申告期限\n\n当事務所では書類の収集から\n申告まで一括でサポートします。\n\nご不明な点は「相談」と送って\nお気軽にご相談ください。';
  }
  // サービス案内の分岐
  if (text.includes('サービス案内') || text.includes('サービスを見る')) {
    return null; // Flex Messageで対応するためnullを返す
  }
  if (text === '法人サービス') {
    return '【法人向けサービス】🏢\n\n▶ 月次顧問（記帳代行なし）\n月額 ¥30,000〜\n・月次試算表の作成\n・税務相談（LINE・メール）\n・決算申告\n\n▶ 月次顧問（記帳代行あり）\n月額 ¥45,000〜\n・上記＋通帳・領収書からの記帳\n・給与計算サポート\n\n▶ スポット対応\n決算申告のみ　¥100,000〜\n税務調査対応　別途お見積り\n\n▶ オプション\n・給与計算　¥5,000〜/月\n・年末調整　¥10,000〜\n・登記変更サポート　¥20,000〜\n\n※すべて税別\n初回相談無料。「相談」と送ってください📅';
  }
  if (text === '相続サービス') {
    return '【相続・事業承継サービス】🏛️\n\n▶ 相続税申告\n基本報酬：遺産総額の0.5〜1%\n・相続財産の調査・評価\n・申告書の作成・提出\n・税務署対応\n\n▶ 生前対策コンサルティング\n¥50,000〜\n・財産の棚卸し・評価\n・節税シミュレーション\n・遺言書作成のアドバイス\n\n▶ 事業承継サポート\n¥100,000〜\n・後継者への自社株移転\n・事業承継税制の活用\n・M&A・第三者承継の検討\n\n※すべて税別\n早めのご相談が節税につながります。\n「相談」と送ってください📅';
  }
  if (text === '個人サービス') {
    return '【個人事業主・フリーランス向けサービス】👤\n\n▶ 月次顧問（記帳代行なし）\n月額 ¥15,000〜\n・月次試算表の作成\n・税務相談（LINE・メール）\n・確定申告\n\n▶ 月次顧問（記帳代行あり）\n月額 ¥25,000〜\n・上記＋通帳・領収書からの記帳\n\n▶ スポット対応\n確定申告のみ　¥50,000〜\n開業届・青色申告承認申請　¥10,000〜\n\n▶ こんな方におすすめ\n・開業したばかりで何から始めれば良いか分からない\n・本業が忙しく確定申告を丸投げしたい\n・インボイス登録をどうするか迷っている\n\n※すべて税別\n初回相談無料。「相談」と送ってください📅';
  }
  if (text.includes('創業') || text.includes('法人化') || text.includes('起業')) {
    return '【創業・法人化サポート】🏢\n\n▶ 個人事業主として始める\n・開業届の提出サポート\n・青色申告承認申請のご案内\n・初年度の経費・節税アドバイス\n\n▶ 法人化を検討している方へ\n・法人化のメリット・デメリット整理\n・最適なタイミングのご提案\n　（目安：年間利益500万円超）\n・会社設立後の各種届出サポート\n\n▶ 創業融資のサポート\n・日本政策金融公庫への申請補助\n・事業計画書の作成アドバイス\n\n初回相談は無料・約45分です。\n「相談」と送ってご予約ください📅';
  }
  if (text.includes('相談')) {
    return '無料相談のご予約を承ります📅\n\n以下をこのLINEにてお送りください：\n\n👤 お名前（法人名）\n🏢 事業内容・業種\n📋 ご相談内容\n　（決算・節税・創業・インボイスなど）\n📅 ご希望の日時（第2希望まで）\n\n平日9:00〜18:00にて\n1営業日以内にご返信いたします。';
  }
  return null;
}

// ============================================================
// ④-a Flex Message：サービス案内の分岐ボタン
// ============================================================
function buildServiceSelector() {
  return {
    type: 'flex',
    altText: 'サービス案内 - 該当するものをお選びください',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'サービス案内', weight: 'bold', size: 'lg' },
          { type: 'text', text: '該当するものをお選びください', size: 'sm', color: '#6B7280', margin: 'sm' },
          { type: 'separator', margin: 'lg' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: '🏢 法人の方', text: '法人サービス' },
            style: 'primary',
            color: '#1a56db'
          },
          {
            type: 'button',
            action: { type: 'message', label: '🏛️ 相続・事業承継の方', text: '相続サービス' },
            style: 'primary',
            color: '#4B5563'
          },
          {
            type: 'button',
            action: { type: 'message', label: '👤 個人事業主・フリーランスの方', text: '個人サービス' },
            style: 'primary',
            color: '#065F46'
          }
        ],
        paddingAll: '12px'
      }
    }
  };
}

// ============================================================
// ④-b Flex Message：無料相談クーポン
// ============================================================
function buildFlexCoupon() {
  return {
    type: 'flex',
    altText: '初回無料相談受付中',
    contents: {
      type: 'bubble',
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📊 初回無料相談', size: 'xl', weight: 'bold', color: '#1a56db', align: 'center' },
          { type: 'text', text: '受付中',           size: 'lg', weight: 'bold', color: '#1a56db', align: 'center' }
        ],
        paddingAll: '20px',
        backgroundColor: '#EFF6FF'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '・節税・確定申告',   size: 'sm', color: '#374151' },
          { type: 'text', text: '・創業・法人化',     size: 'sm', color: '#374151' },
          { type: 'text', text: '・インボイス対応',   size: 'sm', color: '#374151' },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '所要時間：約45分',           size: 'xs', color: '#6B7280', margin: 'md' },
          { type: 'text', text: 'オンライン対応可',           size: 'xs', color: '#6B7280' },
          { type: 'text', text: '有効期限：友だち追加から30日', size: 'xs', color: '#6B7280' }
        ],
        paddingAll: '16px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: { type: 'message', label: '無料相談を予約する', text: '相談' },
          style: 'primary',
          color: '#1a56db'
        }],
        paddingAll: '12px'
      }
    }
  };
}

// ============================================================
// ⑤ 月次：書類提出リマインダー
//    GASトリガー：毎月10日 9:00 に実行
// ============================================================
function sendMonthlyReminder() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID_CLIENTS).getSheetByName('顧問先');
  if (!sheet) return;

  const rows  = sheet.getDataRange().getValues();
  const month = new Date().getMonth() + 1;

  rows.slice(1).forEach(row => {
    const userId = row[0];
    if (!userId) return;

    sendPush(userId, [{
      type: 'text',
      text: `【書類提出のご案内】📂\n\n${month}月分の書類提出期限が近づいています。\n\n▶ 提出書類（例）\n・通帳のコピー（当月分）\n・領収書・請求書\n・給与明細（従業員がいる場合）\n\n今月の期限：${month}月末日\n\nご提出はこちらから：\n${CONFIG.FORM_URL}\n\nご不明な点はお気軽にご連絡ください。\nあおば税理士法人`
    }]);
  });
}

// ============================================================
// ⑥ 月次：税務カレンダー配信（顧客区分・決算月で送り分け）
//    GASトリガー：毎月1日 9:00 に実行
//
//    スプレッドシート「顧問先」シートの列構成：
//    A: userId / B: 名前 / C: 区分（個人 or 法人）/ D: 決算月（法人のみ・数字）
// ============================================================
function sendTaxCalendar() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID_CLIENTS).getSheetByName('顧問先');
  if (!sheet) return;

  const rows  = sheet.getDataRange().getValues();
  const today = new Date();
  const month = today.getMonth() + 1;

  rows.slice(1).forEach(row => {
    const userId      = row[0];
    const name        = row[1] || 'お客様';
    const type        = row[2] || '個人'; // 「個人」or「法人」
    const kessan      = parseInt(row[3]) || null; // 決算月（法人のみ）
    if (!userId) return;

    // 共通カレンダー（全員に送る）
    const common = getCommonCalendar(month);

    // 区分別メッセージを追加
    let extra = '';
    if (type === '個人') {
      extra = getIndividualExtra(month);
    } else if (type === '法人') {
      extra = getCorporateExtra(month, kessan);
    }

    const body = `【${month}月の税務カレンダー】📅\n${name}様\n\n${common}${extra}\nご不明な点は「相談」と送ってください。\nあおば税理士法人`;

    sendPush(userId, [{ type: 'text', text: body }]);
  });
}

// 全顧客共通の期限
function getCommonCalendar(month) {
  const map = {
    1:  '▶ 共通\n1/10 源泉所得税（12月分）納付\n1/31 給与支払報告書提出\n\n',
    2:  '▶ 共通\n2/10 源泉所得税（1月分）納付\n\n',
    3:  '▶ 共通\n3/10 源泉所得税（2月分）納付\n\n',
    4:  '▶ 共通\n4/10 源泉所得税（3月分）納付\n\n',
    5:  '▶ 共通\n5/12 源泉所得税（4月分）納付\n\n',
    6:  '▶ 共通\n6/10 源泉所得税（5月分）納付\n\n',
    7:  '▶ 共通\n7/10 源泉所得税（6月分）納付\n7/10 住民税特別徴収（1期）\n\n',
    8:  '▶ 共通\n8/10 源泉所得税（7月分）納付\n\n',
    9:  '▶ 共通\n9/10 源泉所得税（8月分）納付\n9月末 個人住民税（3期）\n\n',
    10: '▶ 共通\n10/10 源泉所得税（9月分）納付\n\n',
    11: '▶ 共通\n11/10 源泉所得税（10月分）納付\n\n',
    12: '▶ 共通\n12/10 源泉所得税（11月分）納付\n12/31 年末調整・法定調書準備\n\n',
  };
  return map[month] || '';
}

// 個人事業主向けの追加情報
function getIndividualExtra(month) {
  const map = {
    2:  '▶ 個人の方へ\n2/16〜 確定申告受付開始\n書類のご準備をお願いします📋\n\n',
    3:  '▶ 個人の方へ\n3/15 確定申告・贈与税申告期限\nお早めにご提出ください⚠️\n\n',
    5:  '▶ 個人の方へ\n5/31 消費税申告期限（前年分）\n該当の方はご確認ください\n\n',
    11: '▶ 個人の方へ\n年末調整の準備時期です。\n保険料控除証明書をお手元に準備ください📄\n\n',
  };
  return map[month] || '';
}

// 法人向けの追加情報（決算月に応じたリマインダー）
function getCorporateExtra(month, kessan) {
  let msg = '';

  // 決算月の2ヶ月後が申告期限
  if (kessan) {
    const申告月 = (kessan % 12) + 2;
    const提出月 = 申告月 > 12 ? 申告月 - 12 : 申告月;
    if (month === 提出月) {
      msg += `▶ 法人の方へ\n⚠️ ${kessan}月決算の申告期限月です。\n書類のご提出をお急ぎください。\n\n`;
    }
    // 決算月の1ヶ月前にリマインド
    const前月 = kessan === 1 ? 12 : kessan - 1;
    if (month === 前月) {
      msg += `▶ 法人の方へ\n来月が決算月です。\n経費・在庫の見直しをお早めに📊\n\n`;
    }
  }

  // 消費税中間申告（10月）
  if (month === 10) {
    msg += '▶ 法人の方へ\n10/31 消費税中間申告（該当者）\nご確認ください。\n\n';
  }

  return msg || '▶ 法人の方へ\n今月は特別な期限はありません。\n\n';
}

// ============================================================
// ユーティリティ
// ============================================================

// スプレッドシートに新規ユーザーを記録
function recordUser(userId, displayName) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID_INQUIRY).getSheetByName('新規問い合わせ');
  if (!sheet) return;
  sheet.appendRow([new Date(), displayName, userId, '未対応']);
}

// スタッフに新規友だち追加をLINEで通知
function notifyStaff(displayName) {
  sendPush(CONFIG.STAFF_USER_ID, [{
    type: 'text',
    text: `【新規問い合わせ】📬\n\n${displayName}様が友だち追加しました。\nスプレッドシートを確認してください。`
  }]);
}

// LINEプロフィール取得
function getProfile(userId) {
  try {
    const res = UrlFetchApp.fetch(
      `https://api.line.me/v2/bot/profile/${userId}`,
      { headers: { Authorization: `Bearer ${CONFIG.CHANNEL_ACCESS_TOKEN}` } }
    );
    return JSON.parse(res.getContentText());
  } catch(e) {
    return null;
  }
}

// 返信メッセージ送信（replyToken使用・無料）
function sendReply(replyToken, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${CONFIG.CHANNEL_ACCESS_TOKEN}` },
    payload: JSON.stringify({ replyToken, messages })
  });
}

// プッシュメッセージ送信（任意のタイミングで送信）
function sendPush(to, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${CONFIG.CHANNEL_ACCESS_TOKEN}` },
    payload: JSON.stringify({ to, messages })
  });
}
