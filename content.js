/**
 * しらべる君 - Content Script
 * メルカリ商品ページにeBay調査ボタンを追加
 */
(function() {
  'use strict';

  console.log('[しらべる君] Content Script 読み込み開始');
  console.log('[しらべる君] 現在のURL:', window.location.href);

  // 表示中のパネル
  let currentPanel = null;

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
  function showResearchPanel(originalTitle, originalDescription, buttonElement) {
    console.log('[しらべる君] パネル表示 - 元タイトル:', originalTitle);
    console.log('[しらべる君] パネル表示 - 元説明:', originalDescription?.substring(0, 100));

    // 既存のパネルを閉じる
    closePanel();

    // パネルを作成
    const panel = document.createElement('div');
    panel.className = 'kuraberu-panel';

    panel.innerHTML = `
      <div class="kuraberu-panel-header">
        <span class="kuraberu-panel-title">🔍 eBay市場調査</span>
        <button class="kuraberu-panel-close">✕</button>
      </div>
      <div class="kuraberu-panel-body">
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
  function init() {
    console.log('[しらべる君] 初期化開始');

    // ページリロード時に古いUI要素をクリーンアップ
    document.querySelectorAll('.kuraberu-btn, .kuraberu-panel').forEach(el => el.remove());
    currentPanel = null;

    if (!isProductPage()) {
      console.log('[しらべる君] 商品ページではないためスキップ');
      return;
    }

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
