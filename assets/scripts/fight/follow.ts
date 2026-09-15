import { FighterManager } from './fighterManager';
import { _decorator, Component, Vec3, CameraComponent, Tween, lerp, CCInteger, Node } from "cc";
import { GameLogic } from "../framework/gameLogic";
import { Fighter } from './fighter';
//相机脚本
const { ccclass, property } = _decorator;
@ccclass("Follow")
export class Follow extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;
    @property(CameraComponent)
    public camera:CameraComponent = null!;//相机组件

    @property({type: CCInteger})
    public originFov: number = 40;//相机视角大小

    private _manager: FighterManager = null!;//“管理所有士兵”的脚本
    private _posTween: Vec3 = new Vec3();//缓动的目标位置
    private _rotateTween: Vec3 = new Vec3();//缓动的目标角度
    private _tweenMove: any = null!;//移动缓动对象
    private _tweenRotate: any = null!;//角度缓动对象
    private _tweenHeight: any = null!;//高度缓动对象
    private _orthoHeight: {value: number} = {value: 0}//相机视角高度
    private _originPosAfterStart: Vec3 = new Vec3(-16, 22, 16);//开始游戏后相机的目标位置
    private _isStartFollow: boolean = false;//相机是否开启跟随
    private _adjustCoolTime: number = 3;//3秒后才开始计算目标高度
    private _targetHeight: number = -1;//相机目标高度
    private _nextPos: Vec3 = new Vec3();//相机下一步位置
    private _targetPos: Vec3 = null!;//目标位置

    onLoad () {
        GameLogic.mainCamera = this.camera;
    }

    start () {
        // Your initialization goes here.
    }

    /**
     * 初始化相机
     *
     * @param {boolean} isFirstLevel
     * @memberof Follow
     */
    public initCamera (isFirstLevel: boolean) {
        //当前视角
        this.node.setWorldPosition(-27.6, 21, 0);
        this.node.setWorldRotationFromEuler(-60, -90, 0);

        //正面视角
        // this.node.setWorldPosition(new Vec3(10, 19, 0));
        // this.node.setWorldRotationFromEuler(-45, 90, 0);

        this._targetPos = null!;
        this._isStartFollow = false;

        //相机视角高度
        this.camera.orthoHeight = 10;

        //相机视角大小
        this.camera.fov = this.originFov;

        //重置以下缓动对象
        if (this._tweenMove) {
            this._tweenMove.stop();
            this._tweenMove = null;
        }

        if (this._tweenRotate) {
            this._tweenRotate.stop();
            this._tweenRotate = null;
        }

        if (this._tweenHeight) {
            this._tweenHeight.stop();
            this._tweenHeight = null;
        }

        //第一关专属视角
        if (isFirstLevel) {
            this.node.setWorldPosition(this._originPosAfterStart);
            this.node.setWorldRotationFromEuler(-45, -45, 0);
        }
    }

    /**
     * 游戏开始后设置相机的位置和角度
     * @param manager 
     */
    public startGame (manager: FighterManager) {
        this._manager = manager;
        this.node.getWorldPosition(this._posTween);
        this._rotateTween.set(this.node.eulerAngles);
        this._orthoHeight.value = this.camera.orthoHeight;
        
        //不直接修改node，只为了更方便调试
        this._tweenMove = new Tween(this._posTween).to(1, {x: this._originPosAfterStart.x, y: this._originPosAfterStart.y, z:this._originPosAfterStart.z}).call(()=>{
            this._tweenMove = null;

            this._targetPos = null!;
            this._isStartFollow = true;
            this._adjustCoolTime = 3;//开始
        }).start();

        this._tweenRotate = new Tween(this._rotateTween).to(1, {x: -45, y: -45, z: 0}).call(()=>{
            this._tweenRotate = null;
        }).start();
    }

    update (deltaTime: number) {
        // Your update function goes here.
        if (this._tweenMove) {

            //更新相机位置和角度
            this.node.setWorldPosition(this._posTween);
            this.node.setWorldRotationFromEuler(this._rotateTween.x, this._rotateTween.y, this._rotateTween.z);

            this.camera.orthoHeight = this._orthoHeight.value;
        } else if (this._isStartFollow) {
            if (!this._manager.isGameOver) {
                this._adjustCoolTime -= deltaTime;

                if (this._adjustCoolTime < 0) { //每隔0.5秒计算所有士兵的区域边界
                    this._adjustCoolTime = 0.5;
                    let cnt = 0, sumX = 0, sumZ = 0;
                    let minX = 999999, maxX = -999999, minZ = 999999, maxZ = -999999;
                    for (let team in this._manager.dictFighter) {
                        let dict = this._manager.dictFighter[team];
                        for (let identity in dict) {
                            cnt++;

                            let posX = dict[identity].position.x;
                            let posZ = dict[identity].position.z;
                            sumX += posX;
                            sumZ += posZ;

                            //算出最小x
                            if (minX > posX) {
                                minX = posX;
                            } 

                            //算出最大x
                            if (maxX < posX) {
                                maxX = posX;
                            }

                            //算出最大z
                            if (minZ > posZ) {
                                minZ = posZ;
                            } 
                            
                            //算出最大z
                            if (maxZ < posZ) {
                                maxZ = posZ;
                            }
                        }
                    }

                    let offsetX = maxX - minX;
                    let offsetZ = maxZ - minZ;
                    
                    // console.log(offsetX, offsetZ);
                    this._targetPos = new Vec3(this._originPosAfterStart.x + offsetX / 2 + minX, this._originPosAfterStart.y, this._originPosAfterStart.z + offsetZ / 2 + minZ);

                    //边长（由面积算出的平方根）
                    let  distance = Math.sqrt(offsetX*offsetX + offsetZ*offsetZ);

                    //相机目标高度（目前的一个转换规则，但不是很贴合）
                    this._targetHeight = Math.round(distance * 4); 
                    this._targetHeight = this._targetHeight < this.originFov - 10 ? this.originFov - 10: this._targetHeight;
                    
                } else if (this._targetPos) {//如果有目标位置，则相机位置和相机视角大小慢慢过渡过去

                    //士兵存活数量
                    let surviveNum = 0;

                    for (const key in this._manager.dictFighter) {
                        const team = this._manager.dictFighter[key];
                        
                        for (const identity in team) {
                            const ndFighter = team[identity] as Node;
                            const scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
                            if (!scriptFighter.isDead) {
                                surviveNum += 1;
                            }
                        }
                    }

                    // console.log("surviveNum", surviveNum);

                    //两方都阵亡则不改变相机状态
                    if (surviveNum > 0) {
                        Vec3.lerp(this._nextPos, this.node.position, this._targetPos, 1 * deltaTime);
                        this.node.position = this._nextPos;

                        if (this._targetHeight > 0) {
                            let height = lerp(this.camera.fov, this._targetHeight, 1 * deltaTime);
                            this.camera.fov = height;
                        }
                    } 
                }
            } else {
                this._isStartFollow = false;
            }
        }
    }
}
