import { Scene, Sprite, SpriteFrame, Texture2D, assetManager, director, isValid, sp, Node, game, Asset } from "cc";
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

export default class ResMgr {
    private static _inst: ResMgr;
    public static get inst(): ResMgr {
        if (this._inst == null) {
            this._inst = new ResMgr();
        }
        return this._inst;
    }

    private _abBunds: any = {};
    private _resTaskMap: { [key: string]: IResTask } = {};
    private _loadTaskArr: Array<ILoadTask> = [];
    private _loadingTaskArr: Array<ILoadTask> = [];
    private _cacheImg: { [name: string]: SpriteFrame } = {};
    private _cacheSpine: { [name: string]: sp.SkeletonData } = {};
    private _taskInterval: any = null;

    constructor() {
        this._taskInterval = setInterval(this.checkResTask.bind(this), game.deltaTime * 1000);
    }

    public clearTaskInterval(): void {
        clearInterval(this._taskInterval);
        this._taskInterval = null;
    }

    public loadAssetsBundle(abName: string, endFunc: Function): void {
        egf.Logger.log("ResMgr:loadAssetsBundle: ", abName);
        assetManager.loadBundle(abName, (err, bundle) => {
            if (err !== null) {
                egf.Logger.error("[ResMgr]:Load AssetsBundle Error: " + abName);
                this._abBunds[abName] = null;
            } else {
                egf.Logger.log("[ResMgr]:Load AssetsBundle Success: " + abName);
                this._abBunds[abName] = bundle;
            }
            if (endFunc) {
                endFunc();
            }
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
        if (assetManager.assets.has(resUrl)) {
            const asset = assetManager.assets.get(resUrl)!;
            // 远程spriteFrame缓存
            if (this._cacheImg[asset.uuid]) {
                const spFrame = this._cacheImg[asset.uuid];
                cb && cb(spFrame);
                return spFrame;
            }
            cb && cb(asset);
            return asset;
        }
        // 远程spine缓存
        if (this._cacheSpine[resUrl]) {
            const spineData = this._cacheSpine[resUrl];
            cb && cb(spineData);
            return spineData;
        }
        if (this.isRemoteUrl(resUrl)) {
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
            cb && cb(asset);
            return bundle.get(resUrl);
        } else if (cb) {
            this._loadTaskArr.push({
                bundle: abName,
                name: resUrl,
                url: resUrl,
                assetType: assetType,
                priority: 0,
                endFunc: cb,
            });
            this._loadTaskArr.sort((a, b) => a.priority - b.priority);
        } else {
            egf.Logger.error("ResMgr:getAsset: " + resUrl + " not found in " + abName);
        }
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
        this._loadTaskArr.sort((a, b) => a.priority - b.priority);
    }

    // { GUI: {assetType: cc.Prefab, urls: []}, }
    public preloadResPackage(name: string, resPkg: any, progressFunc: Function, endFunc?: Function): void {
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

        for (const key in resPkg) {
            this.loadAssetsBundle(key, () => {
                nowAb++;
                if (nowAb === totalAb) {
                    this.loadAssetsInAssetsBundle(name, resPkg);
                }
            });
        }
    }

    download(url: string, cb: Function) {
        assetManager.loadRemote(url, (err, asset) => {
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
        if (type === sp.SkeletonData) {
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
                    }
                    spFrame.addRef(); // 计数加1
                    cb && cb(spFrame);
                } else {
                    cb && cb(asset);
                }
            });
        }
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
                textures.forEach((texture) => {
                    delete this._cacheImg[texture.image!.uuid]; // 删除映射表记录
                    texture.image?.decRef();
                    texture.destroy();
                });
                spineData.destroy();
            }
        }
    }

    private checkResTask(): void {
        if (this._loadTaskArr.length > 0 && this._loadingTaskArr.length < oneLoadCount / 2) {
            // Re-sort before processing to allow high-priority tasks to jump the queue
            this._loadTaskArr.sort((a, b) => a.priority - b.priority);
            const count = Math.min(this._loadTaskArr.length, oneLoadCount);
            const tasks = this._loadTaskArr.splice(0, count);
            this._loadingTaskArr.push(...tasks);
            tasks.forEach((task) => {
                const { bundle, name, url, assetType, endFunc } = task;
                const bundleAB = this._abBunds[bundle];
                if (!bundleAB) {
                    this._loadingTaskArr.shift();
                    this._loadTaskArr.push(task);
                    return;
                }
                this.loadRes(bundleAB, url, assetType, (err, asset) => {
                    this._loadingTaskArr.shift();
                    if (endFunc) {
                        if (err) {
                            egf.Logger.error("loadRes error: ", assetType, err);
                        } else {
                            endFunc(asset);
                        }
                    } else {
                        this.loadCallback(err, asset, name);
                    }
                });
            });
        }
    }

    public cancelTask(name: string): void {
        const task = this._resTaskMap[name];
        if (task) {
            // 使用 filter 正确删除所有相同 name 的元素
            this._loadTaskArr = this._loadTaskArr.filter((task) => task.name !== name);
            delete this._resTaskMap[name];
        }
    }
}
