/**
 * 1. 从数据库中读取历史股价信息，生成MA列，写入MA数据。
 */

import mysql from "mysql2/promise";
import sqlConf from "./sqlConf.json" with { type: "json" };

const conn = await mysql.createConnection(sqlConf);
const [tableList] = await conn.execute("SHOW TABLES FROM stock_data");

/** tableList
 * [
    { Tables_in_stock_data: 'stock000001' },
    { Tables_in_stock_data: 'stock000002' },
    { Tables_in_stock_data: 'stock000004' },
    { Tables_in_stock_data: 'stock000006' },
    { Tables_in_stock_data: 'stock000007' },
    { Tables_in_stock_data: 'stock000008' },
    { Tables_in_stock_data: 'stock000009' }]
 */

console.log(tableList);
