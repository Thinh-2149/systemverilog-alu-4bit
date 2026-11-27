const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const args = process.argv.slice(2);
const referenceOnly = args.includes('--reference');
const publicBuild = args.includes('--public');
const output = args.find(arg => !arg.startsWith('--')) ?? path.join(root, 'ALU_Signal_Lab_Preview.html');

const examples = [
    { title: 'Signed overflow', display: '7 + 1', op: 0, a: 7, b: 1, flag: 'v' },
    { title: 'Carry and zero', display: '15 + 1', op: 0, a: 15, b: 1, flag: 'c' },
    { title: 'Unsigned borrow', display: '3 − 5', op: 1, a: 3, b: 5, flag: 'bw' },
    { title: 'Compare bit lanes', display: '1010 XOR 0110', op: 4, a: 10, b: 6, flag: 'z' },
    { title: 'Shifted-out bit', display: '1001 SHL', op: 6, a: 9, b: 0, flag: 'c' }
];

function signed(nibble) {
    return nibble < 8 ? nibble : nibble - 16;
}

function expected(op, a, b) {
    const full = [a + b, a - b, a & b, a | b, a ^ b, 15 - a, a * 2, Math.floor(a / 2)][op];
    const y = (full + 16) % 16;
    const sum = op === 0 ? signed(a) + signed(b) : signed(a) - signed(b);
    const z = Number(y === 0);
    const c = Number(((op === 0 || op === 6) && full > 15) || (op === 7 && a % 2 !== 0));
    const bw = Number(op === 1 && a < b);
    const v = Number(op < 2 && (sum < -8 || sum > 7));
    return [y, z, c, bw, v];
}

function expectedChain(op, a, b) {
    const initialCarry = Number(op === 1);
    const effectiveB = op === 1 ? 15 - b : b;
    let chain = initialCarry;
    for (let bit = 1; bit <= 4; bit++) {
        const modulus = 2 ** bit;
        if ((a % modulus) + (effectiveB % modulus) + initialCarry >= modulus) chain |= 1 << bit;
    }
    return chain;
}

function referenceRows() {
    return Array.from({ length: 2048 }, (_, index) => {
        const op = index >> 8;
        const a = (index >> 4) & 15;
        const b = index & 15;
        const effectiveB = b ^ (op === 1 ? 15 : 0);
        let carry = Number(op === 1);
        let chain = carry;
        let add = 0;
        for (let bit = 0; bit < 4; bit++) {
            const abit = (a >> bit) & 1;
            const bbit = (effectiveB >> bit) & 1;
            const propagate = abit ^ bbit;
            add |= (propagate ^ carry) << bit;
            carry = (abit & bbit) | (carry & propagate);
            chain |= carry << (bit + 1);
        }
        const y = [add, add, a & b, a | b, a ^ b, (~a) & 15, (a << 1) & 15, a >> 1][op];
        const z = Number(y === 0);
        const c = op === 0 ? carry : op === 6 ? a >> 3 : op === 7 ? a & 1 : 0;
        const borrow = op === 1 ? carry ^ 1 : 0;
        const overflow = op < 2 ? ((chain >> 3) & 1) ^ carry : 0;
        return [op, a, b, y, z, c, borrow, overflow, chain];
    });
}

function readRtlRows() {
    const lines = source('checks/vectors.csv').trim().split(/\r?\n/);
    assert.equal(lines.shift(), 'op,a,b,y,z,c,bw,v,chain');
    return lines.map(line => {
        assert.match(line, /^\d+(,\d+){8}$/);
        return line.split(',').map(Number);
    });
}

function readWaveforms() {
    const raw = source('checks/presets.vcd');
    assert.match(raw, /\$timescale\s+1ps\s+\$end/);
    const scopes = [];
    const signals = new Map();
    const state = {};
    const samples = new Map();
    let time = null;
    for (const line of raw.split(/\r?\n/).map(line => line.trim())) {
        const fields = line.split(/\s+/);
        if (fields[0] === '$scope') scopes.push(fields[2]);
        if (fields[0] === '$upscope') scopes.pop();
        if (fields[0] === '$var' && scopes.length === 1 && scopes[0] === 'presets_tb')
            signals.set(fields[3], fields[4]);
        if (line.startsWith('#')) {
            if (time !== null) samples.set(time, { ...state });
            time = Number(line.slice(1));
        }
        if (time === null) continue;
        const vector = /^b([01]+)\s+(\S+)$/.exec(line);
        const scalar = /^([01])(\S+)$/.exec(line);
        const change = vector ?? scalar;
        if (change && signals.has(change[2])) state[signals.get(change[2])] = parseInt(change[1], 2);
    }
    if (time !== null) samples.set(time, { ...state });
    return examples.map((example, index) => {
        const sample = samples.get(index * 10_000);
        assert.deepEqual([sample.op, sample.a, sample.b], [example.op, example.a, example.b]);
        const values = [sample.y, sample.zero, sample.carry, sample.borrow, sample.overflow];
        assert.deepEqual(values, expected(example.op, example.a, example.b));
        return values;
    });
}

const rows = referenceOnly ? referenceRows() : readRtlRows();
assert.equal(rows.length, 2048);
const vectors = rows.map(([op, a, b, y, z, c, bw, v, chain], index) => {
    assert.equal(256 * op + 16 * a + b, index, 'Vector order');
    assert.deepEqual([y, z, c, bw, v], expected(op, a, b), 'Result and status flags');
    assert.equal(chain, expectedChain(op, a, b), 'Carry chain');
    return y | (z << 4) | (c << 5) | (bw << 6) | (v << 7) | (chain << 8);
});
const wave = referenceOnly ? examples.map(({ op, a, b }) => expected(op, a, b)) : readWaveforms();
const data = JSON.stringify({ vectors, examples, wave, source: referenceOnly ? 'reference' : 'rtl' });

let template = source('preview.html');
if (publicBuild) {
    template = template
        .replace('<title>ALU Signal Lab · Ngô Quốc Thịnh</title>', '<title>ALU Signal Lab</title>')
        .replace('A 4-bit ALU explorer and GitHub profile preview for Ngô Quốc Thịnh.', 'Explore the signal path and status flags of a 4-bit ALU.')
        .replace('<span>Thịnh <small>/ GitHub preview</small></span>', '<span>ALU Signal Lab</span>')
        .replace(/      <div class="switcher"[\s\S]*?      <\/div>\r?\n/, '')
        .replace('Review build', '4-bit ALU')
        .replace(' role="tabpanel" aria-labelledby="lab-tab"', '')
        .replace('<button class="inline-button" data-show="profile">View profile preview</button>',
            '<a href="https://github.com/Thinh-2149/systemverilog-alu-4bit">Source on GitHub</a>')
        .replace(/  <main id="profile"[\s\S]*?  <\/main>\r?\n/, '')
        .replace('class="shell mast"', 'class="shell mast public-mast"');
}

const html = template
    .replace('/* PREVIEW_STYLE */', () => source('preview.css'))
    .replace('/* PREVIEW_DATA */', () => data.replace(/</g, '\\u003c'))
    .replace('/* PREVIEW_SCRIPT */', () => source('preview.js'));
fs.writeFileSync(output, html);
console.log('Checked ' + vectors.length + ' result, flag, and carry-chain vectors (' + (referenceOnly ? 'reference model' : 'RTL data') + ').');
