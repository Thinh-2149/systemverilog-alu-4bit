'use strict';

const $ = id => document.getElementById(id);
const preview = JSON.parse($('preview-data').textContent);
const binary = (value, width = 4) => value.toString(2).padStart(width, '0');
const signed = value => value > 7 ? value - 16 : value;
const bitAt = (value, bit) => (value >> bit) & 1;
const write = (id, text) => { $(id).textContent = text; };

const operations = [
    { key: 'ADD', name: 'Addition', group: 0, symbol: '+' },
    { key: 'SUB', name: 'Subtraction', group: 0, symbol: '−' },
    { key: 'AND', name: 'Bitwise AND', group: 1, symbol: 'AND' },
    { key: 'OR', name: 'Bitwise OR', group: 1, symbol: 'OR' },
    { key: 'XOR', name: 'Bitwise XOR', group: 1, symbol: 'XOR' },
    { key: 'NOT', name: 'Invert A', group: 1, symbol: 'NOT' },
    { key: 'SHL', name: 'Shift left', group: 2, symbol: 'SHL' },
    { key: 'SHR', name: 'Shift right', group: 2, symbol: 'SHR' }
];
const flagDefinitions = [
    ['z', 'Zero'], ['c', 'Carry'], ['bw', 'Borrow'], ['v', 'Overflow']
];
const cases = preview.examples;
const state = { a: 7, b: 1, op: 0, flag: 'v', stage: 0, caseIndex: 0, trace: true };
const colors = { mint: '#88f2c9', copper: '#e8ae85', text: '#edf3ef', dim: '#9caeac', edge: '#3a5152' };

function result() {
    const vector = preview.vectors[256 * state.op + 16 * state.a + state.b];
    return { y: vector & 15, z: bitAt(vector, 4), c: bitAt(vector, 5),
        bw: bitAt(vector, 6), v: bitAt(vector, 7), chain: vector >> 8 };
}

function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function button(parent, className, text, onClick) {
    const element = node('button', className, text);
    element.type = 'button';
    element.addEventListener('click', onClick);
    parent.append(element);
    return element;
}

function setPressed(element, pressed) {
    element.setAttribute('aria-pressed', String(pressed));
}

function makeBits(container, label, onClick) {
    return [3, 2, 1, 0].map(bit => {
        const element = onClick ? button(container, 'bit', undefined, () => onClick(bit)) : node('div', 'bit');
        element.setAttribute('aria-label', label + ' bit ' + bit);
        const digit = node('b');
        element.append(digit, node('small', '', String(bit)));
        if (!onClick) container.append(element);
        return { element, digit, bit };
    });
}

function paintBits(cells, value, disabled) {
    for (const { element, digit, bit } of cells) {
        const high = bitAt(value, bit) === 1;
        element.dataset.on = String(high);
        digit.textContent = Number(high);
        if (element.tagName === 'BUTTON') {
            setPressed(element, high);
            element.disabled = disabled;
        } else {
            element.setAttribute('aria-label', 'Result bit ' + bit + ' is ' + Number(high));
        }
    }
}

function updateInputs(key, bit) {
    state[key] ^= 1 << bit;
    state.caseIndex = -1;
    render();
}

function chooseOperation(index) {
    state.op = index;
    state.stage = 0;
    state.flag = index === 1 ? 'bw' : index >= 6 ? 'c' : index === 0 ? 'v' : 'z';
    state.caseIndex = -1;
    render();
}

function chooseCase(index) {
    const example = cases[index];
    Object.assign(state, { a: example.a, b: example.b, op: example.op, flag: example.flag, stage: 0, caseIndex: index });
    render();
}

const aBits = makeBits($('input-a'), 'A', bit => updateInputs('a', bit));
const bBits = makeBits($('input-b'), 'B', bit => updateInputs('b', bit));
const yBits = makeBits($('output-bits'), 'Y');
const opButtons = operations.map((op, index) =>
    button($('op-picker'), 'op', op.key, () => chooseOperation(index)));
const flagButtons = flagDefinitions.map(([key, label]) => {
    const item = button($('flags'), 'flag', undefined, () => { state.flag = key; renderFlags(result()); });
    const digit = node('b');
    item.append(node('span', '', label), digit);
    return { item, digit, key, label };
});
const traceButtons = [0, 1, 2, 3].map(index => {
    const item = button($('trace-cells'), 'trace-cell', undefined, () => { state.stage = index; renderTrace(result()); drawCircuit(result()); });
    const name = node('strong');
    const flow = node('small');
    item.append(name, flow);
    return { item, name, flow };
});
const presetButtons = cases.map((example, index) => {
    const item = button($('presets'), 'preset', undefined, () => chooseCase(index));
    item.append(node('strong', '', example.title), node('small', '', example.display));
    return item;
});
const waveButtons = cases.map((example, index) =>
    button($('wave-select'), '', example.display, () => chooseCase(index)));

$('trace-toggle').addEventListener('click', () => {
    state.trace = !state.trace;
    $('trace-view').hidden = !state.trace;
    setPressed($('trace-toggle'), state.trace);
    drawCircuit(result());
});

function flagDetail(output) {
    if (state.flag === 'z') return output.z ? 'All four result bits are 0.' : 'At least one result bit is 1.';
    if (state.flag === 'c') {
        if (state.op === 0) return output.c ? 'The unsigned sum exceeds 15, so carry leaves bit 3.' : 'The unsigned sum fits in four bits.';
        if (state.op >= 6) return 'The original bit ' + (state.op === 6 ? 'A[3]' : 'A[0]') + ' shifted out as ' + output.c + '.';
        return 'Carry is used for addition and shifts.';
    }
    if (state.flag === 'bw') {
        if (state.op !== 1) return 'Borrow is used for subtraction.';
        return output.bw ? 'Unsigned A is smaller than B. Subtraction borrows beyond bit 3.' : 'Unsigned A is at least B, so subtraction can complete without a borrow.';
    }
    if (state.op > 1) return 'Signed overflow is checked on addition and subtraction.';
    const exact = state.op === 0 ? signed(state.a) + signed(state.b) : signed(state.a) - signed(state.b);
    return output.v
        ? 'The signed result ' + exact + ' is outside −8 to 7. The four stored bits read as ' + signed(output.y) + '.'
        : 'The signed result ' + exact + ' fits in the 4-bit range −8 to 7.';
}

function renderFlags(output) {
    for (const { item, digit, key, label } of flagButtons) {
        const value = output[key];
        digit.textContent = value;
        item.dataset.high = String(value === 1);
        item.setAttribute('aria-label', label + ' ' + value + '. Explain flag');
        setPressed(item, key === state.flag);
    }
    const label = flagDefinitions.find(([key]) => key === state.flag)[1];
    write('flag-heading', label + ' = ' + output[state.flag]);
    write('flag-detail', flagDetail(output));
}

function renderTrace(output) {
    const op = operations[state.op];
    const ripple = op.group === 0;
    write('trace-title', ripple ? 'Ripple carry' : op.group === 1 ? 'Bit lanes' : 'Shift map');
    write('trace-legend', ripple ? 'Least significant bit first' : 'Most significant bit first');
    for (const [index, { item, name, flow }] of traceButtons.entries()) {
        const bit = ripple ? index : 3 - index;
        name.textContent = ripple ? 'Bit ' + bit : 'Y[' + bit + ']';
        if (ripple) {
            flow.textContent = 'C' + bit + '=' + bitAt(output.chain, bit) + ' → C' + (bit + 1) + '=' + bitAt(output.chain, bit + 1);
        } else if (op.group === 1) {
            const bWord = state.op === 5 ? '' : ' · ' + bitAt(state.b, bit);
            flow.textContent = bitAt(state.a, bit) + bWord + ' → ' + bitAt(output.y, bit);
        } else {
            const input = state.op === 6 ? bit - 1 : bit + 1;
            flow.textContent = (input < 0 || input > 3 ? '0 fill' : 'A[' + input + ']') + ' → ' + bitAt(output.y, bit);
        }
        setPressed(item, index === state.stage);
    }
    const bit = ripple ? state.stage : 3 - state.stage;
    const a = bitAt(state.a, bit);
    const b = bitAt(state.b, bit);
    const y = bitAt(output.y, bit);
    if (ripple) {
        const cin = bitAt(output.chain, bit);
        const cout = bitAt(output.chain, bit + 1);
        const effective = state.op === 1 ? (b ^ 1) + ' (inverted B)' : b;
        write('trace-detail', 'Bit ' + bit + ' adds ' + a + ' + ' + effective + ' + ' + cin +
            '. The sum bit is ' + y + ' and the next carry is ' + cout + '.' +
            (state.op === 1 ? ' SUB starts with C0 = 1.' : ''));
    } else if (op.group === 1) {
        write('trace-detail', 'Bit ' + bit + ' evaluates ' +
            (state.op === 5 ? 'NOT ' + a : a + ' ' + op.symbol + ' ' + b) + ' and produces ' + y + '.');
    } else {
        const source = state.op === 6 ? bit - 1 : bit + 1;
        write('trace-detail', 'Y[' + bit + '] is ' + y +
            (source < 0 || source > 3 ? ' from the zero-filled edge.' : ' from A[' + source + '].'));
    }
}

function render() {
    const op = operations[state.op];
    const output = result();
    const unary = state.op >= 5;
    paintBits(aBits, state.a, false);
    paintBits(bBits, state.b, unary);
    paintBits(yBits, output.y);
    write('a-decimal', state.a + ' unsigned');
    write('b-decimal', state.b + ' unsigned');
    write('opcode', binary(state.op, 3) + ' · ' + op.name);
    $('operand-note').hidden = !unary;
    write('unsigned-result', output.y);
    write('signed-result', signed(output.y));
    for (const [index, item] of opButtons.entries()) setPressed(item, index === state.op);
    for (const buttons of [presetButtons, waveButtons]) {
        for (const [index, item] of buttons.entries()) setPressed(item, index === state.caseIndex);
    }
    renderFlags(output);
    renderTrace(output);
    drawCircuit(output);
    drawWave();
}

function surface(canvas, width, height) {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(scale, scale);
    return ctx;
}

function path(ctx, points, color, lineWidth = 1) {
    ctx.beginPath();
    for (const [index, [x, y]] of points.entries()) {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
}

function box(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function label(ctx, content, x, y, color, font, align = 'left') {
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.font = font + ' Consolas, monospace';
    ctx.fillText(content, x, y);
}

function pin(ctx, x, y, color, size = 3) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawCircuit(output) {
    const canvas = $('circuit');
    const ctx = surface(canvas, 630, 292);
    if (!ctx) return;
    const op = operations[state.op];
    const unary = state.op >= 5;
    canvas.setAttribute('aria-label', op.name + ' routes input A ' + binary(state.a) +
        (unary ? '' : ' and input B ' + binary(state.b)) + ' to output ' + binary(output.y) + '.');
    for (let x = 12; x < 630; x += 15) {
        for (let y = 11; y < 292; y += 15) pin(ctx, x, y, '#23383b', 1);
    }

    const branches = [
        { y: 56, title: 'ARITHMETIC', text: 'ADD  /  SUB' },
        { y: 143, title: 'BITWISE', text: 'AND  /  OR  /  XOR  /  NOT' },
        { y: 230, title: 'SHIFT', text: 'SHL  /  SHR' }
    ];
    const branchY = branches[op.group].y;
    const inputA = [[120, 97], [151, 97], [151, branchY], [226, branchY]];
    const inputB = [[120, 195], [176, 195], [176, branchY + 14], [226, branchY + 14]];
    const outputPath = [[444, branchY], [484, branchY], [484, 143], [515, 143]];
    for (const { y } of branches) {
        path(ctx, [[151, y], [226, y]], '#486361');
        path(ctx, [[176, y + 14], [226, y + 14]], '#3c5453');
        path(ctx, [[444, y], [484, y], [484, 143]], '#486361');
    }
    path(ctx, inputA, colors.mint, 2.5);
    path(ctx, inputB, unary ? '#486361' : colors.copper, unary ? 1 : 2);
    path(ctx, outputPath, colors.mint, 2.5);
    pin(ctx, 151, branchY, colors.mint);
    if (!unary) pin(ctx, 176, branchY + 14, colors.copper);
    pin(ctx, 484, 143, colors.mint);

    for (const [index, group] of branches.entries()) {
        const active = index === op.group;
        box(ctx, 226, group.y - 28, 218, 56, 7, active ? '#1a3b31' : '#142326', active ? '#5aa589' : '#3a5355');
        label(ctx, group.title, 240, group.y - 12, active ? colors.mint : colors.dim, '700 12px');
        if (!active || !state.trace) {
            label(ctx, active ? op.key + ' · ' + group.text : group.text, 240, group.y + 10, colors.dim, '10px');
            continue;
        }
        for (let step = 0; step < 4; step++) {
            const selected = step === state.stage;
            const x = 240 + 49 * step;
            const stage = op.group === 0 ? 'FA' + step : 'Y[' + (3 - step) + ']';
            box(ctx, x, group.y + 1, 43, 17, 3, selected ? '#82e4be' : '#244a3c', '#4c8a75');
            label(ctx, stage, x + 21, group.y + 10, selected ? '#0d3025' : colors.mint, '700 9px', 'center');
        }
    }

    function pad(x, y, name, data, active) {
        box(ctx, x, y - 25, 95, 50, 7, '#16272a', active ? '#578a79' : colors.edge);
        label(ctx, name, x + 11, y - 10, active ? colors.mint : colors.dim, '700 10px');
        label(ctx, data, x + 11, y + 9, colors.text, '700 20px');
    }
    pad(25, 97, 'INPUT A', binary(state.a), true);
    pad(25, 195, unary ? 'B · HELD' : 'INPUT B', binary(state.b), !unary);
    pad(515, 143, 'OUTPUT Y', binary(output.y), true);
    label(ctx, 'OP ' + binary(state.op, 3), 25, 268, colors.copper, '700 10px');
    label(ctx, 'ACTIVE PATH', 606, 268, colors.mint, '10px', 'right');
}

function drawWave() {
    const ctx = surface($('wave'), 1060, 258);
    if (!ctx) return;
    const start = 136, step = 176;
    const rows = ['Y[3:0]', 'Zero', 'Carry', 'Borrow', 'Overflow'];
    const data = preview.wave;
    const name = preview.source === 'rtl' ? 'ns' : '';
    const marker = state.caseIndex >= 0;
    if (marker) {
        const x = start + state.caseIndex * step;
        box(ctx, x, 8, step, 234, 4, '#17332d');
        path(ctx, [[x, 12], [x, 242]], colors.mint, 1.4);
    }
    for (let index = 0; index <= cases.length; index++) {
        const x = start + index * step;
        path(ctx, [[x, 25], [x, 240]], '#3c5353');
        label(ctx, name ? index * 10 + ' ' + name : 'v' + index, x, 17, colors.dim, '13px', 'center');
    }
    for (const [row, rowName] of rows.entries()) {
        const y = 58 + row * 40;
        label(ctx, rowName, 19, y, colors.text, '700 14px');
        path(ctx, [[start, y + 17], [start + cases.length * step, y + 17]], '#23383a');
        for (let i = 0; i < cases.length; i++) {
            const x = start + i * step;
            const value = data[i][row];
            if (row === 0) {
                path(ctx, [[x, y], [x + 8, y - 11], [x + step - 8, y - 11], [x + step, y],
                    [x + step - 8, y + 11], [x + 8, y + 11], [x, y]], colors.mint, 1.5);
                label(ctx, binary(value), x + step / 2, y, colors.mint, '700 14px', 'center');
                continue;
            }
            const level = y + (value ? -8 : 7);
            path(ctx, [[x, level], [x + step, level]], value ? colors.copper : '#87a09b', 2);
            if (i > 0) {
                const last = y + (data[i - 1][row] ? -8 : 7);
                if (last !== level) path(ctx, [[x, last], [x, level]], colors.copper, 2);
            }
        }
    }
    const labelText = marker ? cases[state.caseIndex].display : 'Select a waveform case';
    write('wave-readout', labelText);
}

function show(tabName, moveFocus = false) {
    for (const name of ['lab', 'profile']) {
        const active = name === tabName;
        $(name).hidden = !active;
        $(name + '-tab').setAttribute('aria-selected', String(active));
        $(name + '-tab').tabIndex = active ? 0 : -1;
    }
    window.scrollTo(0, 0);
    if (moveFocus) $(tabName + '-tab').focus();
}

for (const name of ['lab', 'profile']) {
    const tab = $(name + '-tab');
    if (!tab) continue;
    tab.addEventListener('click', () => show(name));
    tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'lab' : event.key === 'End' ? 'profile' : name === 'lab' ? 'profile' : 'lab';
        show(next, true);
    });
}
for (const action of document.querySelectorAll('[data-show]')) {
    action.addEventListener('click', () => show(action.dataset.show, true));
}

write('verification-label', preview.source === 'rtl'
    ? 'Icarus Verilog · 2,048 RTL vectors checked'
    : 'Reference model · 2,048 vectors checked · RTL run pending');
write('wave-provenance', preview.source === 'rtl'
    ? 'Five cases captured from the SystemVerilog testbench VCD.'
    : 'Five cases from the reference model, shown in testbench order.');
render();
