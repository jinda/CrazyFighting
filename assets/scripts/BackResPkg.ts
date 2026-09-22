import { Prefab } from "cc";

var resPkg = {
    module_game: [
        {
            assetType: Prefab,
            urls: [
                "ui_buyFighter/UI_BuyFighter",
                "ui_fighter/UI_Fighter",
                "ui_rank/UI_Rank",
                "ui_settlement/UI_Settlement",
                "ui_sign/UI_Sign",
            ],
        },
    ],

    module_extra: {
        assetType: Prefab,
        urls: ["ui_award/UI_Award", "ui_help/UI_Help", "ui_hud/UI_HUD", "ui_setting/UI_Setting"],
    },
};

export default resPkg;
