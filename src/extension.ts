import * as vscode from 'vscode'
import * as NodePath from 'path'
import * as fs from 'fs'
const KeyVditorOptions = 'vditor.options'

function debug(...args: any[]) {
  console.log(...args)
}

function showError(msg: string) {
  vscode.window.showErrorMessage(`[markdown-editor] ${msg}`)
}

/**
 * 自定义编辑器提供者
 */
class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 设置webview选项
    webviewPanel.webview.options = EditorPanel.getWebviewOptions(document.uri)
    
    // 创建EditorPanel实例来处理编辑器逻辑
    new EditorPanel(this.context, webviewPanel, this.context.extensionUri, document, document.uri)
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-editor.openEditor',
      (uri?: vscode.Uri, ...args) => {
        debug('command', uri, args)
        EditorPanel.createOrShow(context, uri)
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

  context.globalState.setKeysForSync([KeyVditorOptions])
}

/**
 * Manages cat coding webview panels
 */
class EditorPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: EditorPanel | undefined

  public static readonly viewType = 'markdown-editor'

  private _disposables: vscode.Disposable[] = []

  public static async createOrShow(
    context: vscode.ExtensionContext,
    uri?: vscode.Uri
  ) {
    const { extensionUri } = context
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined
    if (EditorPanel.currentPanel && uri !== EditorPanel.currentPanel?._uri) {
      EditorPanel.currentPanel.dispose()
    }
    // If we already have a panel, show it.
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel._panel.reveal(column)
      return
    }
    if (!vscode.window.activeTextEditor && !uri) {
      showError(`Did not open markdown file!`)
      return
    }
    let doc: undefined | vscode.TextDocument
    // from context menu : 从当前打开的 textEditor 中寻找 是否有当前 markdown 的 editor, 有的话则绑定 document
    if (uri) {
      // 从右键打开文件，先打开文档然后开启自动同步，不然没法保存文件和同步到已经打开的document
      doc = await vscode.workspace.openTextDocument(uri)
    } else {
      doc = vscode.window.activeTextEditor?.document
      // from command mode
      if (doc && doc.languageId !== 'markdown') {
        showError(
          `Current file language is not markdown, got ${doc.languageId}`
        )
        return
      }
    }

    if (!doc) {
      showError(`Cannot find markdown file!`)
      return
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      EditorPanel.viewType,
      'markdown-editor',
      column || vscode.ViewColumn.One,
      EditorPanel.getWebviewOptions(uri)
    )

    EditorPanel.currentPanel = new EditorPanel(
      context,
      panel,
      extensionUri,
      doc,
      uri
    )
  }

  private static getFolders(): vscode.Uri[] {
    const data = []
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
    }
    return data
  }

  static getWebviewOptions(
    uri?: vscode.Uri
  ): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    return {
      // Enable javascript in the webview
      enableScripts: true,

            localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()],
      retainContextWhenHidden: true,
      enableCommandUris: true,
    }
  }
  private get _fsPath() {
    return this._uri.fsPath
  }

  static get config() {
    return vscode.workspace.getConfiguration('markdown-editor')
  }

  public constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    public _document: vscode.TextDocument, // 当前有 markdown 编辑器
    public _uri = _document.uri // 从资源管理器打开，只有 uri 没有 _document
  ) {
    // Set the webview's initial html content

    this._init()

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    let textEditTimer: NodeJS.Timeout | void
    // close EditorPanel when vsc editor is close
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === this._fsPath) {
        this.dispose()
      }
    }, this._disposables)
    // update EditorPanel when vsc editor changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName !== this._document.fileName) {
        return
      }
      // 当 webview panel 激活时不将由 webview编辑导致的 vsc 编辑器更新同步回 webview
      // don't change webview panel when webview panel is focus
      if (this._panel.active) {
        return
      }
      textEditTimer && clearTimeout(textEditTimer)
      textEditTimer = setTimeout(() => {
        this._update()
        this._updateEditTitle()
      }, 300)
    }, this._disposables)
    
    // 监听配置变化，当CSS相关配置改变时重新加载webview
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markdown-editor.externalCssFiles') ||
          e.affectsConfiguration('markdown-editor.customCss') ||
          e.affectsConfiguration('markdown-editor.cssLoadOrder')) {
        // 重新生成HTML以应用新的CSS配置
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
      }
      
      // 监听大纲显示设置变化
      if (e.affectsConfiguration('markdown-editor.showOutlineByDefault') ||
          e.affectsConfiguration('markdown-editor.outlinePosition') ||
          e.affectsConfiguration('markdown-editor.outlineWidth') ||
          e.affectsConfiguration('markdown-editor.enableOutlineResize') ||
          e.affectsConfiguration('markdown-editor.useVscodeThemeColor')) {
        // 发送配置更新消息给webview
        this._panel.webview.postMessage({
          command: 'config-update',
          config: {
            showOutlineByDefault: EditorPanel.config.get<boolean>('showOutlineByDefault'),
            outlinePosition: EditorPanel.config.get<string>('outlinePosition'),
            outlineWidth: EditorPanel.config.get<number>('outlineWidth'),
            enableOutlineResize: EditorPanel.config.get<boolean>('enableOutlineResize'),
            useVscodeThemeColor: EditorPanel.config.get<boolean>('useVscodeThemeColor')
          }
        })
      }
    }, this._disposables)
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        debug('msg from webview review', message, this._panel.active)

        const syncToEditor = async () => {
          debug('sync to editor', this._document, this._uri)
          if (this._document) {
            const edit = new vscode.WorkspaceEdit()
            edit.replace(
              this._document.uri,
              new vscode.Range(0, 0, this._document.lineCount, 0),
              message.content
            )
            await vscode.workspace.applyEdit(edit)
          } else if (this._uri) {
            await vscode.workspace.fs.writeFile(this._uri, message.content)
          } else {
            showError(`Cannot find original file to save!`)
          }
        }
        switch (message.command) {
          case 'ready':
            this._update({
              type: 'init',
              options: {
                useVscodeThemeColor: EditorPanel.config.get<boolean>(
                  'useVscodeThemeColor'
                ),
                showOutlineByDefault: EditorPanel.config.get<boolean>(
                  'showOutlineByDefault'
                ),
                outlinePosition: EditorPanel.config.get<string>(
                  'outlinePosition'
                ),
                outlineWidth: EditorPanel.config.get<number>(
                  'outlineWidth'
                ),
                enableOutlineResize: EditorPanel.config.get<boolean>(
                  'enableOutlineResize'
                ),
                ...this._context.globalState.get(KeyVditorOptions),
              },
              theme:
                vscode.window.activeColorTheme.kind ===
                vscode.ColorThemeKind.Dark
                  ? 'dark'
                  : 'light',
            })
            break
          case 'save-options':
            this._context.globalState.update(KeyVditorOptions, message.options)
            break
          case 'info':
            vscode.window.showInformationMessage(message.content)
            break
          case 'error':
            showError(message.content)
            break
          case 'edit': {
            // 只有当 webview 处于编辑状态时才同步到 vsc 编辑器，避免重复刷新
            if (this._panel.active) {
              await syncToEditor()
              this._updateEditTitle()
            }
            break
          }
          case 'reset-config': {
            await this._context.globalState.update(KeyVditorOptions, {})
            break
          }
          case 'save': {
            await syncToEditor()
            await this._document.save()
            this._updateEditTitle()
            break
          }
          case 'upload': {
            const assetsFolder = EditorPanel.getAssetsFolder(this._uri)
            try {
              await vscode.workspace.fs.createDirectory(
                vscode.Uri.file(assetsFolder)
              )
            } catch (error) {
              console.error(error)
              showError(`Invalid image folder: ${assetsFolder}`)
            }
            await Promise.all(
              message.files.map(async (f: any) => {
                const content = Buffer.from(f.base64, 'base64')
                return vscode.workspace.fs.writeFile(
                  vscode.Uri.file(NodePath.join(assetsFolder, f.name)),
                  content
                )
              })
            )
            const files = message.files.map((f: any) =>
              NodePath.relative(
                NodePath.dirname(this._fsPath),
                NodePath.join(assetsFolder, f.name)
              ).replace(/\\/g, '/')
            )
            this._panel.webview.postMessage({
              command: 'uploaded',
              files,
            })
            break
          }
          case 'open-link': {
            let url = message.href
            if (!/^http/.test(url)) {
              url = NodePath.resolve(this._fsPath, '..', url)
            }
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
            break
          }
          case 'update-outline-width': {
            // 更新大纲宽度配置
            const config = vscode.workspace.getConfiguration('markdown-editor')
            await config.update('outlineWidth', message.width, vscode.ConfigurationTarget.Global)
            break
          }
        }
      },
      null,
      this._disposables
    )
  }

  static getAssetsFolder(uri: vscode.Uri) {
    const imageSaveFolder = (
      EditorPanel.config.get<string>('imageSaveFolder') || 'assets'
    )
      .replace(
        '${projectRoot}',
        vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || ''
      )
      .replace('${file}', uri.fsPath)
      .replace(
        '${fileBasenameNoExtension}',
        NodePath.basename(uri.fsPath, NodePath.extname(uri.fsPath))
      )
      .replace('${dir}', NodePath.dirname(uri.fsPath))
    const assetsFolder = NodePath.resolve(
      NodePath.dirname(uri.fsPath),
      imageSaveFolder
    )
    return assetsFolder
  }

  public dispose() {
    EditorPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  private _init() {
    const webview = this._panel.webview

    this._panel.webview.html = this._getHtmlForWebview(webview)
    this._panel.title = NodePath.basename(this._fsPath)
  }
  private _isEdit = false
  private _updateEditTitle() {
    const isEdit = this._document.isDirty
    if (isEdit !== this._isEdit) {
      this._isEdit = isEdit
      this._panel.title = `${isEdit ? `[edit]` : ''}${NodePath.basename(
        this._fsPath
      )}`
    }
  }

  // private fileToWebviewUri = (f: string) => {
  //   return this._panel.webview.asWebviewUri(vscode.Uri.file(f)).toString()
  // }

  private async _update(
    props: {
      type?: 'init' | 'update'
      options?: any
      theme?: 'dark' | 'light'
    } = { options: void 0 }
  ) {
    const md = this._document
      ? this._document.getText()
      : (await vscode.workspace.fs.readFile(this._uri)).toString()
    // const dir = NodePath.dirname(this._document.fileName)
    this._panel.webview.postMessage({
      command: 'update',
      content: md,
      ...props,
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const toUri = (f: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, f))
    const baseHref =
      NodePath.dirname(
        webview.asWebviewUri(vscode.Uri.file(this._fsPath)).toString()
      ) + '/'
    const toMediaPath = (f: string) => `media/dist/${f}`
    const JsFiles = ['main.js'].map(toMediaPath).map(toUri)
    const CssFiles = ['main.css'].map(toMediaPath).map(toUri)

    // 生成外部CSS链接
    const externalCssLinks = this._generateExternalCssLinks(webview)
    const customCss = EditorPanel.config.get<string>('customCss') || ''
    const cssLoadOrder = EditorPanel.config.get<string>('cssLoadOrder') || 'external-first'

    // 根据配置决定CSS加载顺序
    let cssContent = ''
    if (cssLoadOrder === 'external-first') {
      cssContent = externalCssLinks + (customCss ? `\n<style>${customCss}</style>` : '')
    } else {
      cssContent = (customCss ? `<style>${customCss}</style>\n` : '') + externalCssLinks
    }

    return (
      `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<base href="${baseHref}" />

				${CssFiles.map((f) => `<link href="${f}" rel="stylesheet">`).join('\n')}
				${cssContent}

				<title>markdown editor</title>
			</head>
			<body>
				<div id="app"></div>

				${JsFiles.map((f) => `<script src="${f}"></script>`).join('\n')}
			</body>
			</html>`
    )
  }

  /**
   * 生成外部CSS链接
   */
  private _generateExternalCssLinks(webview: vscode.Webview): string {
    const externalCssFiles = EditorPanel.config.get<string[]>('externalCssFiles') || []
    
    return externalCssFiles.map(cssFile => {
      // 处理不同类型的CSS路径
      if (this._isHttpUrl(cssFile)) {
        // HTTP/HTTPS URL
        return `<link href="${cssFile}" rel="stylesheet" crossorigin="anonymous">`
      } else if (NodePath.isAbsolute(cssFile)) {
        // 绝对路径
        try {
          const cssUri = webview.asWebviewUri(vscode.Uri.file(cssFile))
          return `<link href="${cssUri}" rel="stylesheet">`
        } catch (error) {
          console.warn(`Failed to load CSS file: ${cssFile}`, error)
          return `<!-- Failed to load CSS: ${cssFile} -->`
        }
      } else {
        // 相对路径（相对于工作区或markdown文件）
        try {
          let resolvedPath: string
          
          // 尝试相对于当前markdown文件解析
          const markdownDir = NodePath.dirname(this._fsPath)
          const relativeToMarkdown = NodePath.resolve(markdownDir, cssFile)
          
          // 检查文件是否存在
          if (fs.existsSync(relativeToMarkdown)) {
            resolvedPath = relativeToMarkdown
          } else {
            // 尝试相对于工作区根目录解析
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(this._uri)
            if (workspaceFolder) {
              resolvedPath = NodePath.resolve(workspaceFolder.uri.fsPath, cssFile)
            } else {
              resolvedPath = relativeToMarkdown // 降级到相对于markdown文件
            }
          }
          
          const cssUri = webview.asWebviewUri(vscode.Uri.file(resolvedPath))
          return `<link href="${cssUri}" rel="stylesheet">`
        } catch (error) {
          console.warn(`Failed to resolve CSS file: ${cssFile}`, error)
          return `<!-- Failed to resolve CSS: ${cssFile} -->`
        }
      }
    }).join('\n')
  }

  /**
   * 检查是否为HTTP/HTTPS URL
   */
  private _isHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url)
  }
}
