/**
 * 网络数据管理器
 */

window.onerror = function (message, source, lineno, colno, error) {
    egf.Logger.error("捕获到全局错误: ", message, source, lineno, colno, error);
    return true; // 返回true可以阻止错误冒泡
};
export interface IMaintenance {
    isUpdating?: boolean;
    content?: {
        title: string;
        text: string;
    };
    whitelist?: number[];
}

export class DataMgr {
    private static _inst: DataMgr;
    public static get inst(): DataMgr {
        if (this._inst == null) {
            this._inst = new DataMgr();
        }
        return this._inst;
    }

    public maintenance: IMaintenance = {}; // 维护信息
}
