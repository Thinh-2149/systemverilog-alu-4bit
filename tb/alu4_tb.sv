`timescale 1ns/1ps
`default_nettype none

module alu4_tb;
    reg [3:0] a, b;
    reg [2:0] op;
    wire [3:0] y;
    wire [4:0] carry_chain;
    wire zero, carry, borrow, overflow;

    alu4 dut (
        .a(a), .b(b), .op(op), .y(y), .zero(zero), .carry(carry),
        .borrow(borrow), .overflow(overflow), .carry_chain(carry_chain)
    );

    integer op_index, a_index, b_index, full_unsigned, full_signed;
    integer a_signed, b_signed, count, vectors;
    reg [3:0] expected_y;
    reg expected_zero, expected_carry, expected_borrow, expected_overflow;

    initial begin
        vectors = $fopen("vectors.csv", "w");
        if (vectors == 0) $fatal(1, "Could not open vectors.csv");
        $fdisplay(vectors, "op,a,b,y,z,c,bw,v,chain");
        count = 0;

        for (op_index = 0; op_index < 8; op_index = op_index + 1) begin
            for (a_index = 0; a_index < 16; a_index = a_index + 1) begin
                for (b_index = 0; b_index < 16; b_index = b_index + 1) begin
                    op = op_index[2:0];
                    a = a_index[3:0];
                    b = b_index[3:0];
                    a_signed = (a_index < 8) ? a_index : a_index - 16;
                    b_signed = (b_index < 8) ? b_index : b_index - 16;
                    expected_carry = 0;
                    expected_borrow = 0;
                    expected_overflow = 0;
                    case (op_index)
                        0: begin
                            full_unsigned = a_index + b_index;
                            full_signed = a_signed + b_signed;
                            expected_y = full_unsigned[3:0];
                            expected_carry = full_unsigned > 15;
                            expected_overflow = (full_signed < -8 || full_signed > 7);
                        end
                        1: begin
                            full_unsigned = a_index - b_index;
                            full_signed = a_signed - b_signed;
                            expected_y = full_unsigned[3:0];
                            expected_borrow = full_unsigned < 0;
                            expected_overflow = (full_signed < -8 || full_signed > 7);
                        end
                        2: expected_y = a & b;
                        3: expected_y = a | b;
                        4: expected_y = a ^ b;
                        5: expected_y = 4'hf - a;
                        6: begin
                            full_unsigned = a_index * 2;
                            expected_y = full_unsigned[3:0];
                            expected_carry = full_unsigned > 15;
                        end
                        7: begin
                            full_unsigned = a_index / 2;
                            expected_y = full_unsigned[3:0];
                            expected_carry = (a_index % 2) != 0;
                        end
                    endcase
                    expected_zero = (expected_y == 0);
                    #1;
                    if ({y, zero, carry, borrow, overflow} !==
                        {expected_y, expected_zero, expected_carry, expected_borrow, expected_overflow})
                        $fatal(1, "op=%0d A=%0d B=%0d got %b expected %b",
                            op, a, b, {y, zero, carry, borrow, overflow},
                            {expected_y, expected_zero, expected_carry, expected_borrow, expected_overflow});
                    $fdisplay(vectors, "%0d,%0d,%0d,%0d,%0d,%0d,%0d,%0d,%0d",
                        op, a, b, y, zero, carry, borrow, overflow, carry_chain);
                    count = count + 1;
                end
            end
        end
        $fclose(vectors);
        $display("PASS: %0d input/opcode combinations", count);
        $finish;
    end
endmodule

`default_nettype wire
