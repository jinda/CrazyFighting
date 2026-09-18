import { Layout_Rank } from "./Layout_Rank";
import { sys, Color, size } from "cc";
import { IRankData } from "./Layout_RankItem";
import { ClientApi } from "../../scripts/ClientApi";
import { DataMgr } from "../../scripts/DataMgr";
import { EPlatform, PlatformMgr } from "../../scripts/SDK/PlatformMgr";
import { Constants } from "../../scripts/Constants";

/**
 * 排行榜周期类型
 * 1=日榜 2=周榜 3=月榜 4=总榜
 */
export enum LeaderboardPeriod {
    Daily = 1,
    Weekly = 2,
    Monthly = 3,
    AllTime = 4,
}

export class UI_Rank extends egf.UIController {
    private _loopList = egf.LoopList.ins<IRankData>("RankList");
    private _type: string = "day";

    constructor() {
        super("ui_rank/UI_Rank", egf.UILayers.POPUP2, Layout_Rank);
    }

    public getRes(): [] {
        return [];
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        const layout = this.layout as Layout_Rank;

        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnDay, this.clickRank, this, "day");
        this.onButtonEvent(layout.btnWeekly, this.clickRank, this, "weekly");
        this.onButtonEvent(layout.btnMonth, this.clickRank, this, "month");
        this.onButtonEvent(layout.btnAll, this.clickRank, this, "all");
        this.onButtonEvent(layout.btnFriend, this.clickRank, this, "friend");

        layout.btnFriend.node.active = PlatformMgr.platform == EPlatform.WeChat;

        this._loopList.init(layout.scrollView, layout.scrollView.content!);
        this._loopList.initData([], layout.prefabItem, size(600, 124));
        // this._loopList.setLoadDataCB(this.loadNextPage.bind(this));

        this.clickRank(layout.btnDay, "weekly");

        // 微信平台：打开排行榜时检查是否需要申请头像权限（只提示一次）
        this.checkAvatarPermission();
    }

    protected onDispose(): void {
        this._loopList.freeList();
        PlatformMgr.getUserInfo({ destroy: true });
    }

    clickBack() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
    }

    clickRank(btn: any, type: string) {
        this._type = type;
        let layout = this.layout as Layout_Rank;
        layout.labelDay.color = new Color().fromHEX(type == "day" ? "#FFFFFF" : "#584543");
        layout.labelMonth.color = new Color().fromHEX(type == "month" ? "#FFFFFF" : "#584543");
        layout.labelWeekly.color = new Color().fromHEX(type == "weekly" ? "#FFFFFF" : "#584543");
        layout.labelAll.color = new Color().fromHEX(type == "all" ? "#FFFFFF" : "#584543");
        layout.labelFriend.color = new Color().fromHEX(type == "friend" ? "#FFFFFF" : "#584543");

        layout.scrollView.node.active = false;
        layout.nodeSubContentView.active = false;

        this._loopList.clearData();

        switch (type) {
            case "day":
                layout.scrollView.node.active = true;
                layout.labelTips.string = egf.i18nMgr.getText("展示今日排行") + egf.i18nMgr.getText("(仅展示前100名)");
                this.loadServerRank(LeaderboardPeriod.Daily);
                break;
            case "weekly":
                layout.scrollView.node.active = true;
                layout.labelTips.string = egf.i18nMgr.getText("展示每周排行") + egf.i18nMgr.getText("(仅展示前100名)");
                this.loadServerRank(LeaderboardPeriod.Weekly);
                break;
            case "month":
                layout.scrollView.node.active = true;
                layout.labelTips.string = egf.i18nMgr.getText("展示每月排行") + egf.i18nMgr.getText("(仅展示前100名)");
                this.loadServerRank(LeaderboardPeriod.Monthly);
                break;
            case "all":
                layout.scrollView.node.active = true;
                layout.labelTips.string = egf.i18nMgr.getText("展示历史排行") + egf.i18nMgr.getText("(仅展示前100名)");
                this.loadServerRank(LeaderboardPeriod.AllTime);
                break;
            case "friend":
                layout.nodeSubContentView.active = true;
                layout.labelTips.string = egf.i18nMgr.getText("展示好友排行");
                const eventData = {
                    event: Constants.LeaderboardMode,
                    avatarUrl: DataMgr.userData?.avatar,
                    nickName: DataMgr.userData?.nickname,
                };
                // 先显示开放数据域图层并告知子域视口，再请求好友榜单数据
                PlatformMgr.postMessage({
                    event: JSON.stringify(eventData),
                });
                break;
            default:
                break;
        }
    }

    private loadServerRank(period: LeaderboardPeriod) {
        this.getRankData(Constants.LeaderboardMode, period);
    }

    private getRankData(mode: string, period: LeaderboardPeriod) {
        ClientApi.inst.getLeaderboard(
            mode,
            period,
            100,
            (data) => {
                const rankDatas: IRankData[] = (data?.list || []).map((p, idx) => ({
                    index: idx,
                    rank: p.rank,
                    score: p.score,
                    name: p.nickname,
                    headUrl: p.avatar,
                }));
                this._loopList.pushDatas(rankDatas);
                if (data?.my) {
                    const myRank = data.my;
                    const layout = this.layout as Layout_Rank;
                    layout.selfRankItem.showInfo({
                        index: 0,
                        rank: myRank.rank,
                        score: myRank.score,
                        name: myRank.nickname,
                        headUrl: myRank.avatar,
                    });
                }
            },
            (errcode, errmsg) => {
                egf.Logger.log("loadServerRank error:", mode, period, errmsg);
            },
        );
    }

    loadNextPage() {}

    /**
     * 微信平台：打开排行榜时检查是否需要申请头像权限（只提示一次）
     * - 非微信平台 / 已有头像 / 已提示过 → 直接跳过
     * - 弹窗询问用户是否授权微信头像昵称，确认后走 authorize + getUserInfo + updateProfile 上传服务器
     * - 授权被拒时引导打开微信设置界面
     */
    private checkAvatarPermission() {
        if (PlatformMgr.platform != EPlatform.WeChat) {
            return;
        }
        if (DataMgr.userData?.avatar) {
            return;
        }

        const userInfoParams = {
            failCb: () => {
                egf.Logger.log("获取用户信息失败");
            },
            successCb: (userInfo: any) => {
                const avatarUrl = userInfo?.avatarUrl;
                const nickName = userInfo?.nickName;
                if (!avatarUrl) {
                    egf.Logger.log("未获取到头像地址");
                    return;
                }
                // 上传头像昵称到服务器，用于全服排行榜展示
                ClientApi.inst.updateProfile(
                    nickName,
                    avatarUrl,
                    () => {
                        egf.Logger.log("更新头像成功:", nickName, avatarUrl);
                        // 同步本地用户数据
                        if (DataMgr.userData) {
                            DataMgr.userData.avatar = avatarUrl;
                            DataMgr.userData.nickname = nickName;
                        }
                        // 刷新当前榜单，展示最新头像
                        this.refreshCurrentRank();
                    },
                    (errcode, errmsg) => {
                        egf.Logger.log("更新头像失败:", errcode, errmsg);
                    },
                );
            },
        };

        const callUserInfo = () => {
            PlatformMgr.getUserInfo(userInfoParams);
        };
        PlatformMgr.authorize({
            scope: "scope.userInfo",
            successCb: callUserInfo,
            failCb: callUserInfo,
        });
    }

    /**
     * 头像更新成功后，按当前 tab 重新拉取榜单
     */
    private refreshCurrentRank() {
        switch (this._type) {
            case "day":
                this.refreshServerRank(LeaderboardPeriod.Daily);
                break;
            case "weekly":
                this.refreshServerRank(LeaderboardPeriod.Weekly);
                break;
            case "month":
                this.refreshServerRank(LeaderboardPeriod.Monthly);
                break;
            case "all":
                this.refreshServerRank(LeaderboardPeriod.AllTime);
                break;
            default:
                break;
        }
    }

    private refreshServerRank(period: LeaderboardPeriod) {
        this._loopList.clearData();
        this.loadServerRank(period);
    }
}
