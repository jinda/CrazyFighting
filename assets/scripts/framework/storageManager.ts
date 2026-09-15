import { _decorator, sys, log } from "cc";
import Constants from "./constants";
import { Util } from "./util";

const { ccclass } = _decorator;

@ccclass("StorageManager")
export class StorageManager {
    private static _instance: StorageManager;

    public static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new StorageManager();
        this._instance.start();
        return this._instance;
    }

    private _jsonData: { [key: string]: any } = {};
    private KEY_CONFIG: string = Constants.GAME_NAME;
    private _markSave: boolean = false;
    private _saveTimer: number = -1;
    private _saveFailCount: number = 0; //连续写入失败次数，达到上限后停止重试（内存数据仍在，避免无限报错刷屏）
    private static MAX_SAVE_RETRY: number = 5;

    start() {
        this._jsonData = {
            userId: "",
        };

        let content = sys.localStorage.getItem(this.KEY_CONFIG);

        if (content && content.length) {
            const rawContent = content;

            try {
                if (content.startsWith("@")) {
                    content = content.substring(1);
                    content = Util.decrypt(content);
                }

                //初始化操作
                let jsonData = JSON.parse(content);
                if (!jsonData || typeof jsonData !== "object" || Array.isArray(jsonData)) {
                    throw new Error("save data is not a valid object");
                }

                this._jsonData = jsonData;
                this._saveFailCount = 0;
            } catch (excepaiton) {
                //解析/解密失败：不再静默吞掉。原始密文隔离到独立 key，避免坏档被下次 save() 覆盖，
                //方便后续诊断或找回进度；内存中先用默认结构，游戏按新档继续
                console.error(
                    "[StorageManager] 存档解析失败，原始数据已隔离到 " + this.KEY_CONFIG + "_corrupted：",
                    excepaiton,
                );
                try {
                    sys.localStorage.setItem(this.KEY_CONFIG + "_corrupted", rawContent);
                } catch (quotaEx) {
                    console.error("[StorageManager] 隔离损坏存档失败：", quotaEx);
                }
            }
        }

        //每隔5秒保存一次数据，主要是为了保存最新在线时间，方便离线奖励时间判定
        this._saveTimer = setInterval(() => {
            this.scheduleSave();
        }, 5000);
    }

    /**
     * 存储配置文件，不保存到本地
     * @param {string}key  关键字
     * @param {any}value  存储值
     */
    public setConfigDataWithoutSave(key: string, value: any) {
        let account: string = this._jsonData.userId;
        if (this._jsonData[account]) {
            this._jsonData[account][key] = value;
        } else {
            console.error("no account can not save");
        }
    }

    /**
     * 存储配置文件，保存到本地
     * @param {string}key  关键字
     * @param {any}value  存储值
     */
    public setConfigData(key: string, value: any) {
        this.setConfigDataWithoutSave(key, value);
        this._markSave = true; //标记为需要存储，避免一直在写入，而是每隔一段时间进行写入
    }

    /**
     * 根据关键字获取数值
     * @param {string} key 关键字
     * @returns
     */
    public getConfigData(key: string) {
        let account: string = this._jsonData.userId;
        if (this._jsonData[account]) {
            let value = this._jsonData[account][key];
            //用 nullish 判断替代 truthy 判断：合法的 0、false 不再被转成空字符串
            return value ?? "";
        } else {
            log("no account can not load");
            return "";
        }
    }

    /**
     * 设置全局数据
     * @param {string} key 关键字
     * @param {any}value  存储值
     * @returns
     */
    public setGlobalData(key: string, value: any) {
        this._jsonData[key] = value;
        this.save();
    }

    /**
     * 获取全局数据
     * @param {string} key 关键字
     * @returns
     */
    public getGlobalData(key: string) {
        return this._jsonData[key];
    }

    /**
     * 设置用户唯一标示符
     * @param {string} userId 用户唯一标示符
     * @param {any}value  存储值
     * @returns
     */
    public setUserId(userId: string) {
        this._jsonData.userId = userId;
        if (!this._jsonData[userId]) {
            this._jsonData[userId] = {};
        }

        this.save();
    }

    /**
     * 获取用户唯一标示符
     * @returns {string}
     */
    public getUserId() {
        return this._jsonData.userId;
    }

    /**
     * 释放定时存档（切场景/退出游戏时调用）
     * 同时让 _saveTimer 有读取路径，避免"只写不读"的死字段
     */
    public dispose() {
        if (this._saveTimer !== -1) {
            clearInterval(this._saveTimer);
            this._saveTimer = -1;
        }
    }

    /**
     * 定时存储
     * @returns
     */
    public scheduleSave() {
        if (!this._markSave) {
            return;
        }

        this.save();
    }

    /**
     * 标记为已修改
     */
    public markModified() {
        this._markSave = true;
    }

    /**
     * 保存配置文件
     * @returns
     */
    public save() {
        // 写入文件
        let str = JSON.stringify(this._jsonData);
        let zipStr = "@" + Util.encrypt(str);

        try {
            sys.localStorage.setItem(this.KEY_CONFIG, zipStr);

            //只有写入成功才清除脏标记：配额满/平台写入失败时保留待保存状态，
            //由 5 秒定时器继续重试；连续失败达到上限后停止重试，避免无限刷错
            this._markSave = false;
            this._saveFailCount = 0;
        } catch (e) {
            this._saveFailCount++;

            if (this._saveFailCount >= StorageManager.MAX_SAVE_RETRY) {
                //停止重试：本地进度可能无法继续保存，至少把现场打出来
                console.error("[StorageManager] 存档连续写入失败，已停止自动重试：", e);
                this._markSave = false;
            } else {
                console.error(
                    `[StorageManager] 存档写入失败(${this._saveFailCount}/${StorageManager.MAX_SAVE_RETRY})，稍后重试：`,
                    e,
                );
            }
        }
    }
}
