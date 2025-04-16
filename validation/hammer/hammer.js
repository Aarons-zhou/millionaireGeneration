/**
 * 技术特征：
 * 1. 下跌趋势末期；
 * 2. 实体较小（设定不超过2%），下影线是实体两倍以上，上影线很短,（设定为不超过实体的1/4）。
 * 出击点：锤子线出现后的下一个交易日，若收盘价超过锤子线的实体（上沿），则构成买点。次日盘中急升突破锤子线实体，也可以在盘中买入。
 */
import fs from "fs";
import mysql from "mysql2/promise";
import sqlConf from "../../baseDataConstructor/sqlConf.json" with { type: "json" };

const conclusionList = [];
/**
 * 锤子线配置：upperShadowRatio, priceEntity, lowerShadowRatio, focusingday, priceAmplitudeCell, priceAmplitudeFloor => buyRatio, profitRatio, highestPriceAmplitude, closingPriceAmplitude
 * 配置1.1: 0, 0.01, 2, 4, undefined, undefined => 49.27%, 62.31%, 4.85%, 2.85%
 * 配置1.2: 0, 0.01, 3, 4, undefined, undefined => 51.35%, 63.14%, 5.81%, 3.43%
 * 配置1.3: 0, 0.01, 4, 4, undefined, undefined => 51.83%, 63.46%, 6.65%, 4.04%
 * 配置1.4: 0, 0.01, 5, 4, undefined, undefined => 50.68%, 62.74%, 7.47%, 4.55%
 * 
 * 配置2.1: 0, 0.01, 5, 4, 0.09, undefined => 47.65%, 63.35%, 3.21%, 1.60%
 * 配置2.2: 0, 0.01, 5, 4, 0.08, undefined => 47.76%, 63.38%, 3.22%, 1.61%
 * 配置2.3: 0, 0.01, 5, 4, 0.07, undefined => 47.74%, 63.41%, 3.22%, 1.61%
 * 配置2.4: 0, 0.01, 5, 4, 0.06, undefined => 47.72%, 63.38%, 3.22%, 1.61%
 * 
 * 配置3.1: 0, 0.01, 5, 4, undefined, -0.09 => 53.37%, 62.84%, 7.49%, 4.58%
 * 配置3.2: 0, 0.01, 5, 4, undefined, -0.03 => 54.10%, 62.83%, 3.21%, 1.60%
 * 配置3.3: 0, 0.01, 5, 4, undefined, -0.07 => 47.65%, 63.35%, 3.21%, 1.60%
 * 配置3.4: 0, 0.01, 5, 4, undefined, -0.06 => 47.65%, 63.35%, 3.21%, 1.60%
 * 
 * 
 * 总结：
 * 1. 下影线倍数越高，越能排除垃圾形态，盈利率越高。
 * 2. T字涨停很大程度拉高了平均盈利率，6%-9%的priceAmplitudeCell几乎无影响。
 * 
 * 推理：
 * 1.1 配置1.4数据8568条，允许买入4332条，禁止买入4236条；其中，下跌锤子线1804条，允许买入的下跌锤子线为636条，禁止买入的下跌锤子线为1168条。原允许买入率为50.56%，去除下跌锤子线的允许买入率为(4332-636)/(8568-1804)=54.64%；
 * 1.2 上述允许买入的4332条数据中，盈利2721条，亏损1611条。其中，下跌锤子线为636条，盈利下跌锤子线为377条，亏损下跌锤子线为259。原盈利率为62.81%，去除下跌锤子线的盈利率为(2721-377)/(4332-636)=63.42%；
 * 1.3 去除下跌锤子线后，highestPriceAmplitude为8.72%，closingPriceAmplitude为5.50%。
 */
/*** 买入日的涨幅与收益率的关系：涨停效果最好但风险大（优化：测方差），其次是5%-6%但数据量很少。
 * buyAmp      num    highestAmp    closingAmp
 * [0,100)     503	  2.198903456	1.021179976
 * [100,200)   415	  2.53790436	2.855137363
 * [200,300)   215	  2.669869452	2.346231884
 * [300,400)   110	  2.710790698	4.357281553
 * [400,500)   113	  3.93382199	3.391775701
 * [500,600)   98	  6.989060403	5.148571429
 * [600,700)   20	  1.123492063	2.960277778
 * [700,800)   20	  2.959428571	1.79
 * [800,900)   9	  0.425454545	3.71
 * [900,2000)  1201	  14.63131167	9.48121118
 * avg         2771   7.49          4.58
 */
const hammerConf = {
    upperShadowRatio: 0,
    priceEntity: 0.01,
    lowerShadowRatio: 5,
    focusingday: 4,
    priceAmplitudeCell: 0.07,
    priceAmplitudeFloor: -0.03,
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
    // 限制锤子线涨跌幅：没有formerDayClosingPrice说明是新股首日
    // const priceAmplitudeFlag = !formerDayClosingPrice ? false : recordObj.amplitude < hammerConf.priceAmplitudeCell;
    // const priceAmplitudeFlag = !formerDayClosingPrice ? false : recordObj.amplitude > hammerConf.priceAmplitudeFloor;
    const priceAmplitudeFlag = true;
    return upperShadowFlag && priceEntityFlag && lowerShadowFlag && oldStockFlag && priceAmplitudeFlag;
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
            buyAmplitude:0
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

        const conclusion = [tableName.replace(/stock/, ""), hammerObj.date, hammerObj.day, !!info.buyPrice, !!info.closingPrice, info.quitFlag, highestPriceAmplitude, info.highestPriceDay, closingPriceAmplitude, info.closingPriceDay, hammerObj.amplitude,info.buyAmplitude];
        conclusionList.push(conclusion);
    })
    if (tableIndex === tableList.length - 1) {
        conclusionList.unshift(["code", "date", "weekday", "buyFlag", "profitFlag", "quitFlag", "highestPriceAmplitude", "highestPriceDay", "closingPriceAmplitude", "closingPriceDay", "hammerAmplitude","hammerBuyAmplitude"]);
        fs.writeFile("./hammer.csv", conclusionList.map(list => list.join()).join("\n"), () => {
            console.log("已生成hammer.csv");
        });
    }
});

// 优化：增加低位判断


