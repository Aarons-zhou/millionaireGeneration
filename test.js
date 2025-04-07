import mysql from "mysql2";

const con = mysql.createConnection({
    host: "localhost", // 运行mysql的服务器的IP地址
    user: "root", // mysql数据库的用户名
    password: "Stan131058", // 对应的密码
    database: "stock_test" // 使用指定的数据库
});
con.connect((err) => {
    const code = "603929";
    // 第一步：创建表格，列为date、start_price、end_price、highest_price、lowest_price、quantity、amount、amplitude
    const create_table_command = `CREATE TABLE IF NOT EXISTS ${code} (trade_day DATE, start_price INT, end_price INT, highest_price INT, lowest_price INT,quantity INT, amount INT, amplitude INT)`

    con.query(`${create_table_command}`, function (err, result, fields) {
        console.log("mysql create table", err, result,fields);
        // con.query(`INSERT INTO ${res.data.data.code} VALUES ?`, [historyDataList], function (err, result, fields) {
        //     console.log("mysql insert into", result);
        // })
    })
});