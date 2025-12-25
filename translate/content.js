// 内容脚本，负责在网页上执行翻译功能

let isTranslating = false;
let translatedElements = new Set();
let translationCache = new Map();
let currentSourceLang = 'auto';
let currentTargetLang = 'zh';

// 等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 监听页面变化
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          translateElement(node);
        }
      });
    }
  });
});

function init() {
  // 获取当前域名
  const currentDomain = window.location.hostname;
  
  // 获取翻译设置
  chrome.storage.sync.get(['isEnabled', 'targetLanguage', 'sourceLanguage', 'excludedSites'], (settings) => {
    const excludedSites = settings.excludedSites || [];
    
    // 检查当前网站是否在排除列表中
    if (settings.isEnabled && !excludedSites.includes(currentDomain)) {
      startTranslation(settings.sourceLanguage, settings.targetLanguage);
    }
  });

  // 监听来自后台的消息
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggleTranslation') {
      if (message.isEnabled) {
        startTranslation(message.sourceLanguage, message.targetLanguage);
      } else {
        stopTranslation();
      }
    } else if (message.action === 'show-translation') {
      // 显示翻译结果弹出窗口
      showTranslationPopup(message.originalText, message.translation);
    }
  });
}

function startTranslation(sourceLang, targetLang) {
  if (isTranslating && sourceLang === currentSourceLang && targetLang === currentTargetLang) {
    return;
  }
  
  isTranslating = true;
  currentSourceLang = sourceLang;
  currentTargetLang = targetLang;
  
  // 清除之前的翻译
  stopTranslation();
  
  // 翻译整个页面
  translateElement(document.body);
  
  // 开始监听页面变化
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function stopTranslation() {
  isTranslating = false;
  observer.disconnect();
  
  // 恢复原始内容
  translatedElements.forEach(element => {
    if (element.dataset.originalText) {
      element.textContent = element.dataset.originalText;
      delete element.dataset.originalText;
    }
  });
  
  translatedElements.clear();
}

function translateElement(element) {
  if (!isTranslating || translatedElements.has(element)) return;
  
  // 跳过不需要翻译的元素
  if (element.tagName.match(/^(SCRIPT|STYLE)$/i) || 
      element.classList.contains('notranslate') || 
      element.closest('.notranslate')) {
    return;
  }
  
  // 移除可见性检查，因为即使元素当前不可见，也可能在用户滚动后变得可见
  
  // 翻译文本节点
  if (element.nodeType === Node.TEXT_NODE && element.textContent.trim()) {
    translateText(element.textContent).then(translation => {
      element.textContent = translation;
    });
    return;
  }
  
  // 递归处理子元素
  const childNodes = element.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i];
    
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
      const originalText = child.textContent;
      
      // 生成缓存键
      const cacheKey = `${currentSourceLang}-${currentTargetLang}-${originalText}`;
      
      // 检查缓存
      if (translationCache.has(cacheKey)) {
        child.textContent = translationCache.get(cacheKey);
        translatedElements.add(element);
        continue;
      }
      
      // 保存原始文本
      if (!element.dataset.originalText) {
        element.dataset.originalText = element.textContent;
      }
      
      // 翻译文本
      translateText(originalText).then(translation => {
        child.textContent = translation;
        translatedElements.add(element);
        // 更新缓存
        translationCache.set(cacheKey, translation);
      });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      translateElement(child);
    }
  }
}

function translateText(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'translate', text: text, sourceLang: currentSourceLang, targetLang: currentTargetLang },
      (response) => {
        if (response.success) {
          resolve(response.translation);
        } else {
          console.error('翻译失败:', response.error);
          // 翻译失败时返回原始文本
          resolve(text);
        }
      }
    );
  });
}

// 显示翻译结果弹出窗口
function showTranslationPopup(originalText, translation) {
  // 移除已存在的弹出窗口
  const existingPopup = document.getElementById('translate-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // 创建弹出窗口
  const popup = document.createElement('div');
  popup.id = 'translate-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 15px;
    max-width: 400px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 999999;
    font-family: Arial, sans-serif;
  `;
  
  // 添加原始文本
  const originalTitle = document.createElement('div');
  originalTitle.style.cssText = `
    font-weight: bold;
    margin-bottom: 5px;
    font-size: 14px;
    color: #666;
  `;
  originalTitle.textContent = '原文:';
  popup.appendChild(originalTitle);
  
  const originalContent = document.createElement('div');
  originalContent.style.cssText = `
    margin-bottom: 10px;
    font-size: 14px;
    padding: 5px;
    background-color: #f5f5f5;
    border-radius: 4px;
  `;
  originalContent.textContent = originalText;
  popup.appendChild(originalContent);
  
  // 添加翻译结果
  const translationTitle = document.createElement('div');
  translationTitle.style.cssText = `
    font-weight: bold;
    margin-bottom: 5px;
    font-size: 14px;
    color: #666;
  `;
  translationTitle.textContent = '译文:';
  popup.appendChild(translationTitle);
  
  const translationContent = document.createElement('div');
  translationContent.style.cssText = `
    font-size: 14px;
    padding: 5px;
    background-color: #e8f5e9;
    border-radius: 4px;
  `;
  translationContent.textContent = translation;
  popup.appendChild(translationContent);
  
  // 添加关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    margin-top: 10px;
    padding: 5px 15px;
    background-color: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    float: right;
  `;
  closeButton.onclick = () => {
    popup.remove();
  };
  popup.appendChild(closeButton);
  
  // 添加到页面
  document.body.appendChild(popup);
  
  // 点击页面其他地方关闭弹出窗口
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
      }
    });
  }, 100);
}