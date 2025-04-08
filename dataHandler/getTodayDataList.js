/**
 * 获取当天股票信息，并写入csv
 * f12 "代码",f14 "名称",
 * f2 "最新价",f15 "最高",f16 "最低",f17 "今开",f3 "涨跌幅",f4 "涨跌额", f5 "成交量",f6 "成交额",
 * f7 "振幅",f8 "换手率",f9 "市盈率-动态", f10 "量比", f11 "5分钟涨跌", f18 "昨收"
 * 需自行添加日期
 */
import fs from "fs";
import axios from "axios";

const todayDataListRaw = [];

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
        "fields": "f17,f2,f15,f16,f5,f6,f3,f12,f14", //formal
        // "fields": "f2,f12,f14", // test
        "_": "1623833739532",
    };
    await axios.get(url, { params }).then(async res => {
        try {
            // console.log(`这是第${pageCurrent}页的查询列表结果`, res.data.data.diff);
            todayDataListRaw.push(...res.data.data.diff);
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
const todayDataList = todayDataListRaw.filter(ele => /^00\d{4}$|^60\d{4}$/.test(ele.f12) && !(ele.f14.includes("ST") || ele.f14.includes("U") || ele.f14.includes("W")) && ele.f2 !== "-");
// console.log(todayDataList);

// 处理时间
const currentTime = new Date();
const [year, month, day] = ["getFullYear", "getMonth", "getDate"].map(fn => currentTime[fn]());
const handleNumber = num => (num < 10 ? "0" : "") + num;
const date = `${year}-${handleNumber(month + 1)}-${handleNumber(day)}`;

const todayDataObj = {};
todayDataList.forEach(obj => {
    todayDataObj[obj.f12] = [date, obj.f17, obj.f2, obj.f15, obj.f16, obj.f5, obj.f6, obj.f3];
});// 顺序：date, start_price, end_price, highest_price, lowest_price, quantity, amount, amplitude


// const historyDataList = res.data.data?.klines.map(record => record.split(",").map((val, index) => {
//     if ([1, 2, 3, 4, 7].includes(index)) {
//         return Math.round(val * 100);
//     } else if (index === 5) {
//         return Math.round(val * 1);
//     } else if (index === 6) {
//         return Math.round(val / 10000);
//     } else {
//         return val;
//     }
// }))



// fs.writeFileSync("./todayData.csv",)

// export default todayDataList

/** todayDataList
 *  [{
    f2: 4.63,
    f3: -5.89,
    f5: 100905,
    f6: 46706926,
    f12: '605055',
    f14: '迎丰股份',
    f15: 4.86,
    f16: 4.49,
    f17: 4.8
  },
  {
    f2: 9.36,
    f3: -3.31,
    f5: 67930,
    f6: 63301482,
    f12: '605050',
    f14: '福然德',
    f15: 9.67,
    f16: 9,
    f17: 9.6
}]
 */