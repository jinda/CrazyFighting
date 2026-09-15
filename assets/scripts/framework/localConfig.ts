import { _decorator, resources } from "cc";
import { CSVManager } from "./csvManager";
import { ResourceUtil } from "./resourcesUtils";
import Constants from "./constants";
const { ccclass } = _decorator;

@ccclass("localConfig")
export class localConfig {
    /* class member could be defined like this */
    private static _instance: localConfig;
    private _csvManager: CSVManager = new CSVManager();

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new localConfig();
        return this._instance;
    }

    //成功回调不接收错误参数；所有失败路径统一走 _finishLoad -> _errCallback
    private _callback: () => void = null!;
    private _errCallback: (err: Error) => void = null!;
    private _failList: string[] = [];
    private _isFinished: boolean = false;
    private _timeoutId: any = null;
    private _currentLoad: number = 0;
    private _cntLoad: number = 0;

    /**
     * 加载配置文件
     * @param cb 成功回调
     * @param errCb 失败回调（超时/加载失败/空目录都会走到这里）
     */
    public loadConfig(cb: () => void, errCb?: (err: Error) => void) {
        this._callback = cb;
        this._errCallback = errCb || null!;
        this._failList = [];
        this._currentLoad = 0;
        this._cntLoad = 0;
        this._isFinished = false;

        //兜底超时：即使资源层一个回调都不给，也不能让玩家永久停在黑屏
        //超时必须走 _finishLoad 统一出口（走失败回调），禁止直接调用成功回调
        this._timeoutId = setTimeout(() => {
            this._finishLoad("load config timeout");
        }, Constants.LOAD_CONFIG_TIMEOUT);

        this._loadCSV();
    }

    private _loadCSV() {
        //新增数据表 请往该数组中添加....
        resources.loadDir("datas", (err: any, assets) => {
            //迟到回调保护：超时/失败已结束后，迟到的资源结果不再进入完成流程
            if (this._isFinished) {
                return;
            }

            if (err || !assets || !assets.length) {
                this._finishLoad(`loadDir datas failed: ${err}`);
                return;
            }

            let arrCsvFiles = assets.filter((item: any) => {
                return item._native !== ".md";
            });

            this._cntLoad = arrCsvFiles.length;

            //一张表都没有：直接走错误流程，避免上层一直等不到回调
            if (!arrCsvFiles.length) {
                this._finishLoad("no csv in datas");
                return;
            }

            //客户端加载
            if (arrCsvFiles.length) {
                arrCsvFiles.forEach((item, index, array) => {
                    ResourceUtil.getTextData(item.name, (err: any, content: any) => {
                        if (err || !content) {
                            console.error(`[localConfig] 配置表加载失败：${item.name}`, err);
                            this._failList.push(item.name);
                        } else {
                            this._csvManager.addTable(item.name, content);
                        }

                        this._tryToCallbackOnFinished();
                    });
                });
            } else {
                this._tryToCallbackOnFinished();
            }
        });
    }

    /**
     * 查询一条表内容
     * @param {string} tableName 表名
     * @param {string} key 列名
     * @param {any} value 值
     * @returns {Object} 一条表内容
     */
    public queryOne(tableName: string, key: string, value: any) {
        return this._csvManager.queryOne(tableName, key, value);
    }

    /**
     * 根据ID查询一条表内容
     * @param {string}tableName 表名
     * @param {string}ID
     * @returns {Object} 一条表内容
     */
    public queryByID(tableName: string, ID: string) {
        return this._csvManager.queryByID(tableName, ID);
    }

    /**
     * 根据表名获取表的所有内容
     * @param {string} tableName  表名
     * @returns {object} 表内容
     */
    public getTable(tableName: string) {
        return this._csvManager.getTable(tableName);
    }

    /**
     * 根据表名获取表的所有内容
     * @param {string} tableName  表名
     * @returns {object} 表内容
     */
    public getTableArr(tableName: string) {
        return this._csvManager.getTableArr(tableName);
    }

    /**
     * 查询key和value对应的所有行内容
     * @param {string} tableName 表名
     * @param {string} key 列名
     * @param {any} value 值
     * @returns {Object}
     */
    public queryAll(tableName: string, key: string, value: any) {
        return this._csvManager.queryAll(tableName, key, value);
    }

    //
    /**
     * 选出指定表里所有 key 的值在 values 数组中的数据，返回 Object，key 为 ID
     * @param {string} tableName 表名
     * @param {string} key  列名
     * @param {Array}values 数值
     * @returns
     */
    public queryIn(tableName: string, key: string, values: any[]) {
        return this._csvManager.queryIn(tableName, key, values);
    }

    /**
     * 选出符合条件的数据。condition key 为表格的key，value 为值的数组。返回的object，key 为数据在表格的ID，value为具体数据
     * @param {string} tableName 表名
     * @param {any} condition 筛选条件
     * @returns
     */
    public queryByCondition(tableName: string, condition: any) {
        return this._csvManager.queryByCondition(tableName, condition);
    }

    /**
     * 选出第一个符合条件的数据。condition key 为表格的key，value 为值的数组。返回的object，key 为数据在表格的ID，value为具体数据
     * @param {string} tableName 表名
     * @param {any} condition 筛选条件
     * @returns
     */
    public queryOneByCondition(tableName: string, condition: any) {
        return this._csvManager.queryOneByCondition(tableName, condition);
    }

    private _tryToCallbackOnFinished() {
        this._currentLoad++;

        if (this._currentLoad >= this._cntLoad) {
            this._finishLoad(this._failList.length ? `table load failed: ${this._failList.join(",")}` : "");
        }
    }

    /**
     * 结束加载流程：成功、部分失败、超时都从这里统一出口
     * @param errorMsg 空字符串表示成功；非空则只报错、不进入正常流程（由上层给出提示）
     */
    private _finishLoad(errorMsg: string) {
        if (this._isFinished) {
            return;
        }

        this._isFinished = true;

        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }

        if (errorMsg) {
            console.error(`[localConfig] 配置表加载异常：${errorMsg}`);
            this._errCallback && this._errCallback(new Error(errorMsg));
            return;
        }

        this._callback && this._callback();
    }
}
