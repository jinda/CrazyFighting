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

    start() {
        this._jsonData = {
            userId: "",
        };

        let content = sys.localStorage.getItem(this.KEY_CONFIG);

        if (content && content.length) {
            if (content.startsWith("@")) {
                content = content.substring(1);
                content = Util.decrypt(content);
            }

            try {
                //初始化操作
                let jsonData = JSON.parse(content);
                this._jsonData = jsonData;
            } catch (excepaiton) {}
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
            return value ? value : "";
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

        this._markSave = false;
        sys.localStorage.setItem(this.KEY_CONFIG, zipStr);
    }
}
