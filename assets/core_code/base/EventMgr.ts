import { DoubleList } from "./DoubleList";

interface IEventHandler {
    event: string;
    cb: Function;
    thisArg: any;
    once: boolean;
    args: any[] | undefined;
}

/**
 * 事件派发器，用于管理事件的派发和监听
 *
 * 相对原实现的改动：
 * 1. emit 不再每次分配 `[arg0..arg4]` 数组，改为按实参个数直接 call。高频事件（触摸移动、掉币、
 *    金币变更）从"每次 1 个数组"降到 0 分配。
 * 2. once 真正生效：触发后立即从链表移除。原来 once 只写进字段、emit 从不检查，等于永久监听。
 * 3. 新增 offTarget(thisArg)：一次性摘掉某个 target 的全部监听。UIController.close() 会调用它，
 *    避免"忘了 off"导致 controller + 节点常驻。
 * 4. 事件清空后从 map 里删除，避免大量一次性事件名长期占位。
 *
 * 兼容性：对外 API 与签名保持原样（on/once/off/clearAll/emit/inst）。
 * 唯一放宽的是 off 的 once 参数：不传时不再要求严格相等，这样 on(e,cb,this) 配 off(e,cb,this)
 * 的老写法行为不变。
 */
class EventManager {
    private static _inst: EventManager | null = null;
    public static get inst(): EventManager {
        if (this._inst == null) {
            this._inst = new EventManager();
        }
        return this._inst;
    }

    /** 事件名 → 监听链表 */
    private _handlersMap: Map<string, DoubleList> = new Map();

    public on(event: string, cb: Function, thisArg?: any, args?: any[], once: boolean = false): void {
        if (!event || !cb) {
            return;
        }

        let handlers = this._handlersMap.get(event);
        if (!handlers) {
            handlers = new DoubleList();
            this._handlersMap.set(event, handlers);
        }

        const h: IEventHandler = { event: event, cb: cb, thisArg: thisArg, once: once, args: args };
        handlers.addToTail(h);
    }

    public once(event: string, cb: Function, thisArg?: any, args?: any[]): void {
        this.on(event, cb, thisArg, args, true);
    }

    /**
     * 摘除监听。
     * - 传 cb：按 cb + thisArg（+ once，若显式给了）匹配；
     * - 不传 cb：清空该事件下的全部监听。
     */
    public off(event: string, cb?: Function, thisArg?: any, once?: boolean): void {
        const handlers = this._handlersMap.get(event);
        if (!handlers) {
            return;
        }

        if (!cb) {
            handlers.clear();
            this._handlersMap.delete(event);
            return;
        }

        handlers.forEach((v) => {
            const h = v.data as IEventHandler;
            if (h.cb === cb && h.thisArg === thisArg && (once === undefined || h.once === once)) {
                v.dispose();
            }
        });

        if (handlers.isEmpty) {
            this._handlersMap.delete(event);
        }
    }

    /**
     * 按 target 批量摘除（UIController.close 使用）。
     * 相比"逐个 off"更可靠：漏写一个 off 也不会把 controller 钉死在事件表里。
     */
    public offTarget(thisArg: any): void {
        this._handlersMap.forEach((handlers, event) => {
            handlers.forEach((v) => {
                if ((v.data as IEventHandler).thisArg === thisArg) {
                    v.dispose();
                }
            });
            if (handlers.isEmpty) {
                this._handlersMap.delete(event);
            }
        });
    }

    public clearAll(event?: string): void {
        if (event) {
            const handlers = this._handlersMap.get(event);
            handlers?.clear();
            this._handlersMap.delete(event);
        } else {
            this._handlersMap.forEach((handlers) => handlers.clear());
            this._handlersMap.clear();
        }
    }

    /**
     * 派发事件。
     * 注意：最多透传 5 个参数（与原实现一致）。
     * 这里用 `arguments.length` 分支而不是构造数组，是为了让热路径零分配。
     */
    public emit(event: string, arg0?: any, arg1?: any, arg2?: any, arg3?: any, arg4?: any): void {
        const handlers = this._handlersMap.get(event);
        if (!handlers || handlers.isEmpty) {
            return;
        }

        const argc = arguments.length;
        let cur = handlers.head;
        while (cur) {
            // 先取 next：回调里可能 off / close 导致当前节点被回收
            const next = cur.next;
            const h = cur.data as IEventHandler;

            // once 先摘再调，避免回调内重入 emit 时重复触发
            if (h.once) {
                cur.dispose();
            }

            switch (argc) {
                case 1:
                    h.cb.call(h.thisArg);
                    break;
                case 2:
                    h.cb.call(h.thisArg, arg0);
                    break;
                case 3:
                    h.cb.call(h.thisArg, arg0, arg1);
                    break;
                case 4:
                    h.cb.call(h.thisArg, arg0, arg1, arg2);
                    break;
                case 5:
                    h.cb.call(h.thisArg, arg0, arg1, arg2, arg3);
                    break;
                default:
                    h.cb.call(h.thisArg, arg0, arg1, arg2, arg3, arg4);
                    break;
            }

            cur = next;
        }

        if (handlers.isEmpty) {
            this._handlersMap.delete(event);
        }
    }
}

export const EventMgr = EventManager.inst;
