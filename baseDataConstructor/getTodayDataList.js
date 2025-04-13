/**
 * 获取当天股票信息，并写入csv。
 * f12 "代码",f14 "名称",
 * f2 "最新价",f15 "最高",f16 "最低",f17 "今开",f3 "涨跌幅",f4 "涨跌额", f5 "成交量",f6 "成交额",
 * f7 "振幅",f8 "换手率",f9 "市盈率-动态", f10 "量比", f11 "5分钟涨跌", f18 "昨收"
 * 需自行添加日期
 */

import fs from "fs";
import axios from "axios";
import mysql from "mysql2/promise";
import sqlConf from "./sqlConf.json" with { type: "json" };

// 1. 获取当天股票信息
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
        "fields": "f17,f2,f15,f16,f5,f6,f3,f12,f14",
        "_": "1623833739532",
    };
    try {
        const res = await axios.get(url, { params });
        todayDataListRaw.push(...res.data.data.diff);
        if (pageCurrent * pageSize < res.data.data.total) {
            pageCurrent += 1;
            await getTodayDataList(pageCurrent);
        }
    } catch (error) {
        console.warn("getTodayDataList", error);
    }
}
await getTodayDataList();


// 2. 处理数据
/**
 * 筛选数据规则：
 * 1. 保留沪深二市非科创：60、00开头
 * 2. 过滤ST、U、W：名称不含ST、U、W
 * 3. 过滤退市：f2为"-"
 */
const todayDataList = todayDataListRaw.filter(ele => /^00\d{4}$|^60\d{4}$/.test(ele.f12) && !(ele.f14.includes("ST") || ele.f14.includes("U") || ele.f14.includes("W")) && ele.f2 !== "-");
// 处理时间
const currentTime = new Date();
const [year, month, day] = ["getFullYear", "getMonth", "getDate"].map(fn => currentTime[fn]());
const handleNumber = num => (num < 10 ? "0" : "") + num;
const date = `${year}-${handleNumber(month + 1)}-${handleNumber(day)}`;
// 处理数据类型
const todayDataListMap = todayDataList.map(obj => [obj.f12, date, Math.round(obj.f17 * 100), Math.round(obj.f2 * 100), Math.round(obj.f15 * 100), Math.round(obj.f16 * 100), Math.round(obj.f5 * 1), Math.round(obj.f6 / 10000), Math.round(obj.f3 * 100)]);
// 处理存储类型
const todayDataObj = {};
todayDataListMap.forEach(list => {
    todayDataObj[list[0]] = list.filter((_, index) => index);
});
// 写入csv，为getHistoryDataList.csv提供股票代码列表
await fs.writeFileSync("./todayDataList.csv", todayDataListMap.map(list => list.join()).join("\n"));

// 3. 读取数据库中的历史股价，添加MA数据
const conn = await mysql.createConnection(sqlConf);
const [tableListRaw] = await conn.execute("SHOW TABLES FROM stock_data");
const tableList = tableListRaw.map(obj => obj["Tables_in_stock_data"]);
tableList.forEach(async tableName => {
    const [recordList] = await conn.query(`SELECT * FROM ${tableName} ORDER BY trade_day DESC LIMIT 119`);
    const historyPriceList = recordList.map(obj => obj["end_price"]);
    const todayData = todayDataObj[tableName.replace(/stock/, "")];
    historyPriceList.unshift(todayData[2]);
    const MAlist = [5, 10, 20, 30, 60, 120].map(num => Math.round(historyPriceList.filter((_, index) => index < num).reduce((former, letter) => former + letter) / num))
    todayData.push(...MAlist);
});

// 4. 写入数据库
for (let code in todayDataObj) {
    const create_table_command = `CREATE TABLE IF NOT EXISTS stock${code}
        (trade_day DATE, opening_price INT, closing_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT,
        MA5 INT, MA10 INT, MA20 INT, MA30 INT, MA60 INT, MA120 INT)`
    await conn.execute(`${create_table_command}`);
    await conn.query(`INSERT INTO stock${code} VALUES ?`, [[todayDataObj[code]]]);
    console.log("插入数据完毕", code);
}