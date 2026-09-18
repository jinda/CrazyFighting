import { _decorator, Color, isValid, Label, Node, Sprite, SpriteFrame, Texture2D } from "cc";
const { ccclass, property } = _decorator;

export interface IRankData {
    index?: number;
    rank: number;
    score: number;
    name: string;
    headUrl: string;
}

@ccclass("Layout_RankItem")
export class Layout_RankItem extends egf.ShowNode<IRankData> {
    @property(Label)
    labelRank: Label = null!;
    @property(Label)
    labelScore: Label = null!;
    @property(Label)
    labelName: Label = null!;
    @property(Sprite)
    spriteHead: Sprite = null!;
    @property(SpriteFrame)
    frameHead: SpriteFrame = null!;

    public initShow(): void {
        if (this.data!.rank > 100) {
            this.labelRank.string = "100+";
        } else {
            this.labelRank.string = this.data!.rank.toString();
        }
        const color = this.data!.rank > 3 ? "#50403f" : "#FDCC48";
        this.labelRank.color = new Color().fromHEX(color);
        this.labelScore.string = this.data!.score.toString();
        this.labelName.string = this.data!.name;
        if (this.data!.headUrl) {
            egf.ResMgr.getAsset(
                "",
                this.data!.headUrl,
                (spriteFrame: SpriteFrame) => {
                    if (isValid(this.spriteHead)) {
                        this.spriteHead.spriteFrame = spriteFrame;
                    }
                },
                SpriteFrame,
            );
        } else {
            this.spriteHead.spriteFrame = this.frameHead;
        }
    }

    public showInfo(rankData: IRankData) {
        this.data = rankData;
        this.initShow();
    }
}
