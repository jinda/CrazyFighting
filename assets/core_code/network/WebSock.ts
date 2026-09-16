import { ISocket, MessageFunc, NetData } from "./NetInterface";
import { NetConnectOptions } from "./NetNode";

/*
 *   WebSocket封装
 *   1. 连接/断开相关接口
 *   2. 网络异常回调
 *   3. 数据发送与接收
 *
 */

export class WebSock implements ISocket {
    private _ws: WebSocket | null = null; // websocket对象

    onConnected = null;
    onMessage = null;
    onError = null;
    onClosed = null;

    connect(options: NetConnectOptions) {
        if (this._ws) {
            if (this._ws.readyState === WebSocket.CONNECTING) {
                egf.Logger.log("websocket connecting, wait for a moment...");
                return false;
            }
        }

        let url = options.url || `${options.protocol}://${options.host}:${options.port}`;

        this._ws = new WebSocket(url, options.opts?.values);
        this._ws.binaryType = options.binaryType ? options.binaryType : "arraybuffer";
        this._ws.onmessage = (event) => {
            let onMessage: MessageFunc = this.onMessage!;
            onMessage(event.data);
        };
        this._ws.onopen = this.onConnected;
        this._ws.onerror = this.onError;
        this._ws.onclose = this.onClosed;
        return true;
    }

    send(buffer: NetData): number {
        if (this._ws && this._ws.readyState == WebSocket.OPEN) {
            this._ws.send(buffer);
            return 1;
        }
        return -1;
    }

    close(code?: number, reason?: string) {
        if (this._ws) {
            this._ws.close(code, reason);
        }
    }
}
