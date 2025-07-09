/**
 * 大纲功能模块
 * 实现可调整大小的大纲面板
 */
import { EditorOptions } from '../../types';
import { sendMessageToVSCode, debugLog, infoLog, warnLog, errorLog } from '../../utils/common';

/**
 * 设置可调整大小的大纲面板
 * @param options 编辑器选项
 */
export function setupResizableOutline(options?: EditorOptions): void {
  infoLog('Setting up resizable outline', options);
  
  if (!options) {
    warnLog('No options provided for outline setup');
    return;
  }
  
  // 获取配置选项
  const enableResize = options.enableOutlineResize !== false;
  const defaultWidth = options.outlineWidth || 200;
  const position = options.outlinePosition || 'left';
  
  debugLog('Outline configuration', { 
    enableResize, 
    defaultWidth, 
    position, 
    showOutlineByDefault: options.showOutlineByDefault 
  });
  
  // 等待大纲元素加载
  setTimeout(() => {
    const outline = document.querySelector('.vditor-outline') as HTMLElement;
    if (!outline) {
      errorLog('Outline element not found in DOM');
      return;
    }
    
    infoLog('Outline element found, applying styles');
    
    // 设置初始宽度和样式
    outline.style.width = `${defaultWidth}px`;
    outline.style.minWidth = '150px';
    outline.style.maxWidth = '500px';
    outline.style.position = 'relative';
    
    if (!enableResize) {
      debugLog('Outline resize disabled');
      return;
    }
    
    // 创建调整大小的手柄
    const resizeHandle = createResizeHandle(position);
    outline.appendChild(resizeHandle);
    debugLog('Resize handle added to outline');
    
    // 设置拖拽调整大小的功能
    setupResizeDragHandlers(outline, resizeHandle, position, options);
    debugLog('Resize drag handlers configured');
    
    // 监听大纲内容变化
    setupOutlineContentObserver(outline);
    
  }, 100);
}

/**
 * 创建调整大小的手柄元素
 * @param position 大纲位置('left'或'right')
 * @returns 调整大小的手柄元素
 */
function createResizeHandle(position: string): HTMLDivElement {
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'outline-resize-handle';
  
  // 设置手柄样式
  resizeHandle.style.cssText = `
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: transparent;
    cursor: col-resize;
    z-index: 1000;
    transition: background-color 0.2s ease;
    ${position === 'left' ? 'right: 0;' : 'left: 0;'}
  `;
  
  // 添加悬停效果
  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.backgroundColor = 'var(--vscode-sash-hoverBorder, rgba(0, 122, 255, 0.5))';
  });
  
  resizeHandle.addEventListener('mouseleave', () => {
    resizeHandle.style.backgroundColor = 'transparent';
  });
  
  return resizeHandle;
}

/**
 * 设置拖拽调整大小的事件处理
 * @param outline 大纲元素
 * @param resizeHandle 调整大小的手柄元素
 * @param position 大纲位置
 * @param options 编辑器选项
 */
function setupResizeDragHandlers(
  outline: HTMLElement,
  resizeHandle: HTMLDivElement,
  position: string,
  options: EditorOptions
): void {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  // 鼠标按下事件处理
  resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = outline.offsetWidth;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
  });
  
  // 鼠标移动事件处理
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isResizing) return;
    
    // 根据大纲位置计算宽度变化
    const deltaX = position === 'left' ? (e.clientX - startX) : (startX - e.clientX);
    // 限制最小/最大宽度
    const newWidth = Math.max(150, Math.min(500, startWidth + deltaX));
    
    outline.style.width = `${newWidth}px`;
    
    // 发送宽度变化到VS Code配置
    sendMessageToVSCode({
      command: 'update-outline-width',
      width: newWidth
    });
  });
  
  // 鼠标松开事件处理
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
  
  // 添加双击重置宽度的功能
  resizeHandle.addEventListener('dblclick', () => {
    const resetWidth = options.outlineWidth || 200;
    outline.style.width = `${resetWidth}px`;
    
    sendMessageToVSCode({
      command: 'update-outline-width',
      width: resetWidth
    });
  });
}

/**
 * 设置大纲内容变化观察器
 * 监控大纲元素内容的变化，记录日志
 * @param outlineElement 大纲元素
 */
function setupOutlineContentObserver(outlineElement: HTMLElement): void {
  infoLog('Setting up outline content observer');
  
  // 创建MutationObserver以监控大纲内容变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const headings = outlineElement.querySelectorAll('a[data-target-id]');
        const headingData = Array.from(headings).map(h => ({
          text: h.textContent,
          targetId: h.getAttribute('data-target-id')
        }));
        
        infoLog('Outline content changed', { 
          headingsCount: headings.length,
          mutationType: mutation.type,
          headings: headingData.slice(0, 5) // 只发送前5个标题，避免日志过大
        });
      }
    });
  });
  
  // 配置观察选项
  const config = { 
    attributes: false, 
    childList: true, 
    subtree: true,
    characterData: true 
  };
  
  // 开始观察大纲内容变化
  observer.observe(outlineElement, config);
  debugLog('Outline content observer started');
  
  // 立即获取并记录当前大纲状态
  const initialHeadings = outlineElement.querySelectorAll('a[data-target-id]');
  infoLog('Initial outline state', { 
    headingsCount: initialHeadings.length,
    isVisible: window.getComputedStyle(outlineElement).display !== 'none'
  });
}
