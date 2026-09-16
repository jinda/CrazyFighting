import {
    Node,
    Component,
    Vec2,
    Size,
    Prefab,
    instantiate,
    v3,
    ScrollView,
    v2,
    size,
    Tween,
    tween,
    UITransform,
    Vec3,
    sys,
    UIRenderer,
    isValid,
    Layout,
} from "cc";
import RenderAlternative from "./RenderAlternative";
/**边缘 */
interface IBorder {
    /**节点左边缘x世界坐标 */
    leftSide?: number;
    /**节点右边缘x世界坐标 */
    rightSide?: number;
    /**节点下边缘y世界坐标 */
    bottomSide?: number;
    /**节点上边缘y世界坐标 */
    topSide?: number;
    /**大小 */
    size?: Size;
}
type TDate = { index?: number; size?: Size };
export class ShowNode<T extends TDate> extends Component {
    private hasInit: boolean = false;
    /**渲染分层开启的挂载节点 */
    public renderLayer: Node | null = null;
    /**上级的cell */
    public cell: ItemCell<T> | null = null;
    /**数据 */
    public data: T | null = null;
    /**初始化 */
    public init(cell: ItemCell<T>, data: T, renderLayer: Node) {
        this.cell = cell;
        this.data = data;
        if (this.renderLayer != renderLayer) {
            this.renderLayer = renderLayer;
            renderLayer && this.initRenders();
        }
        this.initShow();
    }
    /**初始化操作 */
    public initShow() {}
    /**被回收，应该做一些释放的操作 */
    public onRecircle() {}
    /**
     * 在特定时间内进行大小变化
     * @param targetSize
     * @param time
     */
    public resize(targetSize: Size, time: number = 0.3) {
        this.cell?.resize(targetSize, time);
    }
    /**
     * 处理分层代理渲染
     */
    private initRenders() {
        if (!this.hasInit && this.renderLayer) {
            let propMap: WeakMap<RenderAlternative, boolean> = new WeakMap();
            let keys = Object.keys(this);
            for (let i = 0, len = keys.length; i < len; ++i) {
                let value = this[keys[i]];
                let alternative: RenderAlternative | null = null;
                if (value instanceof Node) {
                    alternative = value.getComponent(RenderAlternative);
                    if (alternative) {
                        alternative.init(this.renderLayer);
                    }
                } else if (value instanceof UIRenderer) {
                    alternative = value.getComponent(RenderAlternative);
                    if (alternative) {
                        this[keys[i]] = alternative.init<typeof value>(this.renderLayer);
                    }
                }
                alternative && propMap.set(alternative, true);
            }
            this.dealChilrenAlternative(this.node, propMap, 0, 0);
            this.hasInit = true;
        }
    }
    /**
     * 处理子节点代理
     * @param node
     * @param propMap 记录脚本已经处理过的属性代理
     * @param parentSindex 父节点的所在的顺序
     * @param depth 深度
     */
    dealChilrenAlternative(
        node: Node,
        propMap: WeakMap<RenderAlternative, boolean>,
        parentSindex: number,
        depth: number,
    ) {
        for (let i = 0, len = node.children.length; i < len; i++) {
            let children = node.children[i];
            let alternative = children.getComponent(UIRenderer)?.getComponent(RenderAlternative);
            let sIndex = parentSindex + i * Math.pow(0.1, depth);
            if (alternative) {
                if (!propMap.has(alternative) || !propMap.get(alternative)) {
                    alternative.init(this.renderLayer!);
                }
                alternative.sIndex = sIndex;
            }
            this.dealChilrenAlternative(children, propMap, sIndex, depth + 1);
        }
    }
}
export class ItemCell<T extends TDate> {
    /**持有cell的list */
    public looplist: LoopList<T> | null = null;
    /**大小处理 */
    public uiTrans: UITransform | null = null;
    /**位置节点 */
    public node: Node | null = null;
    /**显示节点 */
    public showNode: ShowNode<T> | null = null;
    /**数据下标 */
    public dataIndex: number = 0;
    /**cell下标 */
    public cellIndex: number = 0;
    /**尺寸 */
    public size: Size | null = null;
    /**数据 */
    public data: T | null = null;
    /**
     * 构造函数
     * @param node
     * @param looplist
     */
    constructor(node: Node, looplist: LoopList<T>) {
        this.node = node;
        this.looplist = looplist;
    }
    /**
     * 初始化
     * @param node 节点
     * @param data 数据
     * @param size 大小
     * @param dataIndex 数据下标
     * @param cellIndex 节点下标
     * @param looplist 挂载的列表
     */
    public init(data: T, size: Size, dataIndex: number, cellIndex: number) {
        Tween.stopAllByTarget(this.node!);
        this.cellIndex = cellIndex;
        this.dataIndex = dataIndex;
        !this.uiTrans && (this.uiTrans = this.node!.getComponent(UITransform));
        this.uiTrans!.width = size.width;
        this.uiTrans!.height = size.height;
        this.data = data;
        this.size = size;
    }
    /**
     * 重置大小
     * @param newSize
     * @param time
     */
    resize(newSize: Size, time: number) {
        let nodeSides = getNodeBorder(this, [true, true, true, true]);
        let changeSize = size(newSize.width - this.size!.width, newSize.height - this.size!.height);
        this.size = newSize;
        this.looplist!.dealChangeSize(this, nodeSides, changeSize, time).then(() => {
            this.uiTrans!.width = newSize.width;
            this.uiTrans!.height = newSize.height;
            this.looplist!.updateNodes();
        });
    }
    /**
     *
     * 更新节点显示
     * @param isShow 是否显示
     * @param prefab 需要显示的节点的预制件（也可以是节点，或者预制件url,生成方式自由改动）
     * @param cacheNode 对象池中的显示节点
     * @param renderLayer 分层节点
     */
    updateShow(isShow: boolean, prefab: Prefab, cacheNode: ShowNode<T>, renderLayer: Node) {
        if (isShow) {
            //当前没有显示节点
            if (!this.showNode) {
                //如果是临时对象池还有节点则重用
                if (cacheNode) {
                    this.showNode = cacheNode;
                } else {
                    //否则使用传入的预制件进行生成
                    this.showNode = instantiate(prefab).getComponent(ShowNode<T>);
                }
                this.showNode!.node.setParent(this.node);
                this.showNode!.node.position = v3();
                this.updateShowNode(renderLayer);
            }
        }
    }
    /**
     * 更新showNode节点显示
     * @param renderLayer
     */
    updateShowNode(renderLayer: Node) {
        //当前有显示节点
        if (this.showNode) {
            this.showNode.init(this, this.data!, renderLayer);
        }
    }
    /**是否有显示节点 */
    get hasNoNode() {
        return !this.showNode;
    }
    /**回收显示节点 */
    recircle() {
        if (this.showNode) {
            let node = this.showNode;
            this.showNode.cell = null;
            this.showNode.onRecircle();
            this.showNode.node?.removeFromParent();
            this.showNode = null;
            return node;
        }
    }
    destroy() {
        this.node?.destroy();
        this.node = null;
        this.uiTrans = null;
        this.looplist = null;
    }
    /**
     * 失去显示节点
     * @returns
     */
    lostShowNode() {
        if (this.showNode) {
            let node = this.showNode;
            this.showNode.cell = null;
            this.showNode.node.removeFromParent();
            this.showNode = null;
            return node;
        }
    }
    /**
     * 获取显示节点
     * @param showNode
     */
    getShowNode(showNode: ShowNode<T>) {
        this.showNode = showNode;
        showNode.node.setParent(this.node);
        this.showNode.cell = this;
    }
}

/**
 * 目前列表注意事项
 * 1.开启cellMaxNum后不能一行多列或者一列多行，只能单行或者单列
 */
export default class LoopList<T extends TDate> {
    public static insMap: Map<string, LoopList<any>> = new Map();
    public static ins<T>(listName: string): LoopList<T> {
        if (!this.insMap.has(listName)) {
            this.insMap.set(listName, new LoopList<T>());
        }
        return this.insMap.get(listName) as LoopList<T>;
    }
    /**分层节点（只有在showNode中挂载了RenderAlternative才能起作用） */
    private renderLayer: Node | null = null;
    /**滚动组件 */
    private scrollView: ScrollView | null = null;
    /**cell节点最大数量 */
    private cellMaxNum: number = 0;
    /**当前起点 */
    private curStartIndex: number = 0;
    /**容器的ui控件 */
    private contentUiTrans: UITransform | null = null;
    /**数据 */
    private datas: T[] = [];
    /**item节点们 */
    private itemCells: ItemCell<T>[] = [];
    /**预制件 */
    private prefab: Prefab | null = null;
    /**显示节点的池子 */
    private showNodePool: ShowNode<T>[] = [];
    /**边缘数据 */
    private viewSides: IBorder = {};
    /**上一帧滚动容器的坐标 */
    private lastPos: Vec3 | null = null;
    /**刷新显示的间隔次数 */
    public updateInv: number = 0;
    /**循环切换的最后一次时间 */
    private lastChange: number = 0;
    /**通用尺寸 */
    public size: Size | null = null;
    /**通用锚点 */
    public anchor: Vec2 | null = null;
    /**通用锚点 */
    private loadDataCB: () => void = null;
    /**是否开启分页 */
    private _pageView: boolean = false;
    /**分布页面最小缩放 */
    private _pageMinScale: number = 1;
    /**当前页面索引 */
    private _curPageIdx: number = 0;
    /**每一个页面居中时需要的偏移量 */
    private _scrollCenterOffsetX: number[] = [];
    /**每一个页面居中时需要的偏移量 */
    private _scrollCenterOffsetY: number[] = [];
    /**每一个页面的回调 */
    private _pageCallback: (pageIdx: number) => void = null;

    /**
     * 更新边界
     */
    public updateBorder() {
        this.contentUiTrans = this.scrollView?.content!.getComponent(UITransform)!;
        let view = this.scrollView?.view!;
        view.anchorX = this.contentUiTrans.anchorX;
        view.anchorY = this.contentUiTrans.anchorY;
        //修改锚点之后下一帧世界坐标才会更新，没办法只能等一帧了
        return new Promise<void>((resolve, reject) => {
            requestAnimationFrame(() => {
                if (isValid(view)) {
                    let wpos = view.node.worldPosition.clone();
                    //显示区域左边缘
                    let leftSide = wpos.x - view.width * view.anchorX;
                    //显示区域右边缘
                    let rightSide = wpos.x + view.width * (1 - view.anchorX);
                    //显示区域下边缘
                    let bottomSide = wpos.y - view.height * view.anchorY;
                    //显示区域上边缘
                    let topSide = wpos.y + view.height * (1 - view.anchorY);
                    this.viewSides = {
                        leftSide,
                        rightSide,
                        bottomSide,
                        topSide,
                        size: size(view.width, view.height),
                    };
                    this.contentUiTrans?.node.setPosition(v3(0, 0));
                }
                resolve();
            });
        });
    }

    /**
     * 初始化滚动列表*
     * @param scrollView
     * @param renderLayer 渲染分层的父节点，如果传入则可以配合showNode上的renderAlternative来进行渲染分层
     * @param cellMaxNum cell节点的最大数量,设置成null则不启用，启用的话，要设置成（可视窗刚好能显示的最大数量*2）+2，假设最多能看到10个节点，那么设置成22
     */
    async init(scrollView: ScrollView, renderLayer?: Node, cellMaxNum?: number) {
        cellMaxNum && (this.cellMaxNum = cellMaxNum);
        renderLayer && (this.renderLayer = renderLayer);
        this.scrollView = scrollView;
        await this.updateBorder();
        if (isValid(this.scrollView)) {
            this.scrollView.node.on(ScrollView.EventType.SCROLLING, this.scrollingListener, this);
        }
    }

    /**滚动监听 */
    scrollingListener() {
        this.updateInv--;
        if (this.updateInv <= 0) {
            this.updateInv = 2;
            let showCells = this.updateNodes();

            // egf.Logger.log("scrollingListener:", this.lastChange, this.cellMaxNum);
            // if (!this.cellMaxNum) {
            //   return;
            // }
            if (!this.lastPos) {
                this.lastPos = this.scrollView?.content!.position.clone()!;
            } else {
                let offset = this.scrollView?.content!.position.clone().subtract(this.lastPos);
                this.lastPos = this.scrollView?.content!.position.clone()!;
                let now = sys.now();

                if (!this.lastChange || now - this.lastChange > 1) {
                    this.lastChange = now;
                    this.dealLoopList(offset!, showCells);
                }
            }
        }
    }

    /**滚动结束监听 */
    scrollendListener() {
        // egf.Logger.log('scroll end:', this.scrollView.getScrollOffset().x);
        if (this.scrollView?.horizontal) {
            const offsetX = Math.abs(this.scrollView.getScrollOffset().x);
            if (Math.abs(offsetX - this._scrollCenterOffsetX[this._curPageIdx]) <= 0.5) {
                return;
            }
            for (let i = 0; i < this._scrollCenterOffsetX.length; i++) {
                const offsetDist = offsetX - this._scrollCenterOffsetX[i];
                if (Math.abs(offsetDist) <= this.viewSides?.size!.width / 2) {
                    this._curPageIdx = i;
                    break;
                }
            }
        } else {
            const offsetY = Math.abs(this.scrollView?.getScrollOffset().y!);
            if (Math.abs(offsetY - this._scrollCenterOffsetY[this._curPageIdx]) <= 0.5) {
                return;
            }
            for (let i = 0; i < this._scrollCenterOffsetY.length; i++) {
                const offsetDist = offsetY - this._scrollCenterOffsetY[i];
                if (Math.abs(offsetDist) <= this.viewSides?.size!.height) {
                    this._curPageIdx = i;
                    break;
                }
            }
        }
        this.scrollToPage(this._curPageIdx, 0.1);
    }

    /**
     * 初始化
     * @param data 数据组
     * @param prefab 预制件
     * @param size 通用尺寸
     * @param anchor cell的锚点
     */
    public initData(data: T[], prefab: Prefab, size?: Size, anchor: Vec2 = v2(0.5, 0.5)) {
        this.datas = data;
        this.size = size!;
        this.anchor = anchor;
        this.prefab = prefab;
        let len = this.cellMaxNum ? this.cellMaxNum : data.length;
        for (let i = 0; i < len; ++i) {
            let data = this.datas[this.curStartIndex + i];
            let cellSize = data.size ? data.size : size;
            let itemCell = this.itemCells[i];
            if (!itemCell) {
                let node = new Node("LoopListCell");
                let uiTrans = node.addComponent(UITransform);
                itemCell = this.itemCells[i] = new ItemCell<T>(node, this);
                uiTrans.setAnchorPoint(anchor);
                node.setParent(this.scrollView?.content!);
                if (this._pageView) {
                    this.scrollView?.content!.getComponent(Layout)?.updateLayout();
                    requestAnimationFrame(() => {
                        this.addPage(node, i);
                    });
                }
            }
            itemCell.init(data, cellSize!, this.curStartIndex + i, i);
        }
        for (let i = data.length, len = this.itemCells.length; i < len; ++i) {
            this.recircleShowNode(this.itemCells[i].recircle()!);
            this.itemCells[i].destroy();
            this.itemCells[i] = null;
        }
        requestAnimationFrame(() => {
            this.updateNodes();
        });
    }

    /**
     * 压入新的数据
     * @param datas
     */
    public pushDatas(datas: T[]) {
        let length = this.datas.length;
        for (let i = 0, len = datas.length; i < len; ++i) {
            let data = datas[i];
            this.datas.push(data);
            let index = length + i;
            this.addNodeFromIndex(index);
        }
    }
    /**
     * 插入新的数据
     * @param data
     * @param insertIndex
     */
    public insertData(data: T, insertIndex: number) {
        if (this.datas.length >= insertIndex) {
            this.datas.splice(insertIndex, 0, data);
            this.addNodeFromIndex(insertIndex);
        } else {
            this.pushDatas([data]);
        }
    }
    /**
     * 移除对应数据
     * @param removeIndex
     */
    public removeData(removeIndex: number) {
        if (this.datas.length >= removeIndex) {
            this.datas.splice(removeIndex, 1);
            if (this.cellMaxNum) {
                let cellIndex = removeIndex - this.curStartIndex;
                //在使用范围内
                if (cellIndex >= 0 && cellIndex < this.cellMaxNum) {
                    let itemCell = this.itemCells[cellIndex];
                    let nodeSides = getNodeBorder(itemCell, [true, true, true, true]);
                    let changeSize = size(-itemCell.size!.width, -itemCell.size!.height);
                    itemCell.size = size(0, 0);
                    this.dealChangeSize(itemCell, nodeSides, changeSize).then(() => {
                        //更新数据
                        for (let i = cellIndex; i < this.cellMaxNum; i++) {
                            let curDataIndex = this.curStartIndex + i;
                            let curData = this.datas[curDataIndex];
                            let curCellSize = curData.size ? curData.size : this.size;
                            this.itemCells[i].init(curData, curCellSize!, curDataIndex, i);
                            this.itemCells[i].updateShowNode(this.renderLayer!);
                        }
                    });
                }
            } else {
                let itemCell = this.itemCells.splice(removeIndex, 1)[0];
                let nodeSides = getNodeBorder(itemCell, [true, true, true, true]);
                let changeSize = size(-itemCell.size!.width, -itemCell.size!.height);
                itemCell.size = size(0, 0);
                this.dealChangeSize(itemCell, nodeSides, changeSize).then(() => {
                    this.recircleShowNode(itemCell.recircle()!);
                    itemCell.node!.destroy();
                });
            }
            if (this._pageView) {
                let pageIdx = this._curPageIdx;
                if (this._curPageIdx == removeIndex) {
                    pageIdx = removeIndex - 1;
                }
                const itemCell = this.itemCells[removeIndex];
                this.scrollView?.content!.getComponent(Layout)?.updateLayout();
                this.addPage(itemCell.node!, removeIndex);
                this.scrollToPage(pageIdx);
            }
        }
    }

    /**
     * 加载到底部时触发的回调
     * @param cb 回调函数
     */
    public setLoadDataCB(cb: () => void) {
        this.loadDataCB = cb;
    }

    /**
     * 获取页面数据
     * @returns 数据
     */
    public getDatas(): T[] {
        return this.datas;
    }
    /**
     * 更新数据
     * @param data
     */
    public updateData(data: T, index: number) {
        if (this.datas.length >= index && index >= 0) {
            this.datas[index] = data;
            const showCells = this.updateNodes();
            showCells.forEach((cell) => {
                if (cell.dataIndex == index) {
                    cell.updateShowNode(this.renderLayer);
                }
            });
        }
    }
    /**
     * 从某个数据开始更新
     * @param dataIndex
     */
    private async addNodeFromIndex(dataIndex: number) {
        let data = this.datas[dataIndex];
        let cellSize: Size = data.size ? data.size : this.size;
        //是否开启cell循环
        if (this.cellMaxNum) {
            let cellIndex = dataIndex - this.curStartIndex;
            //在使用范围内
            if (cellIndex >= 0 && cellIndex < this.cellMaxNum) {
                //更新数据
                for (let i = cellIndex; i < this.cellMaxNum; i++) {
                    let curDataIndex = this.curStartIndex + i;
                    let curData = this.datas[curDataIndex];
                    let curCellSize: Size = curData.size ? curData.size : this.size;
                    this.itemCells[i].init(curData, curCellSize, curDataIndex, i);
                    this.itemCells[i].updateShowNode(this.renderLayer);
                }
                //获取当前的位置
                let nodeSides: IBorder = null;
                let itemCell: ItemCell<T> = this.itemCells[cellIndex];
                if (itemCell) {
                    nodeSides = getNodeBorder(itemCell, [true, true, true, true]);
                    itemCell.uiTrans.width = 0;
                    itemCell.uiTrans.height = 0;
                    this.dealChangeSize(itemCell, nodeSides, cellSize).then(() => {
                        itemCell.uiTrans.width = cellSize.width;
                        itemCell.uiTrans.height = cellSize.height;
                    });
                }
            }
        } else {
            //获取当前的位置
            let nodeSides: IBorder = null;
            if (this.itemCells[dataIndex]) {
                nodeSides = getNodeBorder(this.itemCells[dataIndex], [true, true, true, true]);
            }
            let node = new Node("LoopListCell");
            let uiTrans = node.addComponent(UITransform);
            uiTrans.setAnchorPoint(this.anchor);
            node.setParent(this.scrollView.content);
            node.setSiblingIndex(dataIndex);
            if (this._pageView) {
                this.scrollView.content.getComponent(Layout)?.updateLayout();
                this.addPage(node, dataIndex);
            }
            let itemCell: ItemCell<T> = new ItemCell<T>(node, this);
            this.itemCells.splice(dataIndex, 0, itemCell);
            itemCell.init(data, cellSize, dataIndex, dataIndex);
            if (!nodeSides) {
                await new Promise<void>((resolve, reject) => {
                    requestAnimationFrame(() => {
                        nodeSides = getNodeBorder(itemCell, [true, true, true, true]);
                        resolve();
                    });
                });
            }
            if (nodeSides) {
                itemCell.uiTrans.width = 0;
                itemCell.uiTrans.height = 0;
                this.dealChangeSize(itemCell, nodeSides, cellSize).then(() => {
                    itemCell.uiTrans.width = cellSize.width;
                    itemCell.uiTrans.height = cellSize.height;
                });
            }
            this.dealItemShow(itemCell);
        }
    }

    /**
     * 处理列表的循环利用
     * @param offset
     * @param dataIndexs
     */
    private dealLoopList(offset: Vec3, showCells: ItemCell<T>[]) {
        let startCell = showCells[0];
        let endCell = showCells[showCells.length - 1];
        if (this.scrollView.vertical) {
            /**内容上移 */

            if (offset.y > 0) {
                //已经到达最后倒数第二个节点并且还有数据
                const bottomY = -this.itemCells[this.itemCells.length - 2].node.position.y - this.viewSides.size.height;
                // egf.Logger.log("dealLoopList1:", this.scrollView.content.position.y, bottomY);
                // egf.Logger.log("dealLoopList2:", endCell.dataIndex, this.datas.length - 2);
                if (this.scrollView.content.position.y >= bottomY && endCell.dataIndex < this.datas.length - 2) {
                    //显示开始数据下标(这里-1是想要顶部留一个itemcell做缓冲)
                    let showStart = startCell.dataIndex - 1;
                    //剩余可展示的数据量
                    let leave = this.datas.length - showStart;
                    //计算应该从那个位置开始重新赋值，因为如果直接移动到最上方，数据量不够覆盖所有的cell
                    let cellStartIndex = Math.max(0, this.itemCells.length - leave);
                    //计算第一个cell的数据下标
                    this.curStartIndex = showStart - cellStartIndex;

                    let cellTop = getNodeBorder(this.itemCells[startCell.cellIndex], [true]).topSide;

                    let contentHeight = 0;
                    let targetY = 0;
                    let jumpFirst = true;
                    let showIndex = 0;
                    for (let i = 0, len = this.itemCells.length; i < len; ++i) {
                        if (i >= cellStartIndex) {
                            //将当前已经显示的showNode节点直接重新设置到移动后的节点上
                            if (showIndex < showCells.length && !jumpFirst) {
                                if (showIndex == 0) {
                                    targetY = contentHeight;
                                }
                                let showNode = showCells[showIndex].lostShowNode();
                                showIndex++;
                                this.itemCells[i].getShowNode(showNode);
                            }
                            jumpFirst = false;
                        }
                        let dataIndex = this.curStartIndex + i;
                        let data = this.datas[dataIndex];
                        let cellSize = data.size ? data.size : this.size;
                        contentHeight += cellSize.height;
                        this.itemCells[i].init(data, cellSize, dataIndex, i);
                    }

                    //将content的位置移动到最上方并对齐移动前的状态
                    let posY = targetY + (cellTop - this.viewSides.topSide);
                    this.scrollView.content.setPosition(v3(this.scrollView.content.position.x, posY));
                    this.scrollView.scrollToOffset(v2(0, posY + endCell.size.height), 1);
                    this.lastPos = null;
                } else if (
                    this.scrollView.content.position.y >=
                        -this.itemCells[this.itemCells.length - 2].node.position.y - this.viewSides.size.height &&
                    endCell.dataIndex >= this.datas.length - 2
                ) {
                    //已经到达最后倒数第二个节点并且没有数据
                    this.loadDataCB && this.loadDataCB();
                }
            } //内容下移
            else if (offset.y < 0) {
                //已经到达第二个节点并且还有数据
                if (
                    this.scrollView.content.position.y < -this.itemCells[2].node.position.y &&
                    startCell.dataIndex > 2
                ) {
                    //展示的最后一个数据下表，+1是为了在底部预留一部分空间
                    let showEndIndex = endCell.dataIndex + 1;
                    //计算应该从那个位置开始重新赋值，因为如果直接移动到最下方，数据量不够覆盖所有的cell
                    let cellEndIndex = Math.min(this.itemCells.length - 2, showEndIndex - 1);
                    //计算第一个cell的数据下标
                    this.curStartIndex = Math.max(showEndIndex - (this.itemCells.length - 1), 0);

                    //将content的位置移动到最下方并对齐移动前的状态
                    let cellTop = getNodeBorder(this.itemCells[Math.max(startCell.cellIndex - 1, 0)], [true]).topSide;

                    let contentHeight = 0;
                    let showIndex = showCells.length - 1;
                    for (let i = this.itemCells.length - 1; i >= 0; --i) {
                        if (i <= cellEndIndex) {
                            //将当前已经显示的showNode节点直接重新设置到移动后的节点上
                            if (showIndex >= 0) {
                                let showNode = showCells[showIndex].lostShowNode();
                                showIndex--;
                                this.itemCells[i].getShowNode(showNode);
                            } else {
                                showIndex--;
                            }
                        }
                        let dataIndex = this.curStartIndex + i;
                        let data = this.datas[dataIndex];
                        let cellSize = data.size ? data.size : this.size;
                        if (showIndex < -1) {
                            contentHeight += cellSize.height;
                        }
                        this.itemCells[i].init(data, cellSize, dataIndex, i);
                    }

                    //将content的位置移动到最下方并对齐移动前的状态
                    let posY = contentHeight + (cellTop - this.viewSides.topSide);
                    this.scrollView.content.setPosition(v3(this.scrollView.content.position.x, posY));
                    this.scrollView.scrollToOffset(v2(0, posY - startCell.size.height), 1);
                    this.lastPos = null;
                }
            }
        } else if (this.scrollView.horizontal) {
            if (offset.x < 0) {
                //已经到达最后倒数第二个节点并且还有数据
                if (
                    this.scrollView.content.position.x <=
                        -(this.itemCells[this.itemCells.length - 2].node.position.x - this.viewSides.size.width) &&
                    endCell.dataIndex < this.datas.length - 2
                ) {
                    //显示开始数据下标(这里-1是想要左侧留一个itemcell做缓冲)
                    let showStart = startCell.dataIndex - 1;
                    //剩余可展示的数据量
                    let leave = this.datas.length - showStart;
                    //计算应该从那个位置开始重新赋值，因为如果直接移动到最左侧，数据量不够覆盖所有的cell
                    let cellStartIndex = Math.max(0, this.itemCells.length - leave);
                    //计算第一个cell的数据下标
                    this.curStartIndex = showStart - cellStartIndex;

                    let cellLeft = getNodeBorder(this.itemCells[startCell.cellIndex], [false, false, true]).leftSide;

                    let contentWidth = 0;
                    let targetX = 0;
                    let jumpFirst = true;
                    let showIndex = 0;
                    for (let i = 0, len = this.itemCells.length; i < len; ++i) {
                        if (i >= cellStartIndex) {
                            //将当前已经显示的showNode节点直接重新设置到移动后的节点上
                            if (showIndex < showCells.length && !jumpFirst) {
                                if (showIndex == 0) {
                                    targetX = contentWidth;
                                }
                                let showNode = showCells[showIndex].lostShowNode();
                                showIndex++;
                                this.itemCells[i].getShowNode(showNode);
                            }
                            jumpFirst = false;
                        }

                        let dataIndex = this.curStartIndex + i;
                        let data = this.datas[dataIndex];
                        let cellSize = data.size ? data.size : this.size;
                        contentWidth += cellSize.width;
                        this.itemCells[i].init(data, cellSize, dataIndex, i);
                    }

                    //将content的位置移动到最左侧并对齐移动前的状态
                    let posX = cellLeft - this.viewSides.leftSide - targetX;
                    this.scrollView.content.setPosition(v3(posX, this.scrollView.content.position.y));
                    this.scrollView.scrollToOffset(v2(-(posX - endCell.size.width), 0), 1);
                    this.lastPos = null;
                } else if (
                    this.scrollView.content.position.x <=
                        -(this.itemCells[this.itemCells.length - 2].node.position.x - this.viewSides.size.width) &&
                    endCell.dataIndex >= this.datas.length - 2
                ) {
                    //已经到达最后倒数第二个节点并且没有数据
                    this.loadDataCB && this.loadDataCB();
                }
            } else if (offset.x > 0) {
                //已经到达第二个节点并且还有数据
                if (
                    this.scrollView.content.position.x > -this.itemCells[2].node.position.x &&
                    startCell.dataIndex > 2
                ) {
                    //展示的最后一个数据下表，+1是为了在右侧预留一部分空间
                    let showEndIndex = endCell.dataIndex + 1;
                    //计算应该从那个位置开始重新赋值，因为如果直接移动到最右侧，数据量不够覆盖所有的cell
                    let cellEndIndex = Math.min(this.itemCells.length - 2, showEndIndex - 1);
                    //计算第一个cell的数据下标
                    this.curStartIndex = Math.max(showEndIndex - (this.itemCells.length - 1), 0);

                    //将content的位置移动到最右侧并对齐移动前的状态
                    let cellLeft = getNodeBorder(this.itemCells[Math.max(startCell.cellIndex - 1, 0)], [
                        false,
                        false,
                        true,
                    ]).leftSide;

                    let contentWidth = 0;
                    let showIndex = showCells.length - 1;
                    for (let i = this.itemCells.length - 1; i >= 0; --i) {
                        if (i <= cellEndIndex) {
                            //将当前已经显示的showNode节点直接重新设置到移动后的节点上
                            if (showIndex >= 0) {
                                let showNode = showCells[showIndex].lostShowNode();
                                showIndex--;
                                this.itemCells[i].getShowNode(showNode);
                            } else {
                                showIndex--;
                            }
                        }

                        let dataIndex = this.curStartIndex + i;
                        let data = this.datas[dataIndex];
                        let cellSize = data.size ? data.size : this.size;
                        if (showIndex < -1) {
                            contentWidth += cellSize.width;
                        }
                        this.itemCells[i].init(data, cellSize, dataIndex, i);
                    }

                    //将content的位置移动到最右侧并对齐移动前的状态
                    let posX = cellLeft - this.viewSides.leftSide - contentWidth;
                    this.scrollView.content.setPosition(v3(posX, this.scrollView.content.position.y));
                    this.scrollView.scrollToOffset(v2(-(posX + startCell.size.width), 0), 1);
                    this.lastPos = null;
                }
            }
        }
    }

    /**更新节点的显示 */
    public updateNodes() {
        let showCells: ItemCell<T>[] = [];
        for (let i = 0, len = this.itemCells.length; i < len; ++i) {
            let itemCell = this.itemCells[i];
            let isShow = this.dealItemShow(itemCell);
            if (isShow) {
                showCells.push(itemCell);
            }
        }
        return showCells;
    }

    /**
     * 处理cell的显示隐藏
     * @param itemCell
     */
    private dealItemShow(itemCell: ItemCell<T>) {
        if (itemCell) {
            let isShow = this.checkInView(itemCell);
            if (isShow) {
                itemCell.hasNoNode &&
                    itemCell.updateShow(
                        isShow,
                        this.prefab,
                        this.showNodePool.length > 0 ? this.showNodePool.pop() : null,
                        this.renderLayer,
                    );
            } else {
                !itemCell.hasNoNode && this.recircleShowNode(itemCell.recircle());
            }
            return isShow;
        }
    }

    /**
     * 检查是否在屏幕内
     * @param node
     * @returns
     */
    private checkInView(itemCell: ItemCell<T>) {
        let nodeSides = getNodeBorder(itemCell, [true, true, true, true]);
        //节点右侧边缘在屏幕左侧外面或者节点左边缘在屏幕右侧外面 则不在显示区域
        let horizontalOutside =
            nodeSides.rightSide < this.viewSides.leftSide || nodeSides.leftSide > this.viewSides.rightSide;

        let verticalOutside = false;
        if (!horizontalOutside) {
            //节点上边缘在屏幕下方外面或者节点下边缘在屏幕上方外面 则不在显示区域
            verticalOutside =
                nodeSides.topSide < this.viewSides.bottomSide || nodeSides.bottomSide > this.viewSides.topSide;
        }
        return !horizontalOutside && !verticalOutside;
    }
    /**
     * 处理变化的大小
     * @param cell
     * @param nodeSides
     * @param changeSize
     */
    public async dealChangeSize(cell: ItemCell<T>, nodeSides: IBorder, changeSize: Size, time: number = 0.3) {
        let topToBottomFulfill = this.contentUiTrans.anchorY == 1 && nodeSides.bottomSide >= this.viewSides.topSide;
        let bottomToTopFulfill = this.contentUiTrans.anchorY == 0 && nodeSides.topSide <= this.viewSides.bottomSide;
        if (topToBottomFulfill || bottomToTopFulfill) {
            if (topToBottomFulfill) {
                this.scrollView.content.position.add(v3(0, changeSize.height));
            } else {
                this.scrollView.content.position.subtract(v3(0, changeSize.height));
            }
        }
        let leftToRightFulfill = this.contentUiTrans.anchorX == 0 && nodeSides.rightSide <= this.viewSides.leftSide;
        let RightToLeftFulfill = this.contentUiTrans.anchorX == 1 && nodeSides.leftSide >= this.viewSides.rightSide;
        if (leftToRightFulfill || RightToLeftFulfill) {
            if (RightToLeftFulfill) {
                this.scrollView.content.position.add(v3(changeSize.width, 0));
            } else {
                this.scrollView.content.position.subtract(v3(changeSize.width, 0));
            }
        }
        if (!(topToBottomFulfill || bottomToTopFulfill || leftToRightFulfill || RightToLeftFulfill)) {
            Tween.stopAllByTarget(cell.node);
            await new Promise<void>((resolve, reject) => {
                tween(cell.uiTrans)
                    .to(time, { width: cell.size.width, height: cell.size.height })
                    .call(() => {
                        resolve();
                    })
                    .start();
            });
        }
        this.updateNodes();
        return true;
    }

    /**
     * 回收显示节点
     * @param node
     */
    private recircleShowNode(node: ShowNode<T>) {
        node && this.showNodePool.push(node);
    }

    /**
     * 释放当前列表
     */
    public freeList() {
        this.scrollView?.node?.off(ScrollView.EventType.SCROLLING, this.scrollingListener);
        this.scrollView?.node?.off(ScrollView.EventType.SCROLL_ENDED, this.scrollendListener);
        // for (let i = 0, len = this.itemCells.length; i < len; ++i) {
        //   this.recircleShowNode(this.itemCells[i].recircle());
        //   this.itemCells[i].destroy();
        // }
        this.itemCells = [];
        // for (let index = 0, len = this.showNodePool.length; index < len; ++index) {
        //   this.showNodePool[index].destroy();
        // }
        this.showNodePool = [];
        this.renderLayer = null;
        this.scrollView = null;
        this.prefab = null;
        this._scrollCenterOffsetX = [];
        this._scrollCenterOffsetY = [];
    }

    private addPage(node: Node, idx: number) {
        if (!isValid(node)) return;

        const scrollWidth = this.scrollView.getComponent(UITransform).width;
        const scrollHeight = this.scrollView.getComponent(UITransform).height;
        const contentLayout = this.scrollView.content.getComponent(Layout);

        if (this.scrollView.horizontal) {
            this._scrollCenterOffsetX[idx] =
                Math.abs(node.position.x) - (Math.abs(scrollWidth) >> 1) - contentLayout.paddingLeft;
            // egf.Logger.log('add page x:', node.position.x, Math.abs(scrollWidth) >> 1);

            for (let i = idx + 1; i < this.itemCells.length; i++) {
                const itemCell = this.itemCells[i];
                this._scrollCenterOffsetX[idx + 1] =
                    Math.abs(itemCell.node.position.x) +
                    (Math.abs(scrollWidth - this.size.width) >> 1) -
                    contentLayout.paddingLeft;
            }
        } else {
            this._scrollCenterOffsetY[idx] =
                Math.abs(node.position.y) - (Math.abs(scrollHeight) >> 1) - contentLayout.paddingTop;
            for (let i = idx + 1; i < this.itemCells.length; i++) {
                const itemCell = this.itemCells[i];
                this._scrollCenterOffsetY[idx + 1] =
                    Math.abs(itemCell.node.position.y) + (Math.abs(scrollHeight) >> 1) - contentLayout.paddingTop;
            }
        }
    }

    /**
     * 设置分页模式
     * @param scale 缩放比例
     */
    public setPage(scale: number = 1.0, autoScrollAlign: boolean = true, pageCallback: (idx: number) => void = null) {
        this._pageView = true;
        this._pageMinScale = scale;
        this._curPageIdx = 0;
        this._pageCallback = pageCallback;

        // 拖动后自动对齐的监听
        if (autoScrollAlign) {
            this.scrollView.node.on(ScrollView.EventType.SCROLL_ENDED, this.scrollendListener, this);
        }
    }
    public scrollToPage(idx: number, time: number = 0, attenuated: boolean = true) {
        if (idx < 0 || idx >= this.itemCells.length) {
            return;
        }
        this._curPageIdx = idx;
        this._pageCallback && this._pageCallback(idx);
        if (this.scrollView.horizontal) {
            const offsetX = this._scrollCenterOffsetX[idx] || 0;
            this.scrollView.scrollToOffset(v2(offsetX, 0), time, attenuated);
            // egf.Logger.log(
            //   'scroll to page x:',
            //   offsetX,
            //   this._curPageIdx,
            //   this.scrollView.getScrollOffset().x,
            // );
        } else {
            const offsetY = this._scrollCenterOffsetY[idx] || 0;
            this.scrollView.scrollToOffset(v2(0, offsetY), time, attenuated);
        }
    }

    /** 清除列表数据 */
    public clearData() {
        this.datas = [];
        this.curStartIndex = 0;
        this.itemCells = [];
        this.showNodePool = [];
        this.scrollView.content.removeAllChildren();
        this._scrollCenterOffsetX = [];
        this._scrollCenterOffsetY = [];
    }
}
/**
 * 获取节点的边缘
 * @param cell
 * @param needArr 顺序是上 下 左 右
 */
function getNodeBorder(cell: ItemCell<any>, needArr: boolean[]) {
    let borderData: IBorder = {};
    let wpos = cell.node.worldPosition.clone();
    //显示区域上边缘
    if (needArr[0]) {
        borderData.topSide = wpos.y + cell.uiTrans.height * (1 - cell.uiTrans.anchorY);
    }
    //显示区域下边缘
    if (needArr[1]) {
        borderData.bottomSide = wpos.y - cell.uiTrans.height * cell.uiTrans.anchorY;
    }
    //显示区域左边缘
    if (needArr[2]) {
        borderData.leftSide = wpos.x - cell.uiTrans.width * cell.uiTrans.anchorX;
    }
    //显示区域右边缘
    if (needArr[3]) {
        borderData.rightSide = wpos.x + cell.uiTrans.width * (1 - cell.uiTrans.anchorX);
    }
    borderData.size = size(cell.uiTrans.width, cell.uiTrans.height);
    return borderData;
}
