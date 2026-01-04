/**
 * くらべる君 - eBay Sold Listings 分析スクリプト
 * eBayの販売済みページから価格データを収集・分析
 * テキスト選択で再リサーチ機能付き
 */
(function() {
  'use strict';

  console.log('[くらべる君 eBay] 分析スクリプト読み込み');

  // 累積データ
  let collectedPrices = [];
  let currentPanel = null;
  let selectionPopup = null;

  /**
   * eBay Sold Listingsページかどうかを判定
   */
  function isSoldListingsPage() {
    const url = window.location.href;
    return url.includes('ebay.com/sch/') &&
           (url.includes('LH_Sold=1') || url.includes('LH_Complete=1'));
  }

  /**
   * ページから価格データを抽出
   */
  function extractPrices() {
    const prices = [];

    // eBayのアイテムコンテナを取得（最初のプレースホルダーをスキップ）
    const items = document.querySelectorAll('.s-item');

    items.forEach((item, index) => {
      // 最初のアイテムはプレースホルダーの場合があるのでスキップ
      if (index === 0 && !item.querySelector('.s-item__link')) {
        return;
      }

      // 価格要素を探す（複数のセレクタを試す）
      const priceEl = item.querySelector('.s-item__price span.POSITIVE') ||
                      item.querySelector('.s-item__price span.BOLD') ||
                      item.querySelector('.s-item__price span') ||
                      item.querySelector('.s-item__price');

      if (priceEl) {
        const priceText = priceEl.textContent.trim();
        console.log('[くらべる君 eBay] 価格テキスト:', priceText);
        const price = parsePriceText(priceText);
        // 妥当な価格範囲（$0.01〜$100,000）
        if (price > 0 && price < 100000) {
          prices.push(price);
        }
      }
    });

    // フォールバック: spanタグ内の価格を直接探す
    if (prices.length === 0) {
      const priceSpans = document.querySelectorAll('.s-item__price span');
      priceSpans.forEach(el => {
        const priceText = el.textContent.trim();
        // $で始まる価格のみ
        if (priceText.startsWith('$')) {
          const price = parsePriceText(priceText);
          if (price > 0 && price < 100000) {
            prices.push(price);
          }
        }
      });
    }

    // 最終フォールバック: ページ全体から$価格パターンを探す
    if (prices.length === 0) {
      const allText = document.body.innerText;
      const priceMatches = allText.match(/\$[\d,]+\.\d{2}/g);
      if (priceMatches) {
        priceMatches.forEach(match => {
          const price = parsePriceText(match);
          if (price > 0 && price < 100000) {
            prices.push(price);
          }
        });
      }
    }

    console.log('[くらべる君 eBay] 抽出した価格:', prices.length, '件');
    return prices;
  }

  /**
   * 価格テキストをパース（USD）
   */
  function parsePriceText(text) {
    // "to" や "〜" を含む範囲価格は除外または平均化
    if (text.includes(' to ') || text.includes('〜')) {
      const parts = text.split(/\s+to\s+|〜/);
      if (parts.length === 2) {
        const low = extractNumber(parts[0]);
        const high = extractNumber(parts[1]);
        if (low > 0 && high > 0) {
          return (low + high) / 2;
        }
      }
      return 0;
    }

    return extractNumber(text);
  }

  /**
   * テキストから数値を抽出
   */
  function extractNumber(text) {
    // $, USD, カンマを除去して数値を抽出
    const match = text.replace(/[,$USD\s]/g, '').match(/[\d.]+/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  /**
   * 統計を計算
   */
  function calculateStats(prices) {
    if (prices.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, median: 0 };
    }

    const sorted = [...prices].sort((a, b) => a - b);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / prices.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      count: prices.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: avg,
      median: median
    };
  }

  /**
   * 分析パネルを表示
   */
  function showAnalysisPanel() {
    // 既存のパネルを削除
    if (currentPanel) {
      currentPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'kuraberu-ebay-panel';
    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 10000;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
          color: white;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="font-weight: 600;">📊 くらべる君 - 価格分析</span>
          <button id="kuraberu-close" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
          ">✕</button>
        </div>
        <div style="padding: 16px;">
          <div id="kuraberu-stats" style="margin-bottom: 16px;">
            <div style="color: #666; font-size: 13px; margin-bottom: 8px;">読み込み中...</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="kuraberu-refresh" style="
              flex: 1;
              padding: 10px;
              background: #f0f0f0;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
            ">🔄 再読込</button>
            <button id="kuraberu-add-page" style="
              flex: 1;
              padding: 10px;
              background: linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
            ">➕ 次ページ追加</button>
          </div>
          <div id="kuraberu-message" style="
            margin-top: 12px;
            font-size: 12px;
            color: #666;
          "></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    currentPanel = panel;

    // イベントリスナー
    document.getElementById('kuraberu-close').addEventListener('click', () => {
      panel.remove();
      currentPanel = null;
    });

    document.getElementById('kuraberu-refresh').addEventListener('click', () => {
      collectedPrices = [];
      analyzePage();
    });

    document.getElementById('kuraberu-add-page').addEventListener('click', () => {
      analyzePage(true); // 累積モード
    });

    // 初回分析
    analyzePage();
  }

  /**
   * ページを分析
   */
  function analyzePage(accumulate = false) {
    const newPrices = extractPrices();

    if (accumulate) {
      // 累積モード：既存データに追加
      collectedPrices = [...collectedPrices, ...newPrices];
      showMessage(`➕ ${newPrices.length}件を追加しました`);
    } else {
      // リセットモード
      collectedPrices = newPrices;
    }

    updateStatsDisplay();
  }

  /**
   * 統計表示を更新
   */
  function updateStatsDisplay() {
    const stats = calculateStats(collectedPrices);
    const statsEl = document.getElementById('kuraberu-stats');

    if (stats.count === 0) {
      statsEl.innerHTML = `
        <div style="color: #e65100; font-size: 13px;">
          ⚠️ 価格データが見つかりません
        </div>
      `;
      return;
    }

    statsEl.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">件数</div>
          <div style="font-size: 20px; font-weight: 600; color: #333;">${stats.count}</div>
        </div>
        <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">平均</div>
          <div style="font-size: 20px; font-weight: 600; color: #0064d2;">$${stats.avg.toFixed(2)}</div>
        </div>
        <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">最安値</div>
          <div style="font-size: 18px; font-weight: 600; color: #2e7d32;">$${stats.min.toFixed(2)}</div>
        </div>
        <div style="background: #ffebee; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">最高値</div>
          <div style="font-size: 18px; font-weight: 600; color: #c62828;">$${stats.max.toFixed(2)}</div>
        </div>
      </div>
      <div style="margin-top: 12px; background: #fff3e0; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">中央値</div>
        <div style="font-size: 18px; font-weight: 600; color: #e65100;">$${stats.median.toFixed(2)}</div>
      </div>
    `;
  }

  /**
   * メッセージを表示
   */
  function showMessage(text) {
    const msgEl = document.getElementById('kuraberu-message');
    if (msgEl) {
      msgEl.textContent = text;
      setTimeout(() => {
        msgEl.textContent = '';
      }, 3000);
    }
  }

  /**
   * テキスト選択時のポップアップを表示
   */
  function showSelectionPopup(selectedText, x, y) {
    hideSelectionPopup();

    const popup = document.createElement('div');
    popup.id = 'kuraberu-selection-popup';
    popup.innerHTML = `
      <div style="
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        padding: 8px;
        z-index: 10001;
        display: flex;
        gap: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <button class="kuraberu-sel-sold" style="
          padding: 8px 12px;
          background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        ">🔍 Sold</button>
        <button class="kuraberu-sel-terapeak" style="
          padding: 8px 12px;
          background: linear-gradient(135deg, #f5af02 0%, #e09b00 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        ">📊 テラピーク</button>
      </div>
    `;

    document.body.appendChild(popup);
    selectionPopup = popup;

    // ボタンイベント
    popup.querySelector('.kuraberu-sel-sold').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSoldListingsSearch(selectedText);
      hideSelectionPopup();
    });

    popup.querySelector('.kuraberu-sel-terapeak').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTerapeakSearch(selectedText);
      hideSelectionPopup();
    });
  }

  /**
   * 選択ポップアップを非表示
   */
  function hideSelectionPopup() {
    if (selectionPopup) {
      selectionPopup.remove();
      selectionPopup = null;
    }
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
   * テキスト選択を監視
   */
  function setupSelectionListener() {
    document.addEventListener('mouseup', (e) => {
      // 少し遅延して選択テキストを取得
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // 3文字以上の選択があればポップアップ表示
        if (selectedText.length >= 3) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // 選択範囲の右上に表示
          const x = Math.min(rect.right + 10, window.innerWidth - 250);
          const y = rect.top + window.scrollY - 10;

          showSelectionPopup(selectedText, x, y);
        } else {
          hideSelectionPopup();
        }
      }, 10);
    });

    // クリックでポップアップを閉じる
    document.addEventListener('mousedown', (e) => {
      if (selectionPopup && !selectionPopup.contains(e.target)) {
        hideSelectionPopup();
      }
    });
  }

  /**
   * 初期化
   */
  function init() {
    if (!isSoldListingsPage()) {
      console.log('[くらべる君 eBay] Sold Listingsページではありません');
      return;
    }

    console.log('[くらべる君 eBay] Sold Listingsページを検出');

    // テキスト選択リスナーを設定
    setupSelectionListener();

    // 少し遅延してからパネルを表示（ページ読み込み完了を待つ）
    setTimeout(() => {
      showAnalysisPanel();
    }, 1500);
  }

  // 初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
