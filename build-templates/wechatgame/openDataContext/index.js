const style = require('./render/style')
const template = require('./render/template')
const Layout = require('./engine').default;

let __env = GameGlobal.wx || GameGlobal.tt || GameGlobal.swan;
let sharedCanvas = __env.getSharedCanvas();
let sharedContext = sharedCanvas.getContext('2d');

// 昵称超长截断：超过5个字时截断并添加"..."
function truncateNickname(nickname) {
    const chars = Array.from(nickname || '');
    if (chars.length > 5) {
        return chars.slice(0, 5).join('') + '...';
    }
    return nickname;
}

function draw(data) {
    // 若 viewport 尚未就绪，用 sharedCanvas 物理尺寸兜底，保证首次渲染尺寸正确
    if (!Layout.hasViewPortSet) {
        Layout.updateViewPort({
            x: 0,
            y: 0,
            width: sharedCanvas.width,
            height: sharedCanvas.height,
        });
    }
    Layout.clear();
    Layout.init(template(data), style);
    Layout.layout(sharedContext);
}

// 主域发送结构为 {type:'engine', event:'viewport', data:{x,y,width,height}}
// 兼容直接传 box 的情况
function updateViewPort(msg) {
    const box = (msg && msg.data) || msg || {};
    Layout.updateViewPort({
        x: box.x || 0,
        y: box.y || 0,
        width: box.width || 0,
        height: box.height || 0,
    });
}

__env.onMessage(data => {
    if (data.type !== 'engine') {
        console.warn('Open Context get wrong type:', data.type);
        return;
    }

    if (data.event === 'viewport') {
        updateViewPort(data);
        return;
    }

    // 排行榜事件为 JSON 字符串，解析失败时跳过，避免中断后续消息
    let eventData;
    try {
        eventData = JSON.parse(data.event || '{}');
    } catch (e) {
        console.warn('parse event error:', e);
        return;
    }
    console.log('sub rank onMessage:', data);
    if (eventData.event === 'withdrawal_level') {
        showRankList(eventData.event, eventData);
    }
});

function showRankList(key, eventData) {
    __env.getFriendCloudStorage({
        // keyList 必须传真实的键名（sortfruitslevel / arrowlevel），与主域 setUserCloudStorage 的 key 一致
        keyList: [key],
        success: res => {
            if (!res.data || !res.data.length) {
                console.log('rank data is empty!');
                return;
            }

            const friendsData = { data: [] };
            let selfRank = null;
            const selfNickname = eventData.nickName || '';
            console.log("getFriendCloudStorage:", selfNickname, key, res.data.length);
            
            for (let i = 0; i < res.data.length; i++) {
                const score = res.data[i].KVDataList.length > 0 ? res.data[i].KVDataList[0].value : '0';
                const item = {
                    rankScore: `${score}`,
                    avatarUrl: res.data[i].avatarUrl || 'openDataContext/render/avatar.png',
                    nickname: truncateNickname(res.data[i].nickname || '无名氏'),
                };
                friendsData.data.push(item);
                // 通过昵称匹配自己的数据（大小写与主域保持一致：nickname）
                if (selfNickname && selfNickname === res.data[i].nickname) {
                    selfRank = item;
                }
            }

            // 按关卡数从高到低排序
            friendsData.data.sort((a, b) => Number(b.rankScore) - Number(a.rankScore));

            // 排序后重新计算自己的真实排名
            let selfRankIndex = -1;
            if (selfRank) {
                selfRankIndex = friendsData.data.findIndex(item => item.nickname === selfRank.nickname);
            }
            const selfItem = selfRankIndex > -1 ? friendsData.data[selfRankIndex] : null;

            friendsData.selfData = {
                rank: selfItem ? String(selfRankIndex + 1) : '200+',
                rankScore: selfItem ? selfItem.rankScore : (eventData.rankScore || '0'),
                avatarUrl: (selfItem ? selfItem.avatarUrl : eventData.avatarUrl) || 'openDataContext/render/avatar.png',
                nickname: selfItem ? selfItem.nickname : truncateNickname(eventData.nickname || '自己'),
            };

            draw(friendsData);
            console.log('show rank success');
        },

        fail: err => {
            console.warn('rank list show err:', err);
        },
    });
}