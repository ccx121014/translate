// 后台脚本，处理插件的核心逻辑

// 监听插件安装事件
chrome.runtime.onInstalled.addListener(() => {
  // 设置默认选项
  chrome.storage.sync.set({
    isEnabled: true,
    targetLanguage: 'zh',
    sourceLanguage: 'auto',
    excludedSites: []
  });
  
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译选中的文本',
    contexts: ['selection']
  });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection') {
    const selectedText = info.selectionText;
    
    // 获取当前语言设置
    chrome.storage.sync.get(['sourceLanguage', 'targetLanguage'], (settings) => {
      // 翻译选中的文本
      translateText(selectedText, settings.sourceLanguage, settings.targetLanguage)
        .then(translation => {
          // 通过消息传递显示翻译结果
          chrome.tabs.sendMessage(tab.id, {
            action: 'show-translation',
            originalText: selectedText,
            translation: translation
          });
        })
        .catch(error => {
          console.error('翻译失败:', error);
        });
    });
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    // 调用翻译API
    translateText(message.text, message.sourceLang, message.targetLang)
      .then(translation => {
        sendResponse({ success: true, translation: translation });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    // 保持消息通道开放
    return true;
  }
});

// 翻译函数，使用Google Translate API
async function translateText(text, sourceLang, targetLang, retryCount = 0) {
  try {
    // 检查文本长度
    if (!text || text.length === 0) {
      return text;
    }
    
    // 限制单次翻译的文本长度
    const maxLength = 5000;
    if (text.length > maxLength) {
      // 长文本分段翻译
      const segments = [];
      for (let i = 0; i < text.length; i += maxLength) {
        segments.push(text.substring(i, i + maxLength));
      }
      
      const translations = await Promise.all(
        segments.map(segment => translateText(segment, sourceLang, targetLang))
      );
      
      return translations.join('');
    }
    
    // 调用翻译API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // 重试机制
      if (retryCount < 2 && response.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return translateText(text, sourceLang, targetLang, retryCount + 1);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data[0][0][0];
  } catch (error) {
    console.error('翻译失败:', error);
    
    // 重试逻辑
    if (retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return translateText(text, sourceLang, targetLang, retryCount + 1);
    }
    
    throw new Error('翻译服务不可用，请稍后重试');
  }
}