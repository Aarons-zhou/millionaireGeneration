/**
 * 1. 读取写入的csv;(考虑先写入再读取)；
 * 2. 读取数据库中的历史股价，生成MA；（在handleHistoryData.js之后）
 * 3. 写入数据库（考虑数据库中没有表的情况）
 */

import fs from "fs";
import mysql from "mysql2/promise";
import sqlConf from "./sqlConf.json" with { type: "json" };

// 1. 读取todayDataList.csv
const todayDataObj = {};
const todayDataList = await fs.readFileSync("./todayDataList.csv").toLocaleString().split("\r\n").map(str => str.split(","));
todayDataList.forEach(list => {
    todayDataObj[list[0]] = list.filter((_, index) => index).map((ele, index) => index ? ele * 1 : ele);
});

// 3. 写入数据库
const conn = await mysql.createConnection(sqlConf);
for (let code in todayDataObj) {
    const create_table_command = `CREATE TABLE IF NOT EXISTS stock${code} (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT)`
    await conn.execute(`${create_table_command}`);
    await conn.query(`INSERT INTO stock${code} VALUES ?`, [[todayDataObj[code]]]);
    console.log("插入数据完毕", code);
}
