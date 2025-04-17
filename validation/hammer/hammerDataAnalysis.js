import fs from "fs";

const dataList = await fs.readFileSync("./hammer.csv").toLocaleString().split("\n").map(str => str.split(","));
const ampSplit = 20;
const fixedNum = num => (num * 100).toFixed(2) * 1;
const calculateVariance = (data) => {
    const middleValue = data[Math.floor(data.length / 2)];
    let sum = 0;
    let sumOfSquares = 0;
    for (let i = 0; i < data.length; i++) {
        const diff = data[i] - middleValue;
        sum += diff;
        sumOfSquares += diff * diff;
    }
    const variance = (sumOfSquares - (sum * sum) / data.length) / data.length;
    return variance;
}


/**
 * 1. dataList按hammerAmp, buyAmp，以20为一组放进hammerAmpObj, buyAmpObj。
 * 2. 转到hammerAmpList, buyAmpList（三维数组）。
 */

// 初始化统计数据
const hammerAmpObj = {};
const buyAmpObj = {};
const hammerAmpList = [];
const buyAmpList = [];
const hammerAmpResultList = [];
const buyAmpResultList = [];
for (let i = 0; i < (1000 / ampSplit); i++) {
    const amp = i * ampSplit;
    hammerAmpObj[`amp${amp}`] = [];
    buyAmpObj[`amp${amp}`] = [];
}

// 1. dataList按hammerAmp, buyAmp，以20为一组放进hammerAmpObj, buyAmpObj
dataList.forEach((list, index) => {
    if (!index) { // 排除表头
        return;
    }
    const hammerAmp = list[10] >= 1000 ? 980 : parseInt(list[10] / ampSplit) * ampSplit
    const buyAmp = list[11] >= 1000 ? 980 : parseInt(list[11] / ampSplit) * ampSplit;
    if (hammerAmp >= 0) {
        hammerAmpObj[`amp${hammerAmp}`].push(list.map((ele, index) => [6, 7, 8, 9, 10, 11].includes(index) ? ele * 1 : ele));
    }
    if (buyAmp > 0) {
        buyAmpObj[`amp${buyAmp}`].push(list.map((ele, index) => [6, 7, 8, 9, 10, 11].includes(index) ? ele * 1 : ele));
    }
})

// 2. 转到hammerAmpList, buyAmpList
for (let i = 0; i < (1000 / ampSplit); i++) {
    const amp = i * ampSplit;
    hammerAmpList.push(hammerAmpObj[`amp${amp}`]);
    buyAmpList.push(buyAmpObj[`amp${amp}`]);
}

// 3. 分析数据
hammerAmpList.forEach((list, index) => {
    if (!list.length) {
        return;
    }
    const listFilteredByBuyFlag = list.filter(arr => arr[3] === "true");
    const num = list.length;
    const buyNum = listFilteredByBuyFlag.length;
    if (!listFilteredByBuyFlag.length) { // 没有买点的组不作分析
        return;
    }
    const avgBuyFlagNum = fixedNum(listFilteredByBuyFlag.length / list.length);
    const avgProfitFlagNum = fixedNum(list.filter(arr => arr[4] === "true").length / listFilteredByBuyFlag.length); // 分母应是有买点的数量
    const avgHighestAmp = fixedNum(listFilteredByBuyFlag.map(arr => arr[6]).reduce((former, latter) => former + latter) / listFilteredByBuyFlag.length);
    const avgClosingAmp = fixedNum(listFilteredByBuyFlag.map(arr => arr[8]).reduce((former, latter) => former + latter) / listFilteredByBuyFlag.length);
    const varHighestAmp = fixedNum(calculateVariance(listFilteredByBuyFlag.map(arr => arr[6])));
    const varClosingAmp = fixedNum(calculateVariance(listFilteredByBuyFlag.map(arr => arr[8])));
    const riskHighestAmp = fixedNum(avgHighestAmp / (varHighestAmp ** (1 / 2)));
    const riskClosingAmp = fixedNum(avgClosingAmp / (varClosingAmp ** (1 / 2)));
    hammerAmpResultList.push([index * ampSplit, num, buyNum, avgBuyFlagNum, avgProfitFlagNum, avgHighestAmp, avgClosingAmp, varHighestAmp, varClosingAmp, riskHighestAmp, riskClosingAmp]);
})
buyAmpList.forEach((list, index) => {
    if (!list.length) {
        return;
    }
    const listFilteredByBuyFlag = list.filter(arr => arr[3] === "true");
    const num = list.length;
    const buyNum = listFilteredByBuyFlag.length;
    if (!listFilteredByBuyFlag.length) { // 没有买点的组不作分析
        return;
    }
    const avgBuyFlagNum = fixedNum(listFilteredByBuyFlag.length / list.length);
    const avgProfitFlagNum = fixedNum(list.filter(arr => arr[4] === "true").length / listFilteredByBuyFlag.length); // 分母应是有买点的数量
    const avgHighestAmp = fixedNum(listFilteredByBuyFlag.map(arr => arr[6]).reduce((former, latter) => former + latter) / listFilteredByBuyFlag.length);
    const avgClosingAmp = fixedNum(listFilteredByBuyFlag.map(arr => arr[8]).reduce((former, latter) => former + latter) / listFilteredByBuyFlag.length);
    const varHighestAmp = fixedNum(calculateVariance(listFilteredByBuyFlag.map(arr => arr[6])));
    const varClosingAmp = fixedNum(calculateVariance(listFilteredByBuyFlag.map(arr => arr[8])));
    const riskHighestAmp = fixedNum(avgHighestAmp / (varHighestAmp ** (1 / 2)));
    const riskClosingAmp = fixedNum(avgClosingAmp / (varClosingAmp ** (1 / 2)));
    buyAmpResultList.push([index * ampSplit, num, buyNum, avgBuyFlagNum, avgProfitFlagNum, avgHighestAmp, avgClosingAmp, varHighestAmp, varClosingAmp, riskHighestAmp, riskClosingAmp]);
})

hammerAmpResultList.unshift(["amp", "num", "buyNum", "avgBuyFlagRatio", "avgProfitFlagRatio", "avgHighestAmp", "avgClosingAmp", "varHighestAmp", "varClosingAmp", "riskHighestAmp", "riskClosingAmp"]);
buyAmpResultList.unshift(["amp", "num", "buyNum", "avgBuyFlagRatio", "avgProfitFlagRatio", "avgHighestAmp", "avgClosingAmp", "varHighestAmp", "varClosingAmp", "riskHighestAmp", "riskClosingAmp"]);

fs.writeFile("./hammerAmpListAnalysis.csv", hammerAmpResultList.map(list => list.join()).join("\n"), () => {
    console.log("已生成hammerAmpListAnalysis.csv");
})
fs.writeFile("./buyAmpListAnalysis.csv", buyAmpResultList.map(list => list.join()).join("\n"), () => {
    console.log("已生成buyAmpListAnalysis.csv");
})

/**
 * result:
 * result1.1: hammerAmp4.4%-5.6%的233组数据平均买入率为68.67%，0.8%-2.4%的432组数据平均买入率为59.79%，涨停的3815组数据平均买入率为54.84%。
 * result1.2: hammerAmp4.4%-5.6%的160组数据平均胜率为80.00%，9.8%以上的2092组数据平均胜率为62.24%。
 * result1.3: hammerAmp4.4%-5.6%的160组数据平均盘中收益率为8.66%，9.8%以上的2092组数据平均盘中收益率为12.01%。
 * result1.4: hammerAmp4.4%-5.6%的160组数据平均收盘收益率为6.58%，9.8%以上的2092组数据平均收盘收益率为7.73%。
 * result1.5: hammerAmp4.4%-5.6%的160组数据平均盘中收益方差为4671.07，9.8%以上的2092组数据平均盘中收益方差为22084.03。
 * result1.6: hammerAmp4.4%-5.6%的160组数据平均收盘收益方差为5022.18，9.8%以上的2092组数据平均收盘收益方差为23889.48。
 * result1.7: hammerAmp4.4%-5.6%的160组数据平均盘中单位风险收益为1340.06，9.8%以上的2092组数据平均盘中单位风险收益为970.85。(1单位风险的收益)
 * result1.8: hammerAmp4.4%-5.6%的160组数据平均收盘单位风险收益为808.37，9.8%以上的2092组数据平均收盘单位风险收益为499.80。(1单位风险的收益)
 * 
 * result2.1: buyAmp4.8%-5.4%的170组数据平均胜率为75.29%，9.8%以上的1703组数据平均胜率为69.94%。
 * result2.2: buyAmp4.8%-5.4%的170组数据平均盘中收益率为7.28%，9.8%以上的1703组数据平均盘中收益率为14.72%。
 * result2.4: buyAmp4.8%-5.4%的170组数据平均收盘收益率为5.03%，9.8%以上的1703组数据平均收盘收益率为9.93%。
 * result2.3: buyAmp4.8%-5.4%的170组数据平均盘中收益方差为6140.92，9.8%以上的1703组数据平均盘中收益方差为21739.34。
 * result2.4: buyAmp4.8%-5.4%的170组数据平均收盘收益方差为6343.82，9.8%以上的1703组数据平均收盘收益方差为25546.33。
 * result2.5: buyAmp4.8%-5.4%的170组数据平均盘中单位风险收益为1007.50，9.8%以上的1703组数据平均盘中单位风险收益为998.16。(1单位风险的收益)
 * result2.6: buyAmp4.8%-5.4%的170组数据平均收盘单位风险收益为698.08，9.8%以上的1703组数据平均收盘单位风险收益为621.35。(1单位风险的收益)
 */

