import * as vscode from 'vscode'

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 日志消息接口
export interface LogMessage {
  command: 'log';
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  source: 'webview';
}

export interface VditorOptions {
  useVscodeThemeColor?: boolean
  showOutlineByDefault?: boolean
  outlinePosition?: string
  outlineWidth?: number
  enableOutlineResize?: boolean
  [key: string]: any
}

export interface EditorConfig {
  externalCssFiles: string[]
  customCss: string
  cssLoadOrder: 'external-first' | 'custom-first'
  imageSaveFolder: string
  useVscodeThemeColor: boolean
  showOutlineByDefault: boolean
  outlinePosition: 'left' | 'right'
  outlineWidth: number
  enableOutlineResize: boolean
}

export interface WebviewMessage {
  command: string
  content?: string
  options?: VditorOptions
  files?: UploadFile[]
  href?: string
  width?: number
}

export interface UploadFile {
  name: string
  base64: string
}

export interface UpdateProps {
  type?: 'init' | 'update'
  options?: VditorOptions
  theme?: 'dark' | 'light'
}

export interface EditorPanelDependencies {
  context: vscode.ExtensionContext
  panel: vscode.WebviewPanel
  extensionUri: vscode.Uri
  document: vscode.TextDocument
  uri: vscode.Uri
}
