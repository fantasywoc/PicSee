// 图片批量下载器 - 设置页面脚本

// 初始化
function init() {
  loadSettings();
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
}

// 加载设置
function loadSettings() {
  chrome.storage.sync.get([
    'downloadFolder',
    'filenameFormat',
    'defaultMinWidth',
    'defaultMinHeight',
    'defaultFileTypes'
  ], (items) => {
    document.getElementById('downloadFolder').value = items.downloadFolder || '';
    document.getElementById('filenameFormat').value = items.filenameFormat || '{name}_{timestamp}';
    document.getElementById('defaultMinWidth').value = items.defaultMinWidth || '';
    document.getElementById('defaultMinHeight').value = items.defaultMinHeight || '';
    document.getElementById('defaultFileTypes').value = items.defaultFileTypes || 'jpg,png,gif';
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    downloadFolder: document.getElementById('downloadFolder').value,
    filenameFormat: document.getElementById('filenameFormat').value,
    defaultMinWidth: document.getElementById('defaultMinWidth').value,
    defaultMinHeight: document.getElementById('defaultMinHeight').value,
    defaultFileTypes: document.getElementById('defaultFileTypes').value
  };
  
  chrome.storage.sync.set(settings, () => {
    showStatus('设置已保存');
  });
}

// 显示状态信息
function showStatus(message) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.style.display = 'block';
  
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 2000);
}

// 初始化
init();
