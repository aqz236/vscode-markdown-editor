import * as vscode from 'vscode'
import * as NodePath from 'path'
import { WebviewMessage, VditorOptions, LogMessage, LogLevel } from '../types'
import { CONFIG_KEYS, ConfigManager } from '../config'
import { debug, info, warn, error, showError, getAssetsFolder } from '../utils'

export class MessageHandler {
  constructor(
    private context: vscode.ExtensionContext,
    private panel: vscode.WebviewPanel,
    private document: vscode.TextDocument,
    private uri: vscode.Uri,
    private onUpdateEditTitle: () => void
  ) {}

  async handleMessage(message: WebviewMessage): Promise<void> {
    debug('Received message from webview', { 
      command: message.command, 
      active: this.panel.active,
      messageKeys: Object.keys(message)
    })

    switch (message.command) {
      case 'log':
        this.handleLogMessage(message as unknown as LogMessage)
        break
      case 'ready':
        await this.handleReady()
        break
      case 'save-options':
        await this.handleSaveOptions(message.options!)
        break
      case 'info':
        vscode.window.showInformationMessage(message.content!)
        break
      case 'error':
        showError(message.content!)
        break
      case 'edit':
        await this.handleEdit(message)
        break
      case 'reset-config':
        await this.handleResetConfig()
        break
      case 'save':
        await this.handleSave(message)
        break
      case 'upload':
        await this.handleUpload(message)
        break
      case 'open-link':
        await this.handleOpenLink(message)
        break
      case 'update-outline-width':
        await this.handleUpdateOutlineWidth(message)
        break
      default:
        console.warn('Unknown message command:', message.command)
    }
  }

  private async handleReady(): Promise<void> {
    info('Webview ready, initializing editor')
    const config = ConfigManager.getEditorConfig()
    const savedOptions = this.context.globalState.get(CONFIG_KEYS.VDITOR_OPTIONS) as VditorOptions | undefined
    const options = {
      ...config,
      ...(savedOptions || {}),
    }

    debug('Editor initialization configuration', { 
      outlineSettings: {
        showOutlineByDefault: options.showOutlineByDefault,
        outlinePosition: options.outlinePosition,
        outlineWidth: options.outlineWidth,
        enableOutlineResize: options.enableOutlineResize
      },
      theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
    })

    this.panel.webview.postMessage({
      command: 'update',
      content: this.getDocumentContent(),
      type: 'init',
      options,
      theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light',
    })
  }

  private async handleSaveOptions(options: VditorOptions): Promise<void> {
    await this.context.globalState.update(CONFIG_KEYS.VDITOR_OPTIONS, options)
  }

  private async handleEdit(message: WebviewMessage): Promise<void> {
    if (this.panel.active) {
      await this.syncToEditor(message.content!)
      this.onUpdateEditTitle()
    }
  }

  private async handleResetConfig(): Promise<void> {
    await this.context.globalState.update(CONFIG_KEYS.VDITOR_OPTIONS, {})
  }

  private async handleSave(message: WebviewMessage): Promise<void> {
    await this.syncToEditor(message.content!)
    await this.document.save()
    this.onUpdateEditTitle()
  }

  private async handleUpload(message: WebviewMessage): Promise<void> {
    const config = ConfigManager.getEditorConfig()
    const assetsFolder = getAssetsFolder(this.uri, config.imageSaveFolder)
    
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(assetsFolder))
    } catch (error) {
      console.error(error)
      showError(`Invalid image folder: ${assetsFolder}`)
      return
    }

    await Promise.all(
      message.files!.map(async (f) => {
        const content = Buffer.from(f.base64, 'base64')
        return vscode.workspace.fs.writeFile(
          vscode.Uri.file(NodePath.join(assetsFolder, f.name)),
          content
        )
      })
    )

    const files = message.files!.map((f) =>
      NodePath.relative(
        NodePath.dirname(this.uri.fsPath),
        NodePath.join(assetsFolder, f.name)
      ).replace(/\\/g, '/')
    )

    this.panel.webview.postMessage({
      command: 'uploaded',
      files,
    })
  }

  private async handleOpenLink(message: WebviewMessage): Promise<void> {
    let url = message.href!
    if (!/^http/.test(url)) {
      url = NodePath.resolve(this.uri.fsPath, '..', url)
    }
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
  }

  private async handleUpdateOutlineWidth(message: WebviewMessage): Promise<void> {
    info('Updating outline width', { width: message.width })
    await ConfigManager.updateConfig('outlineWidth', message.width!)
    debug('Outline width updated successfully')
  }

  private async syncToEditor(content: string): Promise<void> {
    debug('sync to editor', this.document, this.uri)
    if (this.document) {
      const edit = new vscode.WorkspaceEdit()
      edit.replace(
        this.document.uri,
        new vscode.Range(0, 0, this.document.lineCount, 0),
        content
      )
      await vscode.workspace.applyEdit(edit)
    } else if (this.uri) {
      await vscode.workspace.fs.writeFile(this.uri, Buffer.from(content, 'utf8'))
    } else {
      showError('Cannot find original file to save!')
    }
  }

  private getDocumentContent(): string {
    return this.document ? this.document.getText() : ''
  }

  private handleLogMessage(logMessage: LogMessage): void {
    const { level, message, data, timestamp, source } = logMessage;
    
    // 构建日志前缀
    const prefix = `[WebView] [${source}] [${timestamp}]`;
    
    // 根据日志级别记录
    switch (level) {
      case LogLevel.DEBUG:
        debug(`${prefix} ${message}`, data);
        break;
      case LogLevel.INFO:
        info(`${prefix} ${message}`, data);
        break;
      case LogLevel.WARN:
        warn(`${prefix} ${message}`, data);
        break;
      case LogLevel.ERROR:
        error(`${prefix} ${message}`, data);
        break;
      default:
        debug(`${prefix} ${message}`, data);
    }
  }
}
