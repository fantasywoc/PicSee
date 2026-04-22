// 图片批量下载器 - 内容脚本

// 检测网页中的图片
async function detectImages() {
  const images = [];
  const imageUrls = new Set();

  // 获取所有img元素
  const imgElements = document.querySelectorAll('img');
  for (const img of imgElements) {
    const url = getImageUrl(img);
    if (url && !imageUrls.has(url)) {
      imageUrls.add(url);
      // 尝试获取实际宽高
      const dimensions = await getImageDimensions(url);
      const image = {
        url: url,
        downloadUrl: url,
        width: dimensions.width || img.width || getWidthFromUrl(url),
        height: dimensions.height || img.height || getHeightFromUrl(url),
        alt: img.alt || '',
        filename: getFilenameFromUrl(url),
        format: getFileTypeFromUrl(url)
      };
      images.push(image);
      // 实时发送检测到的图片
      chrome.runtime.sendMessage({ action: 'imageDetected', image: image });
    }
  }

  // 获取背景图片
  const elements = document.querySelectorAll('*');
  for (const element of elements) {
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    if (backgroundImage && backgroundImage !== 'none') {
      const urlMatches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/g);
      if (urlMatches) {
        for (const match of urlMatches) {
          const url = match.replace(/url\(['"]?|['"]?\)/g, '');
          if (url && !imageUrls.has(url)) {
            imageUrls.add(url);
            // 尝试获取实际宽高
            const dimensions = await getImageDimensions(url);
            const image = {
              url: url,
              downloadUrl: url,
              width: dimensions.width || getWidthFromUrl(url),
              height: dimensions.height || getHeightFromUrl(url),
              alt: 'background-image',
              filename: getFilenameFromUrl(url),
              format: getFileTypeFromUrl(url)
            };
            images.push(image);
            // 实时发送检测到的图片
            chrome.runtime.sendMessage({ action: 'imageDetected', image: image });
          }
        }
      }
    }
  }

  // 获取href属性中的图片链接
  const hrefElements = document.querySelectorAll('[href]');
  for (const element of hrefElements) {
    const href = element.getAttribute('href');
    if (href && isImageUrl(href) && !imageUrls.has(href)) {
      imageUrls.add(href);
      // 尝试获取实际宽高
      const dimensions = await getImageDimensions(href);
      const image = {
        url: href,
        downloadUrl: href,
        width: dimensions.width || getWidthFromUrl(href),
        height: dimensions.height || getHeightFromUrl(href),
        alt: element.textContent || 'href-image',
        filename: getFilenameFromUrl(href),
        format: getFileTypeFromUrl(href)
      };
      images.push(image);
      // 实时发送检测到的图片
      chrome.runtime.sendMessage({ action: 'imageDetected', image: image });
    }
  }

  // 获取CSS中的图片
  const styleSheets = document.styleSheets;
  for (const styleSheet of styleSheets) {
    try {
      const rules = styleSheet.cssRules || styleSheet.rules;
      for (const rule of rules) {
        if (rule.style && rule.style.backgroundImage) {
          const backgroundImage = rule.style.backgroundImage;
          const urlMatches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/g);
          if (urlMatches) {
            for (const match of urlMatches) {
              const url = match.replace(/url\(['"]?|['"]?\)/g, '');
              if (url && !imageUrls.has(url)) {
                imageUrls.add(url);
                // 尝试获取实际宽高
                const dimensions = await getImageDimensions(url);
                const image = {
                  url: url,
                  downloadUrl: url,
                  width: dimensions.width || getWidthFromUrl(url),
                  height: dimensions.height || getHeightFromUrl(url),
                  alt: 'css-image',
                  filename: getFilenameFromUrl(url),
                  format: getFileTypeFromUrl(url)
                };
                images.push(image);
                // 实时发送检测到的图片
                chrome.runtime.sendMessage({ action: 'imageDetected', image: image });
              }
            }
          }
        }
      }
    } catch (e) {
      // 跨域样式表访问会抛出异常，忽略
    }
  }

  // 发送检测完成的消息
  chrome.runtime.sendMessage({ action: 'imageDetectionComplete', total: images.length });
  return images;
}

// 获取图片实际宽高
function getImageDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      resolve({ width: this.width, height: this.height });
    };
    img.onerror = function() {
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

// 从URL中获取宽度
function getWidthFromUrl(url) {
  // 匹配常见的宽度参数格式
  const widthMatch = url.match(/[?&](w|width|wdt|size|widthpx)=([0-9]+)/i);
  if (widthMatch) {
    return parseInt(widthMatch[2]);
  }
  
  // 尝试从URL路径中提取尺寸信息（如 /w1920/ 这样的格式）
  const pathWidthMatch = url.match(/\/(w|width)(\d+)/i);
  if (pathWidthMatch) {
    return parseInt(pathWidthMatch[2]);
  }
  
  return 0;
}

// 从URL中获取高度
function getHeightFromUrl(url) {
  // 匹配常见的高度参数格式
  const heightMatch = url.match(/[?&](h|height|hgt|heightpx)=([0-9]+)/i);
  if (heightMatch) {
    return parseInt(heightMatch[2]);
  }
  
  // 尝试从URL路径中提取尺寸信息（如 /h1080/ 这样的格式）
  const pathHeightMatch = url.match(/\/(h|height)(\d+)/i);
  if (pathHeightMatch) {
    return parseInt(pathHeightMatch[2]);
  }
  
  return 0;
}

// 检查URL是否为图片
function isImageUrl(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif'];
  const lowerUrl = url.toLowerCase();
  
  // 检查文件扩展名（考虑查询参数和哈希值）
  const urlWithoutParams = lowerUrl.split('?')[0].split('#')[0];
  if (imageExtensions.some(ext => urlWithoutParams.endsWith(ext))) {
    return true;
  }
  
  // 检查URL路径中是否包含图片相关关键词
  const imageKeywords = ['image', 'img', 'photo', 'picture', 'pic', 'thumbnail', 'thumb'];
  if (imageKeywords.some(keyword => lowerUrl.includes('/' + keyword + '/'))) {
    return true;
  }
  
  // 检查URL参数中是否包含图片相关关键词
  if (lowerUrl.includes('?') && imageKeywords.some(keyword => lowerUrl.includes(keyword + '='))) {
    return true;
  }
  
  // 检查查询参数中是否包含图片文件名（如 id=filename.jpg）
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    for (const [key, value] of params.entries()) {
      if (imageExtensions.some(ext => value.toLowerCase().includes(ext))) {
        return true;
      }
    }
  } catch (e) {
    // 忽略URL解析错误
  }
  
  return false;
}

// 获取图片的完整URL
function getImageUrl(img) {
  if (img.src) {
    return img.src;
  }
  return null;
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

// 从URL获取文件类型/格式
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

// 过滤图片
async function filterImages(images, filters) {
  return images.filter(image => {
    // 过滤最小尺寸
    if (filters.minWidth && image.width < filters.minWidth) return false;
    if (filters.minHeight && image.height < filters.minHeight) return false;

    // 过滤文件类型
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      const ext = image.url.split('.').pop().toLowerCase();
      if (!filters.fileTypes.includes(ext)) return false;
    }

    return true;
  });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'detectImages') {
    detectImages().then(images => {
      sendResponse({ images: images });
    });
    return true; // 表示会异步发送响应
  } else if (message.action === 'filterImages') {
    detectImages().then(images => {
      filterImages(images, message.filters).then(filteredImages => {
        sendResponse({ images: filteredImages });
      });
    });
    return true; // 表示会异步发送响应
  } else if (message.action === 'toggleFullscreen') {
    // 处理全屏请求
    toggleFullscreen();
    sendResponse({ status: 'success' });
  }
});

// 切换全屏
function toggleFullscreen() {
  const element = document.documentElement;

  if (!document.fullscreenElement) {
    // 尝试各种浏览器的全屏API
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}