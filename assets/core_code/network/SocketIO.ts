/*
 *   SockIO封装
 *   1. 连接/断开相关接口
 *   2. 网络异常回调
 *   3. 数据发送与接收
 *
 */
import { ISocket, NetData } from "./NetInterface";
import { NetConnectOptions } from "./NetNode";
// import io from 'socket.io-client';
import { Socket } from "socket.io-client";
import io from "socket.io-client/dist/socket.io.js";

enum SocketIOState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3,
}

export class SocketIO implements ISocket {
    private _socketio: Socket | null = null; // websocket对象
    private _state: SocketIOState = SocketIOState.CLOSED; // socket状态
    onConnected = null;
    onMessage = null;
    onError = null;
    onClosed = null;
    onReConnected = null;

    defaultOptions = {
        autoConnect: false,
        transports: ["websocket"],
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.5,
    };

    private getRuntimeNetworkState() {
        return {
            online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
            visibilityState: typeof document !== "undefined" ? document.visibilityState : undefined,
            socketState: SocketIOState[this._state],
            socketId: this._socketio?.id,
        };
    }

    private cleanupSocket() {
        if (!this._socketio) {
            return;
        }
        this._socketio.removeAllListeners();
        this._socketio.io.removeAllListeners();
        this._socketio.io.engine?.removeAllListeners?.("close");
        this._socketio.disconnect();
        this._socketio = null;
    }

    connect(options: NetConnectOptions) {
        if (this._socketio && this._state == SocketIOState.CONNECTING) {
            egf.Logger.warn("websocket connecting, wait for a moment...");
            return false;
        }
        this.cleanupSocket();

        const url = options.url || `${options.protocol}://${options.host}:${options.port}`;
        const opts = { ...this.defaultOptions, ...options.opts };
        egf.Logger.log("socketio connect", url, opts);
        this._state = SocketIOState.CONNECTING;
        this._socketio = io(url, opts);
        this._socketio.connect();
        this._socketio.on("connect", () => {
            egf.Logger.log("socketio connected");
            this._state = SocketIOState.OPEN;
            this.onConnected && this.onConnected();
        });
        this._socketio.on("message", (data) => {
            this.onMessage && this.onMessage(data);
        });
        this._socketio.io.engine.on("close", (reason) => {
            egf.Logger.error("socketio close", reason, this.getRuntimeNetworkState());
            this._state = SocketIOState.CLOSED;
            this.onClosed && this.onClosed(reason);
        });
        this._socketio.on("error", (error) => {
            egf.Logger.error("socketio error", error, this.getRuntimeNetworkState());
            this._state = SocketIOState.CLOSED;
            this.onError && this.onError(error);
        });
        this._socketio.io.on("reconnect_attempt", (attempt) => {
            egf.Logger.warn("socketio reconnect_attempt", attempt, this.getRuntimeNetworkState());
        });
        this._socketio.io.on("reconnect", (reason) => {
            this._state = SocketIOState.OPEN;
            egf.Logger.error("socketio reconnect", reason, this.getRuntimeNetworkState());

            this.onReConnected && this.onReConnected(this._state);
        });
        this._socketio.io.on("reconnect_error", (reason) => {
            this._state = SocketIOState.CLOSED;
            egf.Logger.error("socketio reconnect_error", reason, this.getRuntimeNetworkState());
            this.onReConnected && this.onReConnected(this._state);
        });
        this._socketio.io.on("reconnect_failed", () => {
            this._state = SocketIOState.CLOSED;
            egf.Logger.error("socketio reconnect_failed", this.getRuntimeNetworkState());
            this.onReConnected && this.onReConnected(this._state);
        });
        return true;
    }

    send(buffer: NetData): number {
        if (this._socketio && this._socketio.connected) {
            this._socketio.send(buffer);
            return 1;
        }
        return -1;
    }

    close(code?: number, reason?: string) {
        if (this._socketio) {
            this._state = SocketIOState.CLOSING;
            this._socketio.close();
        }
    }
}
