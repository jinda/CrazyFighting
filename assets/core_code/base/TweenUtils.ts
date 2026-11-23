import { Node, v3, instantiate, tween, Vec3, Tween, Vec2, NodePool, Game, game } from "cc";

var timeScale = 1;
//覆写引擎的帧间隔计算实现全局时间缩放：_deltaTime/_startTime 为引擎内部字段，未在类型声明公开，故借 any 视图访问
const gameInternal = game as any;
gameInternal._calculateDT = function (this: any, now: number) {
    if (!now) now = performance.now();
    this._deltaTime = now > this._startTime ? (now - this._startTime) / 1000 : 0;
    if (this._deltaTime > Game.DEBUG_DT_THRESHOLD) {
        this._deltaTime = this.frameTime / 1000;
    }
    this._startTime = now;
    return this._deltaTime * timeScale;
};

/**
 * 单次飞金币最多生成的可视节点数。
 * 8 个以上在视觉上已无法分辨，多出来的只会增加 drawcall 与 GC。
 * 若策划要求"数值越大越密"，调到 12~16，但不要恢复成按数值 1:1。
 */
const MAX_FLY_NODE = 8;

/** 模板节点 → 对象池。用 WeakMap 而不是按名字索引：
 *  - 不同界面里可能都有名为 "SpriteCoin" 的节点，按名字会共用一个池，导致外观串台；
 *  - 模板节点随界面销毁后，WeakMap 条目自动失效，池里的游离节点也会被 GC 回收，
 *    不会出现"池子永久持有某套贴图"的隐性泄漏。 */
const _flyPools: WeakMap<Node, NodePool> = new WeakMap();

function getFlyPool(template: Node): NodePool {
    let pool = _flyPools.get(template);
    if (!pool) {
        pool = new NodePool();
        _flyPools.set(template, pool);
    }
    return pool;
}

export class TweenUtils {
    /**
     * 金币（或任意模板节点）圆周散开 → 收束飞向目标点。
     *
     * 相对原实现的改动：
     * 1. 视觉数量与金币数值解耦：原来把"金币数值"直接当节点数量用，
     *    Constants.awardCoin = 500 时一次调用会 instantiate 500 个节点 + 起 1000 条 tween。
     *    现在钳制到 MAX_FLY_NODE 个，数值只影响数量级，不再 1:1 建节点。
     * 2. 节点走 NodePool 复用，飞完回池而不是 destroy，避免"领奖→重建→GC"的循环。
     * 3. 每个金币只保留 1 条 tween。原来另有 1 条 repeatForever 的翻转 tween 与飞行 tween
     *    同时写 coin.scale，两者每帧互相覆盖（视觉抖动），已去掉。
     * 4. 返回 cancel 句柄：UI 关闭 / 界面销毁时调用，立即停 tween 并回池。
     *    原实现若在飞行中关闭界面，tween 会继续跑完并 destroy 一个已随父节点销毁的节点。
     *
     * @param orgNode   模板节点（只作为克隆源与起始位置，自身不参与动画）
     * @param targetPos 收束终点（通常是金币按钮的世界坐标）
     * @param count     金币数值：仅用于决定视觉数量与节奏，不再是节点数量
     * @param r         散开半径
     * @param nodePool  可选外部对象池，不传则按模板名内部维护
     * @param callback  全部飞完（且未被取消）后回调一次
     * @returns 取消句柄：界面关闭时调用，立即停止并回收节点
     */
    public static goldFlyAction(
        orgNode: Node,
        targetPos: Vec3,
        count: number = 5,
        r: number = 100,
        nodePool?: NodePool | null,
        callback?: Function,
    ): () => void {
        const parent = orgNode.parent;
        if (!parent || !orgNode.isValid) {
            return () => void 0;
        }

        const pool = nodePool ?? getFlyPool(orgNode);
        // 数值 → 视觉数量：多则密，但有上限
        const visualCount = Math.max(1, Math.min(MAX_FLY_NODE, Math.ceil(count > 0 ? count : 1)));

        const orgPos = orgNode.worldPosition;
        const orgScale = orgNode.scale;
        const scaleX = orgScale.x;
        const scaleY = orgScale.y;
        const scaleZ = orgScale.z;

        const step = (Math.PI * 2) / visualCount;
        const randomScope = r * 0.5;
        // 拖尾间隔：让 8 个币不要同时到达，否则看起来像一次性闪现
        const gap = visualCount > 1 ? Math.min(0.06, 0.5 / visualCount) : 0;

        // 终点做一次拷贝：按钮可能在飞行中移动，拷贝后终点保持稳定
        const endPos = v3(targetPos.x, targetPos.y, targetPos.z);

        const coins: Node[] = [];
        const mids: Vec3[] = [];
        const dists: number[] = [];
        let maxDist = 0;

        for (let i = 0; i < visualCount; i++) {
            const angle = step * i;
            const mid = v3(
                orgPos.x + r * Math.sin(angle) + Math.random() * randomScope,
                orgPos.y + r * Math.cos(angle) + Math.random() * randomScope,
                orgPos.z,
            );
            const dist = Vec3.distance(mid, endPos);
            mids.push(mid);
            dists.push(dist);
            if (dist > maxDist) {
                maxDist = dist;
            }

            let coin: Node | null = pool.size() > 0 ? pool.get() : null;
            if (!coin || !coin.isValid) {
                coin = instantiate(orgNode);
            }
            coin.setParent(parent);
            coin.active = true;
            coin.setWorldPosition(orgPos);
            coin.setScale(0, 0, scaleZ);
            coins.push(coin);
        }

        // 近的先落袋：按距离排序下标，避免为排序再分配对象数组
        const order: number[] = [];
        for (let i = 0; i < visualCount; i++) {
            order.push(i);
        }
        if (visualCount > 1) {
            order.sort((a, b) => dists[a] - dists[b]);
        }

        let cancelled = false;
        let left = visualCount;
        /** 每个节点是否还没回池。用于防止"回调里触发 cancel"时同一节点被 put 两次 */
        const alive: boolean[] = new Array(visualCount).fill(true);

        const recycle = (idx: number) => {
            if (!alive[idx]) {
                return;
            }
            alive[idx] = false;
            left--;
            const coin = coins[idx];
            if (!coin.isValid) {
                return;
            }
            Tween.stopAllByTarget(coin);
            coin.removeFromParent();
            pool.put(coin);
        };

        for (let k = 0; k < visualCount; k++) {
            const i = order[k];
            const coin = coins[i];
            const mid = mids[i];
            const ratio = maxDist > 0 ? dists[i] / maxDist : 0;
            const duration = 0.45 + 0.25 * ratio;

            tween(coin)
                .delay(k * gap)
                .to(duration, { worldPosition: mid, scale: v3(scaleX, scaleY, scaleZ) })
                .to(duration * 0.8, { worldPosition: endPos, scale: v3(scaleX * 0.5, scaleY * 0.5, scaleZ) })
                .call(() => {
                    recycle(i);
                    if (cancelled) {
                        return;
                    }
                    if (left === 0 && callback) {
                        callback();
                    }
                })
                .start();
        }

        return () => {
            if (cancelled) {
                return;
            }
            cancelled = true;
            for (let i = 0; i < coins.length; i++) {
                recycle(i);
            }
        };
    }

    /**
     *  二阶贝塞尔曲线 运动
     * @param target
     * @param {number} duration
     * @param {} c1 起点坐标
     * @param {} c2 控制点
     * @param {Vec3} to 终点坐标
     * @param opts
     * @returns {any}
     */
    public static bezierTo(target: Node, duration: number, c1: Vec2, c2: Vec2, to: Vec3, opts?: any) {
        opts = opts || Object.create(null);
        /**
         * @desc 二阶贝塞尔
         * @param {number} t 当前百分比
         * @param {} p1 起点坐标
         * @param {} cp 控制点
         * @param {} p2 终点坐标
         * @returns {any}
         */
        let twoBezier = (t: number, p1: Vec2, cp: Vec2, p2: Vec3) => {
            let x = (1 - t) * (1 - t) * p1.x + 2 * t * (1 - t) * cp.x + t * t * p2.x;
            let y = (1 - t) * (1 - t) * p1.y + 2 * t * (1 - t) * cp.y + t * t * p2.y;
            return v3(x, y, 0);
        };
        opts.onUpdate = (args: any, ratio: number) => {
            target.position = twoBezier(ratio, c1, c2, to);
        };

        return tween(target).to(duration, {}, opts).start();
    }

    public static setTimeScale(scale: number) {
        timeScale = scale;
    }
}
