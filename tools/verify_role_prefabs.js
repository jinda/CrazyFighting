const fs = require("fs");
const path = require("path");

const GAME_DIR = path.join(__dirname, "../assets/module_game");
const ROLE_DIR = path.join(GAME_DIR, "game/prefabs/role");

function readRows(table) {
    const lines = fs.readFileSync(path.join(GAME_DIR, "datas", table + ".csv"), "utf8").trimEnd().split(/\r?\n/);
    const headers = lines[2].split(",");
    return lines.slice(3).filter(Boolean).map((line) => {
        const fields = line.split(",");
        return Object.fromEntries(headers.map((header, index) => [header, fields[index]]));
    });
}

const fighters = readRows("fighter");
const skills = new Map(readRows("skill").map((skill) => [skill.ID, skill]));
const unlocks = new Set(["101", ...readRows("level").map((level) => level.unlock)]);
const playableModels = new Set(fighters.filter((fighter) => unlocks.has(fighter.ID)).map((fighter) => fighter.model));

let allOk = true;
const files = fs.readdirSync(ROLE_DIR).filter((f) => f.endsWith(".prefab"));
const existingModels = new Set(files.map((file) => path.basename(file, ".prefab")));
for (const model of new Set(fighters.map((fighter) => fighter.model))) {
    if (!existingModels.has(model)) {
        allOk = false;
        console.error(`FAIL ${model}: missing role prefab`);
    }
}
for (const f of files) {
    const p = path.join(ROLE_DIR, f);
    const arr = JSON.parse(fs.readFileSync(p, "utf8"));
    const name = f.replace(".prefab", "");
    const errs = [];

    if (arr[0]._name !== name) errs.push(`prefab _name=${arr[0]._name}`);
    const root = arr.find((o) => o && o.__type__ === "cc.Node" && o._parent === null);
    if (!root) errs.push("no root");
    else if (root._name !== name) errs.push(`root _name=${root._name}`);

    // A skin can use a different default material before FighterModel applies the team skin.
    for (const o of arr) {
        if (o && o.__type__ === "cc.SkinnedMeshRenderer") {
            if (!o._materials?.length || o._materials.some((material) => !material?.__uuid__)) {
                errs.push("missing renderer material");
            }
        }
    }

    // SkeletalAnimation
    const skel = arr.find((o) => o && o.__type__ === "cc.SkeletalAnimation");
    if (!skel) errs.push("no SkeletalAnimation");
    else {
        if (skel._clips?.length !== 8 || skel._clips.some((clip) => !clip?.__uuid__)) {
            errs.push("missing animation slots");
        }
        if (!skel._sockets || skel._sockets.length < 2) errs.push(`sockets=${skel._sockets && skel._sockets.length}`);
    }

    // FighterModel
    const fm = arr.find((o) => o && o.__type__ === "9caecH2ycVFvb6W+2Mskenz");
    if (!fm) errs.push("no FighterModel");
    else {
        const modelFighters = fighters.filter((fighter) => fighter.model === name);
        const materialSlots = new Set([0]);
        if (playableModels.has(name)) {
            for (const fighter of modelFighters) {
                materialSlots.add(Number(fighter.color));
            }
        }
        if ([...materialSlots].some((slot) => !fm.aryMaterial?.[slot]?.__uuid__)) {
            errs.push("missing team skin material");
        }

        if (!fm.models?.length || fm.models.some((ref) => arr[ref?.__id__]?.__type__ !== "cc.SkinnedMeshRenderer")) {
            errs.push("bad models");
        }
        if (fm.msrs?.some((ref) => arr[ref?.__id__]?.__type__ !== "cc.MeshRenderer")) {
            errs.push("bad mesh renderers");
        }
        if ([fm.nodeWeapon, fm.nodeShield, fm.ndHead].some((ref) => arr[ref?.__id__]?.__type__ !== "cc.Node")) {
            errs.push("missing node refs");
        }
        if (!skel || arr[fm.ani?.__id__] !== skel) {
            errs.push("missing animation ref");
        }
        if (modelFighters.some((fighter) => skills.get(fighter.skill)?.fly) && !fm.pfThrowWeapon?.__uuid__) {
            errs.push("missing projectile prefab");
        }
    }

    // socket paths
    const sockets = arr.filter((o) => o && o.__type__ === "cc.SkeletalAnimation.Socket");
    const hasR = sockets.some((s) => s.path && s.path.endsWith("/handslot.r"));
    const hasL = sockets.some((s) => s.path && s.path.endsWith("/handslot.l"));
    if (!hasR) errs.push("missing handslot.r socket");
    if (!hasL) errs.push("missing handslot.l socket");

    // validate all __id__ references in range
    const L = arr.length;
    for (let i = 0; i < L; i++) {
        const o = arr[i];
        if (!o) continue;
        const check = (v) => {
            if (v && typeof v === "object") {
                if (v.__id__ !== undefined && (v.__id__ < 0 || v.__id__ >= L)) errs.push(`id ${v.__id__} out of range at ${i}`);
                for (const k in v) check(v[k]);
            } else if (Array.isArray(v)) {
                v.forEach(check);
            }
        };
        check(o);
    }

    if (errs.length) {
        allOk = false;
        console.log(`FAIL ${name}: ${[...new Set(errs)].join("; ")}`);
    } else {
        console.log(`OK   ${name}`);
    }
}
console.log(allOk ? "\nALL OK" : "\nSOME FAILED");
process.exitCode = allOk ? 0 : 1;
