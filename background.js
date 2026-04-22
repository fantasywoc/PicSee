// 看看图 (PicSee) - 后台脚本

// 监听下载文件名确定事件
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // 检查是否是zip文件下载
  if (downloadItem.mime === 'application/zip' || downloadItem.filename.endsWith('.zip')) {
    // 从storage中获取预设的文件名
    chrome.storage.local.get(['pendingZipFilename'], (result) => {
      if (result.pendingZipFilename) {
        console.log('使用预设的ZIP文件名:', result.pendingZipFilename);
        suggest({filename: result.pendingZipFilename, conflictAction: 'uniquify'});
        // 清除预设文件名
        chrome.storage.local.remove(['pendingZipFilename']);
      } else {
        suggest({conflictAction: 'uniquify'});
      }
    });
    return true; // 异步响应
  }
  suggest({conflictAction: 'uniquify'});
});

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadImage') {
    downloadImage(message.url, message.filename);
    sendResponse({ status: 'success' });
  } else if (message.action === 'batchDownload') {
    batchDownload(message.images, message.downloadType, message.folderName);
    sendResponse({ status: 'success' });
  } else if (message.action === 'openImageDownloaderTab') {
    openImageDownloaderTab();
    sendResponse({ status: 'success' });
  }
});

// 下载单个图片
function downloadImage(url, filename, folderName, index, width, height, format) {
  console.log('开始下载图片:', url, filename, folderName);
  
  // 确保文件夹存在
  const folder = folderName || 'PicSee';
  let cleanFilename;
  
  if (index !== undefined && width !== undefined && height !== undefined && format !== undefined) {
    // 生成新的文件名：页面名称 + 索引 + 宽高 + 格式
    const cleanFolderName = folder.replace(/[<>:"/\\|?*]/g, '_');
    const indexStr = String(index + 1).padStart(3, '0');
    cleanFilename = `${cleanFolderName}_${indexStr}_${width}x${height}.${format.toLowerCase()}`;
  } else {
    // 使用默认文件名
    cleanFilename = filename || getFilenameFromUrl(url);
    // 清理文件名中的非法字符
    cleanFilename = cleanFilename.replace(/[<>:"/\\|?*]/g, '_');
  }
  
  const fullFilename = folder + '/' + cleanFilename;
  
  console.log('完整文件名:', fullFilename);
  
  chrome.downloads.download({
    url: url,
    filename: fullFilename,
    saveAs: false,
    conflictAction: 'uniquify'
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('下载失败:', chrome.runtime.lastError);
      console.error('失败的URL:', url);
      console.error('失败的文件名:', fullFilename);
    } else {
      console.log('下载成功，ID:', downloadId);
    }
  });
}

// 批量下载图片
function batchDownload(images, downloadType = 'individual', folderName = 'PicSee') {
  console.log('批量下载开始:', images.length, '张图片, 类型:', downloadType, '文件夹:', folderName);
  
  if (!images || images.length === 0) {
    console.error('没有图片需要下载');
    return;
  }
  
  if (downloadType === 'zip') {
    // 打包下载逻辑
    console.log('开始打包下载...');
    downloadImagesAsZip(images, folderName);
  } else {
    // 逐个下载
    downloadImagesIndividually(images, folderName);
  }
}

// 打包下载图片为zip文件
function downloadImagesAsZip(images, folderName = 'PicSee') {
  // 由于Chrome扩展的限制，我们需要使用一种方法来打包下载
  // 这里我们使用逐个下载，但确保它们下载到同一个文件夹
  console.log('打包下载功能正在开发中，暂时使用逐个下载到同一文件夹');
  downloadImagesIndividually(images, folderName);
}

// 逐个下载图片
function downloadImagesIndividually(images, folderName) {
  console.log('开始逐个下载图片，总数:', images.length);
  
  images.forEach((image, index) => {
    const downloadUrl = image.downloadUrl || image.url;
    console.log(`准备下载第 ${index + 1} 张图片:`, downloadUrl);
    
    setTimeout(() => {
      downloadImage(downloadUrl, image.filename, folderName, index, image.width, image.height, image.format);
    }, index * 500); // 间隔500ms避免并发下载限制
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

// 在新标签页打开图片下载器
function openImageDownloaderTab() {
  // 直接打开imagepage.html文件
  chrome.tabs.create({url: chrome.runtime.getURL('imagepage.html')});
}

// 创建右键菜单
chrome.contextMenus.create({
  id: 'downloadImage',
  title: '下载此图片',
  contexts: ['image']
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'downloadImage') {
    downloadImage(info.srcUrl);
  }
});