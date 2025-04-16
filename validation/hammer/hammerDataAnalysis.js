import fs from "fs";

const fixedNum = num => (num * 100).toFixed(2) * 1;
const ampSplit = 20;
const dataList = await fs.readFileSync("./hammer.csv").toLocaleString().split("\n").map(str => str.split(","));



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
    // 计算num, avgBuyFlag, avgProfitFlag, avghighestAmp, avgclosingAmp, variace, deviation
    const num = list.length;
    const listFilteredByBuyFlag = list.filter(arr => arr[3] === "true");
    if (!listFilteredByBuyFlag.length) { // 没有买点的组不作分析
        return;
    }
    const avgBuyFlagNum = fixedNum(listFilteredByBuyFlag.length / list.length);
    const avgProfitFlagNum = fixedNum(list.filter(arr => arr[4] === "true").length / listFilteredByBuyFlag.length); // 分母应是有买点的数量
    const avgHighestAmp = fixedNum(listFilteredByBuyFlag.map(arr => arr[6]).reduce((former, latter) => former + latter) / listFilteredByBuyFlag.length);
    const avgClosingAmp = fixedNum(listFilteredByBuyFlag.map(arr => arr[8]).reduce((former, latter) => former + latter) / listFilteredByBuyFlag.length);
    // 计算方差的数据列表
    const varHighestAmpList = listFilteredByBuyFlag.map(arr => fixedNum(arr[6] / 100));
    const varClosingAmpList = listFilteredByBuyFlag.map(arr => fixedNum(arr[8] / 100));

    const varHighestAmp = fixedNum(varHighestAmpList.reduce((former, latter) => (former - (avgHighestAmp / 100)) ** 2 + (latter - (avgHighestAmp / 100)) ** 2) / listFilteredByBuyFlag.length);
    const varClosingAmp = fixedNum(varClosingAmpList.reduce((former, latter) => (former - (avgClosingAmp / 100)) ** 2 + (latter - (avgClosingAmp / 100)) ** 2) / listFilteredByBuyFlag.length);
    hammerAmpResultList.push([index * ampSplit, num, avgBuyFlagNum, avgProfitFlagNum, avgHighestAmp, avgClosingAmp, varHighestAmp, varClosingAmp]);

})
hammerAmpResultList.unshift(["amp", "num", "avgBuyFlagNum", "avgProfitFlagNum", "avgHighestAmp", "avgClosingAmp", "varHighestAmp", "varClosingAmp"]);

fs.writeFile("./hammerAmpListAnalysis.csv", hammerAmpResultList.map(list => list.join()).join("\n"), () => {
    console.log("已生成hammerAmpListAnalysis.csv");
})

// buyAmpList.forEach((list, index) => {
//     if (!list.length) {
//         return;
//     }
//     // 计算num, avgBuyFlag, avgProfitFlag, avghighestAmp, avgclosingAmp, variace, deviation
//     const num = list.length;
//     const avgProfitFlagNum = fixedNum(list.filter(arr => arr[4] === "true").length / list.length);
//     // const avgHighestAmp = fixedNum(list.reduce((former, latter) => former[6] * 1 + latter[6] * 1));
//     const avgHighestAmp = list.reduce((former, latter) => former[6] * 1 + latter[6] * 1);
//     const avgClosingAmp = fixedNum(list.reduce((former, latter) => former[8] * 1 + latter[8] * 1));
//     const devarHighestAmp = fixedNum((list.reduce((former, latter) => (former[6] * 1 - avgHighestAmp) ** 2 + (latter[6] * 1 - avgHighestAmp) ** 2)) ** (1 / 2));
//     const devarClosingAmp = fixedNum((list.reduce((former, latter) => (former[8] * 1 - avgClosingAmp) ** 2 + (latter[8] * 1 - avgClosingAmp) ** 2)) ** (1 / 2));
//     // const riskHighestAmp = fixedNum(devarHighestAmp/avgHighestAmp);
//     // const riskClosingAmp = fixedNum(devarClosingAmp/avgClosingAmp);
//     buyAmpResultList.push([index * 10, num, avgProfitFlagNum, avgHighestAmp, avgClosingAmp, devarHighestAmp, devarClosingAmp]);
// })
// buyAmpResultList.unshift(["amp", "num", "avgProfitFlagNum", "avgHighestAmp", "avgClosingAmp", "devarHighestAmp", "devarClosingAmp"]);


// /**
//  * list:
//  * [
//     '000039', '2024-11-27',
//     '3',      'true',
//     'false',  'false',
//     '0.24',   '1',
//     '-0.12',  '0',
//     '12',     '148'
//   ]
//  */





// fs.writeFile("./hammerDataAnalysis.csv", buyAmpResultList.map(list => list.join()).join("\n"), () => {
//     console.log("已生成hammerDataAnalysis.csv");
// })


// // console.log(buyAmpObj["amp0"]);

/**
 * result1.1：hammerAmp4.8%-5.4%的218组数据平均买入率为68.35%，0.8%-2.4%的432组数据平均买入率为59.72%，涨停的3815组数据平均买入率为54.84%。
 * result2.1：hammerAmp的平均胜率
 * result2.2：buyAmp4.8%-5.4%的170组数据平均胜率为75.29%，涨停的1678组数据平均胜率为70.38%，其余数据的胜率大多在50%-65%。
 * result3.1：hammerAmp的平均盘中收益率
 * result4.1：hammerAmp的平均收盘收益率
 * result5.1：hammerAmp的平均盘中收益方差
 * result6.1：hammerAmp的平均收盘收益方差
 * result7.1：hammerAmp的平均盘中单位风险收益
 * result8.1：hammerAmp的平均收盘单位风险收益
 */