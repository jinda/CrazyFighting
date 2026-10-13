const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

const projectRoot = path.resolve(__dirname, "..");
let assertionCount = 0;

function check(value, message) {
    assert.ok(value, message);
    assertionCount++;
}

function equal(actual, expected, message) {
    assert.equal(actual, expected, message);
    assertionCount++;
}

function deepEqual(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    assertionCount++;
}

function loadTypeScript(relativePath, prelude, exportsList, contextValues = {}) {
    const filename = path.join(projectRoot, relativePath);
    let source = fs.readFileSync(filename, "utf8");
    source = source.replace(/^import[\s\S]*?;\n/gm, "");
    source = source.replace(/\bexport\s+default\s+class\s+/g, "class ");
    source = source.replace(/\bexport\s+(?=(?:class|const|enum|interface|type)\b)/g, "");
    source = `${prelude}\n${source}\nglobalThis.__testedExports = { ${exportsList.join(", ")} };\n`;
    const javascript = stripTypeScriptTypes(source, { mode: "transform", sourceMap: false });
    const context = vm.createContext({
        console,
        Map,
        Set,
        Promise,
        Math,
        Date,
        JSON,
        Number,
        String,
        Array,
        Object,
        encodeURIComponent,
        decodeURIComponent,
        ...contextValues,
    });
    vm.runInContext(javascript, context, { filename });
    return context.__testedExports;
}

function createClock() {
    let now = 0;
    let sequence = 0;
    const timers = new Map();
    return {
        setTimeout(callback, delay = 0) {
            const id = ++sequence;
            timers.set(id, { callback, at: now + delay });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        advance(milliseconds) {
            const target = now + milliseconds;
            while (true) {
                const ready = [...timers.entries()]
                    .filter(([, timer]) => timer.at <= target)
                    .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                if (!ready) {
                    break;
                }
                const [id, timer] = ready;
                timers.delete(id);
                now = timer.at;
                timer.callback();
            }
            now = target;
        },
    };
}

function createStorage() {
    const values = new Map();
    return {
        values,
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
    };
}

function encodeSave(value) {
    return `enc:${Buffer.from(JSON.stringify(value), "utf8").toString("base64")}`;
}

function decodeSave(value) {
    return JSON.parse(Buffer.from(value.slice(4), "base64").toString("utf8"));
}

function createLocalDataHarness(options = {}) {
    const clock = createClock();
    const storage = createStorage();
    const logs = { log: [], warn: [], error: [] };
    const saveCalls = [];
    const getCalls = [];
    const client = {
        token: options.token === undefined ? "token" : options.token,
        getData(key, complete, error) {
            getCalls.push({ key, complete, error });
            options.getData?.(key, complete, error);
        },
        saveData(key, value, complete, error) {
            saveCalls.push({ key, value, complete, error });
            options.saveData?.(key, value, complete, error);
        },
    };
    const dataMgr = { coin: 0, level: 0 };
    const crypto = {
        enc: { Utf8: {} },
        AES: {
            encrypt(text) {
                return { toString: () => `enc:${Buffer.from(text, "utf8").toString("base64")}` };
            },
            decrypt(value) {
                return {
                    toString: () =>
                        typeof value === "string" && value.startsWith("enc:")
                            ? Buffer.from(value.slice(4), "base64").toString("utf8")
                            : "",
                };
            },
        },
    };
    const egf = {
        Logger: {
            log: (...args) => logs.log.push(args),
            warn: (...args) => logs.warn.push(args),
            error: (...args) => logs.error.push(args),
        },
        AudioMgr: { musicVolume: 0, soundVolume: 0 },
    };
    const prelude = `
const clamp = __deps.clamp;
const sys = __deps.sys;
const CryptoTS = __deps.CryptoTS;
const ClientApi = __deps.ClientApi;
const Constants = __deps.Constants;
const DataMgr = __deps.DataMgr;
`;
    const loaded = loadTypeScript(
        "assets/scripts/LocalDataMgr.ts",
        prelude,
        ["LocalDataMgr", "InitialDataState"],
        {
            __deps: {
                clamp: (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum),
                sys: { localStorage: storage },
                CryptoTS: crypto,
                ClientApi: { inst: client },
                Constants: { BASE_FIGHTER: 101, UNLOCK_CELL_SEQ: [1, 2, 3], goldRate: { maxLv: 10, step: 0.1 } },
                DataMgr: dataMgr,
            },
            egf,
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout,
            Buffer,
        },
    );
    return { ...loaded, clock, storage, logs, saveCalls, getCalls, client, dataMgr };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

async function testLocalPriorityAndMigration() {
    const harness = createLocalDataHarness();
    harness.storage.setItem(
        "CrazyFightGameInfoConfig",
        encodeSave({ coin: 321, level: 7, unlock: [101], formation: { 1: 101 } }),
    );
    let resolveLogin;
    const result = await harness.LocalDataMgr.prepareInitialData(
        () => new Promise((resolve) => (resolveLogin = resolve)),
    );
    equal(result.source, "local", "valid local data must win immediately");
    equal(harness.getCalls.length, 0, "local hit must not request cloud saves");
    equal(harness.LocalDataMgr.GameInfo.coinLv, 1, "old saves must receive missing defaults");
    equal(harness.dataMgr.coin, 321, "local application must synchronize DataMgr coin");
    equal(harness.dataMgr.level, 7, "local application must synchronize DataMgr level");
    resolveLogin({ token: "late", user_info: {}, is_new: false });
    await flushPromises();
    equal(harness.LocalDataMgr.GameInfo.level, 7, "late login must not replace valid local progress");
}

async function testCloudRecoveryAndCoinIsolation() {
    const cloudGame = encodeSave({ coin: 9999, level: 12, unlock: [101], formation: { 2: 202 } });
    const cloudSetting = encodeSave({ musicVolume: 0.4, soundVolume: 0.6, language: "en", shakeSwith: 0 });
    const harness = createLocalDataHarness({
        getData(key, complete) {
            complete({ key, value: key.includes("GameInfo") ? cloudGame : cloudSetting });
        },
    });
    const result = await harness.LocalDataMgr.prepareInitialData(() =>
        Promise.resolve({ token: "ok", user_info: { coin: 500 }, is_new: false }),
    );
    equal(result.source, "cloud", "missing local data must recover from valid cloud data");
    equal(harness.LocalDataMgr.GameInfo.level, 12, "cloud progress must initialize the game");
    equal(harness.dataMgr.level, 12, "cloud application must synchronize DataMgr level");
    equal(harness.LocalDataMgr.GameInfo.coin, 100, "cloud save coin must not replace the ledger balance");
    deepEqual({ ...harness.LocalDataMgr.GameInfo.formation }, { 2: 202 }, "cloud formation must be applied once");
    equal(harness.LocalDataMgr.Setting.language, "en", "valid cloud settings must be applied");
    equal(
        decodeSave(harness.storage.getItem("CrazyFightGameInfoConfig")).coin,
        100,
        "normalized cloud data must persist locally",
    );
}

async function testFormationZeroRecovery() {
    const gameInfo = { coin: 321, level: 999, unlock: [101, 202], formation: { 0: 202, 1: 101, 50: 0 } };
    const local = createLocalDataHarness();
    local.storage.setItem("CrazyFightGameInfoConfig", encodeSave(gameInfo));
    const localResult = await local.LocalDataMgr.prepareInitialData(() => Promise.resolve(null));
    equal(localResult.source, "local", "position zero must be accepted in a valid local save");
    equal(local.LocalDataMgr.GameInfo.level, 999, "local position zero must retain final-level progress");
    deepEqual([...local.LocalDataMgr.GameInfo.unlock], [101, 202], "local position zero must retain unlocks");
    deepEqual(
        { ...local.LocalDataMgr.GameInfo.formation },
        gameInfo.formation,
        "local formation must retain zero and extended cells",
    );

    const cloud = createLocalDataHarness({
        getData(key, complete) {
            complete({ key, value: encodeSave(key.includes("GameInfo") ? gameInfo : {}) });
        },
    });
    const cloudResult = await cloud.LocalDataMgr.prepareInitialData(() => Promise.resolve({ token: "ok" }));
    equal(cloudResult.source, "cloud", "position zero must be accepted in a valid cloud save");
    equal(cloud.LocalDataMgr.GameInfo.level, 999, "cloud position zero must retain final-level progress");
    deepEqual([...cloud.LocalDataMgr.GameInfo.unlock], [101, 202], "cloud position zero must retain unlocks");
    deepEqual(
        { ...cloud.LocalDataMgr.GameInfo.formation },
        gameInfo.formation,
        "cloud formation must retain zero and extended cells",
    );
    cloud.LocalDataMgr.saveGameInfoData();
    deepEqual(
        decodeSave(cloud.storage.getItem("CrazyFightGameInfoConfig")).formation,
        gameInfo.formation,
        "saving recovered progress must preserve position zero",
    );

    const invalid = createLocalDataHarness();
    invalid.storage.setItem("CrazyFightGameInfoConfig", encodeSave({ ...gameInfo, formation: { [-1]: 101 } }));
    const invalidResult = await invalid.LocalDataMgr.prepareInitialData(() => Promise.resolve(null));
    equal(invalidResult.source, "default", "negative formation positions must remain invalid");
}

async function testTimeoutRejectsLateCloud() {
    const pending = [];
    const harness = createLocalDataHarness({
        getData(key, complete, error) {
            pending.push({ key, complete, error });
        },
    });
    const resultPromise = harness.LocalDataMgr.prepareInitialData(() =>
        Promise.resolve({ token: "ok", user_info: {}, is_new: false }),
    );
    await flushPromises();
    equal(pending.length, 2, "cloud recovery must request game and setting data");
    harness.clock.advance(10000);
    const result = await resultPromise;
    equal(result.source, "default", "cloud recovery must fall back after ten seconds");
    equal(result.reason, "cloud_timeout", "timeout result must expose its recovery reason");
    for (const request of pending) {
        request.complete({
            key: request.key,
            value: request.key.includes("GameInfo")
                ? encodeSave({ coin: 1, level: 88, unlock: [101], formation: { 9: 909 } })
                : encodeSave({}),
        });
    }
    await flushPromises();
    equal(harness.LocalDataMgr.GameInfo.level, 0, "late cloud progress must be ignored");
    check(harness.LocalDataMgr.GameInfo.formation[9] === undefined, "late cloud formation must be ignored");
}

async function testInvalidCriticalDataFallsBack() {
    const harness = createLocalDataHarness({
        getData(key, complete) {
            complete({ key, value: key.includes("GameInfo") ? encodeSave({ level: "broken" }) : encodeSave({}) });
        },
    });
    harness.storage.setItem(
        "CrazyFightGameInfoConfig",
        encodeSave({ level: "broken", formation: { 1: 101 } }),
    );
    const result = await harness.LocalDataMgr.prepareInitialData(() =>
        Promise.resolve({ token: "ok", user_info: {}, is_new: false }),
    );
    equal(result.source, "default", "invalid local and cloud critical fields must use defaults");
    equal(harness.LocalDataMgr.GameInfo.level, 0, "invalid progress must never enter runtime state");
    check(harness.logs.error.length >= 2, "invalid local and cloud data must be diagnosed without raw saves");
}

async function testCloudSaveQueue() {
    const harness = createLocalDataHarness();
    harness.LocalDataMgr.GameInfo.level = 1;
    harness.LocalDataMgr.saveGameInfoData();
    const firstLocal = harness.storage.getItem("CrazyFightGameInfoConfig");
    harness.LocalDataMgr.GameInfo.level = 2;
    harness.LocalDataMgr.saveGameInfoData();
    const secondLocal = harness.storage.getItem("CrazyFightGameInfoConfig");
    check(firstLocal !== secondLocal, "each save must update local storage immediately");
    harness.clock.advance(499);
    equal(harness.saveCalls.length, 0, "cloud writes must wait for the coalescing window");
    harness.clock.advance(1);
    equal(harness.saveCalls.length, 1, "coalesced saves must send one latest snapshot");
    equal(decodeSave(harness.saveCalls[0].value).level, 2, "the coalesced upload must contain the latest state");

    harness.LocalDataMgr.GameInfo.level = 3;
    harness.LocalDataMgr.saveGameInfoData();
    harness.clock.advance(500);
    equal(harness.saveCalls.length, 1, "same-key cloud uploads must stay serial while one is in flight");
    harness.saveCalls[0].complete();
    harness.clock.advance(500);
    equal(harness.saveCalls.length, 2, "a newer snapshot must follow the completed upload");
    equal(decodeSave(harness.saveCalls[1].value).level, 3, "serial follow-up must send the newest snapshot");
}

async function testCloudSaveRetryCapAndBackgroundRetry() {
    const harness = createLocalDataHarness();
    harness.LocalDataMgr.saveGameInfoData();
    harness.clock.advance(500);
    const retryDelays = [1000, 2000, 4000, 8000, 16000];
    for (let index = 0; index < retryDelays.length; index++) {
        harness.saveCalls[index].error(500, "failed");
        harness.clock.advance(retryDelays[index]);
    }
    equal(harness.saveCalls.length, 6, "cloud save must stop after five automatic retries");
    harness.saveCalls[5].error(500, "failed");
    harness.clock.advance(30000);
    equal(harness.saveCalls.length, 6, "exhausted retries must retain data without an unbounded timer");
    harness.LocalDataMgr.flushCloudSaves(true);
    equal(harness.saveCalls.length, 7, "background flush must restart one retained upload attempt");
}

function createHttpHarness() {
    const requests = [];
    const logger = { log() {}, warn() {}, error() {} };
    class FakeXMLHttpRequest {
        constructor() {
            this.readyState = 0;
            this.status = 0;
            this.responseText = "";
            this.response = null;
            this.headers = {};
            requests.push(this);
        }
        open(method, url) {
            this.method = method;
            this.url = url;
            this.readyState = 1;
        }
        setRequestHeader(key, value) {
            this.headers[key] = value;
        }
        send(body) {
            this.body = body;
        }
        abort() {
            this.onabort?.();
        }
        complete(status, body) {
            this.status = status;
            this.responseText = body;
            this.readyState = 4;
            this.onreadystatechange?.();
        }
    }
    const loaded = loadTypeScript(
        "assets/core_code/network/HttpMgr.ts",
        "const Logger = __deps.Logger;",
        ["HttpMgr", "HttpEvent"],
        { __deps: { Logger: logger }, XMLHttpRequest: FakeXMLHttpRequest },
    );
    return { ...loaded, requests };
}

function testHttpCompletionAndDeduplication() {
    const harness = createHttpHarness();
    let firstSuccess = 0;
    let secondSuccess = 0;
    let errors = 0;
    harness.HttpMgr.post("/same", { b: 2, a: 1 }, () => firstSuccess++, () => errors++);
    harness.HttpMgr.post("/same", { a: 1, b: 2 }, () => secondSuccess++, () => errors++);
    equal(harness.requests.length, 1, "identical requests must share one XMLHttpRequest");
    harness.requests[0].complete(200, JSON.stringify({ ok: true }));
    equal(firstSuccess, 1, "first subscriber must complete once");
    equal(secondSuccess, 1, "deduplicated subscriber must complete once");
    harness.requests[0].onerror?.();
    equal(errors, 0, "late XHR events must not complete subscribers twice");

    harness.HttpMgr.post("/500", {}, () => firstSuccess++, () => errors++);
    harness.requests[1].complete(500, "server error");
    harness.requests[1].onerror?.();
    equal(errors, 1, "HTTP errors must notify each caller once");

    harness.HttpMgr.post("/timeout", {}, () => firstSuccess++, () => errors++);
    harness.requests[2].ontimeout?.();
    harness.requests[2].complete(0, "");
    equal(errors, 2, "timeouts must notify once even if ready-state follows");

    harness.HttpMgr.post("/network", {}, () => firstSuccess++, () => errors++);
    harness.requests[3].onerror?.();
    harness.requests[3].ontimeout?.();
    equal(errors, 3, "network errors must notify once even if another terminal event follows");

    harness.HttpMgr.post("/parse", {}, () => firstSuccess++, () => errors++);
    harness.requests[4].complete(200, "not-json");
    equal(errors, 4, "JSON parse failure must use the error completion path");

    harness.HttpMgr.post("/cancel", {}, () => firstSuccess++, () => errors++);
    harness.HttpMgr.abort("/cancel");
    harness.requests[5].onerror?.();
    equal(errors, 5, "cancelled requests must notify once");
}

function testLoggerLevels() {
    const calls = { log: 0, debug: 0, warn: 0, error: 0 };
    const fakeConsole = {
        log: () => calls.log++,
        debug: () => calls.debug++,
        warn: () => calls.warn++,
        error: () => calls.error++,
    };
    const loaded = loadTypeScript(
        "assets/core_code/base/Logger.ts",
        "const DEV = false; const Utils = __deps.Utils;",
        ["Logger"],
        { __deps: { Utils: { arrStringify: () => "" } }, console: fakeConsole },
    );
    loaded.Logger.log("hidden");
    loaded.Logger.debug("hidden");
    loaded.Logger.warn("kept");
    loaded.Logger.error("kept");
    deepEqual(calls, { log: 0, debug: 0, warn: 1, error: 1 }, "production must suppress only ordinary logs");
    loaded.Logger.setLogStatus(true);
    loaded.Logger.log("enabled");
    equal(calls.log, 1, "setLogStatus must continue to enable ordinary logs");
    loaded.Logger.setLogStatus(false);
    loaded.Logger.warn("still kept");
    equal(calls.warn, 2, "setLogStatus(false) must not suppress warnings");
}

async function testReconnectKeepsSaveState() {
    const clock = createClock();
    const localCalls = { clear: 0, flush: [], cloudLoad: 0 };
    const localData = {
        GameInfo: { coin: 250, level: 5 },
        pendingLevels: [],
        clearPendingLedgerOps: () => localCalls.clear++,
        flushCloudSaves: (restart) => localCalls.flush.push(restart ?? false),
        loadDataFromSever: () => localCalls.cloudLoad++,
        saveGameInfoData() {},
        addPendingLevel() {},
        removePendingLevelsUpTo() {},
    };
    const resourceRequests = [];
    const client = {
        token: "",
        foreground() {},
        background() {},
        getResource(complete, error) {
            resourceRequests.push({ complete, error });
        },
        setToken(value) {
            this.token = value;
        },
        reportError() {},
        gainCoin() {},
        consumeResource() {},
        completeProgress() {},
    };
    const game = { on() {}, off() {} };
    class SecureValue {
        constructor(value) {
            this.value = value;
        }
        get() {
            return this.value;
        }
        set(value) {
            this.value = value;
        }
    }
    const egf = {
        SecureValue,
        Logger: { log() {}, warn() {}, error() {} },
        EventMgr: { emit() {} },
        AudioMgr: { resume() {}, pause() {} },
    };
    const prelude = `
const Game = __deps.Game;
const game = __deps.game;
const EApiErrcode = __deps.EApiErrcode;
const EResourceType = __deps.EResourceType;
const ClientApi = __deps.ClientApi;
const Constants = __deps.Constants;
const LocalDataMgr = __deps.LocalDataMgr;
const EPlatform = __deps.EPlatform;
const PlatformMgr = __deps.PlatformMgr;
`;
    const loaded = loadTypeScript("assets/scripts/DataMgr.ts", prelude, ["DataMgr"], {
        __deps: {
            Game: { EVENT_SHOW: "show", EVENT_HIDE: "hide" },
            game,
            EApiErrcode: { SystemBusy: 10000, Processing: 10001, NotEnoughResource: 3, ParamError: 4, NotLogin: 2 },
            EResourceType: { Coin: 1 },
            ClientApi: {
                inst: client,
                createReqId: () => "request-id",
            },
            Constants: { LEDGER_SCENE: { UNKNOWN: "unknown" }, EVENT_NAME: { UPDATE_FORMATION: "formation" } },
            LocalDataMgr: localData,
            EPlatform: { Android: 2 },
            PlatformMgr: { platform: 0 },
        },
        egf,
        window: {},
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        setInterval: () => 1,
        clearInterval: () => {},
    });
    loaded.DataMgr.coin = 250;
    loaded.DataMgr.level = 5;
    let loginSuccess;
    const firstLogin = loaded.DataMgr.startCoinSync((success) => {
        loginSuccess = success;
    });
    equal(localCalls.clear, 1, "coin sync must retain the existing pending-progress store while clearing legacy ledger ops");
    client.token = "authenticated";
    loginSuccess({ token: "authenticated", user_info: { level: 77, coin: 999 }, is_new: false });
    const loginData = await firstLogin;
    equal(loginData.user_info.level, 77, "the initial login result must be awaitable by startup recovery");
    equal(loaded.DataMgr.level, 6, "login and reconnect must not overwrite the applied save level");
    equal(localCalls.cloudLoad, 0, "login and reconnect must not reload cloud formation");
    equal(resourceRequests.length, 1, "successful login must continue ledger synchronization");
    resourceRequests[0].complete({ coin: 888 });
    equal(loaded.DataMgr.coin, 888, "ledger synchronization must still update the current coin balance");
    loaded.DataMgr.onGameHide();
    equal(localCalls.flush.at(-1), true, "background transition must force a retained cloud-save attempt");
    loaded.DataMgr.stopCoinSync();
}

function testSourceContracts() {
    const start = fs.readFileSync(path.join(projectRoot, "assets/start/Start.ts"), "utf8");
    const dataMgr = fs.readFileSync(path.join(projectRoot, "assets/scripts/DataMgr.ts"), "utf8");
    const clientApi = fs.readFileSync(path.join(projectRoot, "assets/scripts/ClientApi.ts"), "utf8");
    const httpMgr = fs.readFileSync(path.join(projectRoot, "assets/core_code/network/HttpMgr.ts"), "utf8");
    check(start.includes("!this.resourcesReady || !this.dataReady"), "scene transition must gate on resources and data");
    check(start.includes("prepareInitialData(() => DataMgr.startCoinSync"), "startup must run awaitable data preparation");
    check(!dataMgr.includes("loadDataFromSever"), "reconnect must not restore cloud formation");
    check(!dataMgr.includes("this.level = data.user_info.level"), "login callback must not overwrite runtime level");
    check(!clientApi.includes("this._token.slice"), "token content must not be logged");
    check(!httpMgr.includes('Logger.log("数据请求 params:"'), "HTTP request bodies must not be logged");
    check(!httpMgr.includes('" data:", data'), "HTTP response bodies must not be logged");
}

async function main() {
    await testLocalPriorityAndMigration();
    await testCloudRecoveryAndCoinIsolation();
    await testTimeoutRejectsLateCloud();
    await testInvalidCriticalDataFallsBack();
    await testCloudSaveQueue();
    await testCloudSaveRetryCapAndBackgroundRetry();
    testHttpCompletionAndDeduplication();
    testLoggerLevels();
    await testReconnectKeepsSaveState();
    testSourceContracts();
    console.log(`save/network regression checks passed: ${assertionCount} assertions`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
    await testFormationZeroRecovery();
