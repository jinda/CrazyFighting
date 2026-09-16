/*
 *   WebTransport封装
 *   1. 连接/断开相关接口
 *   2. 网络异常回调
 *   3. 数据发送与接收
 *
 */
import { ISocket, MessageFunc, NetData, SocketFunc } from "./NetInterface";
import { NetConnectOptions } from "./NetNode";
// import io from 'socket.io-client';

enum SocketIOState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

export class WebTransportIO implements ISocket {
    private _webTransport: WebTransport | null = null; // WebTransport对象
    private _stream: WebTransportBidirectionalStream | null = null; // WebTransport数据流
    private _state: SocketIOState = SocketIOState.CLOSED; // socket状态

    onConnected: SocketFunc | null = null; // 连接回调
    onMessage: MessageFunc | null = null; // 消息回调
    onError: SocketFunc | null = null; // 错误回调
    onClosed: SocketFunc | null = null; // 关闭回调
    onReConnected?: SocketFunc | null = null; // 重连回调

    defaultOptions = {
        autoConnect: false,
    };

    async connect(options: NetConnectOptions) {
        if (this._webTransport && this._state == SocketIOState.CONNECTING) {
            egf.Logger.warn("websocket connecting, wait for a moment...");
            return false;
        }

        const url = options.url || `${options.protocol}://${options.host}:${options.port}`;
        const opts = { ...this.defaultOptions, ...options.opts };
        egf.Logger.log("webTransport connect", url, opts);
        this._state = SocketIOState.CONNECTING;
        try {
            this._webTransport = new WebTransport(url, opts as any);
            await this._webTransport.ready;
            this._state = SocketIOState.OPEN;
            this._stream = await this._webTransport.createBidirectionalStream();
            this.readData(this._stream.readable);
            this._webTransport.closed
                .then(() => {
                    this._state = SocketIOState.CLOSING;
                    egf.Logger.log(`The HTTP/3 connection to ${url} closed gracefully.`);
                })
                .catch((error) => {
                    this._state = SocketIOState.CLOSING;
                    egf.Logger.error(`The HTTP/3 connection to ${url} closed due to ${error}.`);
                });
            return true;
        } catch (error) {
            this._state = SocketIOState.CLOSED;
            return false;
        }
    }

    async readData(readable: any) {
        const reader = readable.getReader();
        while (true) {
            const { data, done } = await reader.read();
            if (done) {
                break;
            }
            // value is a Uint8Array.
            egf.Logger.log(data);
            this.onMessage && this.onMessage(data);
        }
    }

    send(buffer: NetData): number {
        if (this._webTransport && this._state == SocketIOState.OPEN) {
            const writer = this._stream.writable.getWriter();
            writer.write(buffer);
            return 1;
        }
        return -1;
    }

    close(code?: number, reason?: string) {
        this._webTransport.close({
            closeCode: code,
            reason: reason,
        });
        this._state = SocketIOState.CLOSING;
        egf.Logger.log(`webTransport closed code:${code} reason:${reason}`);
    }
}
