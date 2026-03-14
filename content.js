/**
 * しらべる君 - Content Script
 * メルカリ商品ページにeBay調査ボタンを追加
 * 価格計算機能を統合
 */
(function() {
  'use strict';

  console.log('[しらべる君] Content Script 読み込み開始');
  console.log('[しらべる君] 現在のURL:', window.location.href);

  // 表示中のパネル
  let currentPanel = null;

  // 価格計算インスタンス
  let priceCalculator = null;

  // ボタン追加を諦めたフラグ（MutationObserverの無限呼び出し防止）
  let buttonGaveUp = false;
  let initialLoadDone = false;

  // セラータイプ定義
  const SELLER_TYPES = {
    supplier: { label: '仕入れ先', color: '#4caf50', icon: '🛒' },
    rival: { label: 'ライバル', color: '#2196f3', icon: '🎯' },
    caution: { label: '要注意', color: '#f44336', icon: '⚠️' },
    other: { label: 'その他', color: '#9e9e9e', icon: '📌' }
  };

  /**
   * 商品ページかどうかを判定
   */
  function isProductPage() {
    const url = window.location.href;
    const isProduct = /jp\.mercari\.com\/item\//.test(url) ||
                      /jp\.mercari\.com\/shops\/product\//.test(url);
    return isProduct;
  }

  /**
   * メルカリのセラー情報を取得
   */
  function getSellerInfo() {
    // セラー名のセレクタ
    const sellerSelectors = [
      'a[data-testid="seller-name"]',
      'a[href*="/user/profile/"]',
      'a[href*="/shops/"]'
    ];

    for (const selector of sellerSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const href = el.getAttribute('href') || '';

        // セラー名を取得（評価数やバッジを除外）
        let name = '';

        // 方法1: mer-text要素を探す（メルカリの新しいUI）
        const merText = el.querySelector('mer-text');
        if (merText) {
          name = merText.textContent?.trim() || '';
        }

        // 方法2: 数字のみでないspan要素を探す
        if (!name || /^\d+$/.test(name)) {
          const spans = el.querySelectorAll('span');
          for (const span of spans) {
            const spanText = span.textContent?.trim() || '';
            // 数字のみ、または「本人確認済」などのバッジは除外
            if (spanText && !/^\d+$/.test(spanText) && !spanText.includes('本人確認')) {
              name = spanText;
              break;
            }
          }
        }

        // 方法3: 直接のテキストノードを探す
        if (!name || /^\d+$/.test(name)) {
          const textNodes = Array.from(el.childNodes).filter(node =>
            node.nodeType === Node.TEXT_NODE && node.textContent.trim()
          );
          for (const node of textNodes) {
            const text = node.textContent.trim();
            if (text && !/^\d+$/.test(text)) {
              name = text;
              break;
            }
          }
        }

        // 方法4: 全体のテキストからパターンを除去
        if (!name || /^\d+$/.test(name)) {
          const fullText = el.textContent?.trim() || '';
          // 最初の非数字部分を取得
          // 「セラー名 123 45 6 本人確認済」→「セラー名」
          const match = fullText.match(/^(.+?)\s+\d/);
          if (match) {
            name = match[1].trim();
          } else {
            // 数字や「本人確認済」を除去
            name = fullText.replace(/\s+\d+(\s+\d+)*\s*$/g, '').trim();
            name = name.replace(/\s*本人確認済.*$/g, '').trim();
          }
        }

        // ユーザーIDを抽出
        let platformId = '';
        let url = '';

        if (href.includes('/user/profile/')) {
          // 通常ユーザー: /user/profile/123456789
          const match = href.match(/\/user\/profile\/(\d+)/);
          if (match) {
            platformId = match[1];
            url = `https://jp.mercari.com/user/profile/${platformId}`;
          }
        } else if (href.includes('/shops/')) {
          // ショップ: /shops/xxxx
          const match = href.match(/\/shops\/([^\/\?]+)/);
          if (match) {
            platformId = `shop_${match[1]}`;
            url = `https://jp.mercari.com/shops/${match[1]}`;
          }
        }

        if (platformId && name && !/^\d+$/.test(name)) {
          console.log('[しらべる君] セラー情報取得:', { name, platformId, url });
          return { name, platformId, url, platform: 'mercari' };
        }
      }
    }

    console.log('[しらべる君] セラー情報取得失敗');
    return null;
  }

  /**
   * 商品タイトルを取得（とりこみ君のセレクタを参照）
   */
  function getProductTitle() {
    // メルカリ専用のセレクタ（とりこみ君から参照）
    const titleSelectors = [
      'h1[data-testid="name"]',
      'mer-heading[data-testid="name"]',
      'h1.merBlock__title',
      'h1[class*="heading"]',
      'mer-heading[variant="headingM"]',
      'h2.item-name'
    ];

    // 除外キーワード（他の拡張機能が挿入する要素）
    const excludeKeywords = ['ぷろん君', 'みちゃった君', 'しらべる君', 'とりこみ君'];

    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || '';

        // 除外チェック
        const shouldExclude = excludeKeywords.some(kw =>
          text.toLowerCase().includes(kw.toLowerCase())
        );

        if (text && text.length > 5 && !shouldExclude) {
          console.log('[しらべる君] タイトル取得成功:', selector, '->', text.substring(0, 50));
          return text;
        }
      }
    }

    // フォールバック: main内のh1
    const mainEl = document.querySelector('main') || document.querySelector('#main');
    if (mainEl) {
      const h1 = mainEl.querySelector('h1');
      if (h1) {
        const text = h1.textContent?.trim() || '';
        const shouldExclude = excludeKeywords.some(kw =>
          text.toLowerCase().includes(kw.toLowerCase())
        );
        if (text && text.length > 5 && !shouldExclude) {
          console.log('[しらべる君] タイトル取得(main h1):', text.substring(0, 50));
          return text;
        }
      }
    }

    console.log('[しらべる君] タイトル取得失敗');
    return '';
  }

  /**
   * 商品説明を取得（とりこみ君のセレクタを参照）
   */
  function getProductDescription() {
    // メルカリ専用のセレクタ
    const descriptionSelectors = [
      'div[data-testid="description"]',
      'pre[data-testid="description"]',
      'div.item-description',
      'pre.item-description__inner',
      'mer-text[class*="description"]',
      'pre[class*="description"]'
    ];

    for (const selector of descriptionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (text && text.length > 10) {
          console.log('[しらべる君] 説明取得成功:', selector, '->', text.substring(0, 50));
          // 最大500文字に制限（トークン節約）
          return text.substring(0, 500);
        }
      }
    }

    // フォールバック: preタグを探す
    const allPre = document.querySelectorAll('pre');
    for (const pre of allPre) {
      const text = pre.textContent?.trim() || '';
      if (text && text.length > 30) {
        console.log('[しらべる君] 説明取得(fallback pre):', text.substring(0, 50));
        return text.substring(0, 500);
      }
    }

    console.log('[しらべる君] 説明取得失敗');
    return '';
  }

  /**
   * メルカリ商品価格を取得
   */
  function getProductPrice() {
    // メルカリ価格セレクタ（複数パターン対応）
    const priceSelectors = [
      '[data-testid="product-price"]',  // メルカリショップ用
      'span[data-testid="price"]',
      'mer-price[data-testid="price"]',
      'div[data-testid="price"] span',
      '.item-price',
      'mer-price.sc-mer-price',
      '[class*="Price"] span'
    ];

    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        // 価格テキストから数値を抽出（¥1,234 → 1234）
        const priceText = el.textContent || el.getAttribute('value') || '';
        const priceMatch = priceText.replace(/[,，]/g, '').match(/[\d]+/);
        if (priceMatch) {
          const price = parseInt(priceMatch[0], 10);
          console.log('[しらべる君] 価格取得成功:', selector, '->', price);
          return price;
        }
      }
    }

    // フォールバック: ページ内の¥記号の後の数字を探す
    const priceElements = document.querySelectorAll('span, div, p');
    for (const el of priceElements) {
      const text = el.textContent || '';
      // ¥4,500 形式を探す（税込表示の近くにあるもの）
      if (text.includes('¥') && text.includes('税込')) {
        const match = text.replace(/[,，]/g, '').match(/¥([\d]+)/);
        if (match) {
          const price = parseInt(match[1], 10);
          if (price > 0 && price < 10000000) {
            console.log('[しらべる君] 価格取得(税込検索):', price);
            return price;
          }
        }
      }
    }

    // フォールバック2: metaタグから
    const metaPrice = document.querySelector('meta[property="product:price:amount"]');
    if (metaPrice) {
      const price = parseInt(metaPrice.content, 10);
      if (price > 0) {
        console.log('[しらべる君] 価格取得(meta):', price);
        return price;
      }
    }

    // フォールバック3: 大きな数字で¥を含む要素を探す
    const allText = document.body.innerText;
    const bigPriceMatch = allText.match(/¥\s*([\d,]+)\s*[\(（]税込/);
    if (bigPriceMatch) {
      const price = parseInt(bigPriceMatch[1].replace(/,/g, ''), 10);
      if (price > 0) {
        console.log('[しらべる君] 価格取得(bodyテキスト):', price);
        return price;
      }
    }

    console.log('[しらべる君] 価格取得失敗');
    return null;
  }

  /**
   * プレミアム状態をチェック（同期版 - キャッシュ使用）
   */
  let isPremiumCached = null;
  async function checkPremiumStatus() {
    try {
      const data = await chrome.storage.local.get(['shiraberu_secret_code']);
      const secretCode = data.shiraberu_secret_code;
      isPremiumCached = secretCode && ['MGOOSE2025'].includes(secretCode.trim().toUpperCase());
      console.log('[しらべる君] プレミアム状態:', isPremiumCached);
      return isPremiumCached;
    } catch (error) {
      console.error('[しらべる君] プレミアムチェックエラー:', error);
      return false;
    }
  }

  /**
   * プレミアム機能の案内HTMLを生成
   */
  function generatePremiumPromptSection() {
    return `
      <div class="kuraberu-price-calc-section kuraberu-premium-section">
        <div class="kuraberu-section-header">🔒 価格計算（プレミアム機能）</div>
        <div style="padding: 16px; text-align: center;">
          <div style="font-size: 13px; color: #666; margin-bottom: 12px; line-height: 1.6;">
            価格計算機能はプレミアム会員限定です。<br>
            スクール会員の方はシークレットコードを入力してください。
          </div>
          <div style="background: #f5f5f5; border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 12px; text-align: left;">
            <div style="margin-bottom: 6px;">🎫 スクール会員：シークレットコードを入力</div>
            <div>💳 一般：1,000円で全機能を永久解放</div>
          </div>
          <button class="kuraberu-premium-settings-btn" style="
            width: 100%;
            padding: 10px;
            background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          ">⚙️ 設定画面へ</button>
        </div>
      </div>
    `;
  }

  /**
   * 価格計算セクションのHTMLを生成
   */
  function generatePriceCalcSection(priceJPY, isPremium) {
    // プレミアムでない場合は案内を表示
    if (!isPremium) {
      return generatePremiumPromptSection();
    }

    if (!priceJPY || !priceCalculator) {
      console.log('[しらべる君] 価格計算スキップ: priceJPY=', priceJPY, 'calculator=', !!priceCalculator);
      return '';
    }

    const result = priceCalculator.calculateEbaySellingPrice(priceJPY);
    if (!result) {
      return `
        <div class="kuraberu-price-calc-section">
          <div class="kuraberu-section-header">💰 価格計算</div>
          <div class="kuraberu-price-error">設定を読み込めませんでした</div>
        </div>
      `;
    }

    const s = priceCalculator.settings;

    // 手数料をUSDに変換
    const ebayFeeUSD = result.ebayFeeJPY / s.exchangeRate;
    const adFeeUSD = result.adFeeJPY / s.exchangeRate;
    const payoneerFeeUSD = result.payoneerFeeJPY / s.exchangeRate;

    return `
      <div class="kuraberu-price-calc-section">
        <div class="kuraberu-section-header">💰 eBay販売価格計算</div>
        <div class="kuraberu-price-main">
          <div class="kuraberu-price-row kuraberu-price-highlight">
            <span class="kuraberu-price-label">メルカリ価格</span>
            <span class="kuraberu-price-value">¥${priceJPY.toLocaleString()}</span>
          </div>
          <div class="kuraberu-price-row kuraberu-price-result">
            <span class="kuraberu-price-label">eBay販売価格（DDU）</span>
            <span class="kuraberu-price-value">$${result.dduPriceUSD.toFixed(2)}</span>
          </div>
          <div class="kuraberu-price-row">
            <span class="kuraberu-price-label">eBay販売価格（DDP）</span>
            <span class="kuraberu-price-value">$${result.ddpPriceUSD.toFixed(2)}</span>
          </div>
          <div class="kuraberu-price-row">
            <span class="kuraberu-price-label">期待利益</span>
            <span class="kuraberu-price-value kuraberu-profit">¥${result.profitJPY.toLocaleString()}</span>
          </div>
        </div>
        <details class="kuraberu-price-details">
          <summary>詳細内訳</summary>
          <div class="kuraberu-price-breakdown">
            <div class="kuraberu-price-row">
              <span>仕入れ価格</span>
              <span>¥${priceJPY.toLocaleString()}</span>
            </div>
            <div class="kuraberu-price-row">
              <span>送料（${result.shippingMethodName}）</span>
              <span>¥${result.shippingCostJPY.toLocaleString()}</span>
            </div>
            <div class="kuraberu-price-row">
              <span>eBay手数料（${s.feeRate}%）</span>
              <span>$${ebayFeeUSD.toFixed(2)}</span>
            </div>
            <div class="kuraberu-price-row">
              <span>広告費（${s.adRate}%）</span>
              <span>$${adFeeUSD.toFixed(2)}</span>
            </div>
            <div class="kuraberu-price-row">
              <span>Payoneer手数料（${s.payoneerRate}%）</span>
              <span>$${payoneerFeeUSD.toFixed(2)}</span>
            </div>
            <div class="kuraberu-price-row">
              <span>目標利益率</span>
              <span>${s.targetProfitRate}%</span>
            </div>
            <div class="kuraberu-price-row">
              <span>為替レート</span>
              <span>¥${s.exchangeRate}/USD</span>
            </div>
          </div>
        </details>
      </div>
    `;
  }

  /**
   * 価格計算を初期化
   */
  async function initPriceCalculator() {
    if (typeof PriceCalculator !== 'undefined') {
      priceCalculator = new PriceCalculator();
      await priceCalculator.loadSettings();
      console.log('[しらべる君] PriceCalculator 初期化完了');
      return true;
    }
    console.log('[しらべる君] PriceCalculator が見つかりません');
    return false;
  }

  /**
   * eBay調査ボタンを追加
   */
  function addResearchButton(retryCount = 0) {
    // リトライ済みで諦めた場合は何もしない
    if (buttonGaveUp) {
      return;
    }

    console.log('[しらべる君] ボタン追加処理開始');

    // 既にボタンがあれば何もしない
    if (document.querySelector('.kuraberu-btn')) {
      return;
    }

    // 商品タイトルを取得
    const title = getProductTitle();
    if (!title) {
      if (retryCount < 2) {
        console.log(`[しらべる君] タイトルが見つかりません。2秒後にリトライ... (${retryCount + 1}/2)`);
        setTimeout(() => addResearchButton(retryCount + 1), 2000);
      } else {
        buttonGaveUp = true;
        console.log('[しらべる君] リトライ上限到達。タイトル取得失敗。処理終了');
      }
      return;
    }

    // ボタンを作成
    const btn = document.createElement('button');
    btn.className = 'kuraberu-btn';
    btn.innerHTML = '🔍 eBay調査';
    btn.title = 'eBayでの販売状況を調査します（ドラッグで移動可能）';

    // ボタンを右上にフローティング表示
    btn.style.position = 'fixed';
    btn.style.top = '100px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    btn.style.cursor = 'move';
    document.body.appendChild(btn);

    // ボタンをドラッグ可能に
    const dragState = makeDraggable(btn, btn);

    // クリック時の処理（ドラッグと区別）
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // ドラッグ操作後はクリックを無視
      if (dragState.hasMoved()) return;
      const description = getProductDescription();
      showResearchPanel(title, description, btn);
    });

    console.log('[しらべる君] ボタン追加完了（ドラッグ対応）');
  }

  /**
   * 調査結果パネルを表示
   */
  async function showResearchPanel(originalTitle, originalDescription, buttonElement) {
    console.log('[しらべる君] パネル表示 - 元タイトル:', originalTitle);
    console.log('[しらべる君] パネル表示 - 元説明:', originalDescription?.substring(0, 100));

    // 既存のパネルを閉じる
    closePanel();

    // プレミアム状態をチェック
    const isPremium = await checkPremiumStatus();

    // PriceCalculatorが初期化されていなければ初期化
    if (!priceCalculator) {
      console.log('[しらべる君] PriceCalculator を遅延初期化');
      await initPriceCalculator();
    }

    // 価格を取得
    const price = getProductPrice();
    console.log('[しらべる君] 取得した価格:', price, 'Calculator:', !!priceCalculator, 'isPremium:', isPremium);
    const priceCalcHtml = generatePriceCalcSection(price, isPremium);

    // パネルを作成
    const panel = document.createElement('div');
    panel.className = 'kuraberu-panel';

    panel.innerHTML = `
      <div class="kuraberu-panel-header">
        <span class="kuraberu-panel-title">🔍 eBay市場調査</span>
        <button class="kuraberu-panel-close">✕</button>
      </div>
      <div class="kuraberu-panel-body">
        ${priceCalcHtml}
        <div class="kuraberu-section">
          <label>元のタイトル:</label>
          <div class="kuraberu-original-title">${escapeHtml(originalTitle)}</div>
        </div>
        <div class="kuraberu-section">
          <label>検索キーワード（英語で入力）:</label>
          <input type="text" class="kuraberu-keyword-input" placeholder="例: Hermes scarf silk">
        </div>
        <div class="kuraberu-options-section">
          <label>翻訳に含める要素:</label>
          <div class="kuraberu-options-grid">
            <label class="kuraberu-option"><input type="checkbox" value="brand" checked><span>ブランド</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="category" checked><span>カテゴリ</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="material"><span>素材</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="model"><span>型番</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="character"><span>キャラ名</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="color"><span>色</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="size"><span>サイズ</span></label>
            <label class="kuraberu-option"><input type="checkbox" value="rarity"><span>レアリティ</span></label>
          </div>
        </div>
        <div class="kuraberu-buttons">
          <button class="kuraberu-ai-btn">🤖 AI翻訳</button>
          <button class="kuraberu-search-btn">🔍 eBay</button>
          <button class="kuraberu-terapeak-btn">📊 テラピーク</button>
        </div>
        <div class="kuraberu-message"></div>
        <div class="kuraberu-section-divider" style="border-top: 1px solid #e0e0e0; margin: 16px 0;"></div>
        <div class="kuraberu-section">
          <label>メルカリ検索キーワード:</label>
          <input type="text" class="kuraberu-keyword-input kuraberu-mercari-keyword-input" placeholder="検索キーワードを編集してください" value="${escapeHtml(originalTitle)}">
        </div>
        <div class="kuraberu-section" style="margin-top: 8px;">
          <label>販売状況:</label>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;">
              <input type="radio" name="mercari-status" value="all" checked style="margin: 0;">
              すべて
            </label>
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;">
              <input type="radio" name="mercari-status" value="on_sale" style="margin: 0;">
              販売中
            </label>
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px;">
              <input type="radio" name="mercari-status" value="sold_out" style="margin: 0;">
              売り切れ
            </label>
          </div>
        </div>
        <div class="kuraberu-buttons">
          <button class="kuraberu-mercari-search-btn">🔍 メルカリで検索</button>
        </div>

        <!-- セラー保存セクション（プレミアム機能） -->
        <div class="kuraberu-seller-section" style="display: none;">
          <div class="kuraberu-section-divider" style="border-top: 1px solid #e0e0e0; margin: 16px 0;"></div>
          <div class="kuraberu-section">
            <label style="display: flex; align-items: center; gap: 6px;">
              ⭐ セラーを保存
              <span class="kuraberu-seller-saved-badge" style="display: none; background: #4caf50; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">保存済み</span>
            </label>
            <div class="kuraberu-seller-info" style="margin-top: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; width: 100%;">
                <span style="font-size: 16px; flex-shrink: 0;">🇯🇵</span>
                <input type="text" class="kuraberu-seller-name-input" placeholder="セラー名" style="flex: 1; min-width: 0; padding: 8px 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 13px; font-weight: 600; box-sizing: border-box;">
              </div>
            </div>
            <div style="margin-top: 10px;">
              <label style="font-size: 12px; color: #666;">カテゴリ:</label>
              <div class="kuraberu-category-list" style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
              <div style="margin-top: 6px;">
                <input type="text" class="kuraberu-new-category-input" placeholder="新規カテゴリ名" style="width: calc(100% - 60px); padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                <button class="kuraberu-add-category-btn" style="padding: 6px 10px; background: #0064d2; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">+</button>
              </div>
            </div>
            <div style="margin-top: 10px;">
              <label style="font-size: 12px; color: #666;">タイプ:</label>
              <div class="kuraberu-type-list" style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px;">
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; padding: 4px 8px; background: #e8f5e9; border-radius: 4px; border: 1px solid #4caf50;">
                  <input type="radio" name="seller-type" value="supplier" checked style="margin: 0;">
                  🛒 仕入れ先
                </label>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; padding: 4px 8px; background: #e3f2fd; border-radius: 4px; border: 1px solid #2196f3;">
                  <input type="radio" name="seller-type" value="rival" style="margin: 0;">
                  🎯 ライバル
                </label>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; padding: 4px 8px; background: #ffebee; border-radius: 4px; border: 1px solid #f44336;">
                  <input type="radio" name="seller-type" value="caution" style="margin: 0;">
                  ⚠️ 要注意
                </label>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; padding: 4px 8px; background: #fafafa; border-radius: 4px; border: 1px solid #9e9e9e;">
                  <input type="radio" name="seller-type" value="other" style="margin: 0;">
                  📌 その他
                </label>
              </div>
            </div>
            <div style="margin-top: 10px;">
              <label style="font-size: 12px; color: #666;">メモ:</label>
              <input type="text" class="kuraberu-seller-memo" placeholder="メモ（任意）" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; margin-top: 4px;">
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
              <button class="kuraberu-save-seller-btn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">⭐ 保存</button>
              <button class="kuraberu-view-sellers-btn" style="padding: 10px 14px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; cursor: pointer;">📋 一覧</button>
            </div>
            <div class="kuraberu-seller-message" style="margin-top: 8px; font-size: 12px;"></div>
          </div>
        </div>

        <!-- プレミアム機能案内（セラー保存） -->
        <div class="kuraberu-seller-premium-prompt" style="display: none;">
          <div class="kuraberu-section-divider" style="border-top: 1px solid #e0e0e0; margin: 16px 0;"></div>
          <div style="background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); padding: 12px; border-radius: 8px; border: 1px solid #bdbdbd;">
            <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">🔒 セラー保存（プレミアム機能）</div>
            <div style="font-size: 11px; color: #666; line-height: 1.5;">
              気になるセラーを保存して、カテゴリ別に管理できます。
            </div>
          </div>
        </div>
      </div>
    `;

    // 位置を設定
    panel.style.position = 'fixed';
    panel.style.top = '100px';
    panel.style.right = '20px';
    panel.style.zIndex = '10000';

    document.body.appendChild(panel);
    currentPanel = panel;

    // 閉じるボタン
    panel.querySelector('.kuraberu-panel-close').addEventListener('click', closePanel);

    // 選択されたオプションを取得する関数
    function getSelectedOptions() {
      const checkboxes = panel.querySelectorAll('.kuraberu-options-grid input[type="checkbox"]:checked');
      return Array.from(checkboxes).map(cb => cb.value);
    }

    // AI翻訳ボタン
    panel.querySelector('.kuraberu-ai-btn').addEventListener('click', () => {
      const selectedOptions = getSelectedOptions();
      console.log('[しらべる君] AI翻訳クリック - 選択オプション:', selectedOptions);
      if (selectedOptions.length === 0) {
        showMessage(panel, '⚠️ 少なくとも1つの要素を選択してください', 'warning');
        return;
      }
      generateKeywordWithAI(originalTitle, originalDescription, panel, selectedOptions);
    });

    // eBay検索ボタン
    panel.querySelector('.kuraberu-search-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openEbaySearch(keyword);
      } else {
        showMessage(panel, '⚠️ 検索キーワードを入力してください', 'warning');
      }
    });

    // テラピーク検索ボタン
    panel.querySelector('.kuraberu-terapeak-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openTerapeakSearch(keyword);
      } else {
        showMessage(panel, '⚠️ 検索キーワードを入力してください', 'warning');
      }
    });

    // メルカリ検索ボタン
    panel.querySelector('.kuraberu-mercari-search-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-mercari-keyword-input').value.trim();
      const status = panel.querySelector('input[name="mercari-status"]:checked')?.value || 'all';
      if (keyword) {
        openMercariSearch(keyword, status);
      } else {
        showMessage(panel, '⚠️ メルカリ検索キーワードを入力してください', 'warning');
      }
    });

    // メルカリ検索入力欄でEnterキー
    panel.querySelector('.kuraberu-mercari-keyword-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-mercari-keyword-input').value.trim();
        const status = panel.querySelector('input[name="mercari-status"]:checked')?.value || 'all';
        if (keyword) {
          openMercariSearch(keyword, status);
        }
      }
    });

    // Enterキーでも検索
    panel.querySelector('.kuraberu-keyword-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
        if (keyword) {
          openEbaySearch(keyword);
        }
      }
    });

    // ドラッグ可能に
    makeDraggable(panel, panel.querySelector('.kuraberu-panel-header'));

    // プレミアム案内の設定ボタン（存在する場合のみ）
    const premiumSettingsBtn = panel.querySelector('.kuraberu-premium-settings-btn');
    if (premiumSettingsBtn) {
      premiumSettingsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
      });
    }

    // ========================================
    // セラー保存機能（プレミアム機能）
    // ========================================
    const sellerSection = panel.querySelector('.kuraberu-seller-section');
    const sellerPremiumPrompt = panel.querySelector('.kuraberu-seller-premium-prompt');
    const sellerInfo = getSellerInfo();

    if (isPremium && sellerInfo) {
      // プレミアムかつセラー情報が取得できた場合
      sellerSection.style.display = 'block';
      sellerPremiumPrompt.style.display = 'none';

      // セラー名を表示（編集可能なinputフィールド）
      panel.querySelector('.kuraberu-seller-name-input').value = sellerInfo.name;

      // カテゴリ一覧を読み込み
      initSellerSection(panel, sellerInfo);
    } else if (!isPremium && sellerInfo) {
      // 非プレミアムの場合はプレミアム案内を表示
      sellerSection.style.display = 'none';
      sellerPremiumPrompt.style.display = 'block';
    }
  }

  /**
   * セラー保存セクションを初期化
   */
  async function initSellerSection(panel, sellerInfo) {
    const categoryListEl = panel.querySelector('.kuraberu-category-list');
    const savedBadge = panel.querySelector('.kuraberu-seller-saved-badge');
    const memoInput = panel.querySelector('.kuraberu-seller-memo');

    // 既に保存済みかチェック
    const checkResult = await chrome.runtime.sendMessage({
      action: 'seller_checkSaved',
      platform: sellerInfo.platform,
      platformId: sellerInfo.platformId
    });

    let existingSeller = null;
    if (checkResult.success && checkResult.saved) {
      existingSeller = checkResult.seller;
      savedBadge.style.display = 'inline';

      // 既存のメモを表示
      if (existingSeller.memo) {
        memoInput.value = existingSeller.memo;
      }

      // 既存のタイプを選択
      if (existingSeller.type) {
        const typeRadio = panel.querySelector(`input[name="seller-type"][value="${existingSeller.type}"]`);
        if (typeRadio) typeRadio.checked = true;
      }
    }

    // カテゴリ一覧を取得して表示
    await loadCategories(panel, existingSeller);

    // 新規カテゴリ追加ボタン
    panel.querySelector('.kuraberu-add-category-btn').addEventListener('click', async () => {
      const input = panel.querySelector('.kuraberu-new-category-input');
      const name = input.value.trim();
      if (!name) return;

      const result = await chrome.runtime.sendMessage({
        action: 'seller_addCategory',
        name: name
      });

      if (result.success) {
        input.value = '';
        await loadCategories(panel, existingSeller, result.id); // 新規カテゴリを選択状態に
        showSellerMessage(panel, '✅ カテゴリを追加しました', 'success');
      } else {
        showSellerMessage(panel, `❌ ${result.error}`, 'error');
      }
    });

    // Enterキーでカテゴリ追加
    panel.querySelector('.kuraberu-new-category-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        panel.querySelector('.kuraberu-add-category-btn').click();
      }
    });

    // セラー保存ボタン
    panel.querySelector('.kuraberu-save-seller-btn').addEventListener('click', async () => {
      const selectedCategories = Array.from(panel.querySelectorAll('.kuraberu-category-checkbox:checked'))
        .map(cb => cb.value);

      if (selectedCategories.length === 0) {
        showSellerMessage(panel, '⚠️ カテゴリを選択してください', 'warning');
        return;
      }

      const type = panel.querySelector('input[name="seller-type"]:checked')?.value || 'other';
      const memo = panel.querySelector('.kuraberu-seller-memo').value.trim();

      // inputフィールドから編集されたセラー名を取得
      const editedSellerName = panel.querySelector('.kuraberu-seller-name-input').value.trim() || sellerInfo.name;

      const result = await chrome.runtime.sendMessage({
        action: 'seller_save',
        seller: {
          platform: sellerInfo.platform,
          platformId: sellerInfo.platformId,
          name: editedSellerName,
          url: sellerInfo.url,
          categoryIds: selectedCategories,
          type: type,
          memo: memo
        }
      });

      if (result.success) {
        savedBadge.style.display = 'inline';
        showSellerMessage(panel, '✅ セラーを保存しました', 'success');
      } else {
        showSellerMessage(panel, `❌ ${result.error}`, 'error');
      }
    });

    // セラー一覧ボタン（ポップアップを開く）
    panel.querySelector('.kuraberu-view-sellers-btn').addEventListener('click', () => {
      // 選択中のカテゴリを取得
      const selectedCategory = panel.querySelector('.kuraberu-category-checkbox:checked');
      if (selectedCategory) {
        // 選択中のカテゴリIDを保存してポップアップで使用
        chrome.storage.local.set({ shiraberu_view_category_id: selectedCategory.value });
      }
      // ポップアップを開く（実際にはユーザーがツールバーのアイコンをクリックする必要がある）
      showSellerMessage(panel, 'ツールバーのしらべる君アイコンをクリックして「セラー管理」タブを開いてください', 'info');
    });
  }

  /**
   * カテゴリ一覧を読み込んで表示
   */
  async function loadCategories(panel, existingSeller = null, selectNewId = null) {
    const categoryListEl = panel.querySelector('.kuraberu-category-list');

    // カテゴリ一覧を取得
    const result = await chrome.runtime.sendMessage({ action: 'seller_getCategories' });
    if (!result.success) {
      categoryListEl.innerHTML = '<span style="color: #999; font-size: 11px;">カテゴリを読み込めませんでした</span>';
      return;
    }

    const categories = result.categories || [];

    // 最後に使用したカテゴリを取得
    const lastCatResult = await chrome.runtime.sendMessage({ action: 'seller_getLastCategory' });
    const lastCategoryId = lastCatResult.success ? lastCatResult.categoryId : null;

    if (categories.length === 0) {
      categoryListEl.innerHTML = '<span style="color: #999; font-size: 11px;">カテゴリがありません。新規作成してください</span>';
      return;
    }

    // カテゴリをチェックボックスで表示
    categoryListEl.innerHTML = categories.map(cat => {
      // 既存セラーのカテゴリ、または新規追加したカテゴリ、または最後に使用したカテゴリをチェック
      const isExisting = existingSeller?.categoryIds?.includes(cat.id);
      const isNewlyAdded = cat.id === selectNewId;
      const isLastUsed = cat.id === lastCategoryId && !existingSeller;
      const checked = isExisting || isNewlyAdded || isLastUsed ? 'checked' : '';

      return `
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; padding: 4px 8px; background: #fff; border: 1px solid #ddd; border-radius: 4px;">
          <input type="checkbox" class="kuraberu-category-checkbox" value="${cat.id}" ${checked} style="margin: 0;">
          ${escapeHtml(cat.name)}
        </label>
      `;
    }).join('');
  }

  /**
   * セラーセクションのメッセージを表示
   */
  function showSellerMessage(panel, text, type) {
    const msgEl = panel.querySelector('.kuraberu-seller-message');
    if (!msgEl) return;

    msgEl.textContent = text;
    if (type === 'success') {
      msgEl.style.color = '#4caf50';
    } else if (type === 'error') {
      msgEl.style.color = '#f44336';
    } else if (type === 'warning') {
      msgEl.style.color = '#ff9800';
    } else {
      msgEl.style.color = '#666';
    }

    setTimeout(() => {
      msgEl.textContent = '';
    }, 4000);
  }

  /**
   * AIでeBay検索キーワードを生成
   * @param {string} title - 商品タイトル
   * @param {string} description - 商品説明
   * @param {HTMLElement} panel - パネル要素
   * @param {Array} options - 選択された要素の配列（例: ['brand', 'category']）
   */
  async function generateKeywordWithAI(title, description, panel, options = ['brand', 'category']) {
    const messageEl = panel.querySelector('.kuraberu-message');
    const inputEl = panel.querySelector('.kuraberu-keyword-input');
    const aiBtn = panel.querySelector('.kuraberu-ai-btn');

    // ボタンを無効化
    aiBtn.disabled = true;
    aiBtn.textContent = '🔄 生成中...';
    messageEl.innerHTML = `<span class="kuraberu-loading-text">🤖 AIが翻訳中...（${options.length}要素）</span>`;
    messageEl.className = 'kuraberu-message';

    try {
      // まずAPIキーがあるか確認
      const checkResult = await chrome.runtime.sendMessage({ action: 'checkApiKey' });

      if (!checkResult.hasKey) {
        showMessage(panel, '⚠️ OpenAI APIキーが設定されていません。拡張機能の設定画面でAPIキーを入力してください。', 'warning');
        // 設定画面を開くリンクを追加
        messageEl.innerHTML += '<br><a href="#" class="kuraberu-settings-link" style="color: #0064d2; text-decoration: underline; cursor: pointer;">設定を開く</a>';
        messageEl.querySelector('.kuraberu-settings-link').addEventListener('click', (e) => {
          e.preventDefault();
          // content scriptからはopenOptionsPageが使えないのでbackgroundに依頼
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        });
        return;
      }

      // バックグラウンドでキーワード生成（タイトル＋説明＋オプションを送信）
      const result = await chrome.runtime.sendMessage({
        action: 'generateKeyword',
        title: title,
        description: description || '',
        options: options
      });

      if (result.success) {
        inputEl.value = result.keyword;
        showMessage(panel, '✅ キーワードを生成しました！「eBayで検索」をクリックしてください', 'success');
      } else {
        showMessage(panel, `❌ エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[しらべる君] AI生成エラー:', error);
      showMessage(panel, `❌ エラーが発生しました: ${error.message}`, 'error');
    } finally {
      // ボタンを復元
      aiBtn.disabled = false;
      aiBtn.textContent = '🤖 AI翻訳';
    }
  }

  /**
   * eBay Sold Listings検索ページを開く（日本からの出品のみ、Fixed Price/Best Offer）
   */
  function openEbaySearch(keyword) {
    // eBay Sold Listings検索URL（日本からの出品に絞る）
    // _salic=104 = Japan, LH_LocatedIn=1 = フィルター有効化
    // LH_BIN=1 = Buy It Now (Fixed Price + Best Offer), オークション除外
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Complete=1&LH_Sold=1&_sop=13&_salic=104&LH_LocatedIn=1&LH_BIN=1`;

    // バックグラウンドで開く
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: ebayUrl,
      active: true
    });

    console.log('[しらべる君] eBay検索を開きました（日本・即決）:', keyword);
  }

  /**
   * テラピーク検索ページを開く（日本からの出品のみ、Fixed Price + Best Offer）
   */
  function openTerapeakSearch(keyword) {
    // テラピークProduct Research検索URL
    // sellerCountry=SellerLocation:::JP で日本の出品者に限定
    // format=FIXED_PRICE&format=BEST_OFFER で即決・ベストオファーに絞る（オークション除外）
    const terapeakUrl = `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${encodeURIComponent(keyword)}&dayRange=90&tabName=SOLD&sellerCountry=SellerLocation%3A%3A%3AJP&format=FIXED_PRICE&format=BEST_OFFER`;

    // バックグラウンドで開く
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: terapeakUrl,
      active: true
    });

    console.log('[しらべる君] テラピーク検索を開きました（日本・即決/BO）:', keyword);
  }

  /**
   * メルカリ検索ページを開く
   */
  function openMercariSearch(keyword, status = 'all') {
    // メルカリ検索URL
    let mercariUrl = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`;

    // 販売状況パラメータを追加
    if (status === 'on_sale') {
      mercariUrl += '&status=on_sale';
    } else if (status === 'sold_out') {
      mercariUrl += '&status=sold_out%7Ctrading';
    }
    // 'all'の場合はパラメータなし

    // バックグラウンドで開く
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: mercariUrl,
      active: true
    });

    console.log('[しらべる君] メルカリ検索を開きました:', keyword, '販売状況:', status);
  }

  /**
   * メッセージを表示
   */
  function showMessage(panel, message, type) {
    const messageEl = panel.querySelector('.kuraberu-message');
    messageEl.className = `kuraberu-message kuraberu-message-${type}`;
    messageEl.textContent = message;
  }

  /**
   * パネルを閉じる
   */
  function closePanel() {
    if (currentPanel) {
      currentPanel.remove();
      currentPanel = null;
    }
  }

  /**
   * 要素をドラッグ可能にする（ボタン・パネル両対応）
   */
  function makeDraggable(element, handle, options = {}) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, initialLeft, initialTop, initialRight;

    handle.style.cursor = 'move';

    handle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('kuraberu-panel-close')) return;

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      // left/rightどちらで配置されているかを判定
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.right !== 'auto' && !element.style.left) {
        initialRight = parseInt(computedStyle.right);
        initialTop = parseInt(computedStyle.top);
      } else {
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
        initialRight = null;
      }
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      // 画面外に出ないよう制限
      if (initialRight !== null) {
        // right基準で配置されている場合
        const newRight = Math.max(0, Math.min(initialRight - dx, window.innerWidth - element.offsetWidth));
        const newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - element.offsetHeight));
        element.style.right = `${newRight}px`;
        element.style.top = `${newTop}px`;
        element.style.left = 'auto';
      } else {
        // left基準で配置されている場合
        const newLeft = Math.max(0, Math.min(initialLeft + dx, window.innerWidth - element.offsetWidth));
        const newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - element.offsetHeight));
        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        element.style.right = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // クリックとドラッグを区別するためのフラグを返す
    return {
      hasMoved: () => hasMoved
    };
  }

  /**
   * HTMLエスケープ
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 初期化
   */
  async function init() {
    console.log('[しらべる君] 初期化開始');

    // ページリロード時に古いUI要素をクリーンアップ
    document.querySelectorAll('.kuraberu-btn, .kuraberu-panel').forEach(el => el.remove());
    currentPanel = null;

    if (!isProductPage()) {
      console.log('[しらべる君] 商品ページではないためスキップ');
      return;
    }

    // 価格計算モジュールを初期化
    await initPriceCalculator();

    // 少し遅延して実行（初期ロード完了フラグを立ててから）
    setTimeout(() => {
      initialLoadDone = true;
      addResearchButton();
    }, 5000);

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      if (initialLoadDone && isProductPage() && !document.querySelector('.kuraberu-btn')) {
        addResearchButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // URL変更監視（SPA対応）
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      buttonGaveUp = false;  // URL変更時にリセット
      initialLoadDone = false;  // 初期ロード完了フラグもリセット
      console.log('[しらべる君] URL変更検知:', lastUrl);
      if (isProductPage() && !document.querySelector('.kuraberu-btn')) {
        setTimeout(addResearchButton, 5000);
      }
    }
  }, 1000);
})();
