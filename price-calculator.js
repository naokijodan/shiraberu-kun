/**
 * しらべる君 - 価格計算モジュール
 * eBay/メルカリ商品ページで価格計算を行う
 */

// デフォルト設定値
const PRICE_CALC_DEFAULTS = {
  exchangeRate: 155,
  targetProfitRate: 20,
  feeRate: 18,
  adRate: 10,
  payoneerRate: 2,
  safetyMargin: 3,
  tariffRate: 15,
  vatRate: 0,
  processingFeeRate: 2.1,
  mpf: 0,
  ceMpf: 296,
  mpfUsd: 0,
  euShippingDiff: 0,
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

/**
 * 価格計算クラス
 */
class PriceCalculator {
  constructor(settings = {}) {
    this.settings = { ...PRICE_CALC_DEFAULTS, ...settings };
  }

  /**
   * 設定を更新
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * chrome.storageから設定を読み込み
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['priceCalcSettings']);
      if (result.priceCalcSettings) {
        this.settings = { ...PRICE_CALC_DEFAULTS, ...result.priceCalcSettings };
      }
    } catch (e) {
      console.log('[価格計算] 設定読み込みエラー:', e);
    }
    return this.settings;
  }

  /**
   * eBay価格から仕入れ上限を計算（メイン機能）
   * @param {number} ebayPriceUSD - eBay販売価格（USD）
   * @param {boolean} isDDP - DDP価格かどうか（デフォルト: true）
   * @returns {Object} 計算結果
   */
  calculateMaxPurchasePrice(ebayPriceUSD, isDDP = true) {
    const s = this.settings;
    const feeRate = s.feeRate / 100;
    const adRate = s.adRate / 100;
    const payoneerRate = s.payoneerRate / 100;
    const tariffRate = s.tariffRate / 100;
    const targetProfitRate = s.targetProfitRate / 100;

    // 送料計算
    const shippingCostJPY = this._calculateShippingCost(s.shippingThreshold);

    // 配送方法を判定
    const effectiveMethod = this._getEffectiveShippingMethod(s.shippingThreshold);

    let sellingPriceUSD;
    let tariffUSD = 0;

    if (isDDP) {
      // DDP価格の場合、関税を逆算
      const tariffAmounts = this._calculateTariffAmounts(ebayPriceUSD, effectiveMethod);
      // DDP価格 = DDU価格 + 関税 なので、DDU価格を求める
      // 反復計算で求める
      sellingPriceUSD = ebayPriceUSD;
      for (let i = 0; i < 10; i++) {
        const tempTariff = this._calculateTariffAmounts(sellingPriceUSD, effectiveMethod);
        sellingPriceUSD = ebayPriceUSD - tempTariff.adjustedTariff;
        if (sellingPriceUSD < 0) sellingPriceUSD = ebayPriceUSD * 0.8;
      }
      tariffUSD = this._calculateTariffAmounts(sellingPriceUSD, effectiveMethod).actualTariff;
    } else {
      sellingPriceUSD = ebayPriceUSD;
      const tariffAmounts = this._calculateTariffAmounts(sellingPriceUSD, effectiveMethod);
      tariffUSD = tariffAmounts.actualTariff;
    }

    // 売上金額（円）
    const ddpPriceJPY = ebayPriceUSD * s.exchangeRate;
    const dduPriceJPY = sellingPriceUSD * s.exchangeRate;

    // 手数料計算（DDP価格ベース）
    const ebayFeeJPY = ddpPriceJPY * feeRate;
    const adFeeJPY = ddpPriceJPY * adRate;
    const afterEbayFees = ddpPriceJPY - ebayFeeJPY - adFeeJPY;
    const payoneerFeeJPY = afterEbayFees * payoneerRate;
    const afterPayoneer = afterEbayFees - payoneerFeeJPY;

    // 関税（円）
    const tariffJPY = tariffUSD * s.exchangeRate;

    // 利益を確保した場合の仕入れ上限
    // 利益 = 入金額 - 関税 - 仕入れ - 送料
    // 利益率 = 利益 / DDP売上
    // targetProfitRate = (afterPayoneer - tariffJPY - costJPY - shippingCostJPY) / ddpPriceJPY
    // costJPY = afterPayoneer - tariffJPY - shippingCostJPY - (targetProfitRate * ddpPriceJPY)
    const targetProfitJPY = ddpPriceJPY * targetProfitRate;
    const maxCostJPY = afterPayoneer - tariffJPY - shippingCostJPY - targetProfitJPY;

    // 利益0円の場合の仕入れ上限
    const breakEvenCostJPY = afterPayoneer - tariffJPY - shippingCostJPY;

    // 実際の利益計算（仕入れ上限で購入した場合）
    const actualProfitJPY = afterPayoneer - tariffJPY - maxCostJPY - shippingCostJPY;
    const actualProfitRate = (actualProfitJPY / ddpPriceJPY) * 100;

    return {
      // 入力
      ebayPriceUSD,
      isDDP,
      // 価格
      ddpPriceUSD: ebayPriceUSD,
      dduPriceUSD: sellingPriceUSD,
      ddpPriceJPY: Math.round(ddpPriceJPY),
      dduPriceJPY: Math.round(dduPriceJPY),
      // 手数料
      ebayFeeJPY: Math.round(ebayFeeJPY),
      adFeeJPY: Math.round(adFeeJPY),
      payoneerFeeJPY: Math.round(payoneerFeeJPY),
      totalFeesJPY: Math.round(ebayFeeJPY + adFeeJPY + payoneerFeeJPY),
      // 関税
      tariffUSD,
      tariffJPY: Math.round(tariffJPY),
      // 送料
      shippingCostJPY,
      shippingMethod: effectiveMethod,
      shippingMethodName: this._getMethodName(effectiveMethod),
      // 仕入れ上限
      maxCostJPY: Math.round(Math.max(0, maxCostJPY)),
      breakEvenCostJPY: Math.round(Math.max(0, breakEvenCostJPY)),
      // 利益
      targetProfitRate: s.targetProfitRate,
      targetProfitJPY: Math.round(targetProfitJPY),
      actualProfitJPY: Math.round(actualProfitJPY),
      actualProfitRate: actualProfitRate.toFixed(1),
      // 為替
      exchangeRate: s.exchangeRate
    };
  }

  /**
   * メルカリ価格からeBay販売価格を計算（メイン機能）
   * @param {number} mercariPriceJPY - メルカリ価格（円）
   * @returns {Object} 計算結果
   */
  calculateEbaySellingPrice(mercariPriceJPY) {
    const s = this.settings;
    const feeRate = s.feeRate / 100;
    const adRate = s.adRate / 100;
    const payoneerRate = s.payoneerRate / 100;
    const targetProfitRate = s.targetProfitRate / 100;

    // 送料計算
    const shippingCostJPY = this._calculateShippingCost(mercariPriceJPY);

    // 配送方法を判定
    const effectiveMethod = this._getEffectiveShippingMethod(mercariPriceJPY);

    // 目標利益額
    const costJPY = mercariPriceJPY;

    // 反復計算で販売価格を求める
    // 初期値
    let sellingPriceUSD = (costJPY + shippingCostJPY) / s.exchangeRate / (1 - feeRate - adRate - targetProfitRate);

    for (let i = 0; i < 20; i++) {
      // 関税計算
      const tariffAmounts = this._calculateTariffAmounts(sellingPriceUSD, effectiveMethod);

      // DDP価格
      const ddpPrice = sellingPriceUSD + tariffAmounts.adjustedTariff;

      // 利益計算
      const ddpPriceJPY = ddpPrice * s.exchangeRate;
      const ebayFeeJPY = ddpPriceJPY * feeRate;
      const adFeeJPY = ddpPriceJPY * adRate;
      const afterEbayFees = ddpPriceJPY - ebayFeeJPY - adFeeJPY;
      const payoneerFeeJPY = afterEbayFees * payoneerRate;
      const afterPayoneer = afterEbayFees - payoneerFeeJPY;
      const actualTariffJPY = tariffAmounts.actualTariff * s.exchangeRate;
      const calculatedProfit = afterPayoneer - actualTariffJPY - costJPY - shippingCostJPY;

      // 目標利益率との差分
      const currentProfitRate = calculatedProfit / ddpPriceJPY;
      const rateDiff = targetProfitRate - currentProfitRate;

      // 収束判定
      if (Math.abs(rateDiff) < 0.0001) break;

      // 販売価格を調整
      sellingPriceUSD *= (1 + rateDiff);
    }

    // 最終計算
    const tariffAmounts = this._calculateTariffAmounts(sellingPriceUSD, effectiveMethod);
    const ddpPriceUSD = sellingPriceUSD + tariffAmounts.adjustedTariff;
    const ddpPriceJPY = ddpPriceUSD * s.exchangeRate;

    // 利益計算
    const ebayFeeJPY = ddpPriceJPY * feeRate;
    const adFeeJPY = ddpPriceJPY * adRate;
    const afterEbayFees = ddpPriceJPY - ebayFeeJPY - adFeeJPY;
    const payoneerFeeJPY = afterEbayFees * payoneerRate;
    const afterPayoneer = afterEbayFees - payoneerFeeJPY;
    const actualTariffJPY = tariffAmounts.actualTariff * s.exchangeRate;
    const profitJPY = afterPayoneer - actualTariffJPY - costJPY - shippingCostJPY;
    const profitRate = (profitJPY / ddpPriceJPY) * 100;

    return {
      // 入力
      mercariPriceJPY,
      // 販売価格
      dduPriceUSD: Math.round(sellingPriceUSD * 100) / 100,
      ddpPriceUSD: Math.round(ddpPriceUSD * 100) / 100,
      ddpPriceJPY: Math.round(ddpPriceJPY),
      // 手数料
      ebayFeeJPY: Math.round(ebayFeeJPY),
      adFeeJPY: Math.round(adFeeJPY),
      payoneerFeeJPY: Math.round(payoneerFeeJPY),
      totalFeesJPY: Math.round(ebayFeeJPY + adFeeJPY + payoneerFeeJPY),
      // 関税
      tariffUSD: tariffAmounts.actualTariff,
      tariffJPY: Math.round(actualTariffJPY),
      // 送料
      shippingCostJPY,
      shippingMethod: effectiveMethod,
      shippingMethodName: this._getMethodName(effectiveMethod),
      // 利益
      profitJPY: Math.round(profitJPY),
      profitRate: profitRate.toFixed(1),
      targetProfitRate: s.targetProfitRate,
      // 為替
      exchangeRate: s.exchangeRate
    };
  }

  /**
   * 送料を計算
   */
  _calculateShippingCost(costJPY) {
    const s = this.settings;

    if (s.shippingMode === 'fixed') {
      return s.shippingCost;
    }

    // テーブル計算
    const volume = s.packageLength * s.packageWidth * s.packageHeight;
    const effectiveMethod = this._getEffectiveShippingMethod(costJPY);
    const volWeight = this._calculateVolWeightByMethod(effectiveMethod, volume);
    const chargeableWeight = Math.max(s.actualWeight, volWeight);

    return this._calculateSpecificMethodRate(effectiveMethod, s.actualWeight, chargeableWeight) || s.shippingCost;
  }

  /**
   * 実際に使用される配送方法を判定
   */
  _getEffectiveShippingMethod(costJPY) {
    const s = this.settings;

    if (s.shippingMethod && s.shippingMethod !== '自動選択') {
      return s.shippingMethod;
    }

    if (s.lowPriceMethod === 'NONE' || costJPY >= s.shippingThreshold) {
      return s.highPriceMethod;
    }

    if (s.lowPriceMethod === 'EP' && s.actualWeight > 2000) {
      return s.highPriceMethod;
    }

    return s.lowPriceMethod;
  }

  /**
   * 配送方法に応じた容積重量計算
   */
  _calculateVolWeightByMethod(method, volume) {
    if (!volume) return 0;

    let volumetricWeight;
    if (method === 'CE') {
      volumetricWeight = Math.round(volume / 8);
    } else {
      volumetricWeight = Math.round(volume / 5);
    }
    return Math.max(volumetricWeight, 100);
  }

  /**
   * 関税額を計算
   */
  _calculateTariffAmounts(sellingPriceUSD, effectiveMethod) {
    const s = this.settings;
    const tariffRate = s.tariffRate / 100;
    const vatRate = s.vatRate / 100;
    const processingFeeRate = s.processingFeeRate / 100;
    const safetyMargin = s.safetyMargin / 100;
    const feeRate = s.feeRate / 100;
    const adRate = s.adRate / 100;

    const customsFeeJPY = (effectiveMethod === 'CE') ? s.ceMpf : 0;

    // 実際の関税額
    const actualTariff = sellingPriceUSD * tariffRate * (1 + processingFeeRate)
                       + sellingPriceUSD * vatRate * processingFeeRate
                       + (customsFeeJPY / s.exchangeRate)
                       + s.mpfUsd
                       + (s.euShippingDiff / s.exchangeRate);

    // 調整関税率
    const denominator = 1 - feeRate - adRate;
    const adjustedTariffRate = denominator > 0
      ? (tariffRate / denominator) * (1 + safetyMargin)
      : tariffRate;

    // 調整後の関税額
    const adjustedTariff = sellingPriceUSD * adjustedTariffRate * (1 + processingFeeRate)
                         + sellingPriceUSD * vatRate * processingFeeRate
                         + (customsFeeJPY / s.exchangeRate)
                         + s.mpfUsd
                         + (s.euShippingDiff / s.exchangeRate);

    return {
      actualTariff,
      adjustedTariff,
      difference: adjustedTariff - actualTariff
    };
  }

  /**
   * 配送方法別の料金計算
   */
  _calculateSpecificMethodRate(method, actualWeight, chargeableWeight) {
    switch (method) {
      case 'EP':
        return this._getEpacketRate(actualWeight);
      case 'CF':
        return this._getCpassFedexRate(chargeableWeight);
      case 'CD':
        return this._getCpassDHLRate(chargeableWeight);
      case 'EL':
        return this._getElogiRate(chargeableWeight);
      case 'CE':
        return this._getCpassEconomyRate(chargeableWeight);
      case 'EMS':
        return this._getEMSRate(actualWeight);
      default:
        return this._getCpassFedexRate(chargeableWeight);
    }
  }

  _getEpacketRate(weight) {
    if (weight > 2000) return null;
    for (const rate of SHIPPING_RATE_TABLE.EP) {
      if (weight >= rate.min && weight <= rate.max) {
        return rate.yen;
      }
    }
    return null;
  }

  _getCpassFedexRate(weight) {
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

  _getCpassDHLRate(weight) {
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

  _getElogiRate(weight) {
    for (const rate of SHIPPING_RATE_TABLE.EL) {
      if (weight >= rate.min && weight <= rate.max) {
        return rate.yen;
      }
    }
    return 999999;
  }

  _getCpassEconomyRate(weight) {
    for (const rate of SHIPPING_RATE_TABLE.CE) {
      if (weight >= rate.min && weight <= rate.max) {
        return rate.yen !== null ? rate.yen : 999999;
      }
    }
    return 999999;
  }

  _getEMSRate(weight) {
    for (const rate of SHIPPING_RATE_TABLE.EMS) {
      if (weight >= rate.min && weight <= rate.max) {
        return rate.yen;
      }
    }
    return 999999;
  }

  /**
   * 配送方法の表示名を取得
   */
  _getMethodName(code) {
    const names = {
      'EP': 'eパケット',
      'CE': 'Cpass-Economy',
      'CF': 'Cpass-FedEx',
      'CD': 'Cpass-DHL',
      'EL': 'eLogistics',
      'EMS': 'EMS'
    };
    return names[code] || code;
  }
}

// グローバルに公開
window.PriceCalculator = PriceCalculator;
