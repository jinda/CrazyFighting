import { AudioClip, JsonAsset, Prefab, Scene, SpriteFrame } from "cc";

var resPkg = {
    module_sounds: {
        assetType: AudioClip,
        urls: [],
    },

    module_basic: [
        {
            assetType: Scene,
            urls: ["scene_mainmenu/main_menu"],
        },
        {
            assetType: Prefab,
            urls: ["ui_waiting/UI_Waiting"],
        },
        {
            assetType: JsonAsset,
            urls: ["config/ItemConfig"],
        },
    ],
    module_i18n: [
        {
            assetType: JsonAsset,
            urls: ["label/en_us", "label/zh_cn"],
        },
        {
            assetType: SpriteFrame,
            urls: ["sprite/en_us/img_title/spriteFrame", "sprite/en_us/img_title/spriteFrame"],
        },
    ],
    module_extra: {
        assetType: Prefab,
        urls: ["ui_setting/UI_Setting", "ui_tips/UI_Tips", "ui_alert/UI_Alert"],
    },
};

export default resPkg;
