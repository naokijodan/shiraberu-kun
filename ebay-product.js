/**
 * しらべる君 - eBay商品ページ用スクリプト
 * eBay商品詳細ページにリサーチボタンと価格計算機能を追加
 */
(function() {
  'use strict';

  console.log('[しらべる君 eBay商品] スクリプト読み込み');

  let currentPanel = null;
  let priceCalculator = null;
  let isPremiumCached = null;

  // セラータイプ定義
  const SELLER_TYPES = {
    supplier: { label: '仕入れ先', color: '#4caf50', icon: '🛒' },
    rival: { label: 'ライバル', color: '#2196f3', icon: '🎯' },
    caution: { label: '要注意', color: '#f44336', icon: '⚠️' },
    other: { label: 'その他', color: '#9e9e9e', icon: '📌' }
  };

  /**
   * プレミアム状態をチェック
   */
  async function checkPremiumStatus() {
    try {
      const data = await chrome.storage.local.get(['shiraberu_secret_code']);
      const secretCode = data.shiraberu_secret_code;
      isPremiumCached = secretCode && ['MGOOSE2025'].includes(secretCode.trim().toUpperCase());
      console.log('[しらべる君 eBay商品] プレミアム状態:', isPremiumCached);
      return isPremiumCached;
    } catch (error) {
      console.error('[しらべる君 eBay商品] プレミアムチェックエラー:', error);
      return false;
    }
  }

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
   * eBayのセラー情報を取得
   */
  function getSellerInfo() {
    // ========================================
    // 1. セラー名テキストを直接探す（最も確実）
    //    「Tokiwa-iro (2808)」のような形式で表示されている
    // ========================================
    const sellerNameSelectors = [
      // セラーカード内のセラー名（BOLDスタイルのspan）
      '.x-sellercard-atf__info__about-seller span.ux-textspans--BOLD',
      '.x-sellercard-atf span.ux-textspans--BOLD',
      'div[data-testid="x-sellercard-atf"] span.ux-textspans--BOLD',
      // ux-seller-section内
      '.ux-seller-section__item--seller span.ux-textspans--BOLD',
      '[data-testid="ux-seller-section__item--seller"] span.ux-textspans--BOLD'
    ];

    let sellerName = '';
    let platformId = '';
    let url = '';

    // セラー名を探す
    for (const selector of sellerNameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        // 1文字以下はアバターの可能性が高いのでスキップ
        if (text && text.length > 1) {
          sellerName = text;
          console.log('[しらべる君 eBay商品] セラー名発見:', sellerName);
          break;
        }
      }
    }

    // ========================================
    // 2. ストアリンク（/str/）からplatformIdとURLを取得
    // ========================================
    const storeSelectors = [
      '.x-sellercard-atf a[href*="/str/"]',
      'div[data-testid="x-sellercard-atf"] a[href*="/str/"]',
      '.ux-seller-section a[href*="/str/"]'
    ];

    for (const selector of storeSelectors) {
      const storeLink = document.querySelector(selector);
      if (storeLink) {
        const href = storeLink.getAttribute('href') || '';
        const strMatch = href.match(/\/str\/([^\/\?]+)/);
        if (strMatch) {
          platformId = decodeURIComponent(strMatch[1]);
          url = `https://www.ebay.com/str/${encodeURIComponent(platformId)}`;
          console.log('[しらべる君 eBay商品] ストアURL発見:', { platformId, url });
          break;
        }
      }
    }

    // ========================================
    // 3. ストアリンクがない場合、セラーID（/usr/）を取得
    // ========================================
    if (!platformId) {
      const usrLinkSelectors = [
        '.x-sellercard-atf a[href*="/usr/"]',
        'div[data-testid="x-sellercard-atf"] a[href*="/usr/"]',
        '.ux-seller-section a[href*="/usr/"]'
      ];

      for (const selector of usrLinkSelectors) {
        const usrLink = document.querySelector(selector);
        if (usrLink) {
          const href = usrLink.getAttribute('href') || '';
          const match = href.match(/\/usr\/([^\/\?]+)/);
          if (match) {
            platformId = decodeURIComponent(match[1]);
            url = `https://www.ebay.com/str/${encodeURIComponent(platformId)}`;
            console.log('[しらべる君 eBay商品] ユーザーリンク発見:', { platformId, url });
            break;
          }
        }
      }
    }

    // ========================================
    // 4. セラー名が取得できなかった場合、platformIdを使用
    // ========================================
    if (!sellerName && platformId) {
      sellerName = platformId;
    }

    // 結果を返す
    if (sellerName && platformId) {
      console.log('[しらべる君 eBay商品] セラー情報取得成功:', { sellerName, platformId, url });
      return { name: sellerName, platformId, url, platform: 'ebay' };
    }

    console.log('[しらべる君 eBay商品] セラー情報取得失敗');
    return null;
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
   * Shipping（送料+関税）を自動取得（USD）
   * @returns {Object} { amount: number|null, rawText: string, isAuto: boolean }
   */
  function getShippingInfo() {
    // Shippingセレクタ（優先順位順）
    const selectors = [
      // 新しいデザイン - メイン送料
      '[data-testid="ux-labels-values-shipping"] .ux-textspans--BOLD',
      '.ux-labels-values--shipping .ux-textspans--BOLD',
      '.x-price-shipping .ux-textspans',
      // Import charges (関税・輸入税含む)
      '[data-testid="x-shipping-import-charges"] .ux-textspans--BOLD',
      // 従来のデザイン
      '#fshippingCost span',
      '#shSummary .sh-txt'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (!text) continue;

        console.log('[しらべる君 eBay商品] Shipping要素発見:', selector, text);

        // Free shippingの判定
        if (text.toLowerCase().includes('free') || text.includes('無料')) {
          return { amount: 0, rawText: text, isAuto: true };
        }

        // 金額を抽出（$XX.XX形式）
        const priceMatch = text.match(/\$\s*([\d,]+\.?\d*)/);
        if (priceMatch) {
          const amount = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(amount)) {
            console.log('[しらべる君 eBay商品] Shipping金額取得:', amount);
            return { amount: amount, rawText: text, isAuto: true };
          }
        }
      }
    }

    console.log('[しらべる君 eBay商品] Shipping自動取得失敗');
    return { amount: null, rawText: '', isAuto: false };
  }

  /**
   * リサーチボタンを追加
   */
  function addResearchButton(isRetry = false) {
    if (document.querySelector('.kuraberu-ebay-btn')) {
      return;
    }

    const title = getProductTitle();
    if (!title) {
      if (!isRetry) {
        console.log('[しらべる君 eBay商品] タイトルが見つかりません。2秒後にリトライ...');
        setTimeout(() => addResearchButton(true), 2000);
      } else {
        console.log('[しらべる君 eBay商品] リトライでもタイトル取得失敗。処理終了');
      }
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
   * プレミアム機能の案内HTMLを生成
   */
  function generatePremiumPromptSection() {
    return `
      <div style="background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); padding: 16px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #bdbdbd;">
        <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; text-align: center;">🔒 仕入れ上限計算（プレミアム機能）</div>
        <div style="font-size: 12px; color: #666; margin-bottom: 16px; text-align: center; line-height: 1.6;">
          価格計算機能はプレミアム会員限定です。<br>
          スクール会員の方はシークレットコードを入力してください。
        </div>
        <div style="background: white; border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 11px;">
          <div style="margin-bottom: 6px;">🎫 スクール会員：シークレットコードを入力</div>
          <div>💳 一般：1,000円で全機能を永久解放</div>
        </div>
        <button class="kuraberu-ebay-premium-settings-btn" style="
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
    `;
  }

  /**
   * 仕入れ上限計算セクションのHTMLを生成
   */
  function generatePriceCalcSection(priceUSD, shippingInfo, isPremium) {
    // プレミアムでない場合は案内を表示
    if (!isPremium) {
      return generatePremiumPromptSection();
    }

    if (!priceCalculator || !priceUSD) {
      return `
        <div style="background: #fff3e0; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-size: 12px; color: #e65100; font-weight: 600; margin-bottom: 8px;">💰 仕入れ上限計算</div>
          <div style="font-size: 12px; color: #666;">価格情報を取得できませんでした</div>
        </div>
      `;
    }

    // Shippingの初期値
    const shippingAmount = shippingInfo.amount !== null ? shippingInfo.amount : 0;
    const shippingAutoText = shippingInfo.isAuto ? '（自動取得）' : '（手入力）';

    // DDP価格を計算
    const ddpPriceUSD = priceUSD + shippingAmount;

    // DDP価格として計算（Shipping=関税として扱う）
    const result = priceCalculator.calculateMaxPurchasePrice(ddpPriceUSD, true);

    return `
      <div class="kuraberu-price-calc-section" style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #ffc107;">
        <div style="font-size: 12px; color: #ff6f00; font-weight: 600; margin-bottom: 10px;">💰 仕入れ上限計算</div>

        <!-- 価格入力エリア -->
        <div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: #666;">eBay表示価格</span>
            <span style="font-size: 14px; font-weight: 600; color: #333;">$${priceUSD.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: #666;">
              Shipping（税込）
              <span style="font-size: 9px; color: ${shippingInfo.isAuto ? '#4caf50' : '#999'};">${shippingAutoText}</span>
            </span>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 12px; color: #333;">$</span>
              <input type="number" class="kuraberu-shipping-input" value="${shippingAmount.toFixed(2)}" step="0.01" min="0" style="
                width: 70px;
                padding: 4px 6px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                text-align: right;
              ">
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #e0e0e0;">
            <span style="font-size: 12px; color: #333; font-weight: 600;">DDP価格（税込合計）</span>
            <span class="kuraberu-ddp-price" style="font-size: 14px; font-weight: 700; color: #0064d2;">$${ddpPriceUSD.toFixed(2)}</span>
          </div>
        </div>

        <!-- 計算結果 -->
        <div class="kuraberu-calc-result" style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: #ff6f00; font-weight: 600;">仕入れ上限（利益${result.targetProfitRate}%）</span>
            <span class="kuraberu-max-cost" style="font-size: 18px; font-weight: 700; color: #e65100;">¥${result.maxCostJPY.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: #888;">損益分岐点</span>
            <span class="kuraberu-breakeven" style="font-size: 12px; color: #666;">¥${result.breakEvenCostJPY.toLocaleString()}</span>
          </div>
        </div>

        <!-- 詳細（折りたたみ） -->
        <details style="font-size: 11px;">
          <summary style="cursor: pointer; color: #666; margin-bottom: 6px;">📊 詳細を見る</summary>
          <div class="kuraberu-calc-details" style="background: #f5f5f5; padding: 8px; border-radius: 6px; margin-top: 6px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <span style="color: #333; font-weight: bold;">DDP価格</span>
              <span class="detail-ddp-usd" style="text-align: right; color: #333; font-weight: bold;">$${result.ddpPriceUSD.toFixed(2)}</span>

              <span style="color: #333;">├ DDU価格</span>
              <span class="detail-ddu-usd" style="text-align: right; color: #333;">$${result.dduPriceUSD.toFixed(2)} (¥${result.dduPriceJPY.toLocaleString()})</span>

              <span style="color: #333;">└ 調整関税額</span>
              <span class="detail-adj-tariff" style="text-align: right; color: #c62828;">+$${result.adjustedTariffUSD.toFixed(2)}</span>

              <span style="color: #333; border-top: 1px solid #ddd; padding-top: 4px; margin-top: 4px;">eBay手数料（${priceCalculator.settings.feeRate}%）</span>
              <span class="detail-ebay-fee" style="text-align: right; color: #c62828; border-top: 1px solid #ddd; padding-top: 4px; margin-top: 4px;">-¥${result.ebayFeeJPY.toLocaleString()}</span>

              <span style="color: #333;">広告費（${priceCalculator.settings.adRate}%）</span>
              <span class="detail-ad-fee" style="text-align: right; color: #c62828;">-¥${result.adFeeJPY.toLocaleString()}</span>

              <span style="color: #333;">Payoneer（${priceCalculator.settings.payoneerRate}%）</span>
              <span class="detail-payoneer" style="text-align: right; color: #c62828;">-¥${result.payoneerFeeJPY.toLocaleString()}</span>

              <span style="color: #333;">送料（${result.shippingMethodName}）</span>
              <span class="detail-shipping" style="text-align: right; color: #c62828;">-¥${result.shippingCostJPY.toLocaleString()}</span>

              <span style="color: #333; border-top: 1px solid #ddd; padding-top: 4px;">目標利益（${result.targetProfitRate}%）</span>
              <span class="detail-profit" style="text-align: right; color: #2e7d32; border-top: 1px solid #ddd; padding-top: 4px;">¥${result.targetProfitJPY.toLocaleString()}</span>
            </div>
            <div style="margin-top: 6px; font-size: 10px; color: #555;">
              為替: $1 = ¥${result.exchangeRate} / 実際の関税: $${result.tariffUSD.toFixed(2)} (¥${result.tariffJPY.toLocaleString()})
            </div>
          </div>
        </details>
      </div>
    `;
  }

  /**
   * 調査パネルを表示
   */
  async function showResearchPanel(title, buttonElement) {
    closePanel();

    // プレミアム状態をチェック
    const isPremium = await checkPremiumStatus();

    const priceUSD = getProductPrice();
    const shippingInfo = getShippingInfo();
    const priceCalcHtml = generatePriceCalcSection(priceUSD, shippingInfo, isPremium);

    const panel = document.createElement('div');
    panel.className = 'kuraberu-ebay-panel';

    panel.innerHTML = `
      <div class="kuraberu-ebay-panel-inner" style="
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
        max-height: 80vh;
        display: flex;
        flex-direction: column;
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
        <div style="padding: 16px; overflow-y: auto; flex: 1; overscroll-behavior: contain;">
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

          <!-- セラー保存セクション（プレミアム機能） -->
          <div class="kuraberu-seller-section" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="font-size: 12px; color: #0064d2; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              ⭐ セラーを保存
              <span class="kuraberu-seller-saved-badge" style="display: none; background: #4caf50; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;">保存済み</span>
            </div>
            <div class="kuraberu-seller-info" style="margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 6px; width: 100%;">
                <span style="font-size: 16px; flex-shrink: 0;">🇺🇸</span>
                <input type="text" class="kuraberu-seller-name-input" placeholder="セラー名" style="flex: 1; min-width: 0; padding: 8px 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 13px; font-weight: 600; box-sizing: border-box;">
              </div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 4px;">カテゴリ:</div>
              <div class="kuraberu-category-list" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
              <div style="margin-top: 6px; display: flex; gap: 4px;">
                <input type="text" class="kuraberu-new-category-input" placeholder="新規カテゴリ名" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
                <button class="kuraberu-add-category-btn" style="padding: 6px 10px; background: #0064d2; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;">+</button>
              </div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 4px;">タイプ:</div>
              <div class="kuraberu-type-list" style="display: flex; flex-wrap: wrap; gap: 4px;">
                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 10px; padding: 4px 6px; background: #e8f5e9; border-radius: 4px; border: 1px solid #4caf50;">
                  <input type="radio" name="seller-type" value="supplier" checked style="margin: 0; width: 12px; height: 12px;">
                  🛒 仕入れ先
                </label>
                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 10px; padding: 4px 6px; background: #e3f2fd; border-radius: 4px; border: 1px solid #2196f3;">
                  <input type="radio" name="seller-type" value="rival" style="margin: 0; width: 12px; height: 12px;">
                  🎯 ライバル
                </label>
                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 10px; padding: 4px 6px; background: #ffebee; border-radius: 4px; border: 1px solid #f44336;">
                  <input type="radio" name="seller-type" value="caution" style="margin: 0; width: 12px; height: 12px;">
                  ⚠️ 要注意
                </label>
                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 10px; padding: 4px 6px; background: #fafafa; border-radius: 4px; border: 1px solid #9e9e9e;">
                  <input type="radio" name="seller-type" value="other" style="margin: 0; width: 12px; height: 12px;">
                  📌 その他
                </label>
              </div>
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 4px;">メモ:</div>
              <input type="text" class="kuraberu-seller-memo" placeholder="メモ（任意）" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="kuraberu-save-seller-btn" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">⭐ 保存</button>
              <button class="kuraberu-view-sellers-btn" style="padding: 8px 12px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; cursor: pointer;">📋 一覧</button>
            </div>
            <div class="kuraberu-seller-message" style="margin-top: 8px; font-size: 11px;"></div>
          </div>

          <!-- プレミアム機能案内（セラー保存） -->
          <div class="kuraberu-seller-premium-prompt" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); padding: 10px; border-radius: 8px; border: 1px solid #bdbdbd;">
              <div style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 6px;">🔒 セラー保存（プレミアム機能）</div>
              <div style="font-size: 10px; color: #666; line-height: 1.5;">
                気になるセラーを保存して、カテゴリ別に管理できます。
              </div>
            </div>
          </div>
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

    // プレミアム案内の設定ボタン（存在する場合のみ）
    const premiumSettingsBtn = panel.querySelector('.kuraberu-ebay-premium-settings-btn');
    if (premiumSettingsBtn) {
      premiumSettingsBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
      });
    }

    // Shipping入力欄の変更時に再計算
    const shippingInput = panel.querySelector('.kuraberu-shipping-input');
    if (shippingInput && priceCalculator && priceUSD) {
      shippingInput.addEventListener('input', () => {
        const shippingAmount = parseFloat(shippingInput.value) || 0;
        const ddpPriceUSD = priceUSD + shippingAmount;

        // DDP価格として再計算
        const result = priceCalculator.calculateMaxPurchasePrice(ddpPriceUSD, true);

        // UI更新
        const ddpPriceEl = panel.querySelector('.kuraberu-ddp-price');
        const maxCostEl = panel.querySelector('.kuraberu-max-cost');
        const breakevenEl = panel.querySelector('.kuraberu-breakeven');

        if (ddpPriceEl) ddpPriceEl.textContent = `$${ddpPriceUSD.toFixed(2)}`;
        if (maxCostEl) maxCostEl.textContent = `¥${result.maxCostJPY.toLocaleString()}`;
        if (breakevenEl) breakevenEl.textContent = `¥${result.breakEvenCostJPY.toLocaleString()}`;

        // 詳細も更新
        const detailDdpJpy = panel.querySelector('.detail-ddp-jpy');
        const detailEbayFee = panel.querySelector('.detail-ebay-fee');
        const detailAdFee = panel.querySelector('.detail-ad-fee');
        const detailPayoneer = panel.querySelector('.detail-payoneer');
        const detailTariff = panel.querySelector('.detail-tariff');
        const detailShipping = panel.querySelector('.detail-shipping');
        const detailProfit = panel.querySelector('.detail-profit');

        if (detailDdpJpy) detailDdpJpy.textContent = `¥${result.ddpPriceJPY.toLocaleString()}`;
        if (detailEbayFee) detailEbayFee.textContent = `-¥${result.ebayFeeJPY.toLocaleString()}`;
        if (detailAdFee) detailAdFee.textContent = `-¥${result.adFeeJPY.toLocaleString()}`;
        if (detailPayoneer) detailPayoneer.textContent = `-¥${result.payoneerFeeJPY.toLocaleString()}`;
        if (detailTariff) detailTariff.textContent = `-¥${result.tariffJPY.toLocaleString()}`;
        if (detailShipping) detailShipping.textContent = `-¥${result.shippingCostJPY.toLocaleString()}`;
        if (detailProfit) detailProfit.textContent = `¥${result.targetProfitJPY.toLocaleString()}`;
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
      initSellerSectionEbay(panel, sellerInfo);
    } else if (!isPremium && sellerInfo) {
      // 非プレミアムの場合はプレミアム案内を表示
      sellerSection.style.display = 'none';
      sellerPremiumPrompt.style.display = 'block';
    }
  }

  /**
   * セラー保存セクションを初期化（eBay）
   */
  async function initSellerSectionEbay(panel, sellerInfo) {
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
    await loadCategoriesEbay(panel, existingSeller);

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
        await loadCategoriesEbay(panel, existingSeller, result.id);
        showSellerMessageEbay(panel, '✅ カテゴリを追加しました', 'success');
      } else {
        showSellerMessageEbay(panel, `❌ ${result.error}`, 'error');
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
        showSellerMessageEbay(panel, '⚠️ カテゴリを選択してください', 'warning');
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
        showSellerMessageEbay(panel, '✅ セラーを保存しました', 'success');
      } else {
        showSellerMessageEbay(panel, `❌ ${result.error}`, 'error');
      }
    });

    // セラー一覧ボタン
    panel.querySelector('.kuraberu-view-sellers-btn').addEventListener('click', () => {
      const selectedCategory = panel.querySelector('.kuraberu-category-checkbox:checked');
      if (selectedCategory) {
        chrome.storage.local.set({ shiraberu_view_category_id: selectedCategory.value });
      }
      showSellerMessageEbay(panel, 'ツールバーのしらべる君アイコンをクリックして「セラー管理」タブを開いてください', 'info');
    });
  }

  /**
   * カテゴリ一覧を読み込んで表示（eBay）
   */
  async function loadCategoriesEbay(panel, existingSeller = null, selectNewId = null) {
    const categoryListEl = panel.querySelector('.kuraberu-category-list');

    const result = await chrome.runtime.sendMessage({ action: 'seller_getCategories' });
    if (!result.success) {
      categoryListEl.innerHTML = '<span style="color: #999; font-size: 10px;">カテゴリを読み込めませんでした</span>';
      return;
    }

    const categories = result.categories || [];

    const lastCatResult = await chrome.runtime.sendMessage({ action: 'seller_getLastCategory' });
    const lastCategoryId = lastCatResult.success ? lastCatResult.categoryId : null;

    if (categories.length === 0) {
      categoryListEl.innerHTML = '<span style="color: #999; font-size: 10px;">カテゴリがありません。新規作成してください</span>';
      return;
    }

    categoryListEl.innerHTML = categories.map(cat => {
      const isExisting = existingSeller?.categoryIds?.includes(cat.id);
      const isNewlyAdded = cat.id === selectNewId;
      const isLastUsed = cat.id === lastCategoryId && !existingSeller;
      const checked = isExisting || isNewlyAdded || isLastUsed ? 'checked' : '';

      return `
        <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 10px; padding: 4px 6px; background: #fff; border: 1px solid #ddd; border-radius: 4px;">
          <input type="checkbox" class="kuraberu-category-checkbox" value="${cat.id}" ${checked} style="margin: 0; width: 12px; height: 12px;">
          ${escapeHtml(cat.name)}
        </label>
      `;
    }).join('');
  }

  /**
   * セラーセクションのメッセージを表示（eBay）
   */
  function showSellerMessageEbay(panel, text, type) {
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

    setTimeout(addResearchButton, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
