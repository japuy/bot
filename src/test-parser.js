import { processWhatsAppMessage } from '../src/parser.js';
import { db } from '../src/db.js';

console.log('Testing Indonesian NLP Parser...');

const testCases = [
  'beli baso 15rb',
  'beli maso 15000',
  'bayar listrik 150.000',
  'bensin 35rb',
  'gaji 5jt',
  'dapat transfer 250rb dari rudi',
  'saldo',
  'laporan'
];

for (const msg of testCases) {
  const res = processWhatsAppMessage(msg);
  console.log(`\nInput: "${msg}"`);
  console.log(`Status: ${res.status}`);
  if (res.transaction) {
    console.log(`Type: ${res.transaction.type}, Amount: ${res.transaction.amount}, Cat: ${res.transaction.category}, Desc: ${res.transaction.description}`);
  } else {
    console.log(`Reply snippet: ${res.reply.split('\n')[0]}`);
  }
}

console.log('\nTesting Undo...');
const undoRes = processWhatsAppMessage('batal');
console.log('Undo reply:', undoRes.reply.split('\n')[0]);
console.log('All tests finished successfully!');
