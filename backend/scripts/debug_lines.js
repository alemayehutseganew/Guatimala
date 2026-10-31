const fs = require('fs')
const l = fs.readFileSync('C:/Users/alexo/Desktop/File/Code/GO-BINGO/backend/src/bot/index.js', 'utf8').split('\n')
for (let i = 225; i < 240 && i < l.length; i++) console.log((i + 1) + ':' + JSON.stringify(l[i]))
