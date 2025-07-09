import * as vscode from 'vscode'
import * as NodePath from 'path'

// 定义日志级别
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 获取配置的日志级别
function getLogLevel(): LogLevel {
  const config = vscode.workspace.getConfiguration('markdownEditor')
  const levelStr = config.get<string>('logLevel', 'info')
  
  switch (levelStr.toLowerCase()) {
    case 'debug': return LogLevel.DEBUG
    case 'info': return LogLevel.INFO
    case 'warn': return LogLevel.WARN
    case 'error': return LogLevel.ERROR
    default: return LogLevel.INFO
  }
}

// 带标识的输出通道
let outputChannel: vscode.OutputChannel | undefined

// 获取或创建输出通道
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Markdown Editor')
  }
  return outputChannel
}

// 记录日志的函数
export function log(level: LogLevel, message: string, ...args: any[]): void {
  const configLevel = getLogLevel()
  
  // 仅当日志级别满足配置要求时输出
  if (level >= configLevel) {
    const channel = getOutputChannel()
    const timestamp = new Date().toISOString()
    const levelName = LogLevel[level]
    
    // 格式化参数
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg)
        } catch (e) {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
    
    // 构建完整日志消息
    const logMessage = `[${timestamp}] [${levelName}] ${message} ${formattedArgs}`
    
    // 输出到控制台
    console.log(logMessage)
    
    // 输出到通道
    channel.appendLine(logMessage)
  }
}

// 便捷日志方法
export function debug(message: string, ...args: any[]): void {
  log(LogLevel.DEBUG, message, ...args)
}

export function info(message: string, ...args: any[]): void {
  log(LogLevel.INFO, message, ...args)
}

export function warn(message: string, ...args: any[]): void {
  log(LogLevel.WARN, message, ...args)
}

export function error(message: string, ...args: any[]): void {
  log(LogLevel.ERROR, message, ...args)
}

// 保留原来的debug函数的兼容性
export function debugLegacy(...args: any[]) {
  debug('Legacy debug:', ...args)
}

export function showError(msg: string) {
  vscode.window.showErrorMessage(`[markdown-editor] ${msg}`)
  error(msg)
}

export function showInfo(msg: string) {
  vscode.window.showInformationMessage(msg)
  info(msg)
}

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export function getAssetsFolder(uri: vscode.Uri, imageSaveFolder: string): string {
  const processedFolder = imageSaveFolder
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
  
  return NodePath.resolve(NodePath.dirname(uri.fsPath), processedFolder)
}

export function getWebviewOptions(uri?: vscode.Uri): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  const folders = []
  for (let i = 65; i <= 90; i++) {
    folders.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
  }

  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.file("/"), ...folders],
    retainContextWhenHidden: true,
    enableCommandUris: true,
  }
}

export function getCurrentTheme(): 'dark' | 'light' {
  return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'
}
