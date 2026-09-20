function escapeXml(str) {
    var amp = '&' + 'amp;';
    var lt = '&' + 'lt;';
    var gt = '&' + 'gt;';
    var quot = '&' + 'quot;';
    var apos = '&' + 'apos;';
    return String(str == null ? '' : str)
        .replace(/&/g, amp)
        .replace(/</g, lt)
        .replace(/>/g, gt)
        .replace(/"/g, quot)
        .replace(/'/g, apos);
}

function layoutOf(itemsList) {
    let out = '<view class="container" id="main"> <view class="rankList"> <scrollview class="list" scrollY="true"> ';
    const datas = itemsList.data;
    if (datas) {
        let item, index = -1;
        const len = datas.length - 1;
        while (index < len) {
            item = datas[index += 1];
            out += ' ';

            out += ' <view class="listItem"> ';
            out += ' ';
            out += ' <view id="listItemUserData"> <text class="listItemNum" value="' + (index + 1)
                + '"></text> <image class="listHeadImg" src="' + escapeXml(item.avatarUrl)
                + '"></image> <text class="listItemName" value="' + escapeXml(item.nickname)
                + '"></text> </view> <text class="listItemScore" value="' + '第' + escapeXml(item.rankScore) + '关'
                + '"></text> </view> ';
        }
    }
    out += ' </scrollview>';
    out += ' <view class="listSelfItem"> ';
    out += ' ';
    out += ' <view id="listItemUserData"> <text class="listItemNum" value="' + escapeXml(itemsList.selfData.rank)
        + '"></text> <image class="listHeadImg" src="' + escapeXml(itemsList.selfData.avatarUrl)
        + '"></image> <text class="listItemName" value="' + escapeXml(itemsList.selfData.nickname)
        + '"></text> </view> <text class="listItemScore" value="' + '第' + escapeXml(itemsList.selfData.rankScore) + '关'
        + '"></text> </view> ';
    out += '</view></view>';
    return out;
}

module.exports = layoutOf;