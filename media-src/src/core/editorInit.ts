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
import { toolbar } from '../features/toolbar/toolbarConfig';
import { createUploadConfig } from '../features/upload/uploadHandler';
import { sendMessageToVSCode } from '../utils/common';
import { initImageResize } from '../features/image/imageResize';

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
      toolbarConfig: { 
        pin: true,
        hide: message.options?.showToolbar === false
      },
      outline: {
        enable: message.options?.showOutlineByDefault ?? false,
        position: message.options?.outlinePosition ?? 'left'
      },
      ...defaultOptions,
      after() {
        // 初始化后的设置
        setupThemeHandler();
        setupToolbarClickHandler();
        setupTableFeatures();
        setupPanelHoverEffects();
        
        // 初始化图片调整大小功能
        setTimeout(() => {
          initImageResize();
        }, 100);
        
        // 调试工具栏设置
        console.log('Toolbar config after init:', {
          showToolbar: message.options?.showToolbar,
          hide: window.vditor.vditor.options.toolbarConfig.hide
        });
        
        // 确保工具栏状态与设置一致
        const toolbar = document.querySelector('.vditor-toolbar');
        if (toolbar && message.options?.showToolbar === false) {
          toolbar.classList.add('vditor-toolbar--hide');
          toolbar.setAttribute('style', 'display: none !important');
        }
      },
      input() {
        // 处理输入事件，添加节流
        if (inputTimer) {
          clearTimeout(inputTimer);
        }
        
        inputTimer = setTimeout(() => {
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
