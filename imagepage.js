// 看看图 (PicSee) - 新标签页脚本

let images = [];
let currentPreviewIndex = 0;
let scale = 1;
let debounceTimer = null;

// 初始化
function init() {
  // 为参数输入框添加事件监听器
  const minWidthInput = document.getElementById('minWidth');
  const minHeightInput = document.getElementById('minHeight');
  const fileTypesInput = document.getElementById('fileTypes');
  
  // 更新进度条显示值
  function updateMinWidthValue() {
    document.getElementById('minWidthValue').textContent = minWidthInput.value;
  }
  
  function updateMinHeightValue() {
    document.getElementById('minHeightValue').textContent = minHeightInput.value;
  }
  
  const debouncedApplyFilter = debounce(applyFilter, 500);
  
  minWidthInput.addEventListener('input', function() {
    updateMinWidthValue();
    debouncedApplyFilter();
  });
  
  minHeightInput.addEventListener('input', function() {
    updateMinHeightValue();
    debouncedApplyFilter();
  });
  
  fileTypesInput.addEventListener('input', debounce(applyFilter, 500));
  
  document.getElementById('filterBtn').addEventListener('click', applyFilter);
  document.getElementById('selectAllBtn').addEventListener('click', selectAll);
  document.getElementById('selectNoneBtn').addEventListener('click', selectNone);
  document.getElementById('batchDownloadBtn').addEventListener('click', () => batchDownload('individual'));
  document.getElementById('zipDownloadBtn').addEventListener('click', () => batchDownload('zip'));
  
  // 主题切换和设置按钮
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  
  // 图片预览相关事件
  document.getElementById('close').addEventListener('click', closePreview);
  document.getElementById('prevBtn').addEventListener('click', showPrevImage);
  document.getElementById('nextBtn').addEventListener('click', showNextImage);
  document.getElementById('previewImage').addEventListener('click', toggleZoom);
  document.getElementById('imagePreviewModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closePreview();
    }
  });
  
  // 滚轮缩放
  document.getElementById('previewImage').addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
      // 放大
      scale += 0.1;
    } else {
      // 缩小
      scale = Math.max(0.1, scale - 0.1);
    }
    updateImageScale();
  });
  
  // 点击模态框外部关闭
  window.addEventListener('click', function(e) {
    const modal = document.getElementById('imagePreviewModal');
    if (e.target === modal) {
      closePreview();
    }
  });
  
  // 监听来自content.js的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'imageDetected') {
      // 检查是否已存在相同URL的图片
      const existingIndex = images.findIndex(img => img.url === message.image.url);
      if (existingIndex === -1) {
        // 添加新图片
        images.push(message.image);
        // 更新界面
        displayImages(images);
        // 更新状态
        setStatus(`检测到 ${images.length} 张图片`);
      }
    } else if (message.action === 'imageDetectionComplete') {
      // 检测完成，更新状态
      setStatus(`检测完成，共找到 ${message.total} 张图片`);
    }
  });
  
  // 应用保存的设置
  applySettings();
  
  // 加载存储的图片数据
  loadStoredImages();
}

// 防抖函数
function debounce(func, wait) {
  return function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      func.apply(this, arguments);
    }, wait);
  };
}

// 应用设置
function applySettings() {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      const settings = result.settings;
      
      // 应用模糊程度
      if (settings.blurLevel) {
        document.documentElement.style.setProperty('--blur-level', `${settings.blurLevel}px`);
      }
      
      // 应用主题
      applyTheme(settings.theme);
    } else {
      // 应用默认主题
      applyTheme('dark');
    }
  });
}

// 应用主题
function applyTheme(theme) {
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
}

// 切换主题
function toggleTheme() {
  chrome.storage.local.get(['settings'], (result) => {
    let currentTheme = 'light';
    if (result.settings) {
      currentTheme = result.settings.theme || 'light';
    }
    
    let newTheme;
    if (currentTheme === 'light') {
      newTheme = 'dark';
    } else if (currentTheme === 'dark') {
      newTheme = 'system';
    } else {
      newTheme = 'light';
    }
    
    // 保存新主题
    const settings = result.settings || {};
    settings.theme = newTheme;
    chrome.storage.local.set({settings: settings}, () => {
      applyTheme(newTheme);
    });
  });
}

// 打开设置页面
function openSettings() {
  chrome.windows.create({
    url: chrome.runtime.getURL('settings.html'),
    type: 'popup',
    width: 450,
    height: 450
  });
}

// 加载存储的图片数据
function loadStoredImages() {
  setStatus('正在加载图片数据...');
  
  // 获取存储的最后检测的标签页ID
  chrome.storage.local.get(['lastDetectedTab'], (result) => {
    if (result.lastDetectedTab) {
      const tabId = result.lastDetectedTab;
      // 获取对应标签页的图片数据
      chrome.storage.local.get([`images_${tabId}`], (data) => {
        if (data[`images_${tabId}`] && data[`images_${tabId}`].length > 0) {
          images = data[`images_${tabId}`];
          displayImages(images);
          setStatus(`已加载 ${images.length} 张图片`);
        } else {
          // 如果没有存储的数据，尝试检测当前标签页
          detectImages();
        }
      });
    } else {
      // 如果没有存储的标签页ID，尝试检测当前标签页
      detectImages();
    }
  });
}

// 检测图片
function detectImages() {
  setStatus('正在检测图片...');
  
  // 获取当前活动标签页
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      // 向content script发送消息，请求检测图片
      chrome.tabs.sendMessage(activeTab.id, {action: 'detectImages'}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('发送消息失败:', chrome.runtime.lastError);
          setStatus('检测失败: 无法与页面通信');
          return;
        }
        
        if (response && response.images) {
          images = response.images;
          displayImages(images);
          setStatus(`检测到 ${images.length} 张图片`);
          
          // 存储图片数据和标签页标题
          const tabTitle = activeTab.title;
          chrome.storage.local.set({
            [`images_${activeTab.id}`]: images,
            'lastDetectedTab': activeTab.id,
            'lastDetectedTabTitle': tabTitle
          });
        } else {
          setStatus('未检测到图片');
          displayImages([]);
        }
      });
    } else {
      setStatus('未找到活动标签页');
      displayImages([]);
    }
  });
}

// 应用过滤
function applyFilter() {
  const minWidth = parseInt(document.getElementById('minWidth').value) || 130;
  const minHeight = parseInt(document.getElementById('minHeight').value) || 130;
  const fileTypes = document.getElementById('fileTypes').value
    ? document.getElementById('fileTypes').value.split(',').map(type => type.trim().toLowerCase())
    : [];
  
  setStatus('正在应用过滤...');
  
  // 先尝试获取存储的最后检测的标签页ID
  chrome.storage.local.get(['lastDetectedTab'], (result) => {
    let targetTabId = null;
    
    if (result.lastDetectedTab) {
      targetTabId = result.lastDetectedTab;
      console.log('使用存储的标签页ID:', targetTabId);
    } else {
      // 如果没有存储的标签页ID，获取当前活动标签页
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs.length > 0) {
          targetTabId = tabs[0].id;
          console.log('使用当前活动标签页ID:', targetTabId);
          sendFilterRequest(targetTabId, minWidth, minHeight, fileTypes);
        } else {
          setStatus('未找到活动标签页');
          displayImages([]);
        }
      });
      return;
    }
    
    sendFilterRequest(targetTabId, minWidth, minHeight, fileTypes);
  });
}

// 发送过滤请求
function sendFilterRequest(tabId, minWidth, minHeight, fileTypes) {
  const filters = {
    minWidth: minWidth,
    minHeight: minHeight,
    fileTypes: fileTypes
  };
  
  // 向content script发送消息，请求过滤图片
  chrome.tabs.sendMessage(tabId, {action: 'filterImages', filters: filters}, (response) => {
    if (chrome.runtime.lastError) {
      console.error('发送消息失败:', chrome.runtime.lastError);
      setStatus('过滤失败: 无法与页面通信');
      return;
    }
    
    if (response && response.images) {
      images = response.images;
      displayImages(images);
      setStatus(`过滤后剩余 ${images.length} 张图片`);
      
      // 获取标签页标题并存储过滤后的图片数据
      chrome.tabs.get(tabId, (tab) => {
        const tabTitle = tab ? tab.title : 'PicSee';
        chrome.storage.local.set({
          [`images_${tabId}`]: images,
          'lastDetectedTabTitle': tabTitle
        });
      });
    } else {
      setStatus('过滤后无图片');
      displayImages([]);
    }
  });
}

// 显示图片列表
function displayImages(imageList) {
  const imageListElement = document.getElementById('imageList');
  const imageCountElement = document.getElementById('imageCount');

  // 更新图像数量显示
  imageCountElement.textContent = `${imageList.length} 张图片`;

  if (imageList.length === 0) {
    imageListElement.innerHTML = '<p style="text-align: center; color: var(--secondary-text); margin-top: 100px;">无图片</p>';
    return;
  }

  let html = '<div class="image-grid">';
  imageList.forEach((image, index) => {
    // 计算卡片的宽高比例，保持图片原始比例
    const aspectRatio = image.width / image.height || 1;
    const cardWidth = 200; // 固定卡片宽度
    const cardHeight = Math.max(150, cardWidth / aspectRatio); // 计算卡片高度
    const fileType = image.format || getFileTypeFromUrl(image.url);
    
    html += `
      <div class="image-item" style="height: ${cardHeight + 40}px;">
        <input type="checkbox" class="checkbox" id="image-${index}" data-index="${index}">
        <div class="image-index">${index + 1}</div>
        <img class="image-preview" src="${image.url}" alt="${image.alt}" style="height: ${cardHeight - 20}px;">
        <div class="image-info">
          <div class="image-type">${fileType}</div>
          <div class="image-dimensions">${image.width}x${image.height}</div>
        </div>
      </div>
    `;
  });
  html += '</div>';

  imageListElement.innerHTML = html;
  
  // 为所有图片添加点击事件监听器
  const imagePreviews = document.querySelectorAll('.image-preview');
  imagePreviews.forEach((img, index) => {
    img.addEventListener('click', () => {
      console.log('Image clicked, index:', index);
      openPreview(index);
    });
  });
  
  // 为所有复选框添加change事件监听器
  const checkboxes = document.querySelectorAll('.checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedCount);
  });
  
  console.log('Added click event listeners to', imagePreviews.length, 'images');
  console.log('Added checkbox event listeners to', checkboxes.length, 'checkboxes');
  updateSelectedCount();
}

// 更新选中的图片数量
function updateSelectedCount() {
  const selectedCount = document.querySelectorAll('.checkbox:checked').length;
  const totalCount = images.length;
  const imageCountElement = document.getElementById('imageCount');
  imageCountElement.textContent = `${totalCount} (${selectedCount} 已选)`;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 全选
function selectAll() {
  const checkboxes = document.querySelectorAll('.checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSelectedCount();
}

// 取消全选
function selectNone() {
  const checkboxes = document.querySelectorAll('.checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectedCount();
}

// 批量下载
function batchDownload(downloadType = 'individual') {
  console.log('batchDownload called with type:', downloadType);
  
  const selectedCheckboxes = document.querySelectorAll('.checkbox:checked');

  if (selectedCheckboxes.length === 0) {
    setStatus('请选择要下载的图片');
    return;
  }

  const selectedImages = Array.from(selectedCheckboxes).map(checkbox => {
    const index = parseInt(checkbox.getAttribute('data-index'));
    return images[index];
  });

  console.log('选中的图片数量:', selectedImages.length);
  console.log('选中的图片:', selectedImages);
  
  setStatus(`正在下载 ${selectedImages.length} 张图片...`);

  // 获取存储的标签页标题作为文件夹名
  chrome.storage.local.get(['lastDetectedTabTitle'], (result) => {
    const folderName = result.lastDetectedTabTitle ? result.lastDetectedTabTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') : 'PicSee';
    
    console.log('文件夹名:', folderName);
    
    if (downloadType === 'zip') {
      // 使用JSZip打包下载
      downloadImagesAsZip(selectedImages, folderName);
    } else {
      // 逐个下载
      console.log('发送下载消息到background...');
      
      chrome.runtime.sendMessage({action: 'batchDownload', images: selectedImages, downloadType: downloadType, folderName: folderName}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('发送消息失败:', chrome.runtime.lastError);
          setStatus('下载失败: ' + chrome.runtime.lastError.message);
          return;
        }
        
        console.log('收到响应:', response);
        
        if (response && response.status === 'success') {
          setStatus(`已开始${downloadType === 'zip' ? '打包' : '逐个'}下载 ${selectedImages.length} 张图片`);
        } else {
          setStatus('下载失败');
        }
      });
    }
  });
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

// 清理文件名，去除非法字符
function sanitizeFilename(filename) {
  return filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}

// 使用JSZip打包下载图片
async function downloadImagesAsZip(images, folderName) {
  const selectedCount = images.length;
  console.log('开始打包下载，图片数量:', selectedCount);
  setStatus('正在打包图片...');
  
  try {
    const zip = new JSZip();
    let successCount = 0;
    let failCount = 0;
    
    // 逐个下载图片并添加到zip
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const downloadUrl = image.downloadUrl || image.url;
      
      // 生成新的文件名：页面名称 + 索引 + 宽高 + 格式
      const cleanFolderName = sanitizeFilename(folderName);
      const indexStr = String(i + 1).padStart(3, '0');
      const format = image.format || getFileTypeFromUrl(downloadUrl);
      
      // 处理数据URL的情况，避免使用完整的base64字符串作为文件名
      let filename;
      if (downloadUrl.startsWith('data:image/')) {
        // 从数据URL中提取格式
        const match = downloadUrl.match(/data:image\/(\w+);/);
        const ext = match && match[1] ? match[1].toLowerCase() : 'png';
        filename = `${cleanFolderName}_${indexStr}_${image.width}x${image.height}.${ext}`;
      } else {
        filename = `${cleanFolderName}_${indexStr}_${image.width}x${image.height}.${format.toLowerCase()}`;
      }
      
      try {
        setStatus(`正在下载第 ${i + 1}/${images.length} 张图片...`);
        
        // 使用XMLHttpRequest获取图片数据
        const blob = await fetchImageAsBlob(downloadUrl);
        
        if (blob) {
          // 添加到zip文件
          zip.file(filename, blob);
          successCount++;
          console.log(`成功添加第 ${i + 1} 张图片:`, filename);
        } else {
          failCount++;
          console.error(`第 ${i + 1} 张图片获取失败`);
        }
      } catch (error) {
        console.error(`下载第 ${i + 1} 张图片失败:`, error);
        failCount++;
      }
    }
    
    if (successCount === 0) {
      setStatus('所有图片下载失败');
      return;
    }
    
    setStatus('正在生成ZIP文件...');
    
    // 生成zip文件
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });
    
    // 创建blob URL
    const blobUrl = URL.createObjectURL(zipBlob);
    
    // 创建下载链接：页面名称 + 勾选图片数量 + 日期
    const cleanFolderName = sanitizeFilename(folderName);
    const dateStr = formatDate(new Date());
    const zipFilename = `${cleanFolderName}_${selectedCount}张_${dateStr}.zip`;
    
    // 存储文件名供background.js使用
    chrome.storage.local.set({pendingZipFilename: zipFilename}, () => {
      // 使用chrome.downloads.download API下载
      chrome.downloads.download({
        url: blobUrl,
        filename: zipFilename,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        // 清理blob URL
        URL.revokeObjectURL(blobUrl);
        if (chrome.runtime.lastError) {
          console.error('ZIP下载失败:', chrome.runtime.lastError);
          setStatus('ZIP下载失败: ' + chrome.runtime.lastError.message);
        } else {
          console.log('ZIP下载成功，ID:', downloadId);
          setStatus(`已成功打包下载 ${successCount} 张图片${failCount > 0 ? `，失败 ${failCount} 张` : ''}`);
        }
      });
    });
    
  } catch (error) {
    console.error('打包下载失败:', error);
    setStatus('打包下载失败: ' + error.message);
  }
}

// 获取图片数据为Blob
function fetchImageAsBlob(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function() {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(new Error(`HTTP error! status: ${xhr.status}`));
      }
    };
    xhr.onerror = function() {
      reject(new Error('Network error'));
    };
    xhr.send();
  });
}

// 从URL获取文件名
function getFilenameFromUrl(url) {
  const parts = url.split('/');
  let filename = parts[parts.length - 1].split('?')[0].split('#')[0];
  
  // 处理特殊情况，如 th?id=filename.jpg
  if (filename.includes('?')) {
    filename = filename.split('?')[1];
  }
  
  // 尝试从查询参数中提取文件名
  try {
    const urlObj = new URL(url);
    // 检查常见的图片ID参数
    const idParam = urlObj.searchParams.get('id');
    if (idParam && (idParam.includes('.jpg') || idParam.includes('.png') || idParam.includes('.gif') || idParam.includes('.webp'))) {
      return idParam;
    }
  } catch (e) {
    // 忽略URL解析错误
  }
  
  return filename || `image_${Date.now()}.jpg`;
}

// 从URL获取文件类型
function getFileTypeFromUrl(url) {
  // 处理数据URL（base64编码）
  if (url.startsWith('data:image/')) {
    const match = url.match(/data:image\/(\w+);/);
    if (match && match[1]) {
      const ext = match[1].toLowerCase();
      // 常见图片类型映射
      const imageTypes = {
        'jpg': 'JPG',
        'jpeg': 'JPEG',
        'png': 'PNG',
        'gif': 'GIF',
        'webp': 'WebP',
        'bmp': 'BMP',
        'svg': 'SVG',
        'ico': 'ICO',
        'tiff': 'TIFF',
        'tif': 'TIF',
        'avif': 'AVIF',
        'apng': 'APNG'
      };
      return imageTypes[ext] || ext.toUpperCase();
    }
    return 'DATA';
  }
  
  // 先尝试从getFilenameFromUrl获取文件名
  let filename = getFilenameFromUrl(url);
  let ext = filename.split('.').pop().toLowerCase();
  
  // 清理扩展名，移除可能的参数或其他内容
  ext = ext.split('+')[0].split(';')[0].split('?')[0];
  
  // 如果没有找到扩展名，尝试从URL路径中提取
  if (!ext || ext === filename) {
    const urlWithoutParams = url.split('?')[0].split('#')[0];
    const pathParts = urlWithoutParams.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      ext = lastPart.split('.').pop().toLowerCase();
      ext = ext.split('+')[0].split(';')[0].split('?')[0];
    }
  }
  
  // 如果仍然没有找到扩展名，尝试从查询参数中提取
  if (!ext || ext === filename) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      for (const [key, value] of params.entries()) {
        if (value.includes('.')) {
          const paramExt = value.split('.').pop().toLowerCase();
          const cleanedExt = paramExt.split('+')[0].split(';')[0].split('?')[0];
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'apng'].includes(cleanedExt)) {
            ext = cleanedExt;
            break;
          }
        }
      }
    } catch (e) {
      // 忽略URL解析错误
    }
  }
  
  // 常见图片类型映射
  const imageTypes = {
    'jpg': 'JPG',
    'jpeg': 'JPEG',
    'png': 'PNG',
    'gif': 'GIF',
    'webp': 'WebP',
    'bmp': 'BMP',
    'svg': 'SVG',
    'ico': 'ICO',
    'tiff': 'TIFF',
    'tif': 'TIF',
    'avif': 'AVIF',
    'apng': 'APNG'
  };
  
  return imageTypes[ext] || ext.toUpperCase();
}

// 打开图片预览
function openPreview(index) {
  console.log('openPreview called with index:', index);
  console.log('images array length:', images.length);
  
  if (!images || images.length === 0) {
    console.error('Images array is empty');
    return;
  }
  
  if (index < 0 || index >= images.length) {
    console.error('Invalid index:', index);
    return;
  }
  
  currentPreviewIndex = index;
  scale = 1;
  const image = images[index];
  console.log('Image to preview:', image);
  
  const previewImage = document.getElementById('previewImage');
  const imageInfo = document.getElementById('imageInfo');
  const modal = document.getElementById('imagePreviewModal');
  
  console.log('Preview image element:', previewImage);
  console.log('Image info element:', imageInfo);
  console.log('Modal element:', modal);
  
  // 显示主页面模糊效果
  document.querySelector('.container').classList.add('container-blur');
  console.log('Container blur class added');
  
  // 设置预览图片
  previewImage.src = image.url;
  imageInfo.textContent = `${index + 1}/${images.length} | ${image.width}x${image.height}`;
  console.log('Preview image set');
  
  // 生成缩略图docker栏
  generateThumbnails(index);
  console.log('Thumbnails generated');
  
  // 显示预览模态框
  modal.style.display = 'block';
  console.log('Modal displayed');
  
  updateImageScale();
  console.log('Image scale updated');
}

// 生成缩略图docker栏
function generateThumbnails(activeIndex) {
  const docker = document.getElementById('thumbnailDocker');
  docker.innerHTML = '';
  
  images.forEach((image, index) => {
    const thumbnailItem = document.createElement('div');
    thumbnailItem.className = `thumbnail-item ${index === activeIndex ? 'active' : ''}`;
    thumbnailItem.onclick = () => openPreview(index);
    
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.alt;
    
    thumbnailItem.appendChild(img);
    docker.appendChild(thumbnailItem);
  });
}

// 关闭图片预览
function closePreview() {
  // 移除主页面模糊效果
  document.querySelector('.container').classList.remove('container-blur');
  document.getElementById('imagePreviewModal').style.display = 'none';
}

// 显示上一张图片
function showPrevImage() {
  currentPreviewIndex = (currentPreviewIndex - 1 + images.length) % images.length;
  openPreview(currentPreviewIndex);
}

// 显示下一张图片
function showNextImage() {
  currentPreviewIndex = (currentPreviewIndex + 1) % images.length;
  openPreview(currentPreviewIndex);
}

// 切换缩放
function toggleZoom() {
  if (scale === 1) {
    scale = 2;
  } else {
    scale = 1;
  }
  updateImageScale();
}

// 更新图片缩放
function updateImageScale() {
  const previewImage = document.getElementById('previewImage');
  previewImage.style.transform = `scale(${scale})`;
  previewImage.style.cursor = scale > 1 ? 'zoom-out' : 'zoom-in';
}

// 设置状态信息
function setStatus(message) {
  document.getElementById('status').textContent = message;
}

// 初始化
init();