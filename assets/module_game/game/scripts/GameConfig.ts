import { ModuleDef } from "db://assets/scripts/ModuleDef";
import { CSVManager } from "./CSVManager";

class GameConfig {
    /* class member could be defined like this */
    private static _instance: GameConfig;
    private _csvManager: CSVManager = new CSVManager();

    static get inst() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new GameConfig();
        return this._instance;
    }

    public loadConfig() {
        const fighterContent = egf.ResMgr.getAsset(ModuleDef.GAME, "data/fighter");
        this._csvManager.addTable("fighter", fighterContent);

        const levelContent = egf.ResMgr.getAsset(ModuleDef.GAME, "data/level");
        this._csvManager.addTable("level", levelContent);
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
}

export const GameCfg = GameConfig.inst;
