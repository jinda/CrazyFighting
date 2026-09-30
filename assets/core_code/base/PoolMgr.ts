import { _decorator, Prefab, Node, instantiate, NodePool, isValid } from "cc";
const { ccclass } = _decorator;

@ccclass("PoolManager")
class PoolManager {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    private _dictPool: any = {};
    private _dictPrefab: any = {};

    static _inst: PoolManager | null = null;
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    static get inst() {
        if (this._inst) {
            return this._inst;
        }

        this._inst = new PoolManager();
        return this._inst;
    }

    /**
     * 根据预设从对象池中获取对应节点
     */
    public getNode(prefab: Prefab, parent: Node): Node {
        let name = prefab.name;
        //@ts-ignore
        if (!prefab.position) {
            //@ts-ignore
            name = prefab.data.name;
        }

        this._dictPrefab[name] = prefab;
        let node = null;
        if (this._dictPool.hasOwnProperty(name)) {
            //已有对应的对象池
            let pool = this._dictPool[name];
            if (pool.size() > 0) {
                node = pool.get();
            } else {
                node = instantiate(prefab);
            }
        } else {
            //没有对应对象池，创建他！
            let pool = new NodePool();
            this._dictPool[name] = pool;

            node = instantiate(prefab);
        }
        if (!isValid(node) || !isValid(parent)) {
            egf.Logger.error("Pool getNode error:", node, isValid(parent));
        }

        node.parent = parent;
        node.active = true;
        return node;
    }

    /**
     * 将对应节点放回对象池中
     */
    public putNode(node: Node) {
        if (!node) {
            return;
        }
        let name = node.name;
        let pool = null;
        if (this._dictPool.hasOwnProperty(name)) {
            //已有对应的对象池
            pool = this._dictPool[name];
        } else {
            //没有对应对象池，创建他！
            pool = new NodePool();
            this._dictPool[name] = pool;
        }

        pool.put(node);
    }

    /**
     * 根据名称，清除对应对象池
     */
    public clearPool(name: string) {
        if (this._dictPool.hasOwnProperty(name)) {
            let pool = this._dictPool[name];
            pool.clear();
        }
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}

export const PoolMgr = PoolManager.inst;
