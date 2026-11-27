`default_nettype none

module alu4 (
    input  wire [3:0] a,
    input  wire [3:0] b,
    input  wire [2:0] op,
    output reg  [3:0] y,
    output wire       zero,
    output reg        carry,
    output reg        borrow,
    output reg        overflow,
    output wire [4:0] carry_chain
);
    localparam [2:0] ADD = 3'b000, SUB = 3'b001,
                     AND_OP = 3'b010, OR_OP = 3'b011,
                     XOR_OP = 3'b100, NOT_OP = 3'b101,
                     SHL = 3'b110, SHR = 3'b111;

    wire subtract = (op == SUB);
    wire [3:0] b_effective = b ^ {4{subtract}};
    wire [3:0] propagate = a ^ b_effective;
    wire [3:0] sum;

    assign carry_chain[0] = subtract;
    generate
        for (genvar bit_index = 0; bit_index < 4; bit_index = bit_index + 1) begin : stage
            assign sum[bit_index] = propagate[bit_index] ^ carry_chain[bit_index];
            assign carry_chain[bit_index + 1] =
                (a[bit_index] & b_effective[bit_index]) |
                (propagate[bit_index] & carry_chain[bit_index]);
        end
    endgenerate

    assign zero = (y == 4'b0000);

    always @* begin
        y = 4'b0000;
        carry = 1'b0;
        borrow = 1'b0;
        overflow = 1'b0;

        case (op)
            ADD: begin
                y = sum;
                carry = carry_chain[4];
                overflow = carry_chain[3] ^ carry_chain[4];
            end
            SUB: begin
                y = sum;
                borrow = ~carry_chain[4];
                overflow = carry_chain[3] ^ carry_chain[4];
            end
            AND_OP: y = a & b;
            OR_OP:  y = a | b;
            XOR_OP: y = a ^ b;
            NOT_OP: y = ~a;
            SHL: begin
                y = {a[2:0], 1'b0};
                carry = a[3];
            end
            SHR: begin
                y = {1'b0, a[3:1]};
                carry = a[0];
            end
            default: y = 4'b0000;
        endcase
    end
endmodule

`default_nettype wire
