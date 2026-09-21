import { EventMgr } from "../base/EventMgr";
import Logger from "../base/Logger";
import RedDotNode from "./RedDotNode";
import { EVENT_RED_DOT_REFRESH, RedDotConfigTable } from "./RedDotStaticConfig";

export class RedDotMgr {
    /**  固定的根结点 */
    nodeRoot: RedDotNode = new RedDotNode("nodeRoot");
    /** 生成的结点表 */
    nodeMap: { [key: string]: RedDotNode } = {};

    private static _inst: RedDotMgr | null = null;
    public static get inst(): RedDotMgr {
        if (this._inst == null) {
            this._inst = new RedDotMgr();
        }
        return this._inst;
    }

    init() {
        this.nodeMap[this.nodeRoot.name!] = this.nodeRoot;
    }

    /**
     * 根据配置表创建, 私有方法
     * @param t 配置数据
     * @returns 生成结点表
     */
    private _createWithConfig(config: RedDotConfigTable) {
        for (const key in config) {
            const nodeCfg = config[key];
            const names = nodeCfg.parent.split("|");
            names.forEach((name, i) => {
                let node = this.nodeMap[name];
                if (node == null) {
                    let parent = this.getNodeByName(names[i - 1]);
                    if (!parent) {
                        parent = this.nodeRoot;
                    }
                    node = new RedDotNode(name);
                    if (nodeCfg.func) {
                        node.setCalculateFunc(nodeCfg.func);
                        if (nodeCfg.param) {
                            node.setCalculateParam(nodeCfg.param);
                        }
                    }
                    parent.addChild(node);
                    this.nodeMap[name] = node;
                }
            });
        }
    }

    /** 根据表创建， 会与已有的红点进行查重，如果重复会报错 */
    public createWithConfig(t: RedDotConfigTable) {
        // this.init();
        for (const key in t) {
            if (this.nodeMap[key] != null) {
                Logger.warn("重复配置key:", key);
                return;
            }
        }
        this._createWithConfig(t);
    }

    /** 根据红点名称 获取红点逻辑组件 */
    getNodeByName(nodeName: string) {
        return this.nodeMap[nodeName];
    }

    /** 重新计算， 这里要抛事件 */
    reCalculate(nodeName: string) {
        let node = this.getNodeByName(nodeName);
        if (node) {
            node.clearResult_Children();
            node.clearResult_Parent();
            this.nodeRoot.getResult();
            EventMgr.emit(EVENT_RED_DOT_REFRESH);
        }
    }
}
