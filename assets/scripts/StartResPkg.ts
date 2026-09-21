import { AudioClip, TextAsset, JsonAsset, Prefab, Scene, SpriteFrame } from "cc";

var resPkg = {
    module_sounds: {
        assetType: AudioClip,
        urls: [],
    },

    module_game: [
        {
            assetType: Scene,
            urls: ["scene/fight"],
        },
        {
            assetType: Prefab,
            urls: [],
        },
        {
            assetType: TextAsset,
            urls: ["datas/fighter", "datas/level"],
        },
    ],
    module_i18n: [
        {
            assetType: JsonAsset,
            urls: ["label/en_us", "label/zh_cn"],
        },
        {
            assetType: SpriteFrame,
            urls: ["sprite/en_us/logo/spriteFrame", "sprite/en_us/logo/spriteFrame"],
        },
    ],
    module_extra: {
        assetType: Prefab,
        urls: ["ui_alert/UI_Alert", "ui_common_tips/UI_CommonTips", "ui_toast/UI_Toast"],
    },
};

export default resPkg;
