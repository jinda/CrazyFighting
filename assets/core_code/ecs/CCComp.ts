import { _decorator, Component } from "cc";
import { ECS } from "./ECS";

const { ccclass } = _decorator;

/** 
 * 游戏显示对象组件
 * 
 * 功能介绍：
 * 1. 对象拥有 cc.Component 组件功能与 ecs.Comp 组件功能
 * 2. 对象自带全局事件监听、释放、发送全局消息功能
 * 3. 对象管理的所有节点摊平，直接通过节点名获取cc.Node对象
 * 
 * 应用场景
 * 1. 网络游戏，优先有数据对象，然后创建视图对象，当释放视图组件时，部分场景不希望释放数据对象
 * 
 * @example
@ccclass('RoleViewComp')
@ecs.register('RoleView', false)
export class RoleViewComp extends CCComp {
    @property({ type: sp.Skeleton, tooltip: '角色动画' })
    spine: sp.Skeleton = null!;

    onLoad(){
        
    }
}
 */
@ccclass("CCComp")
export abstract class CCComp extends Component implements ECS.IComp {
    static tid: number = -1;
    static compName: string;

    canRecycle!: boolean;
    ent!: ECS.Entity;

    abstract reset(): void;
}
