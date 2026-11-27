`timescale 1ns/1ps
`default_nettype none

module presets_tb;
    reg [3:0] a, b;
    reg [2:0] op;
    wire [3:0] y;
    wire [4:0] carry_chain;
    wire zero, carry, borrow, overflow;

    alu4 dut (
        .a(a), .b(b), .op(op), .y(y), .zero(zero), .carry(carry),
        .borrow(borrow), .overflow(overflow), .carry_chain(carry_chain)
    );

    initial begin
        $dumpfile("presets.vcd");
        $dumpvars(0, presets_tb);
        op = 0; a = 7;  b = 1; #10;
        op = 0; a = 15; b = 1; #10;
        op = 1; a = 3;  b = 5; #10;
        op = 4; a = 10; b = 6; #10;
        op = 6; a = 9;  b = 0; #10;
        $finish;
    end
endmodule

`default_nettype wire
