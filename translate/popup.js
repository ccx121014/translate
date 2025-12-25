// 弹出窗口脚本，处理用户界面交互

// 页面加载完成后初始化
 document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const enabledToggle = document.getElementById('enabled');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const translateServiceSelect = document.getElementById('translateService');
  const statusDiv = document.getElementById('status');

  // 加载当前设置
  chrome.storage.sync.get(['isEnabled', 'targetLanguage', 'sourceLanguage', 'translateService'], (settings) => {
    enabledToggle.checked = settings.isEnabled;
    sourceLangSelect.value = settings.sourceLanguage;
    targetLangSelect.value = settings.targetLanguage;
    translateServiceSelect.value = settings.translateService || 'google';
    
    // 更新状态显示
    updateStatus(settings.isEnabled);
  });

  // 监听启用开关变化
  enabledToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    // 保存设置
    chrome.storage.sync.set({ isEnabled: isEnabled }, () => {
      // 更新状态显示
      updateStatus(isEnabled);
      
      // 向当前标签页发送消息
      sendMessageToActiveTab({ 
        action: 'toggleTranslation', 
        isEnabled: isEnabled 
      });
    });
  });

  // 监听源语言变化
  sourceLangSelect.addEventListener('change', (e) => {
    const sourceLanguage = e.target.value;
    
    // 保存设置
    chrome.storage.sync.set({ sourceLanguage: sourceLanguage }, () => {
      // 更新翻译
      updateTranslation();
    });
  });

  // 监听目标语言变化
  targetLangSelect.addEventListener('change', (e) => {
    const targetLanguage = e.target.value;
    
    // 保存设置
    chrome.storage.sync.set({ targetLanguage: targetLanguage }, () => {
      // 更新翻译
      updateTranslation();
    });
  });

  // 监听翻译服务变化
  translateServiceSelect.addEventListener('change', (e) => {
    const translateService = e.target.value;
    
    // 保存设置
    chrome.storage.sync.set({ translateService: translateService }, () => {
      // 更新翻译
      updateTranslation();
    });
  });

  // 监听排除网站按钮点击
  document.getElementById('excludeSite').addEventListener('click', () => {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        const domain = new URL(currentUrl).hostname;
        
        // 获取当前排除的网站列表
        chrome.storage.sync.get(['excludedSites'], (settings) => {
          const excludedSites = settings.excludedSites || [];
          
          // 检查是否已经排除
          if (!excludedSites.includes(domain)) {
            excludedSites.push(domain);
            
            // 保存更新后的列表
            chrome.storage.sync.set({ excludedSites: excludedSites }, () => {
              statusDiv.textContent = `已排除网站: ${domain}`;
              statusDiv.style.backgroundColor = '#d4edda';
              statusDiv.style.color = '#155724';
              
              // 重新加载当前页面
              chrome.tabs.reload(tabs[0].id);
            });
          } else {
            statusDiv.textContent = '该网站已在排除列表中';
            statusDiv.style.backgroundColor = '#f8d7da';
            statusDiv.style.color = '#721c24';
          }
        });
      }
    });
  });

  // 更新状态显示
  function updateStatus(isEnabled) {
    if (isEnabled) {
      statusDiv.textContent = '翻译已启用';
      statusDiv.style.backgroundColor = '#d4edda';
      statusDiv.style.color = '#155724';
    } else {
      statusDiv.textContent = '翻译已禁用';
      statusDiv.style.backgroundColor = '#f8d7da';
      statusDiv.style.color = '#721c24';
    }
  }

  // 更新翻译
  function updateTranslation() {
    // 获取当前设置
    chrome.storage.sync.get(['isEnabled', 'targetLanguage', 'sourceLanguage', 'translateService'], (settings) => {
      if (settings.isEnabled) {
        // 向当前标签页发送消息，包含完整的语言设置和翻译服务
        sendMessageToActiveTab({ 
          action: 'toggleTranslation', 
          isEnabled: true,
          sourceLanguage: settings.sourceLanguage,
          targetLanguage: settings.targetLanguage,
          translateService: settings.translateService || 'google'
        });
      }
    });
  }

  // 向当前活动标签页发送消息
  function sendMessageToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      }
    });
  }
});