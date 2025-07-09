/**
 * 编辑器初始化模块
 */
import { merge } from 'lodash';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { EditorOptions, UpdateMessage } from '../types';
import { setupThemeHandler, setupToolbarClickHandler } from './editorConfig';
import { setupPanelHoverEffects } from '../components/panelHover';
import { setupTableFeatures } from '../features/table/tableEditor';
import { setupResizableOutline } from '../features/outline/resizableOutline';
import { toolbar } from '../features/toolbar/toolbarConfig';
import { createUploadConfig } from '../features/upload/uploadHandler';
import { sendMessageToVSCode, infoLog, debugLog, warnLog, errorLog } from '../utils/common';

// 输入节流定时器
let inputTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 初始化Vditor编辑器
 * @param message 初始化消息
 */
export function initVditor(message: UpdateMessage): void {
  console.log('Initializing Vditor with:', message);
  
  // 清除旧的输入定时器
  if (inputTimer) {
    clearTimeout(inputTimer);
    inputTimer = null;
  }
  
  // 准备默认选项
  let defaultOptions: any = {};
  
  // 处理暗色主题
  if (message.theme === 'dark') {
    defaultOptions = merge(defaultOptions, {
      theme: 'dark',
      preview: {
        theme: {
          current: 'dark',
        },
      }
    });
  }
  
  // 合并用户选项和默认选项
  defaultOptions = merge(defaultOptions, message.options, {
    preview: {
      math: {
        inlineDigit: true,
      }
    }
  });
  
  // 处理主题颜色样式
  if (message.options && message.options.useVscodeThemeColor) {
    document.body.setAttribute('data-use-vscode-theme-color', '1');
  } else {
    document.body.setAttribute('data-use-vscode-theme-color', '0');
  }
  
  // 如果已有编辑器实例，先销毁
  if (window.vditor) {
    window.vditor.destroy();
    window.vditor = null;
  }
  
  // 创建新的编辑器实例
  try {
    window.vditor = new Vditor('app', {
      width: '100%',
      height: '100%',
      minHeight: '100%',
      lang: navigator.language.replace('-', '_'),
      value: message.content,
      mode: 'ir',
      cache: { enable: false },
      toolbar,
      toolbarConfig: { pin: true },
      outline: {
        enable: message.options?.showOutlineByDefault ?? false,
        position: message.options?.outlinePosition ?? 'left'
      },
      ...defaultOptions,
      after() {
        // 初始化后的设置
        infoLog('Vditor initialization completed, setting up features');
        setupThemeHandler();
        setupToolbarClickHandler();
        setupTableFeatures();
        setupPanelHoverEffects();
        
        // 设置大纲
        infoLog('Setting up outline', {
          showOutlineByDefault: message.options?.showOutlineByDefault,
          outlinePosition: message.options?.outlinePosition,
          outlineWidth: message.options?.outlineWidth
        });
        setupResizableOutline(message.options);
        
        // 记录编辑器模式和大纲状态
        setTimeout(() => {
          infoLog('Editor status after initialization', { 
            hasOutline: !!document.querySelector('.vditor-outline'),
            editorMode: window.vditor?.currentMode,
            outlineVisible: !!document.querySelector('.vditor-outline:not([style*="display: none"])')
          });
        }, 200);
      },
      input() {
        // 处理输入事件，添加节流
        if (inputTimer) {
          clearTimeout(inputTimer);
        }
        
        inputTimer = setTimeout(() => {
          // 记录输入变更和大纲状态
          const outlineElement = document.querySelector('.vditor-outline');
          const headings = outlineElement ? outlineElement.querySelectorAll('a[data-target-id]') : [];
          
          debugLog('Content changed, checking outline status', { 
            hasOutline: !!outlineElement,
            headingsCount: headings.length,
            outlineVisible: outlineElement ? 
              window.getComputedStyle(outlineElement).display !== 'none' : false,
            contentLength: window.vditor.getValue().length,
            headingElements: Array.from(window.vditor.vditor.wysiwyg?.element?.querySelectorAll('h1, h2, h3, h4, h5, h6') || []).length
          });
          
          // 检查大纲是否存在并更新
          if (outlineElement) {
            infoLog('大纲更新状态', {
              outlineHeadingCount: headings.length,
              documentHeadingCount: Array.from(window.vditor.vditor.wysiwyg?.element?.querySelectorAll('h1, h2, h3, h4, h5, h6') || []).length,
              // 获取大纲中的标题文本列表（限制数量）
              outlineHeadings: Array.from(headings).slice(0, 3).map(h => h.textContent)
            });
          } else {
            warnLog('No outline element found after content change');
          }
          
          sendMessageToVSCode({
            command: 'edit',
            content: window.vditor.getValue()
          });
        }, 100);
      },
      upload: createUploadConfig()
    });
    
    console.log('Vditor initialized successfully');
  } catch (error) {
    // 出错时重置为简单配置
    console.error('Error initializing Vditor:', error);
    
    window.vditor = new Vditor('app', {
      width: '100%',
      height: '100%',
      value: message.content,
      mode: 'ir',
      cache: { enable: false },
      after: () => console.log('Fallback Vditor initialized'),
    });
  }
}
