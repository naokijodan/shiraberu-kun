/**
 * しらべる君 - Options Page Script
 * 価格計算設定を含む全設定の管理
 */

// デフォルト設定値
const DEFAULT_SETTINGS = {
  // 基本設定
  exchangeRate: 155,
  targetProfitRate: 20,
  feeRate: 18,
  adRate: 10,
  payoneerRate: 2,
  safetyMargin: 3,
  // 関税・通関設定
  tariffRate: 15,
  vatRate: 0,
  processingFeeRate: 2.1,
  mpf: 0,
  ceMpf: 296,
  mpfUsd: 0,
  euShippingDiff: 0,
  // 送料設定
  shippingMode: 'fixed',
  shippingCost: 3000,
  shippingThreshold: 5500,
  lowPriceMethod: 'EP',
  highPriceMethod: 'CF',
  actualWeight: 500,
  packageLength: 20,
  packageWidth: 20,
  packageHeight: 20,
  shippingMethod: '自動選択'
};

// 送料テーブル
const SHIPPING_RATE_TABLE = {
  EP: [
    { min: 0, max: 50, yen: 510 },
    { min: 51, max: 100, yen: 610 },
    { min: 101, max: 150, yen: 710 },
    { min: 151, max: 200, yen: 810 },
    { min: 201, max: 250, yen: 910 },
    { min: 251, max: 300, yen: 1010 },
    { min: 301, max: 400, yen: 1160 },
    { min: 401, max: 500, yen: 1310 },
    { min: 501, max: 600, yen: 1460 },
    { min: 601, max: 700, yen: 1610 },
    { min: 701, max: 800, yen: 1760 },
    { min: 801, max: 900, yen: 1910 },
    { min: 901, max: 1000, yen: 2060 },
    { min: 1001, max: 1250, yen: 2320 },
    { min: 1251, max: 1500, yen: 2610 },
    { min: 1501, max: 1750, yen: 2890 },
    { min: 1751, max: 2000, yen: 3170 }
  ],
  CF: [
    { min: 0, max: 500, yen: 2900 },
    { min: 501, max: 1000, yen: 3390 },
    { min: 1001, max: 1500, yen: 3880 },
    { min: 1501, max: 2000, yen: 4370 },
    { min: 2001, max: 2500, yen: 4860 },
    { min: 2501, max: 3000, yen: 5350 },
    { min: 3001, max: 3500, yen: 5840 },
    { min: 3501, max: 4000, yen: 6330 },
    { min: 4001, max: 4500, yen: 6820 },
    { min: 4501, max: 5000, yen: 7310 }
  ],
  CD: [
    { min: 0, max: 500, yen: 3360 },
    { min: 501, max: 1000, yen: 3740 },
    { min: 1001, max: 1500, yen: 4120 },
    { min: 1501, max: 2000, yen: 4500 },
    { min: 2001, max: 2500, yen: 4880 },
    { min: 2501, max: 3000, yen: 5260 },
    { min: 3001, max: 3500, yen: 5640 },
    { min: 3501, max: 4000, yen: 6020 },
    { min: 4001, max: 4500, yen: 6400 },
    { min: 4501, max: 5000, yen: 6780 }
  ],
  EL: [
    { min: 0, max: 500, yen: 1830 },
    { min: 501, max: 1000, yen: 2380 },
    { min: 1001, max: 1500, yen: 2930 },
    { min: 1501, max: 2000, yen: 3480 },
    { min: 2001, max: 2500, yen: 4030 },
    { min: 2501, max: 3000, yen: 4580 },
    { min: 3001, max: 3500, yen: 5130 },
    { min: 3501, max: 4000, yen: 5680 },
    { min: 4001, max: 4500, yen: 6230 },
    { min: 4501, max: 5000, yen: 6780 }
  ],
  CE: [
    { min: 0, max: 500, yen: 1290 },
    { min: 501, max: 1000, yen: 1570 },
    { min: 1001, max: 1500, yen: 1850 },
    { min: 1501, max: 2000, yen: 2130 },
    { min: 2001, max: 2500, yen: 2420 },
    { min: 2501, max: 3000, yen: 2700 },
    { min: 3001, max: 3500, yen: 2980 },
    { min: 3501, max: 4000, yen: 3260 },
    { min: 4001, max: 4500, yen: 3550 },
    { min: 4501, max: 5000, yen: 3830 }
  ],
  EMS: [
    { min: 0, max: 500, yen: 3900 },
    { min: 501, max: 600, yen: 4180 },
    { min: 601, max: 700, yen: 4460 },
    { min: 701, max: 800, yen: 4740 },
    { min: 801, max: 900, yen: 5020 },
    { min: 901, max: 1000, yen: 5300 },
    { min: 1001, max: 1250, yen: 5950 },
    { min: 1251, max: 1500, yen: 6600 },
    { min: 1501, max: 1750, yen: 7250 },
    { min: 1751, max: 2000, yen: 7900 }
  ]
};

// 送料計算用の設定
const SHIPPING_CONFIG = {
  fedexFuel: 0.185,
  dhlFuel: 0.185,
  cpassDiscount: 0.4,
  fedexExtraPer500g: 490,
  dhlExtraPer500g: 96
};

document.addEventListener('DOMContentLoaded', async () => {
  // 保存済みの設定を読み込み
  await loadAllSettings();

  // イベントリスナーを設定
  setupEventListeners();

  // 送料モード切替
  toggleShippingMode();

  // 容積重量計算のイベントを設定
  setupVolumetricWeightListeners();
});

/**
 * 全設定を読み込み
 */
async function loadAllSettings() {
  const result = await chrome.storage.sync.get(['openaiApiKey', 'priceCalcSettings']);

  // APIキー
  const apiKey = result.openaiApiKey || '';
  document.getElementById('openaiKey').value = apiKey;
  updateApiKeyStatus(!!apiKey);

  // 価格計算設定
  const settings = result.priceCalcSettings || DEFAULT_SETTINGS;
  applySettingsToForm(settings);
}

/**
 * 設定をフォームに適用
 */
function applySettingsToForm(settings) {
  const fields = [
    'exchangeRate', 'targetProfitRate', 'feeRate', 'adRate', 'payoneerRate', 'safetyMargin',
    'tariffRate', 'vatRate', 'processingFeeRate', 'mpf', 'ceMpf', 'mpfUsd', 'euShippingDiff',
    'shippingMode', 'shippingCost', 'shippingThreshold', 'lowPriceMethod', 'highPriceMethod',
    'actualWeight', 'packageLength', 'packageWidth', 'packageHeight', 'shippingMethod'
  ];

  fields.forEach(field => {
    const el = document.getElementById(field);
    if (el && settings[field] !== undefined) {
      el.value = settings[field];
    }
  });

  // 送料モード切替
  toggleShippingMode();

  // 容積重量を計算
  calculateVolumetricWeight();
}

/**
 * フォームから設定を取得
 */
function getSettingsFromForm() {
  return {
    exchangeRate: parseFloat(document.getElementById('exchangeRate').value) || DEFAULT_SETTINGS.exchangeRate,
    targetProfitRate: parseFloat(document.getElementById('targetProfitRate').value) || DEFAULT_SETTINGS.targetProfitRate,
    feeRate: parseFloat(document.getElementById('feeRate').value) || DEFAULT_SETTINGS.feeRate,
    adRate: parseFloat(document.getElementById('adRate').value) || DEFAULT_SETTINGS.adRate,
    payoneerRate: parseFloat(document.getElementById('payoneerRate').value) || DEFAULT_SETTINGS.payoneerRate,
    safetyMargin: parseFloat(document.getElementById('safetyMargin').value) || DEFAULT_SETTINGS.safetyMargin,
    tariffRate: parseFloat(document.getElementById('tariffRate').value) || DEFAULT_SETTINGS.tariffRate,
    vatRate: parseFloat(document.getElementById('vatRate').value) || DEFAULT_SETTINGS.vatRate,
    processingFeeRate: parseFloat(document.getElementById('processingFeeRate').value) || DEFAULT_SETTINGS.processingFeeRate,
    mpf: parseFloat(document.getElementById('mpf').value) || 0,
    ceMpf: parseFloat(document.getElementById('ceMpf').value) || DEFAULT_SETTINGS.ceMpf,
    mpfUsd: parseFloat(document.getElementById('mpfUsd').value) || 0,
    euShippingDiff: parseFloat(document.getElementById('euShippingDiff').value) || 0,
    shippingMode: document.getElementById('shippingMode').value,
    shippingCost: parseFloat(document.getElementById('shippingCost').value) || DEFAULT_SETTINGS.shippingCost,
    shippingThreshold: parseFloat(document.getElementById('shippingThreshold').value) || DEFAULT_SETTINGS.shippingThreshold,
    lowPriceMethod: document.getElementById('lowPriceMethod').value,
    highPriceMethod: document.getElementById('highPriceMethod').value,
    actualWeight: parseFloat(document.getElementById('actualWeight').value) || DEFAULT_SETTINGS.actualWeight,
    packageLength: parseFloat(document.getElementById('packageLength').value) || DEFAULT_SETTINGS.packageLength,
    packageWidth: parseFloat(document.getElementById('packageWidth').value) || DEFAULT_SETTINGS.packageWidth,
    packageHeight: parseFloat(document.getElementById('packageHeight').value) || DEFAULT_SETTINGS.packageHeight,
    shippingMethod: document.getElementById('shippingMethod').value
  };
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // パスワード表示切り替え
  document.getElementById('toggleVisibility').addEventListener('click', () => {
    const input = document.getElementById('openaiKey');
    const btn = document.getElementById('toggleVisibility');

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
    }
  });

  // 保存ボタン
  document.getElementById('saveBtn').addEventListener('click', saveAllSettings);

  // リセットボタン
  document.getElementById('resetBtn').addEventListener('click', resetToDefaults);

  // 送料モード変更
  document.getElementById('shippingMode').addEventListener('change', toggleShippingMode);

  // 為替レート更新ボタン
  document.getElementById('refreshRateBtn').addEventListener('click', refreshExchangeRate);

  // セクション折りたたみ（全てのセクションヘッダー）
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      section.classList.toggle('collapsed');
    });
  });
}

/**
 * 容積重量計算用のイベントリスナー
 */
function setupVolumetricWeightListeners() {
  const fields = ['actualWeight', 'packageLength', 'packageWidth', 'packageHeight', 'shippingMethod'];
  fields.forEach(field => {
    const el = document.getElementById(field);
    if (el) {
      el.addEventListener('input', () => {
        calculateVolumetricWeight();
        calculateEstimatedShipping();
      });
      el.addEventListener('change', () => {
        calculateVolumetricWeight();
        calculateEstimatedShipping();
      });
    }
  });
}

/**
 * 全設定を保存
 */
async function saveAllSettings() {
  const apiKey = document.getElementById('openaiKey').value.trim();

  // APIキーのバリデーション（空でない場合）
  if (apiKey && !apiKey.startsWith('sk-')) {
    showToast('無効なAPIキー形式です（sk-で始まる必要があります）', 'error');
    return;
  }

  // 価格計算設定を取得
  const priceCalcSettings = getSettingsFromForm();

  // 保存
  await chrome.storage.sync.set({
    openaiApiKey: apiKey,
    priceCalcSettings: priceCalcSettings
  });

  showToast('すべての設定を保存しました', 'success');
  updateApiKeyStatus(!!apiKey);

  // 保存ステータス表示
  const statusEl = document.getElementById('saveStatus');
  statusEl.className = 'status status-success';
  statusEl.innerHTML = '✅ 設定が保存されました';
  setTimeout(() => {
    statusEl.innerHTML = '';
    statusEl.className = '';
  }, 3000);
}

/**
 * デフォルト値にリセット
 */
async function resetToDefaults() {
  if (!confirm('すべての価格計算設定を初期値に戻しますか？\n（APIキーはリセットされません）')) {
    return;
  }

  applySettingsToForm(DEFAULT_SETTINGS);
  showToast('設定を初期値に戻しました', 'success');
}

/**
 * 送料モード切替
 */
function toggleShippingMode() {
  const mode = document.getElementById('shippingMode').value;
  const fixedSettings = document.getElementById('fixedShippingSettings');
  const tableSettings = document.getElementById('tableShippingSettings');

  if (mode === 'fixed') {
    fixedSettings.classList.remove('hidden');
    tableSettings.classList.add('hidden');
  } else {
    fixedSettings.classList.add('hidden');
    tableSettings.classList.remove('hidden');
    calculateVolumetricWeight();
    calculateEstimatedShipping();
  }
}

/**
 * 容積重量を計算
 */
function calculateVolumetricWeight() {
  const length = parseFloat(document.getElementById('packageLength').value) || 0;
  const width = parseFloat(document.getElementById('packageWidth').value) || 0;
  const height = parseFloat(document.getElementById('packageHeight').value) || 0;

  const volume = length * width * height;

  // CF/CD/EL/EMS用（÷5）
  const volWeight5 = Math.max(Math.round(volume / 5), 100);
  // CE用（÷8）
  const volWeight8 = Math.max(Math.round(volume / 8), 100);

  document.getElementById('volumetricWeight').value = volWeight5;
  document.getElementById('volumetricWeightCE').value = volWeight8;
}

/**
 * 送料試算を計算
 */
function calculateEstimatedShipping() {
  const actualWeight = parseFloat(document.getElementById('actualWeight').value) || 0;
  const volWeight5 = parseFloat(document.getElementById('volumetricWeight').value) || 0;
  const volWeight8 = parseFloat(document.getElementById('volumetricWeightCE').value) || 0;
  const selectedMethod = document.getElementById('shippingMethod').value;

  const allMethods = [
    { code: 'EP', name: 'eパケット', volWeight: 0 },
    { code: 'CE', name: 'Cpass-Economy', volWeight: volWeight8 },
    { code: 'CF', name: 'Cpass-FedEx', volWeight: volWeight5 },
    { code: 'CD', name: 'Cpass-DHL', volWeight: volWeight5 },
    { code: 'EL', name: 'eLogistics', volWeight: volWeight5 },
    { code: 'EMS', name: 'EMS', volWeight: 0 }
  ];

  // 自動選択の場合の判定
  let autoSelectedCode = null;
  if (selectedMethod === '自動選択') {
    const lowMethod = document.getElementById('lowPriceMethod').value;
    const highMethod = document.getElementById('highPriceMethod').value;
    autoSelectedCode = (lowMethod === 'EP' && actualWeight > 2000) ? highMethod : lowMethod;
  }

  let tableHtml = '';
  allMethods.forEach(m => {
    let chargeableWeight;
    if (m.code === 'EP' || m.code === 'EMS') {
      chargeableWeight = actualWeight;
    } else {
      chargeableWeight = Math.max(actualWeight, m.volWeight);
    }

    const cost = calculateSpecificMethodRate(m.code, actualWeight, chargeableWeight);
    const isUnavailable = (cost === null || cost === undefined || cost === 999999);

    let isSelected = false;
    if (selectedMethod === '自動選択') {
      isSelected = (m.code === autoSelectedCode);
    } else {
      isSelected = (m.code === selectedMethod);
    }

    let rowClass = '';
    if (isSelected) rowClass = 'selected';
    else if (isUnavailable) rowClass = 'unavailable';

    let costDisplay = isUnavailable ? '対応不可' : `¥${cost.toLocaleString()}`;

    tableHtml += `<tr class="${rowClass}">
      <td>${m.name}</td>
      <td>${chargeableWeight.toLocaleString()} g</td>
      <td class="cost-cell">${costDisplay}</td>
    </tr>`;
  });

  document.getElementById('shippingEstimateBody').innerHTML = tableHtml;
}

/**
 * 配送方法別の料金計算
 */
function calculateSpecificMethodRate(method, actualWeight, chargeableWeight) {
  switch (method) {
    case 'EP':
      return getEpacketRate(actualWeight);
    case 'CF':
      return getCpassFedexRate(chargeableWeight);
    case 'CD':
      return getCpassDHLRate(chargeableWeight);
    case 'EL':
      return getElogiRate(chargeableWeight);
    case 'CE':
      return getCpassEconomyRate(chargeableWeight);
    case 'EMS':
      return getEMSRate(actualWeight);
    default:
      return getCpassFedexRate(chargeableWeight);
  }
}

/**
 * eパケット料金
 */
function getEpacketRate(weight) {
  if (weight > 2000) return null;
  for (const rate of SHIPPING_RATE_TABLE.EP) {
    if (weight >= rate.min && weight <= rate.max) {
      return rate.yen;
    }
  }
  return null;
}

/**
 * Cpass-FedEx料金
 */
function getCpassFedexRate(weight) {
  const rounded = Math.ceil(weight / 500) * 500;
  let base = null;

  for (const rate of SHIPPING_RATE_TABLE.CF) {
    if (weight >= rate.min && weight <= rate.max) {
      base = rate.yen;
      break;
    }
  }

  if (!base) return 999999;

  const overUnits = Math.max(0, (rounded - 500) / 500);
  const extra = overUnits * SHIPPING_CONFIG.fedexExtraPer500g;
  const subTotal = base + extra;
  const fuel = subTotal * SHIPPING_CONFIG.fedexFuel;
  const discount = -(subTotal + fuel) * SHIPPING_CONFIG.cpassDiscount;
  return Math.round(subTotal + fuel + discount);
}

/**
 * Cpass-DHL料金
 */
function getCpassDHLRate(weight) {
  const rounded = Math.ceil(weight / 500) * 500;
  let base = null;

  for (const rate of SHIPPING_RATE_TABLE.CD) {
    if (weight >= rate.min && weight <= rate.max) {
      base = rate.yen;
      break;
    }
  }

  if (!base) return 999999;

  const overUnits = Math.max(0, (rounded - 500) / 500);
  const extra = overUnits * SHIPPING_CONFIG.dhlExtraPer500g;
  const subTotal = base + extra;
  const fuel = subTotal * SHIPPING_CONFIG.dhlFuel;
  const discount = -(subTotal + fuel) * SHIPPING_CONFIG.cpassDiscount;
  return Math.round(subTotal + fuel + discount);
}

/**
 * eLogistics料金
 */
function getElogiRate(weight) {
  for (const rate of SHIPPING_RATE_TABLE.EL) {
    if (weight >= rate.min && weight <= rate.max) {
      return rate.yen;
    }
  }
  return 999999;
}

/**
 * Cpass-Economy料金
 */
function getCpassEconomyRate(weight) {
  for (const rate of SHIPPING_RATE_TABLE.CE) {
    if (weight >= rate.min && weight <= rate.max) {
      return rate.yen !== null ? rate.yen : 999999;
    }
  }
  return 999999;
}

/**
 * EMS料金
 */
function getEMSRate(weight) {
  for (const rate of SHIPPING_RATE_TABLE.EMS) {
    if (weight >= rate.min && weight <= rate.max) {
      return rate.yen;
    }
  }
  return 999999;
}

/**
 * 為替レートを更新
 */
async function refreshExchangeRate() {
  const btn = document.getElementById('refreshRateBtn');
  btn.classList.add('loading');
  btn.textContent = '取得中...';

  try {
    // 無料の為替API（exchangerate-api）を使用
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();

    if (data && data.rates && data.rates.JPY) {
      const rate = data.rates.JPY;
      document.getElementById('exchangeRate').value = rate.toFixed(3);
      showToast(`為替レートを更新しました: $1 = ¥${rate.toFixed(2)}`, 'success');
    } else {
      throw new Error('レート取得失敗');
    }
  } catch (error) {
    console.error('為替レート取得エラー:', error);
    showToast('為替レートの取得に失敗しました', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '🔄 更新';
  }
}

/**
 * セクションの折りたたみ切替
 */
function toggleSection(header) {
  const section = header.parentElement;
  section.classList.toggle('collapsed');
}

/**
 * APIキーステータス表示を更新
 */
function updateApiKeyStatus(hasKey) {
  const statusEl = document.getElementById('apiKeyStatus');

  if (hasKey) {
    statusEl.className = 'status status-success';
    statusEl.innerHTML = '✅ APIキーが設定されています';
  } else {
    statusEl.className = 'status status-warning';
    statusEl.innerHTML = '⚠️ APIキーが設定されていません（AI翻訳機能は使用できません）';
  }
}

/**
 * トースト通知を表示
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// グローバル関数として公開（HTMLのonclickから呼び出し用）
window.toggleShippingMode = toggleShippingMode;
window.refreshExchangeRate = refreshExchangeRate;
window.toggleSection = toggleSection;
