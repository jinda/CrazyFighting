import { _decorator, Button, Component, Label, Node, Prefab, ScrollView } from "cc";
import { Layout_RankItem } from "./Layout_RankItem";
const { ccclass, property } = _decorator;

@ccclass("Layout_Rank")
export class Layout_Rank extends Component {
    @property(Button)
    btnBack: Button = null!;
    @property(Button)
    btnDay: Button = null!;
    @property(Button)
    btnWeekly: Button = null!;
    @property(Button)
    btnMonth: Button = null!;
    @property(Button)
    btnAll: Button = null!;
    @property(Button)
    btnFriend: Button = null!;
    @property(Label)
    labelDay: Label = null!;
    @property(Label)
    labelWeekly: Label = null!;
    @property(Label)
    labelMonth: Label = null!;
    @property(Label)
    labelAll: Label = null!;
    @property(Label)
    labelFriend: Label = null!;
    @property(Label)
    labelTips: Label = null!;
    @property(Node)
    nodeSubContentView: Node = null!;
    @property(ScrollView)
    scrollView: ScrollView = null!;
    @property(Layout_RankItem)
    selfRankItem: Layout_RankItem = null!;
    @property(Prefab)
    prefabItem: Prefab = null!;
}
