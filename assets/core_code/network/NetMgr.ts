import { NetNode, NetConnectOptions, NetNodeState } from "./NetNode";
import { CallbackObject, NetCallFunc, IProtocolHelper } from "./NetInterface";
import { WebSock } from "./WebSock";

/*
 *   网络节点管理类
 *
 */
class NetManager {
    private static _inst: NetManager | null = null;
    protected _channels: { [key: number]: NetNode } = {};
    private _defaultChannelId: number = 0; // 默认当前的网络节点

    public static get inst(): NetManager {
        if (!this._inst) {
            this._inst = new NetManager();
        }
        return this._inst;
    }

    public setDefaultChannelId(channelId: number) {
        this._defaultChannelId = channelId;
    }

    /**
     * 初始化网络模块
     */
    public init(channelId?: number, protocolHelper?: IProtocolHelper, networkTips?: any): void {
        let netNode = new NetNode();
        netNode.init(new WebSock(), protocolHelper!, networkTips);
        this.setNetNode(netNode, channelId);
    }

    /**
     * 设置回调函数
     * @param cmd 协议号
     * @param callback 回调函数
     * @param channelId 网络节点
     */
    public setHandler(cmd: number, callback: NetCallFunc, target?: any, channelId?: number): void {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            this._channels[channelId].setResponeHandler(cmd, callback, target);
        }
    }
    /**
     * 添加回调函数
     * @param cmd 协议号
     * @param callback 回调函数
     * @param channelId 网络节点
     */
    public addHandler(cmd: number, callback: NetCallFunc, target?: any, channelId?: number): void {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            this._channels[channelId].addResponeHandler(cmd, callback, target);
        }
    }

    /**
     * 移除回调函数
     * @param cmd 协议号
     * @param channelId 网络节点
     */
    public removeHandler(cmd: number, callback: NetCallFunc, target?: any, channelId?: number) {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            this._channels[channelId].removeResponeHandler(cmd, callback, target);
        }
    }

    /**
     * 移除回调函数
     * @param cmd 协议号
     * @param channelId 网络节点
     */
    public clearHandler(cmd?: number, channelId?: number) {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            this._channels[channelId].cleanListeners(cmd);
        }
    }
    /**
     * 移除节点上所有的回调函数
     * @param target 节点
     * @param channelId 网络节点
     */
    public clearHandlerTarget(target?: any, channelId?: number) {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            this._channels[channelId].cleanListenersTarget(target);
        }
    }

    // 添加Node，返回ChannelID
    public setNetNode(newNode: NetNode, channelId?: number) {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        this._channels[channelId] = newNode;
    }

    // 移除Node
    public removeNetNode(channelId: number, code?: number, reason?: string) {
        if (this._channels[channelId]) {
            this._channels[channelId].closeSocket(code, reason);
            delete this._channels[channelId];
        }
    }

    // 调用Node连接
    public connect(options: NetConnectOptions, channelId?: number): boolean {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            return this._channels[channelId].connect(options);
        }
        return false;
    }

    // 调用Node发送
    public sendData(cmd: number, data: any, channelId: number = 0, force: boolean = false): number {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        let node = this._channels[channelId];

        if (node) {
            return node!.sendData(cmd, data, force);
        }
        return -1;
    }

    // 发起请求，并在在结果返回时调用指定好的回调函数
    public request(
        cmd: number,
        data: any,
        rspCmd: number,
        rspObject: CallbackObject,
        channelId?: number,
        showTips: boolean = true,
        force: boolean = false,
    ) {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        let node = this._channels[channelId];

        if (node) {
            node.request(cmd, data, rspCmd, rspObject, showTips, force);
        }
    }

    // 同request，但在request之前会先判断队列中是否已有rspCmd，如有重复的则直接返回
    public requestUnique(
        cmd: number,
        data: any,
        rspCmd: number,
        rspObject: CallbackObject,
        channelId?: number,
        showTips: boolean = true,
        force: boolean = false,
    ): boolean {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        let node = this._channels[channelId];
        if (node) {
            return node.requestUnique(cmd, data, rspCmd, rspObject, showTips, force);
        }

        return false;
    }

    // 调用Node关闭
    public close(channelId?: number, code?: number, reason?: string) {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            return this._channels[channelId].closeSocket(code, reason);
        }
    }

    public isWorking(channelId?: number): boolean {
        channelId = channelId !== undefined ? channelId : this._defaultChannelId;
        if (this._channels[channelId]) {
            return this._channels[channelId].state == NetNodeState.Working;
        }
        return false;
    }
}

export const NetMgr = NetManager.inst;
