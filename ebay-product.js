/**
 * しらべる君 - eBay商品ページ用スクリプト
 * eBay商品詳細ページにリサーチボタンと価格計算機能を追加
 */
(function() {
  'use strict';

  console.log('[しらべる君 eBay商品] スクリプト読み込み');

  let currentPanel = null;
  let priceCalculator = null;

  /**
   * 価格計算機を初期化
   */
  async function initPriceCalculator() {
    if (typeof PriceCalculator !== 'undefined') {
      priceCalculator = new PriceCalculator();
      await priceCalculator.loadSettings();
      console.log('[しらべる君 eBay商品] 価格計算機初期化完了');
    } else {
      console.log('[しらべる君 eBay商品] PriceCalculatorが見つかりません');
    }
  }

  /**
   * eBay商品詳細ページかどうかを判定
   */
  function isProductPage() {
    const url = window.location.href;
    return url.includes('ebay.com/itm/');
  }

  /**
   * 商品タイトルを取得
   */
  function getProductTitle() {
    const selectors = [
      'h1.x-item-title__mainTitle span',
      'h1[data-testid="x-item-title"]',
      'h1.it-ttl',
      '#itemTitle',
      'h1'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        const cleaned = text.replace(/^Details about\s*/i, '').trim();
        if (cleaned && cleaned.length > 5) {
          console.log('[しらべる君 eBay商品] タイトル取得:', cleaned.substring(0, 50));
          return cleaned;
        }
      }
    }

    console.log('[しらべる君 eBay商品] タイトル取得失敗');
    return '';
  }

  /**
   * 商品価格を取得（USD）
   */
  function getProductPrice() {
    // 価格セレクタ（優先順位順）
    const selectors = [
      // 新しいeBayデザイン
      '.x-price-primary span[itemprop="price"]',
      '.x-price-primary .ux-textspans',
      'div[data-testid="x-price-primary"] span',
      // Buy It Nowの価格
      '.x-bin-price__content .x-price-primary span',
      '#prcIsum',
      '#mm-saleDscPrc',
      // 従来のデザイン
      '.notranslate[itemprop="price"]',
      '#prcIsum_bidPrice',
      '.vi-price'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        let text = el.textContent?.trim() || '';
        // data-value属性があれば優先
        if (el.getAttribute('content')) {
          const price = parseFloat(el.getAttribute('content'));
          if (!isNaN(price) && price > 0) {
            console.log('[しらべる君 eBay商品] 価格取得(content):', price);
            return price;
          }
        }
        // テキストから価格を抽出
        const priceMatch = text.match(/\$?\s*([\d,]+\.?\d*)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(price) && price > 0) {
            console.log('[しらべる君 eBay商品] 価格取得:', price, 'from:', text);
            return price;
          }
        }
      }
    }

    // meta tagからの取得を試みる
    const metaPrice = document.querySelector('meta[itemprop="price"]');
    if (metaPrice) {
      const price = parseFloat(metaPrice.getAttribute('content'));
      if (!isNaN(price) && price > 0) {
        console.log('[しらべる君 eBay商品] 価格取得(meta):', price);
        return price;
      }
    }

    console.log('[しらべる君 eBay商品] 価格取得失敗');
    return null;
  }

  /**
   * リサーチボタンを追加
   */
  function addResearchButton() {
    if (document.querySelector('.kuraberu-ebay-btn')) {
      return;
    }

    const title = getProductTitle();
    if (!title) {
      console.log('[しらべる君 eBay商品] タイトルが見つかりません。2秒後に再試行...');
      setTimeout(addResearchButton, 2000);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'kuraberu-ebay-btn';
    btn.innerHTML = '🔍 市場調査';
    btn.title = 'この商品の市場調査を行います（ドラッグで移動可能）';

    btn.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 9999;
      padding: 12px 20px;
      background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: move;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(btn);

    const dragState = makeDraggable(btn, btn);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragState.hasMoved()) return;
      showResearchPanel(title, btn);
    });

    console.log('[しらべる君 eBay商品] ボタン追加完了');
  }

  /**
   * 仕入れ上限計算セクションのHTMLを生成
   */
  function generatePriceCalcSection(priceUSD) {
    if (!priceCalculator || !priceUSD) {
      return `
        <div style="background: #fff3e0; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-size: 12px; color: #e65100; font-weight: 600; margin-bottom: 8px;">💰 仕入れ上限計算</div>
          <div style="font-size: 12px; color: #666;">価格情報を取得できませんでした</div>
        </div>
      `;
    }

    // eBay表示価格はDDU（税抜）として計算
    const result = priceCalculator.calculateMaxPurchasePrice(priceUSD, false);

    return `
      <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #ffc107;">
        <div style="font-size: 12px; color: #ff6f00; font-weight: 600; margin-bottom: 10px;">💰 仕入れ上限計算</div>

        <!-- メイン結果 -->
        <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: #666;">eBay価格 (DDU)</span>
            <span style="font-size: 14px; font-weight: 600; color: #333;">$${priceUSD.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 2px dashed #ffc107;">
            <span style="font-size: 12px; color: #ff6f00; font-weight: 600;">仕入れ上限（利益${result.targetProfitRate}%）</span>
            <span style="font-size: 18px; font-weight: 700; color: #e65100;">¥${result.maxCostJPY.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: #888;">損益分岐点</span>
            <span style="font-size: 12px; color: #666;">¥${result.breakEvenCostJPY.toLocaleString()}</span>
          </div>
        </div>

        <!-- 詳細（折りたたみ） -->
        <details style="font-size: 11px;">
          <summary style="cursor: pointer; color: #666; margin-bottom: 6px;">📊 詳細を見る</summary>
          <div style="background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <span style="color: #333;">売上 (円換算)</span>
              <span style="text-align: right; color: #333;">¥${result.ddpPriceJPY.toLocaleString()}</span>

              <span style="color: #333;">eBay手数料（${priceCalculator.settings.feeRate}%）</span>
              <span style="text-align: right; color: #c62828;">-¥${result.ebayFeeJPY.toLocaleString()}</span>

              <span style="color: #333;">広告費（${priceCalculator.settings.adRate}%）</span>
              <span style="text-align: right; color: #c62828;">-¥${result.adFeeJPY.toLocaleString()}</span>

              <span style="color: #333;">Payoneer手数料（${priceCalculator.settings.payoneerRate}%）</span>
              <span style="text-align: right; color: #c62828;">-¥${result.payoneerFeeJPY.toLocaleString()}</span>

              <span style="color: #333;">関税（${priceCalculator.settings.tariffRate}%）</span>
              <span style="text-align: right; color: #c62828;">-¥${result.tariffJPY.toLocaleString()}</span>

              <span style="color: #333;">送料（${result.shippingMethodName}）</span>
              <span style="text-align: right; color: #c62828;">-¥${result.shippingCostJPY.toLocaleString()}</span>

              <span style="color: #333; border-top: 1px solid #ddd; padding-top: 4px;">目標利益（${result.targetProfitRate}%）</span>
              <span style="text-align: right; color: #2e7d32; border-top: 1px solid #ddd; padding-top: 4px;">¥${result.targetProfitJPY.toLocaleString()}</span>
            </div>
            <div style="margin-top: 6px; font-size: 10px; color: #555;">
              為替: $1 = ¥${result.exchangeRate}
            </div>
          </div>
        </details>
      </div>
    `;
  }

  /**
   * 調査パネルを表示
   */
  function showResearchPanel(title, buttonElement) {
    closePanel();

    const priceUSD = getProductPrice();
    const priceCalcHtml = generatePriceCalcSection(priceUSD);

    const panel = document.createElement('div');
    panel.className = 'kuraberu-ebay-panel';

    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 150px;
        right: 20px;
        width: 380px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 10000;
        overflow: hidden;
        max-height: 90vh;
        overflow-y: auto;
      ">
        <div style="
          background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
          color: white;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1;
        ">
          <span style="font-weight: 600;">🔍 商品リサーチ</span>
          <button class="kuraberu-panel-close" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
          ">✕</button>
        </div>
        <div style="padding: 16px;">
          <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; color: #666;">商品タイトル:</label>
            <div style="font-size: 13px; color: #333; margin-top: 4px; max-height: 60px; overflow: hidden;">${escapeHtml(title.substring(0, 100))}${title.length > 100 ? '...' : ''}</div>
          </div>

          <!-- 価格計算セクション -->
          ${priceCalcHtml}

          <!-- eBay検索セクション -->
          <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <div style="font-size: 12px; color: #0064d2; font-weight: 600; margin-bottom: 8px;">📦 eBay市場調査</div>
            <div style="margin-bottom: 8px;">
              <input type="text" class="kuraberu-keyword-input" value="${escapeHtml(extractKeywords(title))}" placeholder="英語キーワード" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 13px;
                box-sizing: border-box;
              ">
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="kuraberu-search-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">🔍 Sold</button>
              <button class="kuraberu-terapeak-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #f5af02 0%, #e09b00 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">📊 テラピーク</button>
            </div>
          </div>

          <!-- メルカリ検索セクション -->
          <div style="background: #fff5f5; padding: 12px; border-radius: 8px;">
            <div style="font-size: 12px; color: #ea352d; font-weight: 600; margin-bottom: 8px;">🇯🇵 メルカリで探す</div>
            <div style="margin-bottom: 8px;">
              <input type="text" class="kuraberu-mercari-keyword" placeholder="日本語キーワード（AI翻訳で生成）" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 13px;
                box-sizing: border-box;
              ">
            </div>
            <!-- 翻訳オプション -->
            <div style="margin-bottom: 8px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 6px;">翻訳に含める要素:</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;" class="kuraberu-mercari-options">
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ffcccb; border-radius: 4px; cursor: pointer; font-size: 10px;">
                  <input type="checkbox" value="brand" checked style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>ブランド</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ffcccb; border-radius: 4px; cursor: pointer; font-size: 10px;">
                  <input type="checkbox" value="category" checked style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>カテゴリ</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 10px; color: #333;">
                  <input type="checkbox" value="material" style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>素材</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 10px; color: #333;">
                  <input type="checkbox" value="model" style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>型番</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 10px; color: #333;">
                  <input type="checkbox" value="character" style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>キャラ名</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 10px; color: #333;">
                  <input type="checkbox" value="color" style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>色</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 10px; color: #333;">
                  <input type="checkbox" value="size" style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>サイズ</span>
                </label>
                <label style="display: flex; align-items: center; gap: 3px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 10px; color: #333;">
                  <input type="checkbox" value="rarity" style="width: 12px; height: 12px; accent-color: #ea352d;">
                  <span>レアリティ</span>
                </label>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="kuraberu-ai-translate-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">🤖 AI翻訳</button>
              <button class="kuraberu-mercari-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #ea352d 0%, #c52d26 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">🔍 メルカリ</button>
            </div>
          </div>

          <div class="kuraberu-message" style="
            margin-top: 12px;
            font-size: 12px;
            color: #666;
          "></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    currentPanel = panel;

    const panelInner = panel.querySelector('div');
    const panelHeader = panelInner.querySelector('div');

    makeDraggable(panelInner, panelHeader);

    // イベントリスナー
    panel.querySelector('.kuraberu-panel-close').addEventListener('click', closePanel);

    panel.querySelector('.kuraberu-search-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openSoldListingsSearch(keyword);
      }
    });

    panel.querySelector('.kuraberu-terapeak-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openTerapeakSearch(keyword);
      }
    });

    panel.querySelector('.kuraberu-keyword-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
        if (keyword) {
          openSoldListingsSearch(keyword);
        }
      }
    });

    function getMercariSelectedOptions() {
      const checkboxes = panel.querySelectorAll('.kuraberu-mercari-options input[type="checkbox"]:checked');
      return Array.from(checkboxes).map(cb => cb.value);
    }

    panel.querySelector('.kuraberu-ai-translate-btn').addEventListener('click', () => {
      const selectedOptions = getMercariSelectedOptions();
      if (selectedOptions.length === 0) {
        showMessage(panel, '⚠️ 少なくとも1つの要素を選択してください', 'warning');
        return;
      }
      generateMercariKeyword(title, panel, selectedOptions);
    });

    panel.querySelector('.kuraberu-mercari-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-mercari-keyword').value.trim();
      if (keyword) {
        openMercariSearch(keyword);
      } else {
        showMessage(panel, '⚠️ 先にAI翻訳でキーワードを生成してください', 'warning');
      }
    });

    panel.querySelector('.kuraberu-mercari-keyword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-mercari-keyword').value.trim();
        if (keyword) {
          openMercariSearch(keyword);
        }
      }
    });
  }

  /**
   * AIでメルカリ検索キーワードを生成
   */
  async function generateMercariKeyword(title, panel, options = ['brand', 'category']) {
    const messageEl = panel.querySelector('.kuraberu-message');
    const inputEl = panel.querySelector('.kuraberu-mercari-keyword');
    const aiBtn = panel.querySelector('.kuraberu-ai-translate-btn');

    aiBtn.disabled = true;
    aiBtn.textContent = '🔄 翻訳中...';
    messageEl.textContent = `🤖 AIが翻訳中...（${options.length}要素）`;
    messageEl.style.color = '#666';

    try {
      const checkResult = await chrome.runtime.sendMessage({ action: 'checkApiKey' });

      if (!checkResult.hasKey) {
        showMessage(panel, '⚠️ OpenAI APIキーが設定されていません', 'warning');
        return;
      }

      const result = await chrome.runtime.sendMessage({
        action: 'generateMercariKeyword',
        title: title,
        options: options
      });

      if (result.success) {
        inputEl.value = result.keyword;
        showMessage(panel, '✅ 日本語キーワード生成完了！', 'success');
      } else {
        showMessage(panel, `❌ エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[しらべる君 eBay商品] AI翻訳エラー:', error);
      showMessage(panel, `❌ エラー: ${error.message}`, 'error');
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = '🤖 AI翻訳';
    }
  }

  /**
   * メルカリ検索を開く
   */
  function openMercariSearch(keyword) {
    const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`;
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: url,
      active: true
    });
  }

  /**
   * メッセージを表示
   */
  function showMessage(panel, text, type) {
    const msgEl = panel.querySelector('.kuraberu-message');
    if (msgEl) {
      msgEl.textContent = text;
      if (type === 'success') {
        msgEl.style.color = '#2e7d32';
      } else if (type === 'error') {
        msgEl.style.color = '#c62828';
      } else if (type === 'warning') {
        msgEl.style.color = '#e65100';
      } else {
        msgEl.style.color = '#666';
      }
      setTimeout(() => {
        msgEl.textContent = '';
      }, 5000);
    }
  }

  /**
   * タイトルからキーワードを抽出
   */
  function extractKeywords(title) {
    let keywords = title
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = keywords.split(' ').slice(0, 5);
    return words.join(' ');
  }

  /**
   * Sold Listings検索を開く
   */
  function openSoldListingsSearch(keyword) {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Complete=1&LH_Sold=1&_sop=13&LH_BIN=1`;
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: url,
      active: true
    });
  }

  /**
   * テラピーク検索を開く
   */
  function openTerapeakSearch(keyword) {
    const url = `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${encodeURIComponent(keyword)}&dayRange=90&tabName=SOLD`;
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: url,
      active: true
    });
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
   * 要素をドラッグ可能にする
   */
  function makeDraggable(element, handle) {
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

      if (initialRight !== null) {
        const newRight = Math.max(0, Math.min(initialRight - dx, window.innerWidth - element.offsetWidth));
        const newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - element.offsetHeight));
        element.style.right = `${newRight}px`;
        element.style.top = `${newTop}px`;
        element.style.left = 'auto';
      } else {
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

    return { hasMoved: () => hasMoved };
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
    document.querySelectorAll('.kuraberu-ebay-btn, .kuraberu-ebay-panel').forEach(el => el.remove());
    currentPanel = null;

    if (!isProductPage()) {
      console.log('[しらべる君 eBay商品] 商品ページではありません');
      return;
    }

    console.log('[しらべる君 eBay商品] 商品ページを検出');

    // 価格計算機を初期化
    await initPriceCalculator();

    setTimeout(addResearchButton, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
