/**
 * 1. 读取写入的csv;(考虑先写入再读取)；
 * 2. 读取数据库中的历史股价，生成MA；（在handleHistoryData.js之后）
 * 3. 写入数据库（考虑数据库中没有表的情况）
 */


import todayDataList from "./getTodayDataList.js";
import fs from ("fs");
import sqlConf from "./sqlConf.json" with { type: "json" };
console.log(sqlConf);
