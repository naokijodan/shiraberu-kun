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
   * 価格計算セクションのHTMLを生成
   */
  function generatePriceCalcSection(priceJPY) {
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
  function addResearchButton() {
    console.log('[しらべる君] ボタン追加処理開始');

    // 既にボタンがあれば何もしない
    if (document.querySelector('.kuraberu-btn')) {
      return;
    }

    // 商品タイトルを取得
    const title = getProductTitle();
    if (!title) {
      console.log('[しらべる君] タイトルが見つかりません。2秒後に再試行...');
      setTimeout(addResearchButton, 2000);
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

    // PriceCalculatorが初期化されていなければ初期化
    if (!priceCalculator) {
      console.log('[しらべる君] PriceCalculator を遅延初期化');
      await initPriceCalculator();
    }

    // 価格を取得
    const price = getProductPrice();
    console.log('[しらべる君] 取得した価格:', price, 'Calculator:', !!priceCalculator);
    const priceCalcHtml = generatePriceCalcSection(price);

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

    // 少し遅延して実行
    setTimeout(addResearchButton, 1500);

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      if (isProductPage() && !document.querySelector('.kuraberu-btn')) {
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
      console.log('[しらべる君] URL変更検知:', lastUrl);
      if (isProductPage() && !document.querySelector('.kuraberu-btn')) {
        setTimeout(addResearchButton, 1500);
      }
    }
  }, 1000);
})();
