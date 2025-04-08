/**
 * 1. 根据todayDataList得到codelist；
 * 2. fs模块：写入codelist存起来；
 * 3. 根据codelist遍历得到每个个股的历史价；
 * 4. 写入数据库。
 */

import fs from "fs";
import axios from "axios";
import mysql from "mysql2/promise";
// import todayDataList from "../crawling/getTodayDataList.js"


// 1. 根据todayDataList得到codelist；
// const codeList = todayDataList.map(ele => ele.f12)

// 2. fs模块：写入codelist存起来；
// await fs.writeFileSync("./codeList.csv",codeList.join())
const codeListRead = await fs.readFileSync("./codeList.csv").toLocaleString().split(",");
// const errCodeList = await fs.readFileSync("./errMsg.csv").toLocaleString().split(",");
// const errCodeList = ["003026", "002976", "002860"]; // test

// 3. 根据codelist遍历得到每个个股的历史价；

const errMsg = [];


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
        "fqt": "", // 前复权:"1", 后复权:"2", 不复权:""
        "secid": `${/^60\d{4}$/.test(stockCode) ? "1" : "0"}.${stockCode}`, // 00开头要0.code，60开头要1.code
        // "secid": `0.000011`, // test
        "beg": "20230101",
        "end": "20251231",
        "_": "1623766962675",
    }
    const res = await axios.get(url, { params });
    // console.log(stockCode, res.data);
    try {
        if (!res.data.data) {
            errMsg.push(stockCode);
            await fs.writeFileSync("./errMsg.csv", errMsg.join());
            return;
        }
        if(!res.data.data.klines.length){
            errMsg.push(stockCode);
            await fs.writeFileSync("./errMsg.csv", errMsg.join());
            return;
        }

        // 清洗数据：f52 "今开", f53 "最新价",f54 "最高",f55 "最低",f59 "涨跌幅"都扩大了一百倍; f57 "成交额"单位为万元。
        const historyDataList = res.data.data?.klines.map(record => record.split(",").map((val, index) => {
            if ([1, 2, 3, 4, 7].includes(index)) {
                return Math.round(val * 100);
            } else if (index === 5) {
                return Math.round(val * 1);
            } else if(index === 6){
                return Math.round(val / 10000);
            } else {
                return val;
            }
        }))

        // 4. 写入数据库。
        // const con = await mysql.createConnection({
        //     host: "localhost",
        //     user: "root",
        //     password: "Stan131058",
        //     database: "stock_data"
        // });
        // con.connect((err) => {
        //     // 创建表格，列为date、start_price、end_price、highest_price、lowest_price、quantity、amount、amplitude
        //     const create_table_command = `CREATE TABLE IF NOT EXISTS stock${res.data.data.code} (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT)`
        //     con.query(`${create_table_command}`, function (err, result, fields) {
        //         con.query(`INSERT INTO stock${res.data.data.code} VALUES ?`, [historyDataList], function (err, result, fields) {
        //             //断开链接
        //             con.end(err => {
        //                 if (!err) {
        //                     console.log('Disconnected from database');
        //                 }
        //             });
        //         })
        //     })
        // });
        // await con.connect();
        // // 创建表格，列为date、start_price、end_price、highest_price、lowest_price、quantity、amount、amplitude
        // const create_table_command = `CREATE TABLE IF NOT EXISTS stock${res.data.data.code} (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT)`
        // await con.query(`${create_table_command}`);
        // await con.query(`INSERT INTO stock${res.data.data.code} VALUES ?`, [historyDataList]);
        // //断开链接
        // con.end(err => {
        //     if (!err) {
        //         // console.log('Disconnected from database');
        //     }
        // });
        // const conn = await mysql.createConnection({
        //     host: "localhost",
        //     user: "root",
        //     password: "Stan131058",
        //     database: "stock_data"
        // });
        const create_table_command = `CREATE TABLE IF NOT EXISTS stock${res.data.data.code} (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT)`
        // const historyDataString = `(${historyDataList.map(list => list.join(",")).join("),(")})`;
        await conn.execute(`${create_table_command}`);
        // await conn.execute(`INSERT INTO stock${res.data.data.code} VALUES ${historyDataString}`);
        await conn.query(`INSERT INTO stock${res.data.data.code} VALUES ?`, [historyDataList]);
        // await conn.end();
    } catch (error) {
        console.warn("getHistoryDataList", error);
    }
}
const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Stan131058",
    database: "stock_data"
});
codeListRead.forEach(code => {
    getHistoryDataList(code)
})
// ["000008"].forEach(code => {
//     getHistoryDataList(code)
// })