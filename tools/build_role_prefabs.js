const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROLE_DIR = "assets/module_game/game/prefabs/model/role";

const SKIN_WHITE = "51756739-7bb0-4ab0-bfdf-b83099a80ff2"; // skin_white.mtl
const ARY_MATERIAL = [
    "669fb9aa-5716-4d35-8dc1-3d292d70c431", // weapon_red.mtl (player)
    "519887a8-a91a-4344-8375-c6ba559efdf4", // weapon_white.mtl (enemy)
];
const PF_WEAPON = "c4b3c0ca-b645-4ac7-b0bf-ddcae73c5d8a"; // axe_1handed.prefab
const PF_SHIELD = "a679f65f-1bd6-4de0-bda8-89849a6b7c61"; // shield_round_barbarian.prefab

const CLIPS = [
    "918b575a-287a-4d96-8ef1-9f3995fbf5be@7b6ce",
    "b83db91d-7cab-4a7f-96a0-f591ab6303a2@1a4a2",
    "b83db91d-7cab-4a7f-96a0-f591ab6303a2@6b474",
    "918b575a-287a-4d96-8ef1-9f3995fbf5be@a16ad",
    "43126fe7-5d86-4732-885d-98b6af04fa84@b8cf4",
    "43126fe7-5d86-4732-885d-98b6af04fa84@38317",
    "b83db91d-7cab-4a7f-96a0-f591ab6303a2@5b8a7",
    "918b575a-287a-4d96-8ef1-9f3995fbf5be@de8ca",
];
const DEFAULT_CLIP = "918b575a-287a-4d96-8ef1-9f3995fbf5be@7b6ce";

const CHARS = {
    Barbarian_Large: { uuid: "36c0cbfe-a48f-4ff6-aca8-58a7f437e9ce", scene: "e1899" },
    Druid: { uuid: "3a2b5954-4126-4f03-8f9e-329b91327e2d", scene: "d0ed1" },
    Engineer: { uuid: "1a61d784-5822-4bb7-876d-41d50b4d3484", scene: "3d67c" },
    Knight: { uuid: "64e12dbb-f8dd-457a-8be7-a34aa6dae734", scene: "a0320" },
    Mage: { uuid: "15338dbe-2151-4e81-b2a1-378eb1ab1562", scene: "e9bed" },
    Ranger: { uuid: "e06679c8-68c6-4ec1-bc82-a1d6347f0976", scene: "6f280" },
    Rogue: { uuid: "67bf25d5-8791-44dc-9cbc-e2815576ce77", scene: "1917e" },
    Rogue_Hooded: { uuid: "e0dc2ed7-de1c-4cf2-a163-188ce285e391", scene: "06f9e" },
    Necromancer: { uuid: "98b52192-74ca-4729-a0fa-c67029c358d5", scene: "fc512" },
    Skeleton_Golem: { uuid: "83f7cf10-292a-42e2-a7fb-f428cd99307a", scene: "f7858" },
    Skeleton_Mage: { uuid: "161477ce-1134-4eff-b3ed-c926c9a1ae48", scene: "f3480" },
    Skeleton_Minion: { uuid: "03dd5dd4-9c64-4fce-9eb1-637593024557", scene: "e8979" },
    Skeleton_Rogue: { uuid: "5b20d060-c722-4736-8ca3-30ba8acde9a7", scene: "68ee3" },
    Skeleton_Warrior: { uuid: "300121e3-ebfd-4ec0-9b8e-6e9b20247253", scene: "c045d" },
};

// ---------- math helpers ----------
function mulQuat(a, b) {
    return {
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
}
function rotateVec(q, v) {
    const { x, y, z, w } = q;
    const ix = w * v.x + y * v.z - z * v.y;
    const iy = w * v.y + z * v.x - x * v.z;
    const iz = w * v.z + x * v.y - y * v.x;
    const iw = -x * v.x - y * v.y - z * v.z;
    return {
        x: ix * w + iw * -x + iy * -z - iz * -y,
        y: iy * w + iw * -y + iz * -x - ix * -z,
        z: iz * w + iw * -z + ix * -y - iy * -x,
    };
}
function quatToCocosEulerDeg(q) {
    const { x, y, z, w } = q;
    const m13 = 2 * (x * z + y * w);
    const m23 = 2 * (y * z - x * w);
    const m33 = 1 - 2 * (x * x + y * y);
    const m12 = 2 * (x * y - z * w);
    const m11 = 1 - 2 * (y * y + z * z);
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    const ex = Math.atan2(-m23, m33);
    const ey = Math.atan2(-m12, m11);
    const ez = Math.asin(clamp(m13));
    return { x: (ex * 180) / Math.PI, y: (ey * 180) / Math.PI, z: (ez * 180) / Math.PI };
}

function vec3(v) {
    return { x: v && v.x !== undefined ? v.x : 0, y: v && v.y !== undefined ? v.y : 0, z: v && v.z !== undefined ? v.z : 0 };
}
function quat(q) {
    return {
        x: q && q.x !== undefined ? q.x : 0,
        y: q && q.y !== undefined ? q.y : 0,
        z: q && q.z !== undefined ? q.z : 0,
        w: q && q.w !== undefined ? q.w : 1,
    };
}
function identityTransform() {
    return {
        lpos: { x: 0, y: 0, z: 0 },
        lrot: { x: 0, y: 0, z: 0, w: 1 },
        lscale: { x: 1, y: 1, z: 1 },
        euler: { x: 0, y: 0, z: 0 },
    };
}

// ---------- prefab helpers ----------
function prefabInfoObj(rootId, fileId) {
    return {
        __type__: "cc.PrefabInfo",
        root: { __id__: rootId },
        asset: { __id__: 0 },
        fileId,
        instance: null,
        targetOverrides: null,
        nestedPrefabInstanceRoots: null,
    };
}
function compPrefabInfoObj(fileId) {
    return { __type__: "cc.CompPrefabInfo", fileId };
}
function nodeObj(name, parentId, childrenIds, prefabInfoId, t) {
    return {
        __type__: "cc.Node",
        _name: name,
        _objFlags: 0,
        __editorExtras__: {},
        _parent: { __id__: parentId },
        _children: childrenIds.map((id) => ({ __id__: id })),
        _active: true,
        _components: [],
        _prefab: { __id__: prefabInfoId },
        _lpos: { __type__: "cc.Vec3", x: t.lpos.x, y: t.lpos.y, z: t.lpos.z },
        _lrot: { __type__: "cc.Quat", x: t.lrot.x, y: t.lrot.y, z: t.lrot.z, w: t.lrot.w },
        _lscale: { __type__: "cc.Vec3", x: t.lscale.x, y: t.lscale.y, z: t.lscale.z },
        _mobility: 0,
        _layer: 1073741824,
        _euler: { __type__: "cc.Vec3", x: t.euler.x, y: t.euler.y, z: t.euler.z },
        _id: "",
    };
}
function clipRef(uuid) {
    return { __uuid__: uuid, __expectedType__: "cc.AnimationClip" };
}
function matRef(uuid) {
    return { __uuid__: uuid, __expectedType__: "cc.Material" };
}
function prefabRef(uuid) {
    return { __uuid__: uuid, __expectedType__: "cc.Prefab" };
}
function randomFileId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let s = "";
    for (let i = 0; i < 22; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

function findBoneWorldTransform(arr, nodeIdx, parentPos, parentRot, parentScale, target, found) {
    const n = arr[nodeIdx];
    const lpos = vec3(n._lpos);
    const lrot = quat(n._lrot);
    const lscale = vec3(n._lscale);
    const scaled = { x: lpos.x * parentScale.x, y: lpos.y * parentScale.y, z: lpos.z * parentScale.z };
    const r = rotateVec(parentRot, scaled);
    const worldPos = { x: parentPos.x + r.x, y: parentPos.y + r.y, z: parentPos.z + r.z };
    const worldRot = mulQuat(parentRot, lrot);
    const worldScale = { x: parentScale.x * lscale.x, y: parentScale.y * lscale.y, z: parentScale.z * lscale.z };
    if (n._name === target) {
        found.value = { lpos: worldPos, lrot: worldRot, lscale: worldScale };
        return true;
    }
    for (const c of n._children || []) {
        if (findBoneWorldTransform(arr, c.__id__, worldPos, worldRot, worldScale, target, found)) return true;
    }
    return false;
}

// ---------- main generation ----------
function generate(name, info) {
    const libPath = path.join("library", info.uuid.slice(0, 2), `${info.uuid}@${info.scene}.json`);
    const arr = JSON.parse(fs.readFileSync(libPath, "utf8"));

    let rootIdx = null;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].__type__ === "cc.Node" && arr[i]._parent === null) {
            rootIdx = i;
            break;
        }
    }
    if (rootIdx === null) throw new Error("root node not found");
    const root = arr[rootIdx];

    arr[0]._name = name;
    root._name = name;

    const meshRendererIds = [];
    let headNodeId = null;
    let boneRootId = null;
    for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        if (o && o.__type__ === "cc.SkinnedMeshRenderer") {
            meshRendererIds.push(i);
            o._materials = [matRef(SKIN_WHITE)];
        }
    }
    for (const c of root._children) {
        const n = arr[c.__id__];
        const compTypes = (n._components || []).map((cc) => arr[cc.__id__].__type__);
        const isMesh = compTypes.some((t) => t === "cc.SkinnedMeshRenderer");
        if (n._name.startsWith("Rig_")) boneRootId = c.__id__;
        else if (!isMesh) {
            // keep existing FBX socket nodes (e.g. "head Socket") untouched
        }
        if (n._name.endsWith("_Head") || n._name.endsWith("_Skull")) headNodeId = c.__id__;
    }
    if (boneRootId === null) throw new Error("bone root not found");
    if (headNodeId === null) throw new Error("head node not found");

    const rigName = arr[boneRootId]._name;

    let skelAnimId = null;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].__type__ === "cc.SkeletalAnimation") {
            skelAnimId = i;
            break;
        }
    }
    if (skelAnimId === null) throw new Error("SkeletalAnimation not found");

    const handR = { value: null };
    const handL = { value: null };
    const identity = { x: 0, y: 0, z: 0 };
    const identityQ = { x: 0, y: 0, z: 0, w: 1 };
    const identityS = { x: 1, y: 1, z: 1 };
    findBoneWorldTransform(arr, boneRootId, identity, identityQ, identityS, "handslot.r", handR);
    findBoneWorldTransform(arr, boneRootId, identity, identityQ, identityS, "handslot.l", handL);
    if (!handR.value || !handL.value) throw new Error("handslot not found");

    const tR = {
        lpos: handR.value.lpos,
        lrot: handR.value.lrot,
        lscale: { x: 1, y: 1, z: 1 },
        euler: quatToCocosEulerDeg(handR.value.lrot),
    };
    const tL = {
        lpos: handL.value.lpos,
        lrot: handL.value.lrot,
        lscale: { x: 1, y: 1, z: 1 },
        euler: quatToCocosEulerDeg(handL.value.lrot),
    };

    const base = arr.length;
    const socketR = base + 0;
    const weaponR = base + 1;
    const pfWeaponR = base + 2;
    const pfSocketR = base + 3;
    const socketL = base + 4;
    const shieldL = base + 5;
    const pfShieldL = base + 6;
    const pfSocketL = base + 7;
    const socketObjR = base + 8;
    const socketObjL = base + 9;
    const fighterModel = base + 10;
    const pfFighterModel = base + 11;

    const ident = identityTransform();

    arr.push(nodeObj("handslot.r Socket", rootIdx, [weaponR], pfSocketR, tR));
    arr.push(nodeObj("NodeWeapon", socketR, [], pfWeaponR, ident));
    arr.push(prefabInfoObj(rootIdx, randomFileId()));
    arr.push(prefabInfoObj(rootIdx, randomFileId()));
    arr.push(nodeObj("handslot.l Socket", rootIdx, [shieldL], pfSocketL, tL));
    arr.push(nodeObj("NodeShield", socketL, [], pfShieldL, ident));
    arr.push(prefabInfoObj(rootIdx, randomFileId()));
    arr.push(prefabInfoObj(rootIdx, randomFileId()));

    arr.push({
        __type__: "cc.SkeletalAnimation.Socket",
        path: `${rigName}/root/hips/spine/chest/upperarm.r/lowerarm.r/wrist.r/hand.r/handslot.r`,
        target: { __id__: socketR },
    });
    arr.push({
        __type__: "cc.SkeletalAnimation.Socket",
        path: `${rigName}/root/hips/spine/chest/upperarm.l/lowerarm.l/wrist.l/hand.l/handslot.l`,
        target: { __id__: socketL },
    });

    arr.push({
        __type__: "9caecH2ycVFvb6W+2Mskenz",
        _name: "",
        _objFlags: 0,
        __editorExtras__: {},
        node: { __id__: rootIdx },
        _enabled: true,
        __prefab: { __id__: pfFighterModel },
        models: meshRendererIds.map((id) => ({ __id__: id })),
        aryMaterial: [matRef(ARY_MATERIAL[0]), matRef(ARY_MATERIAL[1])],
        nodeWeapon: { __id__: weaponR },
        nodeShield: { __id__: shieldL },
        ndHead: { __id__: headNodeId },
        ani: { __id__: skelAnimId },
        pfWeapon: prefabRef(PF_WEAPON),
        pfShield: prefabRef(PF_SHIELD),
        _id: "",
    });
    arr.push(compPrefabInfoObj(randomFileId()));

    root._children.push({ __id__: socketR }, { __id__: socketL });
    root._components.push({ __id__: fighterModel });

    const skelAnim = arr[skelAnimId];
    skelAnim._clips = CLIPS.map(clipRef);
    skelAnim._defaultClip = clipRef(DEFAULT_CLIP);
    skelAnim._sockets = (skelAnim._sockets || []).concat([
        { __id__: socketObjR },
        { __id__: socketObjL },
    ]);

    return { arr, rigName, meshCount: meshRendererIds.length, headNodeId, skelAnimId };
}

function writePrefab(name, arr) {
    if (!fs.existsSync(ROLE_DIR)) fs.mkdirSync(ROLE_DIR, { recursive: true });
    const prefabPath = path.join(ROLE_DIR, `${name}.prefab`);
    fs.writeFileSync(prefabPath, JSON.stringify(arr, null, 2) + "\n");
    const uuid = crypto.randomUUID();
    const meta = {
        ver: "1.1.50",
        importer: "prefab",
        imported: true,
        uuid,
        files: [".json"],
        subMetas: {},
        userData: { syncNodeName: name },
    };
    fs.writeFileSync(`${prefabPath}.meta`, JSON.stringify(meta, null, 2) + "\n");
    return uuid;
}

const results = [];
for (const [name, info] of Object.entries(CHARS)) {
    try {
        const { arr, rigName, meshCount, headNodeId, skelAnimId } = generate(name, info);
        const uuid = writePrefab(name, arr);
        results.push({ name, rigName, meshCount, headNodeId, skelAnimId, uuid });
        console.log(`OK   ${name}  rig=${rigName}  meshes=${meshCount}  head=${headNodeId}  skelAnim=${skelAnimId}`);
    } catch (e) {
        console.log(`FAIL ${name}: ${e.message}`);
    }
}
console.log(`\nDone. ${results.length}/${Object.keys(CHARS).length} generated.`);




