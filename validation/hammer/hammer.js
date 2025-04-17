/**
 * 技术特征：
 * 1. 下跌趋势末期；
 * 2. 实体较小，下影线是实体两倍以上，上影线很短。
 * 出击点：锤子线出现后的下一个交易日，若收盘价超过锤子线的实体（上沿），则构成买点。次日盘中急升突破锤子线实体，也可以在盘中买入。
 * 
 * 经hammerDataAnalysis.js分析，新增限制条件（同时满足）：
 * 1. 锤子线涨幅4.4%-5.6%；（历史胜率80.00%，盘中收益率8.66%，收盘收益率6.58%）
 * 2. 买入日涨幅4.8%-5.4%。（历史胜率75.29%，盘中收益率7.28%，收盘收益率5.03%）
 * 同时满足上述条件的历史数据120条，平均胜率87.5%，盘中收益率10.06%，收盘收益率7.87%
 */
import fs from "fs";
import mysql from "mysql2/promise";
import sqlConf from "../../baseDataConstructor/sqlConf.json" with { type: "json" };

const conclusionList = [];
const hammerConf = {
    upperShadowRatio: 0,
    priceEntity: 0.01,
    lowerShadowRatio: 5,
    focusingday: 4,
};
const hammerJudge = (recordObj, index) => {
    const { opening_price, closing_price, highest_price, lowest_price } = recordObj;
    const priceEntity = closing_price > opening_price ? closing_price - opening_price : opening_price - closing_price;
    const upperShadow = closing_price > opening_price ? highest_price - closing_price : highest_price - opening_price;
    const lowerShadow = closing_price > opening_price ? opening_price - lowest_price : closing_price - lowest_price;
    recordObj.index = index;
    // 上影线要求
    const upperShadowFlag = upperShadow <= hammerConf.upperShadowRatio * priceEntity;
    // 实体要求
    const priceEntityFlag = (priceEntity / opening_price) <= hammerConf.priceEntity;
    // 下影线要求
    const lowerShadowFlag = lowerShadow >= hammerConf.lowerShadowRatio * priceEntity;
    // 排除新股连板
    const oldStockFlag = index > 30;
    return upperShadowFlag && priceEntityFlag && lowerShadowFlag && oldStockFlag;
}
const formatTime = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const fixedNum = num => (num * 100).toFixed(2) * 1;

// 1. 获取股价信息
const conn = await mysql.createConnection(sqlConf);
const [tableListRaw] = await conn.execute("SHOW TABLES FROM stock_data");
const tableList = tableListRaw.map(obj => obj["Tables_in_stock_data"]);
tableList.forEach(async (tableName, tableIndex) => {
    const [recordList] = await conn.query(`SELECT * FROM ${tableName}`);
    const hammerList = recordList.filter((recordObj, index) => hammerJudge(recordObj, index))
        .map(recordObj => ({ ...recordObj, date: formatTime(recordObj["trade_day"]), day: recordObj["trade_day"].getDay() }))
        .filter(recordObj => new Date() - recordObj["trade_day"] > 3 * hammerConf.focusingday * 24 * 60 * 60 * 1000); // 不要太新的数据，以免观察不彻底
    // 2. 检验是否盈利
    hammerList.forEach(hammerObj => {
        const info = {
            buyPrice: 0,
            highestPrice: 0,
            closingPrice: 0,
            quitFlag: false,
            buyDay: 0,
            highestPriceDay: 0,
            closingPriceDay: 0,
            buyAmplitude: 0
        };
        for (let i = 1; i < hammerConf.focusingday + 1; i++) {
            const lowestPrice = recordList[hammerObj.index + i]?.lowest_price;
            const highestPrice = recordList[hammerObj.index + i]?.highest_price;
            const closingPrice = recordList[hammerObj.index + i]?.closing_price;
            const amplitude = recordList[hammerObj.index + i]?.amplitude;
            // 2.1 盘中价（lowest_price)低于锤子线的lowest_price（止损点），结束关注；
            if (lowestPrice < hammerObj.lowest_price) {
                info.quitFlag = true;
                break;
            }
            // 2.2 没买入时，收盘价高于锤子线的highest_price，构成买点；
            if (!info.buyPrice && closingPrice > hammerObj.highest_price) {
                info.buyPrice = closingPrice;
                info.buyDay = i;
                info.buyAmplitude = amplitude;
                continue;
            }
            // 2.3 如果已经买入，则记录盘中最高价和收盘最高价（需高于买入价）；
            if (!info.buyPrice) {
                continue;
            }
            if (highestPrice > info.buyPrice && highestPrice > info.highestPrice) {
                info.highestPrice = highestPrice;
                info.highestPriceDay = i - info.buyDay;
            }
            if (closingPrice > info.buyPrice && closingPrice > info.closingPrice) {
                info.closingPrice = closingPrice;
                info.closingPriceDay = i - info.buyDay;
            }
        }
        /**
         * 处理盈利率：
         * 1. 没有买入，则盈利幅度为0；
         * 2.1 有买入，盘中价/收盘价有超过买入价，则info.highestPrice/info.closingPrice不为0，此时盈利幅度为盘中价/收盘价与买入价对比；
         * 2.2 有买入，但次日开始下跌，盘中价/收盘价没有超过买入价，则info.highestPrice/info.closingPrice为0，
         *     此时可能是下跌至止损点（quitFlag为true），或到关注结束日仍下跌至止损点（quitFlag为false），前者为止损价与买入价对比，后者为最后关注日收盘价与买入价对比。
         */
        const quitAmplitude = fixedNum((hammerObj.lowest_price - info.buyPrice) / info.buyPrice);
        const nonquitAmplitude = fixedNum((recordList[hammerObj.index + hammerConf.focusingday].closing_price - info.buyPrice) / info.buyPrice);
        const highestPriceAmplitude = !info.buyPrice ? 0 :
            info.highestPrice ? fixedNum((info.highestPrice - info.buyPrice) / info.buyPrice) :
                info.quitFlag ? quitAmplitude : nonquitAmplitude;
        const closingPriceAmplitude = !info.buyPrice ? 0 :
            info.closingPrice ? fixedNum((info.closingPrice - info.buyPrice) / info.buyPrice) :
                info.quitFlag ? quitAmplitude : nonquitAmplitude;

        const conclusion = [tableName.replace(/stock/, ""), hammerObj.date, hammerObj.day, !!info.buyPrice, !!info.closingPrice, info.quitFlag, highestPriceAmplitude, info.highestPriceDay, closingPriceAmplitude, info.closingPriceDay, hammerObj.amplitude, info.buyAmplitude];
        conclusionList.push(conclusion);
    })
    if (tableIndex === tableList.length - 1) {
        // 生成附加锤子线涨幅限制、买入日涨幅限制的历史数据
        const conclusionAmpConstraintList = conclusionList.filter(record => (record[10] >= 440 && record[10] < 560) && (record[11] >= 480 && record[11] < 540));
        conclusionList.unshift(["code", "date", "weekday", "buyFlag", "profitFlag", "quitFlag", "highestPriceAmplitude", "highestPriceDay", "closingPriceAmplitude", "closingPriceDay", "hammerAmplitude", "hammerBuyAmplitude"]);
        conclusionAmpConstraintList.unshift(["code", "date", "weekday", "buyFlag", "profitFlag", "quitFlag", "highestPriceAmplitude", "highestPriceDay", "closingPriceAmplitude", "closingPriceDay", "hammerAmplitude", "hammerBuyAmplitude"]);
        fs.writeFile("./hammer.csv", conclusionList.map(list => list.join()).join("\n"), () => {
            console.log("已生成hammer.csv");
        });
        fs.writeFile("./hammerAmpConstraint.csv", conclusionAmpConstraintList.map(list => list.join()).join("\n"), () => {
            console.log("已生成hammerAmpConstraint.csv");
        });
    }
});

// 优化：增加低位判断(在学完120个例子再说)

