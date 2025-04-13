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
const todayDataList = await fs.readFileSync("./todayDataList.csv").toLocaleString().split("\n").map(str => str.split(","));
console.log(todayDataList);

todayDataList.forEach(list => {
    todayDataObj[list[0]] = list.filter((_, index) => index).map((ele, index) => index ? ele * 1 : ele);
});

// 2. 读取数据库中的历史股价
const conn = await mysql.createConnection(sqlConf);
const [tableListRaw] = await conn.execute("SHOW TABLES FROM stock_data");
const tableList = tableListRaw.map(obj => obj["Tables_in_stock_data"]); 
// 添加MA数据
tableList.forEach(async tableName => {
    const [recordList] = await conn.query(`SELECT * FROM ${tableName} ORDER BY trade_day DESC LIMIT 119`);
    const historyPriceList = recordList.map(obj => obj["end_price"]);
    const todayData = todayDataObj[tableName.replace(/stock/, "")];
    historyPriceList.unshift(todayData[2]);
    const MAlist = [5, 10, 20, 30, 60, 120].map(num => Math.round(historyPriceList.filter((_, index) => index < num).reduce((former, letter) => former + letter) / num))
    todayData.push(...MAlist);
});

// 3. 写入数据库
for (let code in todayDataObj) {
    const create_table_command = `CREATE TABLE IF NOT EXISTS stock${code}
        (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT,
        MA5 INT, MA10 INT, MA20 INT, MA30 INT, MA60 INT, MA120 INT)`
    await conn.execute(`${create_table_command}`);
    await conn.query(`INSERT INTO stock${code} VALUES ?`, [[todayDataObj[code]]]);
    console.log("插入数据完毕", code);
}