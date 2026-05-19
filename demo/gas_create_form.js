// ============================================================
// あおば税理士法人 — 無料相談フォーム自動作成スクリプト
// 実行方法：GASエディタで createConsultationForm() を選択して実行
// ============================================================

function createConsultationForm() {
  // フォームを作成
  const form = FormApp.create('【あおば税理士法人】無料相談お申込みフォーム');
  form.setDescription('初回無料相談のお申込みフォームです。\nご記入後、1営業日以内にご連絡いたします。');
  form.setCollectEmail(false);
  form.setConfirmationMessage('お申込みありがとうございます。\n1営業日以内に担当者よりご連絡いたします。');

  // ① お名前
  form.addTextItem()
    .setTitle('お名前（法人名）')
    .setRequired(true);

  // ② 事業内容・業種
  form.addTextItem()
    .setTitle('事業内容・業種')
    .setHelpText('例：飲食業、IT、建設業、フリーランスなど')
    .setRequired(true);

  // ③ 相談内容（チェックボックス）
  form.addCheckboxItem()
    .setTitle('ご相談内容（複数選択可）')
    .setChoiceValues([
      '節税・経費の見直し',
      '確定申告・決算',
      '創業・開業サポート',
      '法人化の検討',
      'インボイス・消費税',
      '相続・事業承継',
      '税務調査対応',
      'その他',
    ])
    .setRequired(true);

  // ④ 詳細・その他
  form.addParagraphTextItem()
    .setTitle('ご相談の詳細・その他ご要望')
    .setHelpText('具体的な状況や気になっている点をご記入ください（任意）')
    .setRequired(false);

  // ⑤ ご希望日時（第1希望）
  form.addTextItem()
    .setTitle('ご希望の日時（第1希望）')
    .setHelpText('例：5月20日（月）午後14時〜')
    .setRequired(true);

  // ⑥ ご希望日時（第2希望）
  form.addTextItem()
    .setTitle('ご希望の日時（第2希望）')
    .setHelpText('例：5月21日（火）午前中')
    .setRequired(false);

  // ⑦ 対応方法
  form.addMultipleChoiceItem()
    .setTitle('ご希望の対応方法')
    .setChoiceValues(['オンライン（Zoom等）', '事務所にて対面', 'どちらでも可'])
    .setRequired(true);

  // ⑧ 連絡先（LINE以外）
  form.addTextItem()
    .setTitle('メールアドレス（任意）')
    .setHelpText('LINEの他にメールでもご連絡を希望される場合はご記入ください')
    .setRequired(false);

  // 回答をスプレッドシートに連携
  const ss = SpreadsheetApp.create('【あおば税理士法人】相談申込み一覧');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // URLをログに出力
  const formUrl  = form.getPublishedUrl();
  const shortUrl = form.shortenFormUrl(formUrl);
  const ssUrl    = ss.getUrl();

  Logger.log('=== フォーム作成完了 ===');
  Logger.log('フォームURL（短縮）: ' + shortUrl);
  Logger.log('フォームURL（通常）: ' + formUrl);
  Logger.log('スプレッドシートURL: ' + ssUrl);
  Logger.log('スプレッドシートID : ' + ss.getId());

  // GASのスクリプトプロパティに自動設定
  PropertiesService.getScriptProperties().setProperty('FORM_URL', shortUrl);
  Logger.log('✅ スクリプトプロパティ FORM_URL に自動設定しました');
}
