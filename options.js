/**
 * しらべる君 - Options Page Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 保存済みのAPIキーを読み込み
  await loadSavedKey();

  // イベントリスナーを設定
  setupEventListeners();
});

/**
 * 保存済みのAPIキーを読み込み
 */
async function loadSavedKey() {
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  const apiKey = result.openaiApiKey || '';

  document.getElementById('openaiKey').value = apiKey;

  // ステータス表示を更新
  updateStatus(!!apiKey);
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
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('openaiKey').value.trim();

    if (!apiKey) {
      showToast('APIキーを入力してください', 'error');
      return;
    }

    // 簡易バリデーション
    if (!apiKey.startsWith('sk-')) {
      showToast('無効なAPIキー形式です（sk-で始まる必要があります）', 'error');
      return;
    }

    // 保存
    await chrome.storage.sync.set({ openaiApiKey: apiKey });

    showToast('APIキーを保存しました', 'success');
    updateStatus(true);
  });
}

/**
 * ステータス表示を更新
 */
function updateStatus(hasKey) {
  const statusEl = document.getElementById('status');

  if (hasKey) {
    statusEl.className = 'status status-success';
    statusEl.innerHTML = '✅ APIキーが設定されています';
  } else {
    statusEl.className = 'status status-warning';
    statusEl.innerHTML = '⚠️ APIキーが設定されていません';
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
