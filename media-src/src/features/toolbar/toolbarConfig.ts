/**
 * 工具栏配置模块
 */
import { t } from '../../i18n/lang';
import { confirm, sendMessageToVSCode } from '../../utils/common';

/**
 * 复制Markdown内容
 */
async function copyMarkdownContent(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.vditor.getValue());
    sendMessageToVSCode({
      command: 'info',
      content: 'Copy Markdown successfully!',
    });
  } catch (error: any) {
    sendMessageToVSCode({
      command: 'error',
      content: `Copy Markdown failed! ${error.message}`,
    });
  }
}

/**
 * 复制HTML内容
 */
async function copyHtmlContent(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.vditor.getHTML());
    sendMessageToVSCode({
      command: 'info',
      content: 'Copy HTML successfully!',
    });
  } catch (error: any) {
    sendMessageToVSCode({
      command: 'error',
      content: `Copy HTML failed! ${error.message}`,
    });
  }
}

/**
 * 重置编辑器配置
 */
function resetEditorConfig(): void {
  confirm(t('resetConfirm'), async () => {
    try {
      sendMessageToVSCode({
        command: 'reset-config',
      });
      sendMessageToVSCode({
        command: 'ready',
      });
      sendMessageToVSCode({
        command: 'info',
        content: 'Reset config successfully!',
      });
    } catch (error) {
      sendMessageToVSCode({
        command: 'error',
        content: 'Reset config failed!',
      });
    }
  });
}

/**
 * 保存文档
 */
function saveDocument(): void {
  sendMessageToVSCode({
    command: 'save',
    content: window.vditor.getValue(),
  });
}

/**
 * 工具栏配置
 */
export const toolbar = [
  // 保存按钮
  {
    hotkey: '⌘s',
    name: 'save',
    tipPosition: 's',
    tip: t('save'),
    className: 'save',
    icon:
      '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M810.667 938.667H213.333a128 128 0 01-128-128V213.333a128 128 0 01128-128h469.334a42.667 42.667 0 0130.293 12.374L926.293 311.04a42.667 42.667 0 0112.374 30.293v469.334a128 128 0 01-128 128zm-597.334-768a42.667 42.667 0 00-42.666 42.666v597.334a42.667 42.667 0 0042.666 42.666h597.334a42.667 42.667 0 0042.666-42.666v-451.84l-188.16-188.16z"/><path d="M725.333 938.667A42.667 42.667 0 01682.667 896V597.333H341.333V896A42.667 42.667 0 01256 896V554.667A42.667 42.667 0 01298.667 512h426.666A42.667 42.667 0 01768 554.667V896a42.667 42.667 0 01-42.667 42.667zM640 384H298.667A42.667 42.667 0 01256 341.333V128a42.667 42.667 0 0185.333 0v170.667H640A42.667 42.667 0 01640 384z"/></svg>',
    click: saveDocument,
  },

  // 标准按钮
  'emoji',
  'headings',
  'bold',
  'italic',
  'strike',
  'link',
  '|',
  'list',
  'ordered-list',
  'check',
  'outdent',
  'indent',
  '|',
  'quote',
  'line',
  'code',
  'inline-code',
  'insert-before',
  'insert-after',
  '|',
  'upload',
  'table',
  '|',
  'undo',
  'redo',
  '|',
  { name: 'edit-mode', tipPosition: 'e' },
  
  // 更多选项菜单
  {
    name: 'more',
    tipPosition: 'e',
    toolbar: [
      'both',
      'code-theme',
      'content-theme',
      'outline',
      'preview',
      {
        name: 'copy-markdown',
        icon: t('copyMarkdown'),
        click: copyMarkdownContent,
      },
      {
        name: 'copy-html',
        icon: t('copyHtml'),
        click: copyHtmlContent,
      },
      {
        name: 'reset-config',
        icon: t('resetConfig'),
        click: resetEditorConfig,
      },
      'devtools',
      'info',
      'help',
    ],
  },
].map((item: any) => {
  if (typeof item === 'string') {
    item = { name: item };
  }
  item.tipPosition = item.tipPosition || 's';
  return item;
});
