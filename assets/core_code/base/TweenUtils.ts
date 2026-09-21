import { Node, v3, instantiate, tween, Vec3, Tween, Vec2, NodePool, Game, game } from "cc";

var timeScale = 1;
//@ts-ignore
game._calculateDT = function (now: number) {
    if (!now) now = performance.now();
    this._deltaTime = now > this._startTime ? (now - this._startTime) / 1000 : 0;
    if (this._deltaTime > Game.DEBUG_DT_THRESHOLD) {
        this._deltaTime = this.frameTime / 1000;
    }
    this._startTime = now;
    return this._deltaTime * timeScale;
};

export class TweenUtils {
    public static goldFlyAction(
        orgNode: Node,
        targetPos: Vec3,
        count: number = 5,
        r: number = 100,
        nodePool?: NodePool | null,
        callback?: Function,
    ) {
        // 以某点为圆心，生成圆周上等分点的坐标
        const points = new Array<Vec3>();
        const radians = (Math.PI / 180) * Math.round(360 / count);
        const orgPos = orgNode.worldPosition;
        const orgScaleX = orgNode.scale.x;
        // egf.Logger.log('orgPos:', orgPos);
        const randomScope = r / 2;
        for (let i = 0; i < count; i++) {
            const x = orgPos.x + r * Math.sin(radians * i) + Math.random() * randomScope;
            const y = orgPos.y + r * Math.cos(radians * i) + Math.random() * randomScope;
            // egf.Logger.log('point:', x, y);
            points.push(v3(x, y, 0));
        }
        // egf.Logger.log('points:', points);

        // 生成分点上的金币。
        // 注意：orgNode 只能作为“模板”使用，这里必须始终实例化克隆体来飞。
        // 若让 orgNode 自己参与动画，动画结束时的回收分支会 destroy/put 掉 orgNode，
        // 导致调用方（如 UI_HUD_Impl.showCoinFly / UI_Fighter.onDropCoin）持有的模板节点
        // 在第一次播完动画后失效，第二次调用 isValid() 就为 false（且 scale 已被改成 0）。
        let coinNodeList = points.map((pos: Vec3) => {
            let coin: Node;
            if (nodePool) {
                coin = nodePool.get() || instantiate(orgNode);
            } else {
                coin = instantiate(orgNode);
            }
            coin.parent = orgNode.parent;
            coin.scale = orgNode.scale.clone();
            coin.setWorldPosition(orgPos);
            coin.active = true;

            const flx = tween(coin)
                .to(0.2, { scale: v3(-orgScaleX, orgScaleX) })
                .to(0.2, { scale: v3(orgScaleX, orgScaleX) });

            tween(coin).repeatForever(flx).start();

            return {
                node: coin,
                stPos: orgPos,
                mdPos: pos,
                edPos: targetPos,
                dis: v3(pos.x, pos.y, pos.z).subtract(targetPos).length(),
            };
        });
        coinNodeList = coinNodeList.sort((a, b) => {
            if (a.dis - b.dis > 0) return 1;
            if (a.dis - b.dis < 0) return -1;
            return 0;
        });

        // 执行金币落袋的动画
        const time = (6 / count) * 0.1;
        coinNodeList.forEach((item, idx) => {
            item.node.scale = v3(0, 0, 0);
            tween(item.node)
                .to(0.3, { worldPosition: item.mdPos, scale: v3(orgScaleX, orgScaleX) })
                .delay(idx * time)
                .to(0.5, {
                    worldPosition: item.edPos,
                    scale: v3(orgScaleX / 2, orgScaleX / 2),
                })
                // .delay(3)
                .call(() => {
                    Tween.stopAllByTarget(item.node);
                    callback && callback(item.node);
                    if (nodePool) {
                        nodePool.put(item.node);
                    } else {
                        item.node.destroy();
                    }
                })
                .start();
        });
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
