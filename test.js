import fs from "fs";

const testList = [
    ["A1","A2","A3"],
    ["B1","B2","B3"],
    ["C1","C2","C3"],
]

const str = testList.map(list => list.join()).join("\n"); // 就是这样写

fs.writeFileSync("./test.csv",str)
