import axios from "axios"
const todayDataList = [];

/**
 * 获取当天股票信息
 * f12 "代码",f14 "名称",
 * f2 "最新价",f15 "最高",f16 "最低",f17 "今开",f3 "涨跌幅",f4 "涨跌额",
 * f5 "成交量",f6 "成交额",,
 * f7 "振幅",f8 "换手率",f9 "市盈率-动态", f10 "量比", f11 "5分钟涨跌", f18 "昨收"
 * 需自行添加日期
 */
const getTodayDataList = async (pageCurrent = 1, pageSize = 50) => {
    const url = "http://82.push2.eastmoney.com/api/qt/clist/get";
    const params = {
        "pn": pageCurrent,
        "pz": pageSize,
        "po": "1",
        "np": "1",
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": "2",
        "invt": "2",
        "fid": "f12",
        "fs": "m:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048",
        "fields": "f2,f3,f4,f5,f6,f12,f14,f15,f16,f17", //formal
        // "fields": "f2,f12,f14", // test
        "_": "1623833739532",
    };
    await axios.get(url, { params }).then(async res => {
        try {
            // console.log(`这是第${pageCurrent}页的查询列表结果`, res.data.data.diff);
            todayDataList.push(...res.data.data.diff);
            if (pageCurrent * pageSize < res.data.data.total) { //formal
            // if (pageCurrent < 18) { //test
                pageCurrent += 1;
                await getTodayDataList(pageCurrent);
            }
        } catch (error) {
            console.warn("getTodayDataList", error);
        }
    });
}
await getTodayDataList();

/**
 * todayDataList为对象数组
 * 筛选规则：
 * 1. 保留沪深二市非科创：60、00开头
 * 2. 过滤ST、U、W：名称不含ST、U、W
 * 3. 过滤退市：f2为"-"
 */
export default todayDataList.filter(ele => /^00\d{4}$|^60\d{4}$/.test(ele.f12) && !(ele.f14.includes("ST") || ele.f14.includes("U") || ele.f14.includes("W")) && ele.f2 !== "-");
