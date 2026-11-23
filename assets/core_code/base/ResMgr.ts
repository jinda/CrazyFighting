import {
    Scene,
    Sprite,
    SpriteFrame,
    Texture2D,
    assetManager,
    director,
    Director,
    isValid,
    sp,
    Node,
    Asset,
    ImageAsset,
} from "cc";
// 预加载总任务
interface IResTask {
    name: string;
    progressFunc: Function;
    endFunc: Function;
    total: number;
    now: number;
    totalAb: number;
    nowAb: number;
}
// 加载资源任务
interface ILoadTask {
    bundle: string;
    name: string;
    url: string;
    assetType: any;
    priority: number; // 优先级 越低越优先
    endFunc?: Function;
}

const oneLoadCount = 12; // 每次加载的最大资源数量 (increased for web browser HTTP/2 multiplexing)

/** 模块级比较函数：避免每次排序都新建闭包 */
function prioritySort(a: ILoadTask, b: ILoadTask): number {
    return a.priority - b.priority;
}

class ResManager {
    private static _inst: ResManager | null = null;
    public static get inst(): ResManager {
        if (this._inst == null) {
            this._inst = new ResManager();
        }
        return this._inst;
    }

    private _resTaskMap: { [key: string]: IResTask } = {};
    private _loadTaskArr: Array<ILoadTask> = [];
    /**
     * 在飞任务数。
     * 原实现用 _loadingTaskArr.length 记账，并在异步回调里 shift() 删队头 ——
     * 并发请求的完成顺序与入队顺序无关，会删错元素，导致计数永久残留、队列不再发车。
     */
    private _loadingNum: number = 0;
    /** 队列是否需要重排：只在入队时置脏，避免每帧 sort */
    private _needSort: boolean = false;
    /** 已在队列/在飞中的 "bundle|url"，避免同一资源重复入队 */
    private _pendingUrls: Set<string> = new Set();
    /** 重复请求的回调队列：同一 url 只发一次加载，完成时把结果回给所有请求者 */
    private _pendingCbs: { [key: string]: Function[] } = {};
    private _cacheImg: { [name: string]: SpriteFrame } = {};
    /** 远程图片按 url 的索引：命中就不再走 loadRemote */
    private _cacheImgByUrl: { [url: string]: SpriteFrame } = {};
    private _cacheSpine: { [name: string]: sp.SkeletonData } = {};
    /** 远程图片缓存上限，超出按 FIFO 淘汰，防止排行榜头像无限堆积 */
    private readonly _maxRemoteImg: number = 64;
    private _cacheImgKeys: string[] = [];

    constructor() {
        // 用帧驱动替代 setInterval：不额外占 JS 定时器，也不会因为
        // game.deltaTime 在启动时为 0 而退化成 setInterval(0) 的 4ms 轮询
        director.on(Director.EVENT_AFTER_UPDATE, this._tick, this);
    }

    /** 兼容旧接口：真正解绑帧回调 */
    public clearTaskInterval(): void {
        director.off(Director.EVENT_AFTER_UPDATE, this._tick, this);
    }

    public loadAssetsBundle(abName: string, endFunc: (error?: Error) => void): void {
        assetManager.loadBundle(abName, (error: Error | null) => {
            if (error) egf.Logger.error("[ResMgr]:Load AssetsBundle Error:", abName, error);
            endFunc?.(error ?? undefined);
        });
    }

    public loadRes(
        abBundle: any,
        url: string,
        typeClasss: any,
        callback?: (error: Error | null, asset: any) => void,
    ): void {
        if (this.isRemoteUrl(url)) {
            if (typeClasss == sp.SkeletonData) {
                this.downloadSpineInfo(url, callback!);
            } else {
                this.download(url, callback!);
            }
        } else if (typeClasss === Scene) {
            director.preloadScene(url, callback);
        } else {
            abBundle.load(url, typeClasss, callback);
        }
    }

    public getAsset(abName: string, resUrl: string, cb?: Function, assetType?: any): any {
        // 远程资源先走下载缓存。原实现先查 assetManager.assets.has(resUrl)，
        // 而远程资源在 assets 里是按 uuid 索引的，这个分支基本命中不了，反而多一次哈希查找。
        if (this.isRemoteUrl(resUrl)) {
            const spineData = this._cacheSpine[resUrl];
            if (spineData) {
                cb && cb(spineData);
                return spineData;
            }
            const spFrame = this._cacheImgByUrl[resUrl];
            if (spFrame && isValid(spFrame)) {
                cb && cb(spFrame);
                return spFrame;
            }
            this.loadRemoteRes(resUrl, assetType, cb!);
            return null;
        }

        const bundle = assetManager.getBundle(abName);
        if (!bundle) {
            egf.Logger.error(`[error]: ${abName} AssetsBundle not loaded ${resUrl} !!!`);
            return null;
        }

        const asset = bundle.get(resUrl, assetType);
        if (asset) {
            // 原实现这里又调了一次 bundle.get(resUrl) 作为返回值，等于白查一遍
            cb && cb(asset);
            return asset;
        }

        if (!cb) {
            egf.Logger.error("ResMgr:getAsset: " + resUrl + " not found in " + abName);
            return null;
        }

        // 同一 url 可能在同一帧被多个 cell 请求（如排行榜里重复的头像），只入队一次，
        // 其余请求者挂到 _pendingCbs，加载完成后统一回调，避免"后请求的 cell 收不到回调"
        const key = abName + "|" + resUrl;
        if (this._pendingUrls.has(key)) {
            const list = this._pendingCbs[key] || (this._pendingCbs[key] = []);
            list.push(cb);
            return null;
        }
        this._pendingUrls.add(key);
        this._loadTaskArr.push({
            bundle: abName,
            name: resUrl,
            url: resUrl,
            assetType: assetType,
            priority: 0,
            endFunc: cb,
        });
        this._needSort = true;
        return null;
    }

    public getBundle(abName: string): any {
        const bundle = assetManager.getBundle(abName);
        if (!bundle) {
            egf.Logger.error("[error]: " + abName + " AssetsBundle not loaded !!!");
            return null;
        }

        return bundle;
    }

    public releaseResPackage(resPkg: any) {
        for (const key in resPkg) {
            let typeRes = resPkg[key];
            const bondule = assetManager.getBundle(key);
            if (typeRes instanceof Array) {
                for (let i = 0; i < typeRes.length; i++) {
                    const typeClass = typeRes[i].assetType;
                    typeRes[i].urls?.forEach((url: string) => {
                        if (bondule?.get(url)) {
                            bondule.release(url);
                        } else {
                            if (typeClass == sp.SkeletonData) {
                                this.releaseRemoteSpineInfo(url);
                            } else {
                                this.releaseDownload(url);
                            }
                        }
                    });
                }
            } else {
                const typeClass = typeRes.assetType;
                typeRes.urls?.forEach((url: string) => {
                    if (bondule?.get(url)) {
                        bondule.release(url);
                    } else {
                        if (typeClass == sp.SkeletonData) {
                            this.releaseRemoteSpineInfo(url);
                        } else {
                            this.releaseDownload(url);
                        }
                    }
                });
            }
        }
    }

    private releaseRemoteSpineInfo(url: string) {
        let ske = url + ".json";
        let atlas = url + ".atlas";
        let image = url + ".png";

        assetManager.releaseAsset(assetManager.assets.get(ske)!);
        assetManager.releaseAsset(assetManager.assets.get(atlas)!);
        assetManager.releaseAsset(assetManager.assets.get(image)!);
        const spineData = this._cacheSpine[url];
        if (isValid(spineData)) {
            spineData.destroy();
            delete this._cacheSpine[url];
        }
    }

    private releaseDownload(url: string) {
        const asset = assetManager.assets.get(url);
        const uuid = asset?.uuid;
        assetManager.releaseAsset(asset!);

        const spFrame = this._cacheImg[uuid!];
        if (isValid(spFrame)) {
            delete this._cacheImg[uuid!];
            spFrame.destroy();
        }
    }

    private loadAssetsInAssetsBundle(name: string, resPkg: any): void {
        for (const key in resPkg) {
            let typeRes = resPkg[key];
            if (typeRes instanceof Array) {
                for (let i = 0; i < typeRes.length; i++) {
                    const urlSet = typeRes[i].urls;
                    const assetType = typeRes[i].assetType;
                    const priority = typeRes[i].priority;
                    for (let j = 0; j < urlSet.length; j++) {
                        this._loadTaskArr.push({
                            bundle: key,
                            name: name,
                            url: urlSet[j],
                            assetType: assetType,
                            priority: priority || 1,
                        });
                    }
                }
            } else {
                const urlSet = typeRes.urls;
                const assetType = typeRes.assetType;
                const priority = typeRes.priority;
                for (let i = 0; i < urlSet.length; i++) {
                    this._loadTaskArr.push({
                        bundle: key,
                        name: name,
                        url: urlSet[i],
                        assetType: assetType,
                        priority: priority || 1,
                    });
                }
            }
        }
        this._needSort = true;
    }

    // { GUI: {assetType: cc.Prefab, urls: []}, }
    public preloadResPackage(
        name: string,
        resPkg: any,
        progressFunc: Function,
        endFunc?: (error?: Error) => void,
    ): void {
        let total = 0;
        let now = 0;
        let totalAb = 0;
        let nowAb = 0;

        for (const key in resPkg) {
            totalAb++;
            let typeRes = resPkg[key];

            if (typeRes instanceof Array) {
                for (let i = 0; i < typeRes.length; i++) {
                    total += typeRes[i].urls.length;
                }
            } else {
                total += typeRes.urls.length;
            }
        }
        if (total == 0) {
            endFunc && endFunc();
            return;
        }

        // Create the task in _resTaskMap BEFORE starting to load assets
        // This prevents race conditions where checkResTask processes tasks
        // before the task is registered in _resTaskMap
        this._resTaskMap[name] = {
            name: name,
            progressFunc: progressFunc,
            endFunc: endFunc!,
            total: total,
            now: now,
            totalAb: totalAb,
            nowAb: nowAb,
        };

        let hasFailed = false;
        for (const key in resPkg) {
            this.loadAssetsBundle(key, (error?: Error) => {
                if (hasFailed) return;
                if (error) {
                    hasFailed = true;
                    this.cancelTask(name);
                    endFunc?.(error);
                    return;
                }
                nowAb++;
                if (nowAb === totalAb) {
                    this.loadAssetsInAssetsBundle(name, resPkg);
                }
            });
        }
    }

    download(url: string, cb: Function) {
        const hasExt = /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i.test(url);
        const options = hasExt ? null : { ext: ".png" };
        assetManager.loadRemote<ImageAsset>(url, options, (err: Error | null, asset: ImageAsset) => {
            cb && cb(err, asset);
        });
    }

    downloadSpineInfo(url: string, cb: Function) {
        let ske = url + ".json";
        let atlas = url + ".atlas";
        let image = url + ".png";

        // Parallel downloads using Promise.all for 3x faster spine loading
        const downloadPromise = (targetUrl: string): Promise<any> => {
            return new Promise((resolve, reject) => {
                this.download(targetUrl, (err: Error, asset: Asset) => {
                    if (err) reject(err);
                    else resolve(asset);
                });
            });
        };

        Promise.all([downloadPromise(ske), downloadPromise(atlas), downloadPromise(image)])
            .then(([skeAsset, atlasAsset, imageAsset]) => {
                cb && cb(null, [atlasAsset.text, skeAsset.json, imageAsset]);
            })
            .catch((err) => {
                egf.Logger.warn("download spine error: ", url, err);
                cb && cb(err, null);
            });
    }

    loadCallback(error: any, asset: any, name: string) {
        if (error) {
            egf.Logger.error("load Res error: ", name, error);
        }
        const resTask = this._resTaskMap[name];
        if (resTask) {
            resTask.now++;
            if (resTask.progressFunc) {
                resTask.progressFunc(resTask.now, resTask.total, asset);
            }
            if (resTask.now >= resTask.total && resTask.endFunc) {
                resTask.endFunc();
                egf.Logger.log("loadRes task end: ", name);
                delete this._resTaskMap[name];
            }
        } else {
            egf.Logger.log("loadCallback not found task name:", name);
        }
    }

    public isRemoteUrl(url: string): boolean {
        return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
    }

    private loadRemoteRes(resUrl: string, type: any, cb: Function) {
        if (type === sp?.SkeletonData) {
            this.downloadSpineInfo(resUrl, (err: Error, assets: Array<any>) => {
                if (err) {
                    return;
                }
                let spineData = this._cacheSpine[resUrl];
                if (!spineData) {
                    const texture = new Texture2D();
                    texture.image = assets[2];
                    spineData = new sp.SkeletonData();
                    spineData.atlasText = assets[0];
                    spineData.skeletonJson = assets[1];
                    spineData.textures = [texture];
                    spineData._uuid = resUrl; // 可以传入任意字符串，但不能为空
                    assets[2].addRef();
                    this._cacheSpine[resUrl] = spineData; // 添加映射表记录
                }
                spineData.addRef(); // 计数加1
                cb && cb(spineData);
            });
        } else {
            this.download(resUrl, (err: Error, asset: any) => {
                if (err) {
                    return;
                }
                if (type === SpriteFrame) {
                    let spFrame = this._cacheImg[asset.uuid];
                    if (!spFrame) {
                        const texture = new Texture2D();
                        texture.image = asset;
                        spFrame = new SpriteFrame();
                        spFrame.texture = texture;
                        asset.addRef();
                        this._cacheImg[asset.uuid] = spFrame; // 添加映射表记录
                        this.cacheRemoteImgUrl(resUrl, spFrame);
                    }
                    spFrame.addRef(); // 计数加1
                    cb && cb(spFrame);
                } else {
                    cb && cb(asset);
                }
            });
        }
    }

    /** 记录 url → SpriteFrame，并按上限做 FIFO 淘汰 */
    private cacheRemoteImgUrl(url: string, spFrame: SpriteFrame): void {
        this._cacheImgByUrl[url] = spFrame;
        this._cacheImgKeys.push(url);
        while (this._cacheImgKeys.length > this._maxRemoteImg) {
            const oldUrl = this._cacheImgKeys.shift()!;
            const old = this._cacheImgByUrl[oldUrl];
            delete this._cacheImgByUrl[oldUrl];
            if (old && isValid(old)) {
                delete this._cacheImg[(old.texture as Texture2D)?.image?.uuid ?? ""];
                old.decRef(false);
            }
        }
    }

    /** 进程退出/切场景时可整体释放远程图片缓存 */
    public releaseAllRemoteImg(): void {
        for (let i = 0; i < this._cacheImgKeys.length; i++) {
            const spFrame = this._cacheImgByUrl[this._cacheImgKeys[i]];
            if (spFrame && isValid(spFrame)) {
                spFrame.decRef(false);
            }
        }
        this._cacheImgByUrl = {};
        this._cacheImgKeys = [];
    }
    // 释放节点上的远程资源
    releaseRemoteAsset(node: Node, nextUrl?: string) {
        if (!isValid(node)) {
            return;
        }
        const sprite = node.getComponent(Sprite);
        if (sprite && sprite.spriteFrame) {
            const spFrame = sprite.spriteFrame;
            egf.Logger.log("releaseRemoteSprite:", nextUrl, spFrame.uuid, spFrame.refCount);
            if (spFrame.uuid == nextUrl) {
                return;
            }
            sprite.spriteFrame.decRef(false); // 只把计数减1
            sprite.spriteFrame = null;

            if (spFrame.refCount <= 0) {
                let texture = spFrame.texture as Texture2D;
                // 如果已加入动态合图，必须取原始的Texture2D
                if (spFrame.packable) {
                    texture = spFrame.original?._texture as Texture2D;
                }
                if (texture) {
                    delete this._cacheImg[texture.image!.uuid]; // 删除映射表记录
                    texture.image?.decRef();
                    texture.destroy();
                }
                spFrame.destroy();
            }
        }
        const spine = node.getComponent(sp.Skeleton);
        if (spine && spine.skeletonData) {
            const spineData = spine.skeletonData;
            egf.Logger.log("releaseRemoteSpine:", nextUrl, spineData.uuid, spineData.refCount);
            if (spineData._uuid == nextUrl) {
                return;
            }

            if (spineData.refCount <= 0) {
                let textures = spineData.textures;
                textures.forEach((texture: Texture2D) => {
                    delete this._cacheImg[texture.image!.uuid]; // 删除映射表记录
                    texture.image?.decRef();
                    texture.destroy();
                });
                spineData.destroy();
            }
        }
    }

    /**
     * 帧驱动调度。
     * 队列为空或并发已满时直接 return，正常情况下是一次比较 + 一次分支，零分配。
     */
    private _tick(): void {
        if (this._loadTaskArr.length === 0 || this._loadingNum >= oneLoadCount / 2) {
            return;
        }
        if (this._needSort) {
            this._needSort = false;
            this._loadTaskArr.sort(prioritySort);
        }
        const budget = oneLoadCount - this._loadingNum;
        let launched = 0;
        while (launched < budget && this._loadTaskArr.length > 0) {
            const task = this._loadTaskArr.shift()!;
            if (!this._launch(task)) {
                // bundle 还没就绪：本帧不再继续发车，避免同一个坏任务在 while 里被反复
                // 取出/塞回（更早的实现会在一帧内重试 budget 次，日志刷屏）
                break;
            }
            launched++;
        }
    }

    /** 发起单个加载。计数在闭包里精确增减，不再依赖队列顺序。@returns bundle 未就绪时返回 false */
    private _launch(task: ILoadTask): boolean {
        const bundleAB = assetManager.getBundle(task.bundle);
        if (!bundleAB) {
            egf.Logger.error("checkResTask bundle error:", task.bundle);
            // 放回队尾，下一帧再试；保留原有"bundle 未就绪时重试"的语义
            this._loadTaskArr.push(task);
            this._needSort = true;
            return false;
        }
        this._loadingNum++;
        this.loadRes(bundleAB, task.url, task.assetType, (err: Error | null, asset: any) => {
            this._loadingNum--;
            const key = task.bundle + "|" + task.url;
            this._pendingUrls.delete(key);
            if (task.endFunc) {
                if (err) {
                    egf.Logger.error("loadRes error: ", task.url, err);
                } else {
                    task.endFunc(asset);
                }
            } else {
                this.loadCallback(err, asset, task.name);
            }
            // 把结果补给同一 url 的其余请求者（只在这里 flush 一次）
            const extras = this._pendingCbs[key];
            if (extras) {
                delete this._pendingCbs[key];
                if (!err) {
                    for (let i = 0; i < extras.length; i++) {
                        extras[i](asset);
                    }
                }
            }
        });
        return true;
    }

    public cancelTask(name: string): void {
        const task = this._resTaskMap[name];
        if (!task) {
            return;
        }
        // 用遍历重建代替 filter 闭包；同时清掉 pending 占位，
        // 否则被取消的 url 会永久占位、再也无法重新入队
        const remain: Array<ILoadTask> = [];
        for (let i = 0; i < this._loadTaskArr.length; i++) {
            const t = this._loadTaskArr[i];
            if (t.name === name) {
                const key = t.bundle + "|" + t.url;
                this._pendingUrls.delete(key);
                delete this._pendingCbs[key];
            } else {
                remain.push(t);
            }
        }
        this._loadTaskArr = remain;
        delete this._resTaskMap[name];
    }

    /** 游戏退出 / 热重载时调用，避免帧回调把单例钉住 */
    public dispose(): void {
        this.clearTaskInterval();
        this._loadTaskArr.length = 0;
        this._pendingUrls.clear();
        this._pendingCbs = {};
        this._loadingNum = 0;
        this.releaseAllRemoteImg();
    }

    /**
     * 从资源包中加载文件夹，调用前请确保该资源包已加载完成
     * @param bundle    资源包名
     * @param dir       文件夹路径
     * @param cb        加载回调
     * @param type      要加载的文件夹中的资源类型
     * @param mask      加载过程中是否显示加载进度条并阻挡玩家操作，默认为true
     */
    public loadBundleDir(
        bundle: string,
        dir: string,
        progressFunc: (completedCount: number, totalCount: number, item: any) => void,
        cb: (assets: any[] | null, error?: Error) => void,
        type?: typeof Asset,
    ): void {
        const loadedBundle = assetManager.getBundle(bundle);
        if (!loadedBundle) {
            const error = new Error(`资源包 ${bundle} 尚未加载: ${dir}`);
            egf.Logger.error(error.message);
            cb(null, error);
            return;
        }
        const onLoaded = (error: Error | null, assets: Asset[]): void => {
            if (error) {
                egf.Logger.error("loadBundleDir failed:", bundle, dir, error);
                cb(null, error);
                return;
            }
            cb(assets);
        };
        if (type) loadedBundle.loadDir(dir, type, progressFunc, onLoaded);
        else loadedBundle.loadDir(dir, null, progressFunc, onLoaded);
    }
}

export const ResMgr = ResManager.inst;
