import * as vscode from 'vscode'
import { EditorPanel } from './editor/editorPanel'
import { MarkdownEditorProvider } from './editor/markdownEditorProvider'
import { CONFIG_KEYS } from './config'
import { debug, info } from './utils'

export function activate(context: vscode.ExtensionContext) {
  info('Markdown Editor extension activated')
  
  // 注册打开编辑器命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-editor.openEditor',
      (uri?: vscode.Uri, ...args) => {
        debug('Received command: openEditor', uri?.toString(), args)
        EditorPanel.createOrShow(context, uri)
      }
    )
  )

  // 注册在拆分窗口中打开编辑器命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-editor.openInSplit',
      (uri?: vscode.Uri, ...args) => {
        debug('Received command: openInSplit', uri?.toString(), args)
        EditorPanel.createOrShow(context, uri, true)
      }
    )
  )

  // 注册自定义编辑器提供者
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'markdown-editor.editor',
      new MarkdownEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  )

  // 设置全局状态同步
  context.globalState.setKeysForSync([CONFIG_KEYS.VDITOR_OPTIONS])
}
