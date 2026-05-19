// ── 設定はスクリプトプロパティから取得 ──────────────────
const PROPS          = PropertiesService.getScriptProperties();
const LINE_TOKEN     = PROPS.getProperty('LINE_TOKEN');
const SPREADSHEET_ID = PROPS.getProperty('SPREADSHEET_ID');
const LP_URL         = PROPS.getProperty('LP_URL');
const CASES_URL      = 'https://enjoyeverytaku-maker.github.io/form-flow-lp/cases.html';
const SERVICE_URL    = 'https://enjoyeverytaku-maker.github.io/form-flow-lp/service.html';
const SHEET_NAME     = 'states';
const RESULTS_SHEET  = 'results';
// ──────────────────────────────────────────────────────

// ── エントリーポイント ──
function doGet() {
  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  try {
    const events = JSON.parse(e.postData.contents).events;
    events.forEach(event => handleEvent(event));
  } catch (err) {
    Logger.log(err);
  }
  return ContentService.createTextOutput('OK');
}

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId     = event.source.userId;
  const text       = event.message.text.trim();
  const replyToken = event.replyToken;
  const state      = getState(userId);

  // ── トリガーワード ──────────────────────────────────
  if (text === '簡単見積もり') {
    setState(userId, 1, '', '', '');
    replyMessages(replyToken, [msgQ1()]);
    return;
  }
  if (text === '業種から探す') {
    setState(userId, 10, '', '', '');
    replyMessages(replyToken, [msgIndustryQ()]);
    return;
  }
  if (text === '診断する') {
    setState(userId, 20, '', '', '');
    replyMessages(replyToken, [msgDiagQ1()]);
    return;
  }
  if (text === '資料を受け取る') {
    replyMessages(replyToken, [msgMaterial()]);
    return;
  }
  if (text === 'よくある質問') {
    setState(userId, 30, '', '', '');
    replyMessages(replyToken, [msgFaqQ()]);
    return;
  }
  if (text === '相談する') {
    setState(userId, 40, '', '', '');
    replyMessages(replyToken, [msgConsult()]);
    return;
  }

  // ── ステップ別分岐 ──────────────────────────────────
  switch (state.step) {

    // 簡単見積もり
    case 1:
      if (!isValid(text, 7)) { replyMessages(replyToken, [msgInvalid(7)]); return; }
      setState(userId, 2, text, '', '');
      replyMessages(replyToken, [msgQ2()]);
      break;

    case 2:
      if (!isValid(text, 4)) { replyMessages(replyToken, [msgInvalid(4)]); return; }
      setState(userId, 3, state.a1, text, '');
      replyMessages(replyToken, [msgQ3()]);
      break;

    case 3: {
      if (!isValid(text, 3)) { replyMessages(replyToken, [msgInvalid(3)]); return; }
      const result = calcEstimate(state.a1, state.a2, text);
      replyMessages(replyToken, [msgEstimateResult(result)]);
      const displayName = getDisplayName(userId);
      logResult(userId, displayName, state.a1, state.a2, text, result);
      setState(userId, 0, '', '', '');
      break;
    }

    // 業種から探す
    case 10: {
      if (!isValid(text, 7)) { replyMessages(replyToken, [msgInvalid(7)]); return; }
      replyMessages(replyToken, [msgIndustryResult(parseInt(text))]);
      setState(userId, 0, '', '', '');
      break;
    }

    // 診断する
    case 20:
      if (!isValid(text, 5)) { replyMessages(replyToken, [msgInvalid(5)]); return; }
      setState(userId, 21, text, '', '');
      replyMessages(replyToken, [msgDiagQ2()]);
      break;

    case 21: {
      if (!isValid(text, 3)) { replyMessages(replyToken, [msgInvalid(3)]); return; }
      replyMessages(replyToken, [msgDiagResult(parseInt(state.a1), parseInt(text))]);
      setState(userId, 0, '', '', '');
      break;
    }

    // よくある質問
    case 30: {
      if (!isValid(text, 8)) { replyMessages(replyToken, [msgInvalid(8)]); return; }
      replyMessages(replyToken, [msgFaqAnswer(parseInt(text))]);
      setState(userId, 0, '', '', '');
      break;
    }

    // 相談する（内容受付）
    case 40: {
      replyMessages(replyToken, [msgConsultReceived()]);
      setState(userId, 0, '', '', '');
      break;
    }
  }
}

// ════════════════════════════════════════════════════
// 簡単見積もり
// ════════════════════════════════════════════════════

function msgQ1() {
  return {
    type: 'text',
    text: '📋 簡単見積もり（3問）\n\nまず業種を番号で教えてください👇\n\n① 整体院・治療院\n② 美容室・サロン\n③ コンサル・コーチング\n④ 士業・専門職\n⑤ 飲食店\n⑥ EC・物販\n⑦ その他'
  };
}

function msgQ2() {
  return {
    type: 'text',
    text: 'ありがとうございます！\n\nやりたいことを番号で教えてください👇\n\n① 予約・問い合わせの自動化\n② ステップ配信・教育コンテンツ\n③ 顧客管理・データ連携\n④ 複数まとめてやりたい'
  };
}

function msgQ3() {
  return {
    type: 'text',
    text: 'あと1問です！\n\n現在の状況を番号で教えてください👇\n\n① LINEアカウントをまだ作っていない\n② 作ったけど使えていない\n③ 使っているが機能を増やしたい'
  };
}

function calcEstimate(a1, a2, a3) {
  const want   = parseInt(a2);
  const status = parseInt(a3);
  let plan, monitor, reason;

  if (want === 4 || want === 3) {
    plan    = 'プレミアムプラン';
    monitor = '¥198,000〜';
    reason  = 'GAS連携・API構築・顧客管理の自動化が必要なため';
  } else if (want === 2 || status === 3) {
    plan    = 'スタンダードプラン';
    monitor = '¥79,800〜';
    reason  = 'ステップ配信・フォーム連携・スプレッドシート記録が必要なため';
  } else {
    plan    = 'ライトプラン';
    monitor = '¥29,800〜';
    reason  = 'まずは基本設定・リッチメニュー・自動返信からスタートするのがおすすめのため';
  }
  return { plan, monitor, reason };
}

function msgEstimateResult(r) {
  return {
    type: 'text',
    text: `ありがとうございました！✨\n\n━━━━━━━━━━━━\n🎯 おすすめプラン\n${r.plan}\n\n💴 概算（モニター価格・税別）\n${r.monitor}\n\n📌 理由\n${r.reason}\n━━━━━━━━━━━━\n\n※あくまで目安です。詳細はヒアリング後にご提案します。\n\n👇 料金の詳細はこちら\n${SERVICE_URL}\n\n💬 詳しく聞きたい方は、このトークでそのままご返信ください！`
  };
}

// ════════════════════════════════════════════════════
// 業種から探す
// ════════════════════════════════════════════════════

function msgIndustryQ() {
  return {
    type: 'text',
    text: '🏢 業種から探す\n\n当てはまる業種を番号で教えてください👇\n\n① 整体院・治療院\n② 美容室・サロン\n③ コンサル・コーチング\n④ 士業・専門職\n⑤ 飲食店\n⑥ EC・物販\n⑦ その他'
  };
}

function msgIndustryResult(n) {
  const data = {
    1: {
      name: '整体院・治療院',
      uses: '・予約受付の自動化（24時間対応）\n・問診票をLINEで事前送付\n・来院後のリピート促進メッセージ\n・キャンセル待ち自動通知',
      plan: 'ライト〜スタンダードプラン'
    },
    2: {
      name: '美容室・サロン',
      uses: '・予約リマインド自動送信\n・施術後のアフターケアアドバイス配信\n・新メニュー・空き枠のお知らせ\n・ポイントカードのデジタル化',
      plan: 'ライト〜スタンダードプラン'
    },
    3: {
      name: 'コンサル・コーチング',
      uses: '・無料相談申込みフォームの自動受付\n・ステップ配信で見込み客を育成\n・セミナー申込み〜リマインド自動化\n・個別メッセージによる関係構築',
      plan: 'スタンダード〜プレミアムプラン'
    },
    4: {
      name: '士業・専門職',
      uses: '・初回相談の自動受付・日程調整\n・よくある質問への自動回答\n・書類チェックリストの自動送付\n・顧客ごとの進捗フォローメッセージ',
      plan: 'スタンダード〜プレミアムプラン'
    },
    5: {
      name: '飲食店',
      uses: '・予約受付・リマインド自動化\n・クーポン・特典の配信\n・満席時のキャンセル待ち受付\n・新メニューや本日のおすすめ配信',
      plan: 'ライトプラン'
    },
    6: {
      name: 'EC・物販',
      uses: '・注文確認・発送通知の自動送信\n・再入荷お知らせ登録\n・購入後のフォローアップ配信\n・カゴ落ちユーザーへの再アプローチ',
      plan: 'スタンダード〜プレミアムプラン'
    },
    7: {
      name: 'その他の業種',
      uses: '・問い合わせの自動受付・振り分け\n・資料・案内の自動送付\n・予約・申込みフォームとの連携\n・ステップ配信による情報提供',
      plan: 'ライト〜スタンダードプラン'
    }
  };

  const d = data[n];
  return {
    type: 'text',
    text: `【${d.name}】の活用例✨\n\n${d.uses}\n\n━━━━━━━━━━━━\n💡 おすすめ\n${d.plan}\n━━━━━━━━━━━━\n\n👇 構築事例を詳しく見る\n${CASES_URL}\n\n💬 気になることはそのままご返信ください！`
  };
}

// ════════════════════════════════════════════════════
// 診断する
// ════════════════════════════════════════════════════

function msgDiagQ1() {
  return {
    type: 'text',
    text: '🔍 LINE活用診断（2問）\n\n今、一番困っていることを番号で教えてください👇\n\n① 問い合わせ対応に時間がかかる\n② 予約・日程管理が大変\n③ リピーターが増えない\n④ 見込み客へのフォローができていない\n⑤ LINEを開設したが使いこなせていない'
  };
}

function msgDiagQ2() {
  return {
    type: 'text',
    text: 'ありがとうございます！\n\nあと1問です。\nLINE公式アカウントの現状を教えてください👇\n\n① まだ作っていない\n② 作ったが自動返信しか使っていない\n③ ある程度使っているが機能を増やしたい'
  };
}

function msgDiagResult(issue, status) {
  const solutions = {
    1: { title: '問い合わせ自動化', detail: 'よくある質問への自動回答・フォーム連携で、対応工数を大幅に削減できます。', plan: 'ライト〜スタンダードプラン' },
    2: { title: '予約管理の自動化', detail: '予約受付・リマインド・キャンセル対応をLINEで完結。営業時間外も自動で受付できます。', plan: 'ライト〜スタンダードプラン' },
    3: { title: 'リピーター促進', detail: 'ステップ配信・来店後フォロー・クーポン配信で、自然なリピート導線を作れます。', plan: 'スタンダードプラン' },
    4: { title: '見込み客育成', detail: 'ステップ配信で教育コンテンツを届け、信頼関係を自動で積み上げます。', plan: 'スタンダード〜プレミアムプラン' },
    5: { title: 'LINE活用の立て直し', detail: 'リッチメニュー・自動返信・配信設計を整えて、使えるアカウントに生まれ変わらせます。', plan: 'ライト〜スタンダードプラン' }
  };

  const statusComment = {
    1: '今から始めるなら、まず基本設定から整えましょう。',
    2: 'すでにアカウントがあるので、機能追加がスムーズに進みます。',
    3: 'ベースがあるので、自動化・データ連携まで一気に進められます。'
  };

  const s = solutions[issue] || solutions[5];
  const sc = statusComment[status] || statusComment[1];

  return {
    type: 'text',
    text: `診断結果✨\n\n━━━━━━━━━━━━\n🎯 解決できること\n${s.title}\n\n📝 詳細\n${s.detail}\n\n${sc}\n\n💡 おすすめ\n${s.plan}\n━━━━━━━━━━━━\n\n👇 料金・プランを見る\n${SERVICE_URL}\n\n💬 詳しく話を聞きたい方は、このトークでそのままご返信ください！`
  };
}

// ════════════════════════════════════════════════════
// よくある質問
// ════════════════════════════════════════════════════

function msgFaqQ() {
  return {
    type: 'text',
    text: '❓ よくある質問\n\n知りたい項目を番号で教えてください👇\n\n① 料金はいくらですか？\n② Lステップと何が違いますか？\n③ 納期はどのくらいですか？\n④ 月額費用はかかりますか？\n⑤ GASって何ですか？\n⑥ 自分でLINEを持っていなくても大丈夫？\n⑦ 契約後のサポートはありますか？\n⑧ キャンセル・返金はできますか？'
  };
}

function msgFaqAnswer(n) {
  const faqs = {
    1: `💴 料金について\n\nモニター価格でご提供中です。\n\n・ライトプラン　　¥49,800〜（税別）\n・スタンダードプラン　¥150,000〜（税別）\n・プレミアムプラン　¥390,000〜（税別）\n\n詳細はヒアリング後に正式お見積もりをご提示します。\n\n👇 プラン詳細はこちら\n${SERVICE_URL}`,
    2: `🔄 Lステップとの違い\n\nLステップは月額1万円〜の外部ツールです。\n\nForm Flowは月額ツール不要のGAS（Google Apps Script）を使った構築が得意です。\n\n✅ 月額コストを抑えたい方\n✅ 自社でカスタマイズしたい方\n✅ Lステップを解約したい方\nに特に向いています。`,
    3: `⏱ 納期について\n\nご入金確認後、3〜10営業日を目安に納品しています。\n\n・ライトプラン：3〜5営業日\n・スタンダードプラン：5〜7営業日\n・プレミアムプラン：7〜10営業日\n\n※案件の内容により前後します。`,
    4: `📅 月額費用について\n\n構築費用のみで、月額費用は基本かかりません。\n\nLINE公式アカウント自体の月額（無料〜）は別途必要です。\n\n継続サポートをご希望の場合は月額保守プランもあります。\n\n👇 詳細はこちら\n${SERVICE_URL}`,
    5: `⚙️ GASとは？\n\nGoogle Apps Script（GAS）は、Googleが提供する無料のプログラミング環境です。\n\nスプレッドシートやGmailと連携して、LINEの自動化を実現できます。\n\nLステップのような月額ツールなしで同等の機能を作れるのが強みです。\n\n難しい知識は不要。Form Flowがすべて構築します😊`,
    6: `📱 LINE公式アカウントについて\n\nまだお持ちでない場合も大丈夫です！\n\nアカウントの開設から設定まで、すべてサポートします。\n\n必要なもの：\n・LINEアカウント（個人用でOK）\n・メールアドレス\n\nそれだけで始められます✨`,
    7: `🛠 契約後のサポート\n\n納品後も安心のサポートがあります。\n\n・納品後1週間：無償で修正対応\n・月額保守プラン（任意）：運用相談・改修・配信サポート\n\n「使い方がわからない」「追加したい機能がある」など、お気軽にご相談ください😊`,
    8: `↩️ キャンセル・返金について\n\n・着手前のキャンセル：全額返金\n・着手後のキャンセル：進捗に応じた費用をご負担いただきます\n・納品後の返金：対応しておりません\n\n詳しくは特定商取引法に基づく表記をご確認ください。\n\n💬 ご不安な点はお気軽にご相談ください！`
  };

  const answer = faqs[n] || faqs[1];
  return {
    type: 'text',
    text: `${answer}\n\n他にご質問があればそのままご返信ください😊`
  };
}

// ════════════════════════════════════════════════════
// 資料を受け取る
// ════════════════════════════════════════════════════

function msgMaterial() {
  return {
    type: 'text',
    text: `📄 サービス資料をお送りします！\n\n料金・プラン・対応業種・導入の流れをまとめています。\n\n👇 こちらからダウンロードできます\nhttps://drive.google.com/file/d/1az85HPgvUJ-pK4focpQn9dg8n_OPeGzg/view?usp=sharing\n\nご不明な点はそのままご返信ください😊`
  };
}

// ════════════════════════════════════════════════════
// 相談する
// ════════════════════════════════════════════════════

function msgConsult() {
  return {
    type: 'text',
    text: `💬 ご相談はこちらで承ります！\n\nどんな小さなことでもお気軽にどうぞ。\n\n以下のような内容もお気軽にご相談ください👇\n\n・LINEで何ができるか知りたい\n・見積もりの詳細を聞きたい\n・他社と比較検討中\n・自分でやってみたが上手くいかない\n\nご相談内容をこのトークにご返信ください👇`
  };
}

function msgConsultReceived() {
  return {
    type: 'text',
    text: `ありがとうございます！\nご相談内容を受け付けました😊\n\n通常1営業日以内にこちらのトークよりご返信いたします。\nしばらくお待ちください📩`
  };
}

// ════════════════════════════════════════════════════
// 共通ユーティリティ
// ════════════════════════════════════════════════════

function msgInvalid(max) {
  return {
    type: 'text',
    text: `1〜${max}の番号で送ってください😊`
  };
}

function isValid(text, max) {
  const n = parseInt(text);
  return !isNaN(n) && n >= 1 && n <= max;
}

// ── スプレッドシートで状態管理 ──
function getState(userId) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      return { step: data[i][1], a1: data[i][2], a2: data[i][3], a3: data[i][4] };
    }
  }
  return { step: 0, a1: '', a2: '', a3: '' };
}

function setState(userId, step, a1, a2, a3) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2, 1, 5).setValues([[step, a1, a2, a3, new Date()]]);
      return;
    }
  }
  sheet.appendRow([userId, step, a1, a2, a3, new Date()]);
}

function getSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
}

// ── 結果ログ ──
function logResult(userId, displayName, a1, a2, a3, result) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(RESULTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(RESULTS_SHEET);
    sheet.appendRow(['timestamp', '表示名', 'userId', '業種', 'やりたいこと', '現在の状況', 'プラン', '概算']);
  }

  const INDUSTRY = ['', '整体院・治療院', '美容室・サロン', 'コンサル・コーチング', '士業・専門職', '飲食店', 'EC・物販', 'その他'];
  const WANT     = ['', '予約・問い合わせの自動化', 'ステップ配信・教育コンテンツ', '顧客管理・データ連携', '複数まとめてやりたい'];
  const STATUS   = ['', 'アカウント未作成', '作ったが使えていない', '機能を増やしたい'];

  sheet.appendRow([
    new Date(),
    displayName,
    userId,
    INDUSTRY[parseInt(a1)] || a1,
    WANT[parseInt(a2)]     || a2,
    STATUS[parseInt(a3)]   || a3,
    result.plan,
    result.monitor
  ]);
}

// ── LINEプロフィール取得 ──
function getDisplayName(userId) {
  try {
    const res = UrlFetchApp.fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { 'Authorization': 'Bearer ' + LINE_TOKEN }
    });
    return JSON.parse(res.getContentText()).displayName || userId;
  } catch (e) {
    return userId;
  }
}

// ── LINE API ──
function replyMessages(replyToken, messages) {
  const url     = 'https://api.line.me/v2/bot/message/reply';
  const payload = JSON.stringify({ replyToken, messages });
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_TOKEN
    },
    payload
  });
}
