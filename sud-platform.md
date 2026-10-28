# SUD 平台接入

`ISud.ts` 实现现有 `SDKInterface`，由 `PlatformMgr` 检测宿主全局 `sud` 后自动选择。
SUD 检测优先于 Cocos 的平台标识，兼容引擎适配器沿用微信平台标识的情况。

## 运行与配置

- 使用 Cocos Creator 3.8.8 和对应的 SUD 引擎适配流程生成小游戏，在 SUD 宿主或 HelloPinK 中验证。
  本次代码接入不包含引擎适配器或构建产物，普通浏览器仍使用原平台分支。
- 在游戏后台为当前 `X-Game-Code` 配置 SUD 登录渠道及 Game ID/Secret。密钥仅保存在服务端。
- 客户端调用 `sud.login`，将一次性 `code` 原样提交给 `/client/oauthlogin`，`login_type` 为 `sud`。
  业务 token 和云存档继续使用现有 `ClientApi`、`LocalDataMgr` 流程。
- 在广告配置后台创建 `sud` 渠道，配置 `reward_video_ad_id`、`interstitial_ad_id`、`banner_ad_id`。
  使用 SUD 控制台的广告单元 ID。缺少配置的广告会返回未完成，不发放激励奖励。
- 广告配置在业务登录成功后获取，以兼容现有客户端的本地 token 检查。
  SDK 登录失败时继续初始化本地游戏，不伪造 SUD 身份。

## 平台行为

- 用户信息由 `sud.getUserInfo` 获取，保留 `nickname/avatar`，并映射为现有回调使用的 `nickName/avatarUrl`。
  获取和授权由用户主动操作触发，授权 scope 按实际渠道要求传入。
- 广告加载完成以 `onLoad` 为准，激励完播以 `onClose.isEnded === true` 为准。
  `load()` / `show()` 的 Promise 成功仅代表调用受理，不能作为发奖依据。
- 未就绪的全屏广告立即返回失败，不排队展示。每个全屏实例仅展示一次，关闭后重新预加载；
  预加载间隔至少 10 秒，加载失败不循环重试。重新初始化时清理监听、实例、定时器和待处理广告回调。
- 加载或展示失败会输出 `errCode`、`errMsg` 和 `adUnitId`；若 `load()` 既不回调 `onLoad`
  也不回调 `onError`，实例会在 15 秒后于下一次准备/展示时被释放并重新加载。
- Banner 使用 `getContainerInfo()` 的逻辑像素，支持顶部和底部，加载期间隐藏后不会迟到展示。
- 音频和前后台会话上报继续使用现有 Cocos `Game.EVENT_SHOW/HIDE` 链路，避免重复订阅和重复上报。
- 分享、微信好友开放数据域和游戏圈没有接入 SUD 对应能力。分享回调明确返回失败；
  好友榜和游戏圈继续由现有微信平台条件控制。

## 验证

运行 `node tools/verify_sud_platform.js`，使用模拟宿主验证平台识别、登录路由、广告生命周期、
重复或迟到回调、加载限频、Banner 尺寸及游戏暂停恢复，不需要新增依赖或测试框架。

在真实 SUD 宿主中还需验证登录后台配置、前后台切换、广告投放和完播奖励，以及引擎适配后的资源与网络加载。

参考：[客户端 API](https://developer.sud.tech/openpaas/minigame/client-api/)、
[登录](https://developer.sud.tech/openpaas/minigame/client-api/open-api/login/sud.login.html)、
[激励视频展示](https://developer.sud.tech/openpaas/minigame/guide/open-capabilities/ads/rewarded-video-ad/RewardedVideoAd.show.html)、
[Banner 创建](https://developer.sud.tech/openpaas/minigame/guide/open-capabilities/ads/creation/sud.createBannerAd.html)。
