const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const compiled = new Map();
let checks = 0;

function load(file, imports, globals = {}) {
    if (!compiled.has(file)) {
        compiled.set(
            file,
            ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2017,
                    module: ts.ModuleKind.CommonJS,
                    experimentalDecorators: true,
                },
            }).outputText,
        );
    }
    const exports = {};
    vm.runInNewContext(
        compiled.get(file),
        {
            exports,
            require(name) {
                assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
                return imports[name];
            },
            ...globals,
        },
        { filename: file },
    );
    return exports;
}

function createClock() {
    let now = 0;
    let next = 0;
    const timers = new Map();
    return {
        now: () => now,
        timers,
        setTimeout(callback, delay) {
            const id = ++next;
            timers.set(id, { callback, at: now + delay });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        advance(milliseconds) {
            now += milliseconds;
            for (const [id, timer] of [...timers]) {
                if (timer.at <= now) {
                    timers.delete(id);
                    timer.callback();
                }
            }
        },
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

function createAd(kind, options) {
    const listeners = { load: new Set(), error: new Set(), close: new Set(), resize: new Set() };
    const ad = {
        kind,
        options,
        style: options.style,
        listeners,
        loadCalls: 0,
        showCalls: 0,
        hideCalls: 0,
        destroyed: 0,
        loadResult: Promise.resolve(),
        showResult: Promise.resolve(),
        load() {
            this.loadCalls++;
            return this.loadResult;
        },
        show() {
            this.showCalls++;
            return this.showResult;
        },
        hide() {
            this.hideCalls++;
        },
        destroy() {
            this.destroyed++;
        },
        emit(event, result) {
            for (const callback of [...listeners[event]]) callback(result);
        },
    };
    for (const event of Object.keys(listeners)) {
        const suffix = event[0].toUpperCase() + event.slice(1);
        ad[`on${suffix}`] = (callback) => listeners[event].add(callback);
        ad[`off${suffix}`] = (callback) => listeners[event].delete(callback);
    }
    return ad;
}

function createHarness({ hasSud = true, platform = "wechat", native = false } = {}) {
    const clock = createClock();
    const logs = [];
    const events = [];
    const ads = [];
    const trace = [];
    const config = {
        reward_video_ad_id: "sud-video",
        interstitial_ad_id: "sud-interstitial",
        banner_ad_id: "sud-banner",
    };
    const runtime = {
        login(options) {
            options.success({ code: "one-time-code" });
        },
        authorize(options) {
            options.success({});
        },
        getUserInfo(options) {
            options.success({ nickname: "player", avatar: "https://example.com/avatar.png" });
        },
        vibrateShort() {
            trace.push("vibrateShort");
        },
        vibrateLong() {
            trace.push("vibrateLong");
        },
        getContainerInfo() {
            return { containerWidth: 360, containerHeight: 640, pixelRatio: 3 };
        },
    };
    for (const [method, kind] of [
        ["createRewardedVideoAd", "rewarded"],
        ["createInterstitialAd", "interstitial"],
        ["createBannerAd", "banner"],
    ]) {
        runtime[method] = function (options) {
            assert.equal(this, runtime, "SUD methods retain their runtime receiver");
            const ad = createAd(kind, options);
            ads.push(ad);
            return ad;
        };
    }
    const egf = {
        Logger: Object.fromEntries(["log", "warn", "error"].map((level) => [level, (...args) => logs.push(args)])),
        EventMgr: { emit: (event) => events.push(event) },
        AudioMgr: { pause() { }, resume() { } },
        Utils: { createReqId: () => "event-id" },
        i18nMgr: { setLanguage() { } },
        SceneUtil: { loadScene: () => trace.push("scene") },
    };
    const globals = {
        egf,
        sud: hasSud ? runtime : undefined,
        Date: { now: clock.now },
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
    };
    const sdkTypes = load("assets/scripts/SDK/SDKInterface.ts", {}, globals);
    const sudTypes = load("assets/scripts/SDK/ISud.ts", { "./SDKInterface": sdkTypes }, globals);
    const sdk = new sudTypes.ISud();
    sdk.init();
    const constants = { EVENT_NAME: { GAME_PAUSE: "pause", GAME_RESUME: "resume" } };
    const storage = new Map();
    const sys = {
        platform,
        os: native ? "android" : "other",
        isNative: native,
        Platform: { WECHAT_GAME: "wechat", BYTEDANCE_MINI_GAME: "tt", ANDROID: "android" },
        OS: { ANDROID: "android" },
        localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    };
    const localData = { Setting: { shakeSwith: true }, GameInfo: {}, loadCloud: (cb) => cb() };
    const client = {
        token: "",
        oauthLogin(type, credentials, _nickname, _avatar, success) {
            trace.push({ loginType: type, credentials });
            this.token = "business-token";
            success({ token: this.token, user_info: { level: 0, money: 0 }, is_new: false });
        },
        getAdConfig(channel, success) {
            assert.ok(this.token, "Ad configuration must be requested after business login");
            trace.push({ channel });
            success(config);
        },
        reportEvent() { },
        foreground() {
            trace.push("foreground");
        },
    };
    const platformTypes = load(
        "assets/scripts/SDK/PlatformMgr.ts",
        {
            cc: { sys },
            "../Constants": { Constants: constants },
            "./SDKInterface": sdkTypes,
            "./ISud": sudTypes,
            "./IWeChat": { IWeChat: class extends sdkTypes.SDKBase { } },
            "./ITT": { ITT: class extends sdkTypes.SDKBase { } },
            "./IAndroid": { IAndroid: class extends sdkTypes.SDKBase { } },
            "../LocalDataMgr": { LocalDataMgr: localData },
            "../ClientApi": { ClientApi: { inst: client } },
        },
        globals,
    );
    const cc = {
        sys,
        _decorator: { ccclass: () => (target) => target, property: () => () => { } },
        Component: class { },
    };
    const { Start } = load(
        "assets/start/Start.ts",
        {
            cc,
            "../scripts/ModuleDef": {},
            "../scripts/SceneDef": { SceneDef: { GAME: "game" } },
            "../scripts/DataMgr": { DataMgr: {} },
            "../scripts/StartResPkg": {},
            "../scripts/ClientApi": { ClientApi: { inst: client } },
            "../scripts/SDK/PlatformMgr": platformTypes,
            "../scripts/LocalDataMgr": { LocalDataMgr: localData },
            "../scripts/config/EnvConfig": {},
            "../core_code/base/i18nMgr": {},
        },
        globals,
    );
    return {
        sdk,
        runtime,
        clock,
        logs,
        events,
        ads,
        trace,
        config,
        client,
        Start,
        ...sdkTypes,
        ...sudTypes,
        ...platformTypes,
    };
}

function adLoaded(harness, type) {
    let loaded;
    harness.sdk.checkAdLoaded(type, (value) => {
        loaded = value;
    });
    return loaded;
}

async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

async function test(name, run) {
    await run();
    checks++;
    console.log(`PASS ${name}`);
}

async function main() {
    await test("普通浏览器可安全加载，缺少 SUD 时初始化和登录明确失败", () => {
        const h = createHarness({ hasSud: false, platform: "browser" });
        assert.equal(h.isSudRuntime(), false);
        assert.equal(h.sdk.init(), false);
        let failure;
        h.sdk.login({
            failCb: (message) => {
                failure = message;
            },
        });
        assert.equal(typeof failure, "string");
    });
    await test("宿主没有 window 时，静态导入微信和字节 SDK 不提前崩溃", () => {
        const sdkTypes = load("assets/scripts/SDK/SDKInterface.ts", {});
        for (const file of ["IWeChat", "ITT"]) {
            const exported = load(`assets/scripts/SDK/${file}.ts`, {
                cc: {},
                "./SDKInterface": sdkTypes,
            });
            assert.equal(typeof exported[file], "function");
        }
    });
    await test("SUD 检测优先于微信和 Android 标识，原有平台枚举值保持兼容", () => {
        for (const native of [false, true]) {
            const h = createHarness({ native });
            h.PlatformMgr.init();
            assert.equal(h.PlatformMgr.platform, h.EPlatform.SUD);
            assert.equal(h.PlatformStr[h.EPlatform.SUD], "sud");
        }
        for (const [platform, expected] of [
            ["browser", 0],
            ["wechat", 1],
            ["tt", 2],
            ["android", 3],
        ]) {
            const h = createHarness({ hasSud: false, platform });
            h.PlatformMgr.init();
            assert.equal(h.PlatformMgr.platform, expected);
        }
    });
    await test("登录 code 原样传递且不写日志，重复回调只处理一次", () => {
        const h = createHarness();
        const results = [];
        h.runtime.login = (callbacks) => {
            callbacks.success({ code: " raw-code " });
            callbacks.success({ code: "duplicate" });
            callbacks.fail({ errMsg: "late error" });
        };
        h.sdk.login({ successCb: (code) => results.push(code), failCb: () => assert.fail("late failure") });
        assert.deepEqual(results, [" raw-code "]);
        assert.ok(!JSON.stringify(h.logs).includes("raw-code"));
    });
    await test("登录空凭证、异步失败和同步异常均走失败回调，销毁后忽略迟到回调", () => {
        const h = createHarness();
        let failures = 0;
        const callbacks = { failCb: () => failures++, successCb: () => assert.fail("unexpected login") };
        h.runtime.login = (cb) => cb.success({ code: " " });
        h.sdk.login(callbacks);
        h.runtime.login = (cb) => cb.fail({ errMsg: "offline" });
        h.sdk.login(callbacks);
        h.runtime.login = () => {
            throw new Error("offline");
        };
        h.sdk.login(callbacks);
        assert.equal(failures, 3);
        let pending;
        h.runtime.login = (cb) => {
            pending = cb;
        };
        h.sdk.login(callbacks);
        h.sdk.dispose();
        pending.success({ code: "stale" });
        pending.fail({ errMsg: "stale" });
        assert.equal(failures, 3);
    });
    await test("基础用户信息映射到现有回调字段，授权和震动使用 SUD 实际参数", () => {
        const h = createHarness();
        let user;
        h.sdk.getUserInfo({
            successCb: (result) => {
                user = result;
            },
        });
        assert.equal(user.nickName, "player");
        assert.equal(user.avatarUrl, "https://example.com/avatar.png");
        let scope;
        h.runtime.authorize = (options) => {
            scope = options.scope;
            options.success({});
        };
        h.sdk.authorize({ scope: "scope.userInfo" });
        assert.equal(scope, "scope.userInfo");
        h.sdk.vibrate(50);
        h.sdk.vibrate(400);
        assert.deepEqual(h.trace, ["vibrateShort", "vibrateLong"]);
    });
    await test("广告仅使用 SUD 配置，未配置时激励回调失败而不发奖", () => {
        const h = createHarness();
        h.sdk.initAd(null);
        let success;
        h.sdk.showRewardedVideo(undefined, (result) => {
            success = result;
        });
        assert.equal(success, false);
        assert.equal(h.ads.length, 0);
        h.sdk.initAd(h.config);
        assert.deepEqual(
            h.ads.map((ad) => ad.options.adUnitId),
            ["sud-video", "sud-interstitial"],
        );
    });
    await test("load Promise 成功不代表就绪，未就绪广告不排队展示", async () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        const video = h.ads[0];
        await flush();
        assert.equal(adLoaded(h, h.EAdType.RewardedVideo), false);
        const results = [];
        h.sdk.showRewardedVideo(undefined, (result) => results.push(result));
        video.emit("load");
        assert.deepEqual(results, [false]);
        assert.equal(video.showCalls, 0);
        assert.equal(adLoaded(h, h.EAdType.RewardedVideo), true);
    });
    await test("激励仅在 isEnded=true 时发放一次，重复及迟到事件无效", async () => {
        for (const result of [{ isEnded: true }, { isEnded: false }, undefined]) {
            const h = createHarness();
            h.sdk.initAd(h.config);
            const video = h.ads[0];
            video.emit("load");
            const close = [...video.listeners.close][0];
            const results = [];
            h.sdk.showRewardedVideo(undefined, (success) => results.push(success));
            await flush();
            assert.equal(results.length, 0, "show accepted must not grant a reward");
            close(result);
            close({ isEnded: true });
            assert.deepEqual(results, [result?.isEnded === true]);
            assert.equal(video.destroyed, 1);
            assert.ok(Object.values(video.listeners).every((listeners) => listeners.size === 0));
        }
    });
    await test("展示拒绝、同步异常、onError 重复通知都只结束一次", async () => {
        for (const mode of ["reject", "throw", "event"]) {
            const h = createHarness();
            h.sdk.initAd(h.config);
            const video = h.ads[0];
            video.emit("load");
            const error = [...video.listeners.error][0];
            const results = [];
            if (mode === "reject") video.showResult = Promise.reject(new Error("offline"));
            if (mode === "throw")
                video.show = () => {
                    throw new Error("offline");
                };
            h.sdk.showRewardedVideo(undefined, (success) => results.push(success));
            if (mode === "event") error({ errMsg: "offline" });
            await flush();
            error({ errMsg: "duplicate" });
            assert.deepEqual(results, [false]);
            assert.equal(video.destroyed, 1);
        }
    });
    await test("加载拒绝和同步加载异常会销毁实例，不留下就绪状态", async () => {
        for (const mode of ["reject", "throw"]) {
            const h = createHarness();
            const create = h.runtime.createRewardedVideoAd;
            h.runtime.createRewardedVideoAd = function (options) {
                const ad = create.call(this, options);
                ad.load = () => {
                    if (mode === "throw") throw new Error("offline");
                    return Promise.reject(new Error("offline"));
                };
                return ad;
            };
            h.sdk.initAd(h.config);
            await flush();
            assert.equal(adLoaded(h, h.EAdType.RewardedVideo), false);
            assert.equal(h.ads[0].destroyed, 1);
            assert.equal(h.clock.timers.size, 0);
        }
    });
    await test("展示中重复 onLoad 不恢复可用状态，开始回调异常也能结束广告", async () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        h.ads[0].emit("load");
        const results = [];
        h.sdk.showRewardedVideo(
            () => {
                throw new Error("callback failure");
            },
            (success) => results.push(success),
        );
        h.ads[0].emit("load");
        assert.equal(adLoaded(h, h.EAdType.RewardedVideo), false);
        await flush();
        assert.deepEqual(results, [false]);
        assert.equal(h.ads[0].destroyed, 1);
    });
    await test("插屏与激励回调独立，关闭插屏不结束激励", () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        for (const ad of h.ads) ad.emit("load");
        const video = [];
        const interstitial = [];
        h.sdk.showRewardedVideo(undefined, (success) => video.push(success));
        h.sdk.showInterstitialAd(undefined, (success) => interstitial.push(success));
        h.ads[1].emit("close");
        assert.deepEqual(interstitial, [true]);
        assert.deepEqual(video, []);
        h.ads[0].emit("close", { isEnded: true });
        assert.deepEqual(video, [true]);
    });
    await test("全屏实例关闭后重建，预加载限频且销毁时清理定时器", () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        h.ads[0].emit("load");
        h.sdk.showRewardedVideo(undefined, () => { });
        h.ads[0].emit("close", { isEnded: true });
        h.clock.advance(9999);
        assert.equal(h.ads.length, 2);
        h.clock.advance(1);
        assert.equal(h.ads.length, 3);
        assert.equal(h.ads[2].kind, "rewarded");
        h.ads[2].emit("load");
        h.sdk.showRewardedVideo(undefined, () => { });
        h.ads[2].emit("close", { isEnded: true });
        assert.equal(h.clock.timers.size, 1);
        h.sdk.dispose();
        assert.equal(h.clock.timers.size, 0);
    });
    await test("预加载失败不进行无限重试，重新配置取消活动广告并清理监听", async () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        h.ads[0].emit("error", { errMsg: "load failed" });
        h.clock.advance(30000);
        assert.equal(h.ads.length, 2);
        h.ads[1].emit("load");
        const results = [];
        h.sdk.showInterstitialAd(undefined, (success) => results.push(success));
        h.sdk.initAd(null);
        await flush();
        assert.deepEqual(results, [false]);
        assert.ok(h.ads.every((ad) => ad.destroyed === 1));
    });
    await test("Banner 使用逻辑容器尺寸且等 onLoad 后展示，onResize 调整底部位置", async () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        const results = [];
        h.sdk.setBannerAd(true, h.EBannerPosition.Bottom, (success) => results.push(success));
        const banner = h.ads[2];
        assert.deepEqual(JSON.parse(JSON.stringify(banner.style)), { left: 0, top: 540, width: 360, height: 100 });
        assert.equal(banner.showCalls, 0);
        banner.emit("load");
        await flush();
        assert.deepEqual(results, [true]);
        banner.emit("resize", { width: 300, height: 50 });
        assert.equal(banner.style.top, 590);
        assert.equal(adLoaded(h, h.EAdType.Banner), true);
    });
    await test("Banner 加载中隐藏不会迟到展示，重复显示等待同一次 show 结果", async () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        const results = [];
        h.sdk.setBannerAd(true, h.EBannerPosition.Top, (success) => results.push(success));
        const banner = h.ads[2];
        h.sdk.setBannerAd(false);
        banner.emit("load");
        assert.equal(banner.showCalls, 0);
        assert.deepEqual(results, [false]);
        const pending = deferred();
        banner.showResult = pending.promise;
        h.sdk.setBannerAd(true, h.EBannerPosition.Top, (success) => results.push(success));
        h.sdk.setBannerAd(true, h.EBannerPosition.Top, (success) => results.push(success));
        assert.deepEqual(results, [false, false]);
        pending.resolve();
        await flush();
        assert.deepEqual(results, [false, false, true]);
        assert.equal(banner.showCalls, 1);
    });
    await test("Banner 错误结束待处理回调，销毁后迟到 Promise 不回报成功", async () => {
        const h = createHarness();
        h.sdk.initAd(h.config);
        const results = [];
        h.sdk.setBannerAd(true, h.EBannerPosition.Top, (success) => results.push(success));
        const banner = h.ads[2];
        const pending = deferred();
        banner.showResult = pending.promise;
        banner.emit("load");
        banner.emit("error", { errMsg: "failed" });
        pending.resolve();
        await flush();
        assert.deepEqual(results, [false]);
        assert.equal(banner.destroyed, 1);
    });
    await test("PlatformMgr 在缺广告、重复关闭及并发请求时逐次恢复暂停且不重复奖励", async () => {
        const h = createHarness();
        h.PlatformMgr.init();
        const results = [];
        h.PlatformMgr.showRewardedVideo(undefined, (success) => results.push(success));
        assert.deepEqual(results, [false]);
        h.PlatformMgr.initAd(h.config);
        h.ads[0].emit("load");
        h.PlatformMgr.showRewardedVideo(undefined, (success) => results.push(success));
        h.PlatformMgr.showRewardedVideo(undefined, (success) => results.push(success));
        h.ads[0].emit("close", { isEnded: true });
        h.ads[0].emit("close", { isEnded: true });
        await flush();
        assert.deepEqual(results, [false, false, true]);
        assert.equal(h.events.filter((event) => event === "pause").length, 3);
        assert.equal(h.events.filter((event) => event === "resume").length, 3);
    });
    await test("启动 SUD 登录提交 code 而非游客身份，登录后加载 sud 广告渠道", () => {
        const h = createHarness();
        h.PlatformMgr.init();
        const start = new h.Start();
        start.login();
        assert.deepEqual(JSON.parse(JSON.stringify(h.trace[0])), {
            loginType: "sud",
            credentials: { code: "one-time-code" },
        });
        assert.equal(h.trace[1].channel, "sud");
        assert.equal(start.dataReady, true);
        assert.equal(h.ads.length, 2);
    });
    await test("SDK 登录失败继续本地初始化，微信和游客登录分支保持兼容", () => {
        const h = createHarness();
        h.runtime.login = (options) => options.fail({ errMsg: "offline" });
        h.PlatformMgr.init();
        const start = new h.Start();
        start.login();
        assert.equal(start.dataReady, true);
        assert.equal(h.client.token, "");
        assert.equal(h.trace.length, 0);
        for (const [platform, type] of [
            ["wechat", "wechat"],
            ["browser", "guest"],
        ]) {
            const legacy = createHarness({ hasSud: false, platform });
            legacy.PlatformMgr.init();
            new legacy.Start().login();
            assert.equal(legacy.trace[0].loginType, type);
        }
    });
    console.log(`SUD 平台模拟回归通过：${checks} 组。真实宿主、引擎适配及广告投放需在 SUD 设备中验证。`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
