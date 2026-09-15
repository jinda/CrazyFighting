import { _decorator } from "cc";
const { ccclass, property } = _decorator;

@ccclass("ClientEvent")
export class ClientEvent {
    private static _handlers: { [key: string]: any[] } = {};

    /**
     * 监听事件
     * @param {string} eventName 事件名称
     * @param {function} handler 监听函数
     * @param {object} target 监听目标
     */
    public static on (eventName: string, handler: Function, target: any) {
        let objHandler: {} = {handler: handler, target: target};
        let handlerList: Array<any> = ClientEvent._handlers[eventName];
        if (!handlerList) {
            handlerList = [];
            ClientEvent._handlers[eventName] = handlerList;
        }

        for (let i = 0; i < handlerList.length; i++) {
            if (!handlerList[i]) {
                handlerList[i] = objHandler;
                return i;
            }
        }

        handlerList.push(objHandler);

        return handlerList.length;
    };

    /**
     * 取消监听
     * @param {string} eventName 监听事件
     * @param {function} handler 监听函数
     * @param {object} target 监听目标
     */
    public static off (eventName: string, handler: Function, target: any) {
        let handlerList = ClientEvent._handlers[eventName];

        if (!handlerList) {
            return;
        }

        for (let i = 0; i < handlerList.length; i++) {
            let oldObj = handlerList[i];
            if (oldObj.handler === handler && (!target || target === oldObj.target)) {
                handlerList.splice(i, 1);
                break;
            }
        }
    };

    /**
     * 分发事件
     * @param {string} eventName 分发事件名
     * @param  {...any} params 分发事件参数
     */
    public static dispatchEvent (eventName: string, ...args: any) {
        let handlerList = ClientEvent._handlers[eventName];

        if (!handlerList) {
            return;
        }

        //遍历快照：监听回调里可能会 off() 掉其它监听（引导系统的 WAIT_EVENT 就是这样），
        //直接遍历原数组会因为 splice 而漏掉后面的监听
        let arrSnapshot = handlerList.slice();

        for (let i = 0; i < arrSnapshot.length; i++) {
            let objHandler = arrSnapshot[i];
            if (objHandler && objHandler.handler) {
                objHandler.handler.apply(objHandler.target, args);
            }
        }
    };
}
