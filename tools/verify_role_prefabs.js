const fs = require("fs");
const path = require("path");

const ROLE_DIR = "assets/module_game/game/prefabs/model/role";
const SKIN_WHITE = "51756739-7bb0-4ab0-bfdf-b83099a80ff2";

let allOk = true;
const files = fs.readdirSync(ROLE_DIR).filter((f) => f.endsWith(".prefab") && f !== "Barbarian.prefab");
for (const f of files) {
    const p = path.join(ROLE_DIR, f);
    const arr = JSON.parse(fs.readFileSync(p, "utf8"));
    const name = f.replace(".prefab", "");
    const errs = [];

    if (arr[0]._name !== name) errs.push(`prefab _name=${arr[0]._name}`);
    const root = arr.find((o) => o && o.__type__ === "cc.Node" && o._parent === null);
    if (!root) errs.push("no root");
    else if (root._name !== name) errs.push(`root _name=${root._name}`);

    // material check
    for (const o of arr) {
        if (o && o.__type__ === "cc.SkinnedMeshRenderer") {
            if (!o._materials || o._materials.length !== 1 || o._materials[0].__uuid__ !== SKIN_WHITE) {
                errs.push("bad material");
            }
        }
    }

    // SkeletalAnimation
    const skel = arr.find((o) => o && o.__type__ === "cc.SkeletalAnimation");
    if (!skel) errs.push("no SkeletalAnimation");
    else {
        if (!skel._clips || skel._clips.length !== 8) errs.push(`clips=${skel._clips && skel._clips.length}`);
        if (!skel._defaultClip || !skel._defaultClip.__uuid__) errs.push("no defaultClip");
        if (!skel._sockets || skel._sockets.length < 2) errs.push(`sockets=${skel._sockets && skel._sockets.length}`);
    }

    // FighterModel
    const fm = arr.find((o) => o && o.__type__ === "9caecH2ycVFvb6W+2Mskenz");
    if (!fm) errs.push("no FighterModel");
    else {
        if (!Array.isArray(fm.models) || fm.models.length < 1) errs.push("bad models");
        if (!Array.isArray(fm.aryMaterial) || fm.aryMaterial.length !== 2) errs.push("bad aryMaterial");
        if (!fm.nodeWeapon || !fm.nodeShield || !fm.ndHead || !fm.ani) errs.push("missing refs");
        if (!fm.pfWeapon || !fm.pfShield) errs.push("missing prefab refs");
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
