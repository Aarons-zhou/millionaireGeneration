/**
 * 根据todayDataList.csv，获取个股的历史股价信息，并写入数据库。
 */

import fs from "fs";
import axios from "axios";
import mysql from "mysql2/promise";
import sqlConf from "./sqlConf.json" with { type: "json" };

// 1. 根据todayDataList得到codelist；
const codeList = await fs.readFileSync("./todayDataList.csv").toLocaleString().split("\n").map(str => str.split(",")).map(list => list[0]);

// 2. 根据codelist遍历得到每个个股的历史价；
const getHistoryDataList = async (stockCode) => {
    const url = "http://push2his.eastmoney.com/api/qt/stock/kline/get";
    /**
     * 获取股票历史信息
     * f11 "代码",f3 "名称",
     * f51 "日期", f52 "今开", f53 "最新价",f54 "最高",f55 "最低",
     * f56 "成交量",f57 "成交额",f59 "涨跌幅"
     */
    const params = {
        "fields1": "f1,f3",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f59",
        "ut": "7eea3edcaed734bea9cbfc24409ed989",
        "klt": "101", // daily:"101", weekly:"102", monthly:"103"
        "fqt": "1", // 前复权:"1", 后复权:"2", 不复权:""
        "secid": `${/^60\d{4}$/.test(stockCode) ? "1" : "0"}.${stockCode}`, // 00开头要0.code，60开头要1.code
        "beg": "20230101",
        "end": "20251231",
        "_": "1623766962675",
    }
    try {
        const res = await axios.get(url, { params });
        // 清洗数据：f52 "今开", f53 "最新价",f54 "最高",f55 "最低",f59 "涨跌幅"都扩大一百倍; f57 "成交额"单位为万元。
        const historyPriceList = [];
        const historyDataList = res.data.data?.klines.map(record => record.split(",").map((val, index) => {
            if (index === 2) {
                historyPriceList.push(Math.round(val * 100));
            }
            if ([1, 2, 3, 4, 7].includes(index)) {
                return Math.round(val * 100);
            } else if (index === 5) {
                return Math.round(val * 1);
            } else if (index === 6) {
                return Math.round(val / 10000);
            } else {
                return val;
            }
        }));
        // 生成MA数组
        const createMA = day => {
            const MAList = new Array(historyPriceList.length);
            for (let i = (day - 1); i < historyPriceList.length; i++) {
                let MAprice = 0;
                for (let j = i - day + 1; j <= i; j++) {
                    MAprice += historyPriceList[j];
                }
                MAList[i] = Math.round(MAprice / day);
            }
            return MAList;
        }
        const MA5List = createMA(5);
        const MA10List = createMA(10);
        const MA20List = createMA(20);
        const MA30List = createMA(30);
        const MA60List = createMA(60);
        const MA120List = createMA(120);
        // 添加MA数据
        historyDataList.forEach((list, index) => {
            list.push(MA5List[index], MA10List[index], MA20List[index], MA30List[index], MA60List[index], MA120List[index])
        })
        // 3. 写入数据库。
        const create_table_command = `CREATE TABLE IF NOT EXISTS stock${res.data.data.code} 
        (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT, 
        MA5 INT, MA10 INT, MA20 INT, MA30 INT, MA60 INT, MA120 INT)`
        await conn.execute(`${create_table_command}`);
        await conn.query(`INSERT INTO stock${res.data.data.code} VALUES ?`, [historyDataList]);
        console.log("插入数据完毕", stockCode);
    } catch (error) {
        console.warn("getHistoryDataList", error);
    }
}

const conn = await mysql.createConnection(sqlConf);
// 一次性访问会超时，分批访问
const splitConf = (index, num) => index >= 300 * (num - 1) && index < 300 * num;
const codeListSplit = codeList.filter((_, index) => splitConf(index, 1)); // 逐次更改splitConf第二个传参
codeListSplit.forEach(async code => {
    await getHistoryDataList(code);
})