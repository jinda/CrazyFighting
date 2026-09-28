# 客户端 API 文档

## 概述

- **Base URL**: `http://{host}:10001/client`
- **通用 Header**:
  - `X-Game-Code: {game_code}` — 必填，标识游戏（默认值 `default`）
  - `Content-Type: application/json` — POST 请求必填
- **认证**: 登录后获取 token，后续请求通过 Header 或 Query 传递
- **响应格式**: `{ "errcode": 0, "errmsg": "操作成功!", "data": {...} }`

| errcode | 含义 |
|---------|------|
| 0 | 成功 |
| 10001 | 参数错误 |
| 10000 | 系统繁忙 |
| 10004 | 用户不存在 |
| 10034 | 账号已冻结 |
| 10043 | 道具不存在或未配置 |
| 10044 | 请求正在处理中，请稍后重试 |
| 10060 | 邮件不存在或不可用 |
| 10062 | 邮件附件尚未领取 |
| 10063 | 邮件无可领取附件 |
| 2 | 未登录/token 无效 |

> **变更(2026-08-15)**: 排行榜接口由自由 board_id 改为玩法 mode + 周期 type,见第 3-5 节。

---

## 1. 登录 / 注册

首次登录自动注册为新用户。

```
POST /client/login
```

**请求参数** (JSON Body):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uid | string | ✅ | 玩家唯一 ID（snowflake，超 JS 2^53，必须按字符串传，否则丢精度） |
| nickname | string | | 昵称（新用户必填，默认 `player_{uid}`） |
| avatar | string | | 头像 URL |

**请求示例**:
```json
{
  "uid": "10001",
  "nickname": "高手玩家",
  "avatar": "https://example.com/avatar.png"
}
```

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user_info": {
      "uid": "10001",
      "nickname": "高手玩家",
      "avatar": "https://example.com/avatar.png",
      "level": 0,
      "money": 0,
      "coin": 0
    },
    "is_new": true
  }
}
```

| 字段 | 说明 |
|------|------|
| token | JWT，后续请求放 Authorization header 或 ?token= 参数 |
| user_info | 玩家信息 |
| is_new | `true` = 本次自动注册，`false` = 已存在 |

多渠道登录(游客/微信/Google/Apple)见 [第 10 节](#10-多渠道登录游客微信googleapple)。

---

## 2. 获取玩家信息

```
GET /client/userinfo?uid={uid}
POST /client/userinfo
```

**认证方式**（三选一）:
- `Authorization: Bearer {token}` — Header 传 JWT
- `?token={token}&uid={uid}` — Query 参数
- `?uid={uid}` — 仅传 uid（开发环境，生产建议用 token）

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "uid": "10001",
    "nickname": "高手玩家",
    "avatar": "https://example.com/avatar.png",
    "level": 10,
    "money": 9999.5,
    "coin": 120
  }
}
```

---

### 2.1 更新昵称/头像

```
POST /client/updateprofile
```

**认证**: 需要 token 或 uid

**请求参数** (JSON Body, 至少传一项):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 二选一 | 昵称,非空,≤32 字符(按字符数计,支持中文) |
| avatar | string | 二选一 | 头像 URL,≤512 字节,传空字符串可清空头像 |

**请求示例**:
```json
{
  "nickname": "高手玩家",
  "avatar": "https://example.com/avatar.png"
}
```

**响应**: `errcode 0`,无 data。更新后排行榜展示的昵称/头像在下次读取时生效。

---

## 3. 获取玩法榜单列表

无需登录,返回当前游戏所有启用中的玩法及开启的周期。

```
POST /client/leaderboards
```

**请求**: 无参数(仅需 `X-Game-Code` header)

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "list": [
      { "mode": "classic", "name": "经典模式", "periods": [1, 2, 4], "score_type": 1 },
      { "mode": "endless", "name": "无尽模式", "periods": [4], "score_type": 0 }
    ]
  }
}
```

| 字段 | 说明 |
|------|------|
| mode | 玩法标识,推分/查榜时传入 |
| name | 玩法名称 |
| periods | 开启的周期: 1=日榜 2=周榜 3=月榜 4=总榜 |
| score_type | 计分类型: 0=自定义分数 1=最高关(客户端按此决定 score 传什么) |

---

## 4. 上传分数

```
POST /client/pushscore
```

**认证**: 需要 token 或 uid

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mode | string | ✅ | 玩法标识 |
| score | float64 | ✅ | 计分类型为 0 时传自定义分数;为 1 时传当前最高关(整数,如 52),服务端取整 |

**计分规则**(高分覆盖低分,低分上报被忽略但返回当前排名):

- **自定义分数榜 (score_type=0)**: 原样入榜,只保留历史最高分。
- **最高关榜 (score_type=1)**: 服务端取整为关卡数后入榜;同关卡的玩家,**先到达者排名靠前**。服务端无法校验客户端真实进度,排行榜数据依赖客户端如实上报。

自定义分数榜仍只写入请求玩法的所有开启周期。最高关榜与下方通关接口共享同一套进度规则：服务端取整后更新用户历史最高关，并同步当前游戏中**全部启用的最高关玩法及周期**；响应仍只返回请求 `mode` 的排名。关卡必须在 `1..9006`，重复、较低或乱序上报不会降低历史进度。

**请求示例**:
```json
{
  "mode": "classic",
  "score": 9999
}
```

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "mode": "classic",
    "score": 9999,
    "ranks": { "daily": 2, "weekly": 5, "alltime": 3 }
  }
}
```

| 字段 | 说明 |
|------|------|
| score | 回显本次上报的分数;最高关榜返回取整后的关卡数 |
| ranks | 各开启周期的当前排名(key 为 daily/weekly/monthly/alltime,1-based) |

---

### 4.1 上报通关进度

```
POST /client/progress/complete
```

**认证**: 需要 `Authorization: Bearer {client JWT}`。用户 UID 只从客户端 JWT 派生，游戏只从 JWT 与 `X-Game-Code` 的一致认证上下文派生；请求体不能指定或覆盖。

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| level | int64 | ✅ | 已通关关卡，范围 `1..9006`；不接受浮点数或字符串 |

**响应**:

```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "level": 52,
    "ranks": {
      "classic": { "daily": 2, "weekly": 5, "alltime": 10 },
      "speedrun": { "monthly": 8 }
    }
  }
}
```

- `level` 是持久化后的历史最高关；较低、重复或跳关上报都按只增不减处理。
- `ranks` 只包含当前启用、`score_type=1` 的玩法及其已配置周期。没有此类榜单时仍成功更新进度并返回 `{}`。
- 兼容升级前的历史数据时，服务端会按当前游戏和用户清理超出 `1..9006` 的榜单成员，并将越界的 `max_level` 归一到本次能够验证的最高合法关卡，不会把非法值扩散到其他玩法。
- MongoDB 中的 `max_level` 是进度事实源，Redis 榜单是派生视图。任一必需存储操作失败返回 `10000`；跨存储不回滚，客户端应使用相同或更低的 `level` 重试以补齐榜单，重试不会降低进度。
- 用户已不存在时返回 `10004`。

---

## 5. 获取排行榜

```
POST /client/leaderboard
```

**认证**: 需要 token 或 uid

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mode | string | ✅ | 玩法标识 |
| type | int | ✅ | 周期类型: 1=日榜 2=周榜 3=月榜 4=总榜(需该玩法已开启) |
| top | int | | 返回前 N 名,默认 50,上限 100 |

**请求示例**:
```json
{
  "mode": "classic",
  "type": 4,
  "top": 10
}
```

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "list": [
      { "uid": "10001", "nickname": "高手玩家", "avatar": "https://example.com/avatar.png", "score": 9999, "rank": 1 },
      { "uid": "10002", "nickname": "路人乙", "avatar": "https://example.com/b.png", "score": 8888, "rank": 2 }
    ],
    "my": { "uid": "10002", "nickname": "路人乙", "avatar": "https://example.com/b.png", "score": 8888, "rank": 2 }
  }
}
```

| 字段 | 说明 |
|------|------|
| uid | 玩家 UID(string) |
| nickname | 玩家昵称 |
| avatar | 玩家头像 URL |
| score | 榜单分数;最高关榜为关卡数(整数),自定义分数榜为原始分数 |
| rank | 排名(1-based) |
| my | 请求者自己在该榜的数据(同 list 条目结构,rank 为全榜真实排名,不在 top N 内也有值);该榜无自己的分数时 `score=0, rank=10000`(客户端按此判断"未上榜") |

---

## 6. 资源（金币/体力/道具）

资源账本服务端权威：客户端可以查询和消耗资源，也可以通过专用接口直接上报金币奖励；其他资源仍只能由注册、兑换码、邮件或后台发放。所有客户端写入都带幂等键 `req_id`。这里的金币是整数 `coin`，不是提现、充值或代理资金使用的 `money`。

### 6.1 查询资源

```
GET /client/resource
```

**认证**: 需要 token 或 uid

查询时服务端会先结算体力自然恢复（上限 30，每 5 分钟恢复 1 点）。

**响应**:

```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "coin": 100,
    "stamina": 25,
    "stamina_max": 30,
    "stamina_recover_seconds": 300,
    "stamina_next_regen_at": 1785534000,
    "items": [
      { "item_id": "bomb", "name": "炸弹", "num": 5 }
    ]
  }
}
```

| 字段 | 说明 |
|------|------|
| coin | 金币（整数） |
| stamina | 当前体力（已含恢复结算） |
| stamina_next_regen_at | 下次恢复 1 点体力的 unix 秒；满体力时为 0 |
| items | 道具背包（数量 > 0 的条目） |

### 6.2 消耗资源

```
POST /client/resource/consume
```

**认证**: 需要 token 或 uid

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| req_id | string | ✅ | 客户端生成的幂等键（≤64，如 uuid），重复请求返回相同结果不重复扣 |
| type | string | ✅ | `coin` / `stamina` / `item` |
| item_id | string | type=item 时必填 | 道具标识 |
| amount | int | ✅ | 消耗数量，1 ~ 1e9 |
| scene | string | | 场景标识（≤32，如 `level_enter`），仅审计 |

**响应**: `{ "balance": 25 }`（coin/stamina）或 `{ "num": 5 }`（item）。余额不足返回 `errcode 10031`。

**注意**: 消耗体力前服务端会自动结算自然恢复；一次请求消耗一种资源（多资源请多次调用，各带独立 req_id）。

### 6.3 上报获得金币

```
POST /client/resource/gain
```

**认证**: 需要 `Authorization: Bearer {client JWT}`。UID 只从客户端 JWT 派生；接口只增加当前认证用户在当前 `X-Game-Code` 下的 `coin`，不会修改 `money`。

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| req_id | string | ✅ | trim 后非空且不超过 64 字节；一次奖励使用一个稳定的幂等键 |
| amount | int64 | ✅ | 增加的金币，范围 `1..1,000,000,000`；不接受浮点数或字符串 |
| scene | string | | trim 后不超过 32 字节，仅用于审计，例如 `level_complete` |

**请求示例**:

```json
{ "req_id": "level-52-reward-01", "amount": 100, "scene": "level_complete" }
```

**成功响应**:

```json
{ "errcode": 0, "errmsg": "操作成功!", "data": { "coin": 220 } }
```

- 相同 `game_code + uid + req_id` 的完成请求返回首次发放后的余额，不重复增加金币。
- 重试必须保持 `amount` 和 `scene` 不变；同一 `req_id` 更换业务字段返回 `10001`。
- 并发请求暂时无法确认结果时返回 `10044`；存储错误返回 `10000`。遇到这两类结果应使用**同一请求体和 req_id**重试，不能生成新 req_id。
- 不同游戏、不同用户或不同发放来源可以复用相同 `req_id`。每次请求都会留下 `source=client_gain`、`resource=coin` 的资源流水用于审计，并使用 `(game_code, uid, type, source, req_id, resource, item_id)` 唯一索引；客户端加币不会占用邮件等奖励来源的幂等键。
- 服务端只校验范围和幂等，不验证客户端的奖励依据；客户端不得把此接口当作 `money` 入账接口。

---

## 7. 兑换码兑换

```
POST /client/code/redeem
```

**认证**: 需要 token 或 uid

**请求参数**: `{ "code": "VipCode2026" }`

**响应**: 发放清单 `{ "coin": 100, "stamina": 30, "items": { "bomb": 5 } }`

兑换码配置由后台"兑换码"页维护，`items` 编码约定：`coin`/`stamina`/`item:<道具标识>`。

| errcode | 含义 |
|---------|------|
| 10040 | 兑换码不存在或已失效 |
| 10041 | 该兑换码已被使用（同一玩家） |
| 10042 | 兑换码已被兑换完 |
| 10043 | 道具不存在或未配置 |

---

## 8. 获取广告配置

无需认证,按后台为当前游戏维护的动态渠道返回广告单元 ID。`wechat`(微信)和 `admob`(AdMob)是管理端始终展示的兼容默认渠道,管理员也可新增 `tt` 等自定义渠道。

```
POST /client/adconfig
```

**请求参数** (JSON Body):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | string | | 广告渠道代码,缺省 `wechat`;服务端 trim 后转小写,格式为 `^[a-z][a-z0-9_-]{0,31}$` |

**请求示例**:
```json
{
  "channel": "admob"
}
```

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "reward_video_ad_id": "adunit-video-xxx",
    "interstitial_ad_id": "adunit-inter-xxx",
    "banner_ad_id": "adunit-banner-xxx"
  }
}
```

渠道代码必须与管理端创建时的代码一致。渠道未配置或已禁用(status=0)时返回 errcode 0 且 data 为空,游戏客户端应降级处理；格式非法返回 10001。请求体不接受 game code,租户只由 `X-Game-Code` 确定。

---

## 9. 玩家存档(key-value)

保存玩家自己的数据(存档/设置/进度),value 为字符串,客户端自行 JSON 序列化。
存档按游戏 + 玩家隔离,同一游戏内不同玩法共享同一存档空间(key 由客户端约定前缀区分)。

| 约束 | 值 |
|------|-----|
| key | 非空,≤64 字节 |
| value | ≤65536 字节(64KB) |
| 条数 | 每玩家每游戏最多 500 个 key(仅新增时校验) |

### 7.1 保存

```
POST /client/savedata
```

**认证**: 需要 token 或 uid

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | ✅ | 存档 key |
| value | string | ✅ | 存档内容(JSON 字符串等,客户端自理序列化) |

**请求示例**:
```json
{
  "key": "settings",
  "value": "{\"music\":true,\"level\":3}"
}
```

**响应**: `errcode 0`,无 data;同 key 再次保存为覆盖写入。

### 7.2 读取

```
POST /client/getdata
```

**请求**: `{ "key": "settings" }`

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": { "key": "settings", "value": "{\"music\":true,\"level\":3}" }
}
```

key 不存在时返回 errcode 0,data 字段为空(缺省)。

### 7.3 删除

```
POST /client/delsavedata
```

**请求**: `{ "key": "settings" }`

**响应**: `errcode 0`。删除不存在的 key 同样返回成功(幂等)。

### 7.4 读取全部

```
POST /client/getalldata
```

**请求**: 无参数

**响应**:
```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "list": [
      { "key": "settings", "value": "{\"music\":true,\"level\":3}" },
      { "key": "progress", "value": "{\"chapter\":5}" }
    ]
  }
}
```

---

## 完整调用示例

```bash
BASE="http://localhost:10001"
GAME="default"

# 1. 登录(自动注册)
LOGIN=$(curl -s -X POST $BASE/client/login \
  -H "X-Game-Code: $GAME" \
  -H "Content-Type: application/json" \
  -d '{"uid":"10001","nickname":"玩家一号"}')
TOKEN=$(echo $LOGIN | jq -r '.data.token')
echo "Token: ${TOKEN:0:30}..."

# 2. 获取玩法榜单列表
curl -s -X POST $BASE/client/leaderboards \
  -H "X-Game-Code: $GAME" | jq .

# 3. 上传分数(写入 classic 玩法的所有开启周期)
curl -s -X POST $BASE/client/pushscore \
  -H "X-Game-Code: $GAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"classic","score":8500}' | jq .

# 3.1 上报通关并同步全部启用的最高关榜
curl -s -X POST $BASE/client/progress/complete \
  -H "X-Game-Code: $GAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level":52}' | jq .

# 3.2 上报金币奖励；网络重试必须复用完全相同的 req_id 和请求体
curl -s -X POST $BASE/client/resource/gain \
  -H "X-Game-Code: $GAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"req_id":"level-52-reward-01","amount":100,"scene":"level_complete"}' | jq .

# 4. 查看总榜
curl -s -X POST $BASE/client/leaderboard \
  -H "X-Game-Code: $GAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"classic","type":4,"top":10}' | jq .

# 5. 获取广告配置(缺省微信渠道;其他渠道传后台创建的 channel 代码)
curl -s -X POST $BASE/client/adconfig \
  -H "X-Game-Code: $GAME" \
  -H "Content-Type: application/json" | jq .

# 6. 获取玩家信息
curl -s "$BASE/client/userinfo?uid=10001" \
  -H "X-Game-Code: $GAME" | jq .

# 7. 保存存档
curl -s -X POST $BASE/client/savedata \
  -H "X-Game-Code: $GAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"settings","value":"{\"music\":true}"}' | jq .

# 8. 读取存档
curl -s -X POST $BASE/client/getdata \
  -H "X-Game-Code: $GAME" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"settings"}' | jq .
```

---

## 10. 多渠道登录(游客/微信/Google/Apple)

统一登录接口,除现有 uid 登录(第 1 节)外的四种登录方式。

```
POST /client/oauthlogin
```

**认证**: 无需登录(仅需 `X-Game-Code` header)

**请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| login_type | string | ✅ | `guest` / `wechat` / `google` / `apple` |
| device_id | string | guest 必填 | 设备唯一标识(≤128 字节),首次自动注册 |
| code | string | wechat 必填 | wx.login 获取的临时 code |
| id_token | string | google 必填 | Google Sign-In 返回的 ID Token |
| identity_token | string | apple 必填 | Sign in with Apple 返回的 identityToken |
| nickname | string | | 新注册时使用,缺省按渠道生成 |
| avatar | string | | 新注册时使用 |

**响应**(与第 1 节登录一致):

```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user_info": { "uid": "1700000000000000001", "nickname": "guest_dev-abc-", "avatar": "", "level": 0, "money": 0 },
    "is_new": true
  }
}
```

**错误码**:

| errcode | 含义 |
|---------|------|
| 10001 | 参数错误 |
| 10000 | 系统繁忙 |
| 10034 | 账号已冻结 |
| 10007 | 该登录方式未配置(后台未配参数或已禁用) |
| 10008 | 第三方登录校验失败(code/token 无效或过期) |

**示例**:

```json
// 游客
{ "login_type": "guest", "device_id": "dev-abc-123" }
// 微信
{ "login_type": "wechat", "code": "0a3Xyz..." }
// Google
{ "login_type": "google", "id_token": "eyJhbGciOiJSUzI1NiIs..." }
// Apple
{ "login_type": "apple", "identity_token": "eyJraWQiOi..." }
```

同一渠道同一标识重复登录返回同一账号(is_new=false),不同渠道账号互相独立。

---

## 11. 玩家邮件

四个邮件接口都要求 `Authorization: Bearer {token}`，并校验 token 中的 game code 与
`X-Game-Code` 一致。邮件 ID 始终使用正十进制字符串，不能传 JSON number、负数、小数、
指数形式或带空白的字符串。

个人邮件只对收件 UID 可见。全服邮件只对邮件发送时已经注册的玩家可见；注册时间缺失时
服务端使用玩家 Mongo ObjectID 的生成时间兜底，仍无法确定时不返回全服邮件。玩家的已读、
已领取和删除状态互相隔离，不会修改共享邮件或影响其他玩家。

### 11.1 邮件列表

```
POST /client/mail/list
```

**请求**: `{ "page": 1, "limit": 20 }`。page 或 limit 省略、为 0 或负数时分别使用 1 和
20；limit 最大为 100。

**响应**:

```json
{
  "errcode": 0,
  "errmsg": "操作成功!",
  "data": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "list": [
      {
        "id": "2088945255909953536",
        "title": "维护补偿",
        "sender": "系统",
        "has_rewards": true,
        "is_read": false,
        "is_claimed": false,
        "created_at": "2026-09-15 12:00:00"
      }
    ]
  }
}
```

列表按 `created_at desc, _id desc` 稳定排序，只返回摘要，不包含正文或附件明细；没有邮件时
`list` 为 `[]`。

### 11.2 读取邮件

```
POST /client/mail/read
```

**请求**: `{ "mail_id": "2088945255909953536" }`

读取会幂等标记当前玩家已读。成功响应字段为
`id,title,content,sender,rewards,is_read,is_claimed,created_at`，附件项格式为
`{ "key": "bomb", "value": 2 }`。邮件不可见、属于其他玩家或游戏、或已由当前玩家删除时
返回 `10060`。

### 11.3 领取附件

```
POST /client/mail/claim
```

**请求**: `{ "mail_id": "2088945255909953536" }`

附件当前只支持启用中的道具。成功响应示例：

```json
{ "errcode": 0, "errmsg": "操作成功!", "data": { "items": { "bomb": 7 } } }
```

服务端使用 `mail:<mail_id>` 作为持久幂等键。重复请求（包括领取后删除再重放）返回同一资源
流水结果，不会重复发放；首次完整发放后同时标记已读和已领取。并发请求正在处理时返回
`10044`，道具不存在或停用返回 `10043`，没有附件返回 `10063`。奖励已完成但邮件状态收尾
失败时返回 `10000`，使用相同请求重试会从资源流水恢复并补齐状态。库存写入超时等结果不明确
的故障同样保留幂等流水；紧接着重试可能先返回 `10044`，稍后重试会恢复原流水且不会重复增加道具。

### 11.4 批量删除

```
POST /client/mail/delete
```

**请求**: `{ "mail_ids": ["2088945255909953536", "2088945255909953537"] }`

mail_ids 必须包含 1–100 个互不重复的合法 ID。服务端先校验整批：任何邮件不可见时返回
`10060`；全部可见后，如存在尚未领取的附件则返回 `10062`，这两类失败都不会删除本批其他
邮件。成功仅软删除当前玩家状态，并返回本次新增删除数：

```json
{ "errcode": 0, "errmsg": "操作成功!", "data": { "deleted_count": 2 } }
```

无附件、附件已领取或已经删除的邮件可幂等提交，重复删除不计入 `deleted_count`。多封邮件的
状态写入不使用事务；存储中断时接口返回 `10000`，已完成的子集保持删除，使用相同 ID 列表
重试可补齐剩余项。

---

## 管理后台配置

客户端使用的排行榜和广告配置需在管理后台预先配置：

- **排行榜**: `游戏管理 > 排行榜管理` → 新增玩法并勾选开启周期(mode 即为请求中的 mode,周期 1/2/3/4 对应日/周/月/总榜)
- **广告**: `游戏管理 > 广告管理` → 微信/AdMob 为默认渠道；可动态新增渠道代码和名称，再分别填写激励视频/插屏/Banner 的广告单元 ID 并启用
- **游戏**: `游戏管理 > 游戏列表` → 新增游戏（`X-Game-Code` header 对应游戏代码）
- **登录配置**: `游戏管理 > 登录配置` → 按游戏填写微信 appid/secret、Google client_id、Apple bundle_id,并启用。未配置的渠道客户端登录返回 10007。
