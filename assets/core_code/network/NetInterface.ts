/*
 *   网络相关接口定义
 *
 */

import { HttpEvent } from "./HttpMgr";

export type NetData = string | ArrayBufferLike | Blob | ArrayBufferView;
export type NetCallFunc = (cmd: number, data: any) => void;

// 回调对象
export interface CallbackObject {
    target: any; // 回调对象，不为null时调用target.callback(xxx)
    callback: NetCallFunc; // 回调函数
}

// 请求对象
export interface RequestObject {
    buffer: NetData; // 请求的Buffer
    rspCmd: number; // 等待响应指令
    rspObject: CallbackObject | null; // 等待响应的回调对象
}

// 协议辅助接口
export interface IProtocolHelper {
    getHeadlen(): number; // 返回包头长度
    getHearbeat(): NetData; // 返回一个心跳包
    getPackageLen(msg: NetData): number; // 返回整个包的长度
    checkPackage(msg: NetData): boolean; // 检查包数据是否合法
    getPackageId(msg: NetData): any; // 返回基本包的，一般有id和body
    getPackage<T>(cmd: number, msg: egf.NetData): T; // 解析包数据并返回对象
    package(cmd: number, msg: any): egf.NetData; // 打包数据并返回Buffer
    handleError(msg: NetData): any;
}

// 默认字符串协议对象
export class DefStringProtocol implements IProtocolHelper {
    getHeadlen(): number {
        return 0;
    }
    getHearbeat(): NetData {
        return "";
    }
    getPackageLen(msg: NetData): number {
        return msg.toString().length;
    }
    checkPackage(msg: NetData): boolean {
        return true;
    }
    getPackageId(msg: NetData): any {
        return 0;
    }
    getPackage<T>(cmd: number, msg: egf.NetData): T {
        return msg.toString() as T;
    }
    package(cmd: number, msg: any): egf.NetData {
        return msg as egf.NetData;
    }
    handleError(msg: NetData): any {
        return 0;
    }
}

export type SocketFunc = (event: any) => void;
export type MessageFunc = (msg: NetData) => void;

// Socket接口
export interface ISocket {
    onConnected: SocketFunc | null; // 连接回调
    onMessage: MessageFunc | null; // 消息回调
    onError: SocketFunc | null; // 错误回调
    onClosed: SocketFunc | null; // 关闭回调
    onReConnected?: SocketFunc | null; // 重连回调

    connect(options: any): any; // 连接接口
    send(buffer: NetData): number; // 数据发送接口
    close(code?: number, reason?: string): void; // 关闭接口
}

// 网络提示接口
export interface INetworkTips {
    connectTips(isShow: boolean): void;
    reconnectTips(isShow: boolean): void;
    requestTips(isShow: boolean): void;
    showErrorTips(code: number): void;
    showServerErrorTips(errorMsg: any): void;
    showHttpErrorTips(data: { event: HttpEvent; code: number; msg: string }, response: string): void;
}
