# 4-Bit Arithmetic Logic Unit (ALU) in SystemVerilog

An interactive 4-bit ALU built around a SystemVerilog design and an exhaustive, self-checking testbench. The demo shows the selected arithmetic, logic, or shift path and explains how the status flags respond.

[Open the interactive demo](https://thinh-2149.github.io/systemverilog-alu-4bit/) · [View test and synthesis runs](../../actions)

Start with **7 + 1** to see signed overflow, then compare it with **15 + 1** to see an unsigned carry and a zero result. Select a carry stage or output bit to inspect how that bit was produced.

## Interface

- A and B are 4-bit inputs. Y is the 4-bit result.
- Opcode selects one of eight operations. NOT and shifts use A.
- Zero is set whenever all result bits are zero.
- Carry reports unsigned addition carry-out or the bit shifted out.
- Borrow is set when unsigned subtraction has A smaller than B.
- Overflow is set when a signed addition or subtraction result falls outside −8 to 7.
- Flags used only by specific instructions are cleared for other instructions.

| Opcode | Operation | Meaning |
| --- | --- | --- |
| `000` | ADD | A + B |
| `001` | SUB | A − B through A + ~B + 1 |
| `010` | AND | A AND B |
| `011` | OR | A OR B |
| `100` | XOR | A XOR B |
| `101` | NOT | Invert A |
| `110` | SHL | Shift A left by one, filling with zero |
| `111` | SHR | Shift A right by one, filling with zero |

## Reproduce the hardware checks

Run these commands from the project root with Icarus Verilog, Yosys, and Node.js installed. The first testbench compares all 2,048 opcode/input triples with an arithmetic reference. The second records five examples as a VCD waveform.

```sh
mkdir -p checks
iverilog -g2012 -s alu4_tb -o checks/alu-test rtl/alu4.sv tb/alu4_tb.sv
iverilog -g2012 -s presets_tb -o checks/presets-test rtl/alu4.sv tb/presets_tb.sv
(cd checks && vvp alu-test && vvp presets-test)
yosys -s scripts/synth.ys
node scripts/build-preview.cjs
```

The site builder also checks every carry-chain trace and compares each waveform case with the expected result and flags. The GitHub Actions run retains the vectors, VCD, and synthesis log. To build the standalone demo locally, run `node scripts/build-preview.cjs --public index.html` after simulation.

- [Icarus Verilog simulation guide](https://steveicarus.github.io/iverilog/usage/simulation.html)
- [Yosys synthesis example](https://yosyshq.readthedocs.io/projects/yosys/en/latest/getting_started/example_synth.html)
