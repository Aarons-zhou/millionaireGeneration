/**
 * 技术特征：
 * 1. 下跌趋势末期；
 * 2. 实体较小（设定不超过2%），下影线是实体两倍以上，上影线很短,（设定为不超过实体的1/4）。
 * 出击点：锤子线出现后的下一个交易日，若收盘价超过锤子线的实体（上沿），则构成买点。次日盘中急升突破锤子线实体，也可以在盘中买入。
 */
import fs from "fs";
import mysql from "mysql2/promise";
import sqlConf from "../../baseDataConstructor/sqlConf.json" with { type: "json" };

// 判断单根K线是否符合锤子线
const hammerConf = {
    upperShadowRatio: 0.25,
    priceAmplitude: 0.02,
};
const hammerJudge = (recordObj, index) => {
    const { opening_price, closing_price, highest_price, lowest_price } = recordObj;
    const priceEntity = closing_price > opening_price ? closing_price - opening_price : opening_price - closing_price;
    const upperShadow = closing_price > opening_price ? highest_price - closing_price : highest_price - opening_price;
    const lowerShadow = closing_price > opening_price ? opening_price - lowest_price : closing_price - lowest_price;
    recordObj.index = index;
    return (priceEntity / opening_price) < hammerConf.priceAmplitude && upperShadow < hammerConf.upperShadowRatio * priceEntity && lowerShadow > 2 * priceEntity;
}
const formatTime = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// 1. 获取股价信息
const conn = await mysql.createConnection(sqlConf);
const [tableListRaw] = await conn.execute("SHOW TABLES FROM stock_data");
const tableList1 = tableListRaw.map(obj => obj["Tables_in_stock_data"]); // delete 1
const tableList = tableList1.filter((_, index) => index === 200); //test

const conclusionList = [];
tableList.forEach(async tableName => {
    const [recordList] = await conn.query(`SELECT * FROM ${tableName}`);
    const hammerList = recordList.filter((recordObj, index) => hammerJudge(recordObj, index)).map(recordObj => ({ ...recordObj, date: formatTime(recordObj["trade_day"]) }));
    // console.log(hammerList, tableName);

    // 2. 检验是否盈利
    hammerList.forEach(hammerObj => { // test
        const info = {
            buyPrice: 0,
            highestPrice: 0,
            closingPrice: 0,
            quitFlag: false,
        };
        // for (let i = 1; i < recordList.length - hammerObj.index; i++) { // 关注全部有点离谱，这是短期策略
        for (let i = 1; i < 10; i++) {
            const lowestPrice = recordList[hammerObj.index + i].lowest_price;
            const highestPrice = recordList[hammerObj.index + i].highest_price;
            const closingPrice = recordList[hammerObj.index + i].closing_price;
            // 2.1 盘中价（lowest_price)低于锤子线的lowest_price（止损点），结束关注；
            if (lowestPrice < hammerObj.lowest_price) {
                info.quitFlag = true;
                break;
            }
            // 2.2 没买入时，收盘价高于锤子线的highest_price，构成买点；
            if (!info.buyPrice && closingPrice > hammerObj.highest_price) {
                info.buyPrice = closingPrice;
                continue;
            }
            // 2.3 如果已经买入，则记录盘中最高价和收盘最高价（需高于买入价）
            if (!info.buyPrice) {
                continue;
            }
            if (highestPrice > info.buyPrice && highestPrice > info.highestPrice) {
                info.highestPrice = highestPrice;
            }
            if (closingPrice > info.buyPrice && closingPrice > info.closingPrice) {
                info.closingPrice = closingPrice;
            }
        }
        /**
         * 如果无buyPrice，说明不构成买点
         * 如果有buyPrice，无highestPrice，closingPrice,说明买入后亏损
         * 如果有buyPrice，有highestPrice，closingPrice,说明买入后有盈利
         * 如果quitFlag为true，则说明买入锤子线出现的九日内，曾跌到过止损点
         */

        // 盘中盈利幅度、收盘盈利幅度: 非买入，则两个幅度为0；买入盈利，盘中价/收盘价与买入价；买入非盈利，则买入点与止损点
        let highestPriceAmplitude = 0;
        let closingPriceAmplitude = 0;
        if (info.buyPrice) {
            highestPriceAmplitude = info.highestPrice ? ((info.highestPrice - info.buyPrice) / info.buyPrice * 100).toFixed(2) * 1 : ((hammerObj.lowest_price - hammerObj.highest_price) / hammerObj.lowest_price * 100).toFixed(2) * 1;
            closingPriceAmplitude = info.closingPrice ? ((info.closingPrice - info.buyPrice) / info.buyPrice * 100).toFixed(2) * 1 : ((hammerObj.lowest_price - hammerObj.highest_price) / hammerObj.lowest_price * 100).toFixed(2) * 1;
        }
        //  股票代码、日期、买入与否、盈利与否、盘中盈利幅度、收盘盈利幅度、是否九日内跌到止损点
        const conclusion = [tableName.replace(/stock/, ""), hammerObj.date, !!info.buyPrice, !!info.closingPrice, highestPriceAmplitude, closingPriceAmplitude, info.quitFlag];
        conclusionList.push(conclusion);
    })
    console.log(conclusionList);
});
// await fs.writeFileSync("./hammer.csv", conclusionList.map(list => list.join()).join("\n"));

// 优化：增加低位判断


