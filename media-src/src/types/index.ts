/**
 * 全局类型定义
 */

// 模块声明
declare module '*.scss';
declare module '*.png';
declare module '*.jpg';
declare module '*.svg';

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// VSCode消息类型
export interface VSCodeMessage {
  command: string;
  [key: string]: any;
}

// 日志消息类型
export interface LogMessage extends VSCodeMessage {
  command: 'log';
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  source: 'webview';
}

// 编辑器选项
export interface EditorOptions {
  showOutlineByDefault?: boolean;
  outlinePosition?: 'left' | 'right';
  outlineWidth?: number;
  enableOutlineResize?: boolean;
  useVscodeThemeColor?: boolean;
  [key: string]: any;
}

// 编辑器更新消息
export interface UpdateMessage {
  command: 'update';
  type: 'init' | string;
  content: string;
  theme?: 'dark' | 'light';
  options?: EditorOptions;
}

// 文件上传信息
export interface FileInfo {
  base64: string;
  name: string;
}

// 全局声明
declare global {
  export const vditor: any; // 使用具体的Vditor类型更好，但需要从vditor库中导入
  export const vscode: any; 
  
  interface Window {
    vditor: any;
    vscode: any;
    global: Window;
  }
}
