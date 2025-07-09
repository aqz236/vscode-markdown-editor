/**
 * 主应用入口
 */
import './preload';
import './styles/main.css'

import { fixCut } from './utils/common';
import { setupLinkHandler } from './utils/linkHandler';
import { initVditor } from './core/editorInit';
import { handleUploadedFiles } from './features/upload/uploadHandler';
import { sendMessageToVSCode, infoLog, errorLog, debugLog } from './utils/common';
import { UpdateMessage } from './types';

/**
 * 初始化应用
 */
function initializeApp(): void {
  infoLog('Initializing markdown editor webview application');
  
  // 设置全局错误处理
  window.addEventListener('error', (event) => {
    errorLog('Uncaught error', { 
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.toString()
    });
  });

  // 设置链接点击处理
  setupLinkHandler();
  
  // 修复剪切功能
  fixCut();
  
  debugLog('Webview initialized, waiting for messages from VSCode');
  
  // 处理消息事件
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    debugLog('Received message from extension', { command: message.command, type: message.type });
    
    switch (message.command) {
      case 'update': {
        if (message.type === 'init') {
          infoLog('Initializing editor', { 
            contentLength: message.content?.length,
            hasOptions: !!message.options,
            theme: message.theme
          });
          
          try {
            // 初始化编辑器
            initVditor(message as UpdateMessage);
          } catch (error) {
            errorLog('Error initializing editor', { error: error?.toString() });
            // 重置为简单配置
            initVditor({
              command: 'update',
              type: 'init',
              content: message.content,
              options: {}
            });
          }
        } else {
          // 更新内容
          debugLog('Updating editor content', { contentLength: message.content?.length });
          if (window.vditor) {
            window.vditor.setValue(message.content);
          }
        }
        break;
      }
      
      case 'uploaded': {
        // 处理上传成功后的文件
        if (message.files && Array.isArray(message.files)) {
          handleUploadedFiles(message.files);
        }
        break;
      }
      
      default:
        // 忽略其他消息
        break;
    }
  });
  
  // 通知VS Code扩展准备就绪
  sendMessageToVSCode({ command: 'ready' });
}

// 启动应用
initializeApp();
