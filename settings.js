// 图看 (PicSee) - 设置页面脚本

// 初始化
function init() {
  // 加载保存的设置
  loadSettings();
  
  // 为模糊程度滑块添加事件监听器
  document.getElementById('blurLevel').addEventListener('input', function() {
    document.getElementById('blurLevelValue').textContent = this.value;
  });
  
  // 为按钮添加事件监听器
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
  
  // 应用主题
  applyTheme();
}

// 加载设置
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      const settings = result.settings;
      
      // 加载界面设置
      if (settings.popupWidth) {
        document.getElementById('popupWidth').value = settings.popupWidth;
      }
      if (settings.popupHeight) {
        document.getElementById('popupHeight').value = settings.popupHeight;
      }
      if (settings.blurLevel) {
        document.getElementById('blurLevel').value = settings.blurLevel;
        document.getElementById('blurLevelValue').textContent = settings.blurLevel;
      }
      
      // 加载主题设置
      if (settings.theme) {
        document.getElementById('themeSelect').value = settings.theme;
      }
    }
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    popupWidth: parseInt(document.getElementById('popupWidth').value) || 800,
    popupHeight: parseInt(document.getElementById('popupHeight').value) || 600,
    blurLevel: parseFloat(document.getElementById('blurLevel').value) || 5,
    theme: document.getElementById('themeSelect').value
  };
  
  chrome.storage.local.set({settings: settings}, () => {
    setStatus('设置已保存');
    
    // 应用新的主题
    applyTheme();
  });
}

// 恢复默认设置
function resetSettings() {
  const defaultSettings = {
    popupWidth: 800,
    popupHeight: 600,
    blurLevel: 5,
    theme: 'dark'
  };
  
  // 重置表单
  document.getElementById('popupWidth').value = defaultSettings.popupWidth;
  document.getElementById('popupHeight').value = defaultSettings.popupHeight;
  document.getElementById('blurLevel').value = defaultSettings.blurLevel;
  document.getElementById('blurLevelValue').textContent = defaultSettings.blurLevel;
  document.getElementById('themeSelect').value = defaultSettings.theme;
  
  // 保存默认设置
  chrome.storage.local.set({settings: defaultSettings}, () => {
    setStatus('已恢复默认设置');
    
    // 应用默认主题
    applyTheme();
  });
}

// 应用主题
function applyTheme() {
  chrome.storage.local.get(['settings'], (result) => {
    let theme = 'light';
    if (result.settings) {
      theme = result.settings.theme || 'light';
    }
    
    let isDark = false;
    
    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'system') {
      // 检测系统主题
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  });
}

// 设置状态信息
function setStatus(message) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  
  // 3秒后清除状态信息
  setTimeout(() => {
    statusElement.textContent = '';
  }, 3000);
}

// 初始化
init();