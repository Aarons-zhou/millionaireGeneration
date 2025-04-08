/**
 * 1. 读取写入的csv;
 * 2. 读取数据库中的历史股价，生成MA；（在handleHistoryData.js之后）
 * 3. 写入数据库
 */


import todayDataList from "./getTodayDataList.js"
import sqlConf from "./sqlConf.json" with { type: "json" };
console.log(sqlConf);
